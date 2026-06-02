# Hermes OS Dashboard — Backend Architecture

## Overview

The dashboard backend extends the existing FastAPI server (`/opt/hermes-api/main.py`, port 8420) with real-time capabilities for the dark-theme Obsidian-style dashboard. The frontend (Next.js + D3.js) connects via REST for initial data and Server-Sent Events (SSE) for live updates.

---

## 1. Transport: WebSocket / SSE Protocol

### Chosen: Server-Sent Events (SSE)

Why SSE over WebSocket:
- Simpler — no handshake protocol, no reconnection logic needed (EventSource API built-in)
- Works through Caddy reverse proxy without special config (SSE is just HTTP streaming)
- Unidirectional (server → client) matches our use case perfectly
- Native `EventSource` in browsers, easy polyfill for Next.js

### SSE Endpoint

```
GET /api/dashboard/stream
Auth: Bearer token (query param or header)
```

**Stream format** (newline-delimited SSE):

```
event: metrics
data: {"throughput": 12.5, "latency_p50": 342, "latency_p99": 2100, "active_agents": 3, "active_sessions": 7, "total_tokens_hour": 45200, "spend_month": 4.32}

event: node-graph
data: {"nodes": [...], "edges": [...], "timestamp": "2026-06-02T17:34:00Z"}

event: event-log
data: {"id": "evt_001", "type": "agent_start", "agent": "subagent-01", "session": "20260602_173400_abc123", "message": "Agent subagent-01 started", "timestamp": "2026-06-02T17:34:00Z"}

event: heartbeat
data: {"ts": "2026-06-02T17:34:30Z"}
```

**Reconnection**: Client sends `Last-Event-ID` header; server replays missed events from an in-memory ring buffer (last 500 events, 5min TTL).

**Keepalive**: Server sends `event: heartbeat` every 15 seconds. Caddy reverse proxy timeout is set to 90s to prevent connection drops.

---

## 2. API Endpoints

### Existing Endpoints (unchanged)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Service info |
| GET | `/api/health` | Health check with DB ping |
| GET | `/api/status` | Channel connectivity |
| GET | `/api/missions` | Mission cards |
| GET | `/api/sessions` | Recent sessions list |
| GET | `/api/sessions/{id}` | Session detail |
| GET | `/api/memory` | Honcho memory snapshot |
| GET | `/api/approvals` | Pending approvals |
| GET | `/api/spend` | API spend summary |

### New Dashboard Endpoints

#### 2.1 Node Graph (REST snapshot)

```
GET /api/dashboard/graph
Auth: Bearer token
Response:
{
  "nodes": [
    {
      "id": "agent-main",
      "label": "Hermes Main",
      "type": "primary",           // "primary" | "subagent" | "mcp" | "gateway"
      "status": "active",          // "active" | "idle" | "offline" | "error"
      "group": 1,                  // D3 force-group ID for clustering
      "metrics": {
        "throughput_rpm": 4.2,
        "avg_latency_ms": 350,
        "error_rate": 0.01,
        "tokens_used_h": 12800
      },
      "details": {
        "model": "deepseek/deepseek-v4-flash",
        "platform": "telegram",
        "session_id": "20260602_173400_abc123",
        "uptime_s": 3600
      }
    }
  ],
  "edges": [
    {
      "source": "agent-main",
      "target": "subagent-01",
      "label": "delegated",
      "type": "delegation",        // "delegation" | "mcp_call" | "gateway_route" | "event"
      "weight": 1,                 // thickness for D3
      "active": true,
      "last_active": "2026-06-02T17:34:00Z"
    }
  ],
  "summary": {
    "total_nodes": 5,
    "active_nodes": 3,
    "total_edges": 4,
    "updated_at": "2026-06-02T17:34:00Z"
  }
}
```

#### 2.2 Metrics Snapshot

```
GET /api/dashboard/metrics
Auth: Bearer token
Response:
{
  "throughput": {
    "rpm": 12.5,
    "rph": 750,
    "peak_rpm": 24.1
  },
  "latency": {
    "p50_ms": 342,
    "p90_ms": 1200,
    "p99_ms": 2100,
    "avg_ms": 580
  },
  "counters": {
    "active_agents": 3,
    "active_sessions": 7,
    "total_sessions_today": 23,
    "total_sessions_month": 187,
    "total_tokens_month": 14500000,
    "total_tokens_hour": 45200
  },
  "spend": {
    "session_current": 0.0042,
    "month_total": 4.32,
    "month_budget": 20.0,
    "month_budget_pct": 21.6
  },
  "errors": {
    "total_hour": 2,
    "total_today": 14,
    "error_rate": 0.008
  },
  "timestamp": "2026-06-02T17:34:00Z"
}
```

#### 2.4 Event Log

```
GET /api/dashboard/events?limit=50&since=<iso-timestamp>&types=agent_start,agent_end,error
Auth: Bearer token
Response:
{
  "events": [
    {
      "id": "evt_001",
      "type": "agent_start",
      "agent_id": "subagent-01",
      "session_id": "20260602_173400_abc123",
      "message": "Agent subagent-01 started for SKU-001 RFQ",
      "level": "info",              // "info" | "warn" | "error" | "debug"
      "metadata": {
        "model": "claude-sonnet-4-20250514",
        "tokens": 0,
        "cost": 0.0,
        "duration_ms": 0
      },
      "timestamp": "2026-06-02T17:34:00Z"
    }
  ],
  "total": 1,
  "has_more": false
}
```

Event types: `agent_start`, `agent_end`, `agent_error`, `tool_call`, `tool_result`, `delegation`, `approval_request`, `approval_result`, `memory_saved`, `session_start`, `session_end`, `mcp_request`, `mcp_response`, `error`, `warning`, `system`

#### 2.5 Dashboard Summary (single call for initial page load)

```
GET /api/dashboard
Auth: Bearer token
Response: Merged response of /graph + /metrics + /events?limit=20
```

---

## 3. Data Models

### Agent Node

```python
class AgentNode(BaseModel):
    id: str                                    # unique agent/subagent ID
    label: str                                 # display name
    type: Literal["primary", "subagent", "mcp", "gateway", "tool"]
    status: Literal["active", "idle", "offline", "error", "spawning"]
    group: int                                 # D3 cluster group
    metrics: NodeMetrics
    details: NodeDetails

class NodeMetrics(BaseModel):
    throughput_rpm: float = 0.0
    avg_latency_ms: float = 0.0
    error_rate: float = 0.0
    tokens_used_h: int = 0

class NodeDetails(BaseModel):
    model: Optional[str] = None
    platform: Optional[str] = None
    session_id: Optional[str] = None
    uptime_s: int = 0
    parent_id: Optional[str] = None            # for subagents: who spawned them
    toolset: Optional[str] = None              # active toolset name
```

### Edge (Relationship)

```python
class GraphEdge(BaseModel):
    source: str                                # source node ID
    target: str                                # target node ID
    label: str                                 # relationship label
    type: Literal["delegation", "mcp_call", "gateway_route", "event", "tool_call"]
    weight: int = 1                            # D3 link thickness
    active: bool = True
    last_active: str                           # ISO timestamp
```

### Event Log Entry

```python
class DashboardEvent(BaseModel):
    id: str                                    # event ID (monotonic or ULID)
    type: str                                  # event type constant
    agent_id: Optional[str] = None
    session_id: Optional[str] = None
    message: str                               # human-readable description
    level: Literal["info", "warn", "error", "debug"] = "info"
    metadata: dict = {}                        # type-specific payload
    timestamp: str                             # ISO 8601
```

### Metrics Snapshot

```python
class MetricsSnapshot(BaseModel):
    throughput: ThroughputMetrics
    latency: LatencyMetrics
    counters: CounterMetrics
    spend: SpendMetrics
    errors: ErrorMetrics
    timestamp: str

class ThroughputMetrics(BaseModel):
    rpm: float
    rph: float
    peak_rpm: float

class LatencyMetrics(BaseModel):
    p50_ms: float
    p90_ms: float
    p99_ms: float
    avg_ms: float

class CounterMetrics(BaseModel):
    active_agents: int
    active_sessions: int
    total_sessions_today: int
    total_sessions_month: int
    total_tokens_month: int
    total_tokens_hour: int

class SpendMetrics(BaseModel):
    session_current: float
    month_total: float
    month_budget: float
    month_budget_pct: float

class ErrorMetrics(BaseModel):
    total_hour: int
    total_today: int
    error_rate: float
```

---

## 4. Metrics Pipeline

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Loop / Gateway                   │
│  (emits events via Python logging + asyncio.Queue)       │
└─────────────┬───────────────────────────────────────────┘
              │  calls record_event(event)
              ▼
┌──────────────────────────────┐
│    Metrics Collector          │
│    (in-process singleton)     │
│                              │
│  - asyncio.Queue[Event]      │
│  - sliding window counters   │
│  - ring buffer (500 events)  │
│  - node graph state          │
│  - period: 1s tick           │
└──────┬───────────┬───────────┘
       │           │
       ▼           ▼
┌─────────────┐  ┌──────────────────┐
│ SSE Stream   │  │  REST Endpoints   │
│ (pushes to   │  │  /api/dashboard/* │
│  connected   │  │  (pulls from      │
│  clients)    │  │   collector)      │
└─────────────┘  └──────────────────┘
```

### Collector Implementation (Python)

```python
class DashboardMetricsCollector:
    """Singleton that collects, aggregates, and serves dashboard data."""

    def __init__(self):
        self._event_queue: asyncio.Queue[DashboardEvent] = asyncio.Queue()
        self._ring_buffer: deque[DashboardEvent] = deque(maxlen=500)
        self._sse_clients: list[asyncio.Queue] = []
        self._nodes: dict[str, AgentNode] = {}
        self._edges: list[GraphEdge] = []

        # Sliding window counters
        self._window_1m = deque()    # tuples of (timestamp, tokens, latency)
        self._window_1h = deque()

        # Periodics
        self._heartbeat_interval = 15  # seconds
        self._metrics_push_interval = 2  # seconds

    async def record_event(self, event: DashboardEvent) -> None:
        """Called by agent loop / gateway to record an event."""
        await self._event_queue.put(event)
        self._ring_buffer.append(event)
        self._update_window_counters(event)
        self._update_node_graph(event)

    async def _process_queue(self) -> None:
        """Background task: drain queue, broadcast to SSE clients."""
        while True:
            event = await self._event_queue.get()
            for client in self._sse_clients:
                await client.put(event)

    def get_live_metrics(self) -> MetricsSnapshot:
        """Compute current metrics from sliding windows."""
        now = time.time()
        # Prune windows
        while self._window_1m and now - self._window_1m[0][0] > 60:
            self._window_1m.popleft()
        while self._window_1h and now - self._window_1h[0][0] > 3600:
            self._window_1h.popleft()

        # Compute latency percentiles
        latencies_1h = [e[2] for e in self._window_1h if e[2] > 0]
        latencies_sorted = sorted(latencies_1h)

        return MetricsSnapshot(
            throughput=ThroughputMetrics(
                rpm=len(self._window_1m) / 60.0,
                rph=len(self._window_1h) / 3600.0,
                peak_rpm=self._compute_peak_rpm(),
            ),
            ...
        )
```

### Data Sources

| Metric | Source | Update Frequency |
|--------|--------|-----------------|
| Node graph | Agent loop events (agent_start/end, delegation) | Real-time via event |
| Latency | Tool call duration (start→end) | Per tool call |
| Throughput | Session message count / minute | Sliding window 1m |
| Active agents | Agent start/end event counters | Real-time |
| Token usage | Usage tracking from agent loop | Per response |
| Spend | Session cost from state.db | Per session end |
| Error rate | agent_error + tool_error events | Sliding window 1h |

### In-Memory State Snapshot (Per Query)

The collector maintains a live `DashboardSnapshot` that is updated atomically every 2 seconds:

```python
class DashboardSnapshot(BaseModel):
    graph: GraphState
    metrics: MetricsSnapshot
    recent_events: list[DashboardEvent]  # last 20
    timestamp: str
```

This snapshot is served by `GET /api/dashboard` and pushed via SSE as `event: full-update` every 2 seconds. Individual events are pushed immediately as `event: event-log`.

---

## 5. Caddy Reverse Proxy Config

Add to the existing Caddyfile for the dashboard path:

```
hermes.46-225-84-249.sslip.io {
    @dashboard path /api/dashboard/*
    handle @dashboard {
        reverse_proxy localhost:8420 {
            # SSE requires no buffering
            flush_interval 0
            # Increase header timeout for long-lived streams
            transport http {
                read_timeout 90s
                write_timeout 90s
            }
        }
    }

    # Existing API routes
    reverse_proxy localhost:8420
}
```

---

## 6. Implementation Plan

1. **Add models** — define Pydantic models in a new file `/opt/hermes-api/dashboard_models.py`
2. **Add collector** — implement `DashboardMetricsCollector` singleton in `/opt/hermes-api/metrics_collector.py`
3. **Add SSE endpoint** — `GET /api/dashboard/stream` in `/opt/hermes-api/main.py`
4. **Add REST endpoints** — graph, metrics, events, dashboard summary
5. **Instrument agent loop** — emit events from agent start/end, tool calls, delegations
6. **Wire Caddy** — add `flush_interval 0` for SSE routes
7. **Test** — SSE stream with curl, REST endpoint responses, event log pagination

---

## 7. Notes

- The SSE stream uses `text/event-stream` content type
- Heartbeat interval: 15s (keepalive)
- Ring buffer: 500 events max, 5min TTL
- Node graph prune: remove nodes with no events for 30min
- All dashboard endpoints behind Bearer auth (same as existing API)
- CORS already configured on FastAPI app (allows frontend origin)