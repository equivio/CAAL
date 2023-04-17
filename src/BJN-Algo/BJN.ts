/// <reference path="../../lib/ccs.d.ts" />

module BJN{

    let idCounter = 0;

    class WithAutoIncrementedId{
        id: Number;

        constructor(){
            this.id = idCounter++;
        }
    }

    class Node{
        label: string;
        adj: Node[];

        constructor(label: string){
            this.label = label;
            this.adj = [];
        }
    }

    class Edge{
        from: Node;
        to: Node;
        label: string;

        constructor(from: Node, to: Node, label: string){
            this.from = from;
            this.to = to;
            this.label = label;
        }
    }

    class Graph{
        nodes: Node[];
        edges: Edge[];

        constructor(){
            this.nodes = [];
            this.edges = [];
        }

        addNode(label: string): Node{
            let node = new Node(label);
            this.nodes.push(node);
            return node;
        }

        addEdge(from: Node, to: Node, label: string): Edge{
            let edge = new Edge(from, to, label);
            from.adj.push(to);
            this.edges.push(edge);
            return edge;
        }
        getNodeByLabel(label: String){
            return this.nodes.find((node) => {
                return node.label === label;
            })
        }
    }

    export function parseForBJN(succGen: CCS.SuccessorGenerator){
        let graphForBJN = new Graph();
        succGen.getGraph().getNamedProcesses().forEach((name) => {
            graphForBJN.addNode(name);
        })
        graphForBJN.nodes.forEach((node) => {
            let process = succGen.getGraph().processByName(node.label);
            let transitions = succGen.getSuccessors(process.id);
            transitions.forEach((transition) => {
                graphForBJN.addEdge(node, graphForBJN.getNodeByLabel(transition.targetProcess.toString()), transition.action.getLabel());
            })
        })
        return graphForBJN;
    }


    class Position extends WithAutoIncrementedId{
        p: Node;
        qSet?: Node[]
        qStarSet?: Node[]
        q?: Node;
        isDefenderPosition: boolean

        constructor(p:Node, isDefenderPosition: boolean, qSet?:Node[], qStarSet?:Node[], q?:Node){
            // assign index
            super();
            this.p = p;
            this.qSet = qSet || undefined;
            this.qStarSet = qStarSet || undefined;
            this.q = q || undefined;
            this.isDefenderPosition = isDefenderPosition;
        }

        defenderStuck() {
            if(!this.isDefenderPosition) {
                throw new Error("Not a defender position.");
            }
            return (this.qSet?.length == 0 && this.qStarSet?.length == 0)
        }

        isEqualTo(otherPos: Position){
            // check for equality of p
            if (!(this.p.label === otherPos.p.label)){ return false; }

            // check for set equality of qSet
            if ((this.qSet && otherPos.qSet)){
                if (!(this.qSet.every((q) => {
                    return otherPos.qSet!.some((otherq) => { return q.label === otherq.label })
                })
                && otherPos.qSet.every((otherq) => {
                    return this.qSet!.some((q) => { return otherq.label === q.label })
                }))){
                    return false;
                }
            }
            else{
                if (this.qSet || otherPos.qSet){ return false; }
            }

            // check for set equality of qStarSet
            if ((this.qStarSet && otherPos.qStarSet)){
                if (!(this.qStarSet.every((q) => {
                    return otherPos.qStarSet!.some((otherq) => { return q.label === otherq.label })
                })
                && otherPos.qStarSet.every((otherq) => {
                    return this.qStarSet!.some((q) => { return otherq.label === q.label })
                }))){
                    return false;
                }
            }
            else{
                if (this.qStarSet || otherPos.qStarSet){ return false; }
            }

            // check for equality of q
            if (this.q && otherPos.q){
                if (!(this.q.label === otherPos.q.label)) { return false; }
            }
            else{
                if (this.q || otherPos.q) { return false; }
            }

            return true;
        }
    }


    class Move{
        from: Position;
        to: Position;
        update: (number | number[])[];

        constructor(from: Position, to: Position, update: (number | number[])[]){
            this.from = from;
            this.to = to;
            this.update = update
        }
    }

    function findTwoPartitions(set: Node[]){
        let combinations: Node[][] = [[]];
        for(let i = 0; i < Math.pow(2, set.length); i++){
            let combination = [];
            for(let j = 0; j < set.length; j++){
                if ((i & Math.pow(2,j))){
                    combination.push(set[j]);
                }
            }
            if (combination.length != 0){
                combinations.push(combination);
            }
        }
        return combinations;
    }

    function getSetDifference(set: Node[], subset: Node[]){
        if (subset.length == 0){
            return set;
        }
        return set.filter((elem) => {
            return subset.every((e) => { return elem != e; })
        })
    }


    export class Game{
        positions: Position[];
        defenderPositions: Position[];
        moves: Move[];

        constructor(g: Graph, firstNode: Node, secondNode: Node) {
            this.positions = [];
            this.defenderPositions = [];
            this.moves = [];
            this.createGameGraph(g, firstNode, secondNode);
        }

        addPosition(position: Position){
            this.positions.push(position);
            if (position.isDefenderPosition){
                this.defenderPositions.push(position);
            }
            return position;
        }

        addMove(move: Move){
            this.moves.push(move);
        }

        createGameGraph(g: Graph, firstNode: Node, secondNode: Node){
            // initialize stack with start position
            let startPosition = new Position(firstNode, false, [secondNode], undefined, undefined);
            this.addPosition(startPosition);
            let todo: Position[] = [startPosition];
            while (todo.length > 0){
                let pos = todo.pop()!;
                if (pos.isDefenderPosition){
                    // conjunctive revival
                    if (pos.qStarSet!.length > 0){
                        let newPos: Position = new Position(pos.p, false, pos.qStarSet, undefined, undefined);
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })){
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, [[1,3],0,0,0,0,0]));
                            todo.push(newPos);
                        }
                        else{
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos)} )
                            if (!destPos){ throw new Error("Position does not exist despite check"); }
                            this.addMove(new Move(pos, destPos, [[1,3],0,0,0,0,0]))
                        }
                    }
                    // conjunctive answers
                    pos.qSet!.forEach((q) => {
                        let newPos: Position = new Position(pos.p, false, undefined, undefined, q);
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })){
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, [0,0,0,[3,4],0,0]));
                            todo.push(newPos);
                        }
                        else{
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                            if (!destPos){ throw new Error("Position does not exist despite check"); }
                            this.addMove(new Move(pos, destPos, [0,0,0,[3,4],0,0]))
                        }
                    })
                }
                else{
                    // attacker clause positions
                    if (pos.q){
                        // positive decisions
                        let newPos: Position = new Position(pos.p, false, [pos.q], undefined, undefined);
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })){
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, [[1,4],0,0,0,0,0]));
                            todo.push(newPos);
                        }
                        else{
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                            if (!destPos){ throw new Error("Position does not exist despite check"); }
                            this.addMove(new Move(pos, destPos, [[1,4],0,0,0,0,0]))
                        }
                        // negative decisions
                        if (pos.p.label != pos.q.label){
                            let newPos: Position = new Position(pos.q, false, [pos.p], undefined, undefined);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })){
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [[1,5],0,0,0,0,-1]));
                                todo.push(newPos);
                            }
                            else{
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                if (!destPos){ throw new Error("Position does not exist despite check"); }
                                this.addMove(new Move(pos, destPos, [[1,5],0,0,0,0,-1]))
                            }
                        }
                    }
                    else{
                        // observation moves
                        g.edges.forEach((edge) => {
                            if (edge.from.label === pos.p.label){
                                let newQSet: Node[] = [];
                                g.edges.forEach((e) => {
                                    if (e.label === edge.label){
                                        pos.qSet!.forEach((q) => {
                                            if (e.from.label === q.label){
                                                // duplicates?
                                                newQSet.push(e.to);
                                            }
                                        })
                                    }
                                })
                                let newPos: Position = new Position(edge.to, false, newQSet, undefined, undefined);
                                // check if newPos was already discovered to avoid duplicates
                                if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })){
                                    this.addPosition(newPos);
                                    this.addMove(new Move(pos, newPos, [-1,0,0,0,0,0]));
                                    todo.push(newPos);
                                }
                                else{
                                    let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                    if (!destPos){ throw new Error("Position does not exist despite check"); }
                                    this.addMove(new Move(pos, destPos, [-1,0,0,0,0,0]))
                                }
                            }
                        })

                        // conjunctional challenges
                        let twoPartitions: Node[][] = findTwoPartitions(pos.qSet!)
                        twoPartitions.forEach((partition) => {
                            let newPos: Position = new Position(pos.p, true, partition, getSetDifference(pos.qSet!, partition), undefined);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })){
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [0,-1,0,0,0,0]));
                                todo.push(newPos);
                            }
                            else{
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                if (!destPos){ throw new Error("Position does not exist despite check"); }
                                this.addMove(new Move(pos, destPos, [0,-1,0,0,0,0]))
                            }
                        })
                    }
                }
            }
        }
    }


    function inverseUpdate(energyLevel: number[], update: (number | number[])[]){
        let parts: number[][] = [[...energyLevel]];
        update.forEach((u_i, i) => {
            //relative updates
            if (typeof(u_i) == "number"){
                parts[0][i] -= u_i;
            }
            // minimum selection updates (index starts at one)
            else{
                let part = Array(6).fill(0);
                part[u_i[0]-1] = energyLevel[i];
                part[u_i[1]-1] = energyLevel[i];
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


    function computeMinimumBudgets(newAttackerWin: number[][] , budgets: number[][]){
        newAttackerWin.push(budgets.pop()!);
        budgets.forEach((budget) => {
            // flag to prohibit budgets being pushed multiple times
            let pushed: boolean = false;
            // another flag to check for dominance
            let dominated: boolean = false;
            for (let minBudget of newAttackerWin){
                // budget is dominated by minbudget
                if (budget.every((e_n, i) => {return e_n >= minBudget[i]})) {
                    dominated = true;
                    break;
                }
                // budget dominates minbudget
                else{
                    if (budget.every((e_n, i) => {return e_n <= minBudget[i]})){
                        newAttackerWin.splice(newAttackerWin.indexOf(minBudget), 1);
                        if (!pushed){
                            newAttackerWin.push(budget);
                            pushed = true;
                        }
                    }
                }
            }
            // budget is not comparable to any minbudget in newAttackerWin
            if (!(dominated || pushed)){
                newAttackerWin.push(budget);
            }
        });
    }


    export function computeWinningBudgets(game: Game){
        // ln 2
        let attackerWin = new Map<Position, number[][]>();
        game.positions.forEach((pos) => {
            attackerWin.set(pos, []);
        })
        // ln 3
        let todo: Position[] = [];
        game.defenderPositions.forEach((pos) => {
            if(pos.defenderStuck()){
                todo.push(pos);
                attackerWin.set(pos, [Array(6).fill(0)]);
            }
        })

        // ln 4
        while (todo.length > 0){
            //ln 5 and 6
            let g = todo.pop()!;
            let newAttackerWin: number[][] = [];
            // ln 7
            if (!g.isDefenderPosition){
                // ln 8
                let minToFind: number[][] = [...attackerWin.get(g)!];
                game.moves.forEach((move) => {
                    if (move.from == g){
                        attackerWin.get(move.to)?.forEach((edash) => {
                            minToFind.push(inverseUpdate(edash, move.update));
                        })
                    }
                })
                computeMinimumBudgets(newAttackerWin, minToFind);
            }
            // ln 9
            else{
                if (g.defenderStuck()){
                    game.moves.forEach((move) => {
                        if (move.to == g){
                            todo.push(move.from);
                        }
                    })
                    continue;
                }
                // ln 10
                let defenderPost: Position[] = [];
                let options = new Map<Position, number[][]>();
                // ln 10 and 11
                game.moves.forEach((move) => {
                    if (move.from == g){
                        defenderPost.push(move.to)
                        attackerWin.get(move.to)!.forEach((energyLevel) => {
                            if (!options.has(move.to)){
                                options.set(move.to, []);
                            }
                            options.get(move.to)!.push(inverseUpdate(energyLevel, move.update));
                        })
                    }
                })
                // ln 12
                // comparing cardinality should also be correct and more efficient
                if (defenderPost.every((gdash) => { return options.has(gdash)})){
                    // ln 13
                    let optionsArray: number[][][] = [];
                    for (let strats of options.values()){
                        optionsArray.push(strats);
                    }
                    let minToFind: number[][] = []
                    if (optionsArray.length == 1){
                        minToFind.push(...optionsArray[0]);
                    }
                    optionsArray.forEach((gdashValues) => {
                        optionsArray.forEach((otherGdashValues) => {
                            if (gdashValues == otherGdashValues){
                                return;
                            }
                            else{
                                gdashValues.forEach((energyLevel) =>{
                                    otherGdashValues.forEach((otherEnergyLevel) => {
                                        let sup: number[] = [];
                                        for (let k = 0; k<6; k++){
                                            sup[k] = Math.max(energyLevel[k], otherEnergyLevel[k]);
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
                        return energyLevel.every((e_i, i) => {
                            return e_i == otherEnergylevel[i]
                        })
                    })
                })
            )) {
                // ln 17
                attackerWin.set(g, newAttackerWin);
                // ln 18
                game.moves.forEach((move) => {
                    if (move.to == g){
                        todo.push(move.from);
                    }
                })
            }
        }
        // ln 19 and 20
        return attackerWin;
    }


    function getEqualitiesFromEnergies(energyLevels: number[][]){
        let equalities: String[] = [];
        // if there exists no distinguishing HML-formula, bisimulation applies
        if (!energyLevels[0]){
            equalities.push("bisimulation");
        }
        // if for all minimum energy budgets at least one dimension of each is greater than the "allowed" budget to refute, the equivalence applies
        else{
            if (energyLevels.every((energyLevel) => { return energyLevel[5] > 1})){
                equalities.push("2-nested simulation");
            }
            else{
                if (energyLevels.every((energyLevel) => { return energyLevel[4] > 1 || energyLevel[5] > 1})){
                    equalities.push("ready simulation");
                }
                else{
                    if (energyLevels.every((energyLevel) => { return energyLevel[4] > 0 || energyLevel[5] > 0})){
                        equalities.push("simulation");
                    }
                    else{
                        if (energyLevels.every((energyLevel) => { return energyLevel[1] > 1 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0})){
                            equalities.push("traces");
                        }
                        else{
                            if (energyLevels.every((energyLevel) => { return energyLevel[0] > 1 || energyLevel[1] > 1 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0})){
                                equalities.push("enabledness");
                            }
                        }
                    }
                    if (energyLevels.every((energyLevel) => { return energyLevel[3] > 1 || energyLevel[4] > 1 || energyLevel[5] > 1})){
                        equalities.push("readiness traces");
                    }
                    else{
                        if (energyLevels.every((energyLevel) => { return energyLevel[3] > 0 || energyLevel[4] > 1 || energyLevel[5] > 1})){
                            equalities.push("failure trace");
                        }
                    }
                }
                if (energyLevels.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[5] > 1})){
                    equalities.push("possible futures");
                }
                else{
                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[5] > 1})){
                        equalities.push("impossible futures");
                    }
                    else{
                        if (energyLevels.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[2] > 0 || energyLevel[3] > 0 || energyLevel[4] > 1 || energyLevel[5] > 1})){
                            equalities.push("failures");
                        }
                    }
                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[2] > 1 || energyLevel[3] > 1 || energyLevel[4] > 1 || energyLevel[5] > 1})){
                        equalities.push("readiness");
                    }
                    else{
                        if (energyLevels.every((energyLevel) => { return energyLevel[1] > 2 || energyLevel[2] > 1 || energyLevel[3] > 0 || energyLevel[4] > 1 || energyLevel[5] > 1})){
                            equalities.push("revivals");
                        }
                    }
                }
            }
        }
        return equalities;
    }
}