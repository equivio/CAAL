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
        protected forSpectroscopy : boolean = false;

        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(status);
            this.firstProcess = options.firstProcess;
            this.secondProcess = options.secondProcess;
            this.type = options.type;
            this.time = options.time;
            this.comment = options.comment;
            // flag to distinguish between independent eqs and those that are part of the multiple at once strong-spectroscopy-verififcation
            this.forSpectroscopy = options.forSpectroscopy;
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

        public getforSpectroscopy(){
            return this.forSpectroscopy;
        }

        public setforSpectroscopy(value : boolean){
            this.forSpectroscopy = value;
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
            return this.firstProcess + " sim<sub>" + symbol + super.getTimeSubscript() +"</sub> " + this.secondProcess;
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

    export class StrongSpectroscopyEquivalence extends DistinguishingFormula{
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

    export class TwoNestedSimulation extends StrongSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>2n</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "TwoNestedSimulation";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyTwoNestedSimulationEquivalent" : "isWeaklyTwoNestedSimulationEquivalent";
        }
    }

    export class ReadySimulation extends StrongSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>RS</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "ReadySimulation";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyReadySimulationEquivalent" : "isWeaklyReadySimulationEquivalent";
        }
    }

    export class ReadinessTraces extends StrongSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>RT</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "ReadinessTraces";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyReadinessTracesEquivalent" : "isWeaklyReadinessTracesEquivalent";
        }
    }

    export class PossibleFutures extends StrongSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>PF</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "PossibleFutures";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyPossibleFuturesEquivalent" : "isWeaklyPossibleFuturesEquivalent";
        }
    }

    export class FailureTraces extends StrongSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>FT</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "FailureTraces";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyFailureTracesEquivalent" : "isWeaklyFailureTracesEquivalent";
        }
    }

    export class Readiness extends StrongSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>R</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Readiness";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyReadinessEquivalent" : "isWeaklyReadinessEquivalent";
        }
    }

    export class Revivals extends StrongSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>RV</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Revivals";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyRevivalEquivalent" : "isWeaklyRevivalEquivalent";
        }
    }

    export class ImpossibleFutures extends StrongSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>IF</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "ImpossibleFutures";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyImpossibleFuturesEquivalent" : "isWeaklyImpossibleFuturesEquivalent";
        }
    }

    export class Failures extends StrongSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>F</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Failures";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyFailureEquivalent" : "isWeaklyFailureEquivalent";
        }
    }

    export class Enabledness extends StrongSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>E</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Enabledness";
        }

        protected getWorkerHandler() : string {
            return super.getType() === "strong" ? "isStronglyEnablednessEquivalent" : "isWeaklyEnablednessEquivalent";
        }
    }

    export class WeakSpectroscopyEquivalence extends Relation{
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
    // TODO: Unify classes when distinguishing formulas implemented for weak version
    export class Srbbisim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>srbbisim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Srbbisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySrbbisim";
        }
    }

    export class Bbisim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>bbsim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Bbisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyBbisim";
        }
    }

    export class Srdbisim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>srdbisim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Srdbisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySrdbisim";
        }
    }

    export class Dbisim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>dbisim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Dbisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyDbisim";
        }
    }

    export class Etabisim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>etabisim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Etabisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyEtabisim";
        }
    }

    export class Sbisim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>sbisim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Sbisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySbisim";
        }
    }

    export class Bisim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>bisim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Bisim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyBisimilar";
        }
    }

    export class Etasim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>etasim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Etasim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyEtasim";
        }
    }

    export class Sim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>sim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Sim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySimilar";
        }
    }

    export class Twosim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>twosim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Twosim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyTwosim";
        }
    }

    export class Rsim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>rsim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Rsim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyRsim";
        }
    }

    export class Csim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>Csim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Csim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyCsim";
        }
    }

    export class Pfutures extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>pfutures</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Pfutures";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyPfutures";
        }
    }

    export class Weakreadiness extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>readiness</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Weakreadiness";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyReadiness";
        }
    }

    export class Ifutures extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>ifutures</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Ifutures";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyIfutures";
        }
    }

    export class Weakfailures extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>failures</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }
        
        public getClassName() : string {
            return "Weakfailures";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyFailures";
        }
    }

    export class Sfailures extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>sfailures</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Sfailures";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySfailures"
        }
    }

    export class Sifutures extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>sifutures</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Sifutures";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySifutures"
        }
    }

    export class Sreadiness extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>sreadiness</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Sreadiness";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySreadiness"
        }
    }

    export class Scsim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>scsim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Scsim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyScsim"
        }
    }

    export class Srsim extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>srsim</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Srsim";
        }

        protected getWorkerHandler() : string {
            return "isWeaklySrsim"
        }
    }

    export class Weaktraces extends WeakSpectroscopyEquivalence {
        public constructor(options : any, status : PropertyStatus = PropertyStatus.unknown) {
            super(options, status);
        }

        public getDescription() : string {
            var symbol = "⪯"
            return this.firstProcess + " " + symbol + "<sub>traces</sub>" + super.getTimeSubscript() + " " + this.secondProcess;
        }

        public getClassName() : string {
            return "Weaktraces";
        }

        protected getWorkerHandler() : string {
            return "isWeaklyTraceIncluded"
        }
    }
}
