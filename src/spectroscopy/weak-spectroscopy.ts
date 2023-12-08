/// <reference path="../../lib/ccs.d.ts" />

module WeakSpectroscopy {

    let idCounter = 0;

    class WithAutoIncrementedId {
        protected id: Number;

        constructor() {
            this.id = idCounter++;
        }
    }

    export class Position extends WithAutoIncrementedId {
        public p: CCS.Process;
        public qSet?: CCS.Process[];
        public q?: CCS.Process;
        public alpha?: CCS.Action;
        public pPrime?: CCS.Process;
        public qSetAlpha?: CCS.Process[];
        public isDefenderPosition: boolean;
        public isDelayedPosition: boolean;
        public isStablePosition: boolean;
        public isBranchingPosition: boolean;

        constructor(p: CCS.Process, isDefenderPosition: boolean, isDelayedPosition: boolean, isStablePosition: boolean, isBranchingPosition: boolean,
            qSet?: CCS.Process[], q?: CCS.Process, alpha?: CCS.Action, pPrime?: CCS.Process, qSetAlpha?: CCS.Process[]) {
            // assign index
            super();
            this.p = p;
            this.qSet = qSet;
            this.q = q;
            this.isDefenderPosition = isDefenderPosition;
            this.alpha = alpha;
            this.pPrime = pPrime;
            this.qSetAlpha = qSetAlpha;
            this.isDelayedPosition = isDelayedPosition;
            this.isStablePosition = isStablePosition;
            this.isBranchingPosition = isBranchingPosition;
        }

        public defenderStuck(moves: Move[]) {
            if (!this.isDefenderPosition) { throw new Error("Not a defender position."); }
            if (!this.isBranchingPosition) { return this.qSet!.length === 0; }
            if (this.qSet!.length !== 0) { return false; }
            // check for possible moves from this position
            return !moves.some((move) => { return this.isEqualTo(move.from) });
        }

        public isEqualTo(otherPos: Position) {
            // check for flags
            if (!(this.isBranchingPosition === otherPos.isBranchingPosition && this.isDefenderPosition === otherPos.isDefenderPosition
                 && this.isDelayedPosition === otherPos.isDelayedPosition && this.isStablePosition === otherPos.isStablePosition)) { return false; }

            // check for equality of p
            if (!(this.p.id === otherPos.p.id)) { return false; }

            // check for equality of q
            if (this.q && otherPos.q) {
                if (!(this.q.id === otherPos.q.id)) { return false; }
            } else {
                if (this.q || otherPos.q) { return false; }
            }

            // check for set equality of qSet
            if ((this.qSet && otherPos.qSet)) {
                if (!(this.qSet.every((q) => {
                    return otherPos.qSet!.some((otherq) => { return q.id === otherq.id })
                })
                    && otherPos.qSet.every((otherq) => {
                        return this.qSet!.some((q) => { return otherq.id === q.id })
                    }))) {
                    return false;
                }
            }
            else {
                if (this.qSet || otherPos.qSet) { return false; }
            }

            // check for equality of pPrime
            if (this.pPrime && otherPos.pPrime) {
                if (!(this.pPrime.id === otherPos.pPrime.id)) { return false; }
            } else {
                if (this.pPrime || otherPos.pPrime) { return false; }
            }

            // check for equality of alpha
            if (this.alpha && otherPos.alpha) {
                if (!(this.alpha.equals(otherPos.alpha))) { return false; }
            } else {
                if (this.alpha || otherPos.alpha) { return false; }
            }


            // check for set equality of qSetAlpha
            if ((this.qSetAlpha && otherPos.qSetAlpha)) {
                if (!(this.qSetAlpha.every((q) => {
                    return otherPos.qSetAlpha!.some((otherq) => { return q.id === otherq.id })
                })
                    && otherPos.qSetAlpha.every((otherq) => {
                        return this.qSetAlpha!.some((q) => { return otherq.id === q.id })
                    }))) {
                    return false;
                }
            }
            else {
                if (this.qSetAlpha || otherPos.qSetAlpha) { return false; }
            }

            return true;
        }

        // TODO: adjust for weak spectroscopy positions when needed for energy game view
        // public toString(): string {
        //     let str = "(" + this.p.toString() + ",";
        //     if (this.q) {
        //         str += this.q.toString()
        //     }
        //     else {
        //         str += "{"
        //         for (let i = 0; i < this.qSet!.length; i++) {
        //             str += this.qSet![i].toString();
        //             str += i < this.qSet!.length - 1 ? "," : ""
        //         }
        //         str += "}";
        //         if (this.qStarSet) {
        //             str += ",{";
        //             for (let i = 0; i < this.qStarSet!.length; i++) {
        //                 str += this.qStarSet![i].toString();
        //                 str += i < this.qStarSet!.length - 1 ? "," : ""
        //             }
        //             str += "}";
        //         }

        //     }
        //     str += ")"
        //     return str;
        // }
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
            for (let i = 0; i < 8; i++) {
                let dim = this.update[i];
                // check if dim is relative or minimum selection update
                if (Number.isFinite(dim)) {
                    str += dim;
                }
                else {
                    str += "min(" + dim[0] + "," + dim[1] + ")";
                }
                str += i < 7 ? "," : ")"
            }
            return str;
        }
    }

    function findTwoPartitions(set: CCS.Process[]) {
        let combinations: CCS.Process[][] = [[]];
        for (let i = 0; i < Math.pow(2, set.length); i++) {
            let combination: CCS.Process[] = [];
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

    function getSetDifference(set: CCS.Process[], subset: CCS.Process[]) {
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

        constructor(strongSuccGen: CCS.SuccessorGenerator, weakSuccGen: CCS.SuccessorGenerator, firstProcess: CCS.Process, secondProcess: CCS.Process) {
            this.positions = [];
            this.defenderPositions = [];
            this.moves = [];
            this.createGameGraph(strongSuccGen, weakSuccGen, firstProcess, secondProcess);
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

        private createGameGraph(strongSuccGen: CCS.SuccessorGenerator, weakSuccGen: CCS.SuccessorGenerator, firstProcess: CCS.Process, secondProcess: CCS.Process) {
            // initialize stack with start position
            let startPosition = new Position(firstProcess, false, false, false, false, [secondProcess]);
            this.addPosition(startPosition);
            let todo: Position[] = [startPosition];
            while (todo.length > 0) {
                let pos = todo.pop()!;
                if (pos.isDefenderPosition) {
                    // conjunctive (stable) / branching answers
                    pos.qSet!.forEach((q) => {
                        let newPos: Position = new Position(pos.p, false, false, false, false, undefined, q);
                        let update = Array(8).fill(0);
                        if (pos.isStablePosition) {
                            update[3] = -1;
                        } else {
                            if (pos.isBranchingPosition) {
                                update[1] = -1;
                                update[2] = -1;
                            } else {
                                update[2] = -1;
                            }
                        }
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, update));
                            todo.push(newPos);
                        }
                        else {
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                            if (!destPos) { throw new Error("Position does not exist despite check"); }
                            this.addMove(new Move(pos, destPos, update))
                        }
                    })

                    // branching observations
                    if (pos.isBranchingPosition){
                        let qSetPrime: CCS.Process[] = [];
                        let isTau: boolean = pos.alpha!.getLabel() === "tau";
                        pos.qSetAlpha!.forEach((proc) => {
                            let transitions = strongSuccGen.getSuccessors(proc.id).transitionsForAction(pos.alpha!);
                            transitions.forEach((transition) => { qSetPrime.push(transition.targetProcess); })
                            if (isTau && !qSetPrime.some((position) => { return proc.id === position.id; })){ qSetPrime.push(proc); }
                        })
                        let newPos: Position = new Position(pos.pPrime!, false, false, false, true, qSetPrime);
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, [[1,6],-1,-1,0,0,0,0,0]));
                            todo.push(newPos);
                        }
                        else {
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                            if (!destPos) { throw new Error("Position does not exist despite check"); }
                            this.addMove(new Move(pos, destPos, [[1,6],-1,-1,0,0,0,0,0]))
                        }
                    }
                }
                else {
                    // clause positions
                    if (pos.q) {
                        // positive clauses
                        let qSet: CCS.Process[] = [];
                        weakSuccGen.getSuccessors(pos.q.id).transitionsForAction(new CCS.Action("tau", false)).forEach((transition) => {
                            qSet.push(transition.targetProcess);
                        });
                        if (!qSet.some((q) => { return q.id === pos.q!.id; })){ qSet.push(pos.q!); }
                        let newPos: Position = new Position(pos.p, false, true, false, false, qSet);
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, [[1,6],0,0,0,0,0,0,0]));
                            todo.push(newPos);
                        }
                        else {
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                            if (!destPos) { throw new Error("Position does not exist despite check"); }
                            this.addMove(new Move(pos, destPos, [[1,6],0,0,0,0,0,0,0]));
                        }
                        // negative clauses
                        if (pos.p.id !== pos.q.id) {
                            qSet = [];
                            weakSuccGen.getSuccessors(pos.p.id).transitionsForAction(new CCS.Action("tau", false)).forEach((transition) => {
                                qSet.push(transition.targetProcess);
                            });
                            if (!qSet.some((q) => { return q.id === pos.p.id; })){ qSet.push(pos.p); }
                            let newPos: Position = new Position(pos.q, false, true, false, false, qSet);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [[1,7],0,0,0,0,0,0,-1]));
                                todo.push(newPos);
                            }
                            else {
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                if (!destPos) { throw new Error("Position does not exist despite check"); }
                                this.addMove(new Move(pos, destPos, [[1,7],0,0,0,0,0,0,-1]))
                            }
                        }
                    } else {

                        // branching accounting
                        if(pos.isBranchingPosition) {
                            let newPos: Position = new Position(pos.p, false, false, false, false, pos.qSet);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [-1,0,0,0,0,0,0,0]));
                                todo.push(newPos);
                            }
                            else {
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                if (!destPos) { throw new Error("Position does not exist despite check"); }
                                this.addMove(new Move(pos, destPos, [-1,0,0,0,0,0,0,0]))
                            }
                        }

                        if (!(pos.isBranchingPosition || pos.isDelayedPosition || pos.isStablePosition)){
                            // delay
                            let qSet: CCS.Process[] = [];
                            pos.qSet!.forEach((proc) => {
                                weakSuccGen.getSuccessors(proc.id).transitionsForAction(new CCS.Action("tau", false)).forEach((transition) => {
                                    qSet.push(transition.targetProcess);
                                });
                                if (!qSet.some((q) => { return q.id === proc.id; })){ qSet.push(proc); }
                            });
                            let newPos: Position = new Position(pos.p, false, true, false, false, qSet);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [0,0,0,0,0,0,0,0]));
                                todo.push(newPos);
                            }
                            else {
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                if (!destPos) { throw new Error("Position does not exist despite check"); }
                                this.addMove(new Move(pos, destPos, [0,0,0,0,0,0,0,0]))
                            }

                            // finishing
                            if (pos.qSet!.length === 0){
                                let newPos: Position = new Position(pos.p, true, false, false, false, []);
                                // check if newPos was already discovered to avoid duplicates
                                if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                    this.addPosition(newPos);
                                    this.addMove(new Move(pos, newPos, [0,0,0,0,0,0,0,0]));
                                    todo.push(newPos);
                                }
                                else {
                                    let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                    if (!destPos) { throw new Error("Position does not exist despite check"); }
                                    this.addMove(new Move(pos, destPos, [0,0,0,0,0,0,0,0]));
                                }
                            } else {
                                // early conjunction
                                let newPos: Position = new Position(pos.p, true, false, false, false, pos.qSet!);
                                // check if newPos was already discovered to avoid duplicates
                                if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                    this.addPosition(newPos);
                                    this.addMove(new Move(pos, newPos, [0,0,0,0,-1,0,0,0]));
                                    todo.push(newPos);
                                }
                                else {
                                    let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                    if (!destPos) { throw new Error("Position does not exist despite check"); }
                                    this.addMove(new Move(pos, destPos, [0,0,0,0,-1,0,0,0]));
                                }
                            }
                        }

                        if (pos.isDelayedPosition){
                            // procrastination
                            let pTransitions: CCS.TransitionSet = strongSuccGen.getSuccessors(pos.p.id);
                            pTransitions.transitionsForAction(new CCS.Action("tau", false)).forEach((transition) => {
                                if (transition.targetProcess.id === pos.p.id) { return; }
                                let newPos: Position = new Position(transition.targetProcess, false, true, false, false, pos.qSet!);
                                // check if newPos was already discovered to avoid duplicates
                                if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                    this.addPosition(newPos);
                                    this.addMove(new Move(pos, newPos, [0,0,0,0,0,0,0,0]));
                                    todo.push(newPos);
                                }
                                else {
                                    let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                    if (!destPos) { throw new Error("Position does not exist despite check"); }
                                    this.addMove(new Move(pos, destPos, [0,0,0,0,0,0,0,0]));
                                }
                            })

                            // observation
                            let qTransitions: CCS.TransitionSet[] = [];
                            let qPrimes = {};
                            pos.qSet!.forEach((q) => {
                                qTransitions.push(strongSuccGen.getSuccessors(q.id));
                            })

                            pTransitions.forEach((pTransition) => {
                                let actionName: string = pTransition.action.getLabel();
                                if (actionName === "tau") { return; }
                                if (!qPrimes[actionName]){
                                    let qPrimesForAction: CCS.Process[] = []
                                    qTransitions.forEach((qTrans) => {
                                        qTrans.transitionsForAction(pTransition.action).forEach((qTransition) => {
                                            qPrimesForAction.push(qTransition.targetProcess)
                                        })
                                    })
                                    qPrimes[actionName] = qPrimesForAction;
                                }
                                let newPos: Position = new Position(pTransition.targetProcess, false, false, false, false, qPrimes[actionName]);
                                // check if newPos was already discovered to avoid duplicates
                                if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                    this.addPosition(newPos);
                                    this.addMove(new Move(pos, newPos, [-1,0,0,0,0,0,0,0], actionName));
                                    todo.push(newPos);
                                }
                                else {
                                    // omit redundant loops
                                    if (!newPos.isEqualTo(pos)){
                                        let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                        if (!destPos) { throw new Error("Position does not exist despite check"); }
                                        this.addMove(new Move(pos, destPos, [-1,0,0,0,0,0,0,0], actionName))
                                    }
                                }
                            })
                            
                            // late instable conjunction
                            let newPos: Position = new Position(pos.p, true, false, false, false, pos.qSet!);
                                // check if newPos was already discovered to avoid duplicates
                                if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                    this.addPosition(newPos);
                                    this.addMove(new Move(pos, newPos, [0,0,0,0,0,0,0,0]));
                                    todo.push(newPos);
                                }
                                else {
                                    let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                    if (!destPos) { throw new Error("Position does not exist despite check"); }
                                    this.addMove(new Move(pos, destPos, [0,0,0,0,0,0,0,0]));
                                }
                            
                            // late stable conjunction
                            if (strongSuccGen.getSuccessors(pos.p.id).transitionsForAction(new CCS.Action("tau", false)).length === 0){
                                let qSetPrime: CCS.Process[] = [];
                                pos.qSet!.forEach((proc) => {
                                    if (strongSuccGen.getSuccessors(proc.id).transitionsForAction(new CCS.Action("tau", false)).length === 0) { qSetPrime.push(proc); }
                                })
                                let newPos: Position = new Position(pos.p, true, false, true, false, qSetPrime);
                                // check if newPos was already discovered to avoid duplicates
                                if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                    this.addPosition(newPos);
                                    this.addMove(new Move(pos, newPos, [0,0,0,0,0,0,0,0]));
                                    todo.push(newPos);
                                }
                                else {
                                    let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                    if (!destPos) { throw new Error("Position does not exist despite check"); }
                                    this.addMove(new Move(pos, destPos, [0,0,0,0,0,0,0,0]));
                                }
                            }

                            // branching conjunctions
                            let partitionsForAlpha = {};
                            pTransitions.forEach((transition) => {
                                // the attacker always wants to have all q \in Q in Q_alpha that don't have any strong outgoing alpha-transitions
                                if (!partitionsForAlpha[transition.action.getLabel()]){
                                    partitionsForAlpha[transition.action.getLabel()] = [];
                                    let qSetAlphaBase: CCS.Process[] = []
                                    pos.qSet!.forEach((proc) => {
                                        if (strongSuccGen.getSuccessors(proc.id).transitionsForAction(transition.action).length === 0){qSetAlphaBase.push(proc);}
                                    })
                                    let partitions: CCS.Process[][] =  findTwoPartitions(getSetDifference(pos.qSet!, qSetAlphaBase));
                                    partitions.forEach((partition) => {
                                        let qSetAlpha: CCS.Process[] = [...qSetAlphaBase, ...partition];
                                        if (qSetAlpha.length > 0){
                                            partitionsForAlpha[transition.action.getLabel()].push([getSetDifference(pos.qSet!, qSetAlpha), qSetAlpha]);
                                        }
                                    })
                                }
                                partitionsForAlpha[transition.action.getLabel()].forEach((partition) => {
                                    let newPos: Position = new Position(pos.p, true, false, false, true, partition[0], undefined, transition.action, transition.targetProcess, partition[1]);
                                    // check if newPos was already discovered to avoid duplicates
                                    if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos) })) {
                                        this.addPosition(newPos);
                                        this.addMove(new Move(pos, newPos, [0,0,0,0,0,0,0,0]));
                                        todo.push(newPos);
                                    }
                                    else {
                                        let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos) })
                                        if (!destPos) { throw new Error("Position does not exist despite check"); }
                                        this.addMove(new Move(pos, destPos, [0,0,0,0,0,0,0,0]));
                                    }
                                })
                            })
                        }
                    }
                }
            }
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
        for (let i = 0; i < 8; i++) {
            if (Array.isArray(update[i])) {
                updatedBudget[i] = Math.min(budget[update[i][0] - 1], budget[update[i][1] - 1]);
            }
            else {
                updatedBudget[i] = budget[i] + update[i];
            }
        }
        return updatedBudget;
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
                let part = Array(8).fill(0);
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

    // distinguishing HML-formulas not implemtented yet
    export function computeWinningBudgets(game: Game) {
        // ln 2
        let attackerWin = new Map<Position, {budget: number[], hml: HML.Formula}[]>();
        game.positions.forEach((pos) => {
            attackerWin.set(pos, []);
        })
        // ln 3
        let todo: Position[] = [];
        game.defenderPositions.forEach((pos) => {
            if (pos.defenderStuck(game.moves)) {
                todo.push(pos);
                attackerWin.set(pos, [{budget: Array(8).fill(0), hml: new HML.TrueFormula()}]);
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
                            // let newHML: HML.Formula = updateHML(edash.hml, move.update, move.actionName!);
                            // minToFind.push({budget: inverseUpdate(edash.budget, move.update), hml: newHML});
                            minToFind.push({budget: inverseUpdate(edash.budget, move.update), hml: edash.hml});
                        })
                    }
                })
                computeMinimumBudgets(newAttackerWin, minToFind);
            }
            // ln 9
            else {
                if (g.defenderStuck(game.moves)) {
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
                        // minToFind.forEach((budget) => { budget.hml = new HML.ConjFormula([budget.hml]) });
                    }
                    optionsArray.forEach((gdashValues) => {
                        optionsArray.forEach((otherGdashValues) => {
                            if (gdashValues == otherGdashValues) {
                                return;
                            }
                            else {
                                gdashValues.forEach((energyLevel) => {
                                    otherGdashValues.forEach((otherEnergyLevel) => {
                                        // let sup: {budget: number[], hml: HML.Formula} = {budget: [], hml: new HML.ConjFormula([energyLevel.hml, otherEnergyLevel.hml])};
                                        let sup: {budget: number[], hml: HML.Formula} = {budget: [], hml: energyLevel.hml};
                                        for (let k = 0; k < 8; k++) {
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
            srbbisim: false,
            bbisim: false,
            srdbisim: false,
            dbisim: false,
            etabisim: false,
            sbisim: false,
            bisimulation: false,
            etasim: false,
            simulation: false,
            twoNestedSimulation: false,
            readySimulation: false,
            csim: false,
            possibleFutures: false,
            readiness: false,
            impossibleFutures: false,
            failures: false,
            traceInclusion: false,
            srsim: false,
            scsim: false,
            sreadiness: false,
            sifutures: false,
            sfailures: false
        };
        // if there exists no distinguishing HML-formula, srbbisim applies
        if (energyLevels.length == 0) {
            for (let eq in equalities) {
                equalities[eq] = true;
            }
        }
        // if for all minimum energy budgets at least one dimension of each is greater than the "allowed" budget to refute, the equivalence applies
        else {
            // bbisim
            if (energyLevels.every((energyLevel) => { return energyLevel[3] > 0 })) {
                for (let eq in equalities) {
                    if (["srbbisim", "srdbisim", "sbisim", "srsim", "scsim", "sreadiness", "sifutures", "sfailures"].indexOf(eq) > -1) {
                        continue;
                    }
                    equalities[eq] = true;
                }
            }
            else {
                // etabisim
                if (energyLevels.every((energyLevel) => { return energyLevel[3] > 0 || energyLevel[4] > 0 })) {
                    for (let eq in equalities) {
                        if (["srbbisim", "bbisim", "srdbisim", "dbisim", "sbisim", "srsim", "scsim", "sreadiness", "sifutures", "sfailures"].indexOf(eq) > -1) {
                            continue;
                        }
                        equalities[eq] = true;
                    }
                }
                else{
                    // etasim
                    if (energyLevels.every((energyLevel) => { return energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[6] > 0 || energyLevel[7] > 0 })) {
                        equalities["etasim"] = true;
                        equalities["simulation"] = true;
                        equalities["traceInclusion"] = true;
                        }
                    else {
                        // simulation
                        if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[6] > 0 || energyLevel[7] > 0 })) {
                            equalities["simulation"] = true;
                            equalities["traceInclusion"] = true;
                        }
                        else{
                            // traceInclusion
                            if (energyLevels.every((energyLevel) => { return energyLevel.slice(1).some((dim) => { return dim > 0; }) })) {
                                equalities["traceInclusion"] = true;
                            }
                        }
                    }
                }
                // dbisim
                if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[3] > 0 })) {
                    for (let eq in equalities) {
                        if (["srbbisim", "srdbisim", "bbisim", "etabisim", "etasim", "sbisim", "srsim", "scsim", "sreadiness", "sifutures", "sfailures"].indexOf(eq) > -1) {
                            continue;
                        }
                        equalities[eq] = true;
                    }
                }
                else {
                    // bisimulation
                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 })) {
                        for (let eq in equalities) {
                            if (["srbbisim", "srdbisim", "bbisim", "dbisim", "etabisim", "etasim", "sbisim", "srsim", "scsim", "sreadiness", "sifutures", "sfailures"].indexOf(eq) > -1) {
                                continue;
                            }
                            equalities[eq] = true;
                        }
                    }
                    else {
                        // twoNestedSimulation
                        if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[7] > 1 })) {
                            equalities["twoNestedSimulation"] = true;
                            equalities["readySimulation"] = true;
                            equalities["possibleFutures"] = true;
                            equalities["simulation"] = true;
                            equalities["readiness"] = true;
                            equalities["impossibleFutures"] = true;
                            equalities["failures"] = true;
                            equalities["traceInclusion"] = true;
                        }
                        else {
                            // readySimulation
                            if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[6] > 1 || energyLevel[7] > 1 })) {
                                equalities["readySimulation"] = true;
                                equalities["simulation"] = true;
                                equalities["readiness"] = true;
                                equalities["failures"] = true;
                                equalities["traceInclusion"] = true;
                            }

                            // possibleFutures
                            if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 1 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[7] > 1 })) {
                                equalities["possibleFutures"] = true;
                                equalities["readiness"] = true;
                                equalities["impossibleFutures"] = true;
                                equalities["failures"] = true;
                                equalities["traceInclusion"] = true;
                            }
                            else {
                                // readiness
                                if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 1 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 1 || energyLevel[6] > 1 || energyLevel[7] > 1 })) {
                                    equalities["readiness"] = true;
                                    equalities["failures"] = true;
                                    equalities["traceInclusion"] = true;
                                }
                                else {
                                    // failures
                                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 1 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0 || energyLevel[6] > 1 || energyLevel[7] > 1 })) {
                                        equalities["failures"] = true;
                                        equalities["traceInclusion"] = true;
                                    }
                                }
                            }
                        }
                    }
                }
                // csim
                if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0 })) {
                    equalities["csim"] = true;
                    equalities["impossibleFutures"] = true;
                    equalities["failures"] = true;
                    equalities["traceInclusion"] = true;
                }
                else {
                    //impossibleFutures
                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 1 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0 || energyLevel[7] > 1})) {
                        equalities["impossibleFutures"] = true;
                        equalities["failures"] = true;
                        equalities["traceInclusion"] = true;
                    }
                }
            }

            // srdbisim
            if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 })) {
                for (let eq in equalities) {
                    if (["srbbisim", "bbisim", "etabisim", "etasim"].indexOf(eq) > -1) {
                        continue;
                    }
                    equalities[eq] = true;
                }
            }
            else {
                // sbisim
                if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 0 || energyLevel[4] > 0 })) {
                    equalities["sbisim"] = true;
                    equalities["srsim"] = true;
                    equalities["scsim"] = true;
                    equalities["sreadiness"] = true;
                    equalities["sifutures"] = true;
                    equalities["sfailures"] = true;
                    equalities["traceInclusion"] = true;
                }
                else {
                    // srsim
                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 0 || energyLevel[4] > 0 || energyLevel[6] > 1 || energyLevel[7] > 1 })) {
                        equalities["srsim"] = true;
                        equalities["sreadiness"] = true;
                        equalities["sfailures"] = true;
                        equalities["traceInclusion"] = true;
                    }
                    else {
                        // sreadiness
                        if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 0 || energyLevel[3] > 1 || energyLevel[4] > 0 || energyLevel[5] > 1 || energyLevel[6] > 1 || energyLevel[7] > 1 })) {
                            equalities["sreadiness"] = true;
                            equalities["sfailures"] = true;
                            equalities["traceInclusion"] = true;
                        }
                        else {
                            // sfailures
                            if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 0 || energyLevel[3] > 1 || energyLevel[4] > 0 || energyLevel[5] > 0 || energyLevel[6] > 1 || energyLevel[7] > 1 })) {
                                equalities["sfailures"] = true;
                                equalities["traceInclusion"] = true;
                            }
                        }
                    }
                }
                // scsim
                if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0 })) {
                    equalities["scsim"] = true;
                    equalities["sifutures"] = true;
                    equalities["sfailures"] = true;
                    equalities["traceInclusion"] = true;
                }
                else {
                    // sifutures
                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 0 || energyLevel[3] > 1 || energyLevel[4] > 0 || energyLevel[5] > 0 || energyLevel[7] > 1 })) {
                        equalities["sifutures"] = true;
                        equalities["sfailures"] = true;
                        equalities["traces"] = true;
                    } 
                }
            }
        }
        return equalities;
    }
}
