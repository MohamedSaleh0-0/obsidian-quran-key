import { Editor } from "obsidian";
import { Ayah } from "../Domain/Entities/Ayah";
import { SnippetExtractor } from "../Domain/Services/SnippetExtractor";

export interface TransactionSettings {
    useOrnateNumbers: boolean;
    stripTashkeel: boolean;
    referenceFormat: string;
}

export class ExecuteEditorTransaction {
    /**
     * تحويل الأرقام العادية إلى أرقام مزخرفة مصحفية بنظام الـ Unicode
     */
    private static applyOrnateNumbers(text: string): string {
        return text.replace(/\((\d+)\)/g, (_, p1) => {
            const arabicDigits = p1.split('').map((d: string) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]).join('');
            return ` \u06DD${arabicDigits} `;
        });
    }

    /**
     * صياغة النص النهائي والإحالة المرجعية لآية واحدة أو مجموعة آيات متتالية
     */
    public static formatOutput(ayahs: Ayah[], settings: TransactionSettings, forceStrip: boolean = false): string {
        if (ayahs.length === 0) return "";

        const formattedAyahs = ayahs.map(a => {
            let txt = a.text;
            if (settings.stripTashkeel || forceStrip) {
                txt = txt.replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0670]/g, "");
            }
            return `${txt} (${a.ayah_id})`;
        });

        const coreText = `﴿ ${formattedAyahs.join(" ")} ﴾`;
        const finalCore = settings.useOrnateNumbers ? this.applyOrnateNumbers(coreText) : coreText;

        const first = ayahs[0];
        const last = ayahs[ayahs.length - 1];
        const refRange = first.ayah_id === last.ayah_id ? `${first.ayah_id}` : `${first.ayah_id}-${last.ayah_id}`;
        const reference = ` [${first.surah_name}:${refRange}]`;

        return finalCore + reference;
    }

    /**
     * تنفيذ خدعة التراجع الثنائية المعكوسة (Two-Step Undo) داخل محرر أوبسيديان لخدمة الـ Ctrl + Z
     */
    public static execute(
        editor: Editor, 
        startPos: { line: number; ch: number }, 
        endPos: { line: number; ch: number }, 
        fullAyahs: Ayah[], 
        userSearchQuery: string,
        settings: TransactionSettings
    ): void {
        const fullOutput = this.formatOutput(fullAyahs, settings);
        
        let snippetOutput = fullOutput;
        if (fullAyahs.length === 1 && userSearchQuery.trim().length > 0) {
            const snippetText = SnippetExtractor.extractQuranSnippet(fullAyahs[0].text, userSearchQuery);
            if (snippetText !== fullAyahs[0].text) {
                const dummyAyah: Ayah = { ...fullAyahs[0], text: snippetText };
                snippetOutput = this.formatOutput([dummyAyah], settings);
            }
        }

        // تنفيذ خطوتي الإدراج تتابعياً بشكل ذري لحقنهما في الـ Undo Stack
        // الخطوة 1: إنزال الشاهد المقتص أولاً
        editor.replaceRange(snippetOutput, startPos, endPos);
        
        // الخطوة 2: استبدال الشاهد فوراً بالآية الكاملة في نفس اللحظة
        const currentEndPos = { 
            line: startPos.line, 
            ch: startPos.ch + snippetOutput.length 
        };
        editor.replaceRange(fullOutput, startPos, currentEndPos);
    }
}