'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronDown, ChevronUp, CircleAlert } from 'lucide-react';
import type { RouteNode } from './config';
import { connectorProgress, nodeState, type Transfer } from './simulation';
import { connectorGeometry } from './route-geometry';

type Props = { nodes: readonly RouteNode[]; transfer: Transfer | null; expanded: boolean; onToggle: () => void; reduced: boolean };
type Line = { x1: number; y1: number; x2: number; y2: number };
const EASE = [0.22, 1, 0.36, 1] as const;

export function RouteJourney({ nodes, transfer, expanded, onToggle, reduced }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [rowHeight, setRowHeight] = useState(80);
  const [lines, setLines] = useState<(Line | null)[]>([]);
  const height = expanded ? (nodes.length - 1) * rowHeight + 64 : 104;

  useLayoutEffect(() => {
    const element = root.current; if (!element) return;
    const measure = () => {
      setWidth(element.clientWidth);
      const labels = Array.from(element.querySelectorAll<HTMLElement>('.demo-node-label'));
      setRowHeight(Math.max(80, ...labels.map(label => label.offsetHeight + 24)));
    };
    const observer = new ResizeObserver(measure); observer.observe(element); measure();
    return () => observer.disconnect();
  }, [nodes.length, expanded]);

  useLayoutEffect(() => {
    const element = root.current; if (!element) return;
    let frame = 0; const until = performance.now() + (reduced ? 0 : 700);
    const measure = () => {
      cancelAnimationFrame(frame);
      const bounds = element.getBoundingClientRect();
      const circles = Array.from(element.querySelectorAll<HTMLElement>('.demo-node-circle')).map(circle => {
        const rect = circle.getBoundingClientRect(); return { x: rect.x - bounds.x + rect.width / 2, y: rect.y - bounds.y + rect.height / 2, radius: rect.width / 2 };
      });
      const first = circles[0], last = circles[circles.length - 1];
      const intermediate = element.querySelector<HTMLElement>('[data-node]:not([data-node=sender]):not([data-node=recipient])');
      const unfolding = expanded || (intermediate !== null && Number(getComputedStyle(intermediate).opacity) > 0.01);
      if (first && last) {
        const overall = connectorGeometry(first, last);
        setLines(nodes.slice(0, -1).map((_, index) => {
          const from = circles[index], to = circles[index + 1];
          if (unfolding && from && to) return connectorGeometry(from, to);
          if (!overall) return null;
          const parts = nodes.length - 1, dx = overall.x2 - overall.x1, dy = overall.y2 - overall.y1;
          return { x1: overall.x1 + dx * index / parts, y1: overall.y1 + dy * index / parts, x2: overall.x1 + dx * (index + 1) / parts, y2: overall.y1 + dy * (index + 1) / parts };
        }));
      }
      if (performance.now() < until) frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [expanded, nodes, width, rowHeight, reduced]);

  // Keep decorative rings still when the tab is hidden; execution itself pauses too.
  useEffect(() => {
    const sync = () => root.current?.classList.toggle('demo-hidden', document.hidden);
    document.addEventListener('visibilitychange', sync); return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return <section className="demo-journey" aria-label="Transfer route">
    <div className="demo-route-heading"><span>THE JOURNEY</span><button type="button" className="demo-text-button" onClick={onToggle} aria-expanded={expanded} aria-controls="route-nodes">{expanded ? 'Collapse route' : transfer?.status === 'completed' ? 'View route' : 'Expand route'}{expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button></div>
    <motion.div ref={root} id="route-nodes" className={`demo-route-map ${expanded ? 'is-expanded' : ''}`} animate={{ height }} transition={{ duration: reduced ? 0 : 0.55, ease: EASE }} data-gap="8" data-expanded={expanded}>
      <svg className="demo-connectors" aria-hidden="true" width="100%" height="100%">
        {nodes.slice(0, -1).map((node, index) => {
          const line = lines[index]; if (!line) return null;
          const d = `M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`;
          return <g key={`${node.id}-${nodes[index + 1]?.id}`} data-connector={`${node.id}-${nodes[index + 1]?.id}`}><path className="demo-path-base" d={d}/><path className="demo-path-progress" d={d} pathLength="1" strokeDasharray="1" strokeDashoffset={1 - connectorProgress(transfer, index)}/></g>;
        })}
      </svg>
      {nodes.map((node, index) => {
        const endpoint = index === 0 || index === nodes.length - 1;
        const state = nodeState(transfer, index);
        const status = state === 'active' ? transfer?.status === 'paused' ? 'Paused here' : 'In progress' : state === 'complete' ? 'Step complete' : state === 'interrupted' ? 'Interrupted' : transfer ? 'Up next' : node.detail;
        return <motion.div key={node.id} data-node={node.id} data-state={state} className={`demo-route-node ${index === nodes.length - 1 ? 'is-recipient' : ''}`} aria-hidden={!expanded && !endpoint}
          animate={{ x: expanded ? 0 : index === 0 ? 0 : index === nodes.length - 1 ? width - 44 : (width - 44) / 2, y: expanded ? index * rowHeight + 8 : 8, opacity: expanded || endpoint ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.55, ease: EASE }}>
          <div className={`demo-node-circle is-${state} ${transfer?.status === 'paused' ? 'is-paused' : ''}`} aria-hidden="true">{state === 'complete' ? <Check size={20} strokeWidth={2.3}/> : state === 'interrupted' ? <CircleAlert size={21}/> : node.initials}</div>
          <div className="demo-node-label"><strong>{expanded ? node.name : index === 0 ? '@noomy' : node.id === 'recipient' ? node.detail.split(' · ')[0] : node.name}</strong><span>{expanded ? status : index === 0 ? 'From' : 'To'}</span></div>
        </motion.div>;
      })}
    </motion.div>
    <p className="demo-sr-only" aria-live="polite">{transfer ? `${nodes.filter((_, i) => nodeState(transfer, i) === 'complete').length} of ${nodes.length} steps complete. ${nodes.find((_, i) => nodeState(transfer, i) === 'active')?.name ?? ''}` : nodes.map(node => node.name).join(' to ')}</p>
  </section>;
}
