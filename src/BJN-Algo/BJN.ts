/// <reference path="../../lib/ccs.d.ts" />

module BJN {

    let idCounter = 0;

    class WithAutoIncrementedId {
        protected id: Number;

        constructor() {
            this.id = idCounter++;
        }
    }

    class Node {
        public label: string;

        constructor(label: string) {
            this.label = label;
        }
    }

    class Edge {
        public from: Node;
        public to: Node;
        public label: string;

        constructor(from: Node, to: Node, label: string) {
            this.from = from;
            this.to = to;
            this.label = label;
        }
    }

    class Graph {
        private nodes: Node[];
        public edges: Edge[];

        constructor() {
            this.nodes = [];
            this.edges = [];
        }

        public addNode(label: string): Node {
            let node = new Node(label);
            this.nodes.push(node);
            return node;
        }

        public addEdge(from: Node, to: Node, label: string): Edge {
            let edge = new Edge(from, to, label);
            this.edges.push(edge);
            return edge;
        }
        public getNodeByLabel(label: String) {
            return this.nodes.find((node) => {
                return node.label === label;
            })
        }
    }

    export function parseForBJN(succGen: CCS.SuccessorGenerator): Graph {
        let graphForBJN = new Graph();
        let todo: CCS.Process[] = [];
        // named processes are root node of tree
        succGen.getGraph().getNamedProcesses().forEach((name) => {
            graphForBJN.addNode(name);
            todo.push(succGen.getGraph().processByName(name));
        })
        // DFS
        while (todo.length > 0) {
            let currentProc = todo.pop()!;
            let transitions = succGen.getSuccessors(currentProc.id);
            transitions.forEach((transition) => {
                let targetProcessName = transition.targetProcess.toString();
                if (!graphForBJN.getNodeByLabel(targetProcessName)) {
                    graphForBJN.addNode(targetProcessName);
                    todo.push(transition.targetProcess);
                }
                graphForBJN.addEdge(graphForBJN.getNodeByLabel(currentProc.toString())!, graphForBJN.getNodeByLabel(targetProcessName)!, transition.action.toString());
            })
        }
        return graphForBJN;
    }


    export class Position extends WithAutoIncrementedId {
        public p: Node;
        public qSet?: Node[]
        public qStarSet?: Node[]
        public q?: Node;
        public isDefenderPosition: boolean

        constructor(p: Node, isDefenderPosition: boolean, qSet?: Node[], qStarSet?: Node[], q?: Node) {
            // assign index
            super();
            this.p = p;
            this.qSet = qSet || undefined;
            this.qStarSet = qStarSet || undefined;
            this.q = q || undefined;
            this.isDefenderPosition = isDefenderPosition;
        }

        public defenderStuck() {
            if (!this.isDefenderPosition) {
                throw new Error("Not a defender position.");
            }
            return (this.qSet?.length == 0 && this.qStarSet?.length == 0)
        }

        public isEqualTo(otherPos: Position) {
            // check for equality of p
            if (!(this.p.label === otherPos.p.label)) { return false; }

            // check for set equality of qSet
            if ((this.qSet && otherPos.qSet)) {
                if (!(this.qSet.every((q) => {
                    return otherPos.qSet!.some((otherq) => { return q.label === otherq.label })
                })
                    && otherPos.qSet.every((otherq) => {
                        return this.qSet!.some((q) => { return otherq.label === q.label })
                    }))) {
                    return false;
                }
            }
            else {
                if (this.qSet || otherPos.qSet) { return false; }
            }

            // check for set equality of qStarSet
            if ((this.qStarSet && otherPos.qStarSet)) {
                if (!(this.qStarSet.every((q) => {
                    return otherPos.qStarSet!.some((otherq) => { return q.label === otherq.label })
                })
                    && otherPos.qStarSet.every((otherq) => {
                        return this.qStarSet!.some((q) => { return otherq.label === q.label })
                    }))) {
                    return false;
                }
            }
            else {
                if (this.qStarSet || otherPos.qStarSet) { return false; }
            }

            // check for equality of q
            if (this.q && otherPos.q) {
                if (!(this.q.label === otherPos.q.label)) { return false; }
            }
            else {
                if (this.q || otherPos.q) { return false; }
            }

            return true;
        }

        public toString(): string {
            let str = "(" + this.p.label + ",";
            if (this.q) {
                str += this.q.label
            }
            else {
                str += "{"
                for (let i = 0; i < this.qSet!.length; i++) {
                    str += this.qSet![i].label;
                    str += i < this.qSet!.length - 1 ? "," : ""
                }
                str += "}";
                if (this.qStarSet) {
                    str += ",{";
                    for (let i = 0; i < this.qStarSet!.length; i++) {
                        str += this.qStarSet![i].label;
                        str += i < this.qStarSet!.length - 1 ? "," : ""
                    }
                    str += "}";
                }

            }
            str += ")"
            return str;
        }
    }


    export class Move {
        public from: Position;
        public to: Position;
        public update: (number | number[])[];
        public actionName?: string

        constructor(from: Position, to: Position, update: (number | number[])[], actionName?: string) {
            this.from = from;
            this.to = to;
            this.update = update
            this.actionName = actionName;
        }

        public updateToString(): string {
            let str = "(";
            for (let i = 0; i < 6; i++) {
                let dim = this.update[i];
                // check if dim is relative or minimum selection update
                if (Number.isFinite(dim)) {
                    str += dim;
                }
                else {
                    str += "min(" + dim[0] + "," + dim[1] + ")";
                }
                str += i < 5 ? "," : ")"
            }
            return str;
        }
    }

    function findTwoPartitions(set: Node[]) {
        let combinations: Node[][] = [[]];
        for (let i = 0; i < Math.pow(2, set.length); i++) {
            let combination: Node[] = [];
            for (let j = 0; j < set.length; j++) {
                if ((i & Math.pow(2, j))) {
                    combination.push(set[j]);
                }
            }
            if (combination.length != 0) {
                combinations.push(combination);
            }
        }
        return combinations;
    }

    function getSetDifference(set: Node[], subset: Node[]) {
        if (subset.length == 0) {
            return set;
        }
        return set.filter((elem) => {
            return subset.every((e) => { return elem != e; })
        })
    }


    export class Game {
        public positions: Position[];
        public defenderPositions: Position[];
        public moves: Move[];

        constructor(g: Graph, firstNode: Node, secondNode: Node) {
            this.positions = [];
            this.defenderPositions = [];
            this.moves = [];
            this.createGameGraph(g, firstNode, secondNode);
        }

        private addPosition(position: Position) {
            this.positions.push(position);
            if (position.isDefenderPosition) {
                this.defenderPositions.push(position);
            }
            return position;
        }

        private addMove(move: Move) {
            this.moves.push(move);
        }

        private createGameGraph(g: Graph, firstNode: Node, secondNode: Node) {
            // initialize stack with start position
            let startPosition = new Position(firstNode, false, [secondNode], undefined, undefined);
            this.addPosition(startPosition);
            let todo: Position[] = [startPosition];
            while (todo.length > 0) {
                let pos = todo.pop()!;
                if (pos.isDefenderPosition) {
                    // conjunctive revival
                    if (pos.qStarSet!.length > 0) {
                        let newPos: Position = new Position(pos.p, false, pos.qStarSet, undefined, undefined);
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, [[1, 3], 0, 0, 0, 0, 0]));
                            todo.push(newPos);
                        }
                        else {
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                            if (!destPos) { throw new Error("Position does not exist despite check"); }
                            this.addMove(new Move(pos, destPos, [[1, 3], 0, 0, 0, 0, 0]))
                        }
                    }
                    // conjunctive answers
                    pos.qSet!.forEach((q) => {
                        let newPos: Position = new Position(pos.p, false, undefined, undefined, q);
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, [0, 0, 0, [3, 4], 0, 0]));
                            todo.push(newPos);
                        }
                        else {
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                            if (!destPos) { throw new Error("Position does not exist despite check"); }
                            this.addMove(new Move(pos, destPos, [0, 0, 0, [3, 4], 0, 0]))
                        }
                    })
                }
                else {
                    // attacker clause positions
                    if (pos.q) {
                        // positive decisions
                        let newPos: Position = new Position(pos.p, false, [pos.q], undefined, undefined);
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, [[1, 4], 0, 0, 0, 0, 0]));
                            todo.push(newPos);
                        }
                        else {
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                            if (!destPos) { throw new Error("Position does not exist despite check"); }
                            this.addMove(new Move(pos, destPos, [[1, 4], 0, 0, 0, 0, 0]))
                        }
                        // negative decisions
                        if (pos.p.label != pos.q.label) {
                            let newPos: Position = new Position(pos.q, false, [pos.p], undefined, undefined);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [[1, 5], 0, 0, 0, 0, -1]));
                                todo.push(newPos);
                            }
                            else {
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                if (!destPos) { throw new Error("Position does not exist despite check"); }
                                this.addMove(new Move(pos, destPos, [[1, 5], 0, 0, 0, 0, -1]))
                            }
                        }
                    }
                    else {
                        // observation moves
                        g.edges.forEach((edge) => {
                            if (edge.from.label === pos.p.label) {
                                let newQSet: Node[] = [];
                                g.edges.forEach((e) => {
                                    if (e.label === edge.label) {
                                        pos.qSet!.forEach((q) => {
                                            if (e.from.label === q.label) {
                                                // duplicates?
                                                newQSet.push(e.to);
                                            }
                                        })
                                    }
                                })
                                let newPos: Position = new Position(edge.to, false, newQSet, undefined, undefined);
                                // check if newPos was already discovered to avoid duplicates
                                if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                    this.addPosition(newPos);
                                    this.addMove(new Move(pos, newPos, [-1, 0, 0, 0, 0, 0], edge.label));
                                    todo.push(newPos);
                                }
                                else {
                                    // omit redundant loops
                                    if (!newPos.isEqualTo(pos)){
                                        let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                        if (!destPos) { throw new Error("Position does not exist despite check"); }
                                        this.addMove(new Move(pos, destPos, [-1, 0, 0, 0, 0, 0], edge.label))
                                    }
                                }
                            }
                        })

                        // conjunctional challenges
                        let twoPartitions: Node[][] = findTwoPartitions(pos.qSet!)
                        twoPartitions.forEach((partition) => {
                            // omit redundant positions with empty qset but non-empty qstarset
                            if (partition.length === 0 && pos.qSet!.length !== 0){
                                return;
                            }
                            let newPos: Position = new Position(pos.p, true, partition, getSetDifference(pos.qSet!, partition), undefined);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [0, -1, 0, 0, 0, 0]));
                                todo.push(newPos);
                            }
                            else {
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                if (!destPos) { throw new Error("Position does not exist despite check"); }
                                this.addMove(new Move(pos, destPos, [0, -1, 0, 0, 0, 0]))
                            }
                        })
                    }
                }
            }
        }

        public parsePosition(left: string, right: { q: string | undefined, qSet: string[] | undefined, qStarSet: string[] | undefined }): Position {
            let p = new Node(left);
            let q = right.q ? new Node(right.q) : undefined;

            let qSet: Node[] | undefined;
            if (right.qSet) {
                qSet = [];
                right.qSet.forEach((e) => { qSet!.push(new Node(e)) })
            }
            else { qSet = undefined; }

            let qStarSet: Node[] | undefined;
            if (right.qStarSet) {
                qStarSet = [];
                right.qStarSet.forEach((e) => { qStarSet!.push(new Node(e)) })
            }
            else { qStarSet = undefined; }
            return new Position(p, false, qSet, qStarSet, q);
        }

        public getPossibleMoves(position: Position): Move[] {
            let currentPos = this.positions.find((pos) => {
                return pos.isEqualTo(position)
            })
            if (!currentPos) { throw "game state not found"; }
            let possibleMoves = this.moves.filter((move) => {
                return move.from.isEqualTo(currentPos!);
            })
            return possibleMoves;
        }
    }

    export function update(budget: number[], update: any): number[] {
        let updatedBudget: number[] = [];
        for (let i = 0; i < 6; i++) {
            if (Array.isArray(update[i])) {
                updatedBudget[i] = Math.min(budget[update[i][0] - 1], budget[update[i][1] - 1]);
            }
            else {
                updatedBudget[i] = budget[i] + update[i];
            }
        }
        return updatedBudget;
    }

    function updateHML(hml: HML.Formula, update: (number | number[])[], actionName: string) : HML.Formula {
        let actionMatcher = new HML.SingleActionMatcher(new CCS.Action(actionName, false));
        if (update[0] === -1) { return new HML.StrongExistsFormula(actionMatcher, hml); }
        if (update[0][1] === 3) { return new HML.ConjFormula([hml]); }
        if (update[3][0] === 3) { return new HML.ConjFormula([hml]); }
        if (update[5] === -1) { return new HML.NegationFormula(hml); }
        return hml;
    }

    function inverseUpdate(energyLevel: number[], update: (number | number[])[]) : number[] {
        let parts: number[][] = [[...energyLevel]];
        update.forEach((u_i, i) => {
            //relative updates
            if (typeof (u_i) == "number") {
                parts[0][i] -= u_i;
            }
            // minimum selection updates (index starts at one)
            else {
                let part = Array(6).fill(0);
                part[u_i[0] - 1] = energyLevel[i];
                part[u_i[1] - 1] = energyLevel[i];
                parts.push(part);
            }
        })
        let sup = parts.pop()!;
        parts.forEach((part) => {
            part.forEach((e_i, i) => {
                sup[i] = Math.max(sup[i], e_i);
            })
        })
        return sup;
    }


    function computeMinimumBudgets(newAttackerWin: {budget: number[], hml: HML.Formula}[], budgets: {budget: number[], hml: HML.Formula}[]) {
        newAttackerWin.push(budgets.pop()!);
        budgets.forEach((budget) => {
            // flag to prohibit budgets being pushed multiple times
            let pushed: boolean = false;
            // another flag to check for dominance
            let dominated: boolean = false;
            for (let minBudget of newAttackerWin) {
                // budget is dominated by minbudget
                if (budget.budget.every((e_n, i) => { return e_n >= minBudget.budget[i] })) {
                    dominated = true;
                    break;
                }
                // budget dominates minbudget
                else {
                    if (budget.budget.every((e_n, i) => { return e_n <= minBudget.budget[i] })) {
                        newAttackerWin.splice(newAttackerWin.indexOf(minBudget), 1);
                        if (!pushed) {
                            newAttackerWin.push(budget);
                            pushed = true;
                        }
                    }
                }
            }
            // budget is not comparable to any minbudget in newAttackerWin
            if (!(dominated || pushed)) {
                newAttackerWin.push(budget);
            }
        });
    }


    export function computeWinningBudgets(game: Game) {
        // ln 2
        let attackerWin = new Map<Position, {budget: number[], hml: HML.Formula}[]>();
        game.positions.forEach((pos) => {
            attackerWin.set(pos, []);
        })
        // ln 3
        let todo: Position[] = [];
        game.defenderPositions.forEach((pos) => {
            if (pos.defenderStuck()) {
                todo.push(pos);
                attackerWin.set(pos, [{budget: Array(6).fill(0), hml: new HML.TrueFormula()}]);
            }
        })

        // ln 4
        while (todo.length > 0) {
            //ln 5 and 6
            let g = todo.pop()!;
            let newAttackerWin: {budget: number[], hml: HML.Formula}[] = [];
            // ln 7
            if (!g.isDefenderPosition) {
                // ln 8
                let minToFind: {budget: number[], hml: HML.Formula}[] = [...attackerWin.get(g)!];
                game.moves.forEach((move) => {
                    if (move.from == g) {
                        attackerWin.get(move.to)?.forEach((edash) => {
                            let newHML: HML.Formula = updateHML(edash.hml, move.update, move.actionName!);
                            minToFind.push({budget: inverseUpdate(edash.budget, move.update), hml: newHML});
                        })
                    }
                })
                computeMinimumBudgets(newAttackerWin, minToFind);
            }
            // ln 9
            else {
                if (g.defenderStuck()) {
                    game.moves.forEach((move) => {
                        if (move.to == g) {
                            todo.push(move.from);
                        }
                    })
                    continue;
                }
                // ln 10
                let defenderPost: Position[] = [];
                let options = new Map<Position, {budget: number[], hml: HML.Formula}[]>();
                // ln 10 and 11
                game.moves.forEach((move) => {
                    if (move.from == g) {
                        defenderPost.push(move.to)
                        attackerWin.get(move.to)!.forEach((energyLevel) => {
                            if (!options.has(move.to)) {
                                options.set(move.to, []);
                            }
                            options.get(move.to)!.push({budget: inverseUpdate(energyLevel.budget, move.update), hml: energyLevel.hml});
                        })
                    }
                })
                // ln 12
                // comparing cardinality should also be correct and more efficient
                if (defenderPost.every((gdash) => { return options.has(gdash) })) {
                    // ln 13
                    let optionsArray: {budget: number[], hml: HML.Formula}[][] = [];
                    for (let strats of options.values()) {
                        optionsArray.push(strats);
                    }
                    let minToFind: {budget: number[], hml: HML.Formula}[] = []
                    if (optionsArray.length == 1) {
                        minToFind.push(...optionsArray[0]);
                        minToFind.forEach((budget) => { budget.hml = new HML.ConjFormula([budget.hml]) });
                    }
                    optionsArray.forEach((gdashValues) => {
                        optionsArray.forEach((otherGdashValues) => {
                            if (gdashValues == otherGdashValues) {
                                return;
                            }
                            else {
                                gdashValues.forEach((energyLevel) => {
                                    otherGdashValues.forEach((otherEnergyLevel) => {
                                        let sup: {budget: number[], hml: HML.Formula} = {budget: [], hml: new HML.ConjFormula([energyLevel.hml, otherEnergyLevel.hml])};
                                        for (let k = 0; k < 6; k++) {
                                            sup.budget[k] = Math.max(energyLevel.budget[k], otherEnergyLevel.budget[k]);
                                        }
                                        minToFind.push(sup);
                                    })
                                })
                            }
                        })
                    })
                    computeMinimumBudgets(newAttackerWin, minToFind);
                }
            }
            //ln 16
            // duplicate elements shouldn't exist
            if (!(newAttackerWin.length == attackerWin.get(g)?.length &&
                newAttackerWin.every((energyLevel) => {
                    return attackerWin.get(g)?.some((otherEnergylevel) => {
                        return energyLevel.budget.every((e_i, i) => {
                            return e_i == otherEnergylevel.budget[i];
                        })
                    })
                })
            )) {
                // ln 17
                attackerWin.set(g, newAttackerWin);
                // ln 18
                game.moves.forEach((move) => {
                    if (move.to == g) {
                        todo.push(move.from);
                    }
                })
            }
        }
        // ln 19 and 20
        return attackerWin;
    }


    export function getEqualitiesFromEnergies(energyLevels: number[][]) {
        let equalities = {
            bisimulation: false,
            twoNestedSimulation: false,
            readySimulation: false,
            possibleFutures: false,
            simulation: false,
            readinessTraces: false,
            failureTraces: false,
            readiness: false,
            impossibleFutures: false,
            revivals: false,
            failures: false,
            traceInclusion: false,
            enabledness: false
        };
        // if there exists no distinguishing HML-formula, bisimulation applies
        if (energyLevels.length == 0) {
            for (let eq in equalities) {
                equalities[eq] = true;
            }
        }
        // if for all minimum energy budgets at least one dimension of each is greater than the "allowed" budget to refute, the equivalence applies
        else {
            // two-nested simulation
            if (energyLevels.every((energyLevel) => { return energyLevel[5] > 1 })) {
                for (let eq in equalities) {
                    if (eq === "bisimulation") {
                        continue;
                    }
                    equalities[eq] = true;
                }
            }
            else {
                // ready simulation
                if (energyLevels.every((energyLevel) => { return energyLevel[4] > 1 || energyLevel[5] > 1 })) {
                    for (let eq in equalities) {
                        if (["bisimulation", "twoNestedSimulation", "possibleFutures", "impossibleFutures"].indexOf(eq) > -1) {
                            continue;
                        }
                        equalities[eq] = true;
                    }
                }
                else {
                    // simulation
                    if (energyLevels.every((energyLevel) => { return energyLevel[4] > 0 || energyLevel[5] > 0 })) {
                        equalities["simulation"] = true;
                        equalities["traceInclusion"] = true;
                        equalities["enabledness"] = true;
                    }
                    else {
                        // trace equivalence
                        if (energyLevels.every((energyLevel) => { return energyLevel[1] > 1 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0 })) {
                            equalities["traceInclusion"] = true;
                            equalities["enabledness"] = true;
                        }
                        // enabledness
                        else {
                            if (energyLevels.every((energyLevel) => { return energyLevel[0] > 1 || energyLevel[1] > 1 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0 })) {
                                equalities["enabledness"] = true;
                            }
                        }
                    }
                    // readiness traces
                    if (energyLevels.every((energyLevel) => { return energyLevel[3] > 1 || energyLevel[4] > 1 || energyLevel[5] > 1 })) {
                        for (let eq in equalities) {
                            if (["bisimulation", "twoNestedSimulation", "readySimulation", "possibleFutures", "impossibleFutures", "simulation"].indexOf(eq) > -1) {
                                continue;
                            }
                            equalities[eq] = true;
                        }
                    }
                    else {
                        // failure trace
                        if (energyLevels.every((energyLevel) => { return energyLevel[3] > 0 || energyLevel[4] > 1 || energyLevel[5] > 1 })) {
                            equalities["failureTraces"] = true;
                            equalities["revivals"] = true;
                            equalities["failures"] = true;
                            equalities["traceInclusion"] = true;
                            equalities["enabledness"] = true;
                        }
                    }
                }
                // possible futures
                if (energyLevels.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[5] > 1 })) {
                    for (let eq in equalities) {
                        if (["bisimulation", "twoNestedSimulation", "readySimulation", "simulation", "readinessTraces", "failureTraces"].indexOf(eq) > -1) {
                            continue;
                        }
                        equalities[eq] = true;
                    }
                }
                else {
                    // impossible futures
                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[5] > 1 })) {
                        equalities["impossibleFutures"] = true;
                        equalities["failures"] = true;
                        equalities["traceInclusion"] = true;
                        equalities["enabledness"] = true;
                    }
                    else {
                        // failures
                        if (energyLevels.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[4] > 1 || energyLevel[5] > 1 })) {
                            equalities["failures"] = true;
                            equalities["traceInclusion"] = true;
                            equalities["enabledness"] = true;
                        }
                    }
                    // readiness
                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[2] > 1 || energyLevel[3] > 1 || energyLevel[4] > 1 || energyLevel[5] > 1 })) {
                        equalities["readiness"] = true;
                        equalities["revivals"] = true;
                        equalities["failures"] = true;
                        equalities["traceInclusion"] = true;
                        equalities["enabledness"] = true;
                    }
                    else {
                        if (energyLevels.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[2] > 1 || energyLevel[3] > 0 || energyLevel[4] > 1 || energyLevel[5] > 1 })) {
                            equalities["revivals"] = true;
                            equalities["failures"] = true;
                            equalities["traceInclusion"] = true;
                            equalities["enabledness"] = true;
                        }
                    }
                }
            }
        }
        return equalities;
    }
}