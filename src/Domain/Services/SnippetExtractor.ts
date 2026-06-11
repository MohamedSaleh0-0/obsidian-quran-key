import { QuranText } from "../ValueObjects/QuranText";

export class SnippetExtractor {
    /**
     * خوارزمية استخراج الشاهد باستخدام تطابق الكلمات بالاعتماد على الفهرسة الرقمية للكلمة
     */
    public static extractQuranSnippet(fullVerse: string, userSnippet: string): string {
        if (!userSnippet) return fullVerse;
        
        const verseWords = fullVerse.trim().split(/\s+/);
        const normVerseWords = verseWords.map(w => QuranText.normalizeForSearch(w));
        const searchWords = userSnippet.trim().split(/\s+/).map(w => QuranText.normalizeForSearch(w));

        const patternArr = searchWords.map(w => QuranText.makeMedialAlefsOptional(w));

        for (let i = 0; i <= normVerseWords.length - searchWords.length; i++) {
            let match = true;
            for (let j = 0; j < searchWords.length; j++) {
                const r = new RegExp('^' + patternArr[j] + '$');
                if (!r.test(normVerseWords[i + j])) {
                    match = false;
                    break;
                }
            }
            if (match) {
                return verseWords.slice(i, i + searchWords.length).join(' ');
            }
        }
        return fullVerse; // خطة بديلة في حال عدم التطابق الكامل
    }

    /**
     * خوارزمية الاقتصاص اللاحق بين كلمتين محددتين داخل آية واحدة
     */
    public static extractQuranRange(fullVerse: string, startStr: string, endStr: string): string {
        if (!startStr || !endStr) return fullVerse;

        const cleanVerse = fullVerse.replace(/﴿|﴾|\(\d+\)/g, '').trim();
        const verseWords = cleanVerse.split(/\s+/);
        const normVerseWords = verseWords.map(w => QuranText.normalizeForSearch(w));

        const startPattern = new RegExp('^' + QuranText.makeMedialAlefsOptional(QuranText.normalizeForSearch(startStr)) + '$');
        const endPattern = new RegExp('^' + QuranText.makeMedialAlefsOptional(QuranText.normalizeForSearch(endStr)) + '$');

        let startIndex = -1;
        let endIndex = -1;

        for (let i = 0; i < normVerseWords.length; i++) {
            if (startIndex === -1 && startPattern.test(normVerseWords[i])) {
                startIndex = i;
            }
            if (startIndex !== -1 && endPattern.test(normVerseWords[i])) {
                endIndex = i;
                break;
            }
        }

        if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
            return verseWords.slice(startIndex, endIndex + 1).join(' ');
        }
        return cleanVerse;
    }
}