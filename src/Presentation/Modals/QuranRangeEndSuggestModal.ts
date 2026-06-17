import { App, SuggestModal, Editor } from "obsidian";
import { Ayah } from "../../Domain/Entities/Ayah";
import { QuranRepository } from "../../Data/Repositories/QuranRepository";
import { QuranText } from "../../Domain/ValueObjects/QuranText";
import { ExecuteEditorTransaction, TransactionSettings } from "../../UseCases/ExecuteEditorTransaction";

export class QuranRangeEndSuggestModal extends SuggestModal<Ayah> {
    private repository: QuranRepository;
    private editor: Editor;
    private settings: TransactionSettings;
    private startAyah: Ayah;
    private startPos: { line: number; ch: number };
    private endPos: { line: number; ch: number };

    constructor(
        app: App,
        repository: QuranRepository,
        editor: Editor,
        settings: TransactionSettings,
        startAyah: Ayah,
        startPos: { line: number; ch: number },
        endPos: { line: number; ch: number }
    ) {
        super(app);
        this.repository = repository;
        this.editor = editor;
        this.settings = settings;
        this.startAyah = startAyah;
        this.startPos = startPos;
        this.endPos = endPos;
        this.setPlaceholder(`اختر آية نهاية النطاق لسورة ${startAyah.surah_name} (تبدأ من الآية ${startAyah.ayah_id})...`);
    }

    getSuggestions(query: string): Ayah[] {
        // تصفية الآيات لتعرض فقط آيات نفس السورة التي تقع بعد أو تطابق آية البداية
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
            text: `الآية ${item.ayah_id} (نهاية النطاق المحتملة)`
        });
        metaContainer.style.cssText = "color: var(--text-muted); display: block; margin-top: 4px; text-align: right; direction: rtl;";
    }

    onChooseSuggestion(endAyah: Ayah, evt: MouseEvent | KeyboardEvent) {
        // تجميع كافة الآيات الواقعة داخل النطاق المحدد من البداية للنهاية حركياً
        const rangeAyahs = this.repository.getAllAyahs().filter(a => 
            a.surah_id === this.startAyah.surah_id && 
            a.ayah_id >= this.startAyah.ayah_id && 
            a.ayah_id <= endAyah.ayah_id
        );

        const currentSettings = { ...this.settings };
        if (evt.shiftKey) {
            currentSettings.stripTashkeel = true;
        }

        // إدراج النطاق كاملاً ذرياً داخل المحرر وتحديث بيانات الـ Toggle المرجعي
        ExecuteEditorTransaction.execute(this.editor, this.startPos, this.endPos, rangeAyahs, "", currentSettings);
    }
}