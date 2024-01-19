/// <reference path="activity.ts" />
/// <reference path="game.ts" />
/// <reference path="../spectroscopy/strong-spectroscopy.ts" />

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
        private $guiContainer: JQuery;
        private $zoom: JQuery;
        private $depth: JQuery;
        private $freeze: JQuery;
        private canvas: HTMLCanvasElement;
        private renderer: Renderer;
        private guiGraph: GUI.ProcessGraphUI;

        constructor(container: string, button: string, activeToggle: string) {
            super(container, button, activeToggle);

            this.project = Project.getInstance();
            this.fullscreen = new Fullscreen($("#se-game-container")[0], $("#se-game-fullscreen"), () => this.resize(null));
            this.tooltip = new ProcessTooltip($("#se-game-status"));
            new DataTooltip($("#se-game-log")); // no need to save instance

            this.$leftProcessList = $("#se-game-left-process");
            this.$rightProcessList = $("#se-game-right-process");
            this.$ccsGameTypes = $("#se-game-ccs-type");
            this.$gameRelation = $("#se-game-relation");
            this.$playerType = $("input[name=se-player-type]");
            this.$restart = $("#se-game-restart");
            this.$energyGauge = $("#se-game-gauge");
            this.$guiContainer = $("#se-game-left-canvas");
            this.$zoom = $("#se-zoom-left");
            this.$depth = $("#se-depth-left");
            this.$freeze = $("#se-freeze-left");
            this.canvas = <HTMLCanvasElement>this.$guiContainer.find("canvas")[0];

            this.renderer = new Renderer(this.canvas);
            this.guiGraph = new GUI.ArborGraph(this.renderer);

            this.$leftProcessList.on("change", () => this.newGame(true));
            this.$rightProcessList.on("change", () => this.newGame(false));
            this.$ccsGameTypes.on("change", () => this.newGame(true));
            this.$gameRelation.on("change", () => this.newGame(false));
            this.$playerType.on("change", () => this.newGame(false));
            this.$restart.on("click", () => this.newGame(false));
            this.$freeze.on("click", (e) => this.toggleFreeze(this.guiGraph, !this.$freeze.data("frozen"), $(e.currentTarget)));

            // Manually remove focus from depth input when the canvas is clicked.
            $(this.canvas).on("click", () => { if (this.$depth.is(":focus")) this.$depth.blur() });

            this.$depth.on("change", () => {
                this.validateDepth(this.$depth);
                this.setDepth(this.SEGameLogic.getCurrentConfiguration().left, this.guiGraph, this.$depth.val());
            });

            // Use onchange instead of oninput for IE.
            if (navigator.userAgent.indexOf("MSIE ") > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./)) {
                this.$zoom.on("change", () => this.resize(this.$zoom.val()));
            } else {
                this.$zoom.on("input", () => this.resize(this.$zoom.val()));
            }
        }

        private setDepth(processId: string, graph: GUI.ProcessGraphUI, depth: number): void {
            this.clear(graph);
            let process = this.graph.processById(processId);
            this.draw(process, graph, depth, true);
            this.toggleFreeze(graph, false, this.$freeze);
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
            $(window).on("resize", () => this.resize(this.$zoom.val()));

            this.fullscreen.onShow();

            if (this.changed || configuration) {
                this.$ccsGameTypes.show();
                this.changed = false;
                this.graph = this.project.getGraph();
                this.displayOptions();
                this.newGame(true, configuration);
            }

            this.tooltip.setGraph(this.graph);

            this.guiGraph.setOnSelectListener((processId) => {
                if (this.guiGraph.getProcessDataObject(processId.toString()).status === "unexpanded")
                    this.draw(this.graph.processById(processId), this.guiGraph, this.$depth.val(), true);
            });

            this.guiGraph.setHoverOnListener((processId) => {
                this.timeout = setTimeout(() => {
                    var tooltipAnchor = $("#se-game-canvas-tooltip-left");
                    var position = this.guiGraph.getPosition(processId);

                    tooltipAnchor.css("left", position.x - this.$guiContainer.scrollLeft());
                    tooltipAnchor.css("top", position.y - this.$guiContainer.scrollTop() - 10);

                    tooltipAnchor.tooltip({ title: this.tooltip.ccsNotationForProcessId(processId), html: true });
                    tooltipAnchor.tooltip("show");
                }, 1000)
            });

            this.guiGraph.setHoverOutListener(() => {
                clearTimeout(this.timeout);
                $("#se-game-canvas-tooltip-left").tooltip("destroy");
            });

            this.guiGraph.bindCanvasEvents();

            this.toggleFreeze(this.guiGraph, this.$freeze.data("frozen"), this.$freeze); // (un)freeze, depending on the lock icon
        }

        public onHide(): void {
            $(window).off("resize");

            this.fullscreen.onHide();

            this.guiGraph.clearOnSelectListener();
            this.guiGraph.clearHoverOnListener();
            this.guiGraph.clearHoverOutListener();

            this.guiGraph.unbindCanvasEvents();

            this.guiGraph.freeze(); // force freeze for graph
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

        public getGuiGraph(): GUI.ProcessGraphUI {
            return this.guiGraph;
        }

        public getDepth(): JQuery {
            return this.$depth;
        }

        public getGraph(): ccs.Graph {
            return this.graph;
        }

        private displayEnergyGauge(energyLeft: number[]): void {
            let str = "Energy Budget: (";
            for (let i = 0; i < energyLeft.length; i++) {
                str += energyLeft[i] === Infinity ? "∞" : energyLeft[i];
                str += i < energyLeft.length - 1 ? ", " : ")";
            }
            this.$energyGauge.html(str);
        }

        private newGame(drawLeft: boolean, configuration?: any): void {
            var options;

            if (configuration) {
                options = configuration;
                this.setOptions(options);
            } else {
                options = this.getOptions();
            }

            this.succGen = CCS.getSuccGenerator(this.graph,
                { inputMode: InputMode[this.project.getInputMode()], time: options.time, succGen: options.type, reduce: true });

            if (drawLeft || !this.guiGraph.getNode(this.succGen.getProcessByName(options.leftProcess).id.toString())) {
                this.clear(this.guiGraph);
                this.draw(this.succGen.getProcessByName(options.leftProcess), this.guiGraph, this.$depth.val(), false);
                this.resize(1);
                this.toggleFreeze(this.guiGraph, false, this.$freeze);
            }

            if (this.SEGameLogic !== undefined) { this.SEGameLogic.stopGame() };

            let budget = this.getEnergyBudgetFromRelation(options.relation);
            this.displayEnergyGauge(budget);

            this.SEGameLogic = new SEGameLogic(this, new GameLog(options.time), this.succGen, budget, this.succGen.getProcessByName(options.leftProcess),
                { q: undefined, qSet: [this.succGen.getProcessByName(options.rightProcess)], qStarSet: undefined })

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
                case "TraceInclusion":
                    return [Infinity, 1, 0, 0, 0, 0];
                case "Enabledness":
                    return [1, 1, 0, 0, 0, 0];
                default:
                    throw "Relation does not exist."
            }
        }

        public draw(process: CCS.Process, graph: GUI.ProcessGraphUI, depth: number, highlightNodes: boolean): void {
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

        public onPlay(position: StrongSpectroscopy.Position): void {
            let depth = this.$depth.val();
            this.draw(position.p, this.guiGraph, depth, false);
            if (position.q) {
                this.draw(position.q, this.guiGraph, depth, false);
            }
            else {
                position.qSet!.forEach((process) => {
                    this.draw(process, this.guiGraph, depth, false);
                })
                if (position.qStarSet) {
                    position.qStarSet.forEach((process) => {
                        this.draw(process, this.guiGraph, depth, false);
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
            let configIds = Object.create(null);

            configIds.p = configuration.left.id;

            if (configuration.right.q) {
                configIds.q = configuration.right.q.id;
            }
            else {
                if (configuration.right.qSet) {
                    configIds.qSet = [];
                    configuration.right.qSet.forEach((proc) => {
                        configIds.qSet.push(proc.id);
                    })
                }
                if (configuration.right.qStarSet) {
                    configIds.qStarSet = [];
                    configuration.right.qStarSet.forEach((proc) => {
                        configIds.qStarSet.push(proc.id);
                    })
                }
            }
            this.guiGraph.setGraphNodes(configIds);
        }

        private clear(graph: GUI.ProcessGraphUI): void {
            graph.clearAll();
        }

        public labelFor(process: CCS.Process): string {
            return this.graph.getLabel(process);
        }

        public centerNode(process: CCS.Process | undefined): void {
            if (!process) { return; }
            var position = this.guiGraph.getPosition(process.id.toString());
            this.$guiContainer.scrollLeft(position.x - (this.$guiContainer.width() / 2));
            this.$guiContainer.scrollTop(position.y - (this.$guiContainer.height() / 2));
        }

        private resize(zoom: number): void {
            var offsetTop = $("#se-game-main").offset().top;
            var offsetBottom = $("#se-game-status").height();

            var availableHeight = window.innerHeight - offsetTop - offsetBottom - 17; // Margin bot + border = 22px.

            // Minimum height 265px.
            var height = Math.max(265, availableHeight);
            this.$guiContainer.height(height);

            if (zoom !== null) {
                this.$zoom.val(zoom.toString());
                this.canvas.width = this.$guiContainer.width() * zoom;
                this.canvas.height = height * zoom;
                this.renderer.resize(this.canvas.width, this.canvas.height);

                if (zoom > 1) {
                    $("#se-game-left .input-group").css("right", 30);
                    this.$guiContainer.css("overflow", "auto");
                    this.centerNode(this.SEGameLogic.getCurrentConfiguration().left);
                } else {
                    $("#se-game-left .input-group").css("right", 10);
                    this.$guiContainer.css("overflow", "hidden");
                }
            }
        }
    }

    class SEGameLogic extends Abstract {

        private energyLeft: number[];
        private succGen: CCS.SuccessorGenerator;
        private strongSpectroscopy: StrongSpectroscopy.Game;
        private attackerWinBudgets: Map<StrongSpectroscopy.Position, {budget: number[], hml: HML.Formula}[]>;

        private gameActivity: SEGame;
        private gameLog: GameLog;

        private currentLeft: CCS.Process;
        private currentRight: { q: CCS.Process | undefined, qSet: CCS.Process[] | undefined, qStarSet: CCS.Process[] | undefined };
        private selectedForChallenge : CCS.Process[] = [];
        private $confirmChallengeBtn: JQuery;

        private attacker: Player;
        private defender: Player;
        private currentWinner: Player;

        private moveCount: number = 1;

        private cycleCache: any;

        private readyForInput: boolean = true;

        constructor(gameActivity: SEGame, gameLog: GameLog, succGen: CCS.SuccessorGenerator,
            energyBudget: number[], currentLeft: CCS.Process, currentRight: any) {
            super();

            this.gameActivity = gameActivity;
            this.gameLog = gameLog;
            this.succGen = succGen;
            this.energyLeft = energyBudget;
            this.currentLeft = currentLeft;
            this.currentRight = currentRight;
            this.strongSpectroscopy = new StrongSpectroscopy.Game(this.succGen, this.currentLeft,
                this.currentRight.qSet![0]!);
            this.attackerWinBudgets = StrongSpectroscopy.computeWinningBudgets(this.strongSpectroscopy);

            this.$confirmChallengeBtn = $("#se-game-confirm-challenge");
            // no duplicate event listeners with this
            this.$confirmChallengeBtn.off("click");
            this.$confirmChallengeBtn.on("click", () => this.confirmChallenge());
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
            this.cycleCache[this.strongSpectroscopy.parsePosition(this.currentLeft, this.currentRight).toString()] = true;

            this.gameActivity.highlightNodes();
            this.gameActivity.centerNode(this.currentLeft);

            this.gameActivity.getGuiGraph().setOnSelectListener((processId) => {
                // keep previous onClick-functionality
                if (this.gameActivity.getGuiGraph().getProcessDataObject(processId.toString()).status === "unexpanded"){
                    this.gameActivity.draw(this.gameActivity.getGraph().processById(processId), this.gameActivity.getGuiGraph(), this.gameActivity.getDepth().val(), true);
                }

                // handling of clicks on procs for move selection
                if (!this.readyForInput) { return; }
                this.readyForInput = false;
                this.selectMoveFromGraphView(processId);
            });

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
        private saveCurrentConfig(position: StrongSpectroscopy.Position): void {
            this.currentLeft = position.p;
            let qSet: CCS.Process[] | undefined = undefined;
            if (position.qSet) {
                qSet = [];
                position.qSet.forEach((q) => {
                    qSet!.push(q);
                })
            }
            let qStarSet: CCS.Process[] | undefined = undefined;
            if (position.qStarSet) {
                qStarSet = [];
                position.qStarSet.forEach((q) => {
                    qStarSet!.push(q);
                })
            }
            this.currentRight = { q: position.q, qSet: qSet, qStarSet: qStarSet };

        }

        private selectMoveFromGraphView(processId: string){
            let config = this.getCurrentConfiguration();

            // decisions
            if (config.right.q){
                // positive
                if (config.left.id === processId) {
                    let fromPos = new StrongSpectroscopy.Position(config.left, false, undefined, undefined, config.right.q);
                    let toPos = new StrongSpectroscopy.Position(config.left, false, [config.right.q]);
                    let choice = new StrongSpectroscopy.Move(fromPos, toPos, [[1,4],0,0,0,0,0]);
                    // TODO: remove if table is removed
                    $("#se-game-transitions-table").find("tbody").empty();
                    this.play(this.attacker, choice);
                    return;
                }
                // negative
                if (config.right.q.id === processId) {
                    let fromPos = new StrongSpectroscopy.Position(config.left, false, undefined, undefined, config.right.q);
                    let toPos = new StrongSpectroscopy.Position(config.right.q, false, [config.left]);
                    let choice = new StrongSpectroscopy.Move(fromPos, toPos, [[1,5],0,0,0,0,-1]);
                    // TODO: remove if table is removed
                    $("#se-game-transitions-table").find("tbody").empty();
                    this.play(this.attacker, choice);
                    return;
                }
                return;
            }
            // defender positions
            if (config.right.qStarSet) {
                // revivals
                if (config.right.qStarSet.some((qStar) => { return qStar.id === processId })) {
                    let fromPos = new StrongSpectroscopy.Position(config.left, true, config.right.qSet, config.right.qStarSet);
                    let toPos = new StrongSpectroscopy.Position(config.left, false, config.right.qStarSet);
                    let choice = new StrongSpectroscopy.Move(fromPos, toPos, [[1,3],0,0,0,0,0]);
                    // TODO: remove if table is removed
                    $("#se-game-transitions-table").find("tbody").empty();
                    this.play(this.defender, choice);
                    return;
                }
                // conj. answers
                let foundProcess;
                // check if selected proc is in qSet and save if true
                if (foundProcess = config.right.qSet.find((q) => { return q.id === processId; })) {
                    let fromPos = new StrongSpectroscopy.Position(config.left, true, config.right.qSet, config.right.qStarSet);
                    let toPos = new StrongSpectroscopy.Position(config.left, false, undefined, undefined, foundProcess);
                    let choice = new StrongSpectroscopy.Move(fromPos, toPos, [0,0,0,[3,4],0,0]);
                    // TODO: remove if table is removed
                    $("#se-game-transitions-table").find("tbody").empty();
                    this.play(this.defender, choice);
                    return;
                }
                return;
            }
            // conj. challenge provisional selection
            let foundProcess;
            // check if selected proc is in qSet and save in variable if true
            if (foundProcess = config.right.qSet.find((q) => { return q.id === processId; })) {
                // save selected proc if selected for challenge
                if (this.gameActivity.getGuiGraph().toggleSelectForChallenge(processId)) {
                    this.selectedForChallenge.push(foundProcess);
                    this.readyForInput = true;
                    return;
                }
                // remove saved proc if deselected
                let removeIndex = this.selectedForChallenge.indexOf(foundProcess);
                this.selectedForChallenge.splice(removeIndex, 1);
                this.readyForInput = true;
                return
            }
            this.readyForInput = true;
        }

        private confirmChallenge() {
            if (!this.readyForInput) { return; }

            this.readyForInput = false;

            let config = this.getCurrentConfiguration();

            if (!config.right.qSet || config.right.qStarSet) {
                return;
            }

            let fromPos = new StrongSpectroscopy.Position(config.left, false, config.right.qSet);
            let toPos = new StrongSpectroscopy.Position(config.left, true, StrongSpectroscopy.getSetDifference(config.right.qSet, this.selectedForChallenge), this.selectedForChallenge);
            let choice = new StrongSpectroscopy.Move(fromPos, toPos, [0,-1,0,0,0,0]);

            // cleanup
            this.selectedForChallenge = [];

            // TODO: remove if table is removed
            $("#se-game-transitions-table").find("tbody").empty();
            this.play(this.attacker, choice);
        }

        public play(player: Player, choice: StrongSpectroscopy.Move): void {
            this.gameLog.printPlay(player, choice, this);
            this.saveCurrentConfig(choice.to);
            this.energyLeft = StrongSpectroscopy.update(this.energyLeft, choice.update);
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
                        if (this.defender instanceof Player) { this.readyForInput = true; }
                        this.preparePlayer(this.defender);
                    }
                    else {
                        if (this.attacker instanceof Player) { this.readyForInput = true; }
                        this.preparePlayer(this.attacker);
                    }
                }
            }
            this.gameActivity.onPlay(choice.to);
            this.gameActivity.centerNode(choice.to.p);
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
            let cacheStr = this.strongSpectroscopy.parsePosition(this.currentLeft, this.currentRight).toString();

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
            return this.strongSpectroscopy.getPossibleMoves(this.strongSpectroscopy.parsePosition(this.currentLeft, this.currentRight));
        }

        public getCurrentWinner(): Player {
            let choices = this.strongSpectroscopy.getPossibleMoves(this.strongSpectroscopy.parsePosition(this.currentLeft, this.currentRight));
            if (this.currentRight.qStarSet) { return this.getWinningDefend(choices) ? this.defender : this.attacker }
            else { return this.getWinningAttack(choices) ? this.attacker : this.defender }
        }

        public getWinningAttack(choices: StrongSpectroscopy.Move[]): any {
            for (let i = 0; i < choices.length; i++) {
                // check if position was visited before (cycle avoidance)
                if (this.cycleCache[choices[i].to.toString()]) { continue; }
                let newEnergyLeft: number[] = StrongSpectroscopy.update(this.energyLeft, choices[i].update);
                let positionAttackerWin = this.attackerWinBudgets.get(choices[i].to);
                if (!positionAttackerWin) { throw "Something went wrong when selecting a move."; }
                else {
                    if (positionAttackerWin.some((budget) => {
                        return budget.budget.every((dim, index) => {
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
            let bestChoice: StrongSpectroscopy.Move;
            for (let i = 0; i < choices.length; i++) {
                // cycle check
                if (this.cycleCache[choices[i].to.toString()]) {
                    if (i === 0) { bestChoice = choices[0]; }
                    continue;
                }
                let newEnergyLeft: number[] = StrongSpectroscopy.update(this.energyLeft, choices[i].update);
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
                        if (curr === Infinity) { return acc + 100 - budget.budget[i] }
                        return acc + curr - budget.budget[i];
                    }, 0)
                    if (score > bestScore) {
                        bestScore = score;
                        bestChoice = choices[i];
                    }
                })
            }
            return bestChoice!;
        }
        public getWinningDefend(choices: StrongSpectroscopy.Move[]): any {
            for (let i = 0; i < choices.length; i++) {
                let newEnergyLeft: number[] = StrongSpectroscopy.update(this.energyLeft, choices[i].update);
                let positionAttackerWin = this.attackerWinBudgets.get(choices[i].to);
                if (!positionAttackerWin) { throw "Something went wrong when selecting a move."; }
                else {
                    if (positionAttackerWin.every((budget) => {
                        return budget.budget.some((dim, index) => {
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
            let bestChoice: StrongSpectroscopy.Move;
            for (let i = 0; i < choices.length; i++) {
                let newEnergyLeft: number[] = StrongSpectroscopy.update(this.energyLeft, choices[i].update);
                let positionAttackerWin = this.attackerWinBudgets.get(choices[i].to);
                if (!positionAttackerWin) { throw "Something went wrong when selecting a move."; }
                // manhattan-distance as indicator of best possible losing move
                let minBudget: number = Infinity;
                positionAttackerWin.forEach((budget) => {
                    minBudget = Math.min(minBudget, budget.budget.reduce((acc, curr) => { return acc + curr }, 0))
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
                rightConfig += configuration.right.q.id;
            }
            else {
                rightConfig += "{";
                for (let i = 0; i < configuration.right.qSet.length; i++) {
                    rightConfig += configuration.right.qSet[i].id;
                    rightConfig += i < configuration.right.qSet.length - 1 ? "," : "";
                }
                rightConfig += "}";
                if (configuration.right.qStarSet) {
                    rightConfig += ",{";
                    for (let i = 0; i < configuration.right.qStarSet.length; i++) {
                        rightConfig += configuration.right.qStarSet[i].id;
                        rightConfig += i < configuration.right.qStarSet.length - 1 ? "," : "";
                    }
                    rightConfig += "}";
                }
            }

            var context = {
                1: { text: configuration.left.id, tag: "<span>", attr: [{ name: "class", value: "monospace" }] },
                2: { text: rightConfig, tag: "<span>", attr: [{ name: "class", value: "monospace" }] }
            }

            this.println(this.render(template, context), "<p>");
        }

        public printPlay(player: Player, choice: StrongSpectroscopy.Move, game: SEGameLogic): void {
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
