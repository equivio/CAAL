/// <reference path="../../../lib/jquery.d.ts" />
/// <reference path="../../../lib/arbor.d.ts" />
/// <reference path="renderer.ts" />

var counter = 0
class Handler {
    public selectedNode : Node = null;
    public draggedObject : refNode = null;
    public hoverNode : refNode = null;
    public selectedEdge : any = null;
    public hoverEdge : any = null;
    public mouseP : Point = null;
    public onClick : Function = null;
    public onEdgeClick : Function = null;
    public onHover : Function = null;
    public onHoverOut : Function = null;
    public onEdgeHover : Function = null;
    public onEdgeHoverOut : Function = null;
    private isDragging : boolean = false;
    private mouseDownPos : Point;
    public clickDistance = 50;
    public hoverDistance = 30;
    public renderer : Renderer = null;
    constructor(renderer : Renderer) {
        this.renderer = renderer;
        //this.bindCanvasEvents();
    }

    public bindCanvasEvents() {
        $(this.renderer.canvas).bind('mousedown', this.mousedown);
        $(this.renderer.canvas).bind('mousemove', this.hover); // event for hovering over a node (bind)
    }

    public unbindCanvasEvents() {
        $(this.renderer.canvas).unbind('mousedown', this.mousedown);
        $(this.renderer.canvas).unbind('mousemove', this.hover); // event for hovering over a node (unbind)
    }

    public mousedown = (e) => {
        var pos = $(this.renderer.canvas).offset();
        if (!this.renderer.particleSystem) {
            return false;
        }
        
        this.isDragging = false;

        this.mouseDownPos = arbor.Point(e.pageX-pos.left, e.pageY-pos.top);
        this.mouseP = this.mouseDownPos;
        this.draggedObject = this.renderer.particleSystem.nearest(this.mouseP);
        this.selectedNode = this.draggedObject ? this.draggedObject.node : null;
        
        if (this.selectedNode && this.draggedObject.distance <= this.clickDistance) {
            // only register the mousedown, if they press within the this.clickDistance
            this.selectedNode.fixed = true;
            this.selectedNode.tempMass = 50;

            $(this.renderer.canvas).unbind('mousemove', this.hover); // unbind hover
            $(this.renderer.canvas).bind('mousemove', this.dragged); // bind drag
            $(window).bind('mouseup', this.dropped); // bind mouse dropped
        }
        else{
            this.renderer.particleSystem.eachEdge( (e: Edge, p1: Point, p2: Point) => {
                for (let d of e.data.datas) {
                    if (this.mouseP.x >= d.x - d.width && this.mouseP.x <= d.x && this.mouseP.y >= d.y - 20 && this.mouseP.y <= d.y) {
                        this.selectedEdge = { edge: e, label: d };
                        $(this.renderer.canvas).unbind('mousemove', this.hover); // unbind hover
                        $(window).bind('mouseup', this.dropped); // bind mouse dropped
                    }
                }
            });
        }

        return false;
    }

    public hover = (e) => { 
        var pos = $(this.renderer.canvas).offset();
        var s = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)

        var newHoverNode = this.renderer.particleSystem.nearest(s);

        // On hover event
        if (newHoverNode !== null) {
            if (this.hoverNode == null && newHoverNode.distance <= this.hoverDistance) {
                if (this.onHover) {
                    this.hoverNode = newHoverNode; // call the onHover function given by the user of the arbor-graph
                    this.onHover(this.hoverNode.node.name);
                }
            } 
            else if (this.hoverNode !== null && newHoverNode.distance > this.hoverDistance) {
                if (this.onHoverOut) {   
                    this.onHoverOut(this.hoverNode.node.name); // call the onHoverOut function given by the user of the arbor-graph
                    this.hoverNode = null;
                }
            }
        }

        if (this.hoverEdge &&
            !(s.x >= this.hoverEdge.label.x - this.hoverEdge.label.width/2 && s.x <= this.hoverEdge.label.x + this.hoverEdge.label.width/2 && s.y >= this.hoverEdge.label.y - 20 && s.y <= this.hoverEdge.label.y)) {
                if (this.onEdgeHoverOut) {
                    this.onEdgeHoverOut(this.hoverEdge);
                    this.hoverEdge = null;
                }
            }

        if (this.hoverNode === null) {
            let canvasPos = s;
            this.renderer.particleSystem.eachEdge( (e: Edge, p1: Point, p2: Point) => {
                for (let d of e.data.datas) {
                    if (canvasPos.x >= d.x - d.width/2 && canvasPos.x <= d.x + d.width/2 && canvasPos.y >= d.y - 20 && canvasPos.y <= d.y) {
                        this.hoverEdge = { edge: e, label: d };
                        if (this.onEdgeHover){
                            this.onEdgeHover(this.hoverEdge);
                        }
                    }
                }
            });
        }

        return false;
    }

    public dragged = (e) => {
        var pos = $(this.renderer.canvas).offset();
        var s = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)

        if (!this.isDragging && this.mouseDownPos.subtract(s).magnitude() > 10) {
            this.isDragging = true;
            this.selectedNode.fixed = true;
        }

        // Drag node visually around
        if (this.isDragging) {
            var p = this.renderer.particleSystem.fromScreen(s);
            this.selectedNode.p = p;
        }

        return false;
    }

    public dropped = (e) => {
        this.selectedNode.fixed = false;
        this.selectedNode.tempMass = 50;
        
        if (this.selectedNode && !this.isDragging && this.onClick) {
            this.onClick(this.selectedNode.name); // call the click function given by the user of the arbor-graph
        }
        
        this.selectedNode = null;
        this.draggedObject = null;
        
        if (this.selectedEdge && !this.isDragging && this.onEdgeClick) {
            this.onEdgeClick(this.selectedEdge);
        }

        this.selectedEdge = null;

        $(window).unbind('mouseup', this.dropped);
        $(this.renderer.canvas).unbind('mousemove', this.dragged);
        $(this.renderer.canvas).bind('mousemove', this.hover); // event for hovering over a node
        
        this.mouseP = null;

        return false;
    }
}