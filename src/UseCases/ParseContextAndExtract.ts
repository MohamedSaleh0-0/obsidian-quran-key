import { Editor, App } from "obsidian";
import { QuranRepository } from "../Data/Repositories/QuranRepository";
import { QuranText } from "../Domain/ValueObjects/QuranText";
import { ExecuteEditorTransaction, TransactionSettings } from "./ExecuteEditorTransaction";
import { Ayah } from "../Domain/Entities/Ayah";
import { SnippetExtractor } from "../Domain/Services/SnippetExtractor";

export interface ExtractedQuranContext {
    surahId: number;
    surahName: string;
    startAyah: number;
    endAyah: number;
}

export class ParseContextAndExtract {
    private repository: QuranRepository;
    private app: App;

    constructor(app: App, repository: QuranRepository) {
        this.app = app;
        this.repository = repository;
    }

    /**
     * ميزة مضافة لنسخة v2: تحليل السطر الحالي واستخراج بيانات السورة والآيات دون تعديل المحرر
     */
    public analyzeLineContext(editor: Editor): ExtractedQuranContext | null {
        const cursor = editor.getCursor();
        const currentLine = editor.getLine(cursor.line);

        if (!currentLine || currentLine.trim() === "") return null;

        // 1. فحص ما إذا كان السطر يحتوي على آية مدرجة مسبقاً ﴿...﴾ [Surah:Verse]
        const refRegex = /\[([\u0600-\u06FF\s]+):(\d+)(?:-(\d+))?\]/;
        const refMatch = currentLine.match(refRegex);

        if (refMatch) {
            const surahNorm = QuranText.normalizeForSearch(refMatch[1]);
            const foundSurah = this.findSurahByName(surahNorm);
            if (foundSurah) {
                const start = parseInt(QuranText.normalizeNumbers(refMatch[2]));
                const end = refMatch[3] ? parseInt(QuranText.normalizeNumbers(refMatch[3])) : start;
                return { surahId: foundSurah.id, surahName: foundSurah.name, startAyah: start, endAyah: end };
            }
        }

        // 2. فحص الصيغة الرقمية الصريحة (البقرة: 1-3)
        const rangeRegex = /(?:^|\s)([\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+){0,2})\s*[:\s]\s*(\d+(?:\s*-\s*\d+)?)/;
        const rangeMatch = currentLine.match(rangeRegex);

        if (rangeMatch) {
            const surahQuery = QuranText.normalizeForSearch(rangeMatch[1]);
            const foundSurah = this.findSurahByName(surahQuery);
            if (foundSurah) {
                const parts = rangeMatch[2].split("-");
                const start = parseInt(QuranText.normalizeNumbers(parts[0]));
                const end = parts[1] ? parseInt(QuranText.normalizeNumbers(parts[1])) : start;
                return { surahId: foundSurah.id, surahName: foundSurah.name, startAyah: start, endAyah: end };
            }
        }

        // 3. تشغيل النافذة المنزلقة (Sliding Window) لاستخراج السياق من الكلمات الخام
        const maskedLine = currentLine.replace(/﴿.*?﴾/g, " ");
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
                    const target = matches[0];
                    return {
                        surahId: target.surah_id,
                        surahName: target.surah_name,
                        startAyah: target.ayah_id,
                        endAyah: target.ayah_id
                    };
                }
            }
        }

        return null;
    }

    public execute(editor: Editor, settings: TransactionSettings, onAmbiguity: (query: string, matches: Ayah[], start: any, end: any) => void): boolean {
        const cursor = editor.getCursor();
        const currentLine = editor.getLine(cursor.line);
        const lastInsertion = ExecuteEditorTransaction.lastInsertion;

        if (lastInsertion && lastInsertion.line === cursor.line && currentLine.indexOf("﴿") !== -1 && currentLine.indexOf("﴾") !== -1) {
            const targetAyah = lastInsertion.ayahs[0];
            const queryText = lastInsertion.query.trim();

            if (!lastInsertion.isSnippet) {
                if (queryText.length > 0) {
                    const snippetText = SnippetExtractor.extractQuranSnippet(targetAyah.text, queryText);
                    if (snippetText !== targetAyah.text) {
                        const dummyAyah: Ayah = { ...targetAyah, text: snippetText };
                        const snippetOutput = ExecuteEditorTransaction.formatOutput([dummyAyah], settings);
                        
                        editor.setLine(cursor.line, snippetOutput);
                        lastInsertion.isSnippet = true;
                        return true;
                    }
                }
            } else {
                const fullOutput = ExecuteEditorTransaction.formatOutput(lastInsertion.ayahs, settings);
                editor.setLine(cursor.line, fullOutput);
                lastInsertion.isSnippet = false;
                return true;
            }
        }

        const parenRegex = /\(([^)]+?-[^)]+?)\)/g;
        let parenMatch;
        while ((parenMatch = parenRegex.exec(currentLine)) !== null) {
            const startCh = parenMatch.index;
            const endCh = parenMatch.index + parenMatch[0].length;
            
            if (cursor.ch >= startCh && cursor.ch <= endCh) {
                const refRegex = /\[([\u0600-\u06FF\s]+):(\d+)\]/;
                const refMatch = currentLine.match(refRegex);

                if (refMatch) {
                    const surahNorm = QuranText.normalizeForSearch(refMatch[1]);
                    const ayahId = parseInt(QuranText.normalizeNumbers(refMatch[2]));
                    
                    const actualAyah = this.repository.getAllAyahs().find(a => 
                        QuranText.normalizeForSearch(a.surah_name) === surahNorm && a.ayah_id === ayahId
                    );

                    if (actualAyah) {
                        const parts = parenMatch[1].split("-");
                        const startWord = parts[0].trim();
                        const endWord = parts[1].trim();
                        
                        const croppedText = SnippetExtractor.extractQuranRange(actualAyah.text, startWord, endWord);
                        
                        if (croppedText && croppedText !== actualAyah.text) {
                            const dummyAyah: Ayah = { ...actualAyah, text: croppedText };
                            const finalOutput = ExecuteEditorTransaction.formatOutput([dummyAyah], settings);
                            
                            editor.setLine(cursor.line, finalOutput);
                            return true;
                        }
                    }
                }
            }
        }

        let selectedText = editor.getSelection().trim();
        if (selectedText.length > 0) {
            return this.processTextQuery(editor, selectedText, editor.getCursor("from"), editor.getCursor("to"), settings, onAmbiguity);
        }

        const curlyMatch = currentLine.match(/\{([^}]+)\}/);
        if (curlyMatch) {
            const fullCurly = curlyMatch[0];
            const innerText = curlyMatch[1].trim();
            const startPos = { line: cursor.line, ch: currentLine.indexOf(fullCurly) };
            const endPos = { line: cursor.line, ch: currentLine.indexOf(fullCurly) + fullCurly.length };
            
            return this.processTextQuery(editor, innerText, startPos, endPos, settings, onAmbiguity);
        }

        if (currentLine.trim().length > 0) {
            const rangeRegexLoop = /(?:^|\s)([\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+){0,2})\s*[:\s]\s*(\d+(?:\s*-\s*\d+)?(?:\s*[,،]\s*\d+(?:\s*-\s*\d+)?)*)/g;
            let match;

            while ((match = rangeRegexLoop.exec(currentLine)) !== null) {
                const surahQuery = QuranText.normalizeForSearch(match[1]);
                const foundSurah = this.findSurahByName(surahQuery);

                if (foundSurah) {
                    const startPos = { line: cursor.line, ch: currentLine.indexOf(match[0].trim()) };
                    const endPos = { line: cursor.line, ch: currentLine.indexOf(match[0].trim()) + match[0].trim().length };
                    const targetAyahIds = this.parseVerseNumbers(match[2]);
                    
                    const ayahsData = this.repository.getAllAyahs();
                    const matchedAyahs = ayahsData.filter(a => a.surah_id === foundSurah.id && targetAyahIds.indexOf(a.ayah_id) !== -1);

                    if (matchedAyahs.length > 0) {
                        ExecuteEditorTransaction.execute(editor, startPos, endPos, matchedAyahs, "", settings);
                        return true;
                    }
                }
            }

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
            ExecuteEditorTransaction.execute(editor, startPos, endPos, [matches[0]], query, settings);
            return true;
        } else if (matches.length > 1) {
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