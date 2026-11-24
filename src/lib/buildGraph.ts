import { referencedRemIds, richTextToPlain, truncate } from './richText';

/** The subset of a RemNote Rem that the graph needs. Plain data, so it is easy to test. */
export interface RawRem {
  id: string;
  parent: string | null;
  children?: string[];
  text?: unknown;
  backText?: unknown;
  /** RemType from the SDK. 6 = portal. */
  type?: number;
}

export type GraphMode = 'documents' | 'all';
export type EdgeKind = 'hierarchy' | 'reference';

export interface BuildOptions {
  mode: GraphMode;
  /** Ids of Rems that are documents. Only used in `documents` mode. */
  documentIds: ReadonlySet<string>;
  /** Rems whose whole subtree is left out (powerups, optionally daily documents). */
  excludedRootIds: ReadonlySet<string>;
  hierarchy: boolean;
  references: boolean;
  hideOrphans: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  /** Number of Rems collapsed into this node (documents mode), 1 otherwise. */
  remCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: EdgeKind;
  /** How many Rem-level links were merged into this edge. */
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Maps every included Rem id to the id of the node that represents it. */
  nodeOf: Map<string, string>;
}

const PORTAL_TYPE = 6;
const LABEL_MAX = 60;
export const UNTITLED = 'Untitled';

export const DEFAULT_OPTIONS: Omit<BuildOptions, 'documentIds' | 'excludedRootIds'> = {
  mode: 'documents',
  hierarchy: true,
  references: true,
  hideOrphans: false,
};

export function buildGraph(rems: readonly RawRem[], options: BuildOptions): GraphData {
  const byId = new Map<string, RawRem>();
  for (const rem of rems) byId.set(rem.id, rem);

  // --- exclusion: a Rem is excluded if it, or any ancestor, is an excluded root or a portal.
  const excludedMemo = new Map<string, boolean>();
  const isExcluded = (id: string): boolean => {
    const path: string[] = [];
    let current: string | null = id;
    let result = false;
    const seen = new Set<string>();
    while (current !== null) {
      const memo = excludedMemo.get(current);
      if (memo !== undefined) {
        result = memo;
        break;
      }
      const rem = byId.get(current);
      if (!rem || seen.has(current)) break; // unknown parent or a cycle: treat as root
      seen.add(current);
      path.push(current);
      if (options.excludedRootIds.has(current) || rem.type === PORTAL_TYPE) {
        result = true;
        break;
      }
      current = rem.parent;
    }
    for (const p of path) excludedMemo.set(p, result);
    return result;
  };

  // --- representative node of a Rem: itself, or (documents mode) its nearest document ancestor.
  const repMemo = new Map<string, string>();
  const representative = (id: string): string => {
    if (options.mode === 'all') return id;
    const path: string[] = [];
    let current: string = id;
    let result: string | undefined;
    const seen = new Set<string>();
    for (;;) {
      const memo = repMemo.get(current);
      if (memo !== undefined) {
        result = memo;
        break;
      }
      path.push(current);
      seen.add(current);
      if (options.documentIds.has(current)) {
        result = current;
        break;
      }
      const parent = byId.get(current)?.parent ?? null;
      if (parent === null || !byId.has(parent) || seen.has(parent)) {
        // No document above it: the top-level Rem stands in for the document.
        result = current;
        break;
      }
      current = parent;
    }
    for (const p of path) repMemo.set(p, result);
    return result;
  };

  const plainMemo = new Map<string, string>();
  const plainText = (id: string): string => {
    let text = plainMemo.get(id);
    if (text === undefined) {
      // References inside labels are resolved one level deep, without recursion.
      text = richTextToPlain(byId.get(id)?.text, (refId) =>
        richTextToPlain(byId.get(refId)?.text) || undefined
      );
      plainMemo.set(id, text);
    }
    return text;
  };

  const nodeOf = new Map<string, string>();
  const remCount = new Map<string, number>();
  for (const rem of rems) {
    if (isExcluded(rem.id)) continue;
    if (options.mode === 'all' && !plainText(rem.id) && !(rem.children && rem.children.length)) {
      continue; // empty bullets only add noise
    }
    const node = representative(rem.id);
    nodeOf.set(rem.id, node);
    remCount.set(node, (remCount.get(node) ?? 0) + 1);
  }

  const edges = new Map<string, GraphEdge>();
  const addEdge = (a: string, b: string, kind: EdgeKind) => {
    if (a === b) return;
    const [source, target] = a < b ? [a, b] : [b, a];
    const key = source + '|' + target;
    const existing = edges.get(key);
    if (existing) {
      existing.weight++;
      if (kind === 'hierarchy') existing.kind = 'hierarchy';
    } else {
      edges.set(key, { source, target, kind, weight: 1 });
    }
  };

  for (const rem of rems) {
    const from = nodeOf.get(rem.id);
    if (from === undefined) continue;
    if (options.hierarchy && rem.parent !== null) {
      const parentNode = nodeOf.get(rem.parent);
      if (parentNode !== undefined) addEdge(parentNode, from, 'hierarchy');
    }
    if (options.references) {
      const targets = new Set([...referencedRemIds(rem.text), ...referencedRemIds(rem.backText)]);
      for (const target of targets) {
        const to = nodeOf.get(target);
        if (to !== undefined) addEdge(from, to, 'reference');
      }
    }
  }

  const edgeList = [...edges.values()];
  let nodeIds = [...remCount.keys()];
  if (options.hideOrphans) {
    const connected = new Set<string>();
    for (const e of edgeList) {
      connected.add(e.source);
      connected.add(e.target);
    }
    nodeIds = nodeIds.filter((id) => connected.has(id));
    for (const [remId, node] of nodeOf) if (!connected.has(node)) nodeOf.delete(remId);
  }

  const nodes = nodeIds.map((id) => ({
    id,
    label: truncate(plainText(id), LABEL_MAX) || UNTITLED,
    remCount: remCount.get(id) ?? 1,
  }));

  return { nodes, edges: edgeList, nodeOf };
}

/** Nodes within `depth` hops of `centerId` (inclusive), and the edges between them. */
export function neighborhood(data: GraphData, centerId: string, depth: number): GraphData {
  const adjacency = new Map<string, string[]>();
  for (const e of data.edges) {
    (adjacency.get(e.source) ?? adjacency.set(e.source, []).get(e.source)!).push(e.target);
    (adjacency.get(e.target) ?? adjacency.set(e.target, []).get(e.target)!).push(e.source);
  }
  const keep = new Set<string>();
  if (data.nodes.some((n) => n.id === centerId)) {
    keep.add(centerId);
    let frontier = [centerId];
    for (let d = 0; d < depth && frontier.length; d++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const nb of adjacency.get(id) ?? []) {
          if (!keep.has(nb)) {
            keep.add(nb);
            next.push(nb);
          }
        }
      }
      frontier = next;
    }
  }
  const nodeOf = new Map<string, string>();
  for (const [remId, node] of data.nodeOf) if (keep.has(node)) nodeOf.set(remId, node);
  return {
    nodes: data.nodes.filter((n) => keep.has(n.id)),
    edges: data.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    nodeOf,
  };
}
