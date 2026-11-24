import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import type { GraphData } from './buildGraph';

/** Colour-blind friendly categorical palette (Okabe-Ito + Tableau extensions). */
export const COMMUNITY_COLORS = [
  '#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#76b7b2',
  '#edc948', '#ff9da7', '#9c755f', '#56b4e9', '#009e73', '#d55e00',
];
export const OTHER_COLOR = '#9aa0a6';

export interface NodeAttributes {
  x: number;
  y: number;
  size: number;
  label: string;
  color: string;
  community: number;
}

export interface EdgeAttributes {
  kind: 'hierarchy' | 'reference';
  size: number;
}

export type RemGraph = Graph<NodeAttributes, EdgeAttributes>;

export function createRemGraph(data: GraphData, centerId?: string): RemGraph {
  const graph: RemGraph = new Graph({ type: 'undirected', multi: false, allowSelfLoops: false });
  const n = Math.max(data.nodes.length, 1);
  const radius = Math.sqrt(n) * 10;

  data.nodes.forEach((node, i) => {
    // Phyllotaxis start positions: deterministic and well spread, so the layout converges fast.
    const angle = i * 2.399963;
    const r = radius * Math.sqrt((i + 0.5) / n);
    graph.addNode(node.id, {
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
      size: 1,
      label: node.label,
      color: OTHER_COLOR,
      community: -1,
    });
  });
  for (const e of data.edges) {
    if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
      graph.mergeEdge(e.source, e.target, {
        kind: e.kind,
        size: Math.min(1 + Math.log2(e.weight), 4),
      });
    }
  }

  graph.forEachNode((id) => {
    graph.setNodeAttribute(id, 'size', Math.min(3 + Math.sqrt(graph.degree(id)) * 1.6, 22));
  });
  if (centerId && graph.hasNode(centerId)) {
    graph.updateNodeAttribute(centerId, 'size', (s) => Math.max(s ?? 0, 12));
  }

  colorByCommunity(graph);
  return graph;
}

function colorByCommunity(graph: RemGraph) {
  if (graph.size === 0) return;
  const communities = louvain(graph, { randomWalk: false });
  // Biggest communities get the distinct colours, tiny ones share the neutral one.
  const sizes = new Map<number, number>();
  for (const c of Object.values(communities)) sizes.set(c, (sizes.get(c) ?? 0) + 1);
  const ranked = [...sizes.entries()].filter(([, s]) => s > 1).sort((a, b) => b[1] - a[1]);
  const colorOf = new Map<number, string>();
  ranked.slice(0, COMMUNITY_COLORS.length).forEach(([c], i) => colorOf.set(c, COMMUNITY_COLORS[i]));
  graph.forEachNode((id) => {
    const c = communities[id];
    graph.mergeNodeAttributes(id, { community: c, color: colorOf.get(c) ?? OTHER_COLOR });
  });
}

/**
 * Runs ForceAtlas2 in small slices on animation frames so the UI stays responsive and the
 * user watches the graph settle. No web worker: plugin iframes are sandboxed and workers
 * from blob URLs are not reliable there.
 */
export class LayoutRunner {
  private frame: number | undefined;
  private stopAt = 0;
  private readonly settings: ReturnType<typeof forceAtlas2.inferSettings>;

  constructor(private readonly graph: RemGraph, private readonly onStateChange?: (running: boolean) => void) {
    const inferred = forceAtlas2.inferSettings(graph);
    this.settings = {
      ...inferred,
      barnesHutOptimize: graph.order > 800,
      gravity: 1,
      scalingRatio: 10,
      slowDown: 1 + Math.log(Math.max(graph.order, 1)),
      adjustSizes: false,
    };
  }

  get running() {
    return this.frame !== undefined;
  }

  /** Runs for a time budget that grows with graph size (between 1.5 and 12 seconds). */
  start(durationMs = Math.min(1500 + this.graph.order * 1.5, 12000)) {
    if (this.graph.order < 2) return;
    this.stopAt = performance.now() + durationMs;
    if (this.frame === undefined) {
      this.onStateChange?.(true);
      this.tick();
    }
  }

  stop() {
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
      this.frame = undefined;
      this.onStateChange?.(false);
    }
  }

  private tick = () => {
    const sliceEnd = performance.now() + 12;
    // One iteration on a big graph can take longer than a frame; always do at least one.
    do {
      forceAtlas2.assign(this.graph, { iterations: 1, settings: this.settings });
    } while (performance.now() < sliceEnd);
    if (performance.now() >= this.stopAt) {
      this.frame = undefined;
      this.onStateChange?.(false);
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };
}
