# Plan: Deploy Hermes Dashboard to Hetzner VPS

**Goal:** Deploy Next.js dashboard with live data channels + built-in terminal at 46.225.84.249

**Context:**
- VPS: 46.225.84.249 (bereavps — we are on it)
- Hermes API live on port 8420, reverse-proxied via Caddy at hermes.46-225-84-249.sslip.io
- Dashboard repo: github.com/TicodeB/hermes-dashboard (Next.js 15, framer-motion, lucide-react)
- Existing components: FlowField.tsx (canvas), CountUp.tsx (spring counter)
- Caddy admin API accessible at localhost:2019

## Architecture

```
Browser → https://hermes.46-225-84-249.sslip.io/
├── /api/*        → Caddy → 127.0.0.1:8420 (Hermes API) [existing]
├── /ws           → Caddy → 127.0.0.1:8420/ws (WebSocket) [new]
├── /             → Caddy → 127.0.0.1:3000 (Next.js) [new]
└── SSE           → GET /api/dashboard/stream (add to Hermes API)
```

## Step-by-step

### Phase 1: API — Live Data Channels
1. Add SSE endpoint `GET /api/dashboard/stream` to Hermes API (api/main.py)
   - 4 event types: metrics, node-graph, event-log, heartbeat
   - 15s keepalive, 500-event ring buffer
2. Add WebSocket endpoint `/ws` for terminal relay
   - Relay terminal commands → Hermes agent → response back
3. Add REST endpoints: `GET /api/dashboard/graph`, `GET /api/dashboard/metrics`, `GET /api/dashboard/events`
4. Restart Hermes API

### Phase 2: Frontend — Dashboard Pages
5. Build `/src/app/page.tsx` — Main mission control view
   - Live metrics (CountUp → API SSE)
   - Mission cards (3 missions)
   - Event log feed
   - FlowField background
6. Build `/src/app/components/Terminal.tsx` — xterm.js terminal
   - WebSocket connection to /ws
   - Command input → Hermes agent
   - Sub-agent panel showing active agents
7. Build `/src/app/components/AgentGraph.tsx` — Node graph
   - D3.js force simulation
   - Staggered entrance animations
8. Build `/src/app/components/MissionCard.tsx` — Per-mission cards

### Phase 3: Deploy
9. Install dependencies: `npm install xterm @xterm/addon-fit @xterm/addon-web-links d3 socket.io-client`
10. Build Next.js: `npm run build`
11. Start Next.js on port 3000: `npm run start &`
12. Update Caddy to route `/` → 127.0.0.1:3000
13. Update Caddy to route `/ws` → 127.0.0.1:8420 with WebSocket support
14. Verify: curl https://hermes.46-225-84-249.sslip.io/ → Next.js page
15. Verify: WebSocket connection to wss://hermes.46-225-84-249.sslip.io/ws

## Files Changed

| File | Action |
|------|--------|
| api/main.py | Add SSE, WebSocket, REST endpoints |
| src/app/page.tsx | NEW — Main dashboard |
| src/app/components/Terminal.tsx | NEW — xterm.js terminal |
| src/app/components/AgentGraph.tsx | NEW — D3 node graph |
| src/app/components/MissionCard.tsx | NEW — Mission cards |
| src/app/components/LiveEventFeed.tsx | NEW — Event log |
| package.json | Add xterm, d3, socket.io-client deps |
| Caddy config | Add routes for / → :3000, /ws → :8420 |

## Verification
- `curl https://hermes.46-225-84-249.sslip.io/` returns HTML (Next.js)
- `curl https://hermes.46-225-84-249.sslip.io/api/health` returns JSON
- Browser: dashboard loads, FlowField animates, metrics count up
- Terminal: type `status` → Hermes responds
- SSE stream: `curl -N https://hermes.46-225-84-249.sslip.io/api/dashboard/stream`

## Risks
- Node.js version compatibility (check node -v)
- Port 3000 Caddy routing conflict
- xterm.js WebSocket requires Caddy WebSocket support
- Build may fail if dependencies missing on VPS

**Cost:** €0
**Downtime:** ~30s API restart
