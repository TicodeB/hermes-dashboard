'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

// Register xterm.js CSS
const XTERM_CSS = `
  .xterm { height: 100%; padding: 4px; }
  .xterm-viewport { scrollbar-width: thin; scrollbar-color: #2a2a4a transparent; }
  .xterm-viewport::-webkit-scrollbar { width: 6px; }
  .xterm-viewport::-webkit-scrollbar-track { background: transparent; }
  .xterm-viewport::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 3px; }
`;

export default function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputBufferRef = useRef('');
  const [connected, setConnected] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Inject xterm CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = XTERM_CSS;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  useEffect(() => {
    const el = terminalRef.current;
    if (!el) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace",
      theme: {
        background: '#0a0a14',
        foreground: '#e5e7eb',
        cursor: '#818cf8',
        cursorAccent: '#0a0a14',
        selectionBackground: 'rgba(129,140,248,0.25)',
        black: '#1a1a2e',
        red: '#ef4444',
        green: '#4ade80',
        yellow: '#f59e0b',
        blue: '#38bdf8',
        magenta: '#a855f7',
        cyan: '#22d3ee',
        white: '#e5e7eb',
        brightBlack: '#6b7280',
        brightRed: '#f87171',
        brightGreen: '#86efac',
        brightYellow: '#fbbf24',
        brightBlue: '#7dd3fc',
        brightMagenta: '#c084fc',
        brightCyan: '#67e8f9',
        brightWhite: '#f3f4f6',
      },
      allowTransparency: false,
      cols: 80,
      rows: 20,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(el);
    fitAddon.fit();

    // Welcome message
    term.writeln('\x1b[38;5;141m  ╔══════════════════════════════════════╗');
    term.writeln('  ║  \x1b[1;38;5;141mHERMES Agent Terminal\x1b[0;38;5;141m              ║');
    term.writeln('  ║  \x1b[38;5;141mType \x1b[1;38;5;141mhelp\x1b[0;38;5;141m for available commands   ║');
    term.writeln('  ╚══════════════════════════════════════╝\x1b[0m');
    term.writeln('');

    // Show prompt
    term.write('\r\n\x1b[38;5;141mhermes>\x1b[0m ');

    // Keyboard input handling
    term.onKey(({ key, domEvent }) => {
      const code = domEvent.keyCode;

      if (code === 13) { // Enter
        const cmd = inputBufferRef.current.trim();
        term.write('\r\n');

        if (cmd) {
          // Echo command
          term.writeln(`\x1b[90m$ ${cmd}\x1b[0m`);

          if (cmd === 'help') {
            term.writeln('\x1b[38;5;141m  Available commands:\x1b[0m');
            term.writeln('  \x1b[38;5;141mhelp\x1b[0m       - Show this help');
            term.writeln('  \x1b[38;5;141mclear\x1b[0m      - Clear terminal');
            term.writeln('  \x1b[38;5;141mstatus\x1b[0m     - Show agent status');
            term.writeln('  \x1b[38;5;141magents\x1b[0m     - List all agents');
            term.writeln('  \x1b[38;5;141mswitch\x1b[0m     - Switch model for an agent');
            term.writeln('  \x1b[38;5;141mkill\x1b[0m       - Kill an agent');
            term.writeln('  \x1b[38;5;141mrestart\x1b[0m    - Restart an agent');
            term.writeln('  \x1b[38;5;141mdeploy\x1b[0m     - Deploy a new version');
            term.writeln('  \x1b[38;5;141msend\x1b[0m       - Send a task to an agent');
            term.writeln('  All other commands are relayed to the Hermes agent via WebSocket.\x1b[0m');
          } else if (cmd === 'clear') {
            term.clear();
          } else if (cmd === 'status') {
            term.writeln('\x1b[38;5;141m  Agent Status:\x1b[0m');
            term.writeln('  \x1b[38;5;46m  ● Ecommerce Agent\x1b[0m  \x1b[90mactive - 12 tasks completed\x1b[0m');
            term.writeln('  \x1b[38;5;44m  ● BEREA Agent\x1b[0m     \x1b[90midle - awaiting instructions\x1b[0m');
            term.writeln('  \x1b[38;5;46m  ● Leanta AI Agent\x1b[0m  \x1b[90mactive - processing leads\x1b[0m');
            term.writeln('  \x1b[38;5;41m  ● Orchestrator\x1b[0m    \x1b[90mhealthy - 3 agents managed\x1b[0m');
          } else if (cmd === 'agents') {
            term.writeln('\x1b[38;5;141m  Registered Agents:\x1b[0m');
            term.writeln('  \x1b[38;5;46m  ecommerce-01\x1b[0m    \x1b[90mEcommerce Agent\x1b[0m');
            term.writeln('  \x1b[38;5;44m  berea-01\x1b[0m        \x1b[90mBEREA Agent\x1b[0m');
            term.writeln('  \x1b[38;5;46m  leanta-01\x1b[0m       \x1b[90mLeanta AI Agent\x1b[0m');
            term.writeln('  \x1b[38;5;44m  orchestrator-01\x1b[0m \x1b[90mOrchestrator Agent\x1b[0m');
          } else if (cmd.startsWith('switch ')) {
            term.writeln(`\x1b[38;5;141m  Model switch initiated: ${cmd.slice(7)}\x1b[0m`);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
            }
          } else if (cmd.startsWith('kill ')) {
            term.writeln(`\x1b[38;5;196m  Kill signal sent to agent: ${cmd.slice(5)}\x1b[0m`);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
            }
          } else if (cmd.startsWith('restart ')) {
            term.writeln(`\x1b[38;5;141m  Restart signal sent to agent: ${cmd.slice(8)}\x1b[0m`);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
            }
          } else if (cmd.startsWith('deploy ')) {
            term.writeln(`\x1b[38;5;141m  Deploying: ${cmd.slice(7)}\x1b[0m`);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
            }
          } else if (cmd.startsWith('send ')) {
            term.writeln('\x1b[38;5;141m  Sending task to agent...\x1b[0m');
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
            }
          } else {
            // Relay to Hermes via WebSocket
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
              term.writeln('\x1b[90m  Command relayed to Hermes agent...\x1b[0m');
            } else {
              term.writeln('\x1b[38;5;196m  Not connected to Hermes. Type \x1b[1mhelp\x1b[0m\x1b[38;5;196m for local commands.\x1b[0m');
            }
          }
        }

        inputBufferRef.current = '';
        term.write('\r\n\x1b[38;5;141mhermes>\x1b[0m ');
      } else if (code === 127 || code === 8) { // Backspace
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
      } else if (code === 9) { // Tab completion
        const partial = inputBufferRef.current;
        const cmds = ['help', 'clear', 'status', 'agents', 'switch', 'kill', 'restart', 'deploy', 'send'];
        const match = cmds.find(c => c.startsWith(partial));
        if (match && match !== partial) {
          const diff = match.slice(partial.length);
          inputBufferRef.current = match;
          term.write(diff);
        }
      } else {
        if (!domEvent.ctrlKey && !domEvent.altKey && key.length === 1) {
          inputBufferRef.current += key;
          term.write(key);
        }
      }
    });

    xtermRef.current = term;

    // Resize handler
    const handleResize = () => {
      try { fitAddon.fit(); } catch {}
    };
    window.addEventListener('resize', handleResize);

    // Connect WebSocket
    const connectWs = () => {
      const ws = new WebSocket('wss://hermes.46-225-84-249.sslip.io/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        term.writeln('\x1b[38;5;46m  ✓ Connected to Hermes agent\x1b[0m');
        term.write('\x1b[38;5;141mhermes>\x1b[0m ');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.output) {
            term.writeln(`\x1b[90m  ${data.output}\x1b[0m`);
          }
          if (data.error) {
            term.writeln(`\x1b[38;5;196m  Error: ${data.error}\x1b[0m`);
          }
        } catch {
          term.writeln(`\x1b[90m  ${event.data}\x1b[0m`);
        }
        term.write('\x1b[38;5;141mhermes>\x1b[0m ');
      };

      ws.onerror = () => {
        term.writeln('\x1b[38;5;196m  ⚠ WebSocket connection error\x1b[0m');
      };

      ws.onclose = () => {
        setConnected(false);
        term.writeln('\x1b[38;5;196m  ✗ Disconnected from Hermes\x1b[0m');
        term.write('\x1b[38;5;141mhermes>\x1b[0m ');
        // Reconnect after 5s
        setTimeout(connectWs, 5000);
      };
    };

    connectWs();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) {
        wsRef.current.close();
      }
      term.dispose();
    };
  }, []);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: '#0a0a14',
        borderColor: 'rgba(42,42,74,0.6)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid rgba(42,42,74,0.4)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: connected ? '#4ade80' : '#ef4444', boxShadow: connected ? '0 0 6px rgba(74,222,128,0.5)' : 'none' }}
          />
          <span className="text-sm font-semibold text-white">Terminal</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(107,114,128,0.15)', color: '#6b7280' }}>
            hermes:{connected ? 'connected' : 'disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8' }}
          >
            Control Plane
          </span>
          <button onClick={() => setCollapsed(!collapsed)} className="text-hermes-muted hover:text-white cursor-pointer">
            {collapsed ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div ref={terminalRef} style={{ height: '320px', padding: '2px' }} />
      )}
    </div>
  );
}