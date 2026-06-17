import { App, Modal } from "obsidian";
import { TafsirBook } from "../../Domain/Entities/TafsirBook";
import { TAFSIR_BOOKS_LIST } from "../../Domain/Constants/TafsirBooksList";

export class TafsirFallbackModal extends Modal {
    private onSubmit: (result: TafsirBook[]) => void;
    private selectedBooks: Set<string> = new Set();
    private activeIndex: number = 0;
    private searchQuery: string = "";
    private filteredBooks: TafsirBook[] = [];
    
    private searchInputEl!: HTMLInputElement;
    private listContainerEl!: HTMLDivElement;

    constructor(app: App, onSubmit: (result: TafsirBook[]) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.filteredBooks = [...TAFSIR_BOOKS_LIST];
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // تطبيق التنسيق الجمالي عبر الخصائص الصافية المباشرة لمنع أخطاء النوع
        this.modalEl.style.cssText = "max-width: 600px; max-height: 80vh; display: flex; flex-direction: column; font-family: 'Amiri', serif; direction: rtl; text-align: right;";
        
        const titleEl = contentEl.createEl("h2", { text: "تخصيص كُتُب التفسير المطلوبة" });
        titleEl.style.cssText = "margin-bottom: 12px; font-size: 1.5em; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 8px;";

        // 1. بناء شريط البحث العلوي
        const searchWrapper = contentEl.createEl("div");
        searchWrapper.style.cssText = "margin-bottom: 15px;";

        this.searchInputEl = searchWrapper.createEl("input", {
            type: "text",
            placeholder: "ابحث في 42 كتاباً للتفسير (اكتب اسم المفسر أو جزءاً منه)..."
        }) as HTMLInputElement;
        this.searchInputEl.style.cssText = "width: 100%; padding: 10px; font-size: 1.1em; border-radius: 6px; border: 1px solid var(--border-color); background: var(--background-modifier-form-field); color: var(--text-normal);";
        
        this.searchInputEl.focus();

        // 2. بناء حاوية القائمة القابلة للتمرير الإنسيابي
        this.listContainerEl = contentEl.createEl("div");
        this.listContainerEl.style.cssText = "flex: 1; overflow-y: auto; max-height: 45vh; border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 5px; background: var(--background-primary);";

        this.renderList();

        // 3. مستمع البحث الفوري حياً
        this.searchInputEl.addEventListener("input", () => {
            this.searchQuery = this.searchInputEl.value.toLowerCase().trim();
            this.filteredBooks = TAFSIR_BOOKS_LIST.filter(book => 
                book.name.toLowerCase().includes(this.searchQuery) || 
                book.aliases.some(alias => alias.toLowerCase().includes(this.searchQuery))
            );
            this.activeIndex = 0;
            this.renderList();
        });

        // 4. قناص حركة الكيبورد للتنقل والـ Toggle
        this.modalEl.addEventListener("keydown", (evt: KeyboardEvent) => {
            if (evt.key === "ArrowDown") {
                evt.preventDefault();
                if (this.filteredBooks.length > 0) {
                    this.activeIndex = (this.activeIndex + 1) % this.filteredBooks.length;
                    this.renderList();
                    this.scrollToActive();
                }
            } else if (evt.key === "ArrowUp") {
                evt.preventDefault();
                if (this.filteredBooks.length > 0) {
                    this.activeIndex = (this.activeIndex - 1 + this.filteredBooks.length) % this.filteredBooks.length;
                    this.renderList();
                    this.scrollToActive();
                }
            } else if (evt.key === "Enter" && !evt.shiftKey) {
                evt.preventDefault();
                if (this.filteredBooks.length > 0 && this.filteredBooks[this.activeIndex]) {
                    this.toggleBook(this.filteredBooks[this.activeIndex].id);
                }
            } else if (evt.key === "Enter" && evt.shiftKey) {
                evt.preventDefault();
                this.submitAndClose();
            }
        }, true);
    }

    private renderList() {
        this.listContainerEl.empty();

        if (this.filteredBooks.length === 0) {
            const emptyEl = this.listContainerEl.createEl("div", { text: "لم يتم العثور على كتب تطابق بحثك الحالي." });
            emptyEl.style.cssText = "padding: 15px; color: var(--text-muted); text-align: center; font-size: 1.1em;";
            return;
        }

        this.filteredBooks.forEach((book, idx) => {
            const itemEl = this.listContainerEl.createEl("div");
            const isActive = idx === this.activeIndex;
            const isChecked = this.selectedBooks.has(book.id);

            itemEl.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--background-modifier-border); cursor: pointer; border-radius: 4px; transition: background 0.1s ease; ${isActive ? "background: var(--background-modifier-hover); box-shadow: inset 3px 0 0 var(--text-accent);" : ""}`;
            itemEl.setAttribute("data-book-id", book.id);

            const rightSide = itemEl.createEl("div");
            rightSide.style.cssText = "display: flex; align-items: center; gap: 10px;";
            
            const checkbox = rightSide.createEl("input", { type: "checkbox" }) as HTMLInputElement;
            checkbox.checked = isChecked;
            checkbox.style.cssText = "cursor: pointer; width: 16px; height: 16px; accent-color: var(--text-accent);";

            const nameSpan = rightSide.createEl("span", { text: book.name });
            nameSpan.style.cssText = `font-size: 1.2em; ${isChecked ? "color: var(--text-normal); font-weight: 500;" : "color: var(--text-muted);"}`;

            if (book.aliases.length > 0) {
                const aliasSpan = itemEl.createEl("span", { text: book.aliases.join("، ") });
                aliasSpan.style.cssText = "font-size: 0.85em; color: var(--text-muted); font-style: italic; opacity: 0.7;";
            }

            itemEl.addEventListener("click", (e) => {
                if (e.target !== checkbox) {
                    this.activeIndex = idx;
                }
                this.toggleBook(book.id);
            });
        });
    }

    private toggleBook(bookId: string) {
        if (this.selectedBooks.has(bookId)) {
            this.selectedBooks.delete(bookId);
        } else {
            this.selectedBooks.add(bookId);
        }
        this.renderList();
    }

    private scrollToActive() {
        const activeEl = this.listContainerEl.querySelector(`[data-book-id='${this.filteredBooks[this.activeIndex]?.id}']`);
        if (activeEl) {
            activeEl.scrollIntoView({ block: "nearest" });
        }
    }

    private submitAndClose() {
        const finalSelection = TAFSIR_BOOKS_LIST.filter(b => this.selectedBooks.has(b.id));
        this.close();
        this.onSubmit(finalSelection);
    }

    onClose() {
        this.contentEl.empty();
    }
}