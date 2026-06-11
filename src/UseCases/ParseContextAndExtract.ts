import { Editor, App } from "obsidian";
import { QuranRepository } from "../Data/Repositories/QuranRepository";
import { QuranText } from "../Domain/ValueObjects/QuranText";
import { ExecuteEditorTransaction, TransactionSettings } from "./ExecuteEditorTransaction";
import { Ayah } from "../Domain/Entities/Ayah";

export class ParseContextAndExtract {
    private repository: QuranRepository;
    private app: App;

    constructor(app: App, repository: QuranRepository) {
        this.app = app;
        this.repository = repository;
    }

    /**
     * نقطة الانطلاق لفحص السطر الحالي وتنفيذ الاستبدال بناءً على الهرمية التنازلية
     * @returns boolean يعيد true إذا تم العثور على تطابق واستبداله، و false إذا كنا بحاجة لفتح الـ Modal العام
     */
    public execute(editor: Editor, settings: TransactionSettings, onAmbiguity: (query: string, matches: Ayah[], start: any, end: any) => void): boolean {
        const cursor = editor.getCursor();
        const currentLine = editor.getLine(cursor.line);

        // 1. الأولوية الأولى: النص المظلل (Active Selection)
        let selectedText = editor.getSelection().trim();
        if (selectedText.length > 0) {
            const startPos = editor.getCursor("from");
            const endPos = editor.getCursor("to");
            return this.processTextQuery(editor, selectedText, startPos, endPos, settings, onAmbiguity);
        }

        // 2. الأولوية الثانية: الأقواس المتعرجة {...}
        const curlyMatch = currentLine.match(/\{([^}]+)\}/);
        if (curlyMatch) {
            const fullCurly = curlyMatch[0];
            const innerText = curlyMatch[1].trim();
            const startPos = { line: cursor.line, ch: currentLine.indexOf(fullCurly) };
            const endPos = { line: cursor.line, ch: currentLine.indexOf(fullCurly) + fullCurly.length };
            
            return this.processTextQuery(editor, innerText, startPos, endPos, settings, onAmbiguity);
        }

        // 3. الأولوية الثالثة: التحليل الرقمي والنطاقات الصريحة (مثل البقرة: 1-3)
        if (currentLine.trim().length > 0) {
            const rangeRegex = /(?:^|\s)([\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+){0,2})\s*[:\s]\s*(\d+(?:\s*-\s*\d+)?(?:\s*[,،]\s*\d+(?:\s*-\s*\d+)?)*)/g;
            const matches = [...currentLine.matchAll(rangeRegex)];

            for (const match of matches) {
                const surahQuery = QuranText.normalizeForSearch(match[1]);
                const foundSurah = this.findSurahByName(surahQuery);

                if (foundSurah) {
                    const startPos = { line: cursor.line, ch: currentLine.indexOf(match[0].trim()) };
                    const endPos = { line: cursor.line, ch: currentLine.indexOf(match[0].trim()) + match[0].trim().length };
                    const targetAyahIds = this.parseVerseNumbers(match[2]);
                    
                    const ayahsData = this.repository.getAllAyahs();
                    const matchedAyahs = ayahsData.filter(a => a.surah_id === foundSurah.id && targetAyahIds.includes(a.ayah_id));

                    if (matchedAyahs.length > 0) {
                        ExecuteEditorTransaction.execute(editor, startPos, endPos, matchedAyahs, "", settings);
                        return true;
                    }
                }
            }

            // 4. الأولوية الرابعة: النافذة المنزلقة (Sliding Window) للبحث النصي التلقائي في السطر
            return this.executeSlidingWindow(editor, currentLine, cursor.line, settings, onAmbiguity);
        }

        return false;
    }

    /**
     * معالجة الاستعلامات النصية والبحث عنها في المصحف مع فحص المتشابهات اللفظية
     */
    private processTextQuery(
        editor: Editor, 
        query: string, 
        startPos: { line: number; ch: number }, 
        endPos: { line: number; ch: number }, 
        settings: TransactionSettings,
        onAmbiguity: (query: string, matches: Ayah[], start: any, end: any) => void
    ): boolean {
        const cleanQuery = query.trim();
        const normWords = cleanQuery.split(/\s+/).map(w => QuranText.normalizeForSearch(w)).filter(w => w.length > 0);
        
        if (normWords.length === 0) return false;

        const strictRegex = new RegExp(`(?:^|\\s)${normWords.map(w => QuranText.makeMedialAlefsOptional(w)).join('\\s+')}(?:\\s|$)`);
        const ayahsData = this.repository.getAllAyahs();
        const matches = ayahsData.filter(a => strictRegex.test(QuranText.normalizeForSearch(a.text)));

        if (matches.length === 1) {
            // نتيجة واحدة مؤكدة -> استبدال فوري بخدعة التراجع الثنائي
            ExecuteEditorTransaction.execute(editor, startPos, endPos, [matches[0]], cleanQuery, settings);
            return true;
        } else if (matches.length > 1) {
            // معالجة المتشابهات اللفظية (Ambiguities)
            // خطوة 1: إنزال الآية الأولى في ترتيب المصحف فوراً لضمان سيولة الكتابة
            ExecuteEditorTransaction.execute(editor, startPos, endPos, [matches[0]], cleanQuery, settings);
            
            // خطوة 2: استدعاء الـ Callback لفتح الـ Modal مسبقة التعبئة للفرز اليدوي وتأمين الـ Override
            const newEndPos = { line: startPos.line, ch: startPos.ch + ExecuteEditorTransaction.formatOutput([matches[0]], settings).length };
            onAmbiguity(cleanQuery, matches, startPos, newEndPos);
            return true;
        }

        return false;
    }

    /**
     * خوارزمية النافذة المنزلقة للبحث عن أطول شاهد قرآني في السطر الحالي
     */
    private executeSlidingWindow(
        editor: Editor, 
        lineText: string, 
        lineIdx: number, 
        settings: TransactionSettings,
        onAmbiguity: (query: string, matches: Ayah[], start: any, end: any) => void
    ): boolean {
        const maskedLine = lineText.replace(/﴿.*?﴾/g, " "); // عزل الآيات المدرجة سابقاً
        const rawWords = maskedLine.split(/\s+/).filter(w => w.trim().length > 0);
        const giantString = this.repository.getGiantString();
        const ayahsData = this.repository.getAllAyahs();

        // فحص الكلمات تنازلياً من نطاق 12 كلمة نزولاً إلى كلمتين
        for (let len = Math.min(rawWords.length, 12); len >= 2; len--) {
            for (let start = 0; start <= rawWords.length - len; start++) {
                const rawSubSegment = rawWords.slice(start, start + len);
                const normWords = rawSubSegment.map(w => QuranText.normalizeForSearch(w)).filter(w => w.length > 0);
                
                if (normWords.length < 2) continue;

                const strictRegex = new RegExp(`(?:^|\\s)${normWords.map(w => QuranText.makeMedialAlefsOptional(w)).join('\\s+')}(?:\\s|$)`);
                if (!strictRegex.test(giantString)) continue;

                const matches = ayahsData.filter(a => strictRegex.test(QuranText.normalizeForSearch(a.text)));
                if (matches.length > 0) {
                    const matchedRawText = rawSubSegment.join(" ");
                    const matchChIndex = lineText.indexOf(matchedRawText);
                    const startPos = { line: lineIdx, ch: matchChIndex };
                    const endPos = { line: lineIdx, ch: matchChIndex + matchedRawText.length };

                    if (matches.length === 1) {
                        ExecuteEditorTransaction.execute(editor, startPos, endPos, [matches[0]], matchedRawText, settings);
                    } else {
                        // في المتشابهات: أنزل الأولى وافتح الـ Modal للفرز
                        ExecuteEditorTransaction.execute(editor, startPos, endPos, [matches[0]], matchedRawText, settings);
                        const newEndPos = { line: startPos.line, ch: startPos.ch + ExecuteEditorTransaction.formatOutput([matches[0]], settings).length };
                        onAmbiguity(matchedRawText, matches, startPos, newEndPos);
                    }
                    return true;
                }
            }
        }
        return false;
    }

    private findSurahByName(normalizedName: string): { id: number; name: string } | null {
        // معجم مصغر للبحث؛ وسيتم توسيعه في الملف المستقل لاحقاً
        const ayahsData = this.repository.getAllAyahs();
        const sample = ayahsData.find(a => QuranText.normalizeForSearch(a.surah_name) === normalizedName);
        return sample ? { id: sample.surah_id, name: sample.surah_name } : null;
    }

    private parseVerseNumbers(rangeStr: string): number[] {
        const parts = rangeStr.split(/[,،]/);
        let ids: number[] = [];
        for (let part of parts) {
            part = part.trim();
            if (part.includes("-")) {
                const subParts = part.split("-");
                const start = parseInt(QuranText.normalizeNumbers(subParts[0]));
                const end = parseInt(QuranText.normalizeNumbers(subParts[1]));
                for (let id = start; id <= end; id++) ids.push(id);
            } else {
                const id = parseInt(QuranText.normalizeNumbers(part));
                if (!isNaN(id)) ids.push(id);
            }
        }
        return [...new Set(ids)].sort((a, b) => a - b);
    }
}