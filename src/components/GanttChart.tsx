'use client';

import { motion } from 'framer-motion';

interface GanttItem {
  id: string;
  name: string;
  start: number; // day offset from now
  duration: number; // days
  color: string; // tailwind bg color class
  mission: string;
}

const ganttData: GanttItem[] = [
  { id: 'g1', name: 'NemoCLaw Bridge', start: 0, duration: 1, color: 'bg-emerald-500', mission: 'BEREA' },
  { id: 'g2', name: 'Brevo Lead Push', start: 1, duration: 1, color: 'bg-blue-500', mission: 'BEREA' },
  { id: 'g3', name: 'Dashboard Polish', start: 0, duration: 2, color: 'bg-purple-500', mission: 'HERMES' },
  { id: 'g4', name: 'API Live Data', start: -1, duration: 2, color: 'bg-cyan-500', mission: 'HERMES' },
  { id: 'g5', name: 'Leanta Proposals', start: 3, duration: 3, color: 'bg-amber-500', mission: 'LEANTA' },
  { id: 'g6', name: 'Leanta Website', start: 5, duration: 4, color: 'bg-orange-500', mission: 'LEANTA' },
  { id: 'g7', name: 'Token Tracking Fix', start: 3, duration: 1, color: 'bg-pink-500', mission: 'HERMES' },
];

const totalDays = 10;
const todayOffset = 1; // "today" position from left

export default function GanttChart() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-zinc-300">Timeline</span>
        <span className="text-[10px] text-zinc-600">(10 days ahead)</span>
      </div>

      {/* Grid header */}
      <div className="flex text-[9px] text-zinc-600 mb-1 pl-24">
        {Array.from({length: totalDays}, (_, i) => (
          <div key={i} className="flex-1 text-center">
            {i === todayOffset ? 'TODAY' : `+${i-todayOffset > 0 ? i-todayOffset : ''}`}
          </div>
        ))}
      </div>

      {/* Bars */}
      <div className="space-y-2">
        {ganttData.map((item, idx) => (
          <motion.div key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-2">
            {/* Label */}
            <div className="w-20 flex-shrink-0">
              <div className="text-[11px] text-zinc-300 truncate">{item.name}</div>
              <div className="text-[9px] text-zinc-600">{item.mission}</div>
            </div>
            {/* Bar area */}
            <div className="flex-1 h-6 relative bg-white/[0.03] rounded-full overflow-hidden">
              {/* Today line */}
              <div className="absolute top-0 bottom-0 w-px bg-[#FFD700]/40 z-10"
                style={{ left: `${(todayOffset/totalDays)*100}%` }} />
              {/* Bar */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(item.duration/totalDays)*100}%` }}
                transition={{ delay: 0.3 + idx * 0.1, duration: 0.5 }}
                className={`absolute top-1 bottom-1 rounded-full ${item.color} opacity-80`}
                style={{ left: `${(Math.max(0, item.start+1)/totalDays)*100}%` }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
        <div className="w-px h-4 bg-[#FFD700]/40" />
        <span className="text-[9px] text-zinc-500">← Today line</span>
      </div>
    </div>
  );
}
