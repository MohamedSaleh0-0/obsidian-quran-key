export class QuranText {
    public static stripTashkeel(text: string): string {
        if (!text) return "";
        return text
            .replace(/\u0670/g, '') // حذف الألف الخنجرية حتماً
            .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, ""); // حذف التشكيل وعلامات الوقف
    }
    
    public static normalizeForSearch(text: string): string {
        if (!text) return "";
        
        let txt = text.trim()
            .replace(/يا\s+أيها/g, "يايها")
            .replace(/ياأيها/g, "يايها")
            .replace(/يأيها/g, "يايها");

        txt = this.stripTashkeel(txt);
        
        // معالجة الانقلابات العثمانية الشهيرة من كود v1.3.0 المستقر
        txt = txt.replace(/صلوة/g, "صلاه")
                 .replace(/زكوة/g, "زكاه")
                 .replace(/حيوة/g, "حياه")
                 .replace(/مشكوة/g, "مشكاه");
                 
        // توحيد كراسي الهمزات والألفات
        txt = txt.replace(/[أإآٱءى]/g, "ا")
                 .replace(/[ييئ]/g, "ي")
                 .replace(/ؤ/g, "و")
                 .replace(/ة/g, "ه")
                 .replace(/ـ/g, "");
                 
        // إبادة علة الألف المزدوجة الناتجة عن تداخل الإدخال
        txt = txt.replace(/ياا/g, "يا");

        return txt
            .replace(/[^\u0621-\u064A\s0-9٠-٩]/g, "")
            .replace(/ا+/g, "ا")
            .replace(/\s+/g, " ")
            .trim();
    }

    public static makeMedialAlefsOptional(word: string): string {
        if (!word || word.length <= 2) return word; 
        let res = word[0];
        for (let i = 1; i < word.length - 1; i++) {
            if (word[i] === 'ا') res += 'ا?';
            else res += word[i];
        }
        return res + word[word.length - 1];
    }

    public static normalizeNumbers(text: string): string {
        if (!text) return "";
        return text
            .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
            .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString());
    }
}