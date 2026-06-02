'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface MindNode {
  id: string;
  name: string;
  children?: MindNode[];
}

const mindData: MindNode = {
  id: 'root',
  name: 'HERMES OS',
  children: [
    { id: 'ecom', name: 'Ecommerce', children: [
      { id: 'sku1', name: 'SKU-001 ❌' },
      { id: 'tbd', name: 'Next SKU TBD' },
    ]},
    { id: 'berea', name: 'BEREA', children: [
      { id: 'leads', name: '3,002 Leads' },
      { id: 'brevo', name: 'Brevo CRM' },
      { id: 'nemo', name: 'NemoCLaw' },
    ]},
    { id: 'leanta', name: 'Leanta AI', children: [
      { id: 'mica', name: 'MiCA Compliance' },
      { id: 'hosp', name: 'Hospitality AI' },
      { id: 'ind', name: 'Industrial SME' },
    ]},
    { id: 'infra', name: 'Infrastructure', children: [
      { id: 'vps', name: 'Hetzner VPS' },
      { id: 'db', name: 'Dashboard' },
      { id: 'api', name: 'API v0.2' },
    ]},
  ],
};

export default function MindMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<string|null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 500;
    const height = 280;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(60,${height/2})`);

    // Build tree
    const root = d3.hierarchy<MindNode>(mindData);
    const treeLayout = d3.tree<MindNode>().size([height-60, width-140]);
    treeLayout(root);

    // Links
    g.selectAll('path')
      .data(root.links())
      .join('path')
      .attr('d', (d3.linkHorizontal<any, any>() as any)
        .x((d: any) => d.y)
        .y((d: any) => d.x))
      .attr('fill', 'none')
      .attr('stroke', (d: any) => 
        d.target.depth === 1 ? '#FFD70033' : 
        d.target.depth === 2 ? '#00236655' : '#ffffff15')
      .attr('stroke-width', (d: any) => d.target.depth === 1 ? 1.5 : 0.8);

    // Nodes
    const node = g.selectAll('g.node')
      .data(root.descendants())
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')
      .on('click', (_, d) => setSelected(d.data.id));

    node.append('circle')
      .attr('r', d => d.depth === 0 ? 8 : d.depth === 1 ? 6 : 4)
      .attr('fill', d => 
        d.depth === 0 ? '#FFD700' :
        d.depth === 1 ? '#002366' : '#334466')
      .attr('stroke', d => d.depth <= 1 ? '#FFD70040' : '#ffffff15')
      .attr('stroke-width', 1);

    node.append('text')
      .attr('dy', d => d.depth === 0 ? -14 : d.depth === 1 ? 16 : 12)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.depth === 0 ? '#FFD700' : d.depth === 1 ? '#fff' : '#888')
      .attr('font-size', d => d.depth === 0 ? 11 : d.depth === 1 ? 10 : 8)
      .attr('font-family', 'monospace')
      .text(d => d.data.name);

  }, [selected]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-zinc-300">Mind Map</span>
        {selected && (
          <button onClick={() => setSelected(null)}
            className="text-[9px] text-[#FFD700] hover:underline">clear</button>
        )}
      </div>
      <svg ref={svgRef} className="w-full" style={{ minHeight: 280 }} />
    </div>
  );
}
