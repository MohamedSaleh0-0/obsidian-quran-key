import { App, SuggestModal } from "obsidian";
import { TafsirBook } from "../../Domain/Entities/TafsirBook";

export class TafsirFallbackModal extends SuggestModal<TafsirBook> {
    private booksPool: TafsirBook[];
    private onSubmit: (result: TafsirBook[]) => void;
    private isResolved = false;

    constructor(app: App, booksPool: TafsirBook[], onSubmit: (result: TafsirBook[]) => void) {
        super(app);
        this.booksPool = booksPool;
        this.onSubmit = onSubmit;
        this.setPlaceholder("اختر كتاب التفسير المطلوب إدراجه...");
    }

    getSuggestions(query: string): TafsirBook[] {
        const cleanQuery = query.toLowerCase().trim();
        if (!cleanQuery) return this.booksPool;
        
        return this.booksPool.filter(book => 
            book.name.toLowerCase().includes(cleanQuery) || 
            book.aliases.some(alias => alias.toLowerCase().includes(cleanQuery))
        );
    }

    renderSuggestion(book: TafsirBook, el: HTMLElement) {
        el.createEl("div", { text: book.name });
        if (book.aliases.length > 0) {
            el.createEl("small", { 
                text: ` (الأسماء المستعارة: ${book.aliases.join("، ")})`,
                cls: "quran-key-modal-alias" 
            });
        }
    }

    onChooseSuggestion(book: TafsirBook, evt: MouseEvent | KeyboardEvent) {
        this.isResolved = true;
        this.onSubmit([book]);
    }

    onClose() {
        // إذا أغلقت النافذة دون اختيار، نرجع مصفوفة فارغة لضمان عدم مسح الـ Trigger
        if (!this.isResolved) {
            this.onSubmit([]);
        }
    }
}