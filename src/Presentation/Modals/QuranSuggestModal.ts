import { App, SuggestModal, Editor } from "obsidian";
import { Ayah } from "../../Domain/Entities/Ayah";
import { QuranRepository } from "../../Data/Repositories/QuranRepository";
import { QuranText } from "../../Domain/ValueObjects/QuranText";
import { ExecuteEditorTransaction, TransactionSettings } from "../../UseCases/ExecuteEditorTransaction";
import { AnalyticsDashboard } from "../Components/AnalyticsDashboard";
import { QuranRangeEndSuggestModal } from "./QuranRangeEndSuggestModal";
import { TafsirFallbackModal } from "./TafsirFallbackModal";

export class QuranSuggestModal extends SuggestModal<Ayah> {
    private repository: QuranRepository;
    private editor: Editor;
    private initialQuery: string;
    private preFilteredMatches: Ayah[] | null;
    private startPos: { line: number; ch: number } | null;
    private endPos: { line: number; ch: number } | null;
    private settings: any; 
    private dashboard!: AnalyticsDashboard;
    private currentQuery: string = "";
    private onVerseSelectOverride?: (ayahs: Ayah[]) => void;

    constructor(
        app: App, 
        repository: QuranRepository, 
        editor: Editor, 
        settings: TransactionSettings,
        initialQuery: string = "", 
        preFilteredMatches: Ayah[] | null = null, 
        startPos: { line: number; ch: number } | null = null, 
        endPos: { line: number; ch: number } | null = null,
        onVerseSelectOverride?: (ayahs: Ayah[]) => void
    ) {
        super(app);
        this.repository = repository;
        this.editor = editor;
        this.settings = settings;
        this.initialQuery = initialQuery;
        this.preFilteredMatches = preFilteredMatches;
        this.startPos = startPos;
        this.endPos = endPos;
        this.onVerseSelectOverride = onVerseSelectOverride;
        this.setPlaceholder("اكتب كلمات البحث بدقة لدراسة المواضع القرآنيّة...");
    }

    onOpen() {
        super.onOpen();
        
        if (this.settings.showAnalytics) {
            const inputContainer = this.inputEl.parentElement;
            if (inputContainer) {
                this.dashboard = new AnalyticsDashboard(inputContainer);
            }
        }

        // مستمع أحداث صارم محصن في مرحلة الـ Capture لحسم الاختصارات ومنع ابتلاع محرك أوبسيديان لها
        this.inputEl.addEventListener("keydown", (evt: KeyboardEvent) => {
            if (evt.key === "Enter") {
                const isCtrlOrMeta = evt.ctrlKey || evt.metaKey;
                const isShift = evt.shiftKey;

                if (isCtrlOrMeta || isShift) {
                    evt.preventDefault();
                    evt.stopPropagation();

                    const suggestions = this.getSuggestions(this.inputEl.value);
                    if (suggestions.length === 0) return;

                    const activeEl = this.modalEl.querySelector(".suggestion-item.is-selected");
                    let targetItem = suggestions[0];
                    if (activeEl) {
                        const allItems = Array.from(this.modalEl.querySelectorAll(".suggestion-item"));
                        const idx = allItems.indexOf(activeEl);
                        if (idx !== -1 && suggestions[idx]) {
                            targetItem = suggestions[idx];
                        }
                    }

                    const start = this.startPos || this.editor.getCursor("from");
                    const end = this.endPos || this.editor.getCursor("to");

                    this.close();

                    if (isCtrlOrMeta) {
                        // Ctrl + Enter -> فتح نافذة تحديد نهاية النطاق القرآني
                        new QuranRangeEndSuggestModal(this.app, this.repository, this.editor, this.settings, targetItem, start, end, this.onVerseSelectOverride).open();
                    } else if (isShift) {
                        // Shift + Enter -> الانتقال الفوري لمودال اختيار كتب التفسير المتعددة للآية المفردة
                        if (this.onVerseSelectOverride) {
                            this.onVerseSelectOverride([targetItem]);
                        } else {
                            new TafsirFallbackModal(this.app, async (chosenBooks) => {
                                if (chosenBooks.length === 0) return;
                                const mainPlugin = (this.app as any).plugins.plugins["quran-key"];
                                if (mainPlugin && mainPlugin.fetchAndInsertTafsirUseCase) {
                                    const getAyahTextLocal = (sId: number, aId: number): string => {
                                        const localAyah = this.repository.getAllAyahs().find(a => a.surah_id === sId && a.ayah_id === aId);
                                        return localAyah ? localAyah.text : "";
                                    };
                                    await mainPlugin.fetchAndInsertTafsirUseCase.execute(
                                        this.editor, "", start.line, targetItem.surah_id, targetItem.surah_name, targetItem.ayah_id, targetItem.ayah_id, getAyahTextLocal, this.settings, chosenBooks
                                    );
                                }
                            }).open();
                        }
                    }
                }
            }
        }, true);

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
        
        const cleanQuery = QuranText.normalizeForSearch(query);
        const cleanWords = cleanQuery.split(/\s+/).filter(w => w.length > 0);
        if (cleanWords.length === 0) return text;

        const fillers = '[\\u064B-\\u065F\\u0670\\u06E6\\u06E5\\u06D6-\\u06DC\\u06DF-\\u06E8\\u06EA-\\u06ED\\s]*';
        const patterns = cleanWords.map(w => {
            let p = '';
            for (let char of w) {
                if (char === 'ا') p += '[اأإآٱءى]';
                else if (char === 'ي') p += '[ييئ]';
                else if (char === 'و') p += '[ووؤ]';
                else if (char === 'ه') p += '[ههة]';
                else p += char;
                p += '[\\u064B-\\u065F\\u0670\\u06E6\\u06E5\\u06D6-\\u06DC\\u06DF-\\u06E8\\u06EA-\\u06ED]*';
            }
            return p;
        });

        try {
            const combinedPattern = patterns.join(fillers + '\\s+' + fillers);
            const rx = new RegExp(`(${combinedPattern})`, 'g');
            return text.replace(rx, '<span style="color: var(--text-accent); font-weight: bold;">$1</span>');
        } catch (e) {
            return text;
        }
    }

    getSuggestions(query: string): Ayah[] {
        this.currentQuery = query;
        
        const cleanQuery = QuranText.normalizeForSearch(query);
        const cleanInitial = this.initialQuery ? QuranText.normalizeForSearch(this.initialQuery) : "";
        
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
        const start = this.startPos || this.editor.getCursor("from");
        const end = this.endPos || this.editor.getCursor("to");

        if (this.onVerseSelectOverride) {
            this.onVerseSelectOverride([item]);
            return;
        }

        ExecuteEditorTransaction.execute(this.editor, start, end, [item], this.currentQuery, this.settings);
    }
}