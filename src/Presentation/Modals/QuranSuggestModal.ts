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
        
        // حقن لوحة الإحصائيات داخل حاوية الـ Prompt لتستقر حتماً تحت الـ Search Bar مباشرة وبشكل متكيف
        const promptEl = this.modalEl.querySelector(".prompt");
        if (promptEl) {
            this.dashboard = new AnalyticsDashboard(promptEl as HTMLElement);
        }

        if (this.initialQuery) {
            this.inputEl.value = this.initialQuery;
            this.currentQuery = this.initialQuery;
            setTimeout(() => {
                this.inputEl.dispatchEvent(new Event('input'));
            }, 50);
        }
    }

    /**
     * مفسر تطابق فهرسي صارم مقتبس من quranUtils.js لتقييد صبغ الألوان في النطاق المكتوب بالسيرش فقط
     */
    private highlightText(text: string, query: string): string {
        if (!query || query.trim().length === 0) return text;

        const verseWords = text.trim().split(/\s+/);
        const normVerseWords = verseWords.map(w => QuranText.normalizeForSearch(w));
        
        const cleanQuery = QuranText.normalizeForSearch(query);
        const searchWords = cleanQuery.split(/\s+/).filter(w => w.length > 0);
        
        if (searchWords.length === 0) return text;

        const patternArr = searchWords.map(w => QuranText.makeMedialAlefsOptional(w));
        let matchStartIndex = -1;
        const matchLength = searchWords.length;

        for (let i = 0; i <= normVerseWords.length - searchWords.length; i++) {
            let match = true;
            for (let j = 0; j < searchWords.length; j++) {
                const isLastWord = (j === searchWords.length - 1);
                const regexStr = '^' + patternArr[j] + (isLastWord ? '' : '$');
                const r = new RegExp(regexStr);
                
                if (!r.test(normVerseWords[i + j])) {
                    match = false;
                    break;
                }
            }
            if (match) {
                matchStartIndex = i;
                break;
            }
        }

        if (matchStartIndex !== -1) {
            const before = verseWords.slice(0, matchStartIndex).join(' ');
            const matchedPhrase = verseWords.slice(matchStartIndex, matchStartIndex + matchLength).join(' ');
            const after = verseWords.slice(matchStartIndex + matchLength).join(' ');

            const colorStyle = `color: ${this.settings.quranColor || '#dfc56b'}; font-weight: bold;`;
            return `${before ? before + ' ' : ''}<span style="${colorStyle}">${matchedPhrase}</span>${after ? ' ' + after : ''}`;
        }

        return text;
    }

    /**
     * الفرز الحركي المرن: فك القفل التلقائي لتوسيع نطاق السيرش لو قام المستخدم بالتعديل أو مسح النص الحالي
     */
    getSuggestions(query: string): Ayah[] {
        this.currentQuery = query;
        
        const cleanQuery = QuranText.normalizeForSearch(query);
        const cleanInitial = this.initialQuery ? QuranText.normalizeForSearch(this.initialQuery) : "";
        
        // كسر الحظر حركياً: إذا كان السيرش يتفرع من النص الأصلي نلتزم بالـ PreFiltered، وإلا نفتح البحث لكامل المصحف فوراً
        const usePreFiltered = this.preFilteredMatches && cleanQuery.length > 0 && 
            (cleanQuery.includes(cleanInitial) || cleanInitial.includes(cleanQuery));
            
        const sourcePool = usePreFiltered ? this.preFilteredMatches! : this.repository.getAllAyahs();
        const cleanQueryWords = cleanQuery.split(/\s+/).filter(w => w.length > 0);

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