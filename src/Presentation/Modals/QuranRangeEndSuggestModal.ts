import { App, SuggestModal, Editor } from "obsidian";
import { Ayah } from "../../Domain/Entities/Ayah";
import { QuranRepository } from "../../Data/Repositories/QuranRepository";
import { QuranText } from "../../Domain/ValueObjects/QuranText";
import { ExecuteEditorTransaction } from "../../UseCases/ExecuteEditorTransaction";
import { TafsirFallbackModal } from "./TafsirFallbackModal";
import { FetchAndInsertTafsir } from "../../UseCases/FetchAndInsertTafsir";

export class QuranRangeEndSuggestModal extends SuggestModal<Ayah> {
    private repository: QuranRepository;
    private editor: Editor;
    private settings: any; // تغيير النوع إلى any لفض اشتباك تداخل الواجهات بين المصحف والمفسر
    private startAyah: Ayah;
    private startPos: { line: number; ch: number };
    private endPos: { line: number; ch: number };
    private onVerseSelectOverride?: (ayahs: Ayah[]) => void;
    private fetchAndInsertTafsirUseCase?: FetchAndInsertTafsir;

    constructor(
        app: App,
        repository: QuranRepository,
        editor: Editor,
        settings: any, // تغيير النوع إلى any هنا أيضاً للتوافق الكامل
        startAyah: Ayah,
        startPos: { line: number; ch: number },
        endPos: { line: number; ch: number },
        onVerseSelectOverride?: (ayahs: Ayah[]) => void,
        fetchAndInsertTafsirUseCase?: FetchAndInsertTafsir
    ) {
        super(app);
        this.repository = repository;
        this.editor = editor;
        this.settings = settings;
        this.startAyah = startAyah;
        this.startPos = startPos;
        this.endPos = endPos;
        this.onVerseSelectOverride = onVerseSelectOverride;
        this.fetchAndInsertTafsirUseCase = fetchAndInsertTafsirUseCase;
        this.setPlaceholder(`اختر آية نهاية النطاق لسورة ${startAyah.surah_name} (تبدأ من الآية ${startAyah.ayah_id})...`);
    }

    onOpen() {
        super.onOpen();

        this.inputEl.addEventListener("keydown", (evt: KeyboardEvent) => {
            if (evt.key === "Enter" && evt.shiftKey) {
                evt.preventDefault();
                evt.stopPropagation();

                const suggestions = this.getSuggestions(this.inputEl.value);
                if (suggestions.length === 0) return;

                const activeEl = this.modalEl.querySelector(".suggestion-item.is-selected");
                let endAyah = suggestions[0];
                if (activeEl) {
                    const allItems = Array.from(this.modalEl.querySelectorAll(".suggestion-item"));
                    const idx = allItems.indexOf(activeEl);
                    if (idx !== -1 && suggestions[idx]) {
                        endAyah = suggestions[idx];
                    }
                }

                const rangeAyahs = this.repository.getAllAyahs().filter(a => 
                    a.surah_id === this.startAyah.surah_id && 
                    a.ayah_id >= this.startAyah.ayah_id && 
                    a.ayah_id <= endAyah.ayah_id
                );

                this.close();

                if (this.onVerseSelectOverride) {
                    this.onVerseSelectOverride(rangeAyahs);
                } else if (this.fetchAndInsertTafsirUseCase) {
                    new TafsirFallbackModal(this.app, async (chosenBooks) => {
                        if (chosenBooks.length === 0) return;
                        const getAyahTextLocal = (sId: number, aId: number): string => {
                            const localAyah = this.repository.getAllAyahs().find(a => a.surah_id === sId && a.ayah_id === aId);
                            return localAyah ? localAyah.text : "";
                        };
                        await this.fetchAndInsertTafsirUseCase!.execute(
                            this.editor, "", this.startPos.line, this.startAyah.surah_id, this.startAyah.surah_name, this.startAyah.ayah_id, endAyah.ayah_id, getAyahTextLocal, this.settings, chosenBooks
                        );
                    }).open();
                }
            }
        }, true);
    }

    getSuggestions(query: string): Ayah[] {
        const surahPool = this.repository.getAllAyahs().filter(a => 
            a.surah_id === this.startAyah.surah_id && a.ayah_id >= this.startAyah.ayah_id
        );

        if (!query || query.trim() === "") {
            return surahPool.slice(0, 30);
        }

        const cleanQuery = QuranText.normalizeForSearch(query);
        const numericQuery = QuranText.normalizeNumbers(query);

        return surahPool.filter(a => 
            a.ayah_id.toString().includes(numericQuery) || 
            QuranText.normalizeForSearch(a.text).includes(cleanQuery)
        ).slice(0, 30);
    }

    renderSuggestion(item: Ayah, el: HTMLElement) {
        const container = el.createEl("div");
        container.style.cssText = "font-size: 1.1em; font-family: 'Uthmani', serif; line-height: 1.5; text-align: right; direction: rtl;";
        container.innerText = item.text;
        
        const metaContainer = el.createEl("small", { 
            text: `الآية ${item.ayah_id}`
        });
        metaContainer.style.cssText = "color: var(--text-muted); display: block; margin-top: 4px; text-align: right; direction: rtl;";
    }

    onChooseSuggestion(endAyah: Ayah, evt: MouseEvent | KeyboardEvent) {
        const rangeAyahs = this.repository.getAllAyahs().filter(a => 
            a.surah_id === this.startAyah.surah_id && 
            a.ayah_id >= this.startAyah.ayah_id && 
            a.ayah_id <= endAyah.ayah_id
        );

        if (this.onVerseSelectOverride) {
            this.onVerseSelectOverride(rangeAyahs);
            return;
        }

        ExecuteEditorTransaction.execute(this.editor, this.startPos, this.endPos, rangeAyahs, "", this.settings);
    }
}