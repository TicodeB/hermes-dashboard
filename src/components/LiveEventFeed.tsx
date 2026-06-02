'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Info, AlertTriangle, XCircle, ArrowUpDown } from 'lucide-react';

type EventType = 'info' | 'warn' | 'error' | 'deploy';

interface Event {
  id: string;
  type: EventType;
  message: string;
  timestamp: Date;
  source?: string;
}

const eventConfig: Record<EventType, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  info: {
    color: '#38bdf8',
    bgColor: 'rgba(56,189,248,0.08)',
    icon: <Info size={14} />,
    label: 'Info',
  },
  warn: {
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.08)',
    icon: <AlertTriangle size={14} />,
    label: 'Warning',
  },
  error: {
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.08)',
    icon: <XCircle size={14} />,
    label: 'Error',
  },
  deploy: {
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.08)',
    icon: <ArrowUpDown size={14} />,
    label: 'Deploy',
  },
};

const sampleEvents: Event[] = [
  { id: '1', type: 'info', message: 'Ecommerce agent pipeline initialized', timestamp: new Date(), source: 'ecommerce' },
  { id: '2', type: 'deploy', message: 'BEREA v2.1 deployed to production', timestamp: new Date(Date.now() - 5000), source: 'berea' },
  { id: '3', type: 'warn', message: 'Leanta AI token usage approaching limit (87%)', timestamp: new Date(Date.now() - 12000), source: 'leanta' },
  { id: '4', type: 'error', message: 'Stripe webhook timeout — retrying in 30s', timestamp: new Date(Date.now() - 25000), source: 'ecommerce' },
  { id: '5', type: 'info', message: 'Agent synchronization completed', timestamp: new Date(Date.now() - 40000), source: 'system' },
  { id: '6', type: 'deploy', message: 'Hotfix applied to payment processor', timestamp: new Date(Date.now() - 55000), source: 'ecommerce' },
  { id: '7', type: 'warn', message: 'Redis memory usage at 72%', timestamp: new Date(Date.now() - 70000), source: 'system' },
  { id: '8', type: 'info', message: 'BEREA lead enrichment cycle started', timestamp: new Date(Date.now() - 90000), source: 'berea' },
];

export default function LiveEventFeed() {
  const [events, setEvents] = useState<Event[]>(sampleEvents);
  const [autoScroll, setAutoScroll] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top (newest first)
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events, autoScroll]);

  // Simulate new events
  useEffect(() => {
    const interval = setInterval(() => {
      const types: EventType[] = ['info', 'info', 'warn', 'deploy', 'error'];
      const type = types[Math.floor(Math.random() * types.length)];
      const sources = ['ecommerce', 'berea', 'leanta', 'system'];
      const messages: Record<EventType, string[]> = {
        info: ['Heartbeat OK', 'Cache refreshed', 'Agent poll completed', 'Metrics collected'],
        warn: ['Latency spike detected', 'Rate limit approaching', 'Memory pressure'],
        error: ['Connection refused', 'Query timeout', 'Auth token expired'],
        deploy: ['Container deployed', 'Config updated', 'Model loaded'],
      };
      const msgs = messages[type];
      const newEvent: Event = {
        id: Date.now().toString(),
        type,
        message: msgs[Math.floor(Math.random() * msgs.length)],
        timestamp: new Date(),
        source: sources[Math.floor(Math.random() * sources.length)],
      };
      setEvents(prev => [newEvent, ...prev.slice(0, 99)]);
    }, 4000 + Math.random() * 4000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)',
        borderColor: 'rgba(42,42,74,0.6)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity"
        style={{ borderBottom: collapsed ? 'none' : '1px solid rgba(42,42,74,0.4)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-hermes-blue animate-pulse" />
          <h3 className="text-sm font-semibold text-white">Live Events</h3>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}
          >
            {events.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div
            onClick={(e) => { e.stopPropagation(); setAutoScroll(!autoScroll); }}
            className={`text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
              autoScroll ? 'text-hermes-blue' : 'text-hermes-muted'
            }`}
            style={{ background: autoScroll ? 'rgba(56,189,248,0.1)' : 'rgba(107,114,128,0.1)' }}
          >
            Auto
          </div>
          {collapsed ? <ChevronUp size={16} style={{ color: '#9ca3af' }} /> : <ChevronDown size={16} style={{ color: '#9ca3af' }} />}
        </div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              ref={listRef}
              className="overflow-y-auto"
              style={{ maxHeight: '320px' }}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop > 10) setAutoScroll(false);
              }}
            >
              {events.map((event, i) => {
                const cfg = eventConfig[event.type];
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-3 px-4 py-2 text-xs border-b"
                    style={{
                      borderColor: 'rgba(42,42,74,0.2)',
                      background: i === 0 ? 'rgba(129,140,248,0.03)' : 'transparent',
                    }}
                  >
                    {/* Type indicator */}
                    <div className="flex items-center gap-1.5 shrink-0 w-16" style={{ color: cfg.color }}>
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </div>

                    {/* Source */}
                    {event.source && (
                      <span
                        className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase"
                        style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af' }}
                      >
                        {event.source}
                      </span>
                    )}

                    {/* Message */}
                    <span className="flex-1 text-white/80 truncate">{event.message}</span>

                    {/* Time */}
                    <span className="shrink-0 font-mono" style={{ color: '#6b7280', fontSize: '10px' }}>
                      {formatTime(event.timestamp)}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}