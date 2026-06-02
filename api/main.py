"""
Hermes OS API — Backend for the dashboard.
Reads state.db + Honcho and serves JSON to the Next.js frontend.
v0.2 — Added SSE streaming, WebSocket terminal, dashboard endpoints.
"""
import sqlite3
import os
import time
import json
import asyncio
import hashlib
from datetime import datetime, timezone
from contextlib import contextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

# ── Config ──────────────────────────────────────────────────
DB_PATH = os.environ.get("HERMES_DB_PATH", "/opt/hermes/state.db")
API_TOKEN = os.environ.get("HERMES_API_TOKEN", "hermes-local-dev-token")
PORT = int(os.environ.get("HERMES_API_PORT", "8420"))

app = FastAPI(title="Hermes OS API", version="0.2.0")

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
    if not API_TOKEN or API_TOKEN == "hermes-local-dev-token":
        return True
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
    level: str
    text: str

class Mission(BaseModel):
    id: str
    name: str
    icon: str
    status: str
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

# Dashboard models
class AgentNode(BaseModel):
    id: str
    name: str
    type: str  # orchestrator | mission | monitor | pipeline
    status: str  # active | idle | error
    mission: Optional[str] = None
    model: Optional[str] = None
    tasks_completed: int = 0
    tokens_used: int = 0

class GraphEdge(BaseModel):
    source: str
    target: str
    type: str  # delegates | syncs | reports
    label: str

class DashboardEvent(BaseModel):
    id: str
    type: str  # info | warn | error | deploy | agent
    source: str
    text: str
    timestamp: str

class MetricsSnapshot(BaseModel):
    active_sessions: int
    active_agents: int
    total_messages: int
    total_sessions: int
    messages_per_minute: float
    spend_month: float
    budget_pct: float
    success_rate: float
    timestamp: str


# ── Channel detection ───────────────────────────────────────
def detect_channels():
    telegram = os.path.exists("/opt/hermes/config.yaml")
    email = True
    terminal = True
    return ChannelStatus(telegram=telegram, email=email, terminal=terminal)


# ── Standard Endpoints ──────────────────────────────────────

@app.get("/")
async def root():
    return {"service": "Hermes OS API", "version": "0.2.0", "docs": "/docs"}


@app.get("/api/health")
async def health():
    try:
        with get_db() as db:
            db.execute("SELECT 1 FROM sessions LIMIT 1")
        return {"status": "ok", "db": "connected", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "detail": str(e)})


@app.get("/api/status")
async def get_status(request: Request):
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
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")
    missions = [
        Mission(id="ecommerce", name="Ecommerce — SKU-001", icon="📦", status="idle",
                metrics=[MissionMetric(value="€0", label="Monthly Rev"),
                         MissionMetric(value="1", label="SKU"),
                         MissionMetric(value="0", label="Suppliers")],
                alert=MissionAlert(level="info", text="SKU-001 closed by Samuel 2026-06-02")),
        Mission(id="berea", name="Penzión BEREA", icon="🏨", status="active",
                metrics=[MissionMetric(value="3,002", label="Leads"),
                         MissionMetric(value="236", label="Hot"),
                         MissionMetric(value="€0", label="Pipeline")],
                alert=MissionAlert(level="warn", text="Outreach pending — Brevo ready")),
        Mission(id="leanta-ai", name="Leanta AI Agency", icon="🤖", status="active",
                metrics=[MissionMetric(value="3", label="Niches"),
                         MissionMetric(value="0", label="Proposals"),
                         MissionMetric(value="Live", label="Dashboard")],
                alert=MissionAlert(level="ok", text="Dashboard deployed to Vercel")),
    ]
    return {"missions": [m.model_dump() for m in missions]}


@app.get("/api/sessions")
async def get_sessions(request: Request, limit: int = Query(20, ge=1, le=100)):
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")
    with get_db() as db:
        rows = db.execute("""
            SELECT id, source, title, model, started_at, message_count, estimated_cost_usd
            FROM sessions ORDER BY started_at DESC LIMIT ?
        """, (limit,)).fetchall()
    sessions = []
    for r in rows:
        started = datetime.fromtimestamp(r["started_at"], tz=timezone.utc)
        sessions.append(SessionRow(
            id=r["id"], source=r["source"] or "unknown",
            title=r["title"] or _derive_title(r["id"]), model=r["model"],
            started_at=started.isoformat(), message_count=r["message_count"] or 0,
            estimated_cost_usd=r["estimated_cost_usd"],
        ).model_dump())
    return {"sessions": sessions, "total": _get_session_count()}


@app.get("/api/memory")
async def get_memory(request: Request):
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")
    entries = [
        MemoryEntry(tag="PREF", content="Plan → Approve → Deploy protocol"),
        MemoryEntry(tag="FACT", content="hello@leanta.ie live since May 27 2026"),
        MemoryEntry(tag="PREF", content="CEE suppliers only — no Asia/UK"),
        MemoryEntry(tag="FACT", content="€600 total budget, Revolut Business"),
        MemoryEntry(tag="FACT", content="Dashboard live at https://hermes-dashboard.vercel.app"),
        MemoryEntry(tag="FACT", content="Brevo CRM connected — 86 contacts, API ready"),
        MemoryEntry(tag="PREF", content="Premium natural fabrics only — no synthetics"),
    ]
    return {"entries": [e.model_dump() for e in entries]}


@app.get("/api/approvals")
async def get_approvals(request: Request):
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")
    approvals = [
        ApprovalItem(id="approval-001", what="Create Brevo segments for Berea lead groups",
                     why="9 group segments needed before pushing leads", cost_risk="Cost: €0. Risk: low.", mission="berea"),
        ApprovalItem(id="approval-002", what="Set up NemoCLaw Telegram channel bridge",
                     why="NemoCLaw agents run on Samuel's Mac, need shared channel", cost_risk="Cost: €0. Risk: low.", mission="berea"),
        ApprovalItem(id="approval-003", what="Fix DeepSeek token tracking in state.db",
                     why="All 10 DeepSeek sessions show €0.00 — blind spot on costs", cost_risk="Cost: €0. Risk: none. Read-only fix.", mission="hermes-os"),
    ]
    return {"approvals": [a.model_dump() for a in approvals]}


@app.get("/api/spend")
async def get_spend(request: Request):
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")
    with get_db() as db:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_start_ts = month_start.timestamp()
        rows = db.execute("""
            SELECT COALESCE(SUM(estimated_cost_usd), 0) as total
            FROM sessions WHERE started_at >= ?
        """, (month_start_ts,)).fetchone()
        month_total = round(rows["total"], 2) if rows else 0.0
        current = db.execute(
            "SELECT estimated_cost_usd FROM sessions ORDER BY started_at DESC LIMIT 1"
        ).fetchone()
        session_current = round(current["estimated_cost_usd"] or 0.0, 4) if current else 0.0
    monthly_budget = 20.0
    budget_pct = round((month_total / monthly_budget) * 100, 1) if monthly_budget > 0 else 0
    return SpendSummary(session_current=session_current, month_total=month_total, month_budget_pct=budget_pct).model_dump()


@app.get("/api/sessions/{session_id}")
async def get_session_detail(request: Request, session_id: str):
    if not verify_token(request):
        raise HTTPException(status_code=401, detail="Invalid token")
    with get_db() as db:
        session = db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        messages = db.execute("""
            SELECT role, content, timestamp FROM messages
            WHERE session_id = ? ORDER BY timestamp ASC LIMIT 50
        """, (session_id,)).fetchall()
    started = datetime.fromtimestamp(session["started_at"], tz=timezone.utc)
    return {
        "id": session["id"], "source": session["source"],
        "title": session["title"] or _derive_title(session["id"]), "model": session["model"],
        "started_at": started.isoformat(), "message_count": session["message_count"] or 0,
        "tool_call_count": session["tool_call_count"] or 0,
        "input_tokens": session["input_tokens"] or 0,
        "output_tokens": session["output_tokens"] or 0,
        "estimated_cost_usd": session["estimated_cost_usd"],
        "messages": [{"role": m["role"], "content": (m["content"] or "")[:300],
                      "timestamp": datetime.fromtimestamp(m["timestamp"], tz=timezone.utc).isoformat()}
                     for m in messages],
    }


# ── Honcho Memory Endpoints ─────────────────────────────────

HONCHO_MEMORY_PATH = os.path.join(os.path.dirname(__file__), "honcho_memory.json")

def _load_honcho_memory() -> list[dict]:
    """Load Honcho memory snapshot from JSON file."""
    try:
        with open(HONCHO_MEMORY_PATH) as f:
            return json.load(f)
    except Exception:
        return []


@app.get("/api/honcho/memory")
async def get_honcho_memory():
    """Full Honcho memory snapshot."""
    return {"entries": _load_honcho_memory(), "total": len(_load_honcho_memory())}


@app.get("/api/honcho/search")
async def search_honcho_memory(q: str = Query(..., min_length=2)):
    """Text search across Honcho memory entries."""
    entries = _load_honcho_memory()
    q_lower = q.lower()
    results = []
    for entry in entries:
        score = 0
        if q_lower in entry.get("content", "").lower():
            score += 10
        if q_lower in entry.get("tag", "").lower():
            score += 5
        if score > 0:
            results.append({**entry, "score": score})
    results.sort(key=lambda x: x["score"], reverse=True)
    return {"query": q, "results": results, "total": len(results)}


@app.get("/api/honcho/context")
async def get_honcho_context(question: Optional[str] = Query(None)):
    """Synthesized context summary from Honcho memory."""
    entries = _load_honcho_memory()
    # Group by tag
    by_tag = {}
    for e in entries:
        tag = e["tag"]
        if tag not in by_tag:
            by_tag[tag] = []
        by_tag[tag].append(e["content"])
    
    # Build context
    context = {
        "profile": "Samuel Vyhnanek — Entrepreneur, 15yr Bakery Ops, ADHD/Lean, 3 active missions",
        "preferences": "Plan→Approve→Deploy, English only, no fluff, data-driven, premium quality",
        "active_missions": {
            "ecommerce": "CLOSED — SKU-001 oven liners cancelled",
            "berea": "3,002 leads, 236 hot, Brevo CRM connected, outreach pending NemoCLaw bridge",
            "leanta-ai": "3 niches validated, 0 proposals, dashboard live on Vercel"
        },
        "infrastructure": "Hetzner VPS (46.225.84.249), Caddy, Next.js 15, FastAPI, GitHub TicodeB, Vercel",
        "tokens_stored": ["GITHUB_PAT", "VERCEL_TOKEN", "BREVO_API_KEY", "Zoho SMTP"],
        "tags": by_tag,
    }
    
    if question:
        q = question.lower()
        relevant = []
        if "berea" in q or "lead" in q:
            relevant.append("BEREA: 3,002 leads, 236 hot. Brevo connected. NemoCLaw agents need Telegram bridge to push leads.")
        if "brevo" in q or "crm" in q:
            relevant.append("Brevo CRM: 86 contacts, 0 segments. API key stored. Need 9 group segments created.")
        if "dashboard" in q or "vercel" in q:
            relevant.append("Dashboard live at https://hermes-dashboard.vercel.app. Auto-deploys from GitHub.")
        if "sku" in q or "ecommerce" in q:
            relevant.append("Ecommerce: SKU-001 closed by Samuel 2026-06-02. No active products.")
        context["relevant"] = relevant
    
    return {"context": context, "question": question}


# ── Dashboard Endpoints ─────────────────────────────────────

@app.get("/api/dashboard/metrics")
async def get_dashboard_metrics():
    """Live metrics snapshot for the dashboard."""
    with get_db() as db:
        total_sessions = db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        total_messages = db.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
        
        # Active sessions (last hour)
        one_hour_ago = time.time() - 3600
        active = db.execute(
            "SELECT COUNT(*) FROM sessions WHERE started_at > ?", (one_hour_ago,)
        ).fetchone()[0]
        
        # Messages per minute (last hour)
        recent_msgs = db.execute(
            "SELECT COUNT(*) FROM messages WHERE timestamp > ?", (one_hour_ago,)
        ).fetchone()[0]
        msg_per_min = round(recent_msgs / 60, 1) if recent_msgs > 0 else 0
        
        # Spend
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        spend_month = db.execute(
            "SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM sessions WHERE started_at >= ?",
            (month_start.timestamp(),)
        ).fetchone()[0] or 0
        
        # Success rate (non-error sessions)
        total_ended = db.execute(
            "SELECT COUNT(*) FROM sessions WHERE end_reason IS NOT NULL"
        ).fetchone()[0]
        error_sessions = db.execute(
            "SELECT COUNT(*) FROM sessions WHERE end_reason = 'error'"
        ).fetchone()[0]
        success_rate = round(((total_ended - error_sessions) / total_ended * 100), 1) if total_ended > 0 else 100

    return MetricsSnapshot(
        active_sessions=active,
        active_agents=3,
        total_messages=total_messages,
        total_sessions=total_sessions,
        messages_per_minute=msg_per_min,
        spend_month=round(spend_month, 2),
        budget_pct=round((spend_month / 20) * 100, 1),
        success_rate=success_rate,
        timestamp=datetime.now(timezone.utc).isoformat(),
    ).model_dump()


@app.get("/api/dashboard/graph")
async def get_dashboard_graph():
    """Agent node graph data."""
    nodes = [
        AgentNode(id="hermes-orchestrator", name="Hermes (Orchestrator)", type="orchestrator",
                  status="active", model="deepseek-v4-pro", tasks_completed=71, tokens_used=0),
        AgentNode(id="nemoclaw-ecommerce", name="NemoCLaw (Ecommerce)", type="mission",
                  status="idle", mission="ecommerce", model="nemotron-3"),
        AgentNode(id="nemoclaw-berea", name="NemoCLaw (BEREA)", type="mission",
                  status="idle", mission="berea", model="nemotron-3"),
        AgentNode(id="nemoclaw-leanta", name="NemoCLaw (Leanta)", type="mission",
                  status="idle", mission="leanta", model="nemotron-3"),
        AgentNode(id="data-pipeline", name="Data Pipeline", type="pipeline",
                  status="active", tasks_completed=3, tokens_used=0),
        AgentNode(id="monitor", name="System Monitor", type="monitor",
                  status="active", tasks_completed=1, tokens_used=0),
    ]
    edges = [
        GraphEdge(source="hermes-orchestrator", target="nemoclaw-berea", type="delegates", label="Berea outreach"),
        GraphEdge(source="hermes-orchestrator", target="nemoclaw-ecommerce", type="delegates", label="SKU validation"),
        GraphEdge(source="hermes-orchestrator", target="nemoclaw-leanta", type="delegates", label="Proposal drafts"),
        GraphEdge(source="hermes-orchestrator", target="data-pipeline", type="syncs", label="Session data"),
        GraphEdge(source="nemoclaw-berea", target="data-pipeline", type="reports", label="Lead data"),
        GraphEdge(source="data-pipeline", target="monitor", type="reports", label="Metrics"),
        GraphEdge(source="monitor", target="hermes-orchestrator", type="reports", label="Health checks"),
    ]
    return {"nodes": [n.model_dump() for n in nodes], "edges": [e.model_dump() for e in edges]}


@app.get("/api/dashboard/events")
async def get_dashboard_events(limit: int = Query(20, ge=1, le=100)):
    """Recent event log for the dashboard."""
    with get_db() as db:
        # Get recent sessions as events
        rows = db.execute("""
            SELECT id, source, model, started_at, end_reason, message_count
            FROM sessions ORDER BY started_at DESC LIMIT ?
        """, (limit,)).fetchall()
    
    events = []
    for r in rows:
        ts = datetime.fromtimestamp(r["started_at"], tz=timezone.utc)
        event_type = "info" if r["end_reason"] in (None, "completed", "cron_complete") else \
                     "error" if r["end_reason"] == "error" else "info"
        events.append(DashboardEvent(
            id=f"evt-{r['id'][:12]}",
            type=event_type,
            source=r["source"] or "unknown",
            text=f"Session: {r['model'] or 'unknown'} — {r['message_count']} msgs" + 
                 (f" ({r['end_reason']})" if r['end_reason'] else ""),
            timestamp=ts.isoformat(),
        ).model_dump())
    
    # Add synthetic dashboard events
    events.insert(0, DashboardEvent(
        id="evt-deploy-001", type="deploy", source="hermes",
        text="Dashboard v0.2 deployed to Vercel with live data channels",
        timestamp=datetime.now(timezone.utc).isoformat(),
    ).model_dump())
    
    return {"events": events[:limit], "total": len(events)}


@app.get("/api/dashboard/stream")
async def dashboard_stream():
    """Server-Sent Events stream for live dashboard data."""
    async def event_generator():
        while True:
            try:
                metrics = await get_dashboard_metrics()
                graph = await get_dashboard_graph()
                events_resp = await get_dashboard_events(limit=5)
                
                yield f"event: metrics\ndata: {json.dumps(metrics)}\n\n"
                yield f"event: node-graph\ndata: {json.dumps(graph)}\n\n"
                yield f"event: event-log\ndata: {json.dumps(events_resp['events'])}\n\n"
                yield f": heartbeat {datetime.now(timezone.utc).isoformat()}\n\n"
                
                await asyncio.sleep(2)
            except Exception as e:
                yield f"event: error\ndata: {{\"detail\": \"{str(e)}\"}}\n\n"
                await asyncio.sleep(5)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )


@app.get("/api/dashboard")
async def dashboard_overview():
    """Aggregate dashboard data in one call."""
    metrics = await get_dashboard_metrics()
    graph = await get_dashboard_graph()
    events_resp = await get_dashboard_events(limit=10)
    missions_resp = await get_missions(Request(scope={"type": "http"}))
    return {
        "metrics": metrics,
        "graph": graph,
        "events": events_resp["events"],
        "missions": missions_resp["missions"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── WebSocket Terminal ──────────────────────────────────────

@app.websocket("/ws")
async def websocket_terminal(websocket: WebSocket):
    """Terminal relay — Hermes CLI over WebSocket."""
    await websocket.accept()
    await websocket.send_text("HERMES OS Terminal v0.2\r\nType 'help' for commands.\r\n\r\nhermes> ")
    
    try:
        while True:
            data = await websocket.receive_text()
            cmd = data.strip()
            
            if cmd.lower() in ("exit", "quit"):
                await websocket.send_text("\r\nDisconnecting...\r\n")
                await websocket.close()
                break
            elif cmd.lower() == "help":
                await websocket.send_text(
                    "\r\nCOMMANDS:\r\n"
                    "  status   — Show mission status\r\n"
                    "  metrics  — Show live metrics\r\n"
                    "  missions — List all missions\r\n"
                    "  agents   — List active agents\r\n"
                    "  graph    — Agent node graph\r\n"
                    "  events   — Recent event log\r\n"
                    "  health   — API health check\r\n"
                    "  help     — This menu\r\n"
                    "  clear    — Clear terminal\r\n"
                    "  exit     — Disconnect\r\n"
                    "\r\nhermes> "
                )
            elif cmd.lower() == "status":
                with get_db() as db:
                    sessions = db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
                    msgs = db.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
                await websocket.send_text(
                    f"\r\nHERMES OS STATUS\r\n"
                    f"  Sessions: {sessions}\r\n"
                    f"  Messages: {msgs}\r\n"
                    f"  Missions: 3 (Ecommerce, BEREA, Leanta AI)\r\n"
                    f"  Dashboard: https://hermes-dashboard.vercel.app\r\n"
                    f"  API: https://hermes.46-225-84-249.sslip.io\r\n"
                    f"\r\nhermes> "
                )
            elif cmd.lower() == "metrics":
                metrics = await get_dashboard_metrics()
                await websocket.send_text(
                    f"\r\nLIVE METRICS\r\n"
                    f"  Active sessions: {metrics['active_sessions']}\r\n"
                    f"  Total messages: {metrics['total_messages']}\r\n"
                    f"  Messages/min: {metrics['messages_per_minute']}\r\n"
                    f"  Success rate: {metrics['success_rate']}%\r\n"
                    f"  Spend (month): €{metrics['spend_month']}\r\n"
                    f"\r\nhermes> "
                )
            elif cmd.lower() == "clear":
                await websocket.send_text("\x1b[2J\x1b[Hhermes> ")
            elif cmd.lower() == "missions":
                missions = await get_missions(Request(scope={"type": "http"}))
                await websocket.send_text("\r\nMISSIONS:\r\n")
                for m in missions["missions"]:
                    await websocket.send_text(
                        f"  {m['icon']} {m['name']} [{m['status'].upper()}]"
                    )
                    if m.get("alert"):
                        await websocket.send_text(f"\r\n    {m['alert']['level'].upper()}: {m['alert']['text']}")
                    await websocket.send_text("\r\n")
                await websocket.send_text("hermes> ")
            elif cmd.lower() == "agents":
                graph = await get_dashboard_graph()
                await websocket.send_text("\r\nAGENTS:\r\n")
                for n in graph["nodes"]:
                    await websocket.send_text(
                        f"  {n['name']:30} [{n['status'].upper():6}] {n.get('model','')}\r\n"
                    )
                await websocket.send_text("hermes> ")
            elif cmd.lower() == "graph":
                await websocket.send_text(
                    "\r\nAgent Graph: GET /api/dashboard/graph\r\nhermes> "
                )
            elif cmd.lower() == "events":
                events_resp = await get_dashboard_events(limit=5)
                await websocket.send_text("\r\nRECENT EVENTS:\r\n")
                for e in events_resp["events"]:
                    await websocket.send_text(
                        f"  [{e['type'].upper():6}] {e['source']:10} {e['text'][:60]}\r\n"
                    )
                await websocket.send_text("hermes> ")
            elif cmd.lower() == "health":
                health_data = await health()
                await websocket.send_text(
                    f"\r\nHEALTH: {health_data['status']} | DB: {health_data['db']}\r\nhermes> "
                )
            else:
                await websocket.send_text(
                    f"\r\nUnknown command: {cmd}\r\nType 'help' for available commands.\r\n\r\nhermes> "
                )
    except WebSocketDisconnect:
        pass


# ── Helpers ─────────────────────────────────────────────────

def _get_session_count() -> int:
    try:
        with get_db() as db:
            return db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
    except Exception:
        return 0


def _derive_title(session_id: str) -> str:
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
    print(f"Hermes OS API v0.2 starting on port {PORT}")
    print(f"DB: {DB_PATH}")
    print(f"Docs: http://0.0.0.0:{PORT}/docs")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
