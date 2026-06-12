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
    // المخزن المركزي المشترك لإدارة الحالة الحركية للتراجع والتبديل (Toggle State) رغماً عن تعقيدات كودميرور
    public static lastInsertion: {
        line: number;
        query: string;
        ayahs: Ayah[];
        isSnippet: boolean;
    } | null = null;

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

    public static execute(
        editor: Editor, 
        startPos: { line: number; ch: number }, 
        endPos: { line: number; ch: number }, 
        fullAyahs: Ayah[], 
        userSearchQuery: string,
        settings: TransactionSettings
    ): void {
        const finalOutput = this.formatOutput(fullAyahs, settings);
        
        // التقاط وتحديث بيانات المعاملة الحالية فوراً لربط مسار الـ Toggle حركياً بالنافذة والمنزلقة معاً
        this.lastInsertion = {
            line: startPos.line,
            query: userSearchQuery,
            ayahs: fullAyahs,
            isSnippet: false
        };

        const cm = (editor as any).cm;

        if (cm && typeof cm.dispatch === "function") {
            const from = editor.posToOffset(startPos);
            const to = editor.posToOffset(endPos);

            cm.dispatch({
                changes: { from, to, insert: finalOutput },
                userEvent: "input"
            });
        } else {
            editor.replaceRange(finalOutput, startPos, endPos);
        }
    }
}