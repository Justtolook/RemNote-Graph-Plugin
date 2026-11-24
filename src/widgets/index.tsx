import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';

async function onActivate(plugin: ReactRNPlugin) {
  // Height only accepts pixels, so size it from the screen; width accepts CSS units.
  const screenHeight = window.screen?.availHeight || 900;
  await plugin.app.registerWidget('graph', WidgetLocation.Popup, {
    dimensions: { height: Math.max(560, Math.round(screenHeight * 0.8)), width: '92vw' },
  });

  await plugin.app.registerWidget('local_graph', WidgetLocation.RightSidebar, {
    dimensions: { height: 'auto', width: '100%' },
    widgetTabIcon: `${plugin.rootURL}logo.png`,
    widgetTabTitle: 'Local graph',
  });

  await plugin.app.registerCommand({
    id: 'open-graph',
    name: 'Open Graph',
    description: 'Show your whole knowledge base as an interactive graph',
    keywords: 'graph, network, map, links, knowledge graph',
    action: async () => {
      await plugin.widget.openPopup('graph');
    },
  });

  await plugin.app.registerCommand({
    id: 'open-local-graph',
    name: 'Open Local Graph',
    description: 'Show the Rems connected to the current Rem',
    keywords: 'graph, local graph, neighbours, links',
    action: async () => {
      const focused = await plugin.focus.getFocusedRem();
      const centerRemId = focused?._id ?? (await plugin.window.getOpenPaneRemIds())[0];
      if (!centerRemId) {
        await plugin.app.toast('Open a Rem first to see its local graph.');
        return;
      }
      await plugin.widget.openPopup('graph', { centerRemId });
    },
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
