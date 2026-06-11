import { Ayah } from "../../Domain/Entities/Ayah";

export class QuranMemoryCache {
    private static instance: QuranMemoryCache;
    private ayahs: Ayah[] = [];
    private giantString: string = "";

    private constructor() {}

    public static getInstance(): QuranMemoryCache {
        if (!QuranMemoryCache.instance) {
            QuranMemoryCache.instance = new QuranMemoryCache();
        }
        return QuranMemoryCache.instance;
    }

    public setAyahs(ayahs: Ayah[]): void {
        this.ayahs = ayahs;
    }

    public getAyahs(): Ayah[] {
        return this.ayahs;
    }

    public setGiantString(giantStr: string): void {
        this.giantString = giantStr;
    }

    public getGiantString(): string {
        return this.giantString;
    }

    public clear(): void {
        this.ayahs = [];
        this.giantString = "";
    }
}