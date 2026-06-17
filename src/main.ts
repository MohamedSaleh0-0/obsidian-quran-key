import { Plugin, Notice, Editor } from "obsidian";
import { MatchDecorator, ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
import { ObsidianVaultDataSource } from "./Data/DataSources/ObsidianVaultDataSource";
import { ParseContextAndExtract } from "./UseCases/ParseContextAndExtract";
import { TransactionSettings } from "./UseCases/ExecuteEditorTransaction";
import { QuranSuggestModal } from "./Presentation/Modals/QuranSuggestModal";
import { QuranKeySettingTab } from "./Presentation/Settings/QuranKeySettingsTab";

import { TafsirApiDataSource } from "./Data/DataSources/TafsirApiDataSource";
import { FetchAndInsertTafsir, TafsirSettings } from "./UseCases/FetchAndInsertTafsir";
import { TafsirFallbackModal } from "./Presentation/Modals/TafsirFallbackModal";
import { TAFSIR_BOOKS_LIST } from "./Domain/Constants/TafsirBooksList";
import { TafsirBook } from "./Domain/Entities/TafsirBook";

export interface QuranKeySettings extends TransactionSettings, TafsirSettings {
    showAnalytics: boolean;
}

const DEFAULT_SETTINGS: QuranKeySettings = {
    useOrnateNumbers: true,
    stripTashkeel: false,
    referenceFormat: "[Surah:Verse]",
    quranFontFamily: "'Amiri', 'KFGQPC Uthman Taha Naskh', serif",
    quranFontSize: 1.1,
    quranLineHeight: 2.1,
    quranColor: "#dfc56b",
    showAnalytics: true,
    defaultTafsirBookId: "saadi",
    favoriteBooksIds: ["saadi", "ibn-katheer", "muyassar"],
    rangeHeadingLevel: "###",
    bookHeadingLevel: "####",
    useHorizontalDivider: true,
    includeAyahTextInTafsir: true
};

const quranDecorator = new MatchDecorator({
    regexp: /﴿[^﴾]*﴾/g,
    decoration: Decoration.mark({ class: "cm-quran-key-text" })
});

const quranHighlightExtension = ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
        this.decorations = quranDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
        this.decorations = quranDecorator.updateDeco(update, this.decorations);
    }
}, {
    decorations: v => v.decorations
});

export default class QuranKeyPlugin extends Plugin {
    public repository!: ObsidianVaultDataSource;
    public contextParser!: ParseContextAndExtract;
    declare public settings: QuranKeySettings;
    private styleEl!: HTMLStyleElement;
    private fetchAndInsertTafsirUseCase!: FetchAndInsertTafsir;

    async onload() {
        console.log("Initializing Al-Furqan (Quran Key) Plugin...");

        await this.loadSettings();
        this.initDynamicStyleSheet();

        this.repository = new ObsidianVaultDataSource(this.app.vault);
        this.contextParser = new ParseContextAndExtract(this.app, this.repository);
        
        const tafsirDataSource = new TafsirApiDataSource();
        this.fetchAndInsertTafsirUseCase = new FetchAndInsertTafsir(tafsirDataSource);

        this.app.workspace.onLayoutReady(async () => {
            const success = await this.repository.loadAll();
            if (success) {
                new Notice("تم تحميل المصحف الشريف في الذاكرة بنجاح (Quran Key).");
            } else {
                new Notice("تنبيه: لم يتم العثور على ملف ayahs.json في مسار الإضافة الحالي.");
            }
        });

        this.addSettingTab(new QuranKeySettingTab(this.app, this));
        this.registerEditorExtension(quranHighlightExtension);

        this.registerMarkdownPostProcessor((el) => {
            const walk = (node: Node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.nodeValue || "";
                    if (text.includes("﴿") && text.includes("﴾")) {
                        const span = document.createElement("span");
                        span.innerHTML = text.replace(/﴿([^﴾]*)﴾/g, '<span class="cm-quran-key-text">﴿$1﴾</span>');
                        node.parentNode?.replaceChild(span, node);
                    }
                } else {
                    for (let i = 0; i < node.childNodes.length; i++) {
                        walk(node.childNodes[i]);
                    }
                }
            };
            walk(el);
        });

        this.addCommand({
            id: "open-quran-global-search",
            name: "Open Global Quran Search Modal",
            editorCallback: (editor) => {
                new QuranSuggestModal(this.app, this.repository, editor, this.settings).open();
            }
        });

        this.addCommand({
            id: "extract-quran-context",
            name: "Extract Quran Verse from Context",
            editorCallback: (editor) => {
                this.contextParser.execute(
                    editor, 
                    this.settings, 
                    (query, matches, start, end) => {
                        new QuranSuggestModal(this.app, this.repository, editor, this.settings, query, matches, start, end).open();
                    }
                );
            }
        });

        this.addCommand({
            id: "fetch-contextual-tafsir",
            name: "Fetch Contextual Tafsir for Current Line",
            editorCallback: async (editor: Editor) => {
                const cursor = editor.getCursor();
                const lineText = editor.getLine(cursor.line);

                if (!lineText || lineText.trim() === "") return;

                const context = this.contextParser.analyzeLineContext(editor);

                if (!context) {
                    new Notice("لم يتم التعرف على آيات قرآنية في هذا السطر لجلب تفسيرها.");
                    return;
                }

                const getAyahTextLocal = (sId: number, aId: number): string => {
                    const localAyah = this.repository.getAllAyahs().find(a => a.surah_id === sId && a.ayah_id === aId);
                    return localAyah ? localAyah.text : "";
                };

                await this.fetchAndInsertTafsirUseCase.execute(
                    editor,
                    lineText,
                    cursor.line,
                    context.surahId,
                    context.surahName,
                    context.startAyah,
                    context.endAyah,
                    getAyahTextLocal,
                    this.settings,
                    (booksPool: TafsirBook[]) => {
                        return new Promise((resolve) => {
                            new TafsirFallbackModal(this.app, booksPool, (selected) => {
                                resolve(selected);
                            }).open();
                        });
                    }
                );
            }
        });

        this.addCommand({
            id: "remove-quran-reference",
            name: "Remove Quran Reference From Line",
            editorCallback: (editor) => {
                const lineNum = editor.getCursor().line;
                const lineText = editor.getLine(lineNum);
                const cleanLine = lineText.replace(/\s*\[[\u0600-\u06FF\s]+:\d+(?:-\d+)?\]/g, "");
                editor.setLine(lineNum, cleanLine);
                new Notice("تمت إزالة المصدر المرجعي من السطر.");
            }
        });

        this.addCommand({
            id: "convert-reference-to-footnote",
            name: "Convert Quran Reference To Footnote",
            editorCallback: (editor) => {
                const lineNum = editor.getCursor().line;
                const lineText = editor.getLine(lineNum);
                const refRegex = /\[([\u0600-\u06FF\s]+):(\d+)(?:-(\d+))?\]/;
                const match = lineText.match(refRegex);

                if (match) {
                    const fullContent = editor.getValue();
                    const existingFootnotes = fullContent.match(/\[\^quran\d+\]/g);
                    const nextIndex = existingFootnotes ? existingFootnotes.length + 1 : 1;
                    
                    const footnoteTag = `[^quran${nextIndex}]`;
                    const updatedLine = lineText.replace(refRegex, footnoteTag);
                    editor.setLine(lineNum, updatedLine);

                    const lastLineNum = editor.lineCount() - 1;
                    const lastLineText = editor.getLine(lastLineNum);
                    const footerString = `\n\n${footnoteTag}: ${match[1]}`;
                    
                    editor.replaceRange(footerString, { line: lastLineNum, ch: lastLineText.length });
                    new Notice(`تم تحويل المرجع إلى حاشية سفلية ${footnoteTag}`);
                } else {
                    new Notice("لم يتم العثور على مرجع تخريج صالح في هذا السطر.");
                }
            }
        });

        this.addCommand({
            id: "strip-tashkeel-globally",
            name: "Strip Tashkeel From Selection Or Line",
            editorCallback: (editor) => {
                const selectedText = editor.getSelection();
                const tashkeelRegex = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0670]/g;

                if (selectedText.length > 0) {
                    const cleanText = selectedText.replace(tashkeelRegex, "");
                    editor.replaceSelection(cleanText);
                } else {
                    const lineNum = editor.getCursor().line;
                    const lineText = editor.getLine(lineNum);
                    const cleanLine = lineText.replace(tashkeelRegex, "");
                    editor.setLine(lineNum, cleanLine);
                }
                new Notice("تم تجريد النص من التشكيل وعلامات الضبط.");
            }
        });
    }

    async onunload() {
        if (this.styleEl) this.styleEl.remove();
        console.log("Unloading Al-Furqan (Quran Key) Plugin.");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.updateDynamicStyles();
    }

    private initDynamicStyleSheet() {
        this.styleEl = document.createElement("style");
        this.styleEl.id = "quran-key-dynamic-styles";
        document.head.appendChild(this.styleEl);
        this.updateDynamicStyles();
    }

    public updateDynamicStyles() {
        this.styleEl.textContent = `
            .cm-quran-key-text {
                font-family: ${this.settings.quranFontFamily} !important;
                font-size: ${this.settings.quranFontSize}em !important;
                line-height: ${this.settings.quranLineHeight} !important;
                color: ${this.settings.quranColor} !important;
                text-rendering: optimizeLegibility;
                -webkit-font-smoothing: antialiased;
                background-color: transparent !important;
            }
            .markdown-source-view.mod-cm6 .cm-line:has(.cm-quran-key-text) {
                line-height: ${this.settings.quranLineHeight + 0.4} !important;
            }
            .quran-key-modal-alias {
                color: var(--text-muted) !important;
                font-size: 0.82em !important;
                font-style: italic !important;
                margin-right: 8px !important;
                opacity: 0.75;
            }
        `;
    }
}