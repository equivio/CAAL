module Activity {

    export class Verifier extends Activity {
        private graph : CCS.Graph;
        private timer : number;
        private queue : Property.Property[];
        private verifyingProperty = null;
        private formulaEditor : any;
        private definitionsEditor : any;

        constructor(container : string, button : string) {
            super(container, button);

            this.queue = [];

            $("#add-property").on("click", () => this.showPropertyModal());
            $("#verify-spectroscopy").on("click", () => this.verifySpectroscopy());
            $("#delete-all").on("click", () => this.deleteAllProperties());
            $("#verify-all").on("click", () => this.verifyAll());
            $("#verify-stop").on("click", () => this.stopVerify());
            $("input[name=property-type]").on("change", () => this.showSelectedPropertyType());

            var $propertyTable = $("#property-table-properties");
            (<any>$propertyTable).sortable({
                axis: "y",
                stop: (event, ui) => {
                    var newPositions = this.project.getProperties().map(prop => {
                        return $propertyTable.children().index(prop.getRow());
                    });
                    this.project.rearrangeProperties(newPositions);
                }
            });

            this.formulaEditor = ace.edit("hml-formula-editor");
            this.formulaEditor.setTheme("ace/theme/crisp");
            this.formulaEditor.getSession().setMode("ace/mode/hml");
            this.formulaEditor.setOptions({
                enableBasicAutocompletion: true,
                showPrintMargin: false,
                highlightActiveLine: false,
                fontSize: 16,
                fontFamily: "Inconsolata",
                showLineNumbers: false,
                maxLines: 1
            });

            this.definitionsEditor = ace.edit("hml-definitions-editor");
            this.definitionsEditor.setTheme("ace/theme/crisp");
            this.definitionsEditor.getSession().setMode("ace/mode/hml");
            this.definitionsEditor.getSession().setUseWrapMode(true);
            this.definitionsEditor.setOptions({
                enableBasicAutocompletion: true,
                showPrintMargin: false,
                highlightActiveLine: false,
                fontSize: 16,
                fontFamily: "Inconsolata",
                showLineNumbers: false,
                maxLines: 4
            });
        }

        public onShow() : void {
            if (this.changed) {
                this.changed = false;
                this.graph = this.project.getGraph();

                if (this.project.getInputMode() === InputMode.CCS) {
                    this.formulaEditor.getSession().setMode("ace/mode/hml");
                    this.definitionsEditor.getSession().setMode("ace/mode/hml");
                } else {
                    this.formulaEditor.getSession().setMode("ace/mode/thml");
                    this.definitionsEditor.getSession().setMode("ace/mode/thml");
                }

                var properties = this.project.getProperties();
                for (var i = 0; i < properties.length; i++) {
                    properties[i].setUnknownStatus();
                    properties[i].isReadyForVerification();
                }

                this.displayProperties();
                this.setPropertyModalOptions();
            }
        }

        public onHide() : void {
            this.stopVerify();
        }

        private icons = {
            "checkmark": "<i class=\"fa fa-check-circle fa-lg text-success\"></i>",
            "cross": "<i class=\"fa fa-times-circle fa-lg text-danger\"></i>",
            "triangle": "<i class=\"fa fa-exclamation-triangle fa-lg text-danger\"></i>",
            "questionmark" : "<i class=\"fa fa-question-circle fa-lg \"></i>"
        }

        private getStatusIcon(status) : string {
            switch (status) {
                case PropertyStatus.unknown:
                    return this.icons.questionmark;
                case PropertyStatus.satisfied:
                    return this.icons.checkmark;
                case PropertyStatus.unsatisfied:
                    return this.icons.cross;
                case PropertyStatus.invalid:
                    return this.icons.triangle;
            }
        }

        private displayProperty(property : Property.Property) : void {
            var $row = $("<tr>");
            //Hack - force evaluation of readyness
            property.isReadyForVerification();
            var statusIcon = $(this.getStatusIcon(property.getStatus()));

            if (property.getStatus() === PropertyStatus.invalid) {
                // Add some tooltip with the error to the status icon.
                statusIcon.prop('title', property.getError() || '');
                statusIcon.tooltip();
            }

            $row.append($("<td>").append(statusIcon));

            var $time = $("<td>").append(property.getElapsedTime());
            property.setTimeCell($time);
            $row.append($time);

            var $description = $("<td>").append(property.getDescription());
            $description.on("dblclick", {property: property}, (e) => this.showPropertyModal(e));
            $row.append($description);

            var $verify = $("<i>").addClass("fa fa-play-circle fa-lg verify-property");
            $verify.on("click", {property: property}, (e) => this.verify(e));
            $row.append($("<td>").append($verify));

            var $edit = $("<i>").addClass("fa fa-pencil fa-lg");
            $edit.on("click", {property: property}, (e) => this.showPropertyModal(e));
            $row.append($("<td>").append($edit));

            var $delete = $("<i>").addClass("fa fa-trash fa-lg");
            $delete.on("click", {property: property}, (e) => this.deleteProperty(e));
            $row.append($("<td>").append($delete));

            var $options = $("<i>").addClass("fa fa-bars fa-lg");
            $row.append($("<td>").append(this.generateContextMenu(property, $options)));

            if (property.getRow()) {
                property.getRow().replaceWith($row);
            } else {
                $("#property-table tbody").append($row);
            }

            property.setRow($row);
        }

        private displayProperties() : void {
            $("#property-table tbody").empty();
            var properties = this.project.getProperties();

            for (var i = 0; i < properties.length; i++) {
                properties[i].setRow(null);
                this.displayProperty(properties[i]);
            }
        }

        private generateContextMenu(property : Property.Property, $element : JQuery) : JQuery {
            var status = property.getStatus();
            var $ul = $("<ul>");

            if (status === PropertyStatus.unknown || status === PropertyStatus.invalid) {
            } else {
                let gameConfiguration = property.getGameConfiguration();
                // check if property is supported by equivalence/hml game
                if (!(property instanceof Property.StrongSpectroscopyEquivalence)){
                    if (gameConfiguration && !(property instanceof Property.TraceInclusion)) {
                        var startGame = () => {
                            if (property instanceof Property.HML) {
                                Main.activityHandler.selectActivity("hmlgame", gameConfiguration);
                            } else {
                                Main.activityHandler.selectActivity("game", gameConfiguration);
                            }
                        }

                        $ul.append($("<li>").append($("<a>").append("Play Game"))
                            .on("click", () => startGame()));
                    }
                }

                if (status === PropertyStatus.unsatisfied && property instanceof Property.DistinguishingFormula && property.getTime() !== "untimed") {
                    var generateFormula = (properties) => {
                        if (properties) {
                            this.project.addPropertyAfter(property.getId(), properties.secondProperty);
                            this.project.addPropertyAfter(property.getId(), properties.firstProperty);
                            this.displayProperties();
                        }
                    }

                    $ul.append($("<li>").append($("<a>").append("Generate Distinguishing Formula"))
                        .on("click", () => property.generateDistinguishingFormula(generateFormula)));
                }

                if(gameConfiguration){
                    // check if relation is supported by the Spectroscopy Energy Game
                    let matchflag = false;
                    $("#se-game-relation option").each((i, e) => {
                        let $element = $(e);
                        if($element.val() === gameConfiguration.relation){ matchflag = true; return false; }
                    })
                    if(matchflag){
                        gameConfiguration.playerType = "attacker";
                        $ul.append($("<li>").append($("<a>").append("Play Spectroscopy Energy Game"))
                            .on("click", () => Main.activityHandler.selectActivity("segame", gameConfiguration)));
                    }

                }
            }

            if ($ul.find("li").length > 0) {
                $ul.addClass("dropdown-menu pull-right");
                $element.attr("data-toggle", "dropdown");
                return $("<div>").addClass("relative").append($element).append($ul);
            } else {
                return $element.addClass("text-muted");
            }
        }

        private setPropertyModalOptions() : void {
            var processes = this.graph.getNamedProcesses().reverse();
            var $lists = $("#firstProcess").add($("#secondProcess")).add($("#hmlProcess")).empty();

            for (var i = 0; i < processes.length; i++) {
                var $option = $("<option></option>").append(processes[i]);
                $lists.append($option);
            }

            $("#secondProcess").find("option:nth-child(2)").prop("selected", true);

            $("#ccsTransition").toggle(this.project.getInputMode() === InputMode.CCS);
            $("#tccsTransition").toggle(this.project.getInputMode() === InputMode.TCCS);
        }

        private showPropertyModal(e? : any) : void {
            $("#save-property").off("click");

            $("#propertyComment").val("");
            this.formulaEditor.setValue("");
            this.definitionsEditor.setValue("");

            if (e) {
                var property = e.data.property;

                $("#propertyComment").val(property.getComment());

                if (property instanceof Property.HML) {
                    $("#hmlProcess").val(property.getProcess());
                    this.formulaEditor.setValue(property.getTopFormula(), 1);
                    this.definitionsEditor.setValue(property.getDefinitions(), 1);
                    this.setSelectedPropertyType("hml-formula");
                } else {
                    if (this.project.getInputMode() === InputMode.CCS) {
                        $("#ccsTransition [value=" + property.getType() + "]").prop("selected", true);
                    } else {
                        $("#tccsTransition [value=" + property.getType() + "][data-time=" + property.getTime() + "]").prop("selected", true);
                    }

                    $("#relationType").val(property.getClassName());
                    $("#firstProcess").val(property.getFirstProcess());
                    $("#secondProcess").val(property.getSecondProcess());
                    this.setSelectedPropertyType("relation");
                }

                $("#save-property").on("click", e.data, (e) => this.saveProperty(e));
            } else {
                $("#save-property").on("click", () => this.saveProperty());
            }

            this.formulaEditor.focus();
            $("#property-modal").modal("show");
        }

        private getSelectedPropertyType() : string {
            return $("input[name=property-type]:checked").val();
        }

        private setSelectedPropertyType(value : string) : void {
            $("input[name=property-type][value=" + value + "]").prop("checked", true).trigger("change");
        }

        private showSelectedPropertyType() : void {
            if (this.getSelectedPropertyType() === "relation") {
                $("#add-hml-formula").fadeOut(200, () => $("#add-relation").fadeIn(200));
            } else {
                $("#add-relation").fadeOut(200, () => $("#add-hml-formula").fadeIn(200, () => this.formulaEditor.focus()));
            }
        }

        private saveProperty(e? : any) : void {
            var propertyName, options;

            if (this.getSelectedPropertyType() === "relation") {
                propertyName = $("#relationType option:selected").val();
                options = {
                    firstProcess: $("#firstProcess option:selected").val(),
                    secondProcess: $("#secondProcess option:selected").val(),
                    type: null,
                    time: null
                };

                if (this.project.getInputMode() === InputMode.CCS) {
                    options["type"] = $("#ccsTransition option:selected").val();
                } else {
                    options["type"] = $("#tccsTransition option:selected").val();
                    options["time"] = $("#tccsTransition option:selected").data("time");
                }
            } else {
                propertyName = "HML";
                options = {
                    process: $("#hmlProcess option:selected").val(),
                    topFormula: this.formulaEditor.getValue(),
                    definitions: this.definitionsEditor.getValue()
                };
            }

            options["comment"] = $("#propertyComment").val();

            if (propertyName === "Spectroscopy"){
                // delete potential old strong props
                let properties = this.project.getProperties().filter((prop) => {
                    if ("forSpectroscopy" in prop){
                        return prop["forSpectroscopy"];
                    }
                    return false
                });
                properties.forEach((prop) => {
                    this.deleteProperty({data: {property: prop}});
                })
                let supportedEqs: string[];
                if (options["type"] === "strong"){
                    supportedEqs = [
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
                }else {
                    supportedEqs = [
                        "Srbbisim",
                        "Bbisim",
                        "Srdbisim",
                        "Dbisim",
                        "Etabisim",
                        "Sbisim",
                        "Bisim",
                        "Etasim",
                        "Sim",
                        "Twosim",
                        "Rsim",
                        "Csim",
                        "Pfutures",
                        "Weakreadiness",
                        "Ifutures",
                        "Weakfailures",
                        "Weaktraces",
                        "Srsim",
                        "Scsim",
                        "Sreadiness",
                        "Sifutures",
                        "Sfailures"
                    ];
                }
                options["forSpectroscopy"] = true;
                supportedEqs.forEach((eq) => {
                    var property = new window["Property"][eq](options);
                    this.project.addProperty(property);

                    if (e) {
                        this.project.deleteProperty(e.data.property);
                        property.setRow(e.data.property.getRow());
                    }
                    this.displayProperty(property);
                })
                $("#verify-spectroscopy").prop("disabled", false);
            } else{

                options["forSpectroscopy"] = false;
                var property = new window["Property"][propertyName](options);
                this.project.addProperty(property);

                if (e) {
                    this.project.deleteProperty(e.data.property);
                    property.setRow(e.data.property.getRow());
                }

                this.displayProperty(property);
            }
        }

        private deleteProperty(e) : void {
            this.project.deleteProperty(e.data.property);
            e.data.property.getRow().fadeOut(200, function() {$(this).remove()});
        }
        private deleteAllProperties() : void {
            let props = this.project.getProperties();
            while(props.length > 0){
                props.forEach((prop) => {
                    this.deleteProperty({data: {property: prop}});
                })
                props = this.project.getProperties();
            }
        }

        private verify(e) : void {
            if (this.verifyingProperty == null) {
                this.verifyingProperty = e.data.property;
                this.disableVerification();
                this.verifyingProperty.verify((property) => this.verificationEnded(property));
            }
        }

        private verifyNext() : void {
            if (this.queue.length > 0) {
                var property = this.queue.shift();
                this.verify({data: {property: property}});
            }
        }

        private verifyAll() : void {;
            this.queue = [];
            var properties = this.project.getProperties();
            properties.forEach((property) => this.queue.push(property));
            this.verifyNext();
        }

        private verifySpectroscopy() : void {
            if(this.verifyingProperty == null){
                let properties = this.project.getProperties().filter((prop) => {
                    if ("forSpectroscopy" in prop){
                        return prop["forSpectroscopy"];
                    }
                    return false
                });
                if(properties.length === 0){
                    this.verifyNext();
                    return;
                }
                this.disableVerification();
                // since all props have same config, checking for one of them is enough
                let someProp = properties[0];
                if (!someProp.isReadyForVerification()) {
                    console.log("something is wrong, please check the property");
                    this.verifyingProperty = null;
                    this.enableVerification();
                    properties.forEach((prop) => {
                        this.displayProperty(prop);
                    });
                    this.verifyNext();
                    return;
                }
                someProp.startTimer();
            
                var program = this.project.getCCS();
                var inputMode = InputMode[this.project.getInputMode()];
                let worker = new Worker("lib/workers/verifier.js");
                
                worker.postMessage({
                    type: "program",
                    program: program,
                    inputMode: inputMode
                });
                if(someProp instanceof Property.Relation) {
                    worker.postMessage({
                        type: someProp.getType() === "strong" ? "runStrongSpectroscopy" : "runWeakSpectroscopy",
                        time: someProp.getTime(),
                        leftProcess: someProp.getFirstProcess(),
                        rightProcess: someProp.getSecondProcess()
                    });
                } else { throw new Error("Property to be verified is not a relation.") }
                worker.addEventListener("error", (error) => {
                    worker.terminate();
                    someProp.setError(error.message);
                    someProp.setStatus(PropertyStatus.invalid);
                    someProp.stopTimer();
                    this.verifyingProperty = null;
                    this.enableVerification();
                    properties.forEach((prop) => {
                        prop.setError(error.message);
                        prop.setStatus(PropertyStatus.invalid);
                        prop.stopTimer();
                        this.displayProperty(prop);
                    });
                    this.verifyNext();
                    return;
                }, false);
                
                worker.addEventListener("message", (event) => {
                    worker.terminate();
                    let results = event.data.result;
                    properties.forEach((prop) => {
                        // first letter of class name needs to be lowercase
                        let result = results.equalities[prop.getClassName().charAt(0).toLowerCase() + prop.getClassName().slice(1)]
                        if (result === true){
                            prop.setStatus(PropertyStatus.satisfied);
                        }
                        else if (result === false){
                            prop.setStatus(PropertyStatus.unsatisfied);
                            if (prop instanceof Property.DistinguishingFormula){
                                prop.formula = results.formula + ";";
                            }
                        }
                        else {
                            prop.setStatus(result);
                        }
                    });
                    someProp.stopTimer();
                    let timeString = someProp.getElapsedTime();

                    this.verifyingProperty = null;
                    this.enableVerification();
                    properties.forEach((prop) => {
                        prop.setElapsedTime(timeString);
                        this.displayProperty(prop);
                    });
                    this.verifyNext();
                });
            }
        }

        private stopVerify() : void {
            if (this.verifyingProperty != null) {
                this.verifyingProperty.abortVerification();
                this.enableVerification();
                this.displayProperty(this.verifyingProperty);
                this.queue = [];
                this.verifyingProperty = null;
            }
        }

        private verificationEnded(property : Property.Property) {
            this.verifyingProperty = null;
            this.enableVerification();
            this.displayProperty(property);
            this.verifyNext();
        }

        private enableVerification() : void {
            $(".verify-property").removeClass("text-muted");
            $("#verify-all").prop("disabled", false);
            $("#verify-spectroscopy").prop("disabled", false);
            $("#verify-stop").prop("disabled", true);
        }

        private disableVerification() : void {
            $(".verify-property").addClass("text-muted");
            $("#verify-all").prop("disabled", true);
            $("#verify-spectroscopy").prop("disabled", true);
            $("#verify-stop").prop("disabled", false);
        }
    }
}
