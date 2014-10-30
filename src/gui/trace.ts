/// <reference path="../../lib/raphael.d.ts" />
class Trace {
    private paper: RaphaelPaper;
    private currentX: number;
    private currentY: number;
    
    constructor(private htmlElement: string, private width: number, private height: number) {
        this.paper = Raphael(htmlElement, width, height);
        this.currentX = 0;
        this.currentY = 0;
    }

    public drawTrace() {
        var list:Drawable[] = [new Circle(this.paper, 10, "Yo"), new Square(this.paper, 50, "Yoslkdsalkdj1")];

        list.forEach( (item) => {
            item.draw(this.currentX, this.currentY);
            this.currentX += item.width;
        });
    }

}

interface Drawable {
    width: number;
    paper: RaphaelPaper;

    draw(x: number, y: number);
}



class Circle implements Drawable {
    public width: number;
    
    constructor(public paper: RaphaelPaper, private radius: number, private text: string) {
        this.width = radius*2;
    }

    public draw(x: number, y: number) {
        var circle = this.paper.circle(x + this.radius, y + this.radius, this.radius);
        circle.attr({"fill": "#f00", "stroke": "#000"});
    }
}

class Square implements Drawable {

    constructor(public paper: RaphaelPaper, public width: number, private text: string) {
        
    }

    public draw(x: number, y: number) {
        var margin = (this.width - (this.width / 2.5)) / 2;

        var text = this.paper.text(x + (this.width / 2), y + (this.width / 2), this.text);
        text.attr({"font-size": this.width / 2.5});

        var textWidth = text.getBBox().width;
        
        // Parameters: x, y, width, height
        var rect = this.paper.rect(x, y,
                                   ((this.width - margin * 2) < textWidth) ? textWidth + margin*2 : this.width,
                                   this.width);
        rect.attr({"fill": "#f00", "stroke": "#000"});

        text.toFront();
        

    }

}

class Arrow implements Drawable {
    public width: number;
}