let weakSpectroscopy = WeakSpectroscopy;

QUnit.module("Weak Spectroscopy Tests");

function getStrictSuccGenerator(graph) {
    return CCS.getSuccGenerator(graph, {succGen: "strong", reduce: true});
}

function getWeakSuccGenerator(graph) {
    return CCS.getSuccGenerator(graph, {succGen: "weak", reduce: true});
}

function compareArray(a1, a2){
  return a1.length === a2.length && a1.every((element, index) => element === a2[index]);
}
function compareBudgets(a1, a2){
    if (a1.length !== a2.length) { return false; }
    return a1.every((budget) => {
        return a2.some((otherBudget) => {
            return compareArray(budget.budget, otherBudget);
        })
    })
}

QUnit.test("(2,1,2,0,1,2,1,1)", function ( assert ) {
    let graph = CCSParser.parse("P = tau.(tau.c.0 + b.0) + a.0 + tau.c.0; Q = tau.(tau.c.0 + b.0) + a.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[2,1,2,0,1,2,1,1]]), "Winning Budget should be (2,1,2,0,1,2,1,1), not" + winningBudgets.map(e => " (" + e.budget + ")"));
});

QUnit.test("srdbisim and etabisim", function ( assert ) {
    let equalities = weakSpectroscopy.getEqualitiesFromEnergies([[2,1,2,0,1,2,1,1]]),
    correctEqualities = {
        srbbisim: false,
        bbisim: false,
        srdbisim: true,
        dbisim: true,
        etabisim: true,
        sbisim: true,
        bisimulation: true,
        etasim: true,
        simulation: true,
        twoNestedSimulation: true,
        readySimulation: true,
        csim: true,
        possibleFutures: true,
        readiness: true,
        impossibleFutures: true,
        failures: true,
        traceInclusion: true,
        srsim: true,
        scsim: true,
        sreadiness: true,
        sifutures: true,
        sfailures: true
    };

    assert.ok(Object.keys(correctEqualities).every((relation) => { return equalities[relation] === correctEqualities[relation]; }), "should be only distinguished by srbbisim and bbisim");
});

QUnit.test("(2,0,1,1,1,0,2,2) and (2,0,2,0,1,0,2,2)", function ( assert ) {
    let graph = CCSParser.parse("P = a.(tau.b.0 + c.0); Q = a.(tau.b.0 + c.0) + a.b.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[2,0,1,1,1,0,2,2], [2,0,2,0,1,0,2,2]]), "Winning Budgets should be (2,0,1,1,1,0,2,2) and (2,0,2,0,1,0,2,2), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

QUnit.test("sbisim and etabisim", function ( assert ) {
    let equalities = weakSpectroscopy.getEqualitiesFromEnergies([[2,0,1,1,1,0,2,2], [2,0,2,0,1,0,2,2]]),
    correctEqualities = {
        srbbisim: false,
        bbisim: false,
        srdbisim: false,
        dbisim: false,
        etabisim: true,
        sbisim: true,
        bisimulation: true,
        etasim: true,
        simulation: true,
        twoNestedSimulation: true,
        readySimulation: true,
        csim: true,
        possibleFutures: true,
        readiness: true,
        impossibleFutures: true,
        failures: true,
        traceInclusion: true,
        srsim: true,
        scsim: true,
        sreadiness: true,
        sifutures: true,
        sfailures: true
    };

    assert.ok(Object.keys(correctEqualities).every((relation) => { return equalities[relation] === correctEqualities[relation]; }), "should be only distinguished by srbbisim, bbisim, srdbisim and dbisim");
});

QUnit.test("(1,0,0,2,0,0,1,1) and (1,0,1,1,0,0,0,1)", function ( assert ) {
    let graph = CCSParser.parse("Div = tau.Div; P = a.(b.0 + tau.Div); Q = a.(b.0 + tau.0);", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,0,0,2,0,0,1,1], [1,0,1,1,0,0,0,1]]), "Winning Budgets should be (1,0,0,2,0,0,1,1) and (1,0,1,1,0,0,0,1), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

QUnit.test("spfutures and bbisim", function ( assert ) {
    let equalities = weakSpectroscopy.getEqualitiesFromEnergies([[1,0,0,2,0,0,1,1], [1,0,1,1,0,0,0,1]]);
    let correctEqualities = {
        srbbisim: false,
        bbisim: true,
        srdbisim: false,
        dbisim: true,
        etabisim: true,
        sbisim: false,
        bisimulation: true,
        etasim: true,
        simulation: true,
        twoNestedSimulation: true,
        readySimulation: true,
        csim: true,
        possibleFutures: true,
        readiness: true,
        impossibleFutures: true,
        failures: true,
        traceInclusion: true,
        srsim: false,
        scsim: false,
        sreadiness: true,
        sifutures: true,
        sfailures: true
    };
    assert.ok(Object.keys(correctEqualities).every((relation) => {return equalities[relation] === correctEqualities[relation]; }), "should be distinguished by srdbisim and srsim and scsim");
});

QUnit.test("(3,0,0,1,0,0,2,1) and (3,0,1,0,0,0,2,1)", function ( assert ) {
    let graph = CCSParser.parse("P = a.b.c.0 + a.(b.c.0 + b.d.0); Q = a.(b.c.0 + b.d.0);", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[3,0,0,1,0,0,2,1],[3,0,1,0,0,0,2,1]]), "Winning budgets should be (3,0,0,1,0,0,2,1) and (3,0,1,0,0,0,2,1), not" + winningBudgets.map(e => " (" + e.budget + ")"));
});

QUnit.test("etasim and readsim and sreadysim", function ( assert ) {
    let equalities = weakSpectroscopy.getEqualitiesFromEnergies([[3,0,0,1,0,0,2,1],[3,0,1,0,0,0,2,1]]);
    let correctEqualities = {
        srbbisim: false,
        bbisim: false,
        srdbisim: false,
        dbisim: false,
        etabisim: false,
        sbisim: false,
        bisimulation: false,
        etasim: true,
        simulation: true,
        twoNestedSimulation: false,
        readySimulation: true,
        csim: false,
        possibleFutures: false,
        readiness: true,
        impossibleFutures: false,
        failures: true,
        traceInclusion: true,
        srsim: true,
        scsim: false,
        sreadiness: true,
        sifutures: false,
        sfailures: true
    };
    assert.ok(Object.keys(correctEqualities).every((relation) => {return equalities[relation] === correctEqualities[relation]; }), "should be distinguished by ifutures and sifutures");
});