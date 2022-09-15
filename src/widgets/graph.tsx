import { usePlugin, renderWidget, useTracker } from '@remnote/plugin-sdk';
import graph from 'ngraph.graph';
//require the viva graph library
var Viva = require('vivagraphjs');

export const Graph = () => {
  const plugin = usePlugin();
  const allRem: Rem[] | undefined = useTracker(
    async (reactivePlugin) => await reactivePlugin.rem.getAll()
  );

  var g = Viva.Graph.graph();
  g.addNode('Hello');
  g.addNode('World');
  g.addNode('!');
  g.addLink('Hello', 'World');

  
  if(allRem) {
  allRem?.forEach((rem) => {
    if(rem._id !== undefined) {
      //console.log(rem._id);
      //console.log(JSON.stringify(rem));
      g.addNode(rem._id);
      if(rem.children) {
        rem.children.forEach((child) => {
          g.addNode(child);
          g.addLink(rem._id, child, 'child');
        });
      }
      if(rem.parents) {
        rem.parents.forEach((parent) => {
          g.addNode(parent); 
          g.addLink(rem._id, parent, 'parent');
        });
    }
    }
  });
  }
  else {
    return <div>loading all rem</div>;
  }
  

  
  var renderer = Viva.Graph.View.renderer(g, {
    container: document.getElementById('graphDiv'),
    graphics: Viva.Graph.View.webglGraphics(),
    layout: Viva.Graph.Layout.forceDirected(g, {
      springLength: 30,
      springCoeff: 0.0008,
      dragCoeff: 0.02,
      gravity: -1.2,
    }),
  });
  renderer.run();

  return (
    <div>
      <h1>Graph</h1>
      
      <p>Number of nodes: {g.getNodesCount()}</p>
      <p>Number of links: {g.getLinksCount()}</p>
    </div>
  );

 
};


renderWidget(Graph);
