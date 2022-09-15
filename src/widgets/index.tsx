import { declareIndexPlugin, ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../App.css';

async function onActivate(plugin: ReactRNPlugin) {
  
  // Register a sidebar widget.
  await plugin.app.registerWidget('graph', WidgetLocation.Popup, {
    dimensions: { height: 1000, width: 1000 },
  });
  
  // Register a command.
  await plugin.app.registerCommand({
    id: 'graph',
    name: 'Open Graph',
    action: async () => {
      plugin.widget.openPopup('graph');
    },
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
