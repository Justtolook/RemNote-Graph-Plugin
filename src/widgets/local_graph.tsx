import { useRef, useState, useEffect } from 'react';
import { renderWidget, usePlugin, useTrackerPlugin } from '@remnote/plugin-sdk';
import { GraphPanel } from '../components/GraphPanel';
import '../style.css';

const MISSING_RELOAD_COOLDOWN_MS = 10_000;

/** Right sidebar: neighbourhood of the Rem you are working in. Follows focus. */
export const LocalGraph = () => {
  const plugin = usePlugin();
  const current = useTrackerPlugin(async (p) => {
    const focused = await p.focus.getFocusedRem();
    if (focused) return focused._id;
    const panes = await p.window.getOpenPaneRemIds().catch(() => [] as string[]);
    return panes[0];
  }, []);

  // Keep showing the last Rem when focus leaves the editor (e.g. clicking into this sidebar).
  const [centerRemId, setCenterRemId] = useState<string>();
  useEffect(() => {
    if (current) setCenterRemId(current);
  }, [current]);

  const lastMissingReload = useRef(0);
  const onMissingCenter = (reload: () => void, loadedAt: number) => {
    const now = Date.now();
    if (now - loadedAt > MISSING_RELOAD_COOLDOWN_MS && now - lastMissingReload.current > MISSING_RELOAD_COOLDOWN_MS) {
      lastMissingReload.current = now;
      reload();
    }
  };

  if (!centerRemId) {
    return <div className="rg-message">Open or click into a Rem to see its local graph.</div>;
  }
  return (
    <GraphPanel plugin={plugin} variant="sidebar" centerRemId={centerRemId} onMissingCenter={onMissingCenter} />
  );
};

renderWidget(LocalGraph);
