/// <reference path="../../lib/ccs.d.ts" />
var WeakSpectroscopy;
(function (WeakSpectroscopy) {
    let idCounter = 0;
    class WithAutoIncrementedId {
        constructor() {
            this.id = idCounter++;
        }
    }
    class Position extends WithAutoIncrementedId {
        constructor(p, isDefenderPosition, isDelayedPosition, isStablePosition, isBranchingPosition, qSet, q, alpha, pPrime, qSetAlpha) {
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
        defenderStuck(moves) {
            if (!this.isDefenderPosition) {
                throw new Error("Not a defender position.");
            }
            if (!this.isBranchingPosition) {
                return this.qSet.length === 0;
            }
            if (this.qSet.length !== 0) {
                return false;
            }
            // check for possible moves from this position
            return moves.some((move) => { return this.isEqualTo(move.from); });
        }
        isEqualTo(otherPos) {
            // check for flags
            if (!(this.isBranchingPosition === otherPos.isBranchingPosition && this.isDefenderPosition === otherPos.isDefenderPosition
                && this.isDelayedPosition === otherPos.isDelayedPosition && this.isStablePosition === otherPos.isStablePosition)) {
                return false;
            }
            // check for equality of p
            if (!(this.p.id === otherPos.p.id)) {
                return false;
            }
            // check for equality of q
            if (this.q && otherPos.q) {
                if (!(this.q.id === otherPos.q.id)) {
                    return false;
                }
            }
            else {
                if (this.q || otherPos.q) {
                    return false;
                }
            }
            // check for set equality of qSet
            if ((this.qSet && otherPos.qSet)) {
                if (!(this.qSet.every((q) => {
                    return otherPos.qSet.some((otherq) => { return q.id === otherq.id; });
                })
                    && otherPos.qSet.every((otherq) => {
                        return this.qSet.some((q) => { return otherq.id === q.id; });
                    }))) {
                    return false;
                }
            }
            else {
                if (this.qSet || otherPos.qSet) {
                    return false;
                }
            }
            // check for equality of pPrime
            if (this.pPrime && otherPos.pPrime) {
                if (!(this.pPrime.id === otherPos.pPrime.id)) {
                    return false;
                }
            }
            else {
                if (this.pPrime || otherPos.pPrime) {
                    return false;
                }
            }
            // check for equality of alpha
            if (this.alpha && otherPos.alpha) {
                if (!(this.alpha.equals(otherPos.alpha))) {
                    return false;
                }
            }
            else {
                if (this.alpha || otherPos.alpha) {
                    return false;
                }
            }
            // check for set equality of qSetAlpha
            if ((this.qSetAlpha && otherPos.qSetAlpha)) {
                if (!(this.qSetAlpha.every((q) => {
                    return otherPos.qSetAlpha.some((otherq) => { return q.id === otherq.id; });
                })
                    && otherPos.qSetAlpha.every((otherq) => {
                        return this.qSetAlpha.some((q) => { return otherq.id === q.id; });
                    }))) {
                    return false;
                }
            }
            else {
                if (this.qSetAlpha || otherPos.qSetAlpha) {
                    return false;
                }
            }
            return true;
        }
    }
    WeakSpectroscopy.Position = Position;
    class Move {
        constructor(from, to, update, actionName) {
            this.from = from;
            this.to = to;
            this.update = update;
            this.actionName = actionName;
        }
        updateToString() {
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
                str += i < 7 ? "," : ")";
            }
            return str;
        }
    }
    WeakSpectroscopy.Move = Move;
    function findTwoPartitions(set) {
        let combinations = [[]];
        for (let i = 0; i < Math.pow(2, set.length); i++) {
            let combination = [];
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
    function getSetDifference(set, subset) {
        if (subset.length == 0) {
            return set;
        }
        return set.filter((elem) => {
            return subset.every((e) => { return elem != e; });
        });
    }
    class Game {
        constructor(strongSuccGen, weakSuccGen, firstProcess, secondProcess) {
            this.positions = [];
            this.defenderPositions = [];
            this.moves = [];
            this.createGameGraph(strongSuccGen, weakSuccGen, firstProcess, secondProcess);
        }
        addPosition(position) {
            this.positions.push(position);
            if (position.isDefenderPosition) {
                this.defenderPositions.push(position);
            }
            return position;
        }
        addMove(move) {
            this.moves.push(move);
        }
        createGameGraph(strongSuccGen, weakSuccGen, firstProcess, secondProcess) {
            // initialize stack with start position
            let startPosition = new Position(firstProcess, false, false, false, false, [secondProcess]);
            this.addPosition(startPosition);
            let todo = [startPosition];
            while (todo.length > 0) {
                let pos = todo.pop();
                if (pos.isDefenderPosition) {
                    // conjunctive (stable) / branching answers
                    pos.qSet.forEach((q) => {
                        let newPos = new Position(pos.p, false, false, false, false, undefined, q);
                        let update = Array(8).fill(0);
                        if (pos.isStablePosition) {
                            update[3] = -1;
                        }
                        else {
                            if (pos.isBranchingPosition) {
                                update[1] = -1;
                                update[2] = -1;
                            }
                            else {
                                update[2] = -1;
                            }
                        }
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, update));
                            todo.push(newPos);
                        }
                        else {
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                            if (!destPos) {
                                throw new Error("Position does not exist despite check");
                            }
                            this.addMove(new Move(pos, destPos, update));
                        }
                    });
                    // branching observations
                    if (pos.isBranchingPosition) {
                        let qSetPrime = [];
                        let isTau = pos.alpha.getLabel() === "tau";
                        pos.qSetAlpha.forEach((proc) => {
                            let transitions = strongSuccGen.getSuccessors(proc.id).transitionsForAction(pos.alpha);
                            if (isTau) {
                                if (transitions.some((transition) => { return transition.targetProcess.id === proc.id; })) {
                                    qSetPrime.push(proc);
                                }
                            }
                            else {
                                transitions.forEach((transition) => { qSetPrime.push(transition.targetProcess); });
                            }
                        });
                        let newPos = new Position(pos.pPrime, false, false, false, true, qSetPrime);
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, [[1, 6], -1, -1, 0, 0, 0, 0, 0]));
                            todo.push(newPos);
                        }
                        else {
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                            if (!destPos) {
                                throw new Error("Position does not exist despite check");
                            }
                            this.addMove(new Move(pos, destPos, [[1, 6], -1, -1, 0, 0, 0, 0, 0]));
                        }
                    }
                }
                else {
                    // attacker clause positions
                    if (pos.q) {
                        // positive clauses
                        let qSet = [];
                        weakSuccGen.getSuccessors(pos.q.id).transitionsForAction(new CCS.Action("tau", false)).forEach((transition) => {
                            qSet.push(transition.targetProcess);
                        });
                        if (!qSet.some((q) => { return q.id === pos.q.id; })) {
                            qSet.push(pos.q);
                        }
                        let newPos = new Position(pos.p, false, true, false, false, qSet);
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, [[1, 6], 0, 0, 0, 0, 0, 0, 0]));
                            todo.push(newPos);
                        }
                        else {
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                            if (!destPos) {
                                throw new Error("Position does not exist despite check");
                            }
                            this.addMove(new Move(pos, destPos, [[1, 6], 0, 0, 0, 0, 0, 0, 0]));
                        }
                        // negative decisions
                        if (pos.p.id !== pos.q.id) {
                            qSet = [];
                            weakSuccGen.getSuccessors(pos.p.id).transitionsForAction(new CCS.Action("tau", false)).forEach((transition) => {
                                qSet.push(transition.targetProcess);
                            });
                            if (!qSet.some((q) => { return q.id === pos.p.id; })) {
                                qSet.push(pos.p);
                            }
                            let newPos = new Position(pos.q, false, true, false, false, qSet);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [[1, 7], 0, 0, 0, 0, 0, 0, -1]));
                                todo.push(newPos);
                            }
                            else {
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                                if (!destPos) {
                                    throw new Error("Position does not exist despite check");
                                }
                                this.addMove(new Move(pos, destPos, [[1, 7], 0, 0, 0, 0, 0, 0, -1]));
                            }
                        }
                    }
                    else {
                        // attacker branching accounting
                        if (pos.isBranchingPosition) {
                            let newPos = new Position(pos.p, false, false, false, false, pos.qSet);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [-1, 0, 0, 0, 0, 0, 0, 0]));
                                todo.push(newPos);
                            }
                            else {
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                                if (!destPos) {
                                    throw new Error("Position does not exist despite check");
                                }
                                this.addMove(new Move(pos, destPos, [-1, 0, 0, 0, 0, 0, 0, 0]));
                            }
                        }
                        // delay
                        if (!(pos.isBranchingPosition || pos.isDelayedPosition || pos.isStablePosition)) {
                            let qSet = [];
                            pos.qSet.forEach((proc) => {
                                weakSuccGen.getSuccessors(proc.id).transitionsForAction(new CCS.Action("tau", false)).forEach((transition) => {
                                    qSet.push(transition.targetProcess);
                                });
                                if (!qSet.some((q) => { return q.id === proc.id; })) {
                                    qSet.push(proc);
                                }
                            });
                            let newPos = new Position(pos.p, false, true, false, false, qSet);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [0, 0, 0, 0, 0, 0, 0, 0]));
                                todo.push(newPos);
                            }
                            else {
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                                if (!destPos) {
                                    throw new Error("Position does not exist despite check");
                                }
                                this.addMove(new Move(pos, destPos, [0, 0, 0, 0, 0, 0, 0, 0]));
                            }
                        }
                        // finishing
                        if (pos.qSet.length === 0) {
                            let newPos = new Position(pos.p, true, false, false, false, []);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [0, 0, 0, 0, 0, 0, 0, 0]));
                                todo.push(newPos);
                            }
                            else {
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                                if (!destPos) {
                                    throw new Error("Position does not exist despite check");
                                }
                                this.addMove(new Move(pos, destPos, [0, 0, 0, 0, 0, 0, 0, 0]));
                            }
                        }
                        else {
                            // early conjunction
                            let newPos = new Position(pos.p, true, false, false, false, pos.qSet);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [0, 0, 0, 0, -1, 0, 0, 0]));
                                todo.push(newPos);
                            }
                            else {
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                                if (!destPos) {
                                    throw new Error("Position does not exist despite check");
                                }
                                this.addMove(new Move(pos, destPos, [0, 0, 0, 0, -1, 0, 0, 0]));
                            }
                        }
                        // procrastination
                        let pTransitions = strongSuccGen.getSuccessors(pos.p.id);
                        pTransitions.transitionsForAction(new CCS.Action("tau", false)).forEach((transition) => {
                            if (transition.targetProcess.id === pos.p.id) {
                                return;
                            }
                            let newPos = new Position(transition.targetProcess, false, true, false, false, pos.qSet);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [0, 0, 0, 0, 0, 0, 0, 0]));
                                todo.push(newPos);
                            }
                            else {
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                                if (!destPos) {
                                    throw new Error("Position does not exist despite check");
                                }
                                this.addMove(new Move(pos, destPos, [0, 0, 0, 0, 0, 0, 0, 0]));
                            }
                        });
                        // observation
                        let qTransitions = [];
                        let qPrimes = {};
                        pos.qSet.forEach((q) => {
                            qTransitions.push(strongSuccGen.getSuccessors(q.id));
                        });
                        pTransitions.forEach((pTransition) => {
                            let actionName = pTransition.action.getLabel();
                            if (actionName === "tau") {
                                return;
                            }
                            if (!qPrimes[actionName]) {
                                let qPrimesForAction = [];
                                qTransitions.forEach((qTrans) => {
                                    qTrans.transitionsForAction(pTransition.action).forEach((qTransition) => {
                                        qPrimesForAction.push(qTransition.targetProcess);
                                    });
                                });
                                qPrimes[actionName] = qPrimesForAction;
                            }
                            let newPos = new Position(pTransition.targetProcess, false, false, false, false, qPrimes[actionName]);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [-1, 0, 0, 0, 0, 0, 0, 0], actionName));
                                todo.push(newPos);
                            }
                            else {
                                // omit redundant loops
                                if (!newPos.isEqualTo(pos)) {
                                    let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                                    if (!destPos) {
                                        throw new Error("Position does not exist despite check");
                                    }
                                    this.addMove(new Move(pos, destPos, [-1, 0, 0, 0, 0, 0, 0, 0], actionName));
                                }
                            }
                        });
                        // late instable conjunction
                        let newPos = new Position(pos.p, true, false, false, false, pos.qSet);
                        // check if newPos was already discovered to avoid duplicates
                        if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                            this.addPosition(newPos);
                            this.addMove(new Move(pos, newPos, [0, 0, 0, 0, 0, 0, 0, 0]));
                            todo.push(newPos);
                        }
                        else {
                            let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                            if (!destPos) {
                                throw new Error("Position does not exist despite check");
                            }
                            this.addMove(new Move(pos, destPos, [0, 0, 0, 0, 0, 0, 0, 0]));
                        }
                        // late stable conjunction
                        if (strongSuccGen.getSuccessors(pos.p.id).transitionsForAction(new CCS.Action("tau", false)).length === 0) {
                            let qSetPrime = [];
                            pos.qSet.forEach((proc) => {
                                if (strongSuccGen.getSuccessors(proc.id).transitionsForAction(new CCS.Action("tau", false)).length === 0) {
                                    qSetPrime.push(proc);
                                }
                            });
                            let newPos = new Position(pos.p, true, false, true, false, qSetPrime);
                            // check if newPos was already discovered to avoid duplicates
                            if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                                this.addPosition(newPos);
                                this.addMove(new Move(pos, newPos, [0, 0, 0, 0, 0, 0, 0, 0]));
                                todo.push(newPos);
                            }
                            else {
                                let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                                if (!destPos) {
                                    throw new Error("Position does not exist despite check");
                                }
                                this.addMove(new Move(pos, destPos, [0, 0, 0, 0, 0, 0, 0, 0]));
                            }
                        }
                        // branching conjunctions
                        let partitionsForAlpha = {};
                        pTransitions.forEach((transition) => {
                            // the attacker always wants to have all q \in Q in Q_alpha that don't have any strong outgoing alpha-transitions
                            if (!partitionsForAlpha[transition.action.getLabel()]) {
                                partitionsForAlpha[transition.action.getLabel()] = [];
                                let qSetAlphaBase = [];
                                pos.qSet.forEach((proc) => {
                                    if (strongSuccGen.getSuccessors(proc.id).transitionsForAction(transition.action).length === 0) {
                                        qSetAlphaBase.push(proc);
                                    }
                                });
                                let partitions = findTwoPartitions(getSetDifference(pos.qSet, qSetAlphaBase));
                                partitions.forEach((partition) => {
                                    let qSetAlpha = [...qSetAlphaBase, ...partition];
                                    if (qSetAlpha.length > 0) {
                                        partitionsForAlpha[transition.action.getLabel()].push([getSetDifference(pos.qSet, qSetAlpha), qSetAlpha]);
                                    }
                                });
                            }
                            partitionsForAlpha[transition.action.getLabel()].forEach((partition) => {
                                let newPos = new Position(pos.p, true, false, false, true, partition[0], undefined, transition.action, transition.targetProcess, partition[1]);
                                // check if newPos was already discovered to avoid duplicates
                                if (!this.positions.some((existingPos) => { return existingPos.isEqualTo(newPos); })) {
                                    this.addPosition(newPos);
                                    this.addMove(new Move(pos, newPos, [0, 0, 0, 0, 0, 0, 0, 0]));
                                    todo.push(newPos);
                                }
                                else {
                                    let destPos = this.positions.find((existingPos) => { return existingPos.isEqualTo(newPos); });
                                    if (!destPos) {
                                        throw new Error("Position does not exist despite check");
                                    }
                                    this.addMove(new Move(pos, destPos, [0, 0, 0, 0, 0, 0, 0, 0]));
                                }
                            });
                        });
                    }
                }
            }
        }
        getPossibleMoves(position) {
            let currentPos = this.positions.find((pos) => {
                return pos.isEqualTo(position);
            });
            if (!currentPos) {
                throw "game state not found";
            }
            let possibleMoves = this.moves.filter((move) => {
                return move.from.isEqualTo(currentPos);
            });
            return possibleMoves;
        }
    }
    WeakSpectroscopy.Game = Game;
    function update(budget, update) {
        let updatedBudget = [];
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
    WeakSpectroscopy.update = update;
    function inverseUpdate(energyLevel, update) {
        let parts = [[...energyLevel]];
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
        });
        let sup = parts.pop();
        parts.forEach((part) => {
            part.forEach((e_i, i) => {
                sup[i] = Math.max(sup[i], e_i);
            });
        });
        return sup;
    }
    function computeMinimumBudgets(newAttackerWin, budgets) {
        newAttackerWin.push(budgets.pop());
        budgets.forEach((budget) => {
            // flag to prohibit budgets being pushed multiple times
            let pushed = false;
            // another flag to check for dominance
            let dominated = false;
            for (let minBudget of newAttackerWin) {
                // budget is dominated by minbudget
                if (budget.budget.every((e_n, i) => { return e_n >= minBudget.budget[i]; })) {
                    dominated = true;
                    break;
                }
                // budget dominates minbudget
                else {
                    if (budget.budget.every((e_n, i) => { return e_n <= minBudget.budget[i]; })) {
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
    function computeWinningBudgets(game) {
        var _a;
        // ln 2
        let attackerWin = new Map();
        game.positions.forEach((pos) => {
            attackerWin.set(pos, []);
        });
        // ln 3
        let todo = [];
        game.defenderPositions.forEach((pos) => {
            if (pos.defenderStuck(game.moves)) {
                todo.push(pos);
                attackerWin.set(pos, [{ budget: Array(8).fill(0), hml: new HML.TrueFormula() }]);
            }
        });
        // ln 4
        while (todo.length > 0) {
            //ln 5 and 6
            let g = todo.pop();
            let newAttackerWin = [];
            // ln 7
            if (!g.isDefenderPosition) {
                // ln 8
                let minToFind = [...attackerWin.get(g)];
                game.moves.forEach((move) => {
                    var _a;
                    if (move.from == g) {
                        (_a = attackerWin.get(move.to)) === null || _a === void 0 ? void 0 : _a.forEach((edash) => {
                            // let newHML: HML.Formula = updateHML(edash.hml, move.update, move.actionName!);
                            // minToFind.push({budget: inverseUpdate(edash.budget, move.update), hml: newHML});
                            minToFind.push({ budget: inverseUpdate(edash.budget, move.update), hml: edash.hml });
                        });
                    }
                });
                computeMinimumBudgets(newAttackerWin, minToFind);
            }
            // ln 9
            else {
                if (g.defenderStuck(game.moves)) {
                    game.moves.forEach((move) => {
                        if (move.to == g) {
                            todo.push(move.from);
                        }
                    });
                    continue;
                }
                // ln 10
                let defenderPost = [];
                let options = new Map();
                // ln 10 and 11
                game.moves.forEach((move) => {
                    if (move.from == g) {
                        defenderPost.push(move.to);
                        attackerWin.get(move.to).forEach((energyLevel) => {
                            if (!options.has(move.to)) {
                                options.set(move.to, []);
                            }
                            options.get(move.to).push({ budget: inverseUpdate(energyLevel.budget, move.update), hml: energyLevel.hml });
                        });
                    }
                });
                // ln 12
                // comparing cardinality should also be correct and more efficient
                if (defenderPost.every((gdash) => { return options.has(gdash); })) {
                    // ln 13
                    let optionsArray = [];
                    for (let strats of options.values()) {
                        optionsArray.push(strats);
                    }
                    let minToFind = [];
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
                                        let sup = { budget: [], hml: energyLevel.hml };
                                        for (let k = 0; k < 8; k++) {
                                            sup.budget[k] = Math.max(energyLevel.budget[k], otherEnergyLevel.budget[k]);
                                        }
                                        minToFind.push(sup);
                                    });
                                });
                            }
                        });
                    });
                    computeMinimumBudgets(newAttackerWin, minToFind);
                }
            }
            //ln 16
            // duplicate elements shouldn't exist
            if (!(newAttackerWin.length == ((_a = attackerWin.get(g)) === null || _a === void 0 ? void 0 : _a.length) &&
                newAttackerWin.every((energyLevel) => {
                    var _a;
                    return (_a = attackerWin.get(g)) === null || _a === void 0 ? void 0 : _a.some((otherEnergylevel) => {
                        return energyLevel.budget.every((e_i, i) => {
                            return e_i == otherEnergylevel.budget[i];
                        });
                    });
                }))) {
                // ln 17
                attackerWin.set(g, newAttackerWin);
                // ln 18
                game.moves.forEach((move) => {
                    if (move.to == g) {
                        todo.push(move.from);
                    }
                });
            }
        }
        // ln 19 and 20
        return attackerWin;
    }
    WeakSpectroscopy.computeWinningBudgets = computeWinningBudgets;
    function getEqualitiesFromEnergies(energyLevels) {
        let equalities = {
            srbbisim: false,
            bbisim: false,
            srdbisim: false,
            dbisim: false,
            etabisim: false,
            sbisim: false,
            bisim: false,
            etasim: false,
            sim: false,
            twosim: false,
            rsim: false,
            csim: false,
            pfutures: false,
            weakreadiness: false,
            ifutures: false,
            weakfailures: false,
            weaktraces: false,
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
            if (energyLevels.every((energyLevel) => { return energyLevel[3] > 0; })) {
                for (let eq in equalities) {
                    if (["srbbisim", "srdbisim", "sbisim", "srsim", "scsim", "sreadiness", "sifutures", "sfailures"].indexOf(eq) > -1) {
                        continue;
                    }
                    equalities[eq] = true;
                }
            }
            else {
                // etabisim
                if (energyLevels.every((energyLevel) => { return energyLevel[3] > 0 || energyLevel[4] > 0; })) {
                    for (let eq in equalities) {
                        if (["srbbisim", "srdbisim", "dbisim", "sbisim", "srsim", "scsim", "sreadiness", "sifutures", "sfailures"].indexOf(eq) > -1) {
                            continue;
                        }
                        equalities[eq] = true;
                    }
                }
                else {
                    // etasim
                    if (energyLevels.every((energyLevel) => { return energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[6] > 0 || energyLevel[7] > 0; })) {
                        equalities["etasim"] = true;
                        equalities["sim"] = true;
                        equalities["traces"] = true;
                    }
                    else {
                        // sim
                        if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[6] > 0 || energyLevel[7] > 0; })) {
                            equalities["sim"] = true;
                            equalities["traces"] = true;
                        }
                        else {
                            // traces
                            if (energyLevels.every((energyLevel) => { return energyLevel.slice(1).some((dim) => { return dim > 0; }); })) {
                                equalities["traces"] = true;
                            }
                        }
                    }
                }
                // dbisim
                if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[3] > 0; })) {
                    for (let eq in equalities) {
                        if (["srbbisim", "srdbisim", "bbisim", "etabisim", "etasim", "sbisim", "srsim", "scsim", "sreadiness", "sifutures", "sfailures"].indexOf(eq) > -1) {
                            continue;
                        }
                        equalities[eq] = true;
                    }
                }
                else {
                    // bisim
                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0; })) {
                        for (let eq in equalities) {
                            if (["srbbisim", "srdbisim", "bbisim", "dbisim", "etabisim", "etasim", "sbisim", "srsim", "scsim", "sreadiness", "sifutures", "sfailures"].indexOf(eq) > -1) {
                                continue;
                            }
                            equalities[eq] = true;
                        }
                    }
                    else {
                        // twosim
                        if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[7] > 1; })) {
                            equalities["twosim"] = true;
                            equalities["rsim"] = true;
                            equalities["pfutures"] = true;
                            equalities["sim"] = true;
                            equalities["readiness"] = true;
                            equalities["ifutures"] = true;
                            equalities["failures"] = true;
                            equalities["traces"] = true;
                        }
                        else {
                            // rsim
                            if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[6] > 1 || energyLevel[7] > 1; })) {
                                equalities["rsim"] = true;
                                equalities["sim"] = true;
                                equalities["readiness"] = true;
                                equalities["failures"] = true;
                                equalities["traces"] = true;
                            }
                            // pfutures
                            if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 1 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[7] > 1; })) {
                                equalities["pfutures"] = true;
                                equalities["readiness"] = true;
                                equalities["ifutures"] = true;
                                equalities["failures"] = true;
                                equalities["traces"] = true;
                            }
                            else {
                                // readiness
                                if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 1 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 1 || energyLevel[6] > 1 || energyLevel[7] > 1; })) {
                                    equalities["readiness"] = true;
                                    equalities["failures"] = true;
                                    equalities["traces"] = true;
                                }
                                else {
                                    // failures
                                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 1 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0 || energyLevel[6] > 1 || energyLevel[7] > 1; })) {
                                        equalities["failures"] = true;
                                        equalities["traces"] = true;
                                    }
                                }
                            }
                        }
                    }
                }
                // csim
                if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0; })) {
                    equalities["csim"] = true;
                    equalities["ifutures"] = true;
                    equalities["failures"] = true;
                    equalities["traces"] = true;
                }
                else {
                    //ifutures
                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 1 || energyLevel[3] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0 || energyLevel[7] > 1; })) {
                        equalities["ifutures"] = true;
                        equalities["failures"] = true;
                        equalities["traces"] = true;
                    }
                }
            }
            // srdbisim
            if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0; })) {
                for (let eq in equalities) {
                    if (["srbbisim", "bbisim", "etabisim", "etasim"].indexOf(eq) > -1) {
                        continue;
                    }
                    equalities[eq] = true;
                }
            }
            else {
                // sbisim
                if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 0 || energyLevel[4] > 0; })) {
                    equalities["sbisim"] = true;
                    equalities["srsim"] = true;
                    equalities["scsim"] = true;
                    equalities["sreadiness"] = true;
                    equalities["sifutures"] = true;
                    equalities["sfailures"] = true;
                    equalities["traces"] = true;
                }
                else {
                    // srsim
                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 0 || energyLevel[4] > 0 || energyLevel[6] > 1 || energyLevel[7] > 1; })) {
                        equalities["srsim"] = true;
                        equalities["sreadiness"] = true;
                        equalities["sfailures"] = true;
                        equalities["traces"] = true;
                    }
                    else {
                        // sreadiness
                        if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 0 || energyLevel[3] > 1 || energyLevel[4] > 0 || energyLevel[5] > 1 || energyLevel[6] > 1 || energyLevel[7] > 1; })) {
                            equalities["sreadiness"] = true;
                            equalities["sfailures"] = true;
                            equalities["traces"] = true;
                        }
                        else {
                            // sfailures
                            if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 0 || energyLevel[3] > 1 || energyLevel[4] > 0 || energyLevel[5] > 0 || energyLevel[6] > 1 || energyLevel[7] > 1; })) {
                                equalities["sfailures"] = true;
                                equalities["traces"] = true;
                            }
                        }
                    }
                }
                // scsim
                if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 0 || energyLevel[4] > 0 || energyLevel[5] > 0; })) {
                    equalities["scsim"] = true;
                    equalities["sifutures"] = true;
                    equalities["sfailures"] = true;
                    equalities["traces"] = true;
                }
                else {
                    // sifutures
                    if (energyLevels.every((energyLevel) => { return energyLevel[1] > 0 || energyLevel[2] > 0 || energyLevel[3] > 1 || energyLevel[4] > 0 || energyLevel[5] > 0 || energyLevel[7] > 1; })) {
                        equalities["sifutures"] = true;
                        equalities["sfailures"] = true;
                        equalities["traces"] = true;
                    }
                }
            }
        }
        return equalities;
    }
    WeakSpectroscopy.getEqualitiesFromEnergies = getEqualitiesFromEnergies;
})(WeakSpectroscopy || (WeakSpectroscopy = {}));
