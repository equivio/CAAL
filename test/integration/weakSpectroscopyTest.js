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

// P12 P11
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

// P13 P14
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

// P56 P57
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

QUnit.test("etasim", function ( assert ) {
    let equalities = weakSpectroscopy.getEqualitiesFromEnergies([[1,0,0,1,0,0,1,1], [1,0,1,0,0,0,0,1]]);
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
        readySimulation: false,
        csim: false,
        possibleFutures: false,
        readiness: false,
        impossibleFutures: false,
        failures: false,
        traceInclusion: true,
        srsim: false,
        scsim: false,
        sreadiness: false,
        sifutures: false,
        sfailures: false
    };
    assert.ok(Object.keys(correctEqualities).every((relation) => {return equalities[relation] === correctEqualities[relation]; }), "should be preordered by etasim");
});

// P21 P22
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

// P53 P54
QUnit.test("srbbNoBudgets", function ( assert ) {
    let graph = CCSParser.parse("P53sub = tau.P53sub + tau.b.0; P = a.P53sub; Q = a.b.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new WeakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = WeakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, []), "Winning budgets should not exist, not" + winningBudgets.map(e => " (" + e.budget + ")"));
});

QUnit.test("srbb", function ( assert ) {
    let equalities = weakSpectroscopy.getEqualitiesFromEnergies([]);
    let correctEqualities = {
        srbbisim: true,
        bbisim: true,
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
    assert.ok(Object.keys(correctEqualities).every((relation) => {return equalities[relation] === correctEqualities[relation]; }), "all supported relations should apply");
});

// P33 P34
QUnit.test("(1,1,2,0,0,1,1,1)", function ( assert ) {
    let graph = CCSParser.parse("P = tau.b.0 + a.0; Q = tau.b.0 + b.0 + a.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,1,2,0,0,1,1,1]]), "Winning Budgets should be (1,1,2,0,0,1,1,1), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

QUnit.test("srdbisim and etabisim", function ( assert ) {
    let equalities = weakSpectroscopy.getEqualitiesFromEnergies([[1,1,2,0,0,1,1,1]]),
    correctEqualities = {
        srbbisim: false,
        bbisim: false,
        srdbisim: true,
        dbisim: true,
        etabisim: false,
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

    assert.ok(Object.keys(correctEqualities).every((relation) => { return equalities[relation] === correctEqualities[relation]; }), "should be only distinguished by etabisim");
});

// P34 P33
QUnit.test("(1,1,1,0,0,1,0,0)", function ( assert ) {
    let graph = CCSParser.parse("P = tau.b.0 + b.0 + a.0; Q = tau.b.0 + a.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,1,1,0,0,1,0,0]]), "Winning Budgets should be (1,1,1,0,0,1,0,0), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

QUnit.test("srdbisim", function ( assert ) {
    let equalities = weakSpectroscopy.getEqualitiesFromEnergies([[1,1,1,0,0,1,0,0]]),
    correctEqualities = {
        srbbisim: false,
        bbisim: false,
        srdbisim: true,
        dbisim: true,
        etabisim: false,
        sbisim: true,
        bisimulation: true,
        etasim: false,
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

    assert.ok(Object.keys(correctEqualities).every((relation) => { return equalities[relation] === correctEqualities[relation]; }), "should be only distinguished by etasim");
});

// P11 P12
QUnit.test("(2,1,3,0,1,2,2,2)", function ( assert ) {
    let graph = CCSParser.parse("P = tau.(tau.c.0 + b.0) + a.0; Q = tau.(tau.c.0 + b.0) + a.0 + tau.c.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[2,1,3,0,1,2,2,2]]), "Winning Budget should be (2,1,3,0,1,2,2,2), not" + winningBudgets.map(e => " (" + e.budget + ")"));
});

// P14 P13
QUnit.test("(2,0,1,0,1,0,1,1)", function ( assert ) {
    let graph = CCSParser.parse("P = a.(tau.b.0 + c.0) + a.b.0; Q = a.(tau.b.0 + c.0);", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[2,0,1,0,1,0,1,1]]), "Winning Budgets should be (2,0,1,0,1,0,1,1), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

// P15 P16
QUnit.test("(1,0,1,0,0,1,1,1)", function ( assert ) {
    let graph = CCSParser.parse("P = tau.(tau.c.0 + b.0) + b.0 + a.0; Q = tau.c.0 + b.0 + a.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,0,1,0,0,1,1,1]]), "Winning Budgets should be (1,0,1,0,0,1,1,1), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

// P16 P15 
QUnit.test("(1,0,2,0,0,1,1,2), (2,1,2,0,1,2,1,1)", function ( assert ) {
    let graph = CCSParser.parse("P = tau.c.0 + b.0 + a.0; Q = tau.(tau.c.0 + b.0) + b.0 + a.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,0,2,0,0,1,1,2],[2,1,2,0,1,2,1,1]]), "Winning Budgets should be (1,0,2,0,0,1,1,2), (2,1,2,0,1,2,1,1), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

// P22 P21
QUnit.test("(3,0,0,2,0,0,3,2),(3,0,1,1,0,0,3,2),(3,0,2,0,0,0,3,2)", function ( assert ) {
    let graph = CCSParser.parse("P = a.(b.c.0 + b.d.0); Q = a.b.c.0 + a.(b.c.0 + b.d.0);", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[3,0,0,2,0,0,3,2],[3,0,1,1,0,0,3,2],[3,0,2,0,0,0,3,2]]), "Winning Budgets should be (3,0,0,2,0,0,3,2),(3,0,1,1,0,0,3,2),(3,0,2,0,0,0,3,2), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

// P24 P25
QUnit.test("(2,0,1,0,1,0,1,1),(2,0,1,1,0,1,2,1),(2,0,2,0,0,1,2,1)", function ( assert ) {
    let graph = CCSParser.parse("P = a.tau.b.0 + a.tau.c.0; Q = a.(tau.b.0 + tau.c.0);", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[2,0,1,0,1,0,1,1],[2,0,1,1,0,1,2,1],[2,0,2,0,0,1,2,1]]), "Winning Budgets should be (2,0,1,0,1,0,1,1),(2,0,1,1,0,1,2,1),(2,0,2,0,0,1,2,1), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

// P25 P24
QUnit.test("(2,0,1,1,1,0,2,2),(2,0,2,0,1,0,2,2),(2,0,1,0,0,1,0,0)", function ( assert ) {
    let graph = CCSParser.parse("P = a.(tau.b.0 + tau.c.0); Q = a.tau.b.0 + a.tau.c.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[2,0,1,1,1,0,2,2],[2,0,2,0,1,0,2,2],[2,0,1,0,0,1,0,0]]), "Winning Budgets should be (2,0,1,1,1,0,2,2),(2,0,2,0,1,0,2,2),(2,0,1,0,0,1,0,0), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

// P44 P45
QUnit.test("(3,0,0,1,0,0,2,1),(3,0,1,0,0,0,2,1),(3,0,0,1,0,2,0,0)", function ( assert ) {
    let graph = CCSParser.parse("P = a.(b.c.0 + tau.b.c.0 + b.d.0); Q = a.(b.c.0 + tau.b.d.0 + b.d.0);", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[3,0,0,1,0,0,2,1],[3,0,1,0,0,0,2,1],[3,0,0,1,0,2,0,0]]), "Winning Budgets should be (3,0,0,1,0,0,2,1),(3,0,1,0,0,0,2,1),(3,0,0,1,0,2,0,0), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

// P54 P55
QUnit.test("(1,0,0,1,0,0,0,0)", function ( assert ) {
    let graph = CCSParser.parse("P55sub = tau.P55sub + b.0; P = a.b.0; Q = a.P55sub;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,0,0,1,0,0,0,0]]), "Winning Budgets should be (1,0,0,1,0,0,0,0), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

// P55 P56
QUnit.test("(2,0,1,1,0,0,2,2),(2,0,2,0,0,0,1,2)", function ( assert ) {
    let graph = CCSParser.parse("P55sub = tau.P55sub + b.0; Div = tau.Div; P = a.P55sub; Q = a.(b.0 + tau.Div);", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[2,0,1,1,0,0,2,2],[2,0,2,0,0,0,1,2]]), "Winning Budgets should be (2,0,1,1,0,0,2,2),(2,0,2,0,0,0,1,2), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

// P57 P56
QUnit.test("(1,0,0,1,0,0,0,0)", function ( assert ) {
    let graph = CCSParser.parse("Div = tau.Div; P = a.(b.0 + tau.0); Q = a.(b.0 + tau.Div);", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,0,0,1,0,0,0,0]]), "Winning Budgets should be (1,0,0,1,0,0,0,0), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

//
QUnit.test("(1,0,1,0,1,0,1,1)", function ( assert ) {
    let graph = CCSParser.parse("P = tau.b.0; Q = tau.b.0 + tau.c.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,0,1,0,1,0,1,1]]), "Winning Budgets should be (1,0,1,0,1,0,1,1), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

//
QUnit.test("(1,0,1,0,1,0,1,1)", function ( assert ) {
    let graph = CCSParser.parse("P = tau.b.0; Q = tau.b.0 + c.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,0,1,0,1,0,1,1]]), "Winning Budgets should be (1,0,1,0,1,0,1,1), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

//
QUnit.test("non existant", function ( assert ) {
    let graph = CCSParser.parse("P = tau.a.0 + b.0; Q = (tau.a.0 + b.0) + tau.a.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, []), "Winning Budgets should not exist, but were " + winningBudgets.map(e => " (" + e.budget + ")"));
});

//
QUnit.test("(1,0,0,1,0,0,1,1),(1,0,1,0,0,0,1,1),(1,0,0,1,0,1,0,0)", function ( assert ) {
    let graph = CCSParser.parse("P = a.(a.0 + b.0); Q = a.(a.0 + b.0) + tau.b.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,0,0,1,0,0,1,1],[1,0,1,0,0,0,1,1],[1,0,0,1,0,1,0,0]]), "Winning Budgets should be (1,0,0,1,0,0,1,1),(1,0,1,0,0,0,1,1),(1,0,0,1,0,1,0,0), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

//
QUnit.test("(1,1,2,0,0,1,1,1)", function ( assert ) {
    let graph = CCSParser.parse("P = a.0 + tau.b.0; Q = (a.0 + b.0) + tau.b.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,1,2,0,0,1,1,1]]), "Winning Budgets should be (1,1,2,0,0,1,1,1), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

//
QUnit.test("(1,1,2,0,0,1,1,1)", function ( assert ) {
    let graph = CCSParser.parse("P = (a.0 + tau.b.0) + tau.b.0; Q = (a.0 + b.0) + tau.b.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,1,2,0,0,1,1,1]]), "Winning Budgets should be (1,1,2,0,0,1,1,1), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

//
QUnit.test("(1,0,0,1,0,0,1,1),(1,0,1,0,0,0,1,1)", function ( assert ) {
    let graph = CCSParser.parse("P = tau.a.0 + b.0; Q = tau.(a.0 + b.0) + b.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,0,0,1,0,0,1,1],[1,0,1,0,0,0,1,1]]), "Winning Budgets should be (1,0,0,1,0,0,1,1),(1,0,1,0,0,0,1,1), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});

//
QUnit.test("(1,0,1,1,1,0,1,2),(1,0,2,0,1,0,1,2)", function ( assert ) {
    let graph = CCSParser.parse("P = tau.(c.0 + b.0); Q = tau.(c.0 + b.0) + tau.c.0;", {ccs: CCS}),
        strongSuccGen = getStrictSuccGenerator(graph),
        weakSuccGen = getWeakSuccGenerator(graph),
        processP = graph.processByName("P"),
        processQ = graph.processByName("Q");
    let game = new weakSpectroscopy.Game(strongSuccGen, weakSuccGen, processP, processQ);
    let winningBudgets = weakSpectroscopy.computeWinningBudgets(game).entries().next().value[1];
    assert.ok(compareBudgets(winningBudgets, [[1,0,1,1,1,0,1,2],[1,0,2,0,1,0,1,2]]), "Winning Budgets should be (1,0,1,1,1,0,1,2),(1,0,2,0,1,0,1,2), not " + winningBudgets.map(e => " (" + e.budget + ")"));
});
