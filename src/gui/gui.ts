
module GUI {

    export interface ProcessGraphUI {

        clearAll() : void;

        showProcess(identifier, data : any) : void;
        getProcessDataObject(identifier) : any;
        getNode(name : string) : Node;
        getPosition(name : string) : Point;

        showTransitions(fromId, toId, datas : any[]);
        getTransitionDataObjects(fromId, toId) : any[];

        setOnSelectListener(f : (identifier) => void ) : void;
        clearOnSelectListener() : void;

        setOnEdgeSelectListener(f : (edge) => void ) : void;
        clearOnEdgeSelectListener() : void;

        setHoverOnListener(f : (identifier) => void ) : void;
        clearHoverOnListener() : void;

        setHoverOutListener(f : (identifier) => void ) : void;
        clearHoverOutListener() : void;

        setEdgeHoverOnListener(f : (edge) => void ) : void;
        clearEdgeHoverOnListener() : void;

        setEdgeHoverOutListener(f : (edge) => void ) : void;
        clearEdgeHoverOutListener() : void;

        setGraphNodes(names : {p: string, q: string | undefined, qSet: string[] | undefined, qStarSet: string[] | undefined}) : void;
        toggleSelectForChallenge(name : string) : boolean;
        setSelected(name : string) : void;
        getSelected() : string;
        highlightToNode(name: string) : void;
        clearHighlights() : void;
        highlightEdge(from : string, to : string);


        freeze() : void;
        unfreeze() : void;

        bindCanvasEvents() : void;
        unbindCanvasEvents() : void;

    }

    export function highlightTransitions(uiGraph, startId, transitions) {
        transitions.forEach(t => {
            uiGraph.highlightEdge(startId, t.targetProcess.id);
            startId = t.targetProcess.id;
        });  
    }
}