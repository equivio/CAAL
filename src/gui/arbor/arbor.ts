/*libs Jquery, graphics is needed.*/
/// <reference path="../../../lib/jquery.d.ts" />
/// <reference path="../../../lib/arbor.d.ts" />
/// <reference path="renderer.ts" />
/// <reference path="handler.ts" />
/// <reference path="../gui.ts" />

module GUI {

    export class ArborGraph implements GUI.ProcessGraphUI {
        private sys : ParticleSystem;
        private renderer : Renderer;
        private handler : Handler;
        private highlightedEdges : Edge[] = [];
        private selectedNode : Node;
        private graphNodes : {p: Node | undefined, q: Node | undefined, qSet: Node[] | undefined, qStarSet: Node[] | undefined} = Object.create(null);
        private selectedForChallenge : Node[] = [];

        constructor(renderer, options = {repulsion: 400, stiffness: 800, friction: 0.5, integrator: "verlet"}) {
            this.sys = arbor.ParticleSystem(options);
            this.sys.parameters({gravity:true});
            this.renderer = renderer;
            this.sys.renderer = renderer;
            this.handler = new Handler(renderer);
        }

        public showProcess(nodeId : string, data : Object) : void {
            var node = this.sys.getNode(nodeId);
            if (node) {
                node.data = data;
            } else {
                this.sys.addNode(nodeId, data);
            }
        }

        public getProcessDataObject(nodeId : string) : Object {
            var node = this.sys.getNode(nodeId),
                data = node ? node.data : null;
            return data;
        }

        public getNode(name : string) : Node {
            return this.sys.getNode(name);
        }

        public getPosition(name : string) : Point {
            return this.sys.toScreen(this.getNode(name).p);
        }

        public showTransitions(fromId : string, toId : string, datas : Object[]) {
            var edges = this.sys.getEdges(fromId, toId),
                edge = edges.length > 0 ? edges[0] : null;
            if (edge) {
                edge.data.datas = datas;
            } else {
                this.sys.addEdge(fromId, toId, {datas: datas});
            }
        }

        public unselectGraphNodes(){
            if(!this.graphNodes) return;
            
            if (this.graphNodes.p){
                this.graphNodes.p.data.status = "expanded";
            }
            if(this.graphNodes.q){
                this.graphNodes.q.data.status = "expanded";
            }
            else{
                if(this.graphNodes.qSet){
                    this.graphNodes.qSet.forEach((node) => {
                        node.data.status = "expanded";
                    })
                }
                if(this.graphNodes.qStarSet){
                    this.graphNodes.qStarSet.forEach((node) => {
                        node.data.status = "expanded";
                    })
                }
            }
            this.graphNodes = {p: undefined, q: undefined, qSet: undefined, qStarSet: undefined};
        }

        public setGraphNodes(names : {p: string, q: string | undefined, qSet: string[] | undefined, qStarSet: string[] | undefined}){
            if(!names) return;

            this.unselectGraphNodes();

            let pNode = this.sys.getNode(names.p);
            if(pNode){
                pNode.data.status = ["selectedAsP"];
                this.graphNodes.p = pNode;
            }

            if(names.q){
                let newNode = this.sys.getNode(names.q);
                if(newNode){
                    if (!(typeof newNode.data.status === "string")){
                        newNode.data.status.push("selectedAsSingleQ");
                    }
                    else{
                        newNode.data.status = ["selectedAsSingleQ"];
                    }
                    this.graphNodes.q = newNode;
                }
            }
            else{
                if(names.qStarSet){
                    let initialized = false;
                    names.qStarSet.forEach((name) => {
                        let newNode = this.sys.getNode(name);
                        if(newNode){
                            if(!initialized){
                                this.graphNodes.qStarSet = [];
                                initialized = true;
                            }
                            if (!(typeof newNode.data.status === "string")){
                                newNode.data.status.push("selectedAsQStar");
                            }
                            else{
                                newNode.data.status = ["selectedAsQStar"];
                            }
                            this.graphNodes.qStarSet!.push(newNode);
                        }
                    })
                }
                if(names.qSet){
                    let initialized = false;
                    names.qSet.forEach((name) => {
                        let newNode = this.sys.getNode(name);
                        if(newNode){
                            if(!initialized){
                                this.graphNodes.qSet = [];
                                initialized = true;
                            }
                            if (!(typeof newNode.data.status === "string")){
                                newNode.data.status.push("selectedAsQ");
                            }
                            else{
                                newNode.data.status = ["selectedAsQ"];
                            }
                            this.graphNodes.qSet!.push(newNode);
                        }
                    })
                }
            }

            this.renderer.redraw();
        }

        public toggleSelectForChallenge(name: string) : boolean {
            let newNode = this.sys.getNode(name);
            let index = this.selectedForChallenge.indexOf(newNode); // pointer comparison should be correct
            let statusIndex = newNode.data.status[0] === "selectedAsP" ? 1 : 0;
            if (index > -1) {
                // deselect
                this.selectedForChallenge.splice(index, 1);
                newNode.data.status[statusIndex] = "selectedAsQ";
                this.renderer.redraw();
                return false;
            }
            // else select

            newNode.data.status[statusIndex] = "selectedForChallenge";
            this.selectedForChallenge.push(newNode);
            this.renderer.redraw();
            return true;
        }

        public setSelected(name: string) {
            if(!name) return;
            var newSelectedNode = this.sys.getNode(name);

            if(this.selectedNode && newSelectedNode) {
                this.selectedNode.data.status = "expanded";
            }

            if(newSelectedNode) {
                this.selectedNode = newSelectedNode;
                this.selectedNode.data.status = 'selected';
            }
            this.renderer.redraw();
        }

        public getSelected() : string {
            return this.selectedNode.name;
        }

        public highlightToNode(name : string) : void {
            var node = this.sys.getNode(name);
            if (this.selectedNode && node) {
                this.highlightEdgeNodes(this.selectedNode, node);
            }
        }

        public clearHighlights() : void {
            while(this.highlightedEdges.length > 0) {
                var edge = this.highlightedEdges.pop();
                edge.data.highlight = false;
            }
            this.renderer.redraw();
        }

        public highlightEdge(from : string, to : string) {
            var fromNode = this.sys.getNode(from);
            var toNode = this.sys.getNode(to);
            if (fromNode && toNode) {
                this.highlightEdgeNodes(fromNode, toNode);
            }
        }

        private highlightEdgeNodes(from : Node, to : Node) {
            var edges = this.sys.getEdges(from, to);
            for (var i = 0; i < edges.length; i++){
                edges[i].data.highlight = true;
                this.highlightedEdges.push(edges[i]);
            }
            this.renderer.redraw();
        }

        public getTransitionDataObjects(fromId : string, toId : string) : Object[] {
            var edges = this.sys.getEdges(fromId, toId),
                edge = edges.length > 0 ? edges[0] : null,
                datas = edge && edge.data ? edge.data.datas : null;
            return datas;
        }

        /* Event handling */
        public setOnSelectListener(f : (identifier : string) => void) : void {
            this.handler.onClick = (nodeId) => {
                f(nodeId);
            };
        }

        public clearOnSelectListener() : void {
            this.handler.onClick = null;
        }

        public setOnEdgeSelectListener(f : (edge : any) => void) : void {
            this.handler.onEdgeClick = (edge) => {
                f(edge);
            };
        }

        public clearOnEdgeSelectListener() : void {
            this.handler.onEdgeClick = null;
        }


        public setHoverOnListener(f : (identifier : string) => void) : void {
            this.handler.onHover = f
        }

        public clearHoverOutListener() : void {
            this.handler.onHover = null;
        }

        public setHoverOutListener(f : (identifier : string) => void) : void {
            this.handler.onHoverOut = f
        }

        public clearHoverOnListener() : void {
            this.handler.onHoverOut = null;
        }

        public setEdgeHoverOnListener(f : (edge) => void ) : void {
            this.handler.onEdgeHover = f;
        }

        public clearEdgeHoverOnListener() : void {
            this.handler.onEdgeHover = null;
        }

        public setEdgeHoverOutListener(f : (edge) => void ) : void {
            this.handler.onEdgeHoverOut = f;
        }

        public clearEdgeHoverOutListener() : void {
            this.handler.onEdgeHoverOut = null;
        }

        public clearAll() : void {
            this.sys.prune((node, from, to) => true);
        }

        public freeze() : void {
            this.sys.stop();
        }

        public unfreeze() : void {
            this.sys.start(true);
        }

        public bindCanvasEvents() : void { 
            this.handler.bindCanvasEvents();
        }

        public unbindCanvasEvents() : void {
            this.handler.unbindCanvasEvents();
        }
    }
}
