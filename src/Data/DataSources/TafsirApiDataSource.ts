import { requestUrl } from "obsidian";
import { TafsirRepository } from "../Repositories/TafsirRepository";
import { TafsirMemoryCache } from "../Cache/TafsirMemoryCache";

export class TafsirApiDataSource implements TafsirRepository {
    private baseUrl = "https://tafsir.app/get.php";
    private cache: TafsirMemoryCache;

    constructor() {
        this.cache = TafsirMemoryCache.getInstance();
    }

    /**
     * جلب نص التفسير لآية محددة من كتاب معين أونلاين مع التحقق من الكاش المحلي أولاً
     */
    public async fetchTafsir(bookId: string, surahId: number, ayahId: number): Promise<string> {
        // 1. التحقق من وجود التفسير في الذاكرة المؤقتة لمنع الطلبات المكررة
        const cachedText = this.cache.get(bookId, surahId, ayahId);
        if (cachedText !== null) {
            return cachedText;
        }

        const url = `${this.baseUrl}?src=${bookId}&s=${surahId}&a=${ayahId}&ver=1`;

        try {
            const response = await requestUrl({ url });
            
            if (response.status === 200 && response.json && response.json.data) {
                const tafsirText = response.json.data;
                // 2. حفظ التفسير المجلوب في الكاش للاستدعاء الفوري لاحقاً
                this.cache.set(bookId, surahId, ayahId, tafsirText);
                return tafsirText;
            }
            
            return "";
        } catch (error) {
            console.error(`Quran Key Plugin: Error fetching tafsir for book ${bookId}, Surah ${surahId}, Ayah ${ayahId}`, error);
            throw error;
        }
    }
}