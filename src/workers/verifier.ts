/// <reference path="lib.webworker.d.ts" />
/// <reference path="../../lib/ccs.d.ts" />

declare var CCSParser;
declare var TCCSParser;
declare var HMLParser;
declare var THMLParser;
declare var BJN;

importScripts("../ccs_grammar.js", "../tccs_grammar.js", "../hml_grammar.js", "../thml_grammar.js", "../data.js", "../util.js", "../ccs.js", "../BJN.js");

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
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        isBisimilar =  winningBudgets.length == 0;
    }
    //Add some kind of request id to determine for which problem have result? It is necessary? Right now just add the new data to the result.
    data.result = isBisimilar;
    self.postMessage(data);
};

messageHandlers.isWeaklyBisimilar = data => {
    var attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true}),
        defendSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true}),
        leftProcess = attackSuccGen.getProcessByName(data.leftProcess),
        rightProcess = defendSuccGen.getProcessByName(data.rightProcess),
        isBisimilar = Equivalence.isBisimilar(attackSuccGen, defendSuccGen, leftProcess.id, rightProcess.id, graph);
    data.result = isBisimilar;
    self.postMessage(data);
};

messageHandlers.isStronglySimilar = data => {
    var attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true}),
        defendSuccGen = attackSuccGen,
        leftProcess = attackSuccGen.getProcessByName(data.leftProcess),
        rightProcess = defendSuccGen.getProcessByName(data.rightProcess),
        isSimilar = Equivalence.isSimilar(attackSuccGen, defendSuccGen, leftProcess.id, rightProcess.id);
    data.result = isSimilar;
    self.postMessage(data);
};

messageHandlers.isWeaklySimilar = data => {
    var attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true}),
        defendSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true}),
        leftProcess = attackSuccGen.getProcessByName(data.leftProcess),
        rightProcess = defendSuccGen.getProcessByName(data.rightProcess),
        isSimilar = Equivalence.isSimilar(attackSuccGen, defendSuccGen, leftProcess.id, rightProcess.id);
    data.result = isSimilar;
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
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        data.result =  winningBudgets.every((energyLevel) => { return energyLevel[4] > 0 || energyLevel[5] > 0});
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
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        var isTraceIncluded = winningBudgets.every(function (energyLevel) { return energyLevel[1] > 1 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0; });
        data.result = {isSatisfied: isTraceIncluded, formula: null};
    }
    self.postMessage(data);
};

messageHandlers.isWeaklyTraceIncluded = data => {
    var attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "weak", reduce: true});
    var defendSuccGen = attackSuccGen;
    var leftProcess = graph.processByName(data.leftProcess);
    var rightProcess = graph.processByName(data.rightProcess);
    
    data.result = Equivalence.isTraceIncluded(attackSuccGen, defendSuccGen, leftProcess.id, rightProcess.id, graph);
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
        let parsedGraph = BJN.parseForBJN(attackSuccGen);

        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        let leftToRightTraceInclusion = winningBudgets.every(function (energyLevel) { return energyLevel[1] > 1 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0; });

        gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.rightProcess), parsedGraph.getNodeByLabel(data.leftProcess));
        winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        var rightToLeftTraceInclusion = winningBudgets.every(function (energyLevel) { return energyLevel[1] > 1 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0; });

        data.result = {isSatisfied: leftToRightTraceInclusion && rightToLeftTraceInclusion, formula: null};
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
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        data.result =  winningBudgets.every((energyLevel) => { return energyLevel[5] > 1});
    }
    self.postMessage(data);
};

messageHandlers.isStronglyReadinessTracesEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        data.result =  winningBudgets.every((energyLevel) => { return energyLevel[3] > 1 || energyLevel[4] > 1 || energyLevel[5] > 1});
    }
    self.postMessage(data);
};

messageHandlers.isStronglyPossibleFuturesEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        data.result =  winningBudgets.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[5] > 1});
    }
    self.postMessage(data);
};

messageHandlers.isStronglyReadynessEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        data.result =  winningBudgets.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[2] > 1 || energyLevel[3] > 1 || energyLevel[4] > 1 || energyLevel[5] > 1});
    }
    self.postMessage(data);
};

messageHandlers.isStronglyFailureTracesEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        data.result =  winningBudgets.every((energyLevel) => { return energyLevel[3] > 0 || energyLevel[4] > 1 || energyLevel[5] > 1});
    }
    self.postMessage(data);
};

messageHandlers.isStronglyRevivalEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        data.result =  winningBudgets.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[2] > 1 || energyLevel[3] > 0 || energyLevel[4] > 1 || energyLevel[5] > 1});
    }
    self.postMessage(data);
};

messageHandlers.isStronglyReadySimulationEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        data.result =  winningBudgets.every((energyLevel) => { return energyLevel[4] > 1 || energyLevel[5] > 1});
    }
    self.postMessage(data);
};

messageHandlers.isStronglyImpossibleFuturesEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        data.result =  winningBudgets.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[5] > 1});
    }
    self.postMessage(data);
};

messageHandlers.isStronglyFailureEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        data.result =  winningBudgets.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[4] > 1 || energyLevel[5] > 1});
    }
    self.postMessage(data);
};

messageHandlers.isStronglyEnablednessEquivalent = data => {
    if(inputMode === "TCCS"){
        throw new Error("TCCS is not supported for this equivalence");
    }
    else{
        let attackSuccGen = CCS.getSuccGenerator(graph, {inputMode: inputMode, time: data.time, succGen: "strong", reduce: true});
        let parsedGraph = BJN.parseForBJN(attackSuccGen);
        let gameBJN = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(data.leftProcess), parsedGraph.getNodeByLabel(data.rightProcess));
        let winningBudgets = BJN.computeWinningBudgets(gameBJN).entries().next().value[1];
        data.result =  winningBudgets.every((energyLevel) => { return energyLevel[0] > 1 || energyLevel[1] > 1 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0});
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
