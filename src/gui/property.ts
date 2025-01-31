/// <reference path="../main.ts" />
/// <reference path="../../lib/ccs.d.ts" />

enum PropertyStatus {satisfied, unsatisfied, invalid, unknown};

module Property {

    export class Property {
        private static counter : number = 0;
        protected id : number;
        private error : string = "";
        private timer : number;
        private elapsedTime : string;
        private $timeCell : JQuery;
        private $row : JQuery;
        protected project : Project;
        protected worker;
        protected comment : string;
        protected status : PropertyStatus;

        public constructor(status : PropertyStatus = PropertyStatus.unknown) {
            this.project = Project.getInstance();
            this.status = status;
            this.id = Property.counter;
            Property.counter++;
        }

        public getId() : number {
            return this.id;
        }

        public getStatus() : PropertyStatus {
            return this.status;
        }

        public setStatus(status : PropertyStatus) : void {
            this.status = status;
        }

        public getError() : string {
            return this.error;
        }

        public setError(error : string) : void {
            this.error = error;
        }

        public getComment() : string {
            return this.comment;
        }

        public getRow() : JQuery {
            return this.$row;
        }

        public setRow($row : JQuery) : void {
            this.$row = $row;
        }

        public setTimeCell($timeCell : JQuery) : void {
            this.$timeCell = $timeCell;
        }

        public getElapsedTime() : string {
            return this.elapsedTime;
        }

        public setElapsedTime(timeString : string) : void {
            this.elapsedTime = timeString;
        }

        public startTimer() { 
            var startTime = new Date().getTime();

            var updateTimer = () => {
                this.elapsedTime = new Date().getTime() - startTime + " ms";
                this.$timeCell.text(this.elapsedTime);
            }

            this.timer = setInterval(updateTimer, 25);
        }

        public stopTimer() {
            clearInterval(this.timer);
        }

        protected setInvalidateStatus(error? : string) : void {
            this.error = error;
            this.status = PropertyStatus.invalid;
        }

        public setUnknownStatus() : void {
            this.status = PropertyStatus.unknown;
            this.elapsedTime = "";
        }

        public abortVerification() : void {
            this.worker.terminate();
            this.worker = null;
            this.stopTimer();
            this.setUnknownStatus();
        }
        
        public verify(callback : Function) : void {
            if (!this.isReadyForVerification()) {
                console.log("something is wrong, please check the property");
                callback(this);
                return;
            }
            
            this.startTimer();
            
            var program = this.project.getCCS();
            var inputMode = InputMode[this.project.getInputMode()];
            this.worker = new Worker("lib/workers/verifier.js");
            
            this.worker.postMessage({
                type: "program",
                program: program,
                inputMode: inputMode
            });
            
            this.worker.postMessage(this.getWorkerMessage());
            
            this.worker.addEventListener("error", (error) => {
                this.worker.terminate();
                this.worker = null;
                this.setInvalidateStatus(error.message);
                this.stopTimer();
                callback(this);
            }, false);
            
            this.worker.addEventListener("message", event => {
                this.workerFinished(event, callback);
            });
        }
        
        protected workerFinished(event : any, callback : Function) : void {
            this.worker.terminate();
            this.worker = null; 
            
            this.onWorkerFinished(event);
            
            this.stopTimer();
            callback(this); /* verification ended */
        }
        
        protected onWorkerFinished(event : any) : void {
            var res = (typeof event.data.result === "boolean") ? event.data.result : PropertyStatus.unknown;
            if (res === true) {
                this.status = PropertyStatus.satisfied;
            }
            else if (res === false) {
                this.status = PropertyStatus.unsatisfied; 
            }
            else {
                this.status = res;
            }
        }
        
        protected getWorkerMessage() : any { throw "Not implemented by subclass"; }
        public getDescription() : string { throw "Not implemented by subclass"; }
        public toJSON() : any { throw "Not implemented by subclass"; }
        public isReadyForVerification() : boolean { throw "Not implemented by subclass"; }
        public getGameConfiguration() : any { throw "Not implemented by subclass"; }
        public getTime() : string {throw "Not implemented by subclass"; }
        public getFirstProcess() : string {throw "Not implemented by subclass"; }
        public getSecondProcess() : string {throw "Not implemented by subclass"; }
        public getClassName() : string {throw "Not implemented by subclass"; }
    }
    
    export class HML extends Property {
        private process : string;
        private definitions : string;
        private topFormula : string;

        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(status);
            this.process = options.process;
            this.definitions = options.definitions;
            this.topFormula = options.topFormula;
            this.comment = options.comment;
        }

        public getProcess() : string {
            return this.process;
        }

        public getTopFormula() : string {
            return this.topFormula;
        }

        public setTopFormula(formula : string) : void {
            this.topFormula = formula;
            this.setUnknownStatus();
        }

        public getDefinitions() : string {
            return this.definitions;
        }

        public getDescription() : string {
            var formula = this.topFormula.replace(";", "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

            var definitions = this.definitions.split(";").map(function(d) {
                return "<span>" + d.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim() + "</span>";
            });

            return this.process + " &#8872; " + formula + '\n' + definitions.join("\n");
        }

        public getGameConfiguration() : any {
            var formulaSetForProperty = this.project.getFormulaSetForProperty(this);
            var HmlConfiguration = Object.create(null),
                graph : ccs.Graph = this.project.getGraph();

            HmlConfiguration.succGen = CCS.getSuccGenerator(this.project.getGraph(), {inputMode: InputMode[this.project.getInputMode()], succGen: "strong", reduce: false});
            HmlConfiguration.processName = this.process;
            HmlConfiguration.propertyId = this.id;
            HmlConfiguration.formulaId = formulaSetForProperty.getTopFormula().id;

            return HmlConfiguration;
        }

        public toJSON() : any {
            return {
                className: "HML",
                status: this.status,
                options : {
                    process: this.process,
                    definitions: this.definitions,
                    topFormula: this.topFormula,
                    comment: this.comment
                }
            };
        }
        /**
         * Checks whehter the process is defined, and the property is not invalid, and the HML syntactically correct.
         * @return {boolean} if true everything is defined correctly.
         */
        public isReadyForVerification() : boolean {
            var isReady = true;
            var error = "";
            if (!this.getProcess()) {
                isReady = false;
                error = "There is no process selected.";
            } else {
                // if they are defined check whether they are defined in the CCS-program
                var processList = this.project.getGraph().getNamedProcesses()
                if (processList.indexOf(this.getProcess()) === -1 ) {
                    error = "The processes selected is not defined in the CCS program.";
                    isReady = false;
                }
            }

            /**
             * HML syntax check (simple)
             * complete syntax check are done by the worker, it will post a error if the hml syntax did not parse. 
             */
            if(!this.topFormula || this.topFormula === "") {
                error = "Formula is not defined.";
                isReady = false;
            }


            // Check all process constants defined
            // Same as in worker/verifier
            var inputMode = InputMode[this.project.getInputMode()];
            function readFormulaSet(data) : hml.FormulaSet {
                var formulaSet = new hml.FormulaSet();
                if (inputMode === "CCS") {
                    HMLParser.parse(data.definitions, {ccs: CCS, hml: hml, formulaSet: formulaSet});
                    HMLParser.parse(data.formula, {startRule: "TopFormula", ccs: CCS, hml: hml, formulaSet: formulaSet});
                } else if (inputMode === "TCCS") {
                    THMLParser.parse(data.definitions, {ccs: CCS, tccs: TCCS, hml: hml, formulaSet: formulaSet});
                    THMLParser.parse(data.formula, {startRule: "TopFormula", ccs: CCS, tccs: TCCS, hml: hml, formulaSet: formulaSet});
                }
                return formulaSet;
            }

            var formulaSet = null;
            if (isReady) {
                try {
                    formulaSet = readFormulaSet(this.getWorkerMessage());
                } catch (err) {
                    //Ignore handle below in case failed without exception
                }
                if (!formulaSet) {
                    isReady = false;
                    error = "Unable to parse formula and/or variable definitions";
                }
                if (isReady) {
                    var formulaEventWalker = new Traverse.FormulaEventWalker();
                    var definitions = Object.create(null);
                    var variables = Object.create(null);
                    formulaEventWalker.on('enterMinFixedPoint', def => definitions[(<any>def).variable] = true);
                    formulaEventWalker.on('enterMaxFixedPoint', def => definitions[(<any>def).variable] = true);
                    formulaEventWalker.on('enterVariable', ref => variables[(<any>ref).variable] = true);
                    formulaEventWalker.visit(formulaSet);
                    
                    // Remove defined variables, leftovers are undefined.
                    Object.keys(definitions).forEach(definedVar => delete variables[definedVar]);
                    var undefinedVars = Object.keys(variables);
                    if (undefinedVars.length > 0) {
                        isReady = false;
                        error = "The following variables are undefined: '" + undefinedVars.join("', '") + "'.";
                    }
                }
            }

            if(!isReady){
                this.setInvalidateStatus(error);
            }
            
            return isReady;
        }

        protected getWorkerMessage() : any {
            return {
                type: "checkFormula",
                processName: this.process,
                useStrict: false,
                definitions: this.definitions,
                formula: this.topFormula
            };
        }
    }
    
    export class Relation extends Property {
        protected propertyType;
        protected firstProcess : string;
        protected secondProcess : string;
        protected type : string;
        protected time : string;

        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(status);
            this.firstProcess = options.firstProcess;
            this.secondProcess = options.secondProcess;
            this.type = options.type;
            this.time = options.time;
            this.comment = options.comment;
        }

        public getFirstProcess() : string {
            return this.firstProcess;
        }

        public getSecondProcess() : string {
            return this.secondProcess;
        }

        public getType() : string {
            return this.type;
        }

        public getTime() : string {
            return this.time;
        }

        protected getTimeSubscript() : string {
            if (this.project.getInputMode() === InputMode.CCS) {
                return "";
            } else {
                return "<sub>" + (this.time === "untimed" ? "u" : "t") + "</sub>";
            }
        }

        public getGameConfiguration() : any {
            return {
                leftProcess: this.firstProcess,
                rightProcess: this.secondProcess,
                type: this.type,
                time: this.time ? this.time : "",
                relation: this.getClassName(),
                playerType: this.status === PropertyStatus.satisfied ? "attacker" : "defender"
            };
        }

        public toJSON() : any {
            return {
                className: this.getClassName(),
                status: this.status,
                options : {
                    type: this.type,
                    time: this.time,
                    firstProcess: this.firstProcess,
                    secondProcess: this.secondProcess,
                    comment: this.comment
                }
            };
        }
        
        protected getWorkerMessage() : any {
            return {
                type: this.getWorkerHandler(),
                time: this.time,
                leftProcess: this.firstProcess,
                rightProcess: this.secondProcess
            };
        }
        
        /**
         * Check whether both process(first and second) is defined, and it exists in the CCS program.
         * And property status must not be invalid.
         * @return {boolean} if true, everything is defined.
         */
        public isReadyForVerification() : boolean {
            var isReady = true;
            var error = "";

            if(!this.getFirstProcess() && !this.getSecondProcess()) {
                isReady = false;
                error = "Two processes must be selected"
            } else {
                // if they are defined check whether they are defined in the CCS-program
                var processList = this.project.getGraph().getNamedProcesses()
                if (processList.indexOf(this.getFirstProcess()) === -1 || processList.indexOf(this.getSecondProcess()) === -1) {
                    isReady = false;
                    error = "One of the processes is not defined in the CCS program."
                }
            }

            if(!isReady) { 
                this.setInvalidateStatus(error);
            }

            return isReady
        }

        public getClassName() : string { throw "Not implemented by class"; }
        protected getWorkerHandler() : string { throw "Not implemented by subclass"; }
    }

    export class DistinguishingFormula extends Relation {

        public formula: string

        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        protected workerFinished(event : any, callback : Function) : void {
            if (!(typeof event.data.result === "boolean")){
                this.formula = event.data.result.formula + ";";
                event.data.result = event.data.result.isSatisfied;
            }
            super.workerFinished(event, callback)
        }

        public generateDistinguishingFormula(generationEnded : Function) : void {
            // formula should already be generated when the formula was verified
            if (this.formula) {
                var properties = {
                    firstProperty : new HML({process: this.firstProcess, topFormula: this.formula, definitions: ""}),
                    secondProperty : new HML({process: this.secondProcess, topFormula: this.formula, definitions: ""})
                }
                generationEnded(properties);
            } else {
                generationEnded();
            }
        }
    }

    export class SpectroscopyAtOnce extends DistinguishingFormula {
        private verificationResult = undefined;

        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getGameConfiguration() : any {
            return {
                leftProcess: this.firstProcess,
                rightProcess: this.secondProcess,
                type: this.type,
                time: this.time ? this.time : "",
                relation: super.getType() === "strong" ? "Bisimulation" : "Srbbisim",
                playerType: "attacker"
            };
        }

        protected workerFinished(event : any, callback : Function) : void {
            if (event.data.result.formula){
                this.formula = event.data.result.formula + ";";
            }
            this.verificationResult = event.data.result.equalities;
            this.worker.terminate();
            this.worker = null; 
            
            this.onWorkerFinished();
            
            this.stopTimer();
            callback(this); /* verification ended */
        }

        protected onWorkerFinished() : void {
            if (this.verificationResult){
                // satisfied signals that spectroscopy backend has verified supported eqs and no distinguishing formula exists
                this.status = this.formula ? PropertyStatus.unsatisfied : PropertyStatus.satisfied;
            }
            else {
                this.status = PropertyStatus.unknown;
            }
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
                var supportedEqs = [
                    "Bisimulation",
                    "TwoNestedSimulation",
                    "ReadySimulation",
                    "PossibleFutures",
                    "Simulation",
                    "ReadinessTraces",
                    "FailureTraces",
                    "Readiness",
                    "ImpossibleFutures",
                    "Revivals",
                    "Failures",
                    "TraceInclusion",
                    "Enabledness"
                ];
            }
            else{
                var symbol = "≦";
                var supportedEqs = [
                    "Srbbisim",
                    "Bbisim",
                    "Srdbisim",
                    "Dbisim",
                    "Etabisim",
                    "Sbisim",
                    "Bisimulation",
                    "Etasim",
                    "Simulation",
                    "TwoNestedSimulation",
                    "ReadySimulation",
                    "Csim",
                    "PossibleFutures",
                    "Readiness",
                    "ImpossibleFutures",
                    "Failures",
                    "TraceInclusion",
                    "Srsim",
                    "Scsim",
                    "Sreadiness",
                    "Sifutures",
                    "Sfailures"
                ];
            }
            let desc : string = this.firstProcess + " " + symbol + "<sub>X</sub>" + " " + this.secondProcess+ " (" + super.getType() + " relations using spectroscopy)" + "\n";

            let line : string = "<div style='display: flex;'>";
            let eqDiv : {[key: string]: string} = {
                Start: "<div style='height: 35px; box-sizing: border-box; border: 1px solid rgb(0,0,0); display: flex; align-items: center; justify-content: center; padding: 2px; ",
                End: "'></div>"};

            let determineColor = function(eq, verificationResult) {
                if(verificationResult) {
                    return verificationResult[eq.charAt(0).toLowerCase() + eq.slice(1)] ? " background:rgb(65,180,65, 0.8);" : " background:rgb(255,0,0, 0.6);";
                }
                return " background:white;";
            };

            supportedEqs.forEach((eq) => {
                eqDiv[eq.charAt(0).toLowerCase() + eq.slice(1)] =  determineColor(eq, this.verificationResult) + "'>" + eq + "</div>";
            })
            
            if(super.getType() === "weak") {
                desc += "<div style='margin: 5px; width:640px; border: 1px solid rgb(0,0,0);'>" +
                        line + 
                            eqDiv["Start"] + "width:640px;" + eqDiv["srbbisim"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + "width:320px;" + eqDiv["bbisim"] + 
                            eqDiv["Start"] + "width:320px;" + eqDiv["srdbisim"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + "width:200px;" + eqDiv["etabisim"] + 
                            eqDiv["Start"] + "width:240px;" + eqDiv["dbisim"] + 
                            eqDiv["Start"] + "width:200px; border-bottom: 1px solid transparent;" + eqDiv["sbisim"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + "width:80px; border-bottom: 1px solid transparent;" + eqDiv["etasim"] + 
                            eqDiv["Start"] + "width:360px;" + eqDiv["bisimulation"] + 
                            eqDiv["Start"] + determineColor("sbisim", this.verificationResult) + "width:200px; border-top: 1px solid transparent;" + eqDiv["End"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + determineColor("etasim", this.verificationResult) + "width:80px; border-top: 1px solid transparent; border-bottom: 1px solid transparent;" + eqDiv["End"] + 
                            eqDiv["Start"] + "width:240px;" + eqDiv["twoNestedSimulation"] + 
                            eqDiv["Start"] + "width:120px; border-bottom: 1px solid transparent;" + eqDiv["csim"] + 
                            eqDiv["Start"] + "width:100px;" + eqDiv["srsim"] + 
                            eqDiv["Start"] + "width:100px;" + eqDiv["scsim"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + determineColor("etasim", this.verificationResult) + "width:80px; border-top: 1px solid transparent;" + eqDiv["End"] + 
                            eqDiv["Start"] + "width:120px;" + eqDiv["readySimulation"] + 
                            eqDiv["Start"] + "width:120px;" + eqDiv["possibleFutures"] + 
                            eqDiv["Start"] + determineColor("csim", this.verificationResult) + "width:120px; border-top: 1px solid transparent;" + eqDiv["End"] + 
                            eqDiv["Start"] + "width:100px;" + eqDiv["sreadiness"] + 
                            eqDiv["Start"] + "width:100px;" + eqDiv["sifutures"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + "width:140px; border-bottom: 1px solid transparent;" + eqDiv["simulation"] + 
                            eqDiv["Start"] + "width:150px;" + eqDiv["readiness"] + 
                            eqDiv["Start"] + "width:150px;" + eqDiv["impossibleFutures"] + 
                            eqDiv["Start"] + "width:200px; border-bottom: 1px solid transparent;" + eqDiv["sfailures"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + determineColor("simulation", this.verificationResult) + "width:140px; border-top: 1px solid transparent;" + eqDiv["End"] + 
                            eqDiv["Start"] + "width:300px;" + eqDiv["failures"] + 
                            eqDiv["Start"] + determineColor("sfailures", this.verificationResult) + "width:200px; border-top: 1px solid transparent;" + eqDiv["End"] +  "</div>" +
                        line +  
                            eqDiv["Start"] + "width:640px;" + eqDiv["traceInclusion"] + "</div>" + "</div>";
            }
            else{
                desc += "<div style='margin: 5px; width:640px; border: 1px solid rgb(0,0,0);'>" +
                        line + 
                            eqDiv["Start"] + "width:640px;" + eqDiv["bisimulation"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + "width:640px;" + eqDiv["twoNestedSimulation"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + "width:400px;" + eqDiv["readySimulation"] +
                            eqDiv["Start"] + "width:240px; border-bottom: 1px solid transparent;" + eqDiv["possibleFutures"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + "width:160px; border-bottom: 1px solid transparent;" + eqDiv["simulation"] +
                            eqDiv["Start"] + "width:240px;" + eqDiv["readinessTraces"] +
                            eqDiv["Start"] + determineColor("possibleFutures", this.verificationResult)  + "width:240px; border-top: 1px solid transparent;" + eqDiv["End"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + determineColor("simulation", this.verificationResult) + "width:160px; border-top: 1px solid transparent; border-bottom: 1px solid transparent;" + eqDiv["End"] +
                            eqDiv["Start"] + "width:160px;" + eqDiv["failureTraces"] +
                            eqDiv["Start"] + "width:160px;" + eqDiv["readiness"] +
                            eqDiv["Start"] + "width:160px; border-bottom: 1px solid transparent;" + eqDiv["impossibleFutures"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + determineColor("simulation", this.verificationResult) + "width:160px; border-top: 1px solid transparent; border-bottom: 1px solid transparent;" + eqDiv["End"] +
                            eqDiv["Start"] + "width:320px;" + eqDiv["revivals"] +
                            eqDiv["Start"] + determineColor("impossibleFutures", this.verificationResult) + "width:160px; border-top: 1px solid transparent;" + eqDiv["End"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + determineColor("simulation", this.verificationResult) + "width:160px; border-top: 1px solid transparent;" + eqDiv["End"] +
                            eqDiv["Start"] + "width:480px;" + eqDiv["failures"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + "width:640px;" + eqDiv["traceInclusion"] +  "</div>" +
                        line + 
                            eqDiv["Start"] + "width:640px;" + eqDiv["enabledness"] +  "</div>" + "</div>";
            }
            return desc;
        }

        public getClassName() : string {
            return "SpectroscopyAtOnce";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "runStrongSpectroscopy" : "runWeakSpectroscopy";
        }
    }

    export class Bisimulation extends DistinguishingFormula {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public generateDistinguishingFormula(generationEnded : Function) : void {
            if (this.formula) {
                let properties = {
                    firstProperty : new HML({process: this.firstProcess, topFormula: this.formula, definitions: ""}),
                    secondProperty : new HML({process: this.secondProcess, topFormula: this.formula, definitions: ""})
                }

                generationEnded(properties);
            }
            else{
                // start the worker, and make the worker generationEnded with the result.
                var program = this.project.getCCS();
                this.worker = new Worker("lib/workers/verifier.js");
                
                this.worker.postMessage({
                    type: "program",
                    program: program,
                    inputMode: InputMode[this.project.getInputMode()]
                });
                
                this.worker.postMessage({
                    type: "findDistinguishingFormula",
                    leftProcess: this.getFirstProcess(),
                    rightProcess: this.getSecondProcess(),
                    succGenType: super.getType()
                });
                
                this.worker.addEventListener("error", (error) => {
                    this.worker.terminate();
                    this.worker = null;
                    this.setInvalidateStatus(error.message);
                    this.stopTimer();
                    generationEnded();
                }, false);
                
                this.worker.addEventListener("message", event => {
                    this.worker.terminate();
                    this.worker = null; 

                    if (!event.data.result.isBisimilar) { //this should be false, for there to be distinguishing formula
                        var properties = {
                            firstProperty : new HML({process: this.firstProcess, topFormula: event.data.result.formula, definitions: ""}),
                            secondProperty : new HML({process: this.secondProcess, topFormula: event.data.result.formula, definitions: ""})
                        }

                        generationEnded(properties);
                        // this.verifyHml(event.data.result.formula);
                    } else {
                        this.setInvalidateStatus("The two selected processes are bisimilar, and no distinguishing formula exists.");
                        this.stopTimer()
                        generationEnded();
                    }
                });
            }
        }

        public getDescription() : string {
            var symbol = super.getType() === "strong" ? "&#8764;" : "&#8776;";
            return this.firstProcess + " " + symbol + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Bisimulation";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyBisimilar" : "isWeaklyBisimilar";
        }
    }
    
    export class Simulation extends DistinguishingFormula {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = super.getType() === "strong" ? "&#8594;" : "&#8658;";
            return this.firstProcess + " sim<sub>" + symbol + super.getTimeSubscript() + "</sub> " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Simulation";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglySimilar" : "isWeaklySimilar";
        }
    }
    
    export class SimulationEquivalence extends DistinguishingFormula {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = super.getType() === "strong" ? "&#8771;" : "&#8778;";
            return this.firstProcess + " " + symbol + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getGameConfiguration() : any {
            return null;
        }
        
        public getClassName() : string {
            return "SimulationEquivalence";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglySimulationEquivalent" : "isWeaklySimulationEquivalent";
        }
    }
    
    export class Traces extends DistinguishingFormula {
        
        constructor(options : any, status : PropertyStatus) {
            super(options, status);
        }

        public getGameConfiguration() : any {
            return null;
        }
    }
    
    export class TraceEquivalence extends Traces {
        constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }
        
        public getDescription() : string {
            var symbol = super.getType() === "strong" ? "&#8594;" : "&#8658;";
            return "Traces<sub>" + symbol + super.getTimeSubscript() + "</sub>(" + this.firstProcess + ") = Traces<sub>" + symbol + super.getTimeSubscript() + "</sub>(" + this.secondProcess + ")";
        }
        
        public getClassName() : string {
            return "TraceEquivalence";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyTraceEq" : "isWeaklyTraceEq";
        }
    }

    export class TraceInclusion extends Traces {
        constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }
        
        public getDescription() : string {
            var symbol = super.getType() === "strong" ? "&#8594;" : "&#8658;";
            return "Traces<sub>" + symbol + super.getTimeSubscript() + "</sub>(" + this.getFirstProcess() + ") &sube; Traces<sub>" + symbol + super.getTimeSubscript() + "</sub>(" + this.getSecondProcess() + ")";
        }
        
        public getClassName() : string {
            return "TraceInclusion";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyTraceIncluded" : "isWeaklyTraceIncluded";
        }

        public getGameConfiguration() {
            return {
                leftProcess: this.firstProcess,
                rightProcess: this.secondProcess,
                type: this.type,
                time: this.time ? this.time : "",
                relation: this.getClassName(),
                playerType: this.status === PropertyStatus.satisfied ? "attacker" : "defender"
            };
        }
    }

    export class TwoNestedSimulation extends DistinguishingFormula {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        // TODO: distinguish between weak and strong
        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>2n</sub>" + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "TwoNestedSimulation";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyTwoNestedSimulation" : "isWeaklyTwoNestedSimulation";
        }
    }

    export class ReadySimulation extends DistinguishingFormula {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>RS</sub>" + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "ReadySimulation";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyReadySimulation" : "isWeaklyReadySimulation";
        }
    }

    export class PossibleFutures extends DistinguishingFormula {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>PF</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "PossibleFutures";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyPossibleFutures" : "isWeaklyPossibleFutures";
        }
    }

    export class Readiness extends DistinguishingFormula {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>R</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Readiness";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyReadiness" : "isWeaklyReadiness";
        }
    }

    export class ImpossibleFutures extends DistinguishingFormula {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>IF</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "ImpossibleFutures";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyImpossibleFutures" : "isWeaklyImpossibleFutures";
        }
    }

    export class Failures extends DistinguishingFormula {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>F</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Failures";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyFailure" : "isWeaklyFailure";
        }
    }

    // parent class for all relations only supported by strong spectroscopy
    export class StrongSpectroscopyRelation extends DistinguishingFormula{
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }
        /**
         * Check whether both process(first and second) is defined, and it exists in the CCS program.
         * Property status must not be invalid.
         * Property type must be strong.
         * @return {boolean} if true, everything is defined.
         */
        public isReadyForVerification() : boolean {
            var isReady = true;
            var error = "";

            if(!this.getFirstProcess() && !this.getSecondProcess()) {
                isReady = false;
                error = "Two processes must be selected"
            } else {
                // if they are defined check whether they are defined in the CCS-program
                var processList = this.project.getGraph().getNamedProcesses()
                if (processList.indexOf(this.getFirstProcess()) === -1 || processList.indexOf(this.getSecondProcess()) === -1) {
                    isReady = false;
                    error = "One of the processes is not defined in the CCS program."
                } else{
                    if (this.type === "weak"){
                        isReady = false;
                        error = "only strong equivalences are supported."
                    }
                }
            }

            if(!isReady) { 
                this.setInvalidateStatus(error);
            }

            return isReady
        }
    }

    export class ReadinessTraces extends StrongSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>RT</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "ReadinessTraces";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyReadinessTraces" : "isWeaklyReadinessTraces";
        }
    }

    export class FailureTraces extends StrongSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>FT</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "FailureTraces";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyFailureTraces" : "isWeaklyFailureTraces";
        }
    }

    export class Revivals extends StrongSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>RV</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Revivals";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyRevival" : "isWeaklyRevival";
        }
    }

    export class Enabledness extends StrongSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>E</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Enabledness";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyEnabledness" : "isWeaklyEnabledness";
        }
    }

    // parent class for all relations only supported by weak spectroscopy
    export class WeakSpectroscopyRelation extends DistinguishingFormula{
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }
        /**
         * Check whether both process(first and second) is defined, and it exists in the CCS program.
         * Property status must not be invalid.
         * Property type must be weak.
         * @return {boolean} if true, everything is defined.
         */
        public isReadyForVerification() : boolean {
            var isReady = true;
            var error = "";

            if(!this.getFirstProcess() && !this.getSecondProcess()) {
                isReady = false;
                error = "Two processes must be selected"
            } else {
                // if they are defined check whether they are defined in the CCS-program
                var processList = this.project.getGraph().getNamedProcesses()
                if (processList.indexOf(this.getFirstProcess()) === -1 || processList.indexOf(this.getSecondProcess()) === -1) {
                    isReady = false;
                    error = "One of the processes is not defined in the CCS program."
                } else{
                    if (this.type === "strong"){
                        isReady = false;
                        error = "only weak equivalences are supported."
                    }
                }
            }

            if(!isReady) { 
                this.setInvalidateStatus(error);
            }

            return isReady
        }
    }

    export class Srbbisim extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>srbbisim</sub>" + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Srbbisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySrbbisim";
        }
    }

    export class Bbisim extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>bbsim</sub>" + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Bbisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyBbisim";
        }
    }

    export class Srdbisim extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>srdbisim</sub>" + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Srdbisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySrdbisim";
        }
    }

    export class Dbisim extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>dbisim</sub>" + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Dbisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyDbisim";
        }
    }

    export class Etabisim extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>etabisim</sub>" + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Etabisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyEtabisim";
        }
    }

    export class Sbisim extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>sbisim</sub>" + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Sbisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySbisim";
        }
    }

    export class Etasim extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>etasim</sub>" + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Etasim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyEtasim";
        }
    }

    export class Csim extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>Csim</sub>" + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Csim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyCsim";
        }
    }

    export class Sfailures extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>sfailures</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Sfailures";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySfailures"
        }
    }

    export class Sifutures extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>sifutures</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Sifutures";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySifutures"
        }
    }

    export class Sreadiness extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>sreadiness</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Sreadiness";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySreadiness"
        }
    }

    export class Scsim extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>scsim</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Scsim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyScsim"
        }
    }

    export class Srsim extends WeakSpectroscopyRelation {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            if (super.getType() === "strong"){
                var symbol = "⪯";
            }
            else{
                var symbol = "≦";
            }
            return this.firstProcess + " " + symbol + "<sub>srsim</sub>" + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Srsim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySrsim"
        }
    }
}
