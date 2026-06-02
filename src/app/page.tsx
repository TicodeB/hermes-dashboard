'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Briefcase, Brain } from 'lucide-react';
import FlowField from '@/components/FlowField';
import MissionCard from '@/components/MissionCard';
import type { Metric } from '@/components/MissionCard';
import AgentGraph from '@/components/AgentGraph';
import LiveEventFeed from '@/components/LiveEventFeed';

const TerminalPanel = dynamic(() => import('@/components/Terminal'), { ssr: false });

type ViewMode = 'split' | 'terminal';

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  const missions: {
    icon: React.ReactNode;
    name: string;
    status: 'active' | 'idle' | 'critical';
    metrics: [Metric, Metric, Metric];
    alert?: string;
  }[] = [
    {
      icon: <ShoppingCart size={20} />,
      name: 'Ecommerce Operations',
      status: 'active',
      metrics: [
        { label: 'Orders Today', value: 142 },
        { label: 'Revenue', value: 12480, prefix: '$' },
        { label: 'Conversion', value: 3.2, suffix: '%' },
      ],
      alert: 'Stripe webhook latency above threshold',
    },
    {
      icon: <Briefcase size={20} />,
      name: 'BEREA Lead Pipeline',
      status: 'idle',
      metrics: [
        { label: 'New Leads', value: 45 },
        { label: 'Enriched', value: 38 },
        { label: 'Score Avg', value: 7.6, suffix: '/10' },
      ],
    },
    {
      icon: <Brain size={20} />,
      name: 'Leanta AI Training',
      status: 'critical',
      metrics: [
        { label: 'Epoch', value: 12 },
        { label: 'Accuracy', value: 94.2, suffix: '%' },
        { label: 'Token Usage', value: 872, suffix: 'K' },
      ],
      alert: 'Token budget at 87% — rate limit imminent',
    },
  ];

  return (
    <>
      <FlowField />

      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="border-b" style={{ borderColor: 'rgba(42,42,74,0.4)', background: 'rgba(15,15,26,0.6)', backdropFilter: 'blur(12px)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #818cf8, #a855f7)', color: '#fff' }}
                >
                  H
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">HERMES</h1>
                  <p className="text-[10px] sm:text-xs hidden sm:block" style={{ color: '#6b7280' }}>Mission Control · Multi-Agent Orchestration</p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* View toggle */}
                <div className="flex rounded-lg overflow-hidden text-xs" style={{ background: 'rgba(26,26,46,0.8)', border: '1px solid rgba(42,42,74,0.4)' }}>
                  <button
                    onClick={() => setViewMode('split')}
                    className="px-2.5 sm:px-3 py-1.5 transition-colors cursor-pointer"
                    style={{ background: viewMode === 'split' ? 'rgba(129,140,248,0.15)' : 'transparent', color: viewMode === 'split' ? '#818cf8' : '#6b7280' }}
                  >
                    Split
                  </button>
                  <button
                    onClick={() => setViewMode('terminal')}
                    className="px-2.5 sm:px-3 py-1.5 transition-colors cursor-pointer"
                    style={{ background: viewMode === 'terminal' ? 'rgba(129,140,248,0.15)' : 'transparent', color: viewMode === 'terminal' ? '#818cf8' : '#6b7280' }}
                  >
                    Terminal
                  </button>
                </div>

                {/* Status dot */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] sm:text-xs" style={{ background: 'rgba(74,222,128,0.08)', color: '#4ade80' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-hermes-green animate-pulse" />
                  <span className="hidden sm:inline">All Systems</span>
                  <span>Online</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <AnimatePresence mode="wait">
            {viewMode === 'split' ? (
              <motion.div
                key="split"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Mission Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 sm:mb-6">
                  {missions.map((mission, i) => (
                    <MissionCard key={mission.name} {...mission} index={i} />
                  ))}
                </div>

                {/* Bottom section: Graph + Events + Terminal */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {/* Left area: AgentGraph + Terminal */}
                  <div className="lg:col-span-3 space-y-4">
                    <AgentGraph />
                    <TerminalPanel />
                  </div>

                  {/* Right: LiveEventFeed */}
                  <div className="lg:col-span-2">
                    <LiveEventFeed />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="terminal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Full terminal view */}
                <div className="flex flex-col gap-4">
                  {/* Mini mission cards row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {missions.map((mission, i) => (
                      <MissionCard key={mission.name} {...mission} index={i} />
                    ))}
                  </div>

                  {/* Terminal expanded */}
                  <div
                    className="rounded-xl border overflow-hidden"
                    style={{
                      background: '#0a0a14',
                      borderColor: 'rgba(42,42,74,0.6)',
                    }}
                  >
                    <div
                      className="flex items-center justify-between px-4 py-2.5"
                      style={{ borderBottom: '1px solid rgba(42,42,74,0.4)' }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-hermes-green" style={{ boxShadow: '0 0 6px rgba(74,222,128,0.5)' }} />
                        <span className="text-sm font-semibold text-white">Terminal — Full Control</span>
                      </div>
                      <button
                        onClick={() => setViewMode('split')}
                        className="text-xs px-2 py-1 rounded cursor-pointer transition-colors"
                        style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8' }}
                      >
                        Split View
                      </button>
                    </div>
                    <div style={{ height: '480px', padding: '2px' }}>
                      <TerminalPanel />
                    </div>
                  </div>

                  {/* Event feed below */}
                  <LiveEventFeed />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer
          className="border-t py-3 text-center text-[10px] sm:text-xs"
          style={{ borderColor: 'rgba(42,42,74,0.3)', color: '#6b7280', background: 'rgba(15,15,26,0.4)' }}
        >
          HERMES Mission Control v1.0 · Powered by Nous Research
        </footer>
      </div>
    </>
  );
}