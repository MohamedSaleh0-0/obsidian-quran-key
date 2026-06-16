export class TafsirFormatter {
    /**
     * يستقبل نص التفسير الخام من الـ API ويقوم بتنظيفه وصياغته داخل تنسيق هرمي محكم
     */
    public static formatBookContent(bookName: string, textContent: string): string {
        if (!textContent || textContent.trim() === "") {
            return `#### ${bookName}\n\n> لم يتم العثور على التفسير لهذا الموضع.\n\n`;
        }

        // 1. التنظيف الشامل لعلامات التنسيق الزائدة وفواصل المواقع العشوائية
        let cleanText = textContent
            .replace(/\[\[(.*?)\]\]/g, "($1)") // تحويل الروابط الداخلية إلى أقواس عادية
            .replace(/==/g, "")                 // إزالة علامات التمييز الأصفر
            .replace(/_/g, "")                  // إزالة الخطوط السفلية
            .replace(/^-{3,}/gm, "");           // إزالة الفواصل الخطية الأفقية العشوائية من المتن

        // سحق مجموعات النجوم المتكررة (Empty Tokens) واستبدال النجمة المفردة برمز الأسانيد المعتمد
        cleanText = cleanText.replace(/(?:\s*\*){2,}/g, " ");
        cleanText = cleanText.replace(/\*/g, "⁕");

        // 2. تقسيم النص إلى أسطر ومعالجة الهندسة الهرمية للفقرات
        const lines = cleanText.split(/\n+/);
        const formattedParagraphs: string[] = [];

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === "") continue;

            // حقن رمز الاقتباس أول السطر لعزل نص التفسير عن ملاحظات المستخدم الأساسية
            formattedParagraphs.push(`> ${trimmedLine}`);
        }

        // 3. تجميع الهيكل النهائي (عنوان الكتاب الفرعي يليه متن الاقتباس المنسق)
        const heading = `#### ${bookName}\n\n`;
        const body = formattedParagraphs.join("\n>\n"); // الحفاظ على مسافة مائلة فاصلة بين الفقرات داخل الـ Blockquote

        return `${heading}${body}\n\n`;
    }
}