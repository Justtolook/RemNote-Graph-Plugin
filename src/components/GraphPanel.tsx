import { useEffect, useMemo } from 'react';
import { useSyncedStorageState, type RNPlugin } from '@remnote/plugin-sdk';
import { buildGraph, DEFAULT_OPTIONS, neighborhood, type GraphMode } from '../lib/buildGraph';
import { openRem } from '../lib/remnote';
import { GraphView } from './GraphView';
import { useKnowledgeBase } from './useKnowledgeBase';

export interface GraphSettings {
  mode: GraphMode;
  hierarchy: boolean;
  references: boolean;
  hideOrphans: boolean;
  hideDailyDocuments: boolean;
  depth: number;
}

export const DEFAULT_SETTINGS: GraphSettings = {
  ...DEFAULT_OPTIONS,
  hideDailyDocuments: false,
  depth: 1,
};

const LARGE_GRAPH = 25000;

interface Props {
  plugin: RNPlugin;
  /** Popup is the large view, sidebar the compact one. */
  variant: 'popup' | 'sidebar';
  /** Rem to centre on. Without it the popup shows everything. */
  centerRemId?: string;
  /** Called when the focused Rem is not in the loaded snapshot (e.g. it was just created). */
  onMissingCenter?: (reload: () => void, loadedAt: number) => void;
}

export function GraphPanel({ plugin, variant, centerRemId, onMissingCenter }: Props) {
  const compact = variant === 'sidebar';
  const [stored, setStored] = useSyncedStorageState<Partial<GraphSettings>>(
    compact ? 'local-graph-settings' : 'graph-settings',
    {}
  );
  const settings: GraphSettings = { ...DEFAULT_SETTINGS, ...stored };
  const update = (patch: Partial<GraphSettings>) => setStored({ ...settings, ...patch });

  const { snapshot, loading, error, reload } = useKnowledgeBase(plugin);

  const full = useMemo(() => {
    if (!snapshot) return undefined;
    const excludedRootIds = new Set(snapshot.powerupIds);
    if (settings.hideDailyDocuments) snapshot.dailyDocumentIds.forEach((id) => excludedRootIds.add(id));
    return buildGraph(snapshot.rems, {
      mode: settings.mode,
      hierarchy: settings.hierarchy,
      references: settings.references,
      hideOrphans: settings.hideOrphans && !centerRemId,
      documentIds: snapshot.documentIds,
      excludedRootIds,
    });
  }, [
    snapshot,
    settings.mode,
    settings.hierarchy,
    settings.references,
    settings.hideOrphans,
    settings.hideDailyDocuments,
    centerRemId,
  ]);

  const centerNodeId = centerRemId ? full?.nodeOf.get(centerRemId) : undefined;
  const centerMissing = Boolean(full && centerRemId && !centerNodeId && snapshot && !loading);
  useEffect(() => {
    if (centerMissing && snapshot) onMissingCenter?.(reload, snapshot.loadedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerMissing, centerRemId]);

  const data = useMemo(() => {
    if (!full) return undefined;
    if (!centerRemId) return full;
    if (!centerNodeId) return { nodes: [], edges: [], nodeOf: new Map<string, string>() };
    return neighborhood(full, centerNodeId, settings.depth);
  }, [full, centerRemId, centerNodeId, settings.depth]);

  const onOpenNode = (nodeId: string) => void openRem(plugin, nodeId, variant === 'popup');

  return (
    <div className={`rg-panel ${compact ? 'rg-compact' : ''}`}>
      <div className="rg-toolbar">
        {!compact && <h1 className="rg-title">{centerRemId ? 'Local graph' : 'Graph'}</h1>}
        <select
          value={settings.mode}
          onChange={(e) => update({ mode: e.target.value as GraphMode })}
          aria-label="Node granularity"
          title="What a node represents"
        >
          <option value="documents">Documents</option>
          <option value="all">All Rems</option>
        </select>
        {centerRemId && (
          <select
            value={settings.depth}
            onChange={(e) => update({ depth: Number(e.target.value) })}
            aria-label="Depth"
            title="How many hops around the current Rem"
          >
            <option value={1}>Depth 1</option>
            <option value={2}>Depth 2</option>
            <option value={3}>Depth 3</option>
          </select>
        )}
        <Toggle label="Hierarchy" checked={settings.hierarchy} onChange={(v) => update({ hierarchy: v })} />
        <Toggle label="References" checked={settings.references} onChange={(v) => update({ references: v })} />
        {!centerRemId && (
          <Toggle label="Hide orphans" checked={settings.hideOrphans} onChange={(v) => update({ hideOrphans: v })} />
        )}
        <Toggle
          label="Hide daily docs"
          checked={settings.hideDailyDocuments}
          onChange={(v) => update({ hideDailyDocuments: v })}
        />
        <span className="rg-spacer" />
        {data && (
          <span className="rg-stats" title="Nodes · links">
            {data.nodes.length.toLocaleString()} · {data.edges.length.toLocaleString()}
          </span>
        )}
        <button type="button" onClick={reload} disabled={loading} title="Reload from your knowledge base">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="rg-message rg-error">Could not load your Rems: {error}</div>}
      {settings.mode === 'all' && data && data.nodes.length > LARGE_GRAPH && (
        <div className="rg-message">
          {data.nodes.length.toLocaleString()} nodes. Switch to “Documents” for a faster, clearer overview.
        </div>
      )}
      {!data && !error && <div className="rg-message">Reading your knowledge base…</div>}
      {data && centerRemId && !centerNodeId && !loading && (
        <div className="rg-message">This Rem is not part of the graph with the current filters.</div>
      )}
      {data && (
        <GraphView data={data} centerId={centerNodeId} onOpenNode={onOpenNode} compact={compact} />
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="rg-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
