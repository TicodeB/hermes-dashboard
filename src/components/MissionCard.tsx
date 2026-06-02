'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Clock, XCircle, Activity } from 'lucide-react';
import CountUp from './CountUp';

type Status = 'active' | 'idle' | 'stalled' | 'critical';

export interface Metric {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
}

interface MissionCardProps {
  icon: React.ReactNode;
  name: string;
  status: Status;
  metrics: [Metric, Metric, Metric];
  alert?: string;
  index?: number;
}

const statusConfig: Record<Status, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  active: {
    color: '#4ade80',
    bgColor: 'rgba(74,222,128,0.12)',
    icon: <CheckCircle size={12} />,
    label: 'Active',
  },
  idle: {
    color: '#6b7280',
    bgColor: 'rgba(107,114,128,0.12)',
    icon: <Clock size={12} />,
    label: 'Idle',
  },
  stalled: {
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
    icon: <AlertTriangle size={12} />,
    label: 'Stalled',
  },
  critical: {
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.12)',
    icon: <XCircle size={12} />,
    label: 'Critical',
  },
};

export default function MissionCard({ icon, name, status, metrics, alert, index = 0 }: MissionCardProps) {
  const cfg = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-xl border"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16162a 100%)',
        borderColor: 'rgba(42,42,74,0.6)',
      }}
    >
      {/* Glow accent */}
      <div
        className="absolute top-0 left-0 w-full h-[2px] opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
          boxShadow: `0 0 12px ${cfg.color}44`,
        }}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8' }}
            >
              {icon}
            </div>
            <h3 className="text-white font-semibold text-base">{name}</h3>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: cfg.bgColor, color: cfg.color }}
          >
            {cfg.icon}
            <span>{cfg.label}</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {metrics.map((m, i) => (
            <div key={i} className="rounded-lg p-2.5" style={{ background: 'rgba(15,15,26,0.4)' }}>
              <p className="text-xs" style={{ color: '#9ca3af' }}>{m.label}</p>
              <p className="text-lg font-bold text-white mt-0.5 font-mono tabular-nums">
                <CountUp to={m.value} suffix={m.suffix} prefix={m.prefix} />
              </p>
            </div>
          ))}
        </div>

        {/* Alert */}
        {alert && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
            style={{
              background: status === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
              color: status === 'critical' ? '#ef4444' : '#f59e0b',
            }}
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{alert}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}