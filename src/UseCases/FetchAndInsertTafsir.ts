import { Editor, Notice } from "obsidian";
import { TafsirRepository } from "../Data/Repositories/TafsirRepository";
import { TafsirFormatter } from "../Domain/Services/TafsirFormatter";
import { TAFSIR_BOOKS_LIST } from "../Domain/Constants/TafsirBooksList";
import { TafsirBook } from "../Domain/Entities/TafsirBook";

export interface TafsirSettings {
    defaultTafsirBookId: string;
    favoriteBooksIds: string[];
    rangeHeadingLevel: "##" | "###" | "####"; 
    bookHeadingLevel: "###" | "####" | "#####";
    useHorizontalDivider: boolean;
    includeAyahTextInTafsir: boolean;
}

export class FetchAndInsertTafsir {
    private repository: TafsirRepository;

    constructor(repository: TafsirRepository) {
        this.repository = repository;
    }

    public async execute(
        editor: Editor,
        lineText: string,
        lineNum: number,
        surahId: number,
        surahName: string,
        startAyah: number,
        endAyah: number,
        getAyahTextLocal: (surah: number, ayah: number) => string,
        settings: TafsirSettings,
        onNoBooksFoundFallback: (booksPool: TafsirBook[]) => Promise<TafsirBook[]>
    ): Promise<boolean> {
        
        let selectedBooks: TafsirBook[] = [];
        for (const book of TAFSIR_BOOKS_LIST) {
            if (book.aliases.some(alias => lineText.indexOf(alias) !== -1)) {
                selectedBooks.push(book);
            }
        }

        if (selectedBooks.length === 0) {
            if (settings.defaultTafsirBookId && settings.defaultTafsirBookId.trim() !== "") {
                const defaultBook = TAFSIR_BOOKS_LIST.find(b => b.id === settings.defaultTafsirBookId);
                if (defaultBook) selectedBooks.push(defaultBook);
            }
            
            if (selectedBooks.length === 0) {
                const booksPool = settings.favoriteBooksIds.length > 0 
                    ? TAFSIR_BOOKS_LIST.filter(b => settings.favoriteBooksIds.indexOf(b.id) !== -1)
                    : TAFSIR_BOOKS_LIST;
                    
                selectedBooks = await onNoBooksFoundFallback(booksPool);
                if (selectedBooks.length === 0) {
                    new Notice("تم إلغاء جلب التفسير.");
                    return false;
                }
            }
        }

        new Notice("جاري جلب التفسير سياقياً...");
        
        let finalOutput = `${settings.rangeHeadingLevel} تفسير سورة ${surahName} (${startAyah} - ${endAyah})\n\n`;
        const ayahRange = Array.from({ length: endAyah - startAyah + 1 }, (_, i) => startAyah + i);

        try {
            for (let bIdx = 0; bIdx < selectedBooks.length; bIdx++) {
                const book = selectedBooks[bIdx];
                let combinedBookText = "";

                for (const ayahId of ayahRange) {
                    if (settings.includeAyahTextInTafsir) {
                        const localAyahText = getAyahTextLocal(surahId, ayahId);
                        if (localAyahText) {
                            combinedBookText += `> ﴿ ${localAyahText} ﴾ (${ayahId})\n>\n`;
                        }
                    }

                    const rawContent = await this.repository.fetchTafsir(book.id, surahId, ayahId);
                    if (rawContent && rawContent.trim() !== "") {
                        combinedBookText += ayahRange.length > 1 
                            ? `[تفسير آية ${ayahId}]:\n${rawContent}\n\n` 
                            : `${rawContent}\n\n`;
                    }
                }

                finalOutput += TafsirFormatter.formatBookContent(book.name, combinedBookText, settings.bookHeadingLevel);

                if (settings.useHorizontalDivider && bIdx < selectedBooks.length - 1) {
                    finalOutput += "---\n\n";
                }
            }

            const startPos = { line: lineNum, ch: 0 };
            const endPos = { line: lineNum, ch: lineText.length };
            
            editor.replaceRange(finalOutput.trim() + "\n", startPos, endPos);
            new Notice("تم إدراج التفسير بنجاح.");
            return true;

        } catch (error) {
            new Notice("فشل الاتصال بالشبكة. تم الاحتفاظ بالأمر الحالي دون تغيير.");
            return false;
        }
    }
}