import { Editor, App } from "obsidian";
import { QuranRepository } from "../Data/Repositories/QuranRepository";
import { QuranText } from "../Domain/ValueObjects/QuranText";
import { ExecuteEditorTransaction, TransactionSettings } from "./ExecuteEditorTransaction";
import { Ayah } from "../Domain/Entities/Ayah";
import { SnippetExtractor } from "../Domain/Services/SnippetExtractor";

export class ParseContextAndExtract {
    private repository: QuranRepository;
    private app: App;
    
    // كشاف حالة الذاكرة المؤقتة لتأمين ميزة الـ Fallback عند تكرار ضغط الـ Hotkey
    private lastExpansion: {
        lineIdx: number;
        query: string;
        fullAyahs: Ayah[];
    } | null = null;

    constructor(app: App, repository: QuranRepository) {
        this.app = app;
        this.repository = repository;
    }

    public execute(editor: Editor, settings: TransactionSettings, onAmbiguity: (query: string, matches: Ayah[], start: any, end: any) => void): boolean {
        const cursor = editor.getCursor();
        const currentLine = editor.getLine(cursor.line);

        // 1. فحص الـ Stateful Fallback: إذا ضغط اليوزر الـ Hotkey مجدداً على سطر ممتد مسبقاً
        if (this.lastExpansion && this.lastExpansion.lineIdx === cursor.line && currentLine.includes("﴿")) {
            const targetAyah = this.lastExpansion.fullAyahs[0];
            const snippetText = SnippetExtractor.extractQuranSnippet(targetAyah.text, this.lastExpansion.query);
            
            if (snippetText !== targetAyah.text) {
                const dummyAyah: Ayah = { ...targetAyah, text: snippetText };
                const snippetOutput = ExecuteEditorTransaction.formatOutput([dummyAyah], settings);
                
                // استبدال السطر الممتد بالكامل بالشاهد المقتص النقي فوراً وبشكل ذري
                editor.setLine(cursor.line, snippetOutput);
                
                // تصفير الكاش لتأمين السطر للعمليات المستقبلية
                this.lastExpansion = null;
                return true;
            }
        }

        // 2. الأولوية الأولى: النص المظلل
        let selectedText = editor.getSelection().trim();
        if (selectedText.length > 0) {
            return this.processTextQuery(editor, selectedText, editor.getCursor("from"), editor.getCursor("to"), settings, onAmbiguity);
        }

        // 3. الأولوية الثانية: الأقواس المتعرجة {...}
        const curlyMatch = currentLine.match(/\{([^}]+)\}/);
        if (curlyMatch) {
            const fullCurly = curlyMatch[0];
            const innerText = curlyMatch[1].trim();
            const startPos = { line: cursor.line, ch: currentLine.indexOf(fullCurly) };
            const endPos = { line: cursor.line, ch: currentLine.indexOf(fullCurly) + fullCurly.length };
            
            return this.processTextQuery(editor, innerText, startPos, endPos, settings, onAmbiguity);
        }

        // 4. الأولوية الثالثة: التحليل الرقمي والنطاقات الصريحة
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
                        this.lastExpansion = null; // تصفير دائم في العمليات الرقمية الصريحة
                        ExecuteEditorTransaction.execute(editor, startPos, endPos, matchedAyahs, "", settings);
                        return true;
                    }
                }
            }

            // 5. الأولوية الرابعة: النافذة المنزلقة (Sliding Window) للبحث التلقائي
            return this.executeSlidingWindow(editor, currentLine, cursor.line, settings, onAmbiguity);
        }

        return false;
    }

    private processTextQuery(
        editor: Editor, 
        query: string, 
        startPos: { line: number; ch: number }, 
        endPos: { line: number; ch: number }, 
        settings: TransactionSettings,
        onAmbiguity: (query: string, matches: Ayah[], start: any, end: any) => void
    ): boolean {
        const normalizedQuery = QuranText.normalizeForSearch(query);
        const normWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
        
        if (normWords.length === 0) return false;

        const strictRegex = new RegExp(`(?:^|\\s)${normWords.map(w => QuranText.makeMedialAlefsOptional(w)).join('\\s+')}(?:\\s|$)`);
        const ayahsData = this.repository.getAllAyahs();
        const matches = ayahsData.filter(a => strictRegex.test(QuranText.normalizeForSearch(a.text)));

        if (matches.length === 1) {
            this.lastExpansion = { lineIdx: startPos.line, query, fullAyahs: [matches[0]] };
            ExecuteEditorTransaction.execute(editor, startPos, endPos, [matches[0]], query, settings);
            return true;
        } else if (matches.length > 1) {
            this.lastExpansion = { lineIdx: startPos.line, query, fullAyahs: [matches[0]] };
            ExecuteEditorTransaction.execute(editor, startPos, endPos, [matches[0]], query, settings);
            const newEndPos = { line: startPos.line, ch: startPos.ch + ExecuteEditorTransaction.formatOutput([matches[0]], settings).length };
            onAmbiguity(query, matches, startPos, newEndPos);
            return true;
        }

        return false;
    }

    private executeSlidingWindow(
        editor: Editor, 
        lineText: string, 
        lineIdx: number, 
        settings: TransactionSettings,
        onAmbiguity: (query: string, matches: Ayah[], start: any, end: any) => void
    ): boolean {
        const maskedLine = lineText.replace(/﴿.*?﴾/g, " ");
        const rawWords = maskedLine.split(/\s+/).filter(w => w.trim().length > 0);
        const giantString = this.repository.getGiantString();
        const ayahsData = this.repository.getAllAyahs();

        for (let len = Math.min(rawWords.length, 12); len >= 2; len--) {
            for (let start = 0; start <= rawWords.length - len; start++) {
                const rawSubSegment = rawWords.slice(start, start + len);
                const combinedSegment = rawSubSegment.join(" ");
                
                const normalizedSegment = QuranText.normalizeForSearch(combinedSegment);
                const normWords = normalizedSegment.split(/\s+/).filter(w => w.length > 0);
                
                if (normWords.length < 2) continue;

                const strictRegex = new RegExp(`(?:^|\\s)${normWords.map(w => QuranText.makeMedialAlefsOptional(w)).join('\\s+')}(?:\\s|$)`);
                if (!strictRegex.test(giantString)) continue;

                const matches = ayahsData.filter(a => strictRegex.test(QuranText.normalizeForSearch(a.text)));
                if (matches.length > 0) {
                    const matchChIndex = lineText.indexOf(combinedSegment);
                    if (matchChIndex === -1) continue;

                    const startPos = { line: lineIdx, ch: matchChIndex };
                    const endPos = { line: lineIdx, ch: matchChIndex + combinedSegment.length };

                    // تسجيل كاش الحالة الحركية للشاهد والسطر الحالي لتأمين ميزة الـ Toggle
                    this.lastExpansion = {
                        lineIdx: lineIdx,
                        query: combinedSegment,
                        fullAyahs: [matches[0]]
                    };

                    if (matches.length === 1) {
                        ExecuteEditorTransaction.execute(editor, startPos, endPos, [matches[0]], combinedSegment, settings);
                    } else {
                        ExecuteEditorTransaction.execute(editor, startPos, endPos, [matches[0]], combinedSegment, settings);
                        const newEndPos = { line: startPos.line, ch: startPos.ch + ExecuteEditorTransaction.formatOutput([matches[0]], settings).length };
                        onAmbiguity(combinedSegment, matches, startPos, newEndPos);
                    }
                    return true;
                }
            }
        }
        return false;
    }

    private findSurahByName(normalizedName: string): { id: number; name: string } | null {
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