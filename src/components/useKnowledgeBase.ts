import { useCallback, useEffect, useRef, useState } from 'react';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { loadKnowledgeBase, type KnowledgeBaseSnapshot } from '../lib/remnote';

export interface KnowledgeBaseState {
  snapshot?: KnowledgeBaseSnapshot;
  loading: boolean;
  error?: string;
  reload: () => void;
}

/** Loads the knowledge base once on mount and on demand. Overlapping reloads are coalesced. */
export function useKnowledgeBase(plugin: RNPlugin): KnowledgeBaseState {
  const [snapshot, setSnapshot] = useState<KnowledgeBaseSnapshot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const reload = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(undefined);
    loadKnowledgeBase(plugin)
      .then((s) => mounted.current && setSnapshot(s))
      .catch((e: unknown) => mounted.current && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        inFlight.current = false;
        if (mounted.current) setLoading(false);
      });
  }, [plugin]);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  return { snapshot, loading, error, reload };
}
