import { useEffect, useMemo, useRef, useState } from 'react';
import Sigma from 'sigma';
import type { GraphData } from '../lib/buildGraph';
import { createRemGraph, LayoutRunner, type RemGraph } from '../lib/graphModel';
import { useDarkMode } from './useDarkMode';

interface Props {
  data: GraphData;
  /** Node to emphasise and centre on (local graph). */
  centerId?: string;
  onOpenNode: (nodeId: string) => void;
  /** Smaller UI for the sidebar. */
  compact?: boolean;
}

interface Theme {
  label: string;
  edge: string;
  referenceEdge: string;
  dimmedNode: string;
  dimmedEdge: string;
  hoverBg: string;
  hoverBorder: string;
}

const LIGHT: Theme = {
  label: '#1f2328',
  edge: '#d0d4da',
  referenceEdge: '#9db5d6',
  dimmedNode: '#e6e8eb',
  dimmedEdge: '#f0f1f3',
  hoverBg: '#ffffff',
  hoverBorder: '#c9ced6',
};
const DARK: Theme = {
  label: '#e6e8eb',
  edge: '#3a3f47',
  referenceEdge: '#4d6a92',
  dimmedNode: '#2b2f35',
  dimmedEdge: '#24272c',
  hoverBg: '#24272c',
  hoverBorder: '#4a5058',
};

const MAX_SUGGESTIONS = 8;

export function GraphView({ data, centerId, onOpenNode, compact }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<RemGraph | null>(null);
  const layoutRef = useRef<LayoutRunner | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const themeRef = useRef<Theme>(LIGHT);
  const onOpenRef = useRef(onOpenNode);
  onOpenRef.current = onOpenNode;

  const dark = useDarkMode();
  const [layoutRunning, setLayoutRunning] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  themeRef.current = dark ? DARK : LIGHT;

  // Build graph + renderer whenever the data changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const graph = createRemGraph(data, centerId);
    graphRef.current = graph;
    hoveredRef.current = null;
    selectedRef.current = centerId ?? null;

    const sigma = new Sigma(graph, container, {
      allowInvalidContainer: true,
      zIndex: true,
      hideEdgesOnMove: graph.size > 20000,
      labelRenderedSizeThreshold: compact ? 4 : 7,
      labelDensity: compact ? 1 : 0.6,
      labelFont: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      labelSize: 12,
      stagePadding: compact ? 36 : 30,
      minCameraRatio: 0.02,
      maxCameraRatio: 20,
      defaultDrawNodeHover: (ctx, d, settings) => drawHover(ctx, d, settings, themeRef.current),
      nodeReducer: (node, attrs) => {
        const theme = themeRef.current;
        const focus = hoveredRef.current ?? selectedRef.current;
        if (!focus) return attrs;
        if (node === focus) return { ...attrs, highlighted: true, zIndex: 2, forceLabel: true };
        if (graph.areNeighbors(node, focus)) return { ...attrs, zIndex: 1, forceLabel: !compact };
        if (hoveredRef.current) return { ...attrs, color: theme.dimmedNode, label: '', zIndex: 0 };
        return attrs;
      },
      edgeReducer: (edge, attrs) => {
        const theme = themeRef.current;
        const base = attrs.kind === 'reference' ? theme.referenceEdge : theme.edge;
        const focus = hoveredRef.current;
        if (focus) {
          const touches = graph.extremities(edge).includes(focus);
          return { ...attrs, color: touches ? base : theme.dimmedEdge, zIndex: touches ? 1 : 0 };
        }
        return { ...attrs, color: base };
      },
    });
    sigma.setSetting('labelColor', { color: themeRef.current.label });

    sigma.on('enterNode', ({ node }) => {
      hoveredRef.current = node;
      container.style.cursor = 'pointer';
      sigma.refresh({ skipIndexation: true });
    });
    sigma.on('leaveNode', () => {
      hoveredRef.current = null;
      container.style.cursor = '';
      sigma.refresh({ skipIndexation: true });
    });
    sigma.on('clickNode', ({ node }) => onOpenRef.current(node));
    sigma.on('clickStage', () => {
      if (selectedRef.current && selectedRef.current !== centerId) {
        selectedRef.current = centerId ?? null;
        sigma.refresh({ skipIndexation: true });
      }
    });

    sigmaRef.current = sigma;
    const layout = new LayoutRunner(graph, setLayoutRunning);
    layoutRef.current = layout;
    layout.start();

    return () => {
      layout.stop();
      sigma.kill();
      sigmaRef.current = null;
      graphRef.current = null;
      layoutRef.current = null;
    };
  }, [data, centerId, compact]);

  // Theme switch without rebuilding.
  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;
    sigma.setSetting('labelColor', { color: themeRef.current.label });
    sigma.refresh({ skipIndexation: true });
  }, [dark]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const starts: GraphData['nodes'] = [];
    const contains: GraphData['nodes'] = [];
    for (const node of data.nodes) {
      const label = node.label.toLowerCase();
      if (label.startsWith(q)) starts.push(node);
      else if (label.includes(q)) contains.push(node);
      if (starts.length >= MAX_SUGGESTIONS) break;
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [query, data]);

  const focusNode = (nodeId: string) => {
    const sigma = sigmaRef.current;
    if (!sigma) return;
    selectedRef.current = nodeId;
    const pos = sigma.getNodeDisplayData(nodeId);
    if (pos) sigma.getCamera().animate({ x: pos.x, y: pos.y, ratio: 0.4 }, { duration: 500 });
    sigma.refresh({ skipIndexation: true });
    setSuggestionsOpen(false);
  };

  const fit = () => sigmaRef.current?.getCamera().animatedReset({ duration: 400 });
  const toggleLayout = () => {
    const layout = layoutRef.current;
    if (!layout) return;
    if (layout.running) layout.stop();
    else layout.start(4000);
  };
  const zoom = (factor: number) => {
    const camera = sigmaRef.current?.getCamera();
    if (camera) camera.animate({ ratio: camera.ratio / factor }, { duration: 200 });
  };

  return (
    <div className="rg-view">
      <div ref={containerRef} className="rg-canvas" />
      {!compact && (
        <div className="rg-search">
          <input
            type="search"
            placeholder="Search nodes…"
            value={query}
            aria-label="Search nodes"
            onChange={(e) => {
              setQuery(e.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && suggestions[0]) focusNode(suggestions[0].id);
              if (e.key === 'Escape') setSuggestionsOpen(false);
            }}
          />
          {suggestionsOpen && suggestions.length > 0 && (
            <ul className="rg-suggestions" role="listbox">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => focusNode(s.id)} title="Show in graph">
                    {s.label}
                  </button>
                  <button
                    type="button"
                    className="rg-open"
                    onClick={() => onOpenNode(s.id)}
                    title="Open Rem"
                    aria-label={`Open ${s.label}`}
                  >
                    ↗
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="rg-zoom">
        <button type="button" onClick={() => zoom(1.5)} title="Zoom in" aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoom(1 / 1.5)} title="Zoom out" aria-label="Zoom out">−</button>
        <button type="button" onClick={fit} title="Fit graph" aria-label="Fit graph">⤢</button>
        <button
          type="button"
          onClick={toggleLayout}
          title={layoutRunning ? 'Stop layout' : 'Continue layout'}
          aria-label={layoutRunning ? 'Stop layout' : 'Continue layout'}
          className={layoutRunning ? 'rg-active' : undefined}
        >
          {layoutRunning ? '❚❚' : '▶'}
        </button>
      </div>
      {data.nodes.length === 0 && <div className="rg-empty">Nothing to show with these filters.</div>}
    </div>
  );
}

function drawHover(
  ctx: CanvasRenderingContext2D,
  d: { x: number; y: number; size: number; label?: string | null; color: string },
  settings: { labelSize: number; labelFont: string; labelWeight: string },
  theme: Theme
) {
  const size = settings.labelSize;
  ctx.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
  const label = d.label ?? '';
  const pad = 4;
  const textWidth = label ? ctx.measureText(label).width : 0;
  const h = size + pad * 2;
  const x = d.x - d.size - 2;
  const y = d.y - h / 2;
  const w = textWidth ? d.size * 2 + textWidth + pad * 3 + 2 : d.size * 2 + 4;

  ctx.fillStyle = theme.hoverBg;
  ctx.strokeStyle = theme.hoverBorder;
  ctx.lineWidth = 1;
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  const r = Math.min(h / 2, 6);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();

  ctx.fillStyle = d.color;
  ctx.beginPath();
  ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
  ctx.fill();

  if (label) {
    ctx.fillStyle = theme.label;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, d.x + d.size + pad + 2, d.y);
  }
}
