'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Brain, Calendar, GitGraph, Layers, MessageSquare, Terminal, X, Search, BarChart3 } from 'lucide-react';

import FlowField from '@/components/FlowField';
import CountUp from '@/components/CountUp';
import MissionCard from '@/components/MissionCard';
import AgentGraph from '@/components/AgentGraph';
import LiveEventFeed from '@/components/LiveEventFeed';
import TrafficLightBoard from '@/components/TrafficLightBoard';
import GanttChart from '@/components/GanttChart';
import MindMap from '@/components/MindMap';
import HonchoPanel from '@/components/HonchoPanel';

const TerminalPanel = dynamic(() => import('@/components/Terminal'), { ssr: false });

type Panel = 'missions' | 'graph' | 'events' | 'traffic' | 'gantt' | 'mindmap' | 'honcho' | 'terminal';

interface PanelConfig {
  id: Panel;
  icon: any;
  label: string;
  size: 'sm' | 'md' | 'lg' | 'full';
}

const panels: PanelConfig[] = [
  { id: 'missions', icon: Layers, label: 'Missions', size: 'lg' },
  { id: 'graph', icon: GitGraph, label: 'Graph', size: 'lg' },
  { id: 'traffic', icon: Activity, label: 'Tasks', size: 'md' },
  { id: 'gantt', icon: Calendar, label: 'Timeline', size: 'lg' },
  { id: 'mindmap', icon: Brain, label: 'Mind Map', size: 'md' },
  { id: 'honcho', icon: Search, label: 'Memory', size: 'md' },
  { id: 'events', icon: BarChart3, label: 'Events', size: 'sm' },
  { id: 'terminal', icon: Terminal, label: 'Terminal', size: 'full' },
];

const sizeClasses: Record<string, string> = {
  sm: 'col-span-1 row-span-1',
  md: 'col-span-1 row-span-1 md:col-span-1 md:row-span-2',
  lg: 'col-span-1 md:col-span-2 row-span-1 md:row-span-2',
  full: 'col-span-1 md:col-span-2 row-span-2 md:row-span-3',
};

export default function Page() {
  const [activePanels, setActivePanels] = useState<Set<Panel>>(new Set(['missions', 'graph', 'traffic', 'events']));
  const [metrics, setMetrics] = useState({ sessions: 78, messages: 2090, agents: 3, success: 100, spend: 0 });

  // Fetch live metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('https://hermes.46-225-84-249.sslip.io/api/dashboard/metrics');
        const data = await res.json();
        setMetrics({
          sessions: data.total_sessions || 78,
          messages: data.total_messages || 2090,
          agents: data.active_agents || 3,
          success: data.success_rate || 100,
          spend: data.spend_month || 0,
        });
      } catch {}
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  const togglePanel = (id: Panel) => {
    const next = new Set(activePanels);
    if (next.has(id)) next.delete(id); else next.add(id);
    setActivePanels(next);
  };

  const isActive = (id: Panel) => activePanels.has(id);

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-white font-mono relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0 opacity-40"><FlowField /></div>

      {/* Content */}
      <div className="relative z-10 p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-[#FFD700]">HERMES</span>
              <span className="text-zinc-400 ml-2 text-sm font-normal">Mission Control</span>
            </h1>
            <p className="text-[10px] text-zinc-600 mt-0.5">v0.2 · Hetzner VPS · 3 missions active</p>
          </div>
          
          {/* Quick metrics */}
          <div className="flex gap-4 text-right">
            <div className="text-center">
              <div className="text-lg font-bold text-[#FFD700]"><CountUp to={metrics.sessions} duration={1} /></div>
              <div className="text-[9px] text-zinc-500">sessions</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-400"><CountUp to={metrics.messages} duration={1} /></div>
              <div className="text-[9px] text-zinc-500">messages</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-400">{metrics.agents}</div>
              <div className="text-[9px] text-zinc-500">agents</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-zinc-300">€<CountUp to={metrics.spend} duration={1} /></div>
              <div className="text-[9px] text-zinc-500">spend/mo</div>
            </div>
          </div>
        </header>

        {/* Panel toggle bar */}
        <nav className="flex flex-wrap gap-1.5 mb-4 pb-4 border-b border-white/5">
          {panels.map(p => {
            const Icon = p.icon;
            const active = isActive(p.id);
            return (
              <button key={p.id} onClick={() => togglePanel(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  active 
                    ? 'bg-[#002366]/40 border-[#FFD700]/20 text-[#FFD700] shadow-sm' 
                    : 'border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {p.label}
              </button>
            );
          })}
        </nav>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 auto-rows-min">
          <AnimatePresence mode="popLayout">
            {panels.filter(p => isActive(p.id)).map(p => (
              <motion.div key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className={`${sizeClasses[p.size]} bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 overflow-hidden hover:border-white/[0.1] transition-colors relative group`}>
                
                {/* Panel header with close button */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p.icon className="w-3.5 h-3.5 text-[#FFD700]/60" />
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{p.label}</span>
                  </div>
                  <button onClick={() => togglePanel(p.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/5">
                    <X className="w-3 h-3 text-zinc-600" />
                  </button>
                </div>

                {/* Panel content */}
                <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
                  {p.id === 'missions' && (
                    <div className="grid gap-3">
                      <MissionCard id="ecommerce" name="Ecommerce" icon="📦" status="idle"
                        metrics={[{value:'€0',label:'Rev'},{value:'0',label:'SKUs'},{value:'—',label:'Next'}]}
                        alert={{level:'info',text:'SKU-001 closed — new direction TBD'}} index={0} />
                      <MissionCard id="berea" name="Penzión BEREA" icon="🏨" status="active"
                        metrics={[{value:'3,002',label:'Leads'},{value:'236',label:'Hot'},{value:'Brevo',label:'CRM'}]}
                        alert={{level:'warn',text:'NemoCLaw bridge pending — then push leads'}} index={1} />
                      <MissionCard id="leanta" name="Leanta AI" icon="🤖" status="active"
                        metrics={[{value:'3',label:'Niches'},{value:'0',label:'Props'},{value:'Live',label:'Dashboard'}]}
                        alert={{level:'ok',text:'Dashboard deployed — 3 proposals to draft'}} index={2} />
                    </div>
                  )}
                  {p.id === 'graph' && <AgentGraph />}
                  {p.id === 'traffic' && <TrafficLightBoard />}
                  {p.id === 'gantt' && <GanttChart />}
                  {p.id === 'mindmap' && <MindMap />}
                  {p.id === 'honcho' && <HonchoPanel />}
                  {p.id === 'events' && <LiveEventFeed />}
                  {p.id === 'terminal' && (
                    <div className="h-[500px]">
                      <TerminalPanel />
                    </div>
                  )}
                </div>

                {/* Bento border glow */}
                <div className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ boxShadow: `inset 0 1px 0 ${p.id === 'traffic' ? 'rgba(239,68,68,0.05)' : 'rgba(255,215,0,0.03)'}` }} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
