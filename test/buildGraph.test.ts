import { describe, expect, it } from 'vitest';
import { buildGraph, neighborhood, type BuildOptions, type RawRem } from '../src/lib/buildGraph';
import { referencedRemIds, richTextToPlain } from '../src/lib/richText';

const ref = (id: string) => ({ i: 'q', _id: id });

// Knowledge base:
//   docA (document)            docB (document)        powerup (excluded)
//     a1 -> refs docB            b1                     p1
//       a1a -> refs b1 + p1
//   loose (top level, no doc tag)
const rems: RawRem[] = [
  { id: 'docA', parent: null, children: ['a1'], text: ['Doc A'] },
  { id: 'a1', parent: 'docA', children: ['a1a'], text: ['see ', ref('docB')] },
  { id: 'a1a', parent: 'a1', children: [], text: [ref('b1'), ' and ', ref('p1')] },
  { id: 'docB', parent: null, children: ['b1'], text: [{ i: 'm', text: 'Doc B', b: true }] },
  { id: 'b1', parent: 'docB', children: [], text: ['B one'] },
  { id: 'powerup', parent: null, children: ['p1'], text: ['Powerup'] },
  { id: 'p1', parent: 'powerup', children: [], text: ['slot'] },
  { id: 'loose', parent: null, children: [], text: ['Loose'] },
  { id: 'empty', parent: 'docA', children: [], text: [] },
  { id: 'portal', parent: 'docB', children: [], text: [], type: 6 },
];

const base: BuildOptions = {
  mode: 'documents',
  documentIds: new Set(['docA', 'docB']),
  excludedRootIds: new Set(['powerup']),
  hierarchy: true,
  references: true,
  hideOrphans: false,
};

const edgeKeys = (g: ReturnType<typeof buildGraph>) =>
  g.edges.map((e) => `${e.source}-${e.target}:${e.kind}:${e.weight}`).sort();

describe('richText', () => {
  it('extracts referenced ids without duplicates', () => {
    expect(referencedRemIds(['x', ref('a'), ref('b'), ref('a')])).toEqual(['a', 'b']);
    expect(referencedRemIds(undefined)).toEqual([]);
  });
  it('builds plain text and resolves references', () => {
    expect(richTextToPlain(['Hello ', { i: 'm', text: 'world' }, ' ', ref('x')], () => 'X')).toBe(
      'Hello world X'
    );
    expect(richTextToPlain([ref('gone'), { i: 'q', _id: 'y', textOfDeletedRem: ['old'] }])).toBe('old');
  });
});

describe('buildGraph: documents mode', () => {
  const g = buildGraph(rems, base);

  it('collapses Rems into their document and drops powerups and portals', () => {
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['docA', 'docB', 'loose']);
    expect(g.nodeOf.get('a1a')).toBe('docA');
    expect(g.nodeOf.has('p1')).toBe(false);
    expect(g.nodeOf.has('portal')).toBe(false);
    expect(g.nodes.find((n) => n.id === 'docA')?.remCount).toBe(4);
  });

  it('merges Rem-level references into one weighted document edge', () => {
    expect(edgeKeys(g)).toEqual(['docA-docB:reference:2']);
  });

  it('uses rich text for labels', () => {
    expect(g.nodes.find((n) => n.id === 'docB')?.label).toBe('Doc B');
  });

  it('can hide orphans', () => {
    const h = buildGraph(rems, { ...base, hideOrphans: true });
    expect(h.nodes.map((n) => n.id).sort()).toEqual(['docA', 'docB']);
    expect(h.nodeOf.has('loose')).toBe(false);
  });

  it('treats top-level Rems as documents when nothing is tagged', () => {
    const h = buildGraph(rems, { ...base, documentIds: new Set() });
    expect(h.nodes.map((n) => n.id).sort()).toEqual(['docA', 'docB', 'loose']);
  });
});

describe('buildGraph: all mode', () => {
  const g = buildGraph(rems, { ...base, mode: 'all' });

  it('keeps every non-empty Rem as a node', () => {
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['a1', 'a1a', 'b1', 'docA', 'docB', 'loose']);
  });

  it('creates hierarchy and reference edges, hierarchy wins on overlap', () => {
    expect(edgeKeys(g)).toEqual([
      'a1-a1a:hierarchy:1',
      'a1-docA:hierarchy:1',
      'a1-docB:reference:1',
      'a1a-b1:reference:1',
      'b1-docB:hierarchy:1',
    ]);
  });

  it('respects the edge toggles', () => {
    expect(buildGraph(rems, { ...base, mode: 'all', references: false }).edges.every((e) => e.kind === 'hierarchy')).toBe(true);
    expect(buildGraph(rems, { ...base, mode: 'all', hierarchy: false }).edges.every((e) => e.kind === 'reference')).toBe(true);
  });

  it('survives parent cycles and unknown parents', () => {
    const weird: RawRem[] = [
      { id: 'x', parent: 'y', text: ['x'] },
      { id: 'y', parent: 'x', text: ['y'] },
      { id: 'z', parent: 'missing', text: ['z'] },
    ];
    const h = buildGraph(weird, { ...base, mode: 'documents', documentIds: new Set() });
    expect(h.nodes.length).toBeGreaterThan(0);
  });
});

describe('neighborhood', () => {
  const g = buildGraph(rems, { ...base, mode: 'all' });
  it('returns nodes within the given depth', () => {
    expect(neighborhood(g, 'a1a', 1).nodes.map((n) => n.id).sort()).toEqual(['a1', 'a1a', 'b1']);
    expect(neighborhood(g, 'a1a', 2).nodes.map((n) => n.id).sort()).toEqual(['a1', 'a1a', 'b1', 'docA', 'docB']);
  });
  it('is empty for unknown centers', () => {
    expect(neighborhood(g, 'nope', 2).nodes).toEqual([]);
  });
});
