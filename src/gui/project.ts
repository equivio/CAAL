class Project {
    private defaultTitle: string;
    private defaultDescription: string;
    private defaultCCS: string;
    private titleId: string;
    private descriptionId: string;
    private editor: any;
    private title: string;
    private description: string;

    public constructor(defaultTitle: string,
                defaultDescription: string,
                defaultCCS: string,
                titleId: string,
                descriptionId: string,
                editorId: string)
    {
        this.defaultTitle = defaultTitle;
        this.defaultDescription = defaultDescription;
        this.defaultCCS = defaultCCS;
        this.titleId = titleId;
        this.descriptionId = descriptionId;
        this.editor = ace.edit(editorId);

        /* Set default values */
        this.update(this.defaultTitle, this.defaultDescription, this.defaultCCS);

        /* Register event handlers */
        $(this.titleId).focusout(() => this.onTitleChanged());
        $(this.descriptionId).focusout(() => this.onDescriptionChanged());
    }

    public getTitle(): string {
        return this.title;
    }

    public setTitle(title: string): void {
        this.title = title;
        $(this.titleId).text(this.title);
    }

    public getDescription(): string {
        return this.description;
    }

    public setDescription(description: string): void {
        this.description = description;
        $(this.descriptionId).text(this.description);
    }

    public getCCS(): string {
        return this.editor.getSession().getValue();
    }

    public setCCS(ccs: string): void {
        this.editor.setValue(ccs);
        this.editor.clearSelection();
    }

    public update(title: string, description: string, ccs: string): void {
        this.setTitle(title);
        this.setDescription(description);
        this.setCCS(ccs);
    }

    public reset(): void {
        this.update(this.defaultTitle, this.defaultDescription, this.defaultCCS);
    }

    public toJSON(): Object {
        return {
            title: this.getTitle(),
            description: this.getDescription(),
            ccs: this.getCCS()
        };
    }

    private onTitleChanged(): void {
        this.title = $(this.titleId).text();
    }

    private onDescriptionChanged(): void {
        this.description = $(this.descriptionId).text();
    }
}
