import { renderWidget, usePlugin, useRunAsync, WidgetLocation } from '@remnote/plugin-sdk';
import { GraphPanel } from '../components/GraphPanel';
import '../style.css';

/** Popup: the whole knowledge base, or the neighbourhood of a Rem when opened with one. */
export const GraphPopup = () => {
  const plugin = usePlugin();
  const context = useRunAsync(() => plugin.widget.getWidgetContext<WidgetLocation.Popup>(), []);
  if (!context) return null;
  const centerRemId: string | undefined = context.contextData?.centerRemId;
  return <GraphPanel plugin={plugin} variant="popup" centerRemId={centerRemId} />;
};

renderWidget(GraphPopup);
