/// <reference path="lib.webworker.d.ts" />
/// <reference path="../../lib/ccs.d.ts" />

declare var CCSParser;
declare var TCCSParser;
declare var HMLParser;
declare var THMLParser;
declare var StrongSpectroscopy;
declare var WeakSpectroscopy;

importScripts("../ccs_grammar.js", "../tccs_grammar.js", "../hml_grammar.js", "../thml_grammar.js", "../data.js", "../util.js", "../ccs.js", "../strong-spectroscopy.js", "../weak-spectroscopy.js");

var messageHandlers : any = {};
var graph;
var stop = false;
var inputMode;

self.addEventListener("message", (event : MessageEvent) => {
    messageHandlers[event.data.type](event.data);
}, false);


messageHandlers.program = data => {
    inputMode = data.inputMode;
    if (!inputMode){
        throw "language not defined."
    }
    if (inputMode === "CCS") {
        graph = new CCS.Graph();
        CCSParser.parse(data.program, {ccs: CCS, graph: graph});
    } else if (inputMode === "TCCS") {
        graph = new TCCS.Graph();
        TCCSParser.parse(data.program, {ccs: CCS, tccs: TCCS, graph: graph});
    }
};

messageHandlers.isStronglyBisimilar = data => {
    if(inputMode === "TCCS"){
        var attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true}),
            defendSuccGen = attackSuccGen,
            leftProcess = attackSuccGen.getProcessByName(data.leftProcess),
            rightProcess = defendSuccGen.getProcessByName(data.rightProcess),
            isBisimilar = Equivalence.isBisimilar(attackSuccGen, defendSuccGen, leftProcess.id, rightProcess.id, graph);
            data.result = isBisimilar
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess));
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        data.result = {isSatisfied: winningBudgets.length === 0, formula: winningBudgets.length !== 0 ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};
    }
    //Add some kind of request id to determine for which problem have result? It is necessary? Right now just add the new data to the result.
    self.postMessage(data);
};

messageHandlers.isWeaklyBisimilar = data => {
    var strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true}),
        weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true}),
        leftProcess = strongSuccGen.getProcessByName(data.leftProcess),
        rightProcess = weakSuccGen.getProcessByName(data.rightProcess);
    if (inputMode === "TCCS"){
        let isBisimilar = Equivalence.isBisimilar(strongSuccGen, weakSuccGen, leftProcess.id, rightProcess.id, graph);
        data.result = isBisimilar;
    }
    else{
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, leftProcess, rightProcess)
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 0 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isStronglySimilar = data => {
    if (inputMode === "TCCS"){
        var attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true}),
            defendSuccGen = attackSuccGen,
            leftProcess = attackSuccGen.getProcessByName(data.leftProcess),
            rightProcess = defendSuccGen.getProcessByName(data.rightProcess),
            isSimilar = Equivalence.isSimilar(attackSuccGen, defendSuccGen, leftProcess.id, rightProcess.id);
        data.result = isSimilar;
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess));
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0; });
        data.result = {isSatisfied: satisfied, formula: !satisfied ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklySimilar = data => {
    var strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true}),
        weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true}),
        leftProcess = strongSuccGen.getProcessByName(data.leftProcess),
        rightProcess = weakSuccGen.getProcessByName(data.rightProcess);
    if (inputMode === "TCCS"){
        let isSimilar = Equivalence.isSimilar(strongSuccGen, weakSuccGen, leftProcess.id, rightProcess.id);
        data.result = isSimilar;
    }
    else{
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, leftProcess, rightProcess)
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 0 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[6] > 0 || energyLevel.budget[7] > 0; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isStronglySimulationEquivalent = data => {
    if(inputMode === "TCCS"){
        var attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true}),
            defendSuccGen = attackSuccGen,
            leftProcess = attackSuccGen.getProcessByName(data.leftProcess),
            rightProcess = defendSuccGen.getProcessByName(data.rightProcess),
            isSimilarFromLeft = Equivalence.isSimilar(attackSuccGen, defendSuccGen, leftProcess.id, rightProcess.id),
            isSimilarFromRight = false;
        if (isSimilarFromLeft) {
            isSimilarFromRight = Equivalence.isSimilar(attackSuccGen, defendSuccGen, rightProcess.id, leftProcess.id);
        }
        data.result = isSimilarFromLeft && isSimilarFromRight;
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let leftToRightWinningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let leftToRightSimulation = leftToRightWinningBudgets.every((energyLevel) => { return energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0; });
        game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.rightProcess), graph.processByName(data.leftProcess));
        let rightToLeftWinningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let rightToLeftSimulation = rightToLeftWinningBudgets.every((energyLevel) => { return energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0; });
        data.result = {isSatisfied: leftToRightSimulation && rightToLeftSimulation, formula: !leftToRightSimulation ? leftToRightWinningBudgets[0].hml.propagateNegation(false).toString() : (!rightToLeftSimulation ? rightToLeftWinningBudgets[0].hml.propagateNegation(false).toString() : undefined)};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklySimulationEquivalent = data => {
    var attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true}),
        defendSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true}),
        leftProcess = attackSuccGen.getProcessByName(data.leftProcess),
        rightProcess = defendSuccGen.getProcessByName(data.rightProcess),
        isSimilarFromLeft = Equivalence.isSimilar(attackSuccGen, defendSuccGen, leftProcess.id, rightProcess.id),
        isSimilarFromRight = false;
        
        if (isSimilarFromLeft) {
            isSimilarFromRight = Equivalence.isSimilar(attackSuccGen, defendSuccGen, rightProcess.id, leftProcess.id);
        }
        
    data.result = isSimilarFromLeft && isSimilarFromRight;
    self.postMessage(data);
};

messageHandlers.isStronglyTraceIncluded = data => {
    if(inputMode === "TCCS"){
        var attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        var defendSuccGen = attackSuccGen;
        var leftProcess = graph.processByName(data.leftProcess);
        var rightProcess = graph.processByName(data.rightProcess);
        data.result = Equivalence.isTraceIncluded(attackSuccGen, defendSuccGen, leftProcess.id, rightProcess.id, graph);
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess));
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let isTraceIncluded = winningBudgets.every(function (energyLevel) { return energyLevel.budget[1] > 1 || energyLevel.budget[2] > 0 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0; });
        data.result = {isSatisfied: isTraceIncluded, formula: !isTraceIncluded ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyTraceIncluded = data => {
    var strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true}),
        weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true}),
        leftProcess = strongSuccGen.getProcessByName(data.leftProcess),
        rightProcess = weakSuccGen.getProcessByName(data.rightProcess);
    if (inputMode === "TCCS"){
        let isTraceIncluded = Equivalence.isTraceIncluded(strongSuccGen, weakSuccGen, leftProcess.id, rightProcess.id, graph);
        data.result = isTraceIncluded;
    }
    else{
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, leftProcess, rightProcess)
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget.slice(1).some((dim) => { return dim > 0; }) ; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isStronglyTraceEq = data => {
    if(inputMode === "TCCS"){
        var attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        var defendSuccGen = attackSuccGen;
        var leftProcess = graph.processByName(data.leftProcess);
        var rightProcess = graph.processByName(data.rightProcess);
        var formula : string;
        
        let leftToRightTraceInclusion = Equivalence.isTraceIncluded(attackSuccGen, defendSuccGen, leftProcess.id, rightProcess.id, graph);
        var rightToLeftTraceInclusion : any;
        
        if (!leftToRightTraceInclusion.isSatisfied) {
            formula = leftToRightTraceInclusion.formula;
        } else {
            rightToLeftTraceInclusion = Equivalence.isTraceIncluded(attackSuccGen, defendSuccGen, rightProcess.id, leftProcess.id, graph);
            formula = rightToLeftTraceInclusion.formula;
        }
        
        data.result = {
            isSatisfied: (leftToRightTraceInclusion.isSatisfied && rightToLeftTraceInclusion.isSatisfied),
            formula: formula
        };
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let leftToRightWinningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let leftToRightTraceInclusion = leftToRightWinningBudgets.every(function (energyLevel) { return energyLevel.budget[1] > 1 || energyLevel.budget[2] > 0 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0; });
        game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.rightProcess), graph.processByName(data.leftProcess))
        let rightToLeftWinningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let rightToLeftTraceInclusion = rightToLeftWinningBudgets.every(function (energyLevel) { return energyLevel.budget[1] > 1 || energyLevel.budget[2] > 0 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0; });
        data.result = {isSatisfied: leftToRightTraceInclusion && rightToLeftTraceInclusion, formula: !leftToRightTraceInclusion ? leftToRightWinningBudgets[0].hml.propagateNegation(false).toString() : (!rightToLeftTraceInclusion ? rightToLeftWinningBudgets[0].hml.propagateNegation(false).toString() : undefined)};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyTraceEq = data => {
    var attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
    var defendSuccGen = attackSuccGen;
    var leftProcess = graph.processByName(data.leftProcess);
    var rightProcess = graph.processByName(data.rightProcess);
    var formula;
    
    var leftToRightTraceInclusion = Equivalence.isTraceIncluded(attackSuccGen, defendSuccGen, leftProcess.id, rightProcess.id, graph);
    var rightToLeftTraceInclusion : any;
    
    if (!leftToRightTraceInclusion.isSatisfied) {
        formula = leftToRightTraceInclusion.formula;
    } else {
        rightToLeftTraceInclusion = Equivalence.isTraceIncluded(attackSuccGen, defendSuccGen, rightProcess.id, leftProcess.id, graph);
        formula = rightToLeftTraceInclusion.formula;
    }
    
    data.result = {
        isSatisfied: (leftToRightTraceInclusion.isSatisfied && rightToLeftTraceInclusion.isSatisfied),
        formula: formula
    };
    self.postMessage(data);
};

messageHandlers.isStronglyTwoNestedSimulationEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[5] > 1; });
        data.result = {isSatisfied: satisfied, formula: !satisfied ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyTwosim = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 0 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[7] > 1; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isStronglyReadinessTracesEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[3] > 1 || energyLevel.budget[4] > 1 || energyLevel.budget[5] > 1; });
        data.result = {isSatisfied: satisfied, formula: !satisfied ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};
    }
    self.postMessage(data);
};

messageHandlers.isStronglyPossibleFuturesEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 2 || energyLevel.budget[5] > 1; });
        data.result = {isSatisfied: satisfied, formula: !satisfied ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyPfutures = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 0 || energyLevel.budget[2] > 1 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[7] > 1; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isStronglyReadinessEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 2 || energyLevel.budget[2] > 1 || energyLevel.budget[3] > 1 || energyLevel.budget[4] > 1 || energyLevel.budget[5] > 1; });
        data.result = {isSatisfied: satisfied, formula: !satisfied ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};;
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyReadiness = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 0 || energyLevel.budget[2] > 1 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[5] > 1 || energyLevel.budget[6] > 1 || energyLevel.budget[7] > 1; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isStronglyFailureTracesEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[3] > 0 || energyLevel.budget[4] > 1 || energyLevel.budget[5] > 1; });
        data.result = {isSatisfied: satisfied, formula: !satisfied ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};
    }
    self.postMessage(data);
};

messageHandlers.isStronglyRevivalEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 2 || energyLevel.budget[2] > 1 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 1 || energyLevel.budget[5] > 1; });
        data.result = {isSatisfied: satisfied, formula: !satisfied ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};
    }
    self.postMessage(data);
};

messageHandlers.isStronglyReadySimulationEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[4] > 1 || energyLevel.budget[5] > 1; });
        data.result = {isSatisfied: satisfied, formula: !satisfied ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyRsim = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 0 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[6] > 1 || energyLevel.budget[7] > 1; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isStronglyImpossibleFuturesEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 2 || energyLevel.budget[2] > 0 || energyLevel.budget[3] > 0 || energyLevel.budget[5] > 1; });
        data.result = {isSatisfied: satisfied, formula: !satisfied ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyIfutures = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 0 || energyLevel.budget[2] > 1 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0 || energyLevel.budget[7] > 1; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isStronglyFailureEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 2 || energyLevel.budget[2] > 0 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 1 || energyLevel.budget[5] > 1; });
        data.result = {isSatisfied: satisfied, formula: !satisfied ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyFailures = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 0 || energyLevel.budget[2] > 1 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0 || energyLevel.budget[6] > 1 || energyLevel.budget[7] > 1; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isStronglyEnablednessEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[0] > 1 || energyLevel.budget[1] > 1 || energyLevel.budget[2] > 0 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0; });
        data.result = {isSatisfied: satisfied, formula: !satisfied ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};        
    }
    self.postMessage(data);
};

messageHandlers.runStrongSpectroscopy = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let game = new StrongSpectroscopy.Game(attackSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess));
        let winningBudgets = StrongSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let energies = winningBudgets.map((budget) => { return budget.budget; });
        let equalities = StrongSpectroscopy.getEqualitiesFromEnergies(energies);
        data.result = {equalities: equalities, formula: !equalities.bisimulation ? winningBudgets[0].hml.propagateNegation(false).toString() : undefined};
    }
    self.postMessage(data);
};

messageHandlers.runWeakSpectroscopy = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess));
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let energies = winningBudgets.map((budget) => { return budget.budget; });
        let equalities = WeakSpectroscopy.getEqualitiesFromEnergies(energies);
        data.result = {equalities: equalities};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklySrbbisim = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        data.result = {isSatisfied: winningBudgets.length === 0};  
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyBbisim = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => {return energyLevel.budget[3] > 0;})
        data.result = {isSatisfied: satisfied};  
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyDbisim = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 0 || energyLevel.budget[3] > 0; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyEtabisim = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyEtasim = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[6] > 0 || energyLevel.budget[7] > 0; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyCsim = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => { return energyLevel.budget[1] > 0 || energyLevel.budget[3] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0; });
        data.result = {isSatisfied: satisfied};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklySrdbisim = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => {return energyLevel.budget[1] > 0;})
        data.result = {isSatisfied: satisfied};  
    }
    self.postMessage(data);
};

messageHandlers.isWeaklySbisim = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => {return energyLevel.budget[1] > 0 || energyLevel.budget[2] > 0 || energyLevel.budget[4] > 0;})
        data.result = {isSatisfied: satisfied};  
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyScsim = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => {return energyLevel.budget[1] > 0 || energyLevel.budget[2] > 0|| energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0;})
        data.result = {isSatisfied: satisfied};  
    }
    self.postMessage(data);
};

messageHandlers.isWeaklySifutures = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => {return energyLevel.budget[1] > 0 || energyLevel.budget[2] > 0 || energyLevel.budget[3] > 1 || energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0 || energyLevel.budget[7] > 1;})
        data.result = {isSatisfied: satisfied};  
    }
    self.postMessage(data);
};

messageHandlers.isWeaklySrsim = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => {return energyLevel.budget[1] > 0 || energyLevel.budget[2] > 0 || energyLevel.budget[4] > 0 || energyLevel.budget[6] > 1 || energyLevel.budget[7] > 1;})
        data.result = {isSatisfied: satisfied};  
    }
    self.postMessage(data);
};

messageHandlers.isWeaklySreadiness = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => {return energyLevel.budget[1] > 0 || energyLevel.budget[2] > 0 || energyLevel.budget[3] > 1 || energyLevel.budget[4] > 0 || energyLevel.budget[5] > 1 || energyLevel.budget[6] > 1 || energyLevel.budget[7] > 1;})
        data.result = {isSatisfied: satisfied};  
    }
    self.postMessage(data);
};

messageHandlers.isWeaklySfailures = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
        let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, graph.processByName(data.leftProcess), graph.processByName(data.rightProcess))
        let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
        let satisfied = winningBudgets.every((energyLevel) => {return energyLevel.budget[1] > 0 || energyLevel.budget[2] > 0 || energyLevel.budget[3] > 1 || energyLevel.budget[4] > 0 || energyLevel.budget[5] > 0 || energyLevel.budget[6] > 1 || energyLevel.budget[7] > 1;})
        data.result = {isSatisfied: satisfied};  
    }
    self.postMessage(data);
};

function readFormulaSet(data) : HML.FormulaSet {
    var formulaSet = new HML.FormulaSet;
    if (inputMode === "CCS") {
        HMLParser.parse(data.definitions, {ccs: CCS, hml: HML, formulaSet: formulaSet});
        HMLParser.parse(data.formula, {startRule: "TopFormula", ccs: CCS, hml: HML, formulaSet: formulaSet});
    } else if (inputMode === "TCCS") {
        THMLParser.parse(data.definitions, {ccs: CCS, tccs: TCCS, hml: HML, formulaSet: formulaSet});
        THMLParser.parse(data.formula, {startRule: "TopFormula", ccs: CCS, tccs: TCCS, hml: HML, formulaSet: formulaSet});
    }
    return formulaSet;
}

messageHandlers.checkFormula = data => {
    var strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, succGen: "strong", reduce: true}),
        weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, succGen: "weak", reduce: true}),
        formulaSet = readFormulaSet(data),
        formula = formulaSet.getTopFormula(),
        result = DependencyGraph.solveMuCalculus(formulaSet, formula, strongSuccGen, weakSuccGen, graph.processByName(data.processName).id);
    data.result = result;
    self.postMessage(data);
};

messageHandlers.checkFormulaForVariable = data => {  
    var strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, succGen: "strong", reduce: true}),
        weakSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, succGen: "weak", reduce: true}),
        formulaSet = readFormulaSet(data),
        formula = formulaSet.getTopFormula(),
        result = DependencyGraph.solveMuCalculus(formulaSet, formula, strongSuccGen, weakSuccGen, graph.processByName(data.processName).id);
    data.result = result;
    self.postMessage(data);
};

messageHandlers.findDistinguishingFormula = data => {
    var strongSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true}),
        weakSuccGen = data.succGenType === "weak" ? CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true}) : strongSuccGen,
        leftProcess = strongSuccGen.getProcessByName(data.leftProcess),
        rightProcess = strongSuccGen.getProcessByName(data.rightProcess);
        var bisimilarDg = new Equivalence.BisimulationDG(strongSuccGen, weakSuccGen, leftProcess.id, rightProcess.id),
        marking = DependencyGraph.solveDgGlobalLevel(bisimilarDg),
        formula, hmlNotation;
    if (marking.getMarking(0) === marking.ZERO) {
        data.result = {
            isBisimilar: true,
            formula: ""
        };
    } else {
        formula = bisimilarDg.findDistinguishingFormula(marking, data.succGenType === "weak");
        hmlNotation = new Traverse.HMLNotationVisitor(true, false, false);
        data.result = {
            isBisimilar: false,
            formula: hmlNotation.visit(formula)
        };
    }
    self.postMessage(data);
};

messageHandlers.stop = data => {
    self.close();
};
