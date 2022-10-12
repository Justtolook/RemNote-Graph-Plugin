var Viva = require('vivagraphjs');
var PageRank = require('ngraph.pagerank');
var HITS = require('ngraph.hits');
var CW = require('ngraph.cw');

export class GraphHandler {
    graph: any;
    hits: any;
    pageRank: any;
    DEBUG_MODE = true;

    constructor() {
        this.graph = Viva.Graph.graph();
    }

    graphInfo() {
        return {
            nodes: this.graph.getNodesCount(),
            links: this.graph.getLinksCount()
        }
    }

    async initFullGraph(allRems: any, scope: 'references' | 'hierarchy' | 'all') {
        allRems?.forEach((rem: any) => {
            if (rem._id !== undefined) {
                //console.log(rem._id);
                //console.log(JSON.stringify(rem));
                this.graph.addNode(rem._id);
                if (scope === 'hierarchy' || scope === 'all') {
                    if (rem.children) {
                        rem.children.forEach((child: any) => {
                            this.graph.addNode(child);
                            this.graph.addLink(rem._id, child, 'child');
                        });
                    }
                    if (rem.parents) {
                        rem.parents.forEach((parent: any) => {
                            this.graph.addNode(parent);
                            this.graph.addLink(rem._id, parent, 'parent');
                        });
                    }
                }
                if (scope === 'references' || scope === 'all') {
                    rem.remsBeingReferenced().then((Rrems: any) => {
                        Rrems.forEach((Rrem: any) => {
                            this.graph.addNode(Rrem._id);
                            this.graph.addLink(rem._id, Rrem._id, 'reference');
                            //console.log("new reference edge: " + rem._id + " -> " + Rrem._id);
                        });
                    });
                }
            }
        });
        console.log('finished adding nodes and edges');
        console.log('graph has ' + this.graph.getNodesCount() + ' nodes and ' + this.graph.getLinksCount() + ' links');
        this.computeHITS();
        this.computePageRank();
    }

    debugInfo() {
        console.log('graph has ' + this.graph.getNodesCount() + ' nodes and ' + this.graph.getLinksCount() + ' links');
        if(this.hits) {
            //output the first 20 results of hits
            let hitsArray = [];
            this.graph.forEachNode((node: any) => {
                hitsArray.push([node.id, this.hits[node.id]]);
            }
            );
            hitsArray.sort((a: any, b: any) => {
                return b[1].hub - a[1].hub;
            }
            );
            console.log('HITS:');
            console.log(hitsArray.slice(0, 20));
        }

        if(this.pageRank) {
            //output the first 20 results of pageRank
            let pageRankArray: any[] = [];
            this.graph.forEachNode((node: any) => {
                pageRankArray.push([node.id, this.pageRank[node.id]]);
            }
            );
            pageRankArray.sort((a: any, b: any) => {
                return b[1] - a[1];
            }
            );
            console.log('PageRank:');
            console.log(pageRankArray.slice(0, 20));
        }
    }

    computeLayout(steps: number) {

    }

    computePageRank() {
        this.pageRank = PageRank(this.graph);
    }

    computeHITS() {
        this.hits = HITS(this.graph);
    }

    

    

}
