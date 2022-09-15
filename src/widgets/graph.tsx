import { usePlugin, renderWidget, useTracker } from '@remnote/plugin-sdk';
import graph from 'ngraph.graph';


//require the viva graph library
var Viva = require('vivagraphjs');


var graphBody;
var graphInfo;
var selRemInfo;
var layout;
var g = Viva.Graph.graph();
const referenceEdges = true;

var iterations = 200;
  

export const Graph = () => {
  const plugin = usePlugin();
  const allRem: Rem[] | undefined = useTracker(
    async (reactivePlugin) => await reactivePlugin.rem.getAll()
  );

  
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

  layout = Viva.Graph.Layout.forceDirected(g, {
    springLength : 30,
    springCoeff : 0.0008,
    dragCoeff : 0.01,
    gravity : -1.2,
    theta : 1
  });

  //async function to get rem.text from plugin.rem.findOne(_id)
  async function getRemText(_id: string) {
    const rem = await plugin.rem.findOne(_id);
    const remRichText = rem?.text;
    
    if(remRichText) {
      var remText = await plugin.richText.toString(remRichText)
      //limit the length of the text to 100 characters
      if(remText.length > 100) {
        remText = remText.substring(0, 100) + '...';
      }

      return remText;
    }
    else {
      return 'undefined';
    }
  }

  
  

  /*
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
*/
 

  //check if there is already a div with the id graph-body
  if(document.getElementById('graph-body') === null) {
    graphBody = document.body.appendChild(document.createElement('div'));
    graphBody.id = 'graph-body'
    //set the class 
    graphBody.className = 'graph-body';
    graphInfo = graphBody.appendChild(document.createElement('div'));
    graphInfo.id = 'graph-info'
    graphInfo.className = 'graph-info'
    selRemInfo = graphBody.appendChild(document.createElement('div'));
    selRemInfo.id = 'sel-rem-info';
    selRemInfo.className = 'sel-rem-info';
    selRemInfo.innerText = 'Hover over a rem to see its info';
  }
  else {
    graphBody = document.getElementById('graph-body');
    graphInfo = document.getElementById('graph-info');
    selRemInfo = document.getElementById('sel-rem-info');
  }


  
  //document.body.appendChild(document.createElement('div')).id = 'graph-info';

  precompute(renderGraph);

  function precompute(callback) {
    //graphInfo.innerText = 'Iterations remaining: ' + iterations;
    // let's run 10 iterations per event loop cycle:
    var i = 0;
    while (iterations > 0 && i < 5) {
      layout.step();
      iterations--;
      i++;
    }
    graphInfo.innerText = 'Iterations remaining: ' + iterations;
    //graphInfo.innerText = 'Iterations remaining: ' + iterations;
    if (iterations > 0) {
      setTimeout(function () {
          precompute(callback);
      }, 0); // keep going in next even cycle
    } else {
      // we are done!
      callback();
    }
  }
  
  function renderGraph() {
    var graphics = Viva.Graph.View.webglGraphics();
    var events = Viva.Graph.webglInputEvents(graphics, graph);

    events.mouseEnter(function (node) {
      console.log('Mouse entered node: ' + node.id);
      getRemText(node.id).then((text) => {selRemInfo.innerText = 'Rem ID: ' + node.id + '\n' + 'Rem Text: ' + text});
      //selRemInfo.innerText = 'Rem ID: ' + node.id + '\n' + 'Rem Text: ' + getRemText(node.id).then();
      });
    events.mouseLeave(function (node) {
      console.log('Mouse left node: ' + node.id);
      selRemInfo.innerText = 'Rem ID: ...\n' + 'Rem Text: ...';
      });
  
    var renderer = Viva.Graph.View.renderer(g, {
        layout   : layout,
        graphics   : graphics,
        renderLinks : true,
        prerender  : true
      });
  
    renderer.run();
  
    // Final bit: most likely graph will take more space than available
    // screen. Let's zoom out to fit it into the view:
    var graphRect = layout.getGraphRect();
    var graphSize = Math.min(graphRect.x2 - graphRect.x1, graphRect.y2 - graphRect.y1);
    var screenSize = 1000;
  
    var desiredScale = screenSize / graphSize;
    zoomOut(desiredScale, 1);
  
    function zoomOut(desiredScale, currentScale) {
      if (desiredScale < currentScale) {
        currentScale = renderer.zoomOut();
        setTimeout(function () {
            zoomOut(desiredScale, currentScale);
        }, 16);
      }
    }
    renderer.pause();
  }

  function addIterations(nIterations) {
    if(iterations > 0) {
      iterations += nIterations;
    }
    else {
      iterations = nIterations;
      precompute(renderGraph);
    }
  }








  return (
    <div class="graph-body" id="graph-body">
      <h1>Graph</h1>
      <p>Number of nodes: {g.getNodesCount()}</p>
      <p>Number of links: {g.getLinksCount()}</p>
      <button class="btn" onClick={() => addIterations(20)}>Add iterations</button>
    </div>
  );

 
};






renderWidget(Graph);
