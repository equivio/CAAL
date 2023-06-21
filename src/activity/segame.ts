/// <reference path="activity.ts" />
/// <reference path="game.ts" />
/// <reference path="../BJN-Algo/BJN.ts" />

module Activity {

    export class SEGame extends Activity {
        private graph: CCS.Graph;
        private succGen: CCS.SuccessorGenerator;
        private SEGameLogic: SEGameLogic;
        private fullscreen: Fullscreen;
        private tooltip: ProcessTooltip;
        private timeout: any;
        private $leftProcessList: JQuery;
        private $rightProcessList: JQuery;
        private $ccsGameTypes: JQuery;
        private $gameRelation: JQuery;
        private $playerType: JQuery;
        private $restart: JQuery;
        private $energyGauge: JQuery;
        private $leftContainer: JQuery;
        private $rightContainer: JQuery;
        private $leftZoom: JQuery;
        private $rightZoom: JQuery;
        private $leftDepth: JQuery;
        private $rightDepth: JQuery;
        private $leftFreeze: JQuery;
        private $rightFreeze: JQuery;
        private leftCanvas: HTMLCanvasElement;
        private rightCanvas: HTMLCanvasElement;
        private leftRenderer: Renderer;
        private rightRenderer: Renderer;
        private leftGraph: GUI.ProcessGraphUI;
        private rightGraph: GUI.ProcessGraphUI;

        constructor(container: string, button: string, activeToggle: string) {
            super(container, button, activeToggle);

            this.project = Project.getInstance();
            this.fullscreen = new Fullscreen($("#se-game-container")[0], $("#se-game-fullscreen"), () => this.resize(null, null));
            this.tooltip = new ProcessTooltip($("#se-game-status"));
            new DataTooltip($("#se-game-log")); // no need to save instance

            this.$leftProcessList = $("#se-game-left-process");
            this.$rightProcessList = $("#se-game-right-process");
            this.$ccsGameTypes = $("#se-game-ccs-type");
            this.$gameRelation = $("#se-game-relation");
            this.$playerType = $("input[name=se-player-type]");
            this.$restart = $("#se-game-restart");
            this.$energyGauge = $("#se-game-gauge");
            this.$leftContainer = $("#se-game-left-canvas");
            this.$rightContainer = $("#se-game-right-canvas");
            this.$leftZoom = $("#se-zoom-left");
            this.$rightZoom = $("#se-zoom-right");
            this.$leftDepth = $("#se-depth-left");
            this.$rightDepth = $("#se-depth-right");
            this.$leftFreeze = $("#se-freeze-left");
            this.$rightFreeze = $("#se-freeze-right");
            this.leftCanvas = <HTMLCanvasElement>this.$leftContainer.find("canvas")[0];
            this.rightCanvas = <HTMLCanvasElement>this.$rightContainer.find("canvas")[0];

            this.leftRenderer = new Renderer(this.leftCanvas);
            this.rightRenderer = new Renderer(this.rightCanvas);
            this.leftGraph = new GUI.ArborGraph(this.leftRenderer);
            this.rightGraph = new GUI.ArborGraph(this.rightRenderer);

            this.$leftProcessList.on("change", () => this.newGame(true, false));
            this.$rightProcessList.on("change", () => this.newGame(false, true));
            this.$ccsGameTypes.on("change", () => this.newGame(true, true));
            this.$gameRelation.on("change", () => this.newGame(false, false));
            this.$playerType.on("change", () => this.newGame(false, false));
            this.$restart.on("click", () => this.newGame(false, false));
            this.$leftFreeze.on("click", (e) => this.toggleFreeze(this.leftGraph, !this.$leftFreeze.data("frozen"), $(e.currentTarget)));
            this.$rightFreeze.on("click", (e) => this.toggleFreeze(this.rightGraph, !this.$rightFreeze.data("frozen"), $(e.currentTarget)));

            // Manually remove focus from depth input when the canvas is clicked.
            $(this.leftCanvas).on("click", () => { if (this.$leftDepth.is(":focus")) this.$leftDepth.blur() });
            $(this.rightCanvas).on("click", () => { if (this.$rightDepth.is(":focus")) this.$rightDepth.blur() });

            this.$leftDepth.on("change", () => {
                this.validateDepth(this.$leftDepth);
                this.setDepth(this.SEGameLogic.getCurrentConfiguration().left, this.leftGraph, this.$leftDepth.val(), Move.Left);
            });

            this.$rightDepth.on("change", () => {
                this.validateDepth(this.$rightDepth);
                let rightConfig = this.SEGameLogic.getCurrentConfiguration().right;
                let rightDepth = this.$rightDepth.val()
                if (rightConfig.q) {
                    this.setDepth(rightConfig.q, this.rightGraph, rightDepth, Move.Right);
                }
                else {
                    rightConfig.qSet.forEach((process) => {
                        this.setDepth(process, this.rightGraph, rightDepth, Move.Right);
                    })
                    if (rightConfig.qStarSet) {
                        rightConfig.qStarSet.forEach((process) => {
                            this.setDepth(process, this.rightGraph, rightDepth, Move.Right);
                        })
                    }
                }
            });

            // Use onchange instead of oninput for IE.
            if (navigator.userAgent.indexOf("MSIE ") > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./)) {
                this.$leftZoom.on("change", () => this.resize(this.$leftZoom.val(), null));
                this.$rightZoom.on("change", () => this.resize(null, this.$rightZoom.val()));
            } else {
                this.$leftZoom.on("input", () => this.resize(this.$leftZoom.val(), null));
                this.$rightZoom.on("input", () => this.resize(null, this.$rightZoom.val()));
            }
        }

        private setDepth(processId: string, graph: GUI.ProcessGraphUI, depth: number, move: Move): void {
            this.clear(graph);
            let process = this.graph.processById(processId);
            this.draw(process, graph, depth, true);
            //this.centerNode(process, move);

            if (move === Move.Left)
                this.toggleFreeze(graph, false, this.$leftFreeze);
            else
                this.toggleFreeze(graph, false, this.$rightFreeze);
        }

        private validateDepth($input: JQuery): void {
            if (!/^[1-9][0-9]*$/.test($input.val())) {
                $input.val($input.data("previous-depth"));
            } else {
                $input.data("previous-depth", $input.val());
            }
        }

        private toggleFreeze(graph: GUI.ProcessGraphUI, freeze: boolean, button: JQuery): void {
            if (freeze) {
                graph.freeze();
                button.find("i").replaceWith("<i class='fa fa-lock fa-lg'></i>");
            } else {
                graph.unfreeze();
                button.find("i").replaceWith("<i class='fa fa-unlock-alt fa-lg'></i>");
            }

            button.data("frozen", freeze);
        }

        public onShow(configuration?: any): void {
            $(window).on("resize", () => this.resize(this.$leftZoom.val(), this.$rightZoom.val()));

            this.fullscreen.onShow();

            if (this.changed || configuration) {
                this.$ccsGameTypes.show();
                this.changed = false;
                this.graph = this.project.getGraph();
                this.displayOptions();
                this.newGame(true, true, configuration);
            }

            this.tooltip.setGraph(this.graph);

            this.leftGraph.setOnSelectListener((processId) => {
                if (this.leftGraph.getProcessDataObject(processId.toString()).status === "unexpanded")
                    this.draw(this.graph.processById(processId), this.leftGraph, this.$leftDepth.val(), true);
            });

            this.rightGraph.setOnSelectListener((processId) => {
                if (this.rightGraph.getProcessDataObject(processId.toString()).status === "unexpanded")
                    this.draw(this.graph.processById(processId), this.rightGraph, this.$rightDepth.val(), true);
            });

            this.leftGraph.setHoverOnListener((processId) => {
                this.timeout = setTimeout(() => {
                    var tooltipAnchor = $("#se-game-canvas-tooltip-left");
                    var position = this.leftGraph.getPosition(processId);

                    tooltipAnchor.css("left", position.x - this.$leftContainer.scrollLeft());
                    tooltipAnchor.css("top", position.y - this.$leftContainer.scrollTop() - 10);

                    tooltipAnchor.tooltip({ title: this.tooltip.ccsNotationForProcessId(processId), html: true });
                    tooltipAnchor.tooltip("show");
                }, 1000)
            });

            this.leftGraph.setHoverOutListener(() => {
                clearTimeout(this.timeout);
                $("#se-game-canvas-tooltip-left").tooltip("destroy");
            });

            this.rightGraph.setHoverOnListener((processId) => {
                this.timeout = setTimeout(() => {
                    var tooltipAnchor = $("#se-game-canvas-tooltip-right");
                    var position = this.rightGraph.getPosition(processId);

                    tooltipAnchor.css("left", position.x - this.$rightContainer.scrollLeft());
                    tooltipAnchor.css("top", position.y - this.$rightContainer.scrollTop() - 10);

                    tooltipAnchor.tooltip({ title: this.tooltip.ccsNotationForProcessId(processId), html: true });
                    tooltipAnchor.tooltip("show");
                }, 1000)
            });

            this.rightGraph.setHoverOutListener(() => {
                clearTimeout(this.timeout);
                $("#se-game-canvas-tooltip-right").tooltip("destroy");
            });

            this.leftGraph.bindCanvasEvents();
            this.rightGraph.bindCanvasEvents();

            this.toggleFreeze(this.leftGraph, this.$leftFreeze.data("frozen"), this.$leftFreeze); // (un)freeze, depending on the lock icon
            this.toggleFreeze(this.rightGraph, this.$rightFreeze.data("frozen"), this.$rightFreeze); // (un)freeze, depending on the lock icon
        }

        public onHide(): void {
            $(window).off("resize");

            this.fullscreen.onHide();

            this.leftGraph.clearOnSelectListener();
            this.rightGraph.clearOnSelectListener();
            this.leftGraph.clearHoverOnListener();
            this.rightGraph.clearHoverOnListener();
            this.leftGraph.clearHoverOutListener();
            this.rightGraph.clearHoverOutListener();

            this.leftGraph.unbindCanvasEvents();
            this.rightGraph.unbindCanvasEvents();

            this.leftGraph.freeze(); // force freeze for graph
            this.rightGraph.freeze(); // force freeze for graph
        }

        protected checkPreconditions(): boolean {
            try {
                var graph = this.project.getGraph();

                if (graph.getNamedProcesses().length === 0) {
                    this.showMessageBox("No Named Processes", "There must be at least one named process in the program.");
                    return false;
                }

                if (this.project.getInputMode() === InputMode.TCCS) {
                    this.showMessageBox("Bad input", "The Spectroscopy Energy Game does not support TCCS input");
                    return false;
                }

                var errors = graph.getErrors();

                if (errors.length > 0) {
                    this.showMessageBox("Error", errors.map(error => error.toString()).join("\n"));
                    return false;
                }
            } catch (error) {
                this.showMessageBox("Error", error);
                return false;
            }

            return true;
        }

        private displayOptions(): void {
            var processes = this.graph.getNamedProcesses().reverse();

            this.$leftProcessList.empty();
            this.$rightProcessList.empty();

            for (var i = 0; i < processes.length; i++) {
                this.$leftProcessList.append($("<option></option>").append(processes[i]));
                this.$rightProcessList.append($("<option></option>").append(processes[i]));
            }

            // Set second option as default selection for the right process.
            this.$rightProcessList.find("option:nth-child(2)").prop("selected", true);
        }

        private getOptions(): any {
            var options = {
                leftProcess: this.$leftProcessList.val(),
                rightProcess: this.$rightProcessList.val(),
                type: this.$ccsGameTypes.val(),
                time: "",
                relation: this.$gameRelation.val(),
                playerType: this.$playerType.filter(":checked").val()
            };
            return options;
        }

        private setOptions(options: any): void {
            this.$leftProcessList.val(options.leftProcess);
            this.$rightProcessList.val(options.rightProcess);
            this.$ccsGameTypes.val(options.type);
            this.$gameRelation.val(options.relation);

            // Bootstrap radio buttons only support changes via click events.
            // Manually handle .active class.
            this.$playerType.each(function () {
                if ($(this).attr("value") === options.playerType) {
                    $(this).parent().addClass("active");
                } else {
                    $(this).parent().removeClass("active");
                }
            });
        }

        private displayEnergyGauge(energyLeft: number[]): void {
            let str = "Energy Budget: (";
            for (let i = 0; i < energyLeft.length; i++) {
                str += energyLeft[i] === Infinity ? "∞" : energyLeft[i];
                str += i < energyLeft.length - 1 ? ", " : ")";
            }
            this.$energyGauge.html(str);
        }

        private newGame(drawLeft: boolean, drawRight: boolean, configuration?: any): void {
            var options;

            if (configuration) {
                options = configuration;
                this.setOptions(options);
            } else {
                options = this.getOptions();
            }

            this.succGen = CCS.getSuccGenerator(this.graph,
                { inputMode: InputMode[this.project.getInputMode()], time: options.time, succGen: options.type, reduce: true });

            if (drawLeft || !this.leftGraph.getNode(this.succGen.getProcessByName(options.leftProcess).id.toString())) {
                this.clear(this.leftGraph);
                this.draw(this.succGen.getProcessByName(options.leftProcess), this.leftGraph, this.$leftDepth.val(), false);
                this.resize(1, null);
                this.toggleFreeze(this.leftGraph, false, this.$leftFreeze);
            }

            if (drawRight || !this.rightGraph.getNode(this.succGen.getProcessByName(options.rightProcess).id.toString())) {
                this.clear(this.rightGraph);
                this.draw(this.succGen.getProcessByName(options.rightProcess), this.rightGraph, this.$rightDepth.val(), false)
                this.resize(null, 1);
                this.toggleFreeze(this.rightGraph, false, this.$rightFreeze);
            }

            if (this.SEGameLogic !== undefined) { this.SEGameLogic.stopGame() };

            let budget = this.getEnergyBudgetFromRelation(options.relation);
            this.displayEnergyGauge(budget);

            this.SEGameLogic = new SEGameLogic(this, new GameLog(options.time), this.succGen, budget, options.leftProcess,
                { q: undefined, qSet: [options.rightProcess], qStarSet: undefined })

            //this.SEGameLogic.computeMarking();

            var attacker: Player;
            var defender: Player;

            if (options.playerType === "defender") {
                attacker = new Computer(PlayType.Attacker);
                defender = new Human(PlayType.Defender, this);
            } else {
                attacker = new Human(PlayType.Attacker, this);
                defender = new Computer(PlayType.Defender);
            }

            this.SEGameLogic.setPlayers(attacker, defender);
            this.SEGameLogic.startGame();
        }

        private getEnergyBudgetFromRelation(relation: string): number[] {
            switch (relation) {
                case "Bisimulation":
                    return [Infinity, Infinity, Infinity, Infinity, Infinity, Infinity];
                case "TwoNestedSimulation":
                    return [Infinity, Infinity, Infinity, Infinity, Infinity, 1];
                case "ReadySimulation":
                    return [Infinity, Infinity, Infinity, Infinity, 1, 1];
                case "PossibleFutures":
                    return [Infinity, 2, Infinity, Infinity, Infinity, 1];
                case "Simulation":
                    return [Infinity, Infinity, Infinity, Infinity, 0, 0];
                case "ReadinessTraces":
                    return [Infinity, Infinity, Infinity, 1, 1, 1];
                case "FailureTraces":
                    return [Infinity, Infinity, Infinity, 0, 1, 1];
                case "Readiness":
                    return [Infinity, 2, 1, 1, 1, 1];
                case "ImpossibleFutures":
                    return [Infinity, 2, 0, 0, Infinity, 1];
                case "Revivals":
                    return [Infinity, 2, 1, 0, 1, 1];
                case "Failures":
                    return [Infinity, 2, 0, 0, 1, 1];
                case "TraceEquivalence":
                    return [Infinity, 1, 0, 0, 0, 0];
                case "Enabledness":
                    return [1, 1, 0, 0, 0, 0];
                default:
                    throw "Relation does not exist."
            }
        }

        private draw(process: CCS.Process, graph: GUI.ProcessGraphUI, depth: number, highlightNodes: boolean): void {
            var allTransitions = CCS.getNSuccessors(
                CCS.getSuccGenerator(this.graph, { inputMode: InputMode[this.project.getInputMode()], time: "timed", succGen: "strong", reduce: true }),
                process,
                depth
            );

            for (var fromId in allTransitions) {
                var fromProcess = this.graph.processById(fromId);
                this.showProcess(fromProcess, graph);
                this.showProcessAsExplored(fromProcess, graph);
                var groupedByTargetProcessId = ArrayUtil.groupBy(allTransitions[fromId].toArray(), t => t.targetProcess.id);

                Object.keys(groupedByTargetProcessId).forEach(strProcId => {
                    var group = groupedByTargetProcessId[strProcId],
                        data = group.map(t => { return { label: t.action.toString(false) } });
                    this.showProcess(this.graph.processById(strProcId), graph);
                    graph.showTransitions(fromProcess.id, strProcId, data);
                });
            }

            if (highlightNodes) {
                this.highlightNodes();
            }
        }

        private showProcess(process: CCS.Process, graph: GUI.ProcessGraphUI): void {
            if (graph.getProcessDataObject(process.id)) return;
            graph.showProcess(process.id, { label: this.labelFor(process), status: "unexpanded" });
        }

        private showProcessAsExplored(process: CCS.Process, graph: GUI.ProcessGraphUI): void {
            graph.getProcessDataObject(process.id).status = "expanded";
        }

        public onPlay(position: BJN.Position): void {
            this.draw(this.graph.processById(position.p.label), this.leftGraph, this.$leftDepth.val(), false);
            let rightDepth = this.$rightDepth.val();
            if (position.q) {
                this.draw(this.graph.processById(position.q.label), this.rightGraph, rightDepth, false);
            }
            else {
                position.qSet!.forEach((process) => {
                    this.draw(this.graph.processById(process.label), this.rightGraph, rightDepth, false);
                })
                if (position.qStarSet) {
                    position.qStarSet.forEach((process) => {
                        this.draw(this.graph.processById(process.label), this.rightGraph, rightDepth, false);
                    })
                }
            }

            this.highlightNodes();
            this.displayEnergyGauge(this.SEGameLogic.getEnergyLeft());
        }

        public highlightNodes(): void {
            if (!this.SEGameLogic)
                return;

            var configuration = this.SEGameLogic.getCurrentConfiguration();
            this.leftGraph.setSelected(configuration.left);

            let configIds = Object.create(null);
            if (configuration.right.q) {
                configIds.q = configuration.right.q;
            }
            else {
                if (configuration.right.qSet) {
                    configIds.qSet = [];
                    configuration.right.qSet.forEach((proc) => {
                        configIds.qSet.push(proc);
                    })
                }
                if (configuration.right.qStarSet) {
                    configIds.qStarSet = [];
                    configuration.right.qStarSet.forEach((proc) => {
                        configIds.qStarSet.push(proc);
                    })
                }
            }
            this.rightGraph.setRightGraphNodes(configIds);
        }

        private clear(graph: GUI.ProcessGraphUI): void {
            graph.clearAll();
        }

        public labelFor(process: CCS.Process): string {
            return this.graph.getLabel(process);
        }

        public findRightCenterNode(): string {
            let rightConfig = this.SEGameLogic.getCurrentConfiguration().right;
            if (rightConfig.q) {
                return rightConfig.q;
            }
            if (rightConfig.qSet && rightConfig.qSet[0]) {
                return rightConfig.qSet[0];
            }
            if (rightConfig.qStarSet && rightConfig.qStarSet[0]) {
                return rightConfig.qStarSet[0];
            }
            // if there are only empty sets, signal to not center anything
            return "";
        }

        public centerNode(processId: string, move: Move): void {
            if (!processId) { return; }
            let process = this.graph.processById(processId);
            if (move === Move.Left) {
                var position = this.leftGraph.getPosition(process.id.toString());
                this.$leftContainer.scrollLeft(position.x - (this.$leftContainer.width() / 2));
                this.$leftContainer.scrollTop(position.y - (this.$leftContainer.height() / 2));
            } else {
                var position = this.rightGraph.getPosition(process.id.toString());
                this.$rightContainer.scrollLeft(position.x - (this.$rightContainer.width() / 2));
                this.$rightContainer.scrollTop(position.y - (this.$rightContainer.height() / 2));
            }
        }

        private resize(leftZoom: number, rightZoom: number): void {
            var offsetTop = $("#se-game-main").offset().top;
            var offsetBottom = $("#se-game-status").height();

            var availableHeight = window.innerHeight - offsetTop - offsetBottom - 17; // Margin bot + border = 22px.

            // Minimum height 265px.
            var height = Math.max(265, availableHeight);
            this.$leftContainer.height(height);
            this.$rightContainer.height(height);

            if (leftZoom !== null) {
                this.$leftZoom.val(leftZoom.toString());
                this.leftCanvas.width = this.$leftContainer.width() * leftZoom;
                this.leftCanvas.height = height * leftZoom;
                this.leftRenderer.resize(this.leftCanvas.width, this.leftCanvas.height);

                if (leftZoom > 1) {
                    $("#se-game-left .input-group").css("right", 30);
                    this.$leftContainer.css("overflow", "auto");
                    this.centerNode(this.SEGameLogic.getCurrentConfiguration().left, Move.Left);
                } else {
                    $("#se-game-left .input-group").css("right", 10);
                    this.$leftContainer.css("overflow", "hidden");
                }
            }

            if (rightZoom !== null) {
                this.$rightZoom.val(rightZoom.toString());
                this.rightCanvas.width = this.$rightContainer.width() * rightZoom;
                this.rightCanvas.height = height * rightZoom;
                this.rightRenderer.resize(this.rightCanvas.width, this.rightCanvas.height);

                if (rightZoom > 1) {
                    $("#se-game-right .input-group").css("right", 30);
                    this.$rightContainer.css("overflow", "auto");
                    this.centerNode(this.findRightCenterNode(), Move.Right);
                } else {
                    $("#se-game-right .input-group").css("right", 10);
                    this.$rightContainer.css("overflow", "hidden");
                }
            }
        }
    }

    class SEGameLogic extends Abstract {

        private energyLeft: number[];
        private succGen: CCS.SuccessorGenerator;
        private bjn: BJN.Game;
        private attackerWinBudgets: Map<BJN.Position, number[][]>;

        private gameActivity: SEGame;
        private gameLog: GameLog;

        private currentLeft: string;
        private currentRight: { q: string | undefined, qSet: string[] | undefined, qStarSet: string[] | undefined };

        private attacker: Player;
        private defender: Player;
        private currentWinner: Player;

        private moveCount: number = 1;

        private cycleCache: any;

        constructor(gameActivity: SEGame, gameLog: GameLog, succGen: CCS.SuccessorGenerator,
            energyBudget: number[], currentLeft: any, currentRight: any) {
            super();

            this.gameActivity = gameActivity;
            this.gameLog = gameLog;
            this.succGen = succGen;
            this.energyLeft = energyBudget;
            this.currentLeft = currentLeft;
            this.currentRight = currentRight;
            let parsedGraph = BJN.parseForBJN(this.succGen);
            this.bjn = new BJN.Game(parsedGraph, parsedGraph.getNodeByLabel(this.currentLeft)!,
                parsedGraph.getNodeByLabel(this.currentRight.qSet![0])!);
            this.attackerWinBudgets = BJN.computeWinningBudgets(this.bjn);
        }

        public getTransitionStr(update: string): string {
            return "-" + update + "->";
        }

        public getGameLog(): GameLog {
            return this.gameLog;
        }

        public getEnergyLeft(): number[] {
            return this.energyLeft;
        }

        public getMoveCount(): number {
            return this.moveCount;
        }

        public isCurrentWinner(player: Player): boolean {
            return this.getCurrentWinner() === player;
        }

        public getCurrentConfiguration(): any {
            return { left: this.currentLeft, right: this.currentRight };
        }

        public startGame(): void {
            if (this.attacker == undefined || this.defender == undefined)
                throw "No players in game.";
            this.stopGame();

            this.cycleCache = {};
            this.cycleCache[this.bjn.parsePosition(this.currentLeft, this.currentRight).toString()] = true;

            this.gameActivity.highlightNodes();
            this.gameActivity.centerNode(this.currentLeft, Move.Left);
            this.gameActivity.centerNode(this.gameActivity.findRightCenterNode(), Move.Right);

            this.currentWinner = this.getCurrentWinner();
            this.gameLog.printIntro(this.currentWinner, this.attacker);
            this.gameLog.printMoveStart(this.moveCount, this.getCurrentConfiguration());
            this.preparePlayer(this.attacker);
        }

        public stopGame(): void {
            // tell players to abort their prepared play
            this.attacker.abortPlay();
            this.defender.abortPlay();
        }

        public setPlayers(attacker: Player, defender: Player): void {
            if (attacker.getPlayType() == defender.getPlayType()) {
                throw "Cannot make game with two " + attacker.playTypeStr() + "s";
            }
            else if (attacker.getPlayType() != PlayType.Attacker ||
                defender.getPlayType() != PlayType.Defender) {
                throw "setPlayer(...) : First argument must be attacker and second defender";
            }

            this.attacker = attacker;
            this.defender = defender;
        }
        private saveCurrentConfig(position: BJN.Position): void {
            this.currentLeft = position.p.label;
            let qSet: string[] | undefined = undefined;
            if (position.qSet) {
                qSet = [];
                position.qSet.forEach((e) => {
                    qSet!.push(e.label);
                })
            }
            let qStarSet: string[] | undefined = undefined;
            if (position.qStarSet) {
                qStarSet = [];
                position.qStarSet.forEach((e) => {
                    qStarSet!.push(e.label);
                })
            }
            this.currentRight = { q: position.q?.label, qSet: qSet, qStarSet: qStarSet };

        }

        public play(player: Player, choice: BJN.Move): void {
            this.gameLog.printPlay(player, choice, this);
            this.saveCurrentConfig(choice.to);
            this.energyLeft = BJN.update(this.energyLeft, choice.update);
            // check for exceeded budget and cycle
            if (this.energyLeft.some((dim) => { return dim < 0; })) {
                this.gameLog.printExcessWinner((player === this.attacker) ? this.defender : this.attacker);
                this.stopGame();
            }
            else {
                // check for cycle if it's attacker's turn. Short circuit evaluation
                if (choice.to.isDefenderPosition || !this.cycleExists()) {
                    this.moveCount++;
                    this.gameLog.printMoveStart(this.moveCount, this.getCurrentConfiguration());
                    if (choice.to.isDefenderPosition) {
                        this.preparePlayer(this.defender);
                    }
                    else {
                        this.preparePlayer(this.attacker);
                    }
                }
            }
            this.gameActivity.onPlay(choice.to);
            this.gameActivity.centerNode(choice.to.p.label, Move.Left);
            this.gameActivity.centerNode(this.gameActivity.findRightCenterNode(), Move.Right);
        }

        private preparePlayer(player: Player) {
            var choices: any = this.getCurrentChoices();

            // determine if game is over
            if (choices.length === 0) {
                // the player to be prepared cannot make a move
                // the player to prepare has lost, announce it
                this.gameLog.printStuckWinner((player === this.attacker) ? this.defender : this.attacker);

                // stop game
                this.stopGame();
            } else {
                // save the old winner, and then update who wins
                var oldWinner = this.currentWinner
                this.currentWinner = this.getCurrentWinner();

                // if winner changed, let the user know
                if (oldWinner !== this.currentWinner)
                    this.gameLog.printWinnerChanged(this.currentWinner);

                // tell the player to prepare for his turn
                player.prepareTurn(choices, this);
            }
        }

        private cycleExists(): boolean {
            let cacheStr = this.bjn.parsePosition(this.currentLeft, this.currentRight).toString();

            if (this.cycleCache[cacheStr]) {
                // cycle detected
                this.gameLog.printCycleWinner(this.defender);
                this.stopGame();

                // clear the cache
                this.cycleCache = {};
                return true;
            } else {
                this.cycleCache[cacheStr] = true;
                return false;
            }
        }

        public getCurrentChoices(): any {
            return this.bjn.getPossibleMoves(this.bjn.parsePosition(this.currentLeft, this.currentRight));
        }

        public getCurrentWinner(): Player {
            let choices = this.bjn.getPossibleMoves(this.bjn.parsePosition(this.currentLeft, this.currentRight));
            if (this.currentRight.qStarSet) { return this.getWinningDefend(choices) ? this.defender : this.attacker }
            else { return this.getWinningAttack(choices) ? this.attacker : this.defender }
        }

        public getWinningAttack(choices: BJN.Move[]): any {
            for (let i = 0; i < choices.length; i++) {
                // check if position was visited before (cycle avoidance)
                if (this.cycleCache[choices[i].to.toString()]) { continue; }
                let newEnergyLeft: number[] = BJN.update(this.energyLeft, choices[i].update);
                let positionAttackerWin = this.attackerWinBudgets.get(choices[i].to);
                if (!positionAttackerWin) { throw "Something went wrong when selecting a move."; }
                else {
                    if (positionAttackerWin.some((budget) => {
                        return budget.every((dim, index) => {
                            return dim <= newEnergyLeft[index];
                        })
                    })) {
                        return choices[i];
                    }
                }
            }
            return false;
        }
        public getLosingAttack(choices: any): any {
            let bestScore: number = -Infinity;
            let bestChoice: BJN.Move;
            for (let i = 0; i < choices.length; i++) {
                // cycle check
                if (this.cycleCache[choices[i].to.toString()]) {
                    if (i === 0) { bestChoice = choices[0]; }
                    continue;
                }
                let newEnergyLeft: number[] = BJN.update(this.energyLeft, choices[i].update);
                // budget excess check
                if (newEnergyLeft.some((dim) => { return dim < 0; })) {
                    if (i === 0) { bestChoice = choices[0]; }
                    continue;
                }
                let positionAttackerWin = this.attackerWinBudgets.get(choices[i].to);
                if (!positionAttackerWin) { throw "Something went wrong when selecting a move."; }
                if (positionAttackerWin.length === 0) {
                    if (i === 0) { bestChoice = choices[0]; }
                    continue;
                }
                // manhattan-distance as indicator of best possible losing move
                positionAttackerWin.forEach((budget) => {
                    let score: number = newEnergyLeft.reduce((acc, curr, i) => {
                        if (curr === Infinity) { return acc + 100 - budget[i] }
                        return acc + curr - budget[i];
                    }, 0)
                    if (score > bestScore) {
                        bestScore = score;
                        bestChoice = choices[i];
                    }
                })
            }
            return bestChoice!;
        }
        public getWinningDefend(choices: BJN.Move[]): any {
            for (let i = 0; i < choices.length; i++) {
                let newEnergyLeft: number[] = BJN.update(this.energyLeft, choices[i].update);
                let positionAttackerWin = this.attackerWinBudgets.get(choices[i].to);
                if (!positionAttackerWin) { throw "Something went wrong when selecting a move."; }
                else {
                    if (positionAttackerWin.every((budget) => {
                        return budget.some((dim, index) => {
                            return dim > newEnergyLeft[index];
                        })
                    })) {
                        return choices[i];
                    }
                }
            }
            return false;
        }
        public getLosingDefend(choices: any): any {
            let bestScore: number = Infinity;
            let bestChoice: BJN.Move;
            for (let i = 0; i < choices.length; i++) {
                let newEnergyLeft: number[] = BJN.update(this.energyLeft, choices[i].update);
                let positionAttackerWin = this.attackerWinBudgets.get(choices[i].to);
                if (!positionAttackerWin) { throw "Something went wrong when selecting a move."; }
                // manhattan-distance as indicator of best possible losing move
                let minBudget: number = Infinity;
                positionAttackerWin.forEach((budget) => {
                    minBudget = Math.min(minBudget, budget.reduce((acc, curr) => { return acc + curr }, 0))
                })
                let score: number = newEnergyLeft.reduce((acc, curr) => {
                    if (curr === Infinity) { return acc + 100 }
                    return acc + curr;
                }, 0)
                score -= minBudget;
                if (score < bestScore) {
                    bestScore = score;
                    bestChoice = choices[i];
                }
            }
            return bestChoice!;
        }
    }

    class Player extends Abstract {

        constructor(private playType: PlayType) {
            super();
            this.playType = playType;
        }

        public prepareTurn(choices: any, game: SEGameLogic): void {
            switch (this.playType) {
                case PlayType.Attacker: {
                    this.prepareAttack(choices, game);
                    break;
                }
                case PlayType.Defender: {
                    this.prepareDefend(choices, game);
                    break;
                }
            }
        }

        public getPlayType(): PlayType {
            return this.playType;
        }

        public abortPlay(): void {
            // virtual, override
        }

        public playTypeStr(allLower: boolean = false): string {
            if (allLower) {
                return this.playType == PlayType.Attacker ? "attacker" : "defender";
            } else {
                return this.playType == PlayType.Attacker ? "Attacker" : "Defender";
            }
        }

        /* Abstract methods */
        protected prepareAttack(choices: any, game: SEGameLogic): void { this.abstract(); }
        protected prepareDefend(choices: any, game: SEGameLogic): void { this.abstract(); }
    }

    class Human extends Player {

        private $table;

        constructor(playType: PlayType, private gameActivity: SEGame) {
            super(playType);

            this.$table = $("#se-game-transitions-table").find("tbody");
        }

        protected prepareAttack(choices: any, game: SEGameLogic): void {
            this.fillTable(choices, game);
            game.getGameLog().printPrepareMove();
        }

        protected prepareDefend(choices: any, game: SEGameLogic): void {
            this.fillTable(choices, game);
            game.getGameLog().printPrepareMove();
        }

        private fillTable(choices: any, game: SEGameLogic): void {
            var actionTransition: string;

            this.$table.empty();
            choices.forEach((choice) => {
                var row = $("<tr></tr>");
                //row.attr("data-target-id", choice.targetProcess.id); // attach targetid on the row
                // TODO: einheitlich machen
                var sourcePositionLabel = choice.from.toString();
                var $source = this.labelWithTooltip(sourcePositionLabel);
                var $sourceTd = $("<td id='source'></td>").append($source);
                actionTransition = choice.updateToString();
                var $actionTd = $("<td id='update'></td>").append(actionTransition);
                var $targetTd = $("<td id='target'></td>").append(this.labelWithTooltip(choice.to.toString()));

                // onClick
                $(row).on("click", (event) => {
                    this.clickChoice(choice, game);
                });

                row.append($sourceTd, $actionTd, $targetTd);
                this.$table.append(row);
            });
        }

        private labelWithTooltip(label: string): JQuery {
            return Tooltip.wrapProcess(label);
        }

        private clickChoice(choice: any, game: SEGameLogic): void {
            this.$table.empty();
            game.play(this, choice);
        }

        public abortPlay(): void {
            this.$table.empty();
        }
    }

    // such ai
    class Computer extends Player {

        static Delay: number = 0;

        private delayedPlay;

        constructor(playType: PlayType) {
            super(playType);
        }

        public abortPlay(): void {
            clearTimeout(this.delayedPlay);
        }

        protected prepareAttack(choices: any, game: SEGameLogic): void {
            // select strategy
            if (game.isCurrentWinner(this))
                this.delayedPlay = setTimeout(() => this.winningAttack(choices, game), Computer.Delay);
            else
                this.delayedPlay = setTimeout(() => this.losingAttack(choices, game), Computer.Delay);
        }

        protected prepareDefend(choices: any, game: SEGameLogic): void {
            // select strategy
            if (game.isCurrentWinner(this))
                this.delayedPlay = setTimeout(() => this.winningDefend(choices, game), Computer.Delay);
            else
                this.delayedPlay = setTimeout(() => this.losingDefend(choices, game), Computer.Delay);
        }

        private losingAttack(choices: any, game: SEGameLogic): void {
            var losingAttack = game.getLosingAttack(choices);
            game.play(this, losingAttack);
        }

        private winningAttack(choices: any, game: SEGameLogic): void {
            var choice: any = game.getWinningAttack(choices);
            game.play(this, choice);
        }

        private losingDefend(choices: any, game: SEGameLogic): void {
            var choice = game.getLosingDefend(choices);
            game.play(this, choice);
        }

        private winningDefend(choices: any, game: SEGameLogic): void {
            var choice = game.getWinningDefend(choices);
            game.play(this, choice);
        }
    }

    class GameLog extends Abstract {
        private $log: JQuery;

        constructor(protected time: string) {
            super();
            this.$log = $("#se-game-log");
            this.$log.empty();
        }

        private println(line: string, wrapper?: string): void {
            if (wrapper) {
                this.$log.append($(wrapper).append(line));
            } else {
                this.$log.append(line);
            }

            this.$log.scrollTop(this.$log[0].scrollHeight);;
        }

        private render(template: string, context: any): string {
            for (var i in context) {
                var current = context[i].text;

                if (context[i].tag) {
                    current = $(context[i].tag).append(current);

                    for (var j in context[i].attr) {
                        current.attr(context[i].attr[j].name, context[i].attr[j].value);
                    }

                    template = template.replace("{" + i + "}", current[0].outerHTML);
                } else {
                    template = template.replace("{" + i + "}", current);
                }
            }

            return template;
        }

        private removeLastPrompt(): void {
            this.$log.find(".se-game-prompt").last().remove();
        }

        public printMoveStart(move: number, configuration: any): void {
            this.println("Move " + move, "<h4 class='se-game-round'>");
            this.printConfiguration(configuration);
        }

        public printPrepareMove() {
            this.println("Pick a move from the table.", "<p class='se-game-prompt'>");
        }

        private printConfiguration(configuration: any): void {
            var template = "Current configuration: ({1}, {2}).";

            let rightConfig: string = "";
            if (configuration.right.q) {
                rightConfig += configuration.right.q;
            }
            else {
                rightConfig += "{";
                for (let i = 0; i < configuration.right.qSet.length; i++) {
                    rightConfig += configuration.right.qSet[i];
                    rightConfig += i < configuration.right.qSet.length - 1 ? "," : "";
                }
                rightConfig += "}";
                if (configuration.right.qStarSet) {
                    rightConfig += ",{";
                    for (let i = 0; i < configuration.right.qStarSet.length; i++) {
                        rightConfig += configuration.right.qStarSet[i];
                        rightConfig += i < configuration.right.qStarSet.length - 1 ? "," : "";
                    }
                    rightConfig += "}";
                }
            }

            var context = {
                1: { text: configuration.left, tag: "<span>", attr: [{ name: "class", value: "monospace" }] },
                2: { text: rightConfig, tag: "<span>", attr: [{ name: "class", value: "monospace" }] }
            }

            this.println(this.render(template, context), "<p>");
        }

        public printPlay(player: Player, choice: BJN.Move, game: SEGameLogic): void {
            var template = "{1} played {2} {3} {4}.";

            let actionTransition = game.getTransitionStr(choice.updateToString());
            let actionContext = { text: actionTransition, tag: "<span>", attr: [{ name: "class", value: "monospace" }] };

            var context = {
                1: { text: (player instanceof Computer) ? player.playTypeStr() : "You (" + player.playTypeStr(true) + ")" },
                2: { text: choice.from.toString(), tag: "<span>", attr: [{ name: "class", value: "monospace" }] },
                3: actionContext,
                4: { text: choice.to.toString(), tag: "<span>", attr: [{ name: "class", value: "monospace" }] }
            };

            if (player instanceof Human) {
                this.removeLastPrompt();
            }

            this.println(this.render(template, context), "<p>");
        }

        public printStuckWinner(winner: Player): void {
            var template = "{1} no available transitions. You {2}!";

            var context = {
                1: { text: (winner instanceof Computer) ? "You ({3}) have" : (winner.getPlayType() === PlayType.Attacker) ? "Defender has" : "Attacker has" },
                2: { text: (winner instanceof Computer) ? "lose" : "win" },
                3: { text: (winner.getPlayType() === PlayType.Attacker) ? "defender" : "attacker" }
            };

            this.println(this.render(template, context), "<p class='outro'>");
        }

        public printExcessWinner(winner: Player): void {
            if (winner.getPlayType() == PlayType.Attacker) { throw "Defender cannot lose by exceeding the budget" }
            let template = "{1} exceeded the budget. You {2}!";
            let context = {
                1: { text: (winner instanceof Human) ? "Attacker has" : "You (attacker) have" },
                2: { text: (winner instanceof Human) ? "win" : "lose" }
            };
            this.println(this.render(template, context), "<p class='outro'>");
        }

        public printCycleWinner(winner: Player): void {
            var template = "A cycle has been detected. {1}!";

            var context = {
                1: { text: (winner instanceof Human) ? "You (defender) win" : "You (attacker) lose" }
            };

            this.println(this.render(template, context), "<p class='outro'>");
        }

        public printWinnerChanged(winner: Player): void {
            var you = winner.getPlayType() === PlayType.Attacker ? "defender" : "attacker";
            this.println("You (" + you + ") made a bad move. " + winner.playTypeStr() + " now has a winning strategy.", "<p>");
        }

        public printIntro(winner: Player, attacker: Player): void {
            var template = "You are playing {1} in a Spectroscopy Energy Game";

            var context = {
                1: { text: (attacker instanceof Computer ? "defender" : "attacker") },
            }

            this.println(this.render(template, context), "<p class='intro'>");

            if (winner instanceof Human) {
                this.println("You have a winning strategy.", "<p class='intro'>");
            } else {
                this.println(winner.playTypeStr() + " has a winning strategy. You are going to lose.", "<p class='intro'>");
            }
        }
    }
}
