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
        //private rightGraphNodes : Node | Node[] | Node[][];
        private rightGraphNodes : {p: Node | undefined, q: Node | undefined, qSet: Node[] | undefined, qStarSet: Node[] | undefined} = Object.create(null);

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

        public unselectRightGraphNodes(){
            if(!this.rightGraphNodes) return;
            if(this.rightGraphNodes.q){
                this.rightGraphNodes.q.data.status = "expanded";
            }
            else{
                if(this.rightGraphNodes.qSet){
                    this.rightGraphNodes.qSet.forEach((node) => {
                        node.data.status = "expanded";
                    })
                }
                if(this.rightGraphNodes.qStarSet){
                    this.rightGraphNodes.qStarSet.forEach((node) => {
                        node.data.status = "expanded";
                    })
                }
            }
            this.rightGraphNodes = {p: undefined, q: undefined, qSet: undefined, qStarSet: undefined};
        }

        public setRightGraphNodes(names : {p: string, q: string | undefined, qSet: string[] | undefined, qStarSet: string[] | undefined}){
            if(!names) return;

            this.unselectRightGraphNodes();

            let pNode = this.sys.getNode(names.p);
            if(pNode){
                pNode.data.status = ["selectedAsP"];
                this.rightGraphNodes.p = pNode;
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
                    this.rightGraphNodes.q = newNode;
                }
            }
            else{
                if(names.qStarSet){
                    let initialized = false;
                    names.qStarSet.forEach((name) => {
                        let newNode = this.sys.getNode(name);
                        if(newNode){
                            if(!initialized){
                                this.rightGraphNodes.qStarSet = [];
                                initialized = true;
                            }
                            if (!(typeof newNode.data.status === "string")){
                                newNode.data.status.push("selectedAsQStar");
                            }
                            else{
                                newNode.data.status = ["selectedAsQStar"];
                            }
                            this.rightGraphNodes.qStarSet!.push(newNode);
                        }
                    })
                }
                if(names.qSet){
                    let initialized = false;
                    names.qSet.forEach((name) => {
                        let newNode = this.sys.getNode(name);
                        if(newNode){
                            if(!initialized){
                                this.rightGraphNodes.qSet = [];
                                initialized = true;
                            }
                            if (!(typeof newNode.data.status === "string")){
                                newNode.data.status.push("selectedAsQ");
                            }
                            else{
                                newNode.data.status = ["selectedAsQ"];
                            }
                            this.rightGraphNodes.qSet!.push(newNode);
                        }
                    })
                }
            }

            this.renderer.redraw();
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
