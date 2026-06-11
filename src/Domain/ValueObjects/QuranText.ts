export class QuranText {
    private static readonly TASHKEEL_REGEX = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;
    private static readonly ALEF_KHANJARIYA = /\u0670/g;

    /**
     * حذف التشكيل وعلامات الضبط المصحفية بالكامل لتهيئة النص
     */
    public static stripTashkeel(text: string): string {
        if (!text) return "";
        return text
            .replace(this.ALEF_KHANJARIYA, '')
            .replace(this.TASHKEEL_REGEX, "");
    }

    /**
     * توحيد الحروف العثمانية والقياسية لضمان دقة المطابقة والبحث
     */
    public static normalizeForSearch(text: string): string {
        let txt = this.stripTashkeel(text);
        
        // معالجة الكلمات المكتوبة بالواو عثمانيا وتصحيحها قياسيا للبحث
        txt = txt
            .replace(/صلوة/g, "صلاه")
            .replace(/زكوة/g, "زكاه")
            .replace(/حيوة/g, "حياه")
            .replace(/مشكوة/g, "مشكاه");

        // توحيد الألفات والهمزات والياءات والهاءات وحذف الكشيدة
        return txt
            .replace(/[أإآٱءى]/g, "ا")
            .replace(/[يئ]/g, "ي")
            .replace(/ؤ/g, "و")
            .replace(/ة/g, "ه")
            .replace(/ـ/g, "") 
            .replace(/[^\u0621-\u064A\s0-9٠-٩]/g, "") // إبقاء المحارف العربية والأرقام فقط
            .replace(/ا+/g, "ا"); // دمج الألفات المتكررة إن وجدت
    }

    /**
     * جعل الألف الواسطية اختيارية في التعبير النمطي للتعامل مع حذف الألف رسما عثمانيا
     */
    public static makeMedialAlefsOptional(word: string): string {
        if (word.length <= 2) return word;
        
        let result = word[0];
        for (let i = 1; i < word.length - 1; i++) {
            if (word[i] === 'ا') {
                result += 'ا?';
            } else {
                result += word[i];
            }
        }
        return result + word[word.length - 1];
    }

    /**
     * توحيد الأرقام وتحويل الأرقام الهندية إلى أرقام عربية قياسية
     */
    public static normalizeNumbers(str: string): string {
        if (!str) return str;
        return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    }
}