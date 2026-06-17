export class TafsirMemoryCache {
    private static instance: TafsirMemoryCache;
    private cache: Map<string, string> = new Map();

    private constructor() {}

    public static getInstance(): TafsirMemoryCache {
        if (!TafsirMemoryCache.instance) {
            TafsirMemoryCache.instance = new TafsirMemoryCache();
        }
        return TafsirMemoryCache.instance;
    }

    public get(bookId: string, surahId: number, ayahId: number): string | null {
        const key = `${bookId}_${surahId}_${ayahId}`;
        return this.cache.get(key) || null;
    }

    public set(bookId: string, surahId: number, ayahId: number, text: string): void {
        const key = `${bookId}_${surahId}_${ayahId}`;
        this.cache.set(key, text);
    }

    public clear(): void {
        this.cache.clear();
    }
}