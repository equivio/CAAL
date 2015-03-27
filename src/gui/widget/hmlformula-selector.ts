/// <reference path="../../../lib/jquery.d.ts" />
/// <reference path="../../../lib/ccs.d.ts" />

module GUI.Widget {
    export type HMLSelectListener = (formula : HML.Formula) => void;

    export class FormulaSelector {
        private root = document.createElement("div");
        private paragraph = document.createElement("p");
        private currentHml : HML.Formula;
        private currentHmlSet : HML.FormulaSet;
        //private HMLSubFormulaVisitor = new HMLSubFormulaVisitor();

        public onSelectListener : HMLSelectListener = null;

        constructor() {        
            var $root = $(this.root);
            var $paragraph = $(this.paragraph);
            
            $paragraph.attr("id", "hml-selector-paragraph");

            $root.attr("id", "hml-selector-body");
            $root.addClass("no-highlight");

            $root.append(this.paragraph);

            /*Click listeners on each subformula*/
            $root.on("click", "span.hml-subformula", this.onSubformulaClick.bind(this));
        }

        setFormulaSet(hmlFormulaSet : HML.FormulaSet) {
            this.currentHmlSet = hmlFormulaSet;
        }

        setFormula(hmlFormula : HML.Formula){
            this.currentHml = hmlFormula
            var $paragraph = $(this.paragraph);
            $paragraph.empty(); // clear the previous HML formula

            var HMLVisitor = new HMLSubFormulaVisitor();
            var hmlFormulaStr = HMLVisitor.visit(hmlFormula); // convert the formula to a string
            $paragraph.append(hmlFormulaStr);
        }

        public getRootElement() : HTMLElement {
            return this.root;
        }

        private subformulaFromDelegateEvent(event) : HML.Formula {
            var id = parseInt($(event.currentTarget).attr("data-subformula-id"));
            var hmlExtractor = new HMLSubFormulaExtractor(this.currentHmlSet);
            var subFormula : HML.Formula = hmlExtractor.getSubFormulaWithId(this.currentHml, id);
            return subFormula;
        }

        private onSubformulaClick(event) {
            console.log("you clicked on subFormula : ", this.subformulaFromDelegateEvent(event));
            if(this.onSelectListener) {
                this.onSelectListener(this.subformulaFromDelegateEvent(event));
            }
        }
    }

    class HMLSubFormulaVisitor implements HML.FormulaVisitor<string>, HML.FormulaDispatchHandler<string> { 
        private isFirst = true;
        private cache;

        constructor() {
            this.clearCache();        
        }

        clearCache(){
            this.cache = {};
        }

        visit(formula : HML.Formula) {
            return formula.dispatchOn(this);
        }

        dispatchDisjFormula(formula : HML.DisjFormula) {
            var result = this.cache[formula.id];
            if (!result) {
                if(this.isFirst) {
                    var firstDis = this.isFirst;
                    this.isFirst = false;
                }
                var subStrs = formula.subFormulas.map((subF) => {
                    if(firstDis) {
                        var $span = $('<span></span>').addClass('hml-subformula').attr('data-subformula-id', subF.id);
                        $span.append(subF.dispatchOn(this));
                        return $span[0].outerHTML;                    
                    } else {
                        return subF.dispatchOn(this);
                    }
                });
                
                result = this.cache[formula.id] = subStrs.join(" or ");
            }
            return result;
        }

        dispatchConjFormula(formula : HML.ConjFormula) {
            var result = this.cache[formula.id];
            if (!result) {
                if(this.isFirst) {
                    var firstCon = this.isFirst;
                    this.isFirst = false;
                }

                var subStrs = formula.subFormulas.map(subF => {
                    var unwrapped = subF.dispatchOn(this);
                    var wrapped = Traverse.wrapIfInstanceOf(unwrapped, subF, [HML.DisjFormula]);

                    if(firstCon) {
                        var $span = $('<span></span>').addClass('hml-subformula').attr('data-subformula-idx', subF.id);
                        $span.append(wrapped);     
                        return $span[0].outerHTML;
                    } else {
                        return wrapped;
                    }
                });

                result = this.cache[formula.id] = subStrs.join(" and ");
            }
            return result;
        }

        dispatchTrueFormula(formula : HML.TrueFormula) {
            var result = this.cache[formula.id];
            if (!result) {
                result = this.cache[formula.id] = "T";
            }
            return result;
        }

        dispatchFalseFormula(formula : HML.FalseFormula) {
            var result = this.cache[formula.id];
            if (!result) {
                result = this.cache[formula.id] = "F";
            }
            return result;
        }

        dispatchStrongExistsFormula(formula : HML.StrongExistsFormula) {
            var result = this.cache[formula.id];
            if (!result) {
                var subStr = formula.subFormula.dispatchOn(this);
                var formulaAction = "<" + formula.actionMatcher.actionMatchingString() + ">";
                var formulaStr = Traverse.safeHtml(formulaAction) +
                    Traverse.wrapIfInstanceOf(subStr, formula.subFormula, [HML.DisjFormula, HML.ConjFormula]);
                result = this.cache[formula.id] = formulaStr;

            }
            return result;
        }

        dispatchStrongForAllFormula(formula : HML.StrongForAllFormula) {
            var result = this.cache[formula.id];
            if (!result) {
                var subStr = formula.subFormula.dispatchOn(this);
                var formulaAction = "[" + formula.actionMatcher.actionMatchingString() + "]";
                var formulaStr = Traverse.safeHtml(formulaAction) +
                    Traverse.wrapIfInstanceOf(subStr, formula.subFormula, [HML.DisjFormula, HML.ConjFormula]);
                result = this.cache[formula.id] = formulaStr;
            }
            return result;
        }

        dispatchWeakExistsFormula(formula : HML.WeakExistsFormula) {
            var result = this.cache[formula.id];
            if (!result) {
                var subStr = formula.subFormula.dispatchOn(this);
                var formulaAction = "<<" + formula.actionMatcher.actionMatchingString() + ">>";
                var formulaStr = Traverse.safeHtml(formulaAction) +
                    Traverse.wrapIfInstanceOf(subStr, formula.subFormula, [HML.DisjFormula, HML.ConjFormula]);
                result = this.cache[formula.id] = formulaStr;
            }
            return result;
        }

        dispatchWeakForAllFormula(formula : HML.WeakForAllFormula) {
            var result = this.cache[formula.id];
            if (!result) {
                var subStr = formula.subFormula.dispatchOn(this);
                var formulaAction = "[[" + formula.actionMatcher.actionMatchingString() + "]]"
                var formulaStr = Traverse.safeHtml(formulaAction) +
                    Traverse.wrapIfInstanceOf(subStr, formula.subFormula, [HML.DisjFormula, HML.ConjFormula]);
                result = this.cache[formula.id] = formulaStr;
            }
            return result;
        }

        dispatchMinFixedPointFormula(formula : HML.MinFixedPointFormula) {
            var result = this.cache[formula.id];
            if (!result) {
                var subStr = formula.subFormula.dispatchOn(this);
                result = this.cache[formula.id] = formula.variable + " min= " + subStr;
            }
            return result;
        }

        dispatchMaxFixedPointFormula(formula : HML.MaxFixedPointFormula) {
            var result = this.cache[formula.id];
            if (!result) {
                var subStr = formula.subFormula.dispatchOn(this);
                result = this.cache[formula.id] = formula.variable + " max= " + subStr;
            }
            return result;
        }

        dispatchVariableFormula(formula : HML.VariableFormula) {
            var result = this.cache[formula.id];
            if (!result) {
                result = this.cache[formula.id] = Traverse.safeHtml(formula.variable);
            }
            return result;
        }
    }

    class HMLSubFormulaExtractor implements HML.FormulaDispatchHandler<HML.Formula> { 
        private getForId : number;

        constructor(private hmlFormulaSet : HML.FormulaSet) {
        }

        getSubFormulaWithId(parentFormula : HML.Formula, id : number) : HML.Formula {
            this.getForId = id;
            return parentFormula.dispatchOn(this);
        }

        dispatchDisjFormula(formula : HML.DisjFormula) {
            return ArrayUtil.first(formula.subFormulas, f => f.id === this.getForId);
        }

        dispatchConjFormula(formula : HML.ConjFormula) {
            return ArrayUtil.first(formula.subFormulas, f => f.id === this.getForId);
        }

        dispatchTrueFormula(formula : HML.TrueFormula) {
            return null;
        }

        dispatchFalseFormula(formula : HML.FalseFormula) {
            return null;
        }

        dispatchStrongExistsFormula(formula : HML.StrongExistsFormula) {
            return (formula.subFormula.id === this.getForId) ? formula.subFormula : null;
        }

        dispatchStrongForAllFormula(formula : HML.StrongForAllFormula) {
            return (formula.subFormula.id === this.getForId) ? formula.subFormula : null;
        }

        dispatchWeakExistsFormula(formula : HML.WeakExistsFormula) {
            return (formula.subFormula.id === this.getForId) ? formula.subFormula : null;
        }

        dispatchWeakForAllFormula(formula : HML.WeakForAllFormula) {
            return (formula.subFormula.id === this.getForId) ? formula.subFormula : null;
        }

        dispatchMinFixedPointFormula(formula : HML.MinFixedPointFormula) {
            return (formula.subFormula.id === this.getForId) ? formula.subFormula : null;
        }

        dispatchMaxFixedPointFormula(formula : HML.MaxFixedPointFormula) {
            return (formula.subFormula.id === this.getForId) ? formula.subFormula : null;
        }

        dispatchVariableFormula(formula : HML.VariableFormula) {
            var namedFormula = this.hmlFormulaSet.formulaByName(formula.variable);
            if (namedFormula && namedFormula.id === this.getForId) {
                return namedFormula;
            }

            return null; 
        }

    }
}