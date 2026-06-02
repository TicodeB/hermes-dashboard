'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Cpu, RefreshCw } from 'lucide-react';

interface AgentNode {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'idle' | 'error';
  tasksCompleted: number;
  uptime: string;
  model: string;
}

interface AgentEdge {
  source: string;
  target: string;
  label: string;
  type: 'task' | 'delegation' | 'sync';
}

const agents: AgentNode[] = [
  { id: 'orchestrator', name: 'Orchestrator', role: 'Orchestrator', status: 'active', tasksCompleted: 847, uptime: '72h', model: 'deepseek-v4' },
  { id: 'ecommerce', name: 'Ecommerce', role: 'Ecommerce Agent', status: 'active', tasksCompleted: 312, uptime: '48h', model: 'gpt-4o' },
  { id: 'berea', name: 'BEREA', role: 'BEREA Agent', status: 'idle', tasksCompleted: 156, uptime: '36h', model: 'claude-3.5' },
  { id: 'leanta', name: 'Leanta AI', role: 'Leanta AI Agent', status: 'active', tasksCompleted: 223, uptime: '24h', model: 'deepseek-v4' },
  { id: 'data-pipeline', name: 'Data Pipeline', role: 'Data Agent', status: 'error', tasksCompleted: 89, uptime: '12h', model: 'gpt-4o-mini' },
  { id: 'monitor', name: 'Monitor', role: 'Monitoring Agent', status: 'active', tasksCompleted: 401, uptime: '72h', model: 'gemini-pro' },
];

const edges: AgentEdge[] = [
  { source: 'orchestrator', target: 'ecommerce', label: 'delegates', type: 'delegation' },
  { source: 'orchestrator', target: 'berea', label: 'delegates', type: 'delegation' },
  { source: 'orchestrator', target: 'leanta', label: 'delegates', type: 'delegation' },
  { source: 'orchestrator', target: 'data-pipeline', label: 'delegates', type: 'delegation' },
  { source: 'ecommerce', target: 'data-pipeline', label: 'queries', type: 'task' },
  { source: 'leanta', target: 'data-pipeline', label: 'queries', type: 'task' },
  { source: 'orchestrator', target: 'monitor', label: 'syncs', type: 'sync' },
  { source: 'monitor', target: 'orchestrator', label: 'reports', type: 'sync' },
];

const statusColors: Record<string, string> = {
  active: '#4ade80',
  idle: '#38bdf8',
  error: '#ef4444',
};

export default function AgentGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!svgRef.current || collapsed) return;

    const svg = d3.select(svgRef.current);
    const width = containerRef.current?.clientWidth || 600;
    const height = 340;

    svg.selectAll('*').remove();

    // Create tooltip div
    const tooltip = d3.select('body')
      .selectAll('.agent-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'agent-tooltip')
      .style('position', 'fixed')
      .style('background', 'rgba(15,15,26,0.95)')
      .style('border', '1px solid rgba(42,42,74,0.8)')
      .style('border-radius', '8px')
      .style('padding', '8px 12px')
      .style('color', '#e5e7eb')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', '0')
      .style('z-index', '999')
      .style('backdrop-filter', 'blur(8px)')
      .style('box-shadow', '0 8px 32px rgba(0,0,0,0.4)');

    const nodeMap = new Map(agents.map(a => [a.id, a]));

    // Build simulation
    const simulation = d3.forceSimulation(agents as any)
      .force('link', d3.forceLink(edges as any)
        .id((d: any) => d.id)
        .distance(90)
        .strength(0.4)
      )
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(35));

    // Arrows marker
    svg.append('defs').selectAll('marker')
      .data(['arrow-active', 'arrow-idle', 'arrow-error'])
      .join('marker')
      .attr('id', d => d)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', d => d === 'arrow-active' ? '#4ade80' : d === 'arrow-idle' ? '#38bdf8' : '#ef4444');

    // Links
    const link = svg.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', 'rgba(107,114,128,0.3)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', (d: any) => d.type === 'sync' ? '4,3' : 'none')
      .attr('marker-end', (d: any) => {
        const source = nodeMap.get(d.source.id || d.source);
        if (source) return `url(#arrow-${source.status})`;
        return 'url(#arrow-active)';
      });

    // Link labels
    const linkLabel = svg.append('g')
      .selectAll('text')
      .data(edges)
      .join('text')
      .text((d: any) => d.label)
      .attr('font-size', '9px')
      .attr('fill', '#6b7280')
      .attr('text-anchor', 'middle')
      .attr('dy', -6);

    // Node group
    const node = svg.append('g')
      .selectAll('g')
      .data(agents)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_: any, d: AgentNode) => {
        setSelectedAgent(d);
      })
      .on('mouseover', function(_: any, d: AgentNode) {
        d3.select(this).select('circle')
          .transition().duration(200)
          .attr('r', 22)
          .attr('stroke-width', 3);
        tooltip
          .style('opacity', '1')
          .html(`<div style="font-weight:600;color:${statusColors[d.status]}">${d.name}</div><div style="color:#9ca3af">${d.role} · ${d.model}</div>`);
      })
      .on('mousemove', function(event: any) {
        tooltip
          .style('left', (event.clientX + 15) + 'px')
          .style('top', (event.clientY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).select('circle')
          .transition().duration(200)
          .attr('r', 18)
          .attr('stroke-width', 2);
        tooltip.style('opacity', '0');
      })
      .call(d3.drag<any, AgentNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d3.select(event.sourceEvent.target.closest('g')).raise();
        })
        .on('drag', (event, d) => {
          (d as any).x = event.x;
          (d as any).y = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
        })
      );

    // Node circle
    node.append('circle')
      .attr('r', 18)
      .attr('fill', (d: AgentNode) => `${statusColors[d.status]}22`)
      .attr('stroke', (d: AgentNode) => statusColors[d.status])
      .attr('stroke-width', 2)
      .attr('filter', 'drop-shadow(0 0 6px rgba(0,0,0,0.3))');

    // Glow ring
    node.append('circle')
      .attr('r', 22)
      .attr('fill', 'none')
      .attr('stroke', (d: AgentNode) => statusColors[d.status])
      .attr('stroke-width', 1)
      .attr('opacity', 0.3)
      .attr('stroke-dasharray', '3,2');

    // Icon placeholder (colored dot)
    node.append('circle')
      .attr('r', 6)
      .attr('fill', (d: AgentNode) => statusColors[d.status])
      .attr('opacity', 0.8);

    // Node label
    node.append('text')
      .text((d: AgentNode) => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', 30)
      .attr('fill', '#e5e7eb')
      .attr('font-size', '11px')
      .attr('font-weight', '500');

    // Simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node.attr('transform', (n: any) => {
        // Keep nodes in bounds
        n.x = Math.max(30, Math.min(width - 30, n.x));
        n.y = Math.max(30, Math.min(height - 30, n.y));
        return `translate(${n.x},${n.y})`;
      });
    });

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [collapsed]);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)',
        borderColor: 'rgba(42,42,74,0.6)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        style={{ borderBottom: collapsed ? 'none' : '1px solid rgba(42,42,74,0.4)' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <Cpu size={16} style={{ color: '#818cf8' }} />
          <h3 className="text-sm font-semibold text-white">Agent Graph</h3>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}
          >
            {agents.length} nodes
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-[10px]" style={{ color: '#6b7280' }}>
            {Object.entries(statusColors).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="capitalize">{status}</span>
              </div>
            ))}
          </div>
          {collapsed ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          )}
        </div>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            <div ref={containerRef} className="w-full" style={{ height: '340px' }}>
              <svg ref={svgRef} width="100%" height="100%" />
            </div>

            {/* Selected agent panel */}
            <AnimatePresence>
              {selectedAgent && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-3 left-3 right-3 p-3 rounded-lg border backdrop-blur-md"
                  style={{
                    background: 'rgba(15,15,26,0.9)',
                    borderColor: statusColors[selectedAgent.status],
                    boxShadow: `0 0 20px ${statusColors[selectedAgent.status]}22`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: statusColors[selectedAgent.status] }} />
                      <span className="font-semibold text-white text-sm">{selectedAgent.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af' }}>
                        {selectedAgent.role}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedAgent(null); }}
                      className="text-hermes-muted hover:text-white cursor-pointer text-xs"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span style={{ color: '#6b7280' }}>Tasks</span>
                      <p className="text-white font-semibold">{selectedAgent.tasksCompleted}</p>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Uptime</span>
                      <p className="text-white font-semibold">{selectedAgent.uptime}</p>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Model</span>
                      <p className="text-white font-semibold font-mono text-[10px]">{selectedAgent.model}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}