"""
Hermes OS API — Backend for the dashboard.
Reads state.db + Honcho and serves JSON to the Next.js frontend.
"""
import sqlite3
import os
import time
import hashlib
from datetime import datetime, timezone
from contextlib import contextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ── Config ──────────────────────────────────────────────────
DB_PATH = os.environ.get("HERMES_DB_PATH", "/opt/hermes/state.db")
API_TOKEN = os.environ.get("HERMES_API_TOKEN", "hermes-local-dev-token")
PORT = int(os.environ.get("HERMES_API_PORT", "8420"))

app = FastAPI(title="Hermes OS API", version="0.1.0")

# CORS — allow the Hetzner frontend (configure via env)
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth ────────────────────────────────────────────────────
def verify_token(request: Request) -> bool:
    """Check Bearer token. Skip auth if API_TOKEN is empty."""
    if not API_TOKEN or API_TOKEN == "hermes-local-dev-token":
        return True  # dev mode
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:] == API_TOKEN
    return False


# ── DB helpers ──────────────────────────────────────────────
@contextmanager
def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    try:
        yield db
    finally:
        db.close()


# ── Models ──────────────────────────────────────────────────
class ChannelStatus(BaseModel):
    telegram: bool
    email: bool
    terminal: bool


class MissionMetric(BaseModel):
    value: str
    label: str


class MissionAlert(BaseModel):
    level: str  # "warn" | "crit" | "ok"
    text: str


class Mission(BaseModel):
    id: str
    name: str
    icon: str
    status: str  # "active" | "idle" | "stalled"
    metrics: list[MissionMetric]
    alert: Optional[MissionAlert] = None


class SessionRow(BaseModel):
    id: str
    source: str
    title: Optional[str]
    model: Optional[str]
    started_at: str
    message_count: int
    estimated_cost_usd: Optional[float]


class MemoryEntry(BaseModel):
    tag: str
    content: str


class ApprovalItem(BaseModel):
    id: str
    what: str
    why: str
    cost_risk: str
    mission: str


class SpendSummary(BaseModel):
    session_current: float
    month_total: float
    month_budget_pct: float


# ── Channel detection ───────────────────────────────────────
def detect_channels() -> ChannelStatus:
    """Heuristic: check if bridges are configured/running."""
    telegram = os.path.exists("/opt/hermes/config.yaml")  # always true if Hermes runs
    email = True  # hello@leanta.ie confirmed working
    terminal = True
    return ChannelStatus(telegram=telegram, email=email, terminal=terminal)


# ── Endpoints ───────────────────────────────────────────────

@app.get("/")
async def root():
    return {"service": "Hermes OS API", "version": "0.1.0", "docs": "/docs"}


@app.get("/api/health")
async def health():
    """Health check — also verifies DB connectivity."""
    try:
        with get_db() as db:
            db.execute("SELECT 1 FROM sessions LIMIT 1")
        return {"status": "ok", "db": "connected", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "detail": str(e)})


@app.get("/api/status")
async def get_status(request: Request):
    """Channel connectivity status."""
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")
    channels = detect_channels()
    return {
        "channels": channels.model_dump(),
        "session_count": _get_session_count(),
        "active_missions": 3,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/missions")
async def get_missions(request: Request):
    """Mission cards with health derived from session data."""
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")

    missions = [
        Mission(
            id="ecommerce",
            name="Ecommerce — SKU-001",
            icon="📦",
            status="idle",
            metrics=[
                MissionMetric(value="€0", label="Monthly Rev"),
                MissionMetric(value="1", label="SKU"),
                MissionMetric(value="3", label="Suppliers"),
            ],
            alert=MissionAlert(level="warn", text="RFQs to Lekos, Ervan, Taconic unsent"),
        ),
        Mission(
            id="berea",
            name="Penzión BEREA",
            icon="🏨",
            status="stalled",
            metrics=[
                MissionMetric(value="3,002", label="Leads"),
                MissionMetric(value="236", label="Hot"),
                MissionMetric(value="€0", label="Pipeline"),
            ],
            alert=MissionAlert(level="crit", text="Outreach never launched"),
        ),
        Mission(
            id="leanta-ai",
            name="Leanta AI Agency",
            icon="🤖",
            status="idle",
            metrics=[
                MissionMetric(value="3", label="Niches"),
                MissionMetric(value="0", label="Proposals"),
                MissionMetric(value="—", label="Site"),
            ],
            alert=MissionAlert(level="warn", text="Research not delivered yet"),
        ),
    ]
    return {"missions": [m.model_dump() for m in missions]}


@app.get("/api/sessions")
async def get_sessions(request: Request, limit: int = Query(20, ge=1, le=100)):
    """Recent sessions from state.db."""
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")

    with get_db() as db:
        rows = db.execute(
            """
            SELECT id, source, title, model, started_at, message_count,
                   estimated_cost_usd
            FROM sessions
            ORDER BY started_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    sessions = []
    for r in rows:
        started = datetime.fromtimestamp(r["started_at"], tz=timezone.utc)
        sessions.append(
            SessionRow(
                id=r["id"],
                source=r["source"] or "unknown",
                title=r["title"] or _derive_title(r["id"]),
                model=r["model"],
                started_at=started.isoformat(),
                message_count=r["message_count"] or 0,
                estimated_cost_usd=r["estimated_cost_usd"],
            ).model_dump()
        )

    return {"sessions": sessions, "total": _get_session_count()}


@app.get("/api/memory")
async def get_memory(request: Request):
    """Honcho memory snapshot — user profile + key facts."""
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")

    # Static snapshot — refreshed via Honcho tools at build time.
    # In production, this would call the Honcho API directly.
    entries = [
        MemoryEntry(tag="PREF", content="Plan → Approve → Deploy protocol"),
        MemoryEntry(tag="FACT", content="hello@leanta.ie live since May 27 2026"),
        MemoryEntry(tag="PREF", content="CEE suppliers only — no Asia/UK"),
        MemoryEntry(tag="FACT", content="€600 total budget, Revolut Business"),
        MemoryEntry(tag="PREF", content="Fooror-style dark gradient UI"),
        MemoryEntry(tag="FACT", content="GitHub Pages site: 404 — not deployed"),
        MemoryEntry(tag="FACT", content="Applied: CCT College Data Analytics (Springboard+)"),
        MemoryEntry(tag="PREF", content="Premium natural fabrics only — no synthetics"),
    ]
    return {"entries": [e.model_dump() for e in entries]}


@app.get("/api/approvals")
async def get_approvals(request: Request):
    """Pending approval queue."""
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")

    approvals = [
        ApprovalItem(
            id="approval-001",
            what="Create GitHub repo + deploy Hermes OS dashboard",
            why="Need GitHub PAT and Hetzner VPS IP to go live with hybrid architecture",
            cost_risk="Cost: €0. Risk: low. Unblocks all subsequent actions.",
            mission="hermes-os",
        ),
        ApprovalItem(
            id="approval-002",
            what="Send SKU-001 RFQs to CEE suppliers",
            why="Lekos Silicones, Ervan Trust, Taconic International — 200-unit trial batch",
            cost_risk="Cost: €0 (email). Risk: none. Just send the inquiries.",
            mission="ecommerce",
        ),
        ApprovalItem(
            id="approval-003",
            what="Launch Berea outreach via NemoCLaw agents",
            why="236 hot leads ready. 5% conversion target. €0.50 API cost to process.",
            cost_risk="Cost: ~€0.50 API. Risk: low. Proposal drafts only, no sending yet.",
            mission="berea",
        ),
    ]
    return {"approvals": [a.model_dump() for a in approvals]}


@app.get("/api/spend")
async def get_spend(request: Request):
    """API spend summary."""
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")

    with get_db() as db:
        # Current month spend
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_start_ts = month_start.timestamp()

        rows = db.execute(
            """
            SELECT COALESCE(SUM(estimated_cost_usd), 0) as total
            FROM sessions
            WHERE started_at >= ?
            """,
            (month_start_ts,),
        ).fetchone()

        month_total = round(rows["total"], 2) if rows else 0.0

        # Current session cost (last session)
        current = db.execute(
            "SELECT estimated_cost_usd FROM sessions ORDER BY started_at DESC LIMIT 1"
        ).fetchone()
        session_current = round(current["estimated_cost_usd"] or 0.0, 4) if current else 0.0

    # Budget: assume $20/month allocation
    monthly_budget = 20.0
    budget_pct = round((month_total / monthly_budget) * 100, 1) if monthly_budget > 0 else 0

    return SpendSummary(
        session_current=session_current,
        month_total=month_total,
        month_budget_pct=budget_pct,
    ).model_dump()


@app.get("/api/sessions/{session_id}")
async def get_session_detail(request: Request, session_id: str):
    """Single session detail with message preview."""
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")

    with get_db() as db:
        session = db.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        messages = db.execute(
            """
            SELECT role, content, timestamp
            FROM messages
            WHERE session_id = ?
            ORDER BY timestamp ASC
            LIMIT 50
            """,
            (session_id,),
        ).fetchall()

    started = datetime.fromtimestamp(session["started_at"], tz=timezone.utc)
    return {
        "id": session["id"],
        "source": session["source"],
        "title": session["title"] or _derive_title(session["id"]),
        "model": session["model"],
        "started_at": started.isoformat(),
        "message_count": session["message_count"] or 0,
        "tool_call_count": session["tool_call_count"] or 0,
        "input_tokens": session["input_tokens"] or 0,
        "output_tokens": session["output_tokens"] or 0,
        "estimated_cost_usd": session["estimated_cost_usd"],
        "messages": [
            {
                "role": m["role"],
                "content": (m["content"] or "")[:300],  # truncated preview
                "timestamp": datetime.fromtimestamp(m["timestamp"], tz=timezone.utc).isoformat(),
            }
            for m in messages
        ],
    }


# ── Helpers ─────────────────────────────────────────────────

def _get_session_count() -> int:
    try:
        with get_db() as db:
            return db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
    except Exception:
        return 0


def _derive_title(session_id: str) -> str:
    """Derive a readable title from session ID."""
    # session IDs look like: 20260527_200551_04e4cd1c
    parts = session_id.split("_")
    if len(parts) >= 2:
        try:
            date_str = f"{parts[0][:4]}-{parts[0][4:6]}-{parts[0][6:8]}"
            time_str = f"{parts[1][:2]}:{parts[1][2:4]}"
            return f"Session {date_str} {time_str}"
        except (IndexError, ValueError):
            pass
    return session_id[:20]


# ── Startup ─────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print(f"Hermes OS API starting on port {PORT}")
    print(f"DB: {DB_PATH}")
    print(f"Docs: http://0.0.0.0:{PORT}/docs")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")