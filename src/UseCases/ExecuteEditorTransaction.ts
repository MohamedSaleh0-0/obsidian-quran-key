import { Editor } from "obsidian";
import { Ayah } from "../Domain/Entities/Ayah";

export interface TransactionSettings {
    useOrnateNumbers: boolean;
    stripTashkeel: boolean;
    referenceFormat: string;
    quranFontFamily: string;
    quranFontSize: number;
    quranLineHeight: number;
    quranColor: string;
}

export class ExecuteEditorTransaction {
    private static applyOrnateNumbers(text: string): string {
        return text.replace(/\((\d+)\)/g, (_, p1) => {
            const arabicDigits = p1.split('').map((d: string) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]).join('');
            return ` \u06DD${arabicDigits} `;
        });
    }

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
     * تنفيذ الاستبدال الفوري النقي عبر دالة المحرر الأساسية لمنع عيوب التكرار وانزياح المؤشر تماماً
     */
    public static execute(
        editor: Editor, 
        startPos: { line: number; ch: number }, 
        endPos: { line: number; ch: number }, 
        fullAyahs: Ayah[], 
        userSearchQuery: string,
        settings: TransactionSettings
    ): void {
        const finalOutput = this.formatOutput(fullAyahs, settings);
        // العودة للـ Native ReplaceRange المستقرة والذرية لإبادة كود التكرار القديم حتماً
        editor.replaceRange(finalOutput, startPos, endPos);
    }
}