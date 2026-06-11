import { App, SuggestModal, Editor } from "obsidian";
import { Ayah } from "../../Domain/Entities/Ayah";
import { QuranRepository } from "../../Data/Repositories/QuranRepository";
import { QuranText } from "../../Domain/ValueObjects/QuranText";
import { ExecuteEditorTransaction, TransactionSettings } from "../../UseCases/ExecuteEditorTransaction";
import { AnalyticsDashboard } from "../Components/AnalyticsDashboard";

export class QuranSuggestModal extends SuggestModal<Ayah> {
    private repository: QuranRepository;
    private editor: Editor;
    private initialQuery: string;
    private preFilteredMatches: Ayah[] | null;
    private startPos: { line: number; ch: number } | null;
    private endPos: { line: number; ch: number } | null;
    private settings: TransactionSettings;
    private dashboard!: AnalyticsDashboard;
    private currentQuery: string = "";

    constructor(
        app: App, 
        repository: QuranRepository, 
        editor: Editor, 
        settings: TransactionSettings,
        initialQuery: string = "", 
        preFilteredMatches: Ayah[] | null = null, 
        startPos: { line: number; ch: number } | null = null, 
        endPos: { line: number; ch: number } | null = null
    ) {
        super(app);
        this.repository = repository;
        this.editor = editor;
        this.settings = settings;
        this.initialQuery = initialQuery;
        this.preFilteredMatches = preFilteredMatches;
        this.startPos = startPos;
        this.endPos = endPos;
        this.setPlaceholder("اكتب كلمات البحث بدقة لدراسة المواضع القرآنيّة...");
    }

    onOpen() {
        super.onOpen();
        
        if (this.inputEl.parentElement) {
            this.dashboard = new AnalyticsDashboard(this.inputEl);
        }

        if (this.initialQuery) {
            this.inputEl.value = this.initialQuery;
            this.currentQuery = this.initialQuery;
            setTimeout(() => {
                this.inputEl.dispatchEvent(new Event('input'));
            }, 50);
        }
    }

    private highlightText(text: string, query: string): string {
        if (!query || query.trim().length === 0) return text;
        const words = query.trim().split(/\s+/).map(w => QuranText.normalizeForSearch(w)).filter(w => w.length > 0);
        let highlighted = text;
        
        const lFillers = '[\\u064B-\\u065F\\u0670\\u06E6\\u06E5\\u06D6-\\u06DC\\u06DF-\\u06E8\\u06EA-\\u06ED]*';
        const alefClass = '[اأإآٱءىٰ\\u064B-\\u065F\\u0670\\u06E6\\u06E5\\u06D6-\\u06DC\\u06DF-\\u06E8\\u06EA-\\u06ED]';

        for (const word of words) {
            if (word.length < 2) continue;
            
            let pattern = '';
            for (let i = 0; i < word.length; i++) {
                const char = word[i];
                let charPattern = '';
                
                if (char === 'ا') {
                    charPattern = `(?:${alefClass}+)`;
                } else if (char === 'ي') {
                    charPattern = '[ييئ]';
                } else if (char === 'و') {
                    charPattern = '[ووؤ]';
                } else if (char === 'ه') {
                    charPattern = '[ههة]';
                } else {
                    charPattern = char;
                }
                
                if (i === 0) {
                    pattern += charPattern;
                } else {
                    pattern += lFillers + charPattern;
                }
            }
            pattern += lFillers;

            try {
                const rx = new RegExp(`(${pattern})`, 'g');
                highlighted = highlighted.replace(rx, '<b style="color: var(--text-accent); font-weight: bold;">$1</b>');
            } catch (e) {}
        }
        return highlighted;
    }

    getSuggestions(query: string): Ayah[] {
        this.currentQuery = query;
        const sourcePool = this.preFilteredMatches || this.repository.getAllAyahs();
        const cleanQueryWords = query.trim().split(/\s+/).map(w => QuranText.normalizeForSearch(w)).filter(w => w.length > 0);

        if (cleanQueryWords.length === 0) {
            if (this.dashboard) this.dashboard.update([], []);
            return [];
        }

        const fuzzyRegexes = cleanQueryWords.map(w => new RegExp(QuranText.makeMedialAlefsOptional(w)));
        const filtered = sourcePool.filter(a => fuzzyRegexes.every(regex => regex.test(QuranText.normalizeForSearch(a.text))));

        if (this.dashboard) {
            this.dashboard.update(filtered, this.repository.getAllAyahs());
        }

        return filtered.slice(0, 30);
    }

    renderSuggestion(item: Ayah, el: HTMLElement) {
        const container = el.createEl("div");
        container.style.cssText = "font-size: 1.1em; font-family: 'Uthmani', serif; line-height: 1.5; text-align: right; direction: rtl;";
        container.innerHTML = this.highlightText(item.text, this.currentQuery);
        
        const metaContainer = el.createEl("small", { 
            text: `${item.surah_name} - الآية ${item.ayah_id}`
        });
        metaContainer.style.cssText = "color: var(--text-muted); display: block; margin-top: 4px; text-align: right; direction: rtl;";
    }

    onChooseSuggestion(item: Ayah, evt: MouseEvent | KeyboardEvent) {
        const currentSettings = { ...this.settings };
        
        if (evt.shiftKey) {
            currentSettings.stripTashkeel = true;
        }

        const start = this.startPos || this.editor.getCursor("from");
        const end = this.endPos || this.editor.getCursor("to");

        ExecuteEditorTransaction.execute(this.editor, start, end, [item], this.currentQuery, currentSettings);
    }
}