import { Plugin, Notice } from "obsidian";
import { ObsidianVaultDataSource } from "./Data/DataSources/ObsidianVaultDataSource";
import { ParseContextAndExtract } from "./UseCases/ParseContextAndExtract";
import { TransactionSettings } from "./UseCases/ExecuteEditorTransaction";
import { QuranSuggestModal } from "./Presentation/Modals/QuranSuggestModal";

export default class QuranKeyPlugin extends Plugin {
    private repository!: ObsidianVaultDataSource;
    private contextParser!: ParseContextAndExtract;

    async onload() {
        console.log("Initializing Al-Furqan (Quran Key) Plugin...");

        this.repository = new ObsidianVaultDataSource(this.app.vault);
        this.contextParser = new ParseContextAndExtract(this.app, this.repository);

        this.app.workspace.onLayoutReady(async () => {
            const success = await this.repository.loadAll();
            if (success) {
                new Notice("تم تحميل المصحف الشريف في الذاكرة بنجاف (Quran Key).");
            } else {
                new Notice("تنبيه: لم يتم العثور على ملف ayahs.json في المستودع الحالي.");
            }
        });

        // الاختصار الأول: فتح نافذة البحث العامة مباشرة دون النظر لمحتوى السطر
        this.addCommand({
            id: "open-quran-global-search",
            name: "Open Global Quran Search Modal",
            editorCallback: (editor) => {
                const settings: TransactionSettings = {
                    useOrnateNumbers: true,
                    stripTashkeel: false,
                    referenceFormat: "[Surah:Verse]"
                };

                new QuranSuggestModal(this.app, this.repository, editor, settings).open();
            }
        });

        // الاختصار الثاني: التحليل والفحص السياقي للسطر الحالي ومعالجة المتشابهات
        this.addCommand({
            id: "extract-quran-context",
            name: "Extract Quran Verse from Context",
            editorCallback: (editor) => {
                const settings: TransactionSettings = {
                    useOrnateNumbers: true,
                    stripTashkeel: false,
                    referenceFormat: "[Surah:Verse]"
                };

                this.contextParser.execute(
                    editor, 
                    settings, 
                    (query, matches, start, end) => {
                        // عند رصد متشابهات لفظية: يتم فتح الـ Modal مفرزة ومجهزة بالخيارات لعمل الـ Override
                        new QuranSuggestModal(this.app, this.repository, editor, settings, query, matches, start, end).open();
                    }
                );
            }
        });
    }

    async onunload() {
        console.log("Unloading Al-Furqan (Quran Key) Plugin.");
    }
}