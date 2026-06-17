export class TafsirFormatter {
    /**
     * تنسيق متن الكتاب بناءً على تفضيلات الخطوط والعناوين المفضلة للمستخدم
     */
    public static formatBookContent(
        bookName: string, 
        textContent: string, 
        bookHeadingLevel: string
    ): string {
        if (!textContent || textContent.trim() === "") {
            return `${bookHeadingLevel} ${bookName}\n\n> لم يتم العثور على التفسير لهذا الموضع.\n\n`;
        }

        let cleanText = textContent
            .replace(/\[\[(.*?)\]\]/g, "($1)")
            .replace(/==/g, "")
            .replace(/_/g, "")
            .replace(/^-{3,}/gm, "");

        cleanText = cleanText.replace(/(?:\s*\*){2,}/g, " ");
        cleanText = cleanText.replace(/\*/g, "⁕");

        const lines = cleanText.split(/\n+/);
        const formattedParagraphs: string[] = [];

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === "") continue;
            formattedParagraphs.push(`> ${trimmedLine}`);
        }

        const heading = `${bookHeadingLevel} ${bookName}\n\n`;
        const body = formattedParagraphs.join("\n>\n");

        return `${heading}${body}\n\n`;
    }
}