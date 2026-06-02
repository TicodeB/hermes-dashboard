'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, AlertTriangle, TrendingUp, Brain, Calendar } from 'lucide-react';

interface TaskItem {
  id: string;
  name: string;
  status: 'green' | 'amber' | 'red';
  mission: string;
  detail: string;
  cost?: string;
  model?: string;
  estTokens?: string;
}

const defaultTasks: TaskItem[] = [
  // GREEN — Active / Near Future
  { id: 'g1', name: 'Brevo lead push', status: 'green', mission: 'BEREA', detail: 'Push 236 hot leads to Brevo CRM, segmented by 9 groups', cost: '€0', model: 'Claude Sonnet', estTokens: '~5K' },
  { id: 'g2', name: 'NemoCLaw bridge', status: 'green', mission: 'BEREA', detail: 'Create Telegram group — Hermes + NemoCLaw agents', cost: '€0', model: 'N/A', estTokens: 'N/A' },
  { id: 'g3', name: 'Dashboard polish', status: 'green', mission: 'HERMES OS', detail: 'Bento layout, traffic lights, recommendations panel', cost: '€0', model: 'Haiku', estTokens: '~15K' },
  
  // AMBER — Need to return to
  { id: 'a1', name: 'Leanta website', status: 'amber', mission: 'LEANTA AI', detail: 'Parked — leanta.ie domain bought, no site built', cost: '€4.60/mo', model: 'Claude Sonnet', estTokens: '~20K' },
  { id: 'a2', name: '3 agency proposals', status: 'amber', mission: 'LEANTA AI', detail: 'MiCA compliance, Hospitality AI, Industrial SMEs — 0 of 3 drafted', cost: '€0.50', model: 'GPT-4 Turbo', estTokens: '~10K' },
  { id: 'a3', name: 'Token tracking fix', status: 'amber', mission: 'HERMES OS', detail: 'DeepSeek sessions show €0.00 — OpenRouter headers not captured', cost: '€0', model: 'Haiku', estTokens: '~2K' },
  
  // RED — Blocked / Stopped
  { id: 'r1', name: 'SKU-001 oven liners', status: 'red', mission: 'ECOMMERCE', detail: 'CLOSED by Samuel 2026-06-02. CEE-IRE direction TBD', cost: 'N/A', model: 'N/A', estTokens: 'N/A' },
  { id: 'r2', name: 'Hetzner frontend deploy', status: 'red', mission: 'HERMES OS', detail: 'Blocked — Vercel used instead. VPS route deprecated', cost: '€0', model: 'N/A', estTokens: 'N/A' },
];

const statusConfig = {
  green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400', text: 'text-emerald-300', pulse: 'shadow-emerald-500/20', label: 'GOING' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400', text: 'text-amber-300', pulse: 'shadow-amber-500/20', label: 'PAUSED' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-400', text: 'text-red-300', pulse: 'shadow-red-500/20', label: 'BLOCKED' },
};

export default function TrafficLightBoard() {
  const [activeTab, setActiveTab] = useState<'all'|'green'|'amber'|'red'>('all');
  const [selectedTask, setSelectedTask] = useState<TaskItem|null>(null);

  const filteredTasks = activeTab === 'all' 
    ? defaultTasks 
    : defaultTasks.filter(t => t.status === activeTab);

  const counts = { green: defaultTasks.filter(t=>t.status==='green').length, amber: defaultTasks.filter(t=>t.status==='amber').length, red: defaultTasks.filter(t=>t.status==='red').length };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-2 mb-4">
        {(['all','green','amber','red'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              activeTab === tab 
                ? 'bg-[#002366]/30 border-[#FFD700]/20 text-[#FFD700]' 
                : 'border-white/5 text-zinc-400 hover:border-white/10'
            }`}>
            {tab === 'all' ? `All (${defaultTasks.length})` : `${tab.charAt(0).toUpperCase()+tab.slice(1)} (${counts[tab]})`}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        <AnimatePresence>
          {filteredTasks.map((task, i) => {
            const config = statusConfig[task.status];
            return (
              <motion.div key={task.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${config.bg} ${config.border} hover:border-opacity-50 ${selectedTask?.id === task.id ? 'ring-1 ring-[#FFD700]/30' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
                    <span className="text-sm font-medium text-white truncate">{task.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500">{task.mission}</span>
                  </div>
                  <span className={`text-[10px] font-semibold ${config.text}`}>{config.label}</span>
                </div>
                
                <AnimatePresence>
                  {selectedTask?.id === task.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="mt-3 pt-3 border-t border-white/5 space-y-2 overflow-hidden">
                      <p className="text-xs text-zinc-400">{task.detail}</p>
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div className="bg-white/5 rounded px-2 py-1"><span className="text-zinc-500">Cost</span><br/><span className="text-white">{task.cost}</span></div>
                        <div className="bg-white/5 rounded px-2 py-1"><span className="text-zinc-500">Model</span><br/><span className="text-white">{task.model}</span></div>
                        <div className="bg-white/5 rounded px-2 py-1"><span className="text-zinc-500">Tokens</span><br/><span className="text-white">{task.estTokens}</span></div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredTasks.length === 0 && (
          <div className="text-center py-8 text-zinc-500 text-sm">No tasks in this category</div>
        )}
      </div>

      {/* Recommendation */}
      <div className="mt-4 p-3 rounded-xl bg-[#002366]/10 border border-[#FFD700]/10">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-3.5 h-3.5 text-[#FFD700]" />
          <span className="text-xs font-medium text-[#FFD700]">NEXT RECOMMENDED</span>
        </div>
        <p className="text-xs text-zinc-400">
          Complete NemoCLaw bridge → push Brevo leads. This unlocks BEREA pipeline (236 hot leads). 
          Then return to Leanta proposals. Estimated time: 2-3 days.
        </p>
      </div>
    </div>
  );
}
