import { Vault } from "obsidian";
import { QuranRepository } from "../Repositories/QuranRepository";
import { QuranMemoryCache } from "../Cache/QuranMemoryCache";
import { Ayah } from "../../Domain/Entities/Ayah";
import { QuranText } from "../../Domain/ValueObjects/QuranText";

import rawData from "../../../ayahs.json";

export class ObsidianVaultDataSource implements QuranRepository {
    private vault: Vault;
    private cache: QuranMemoryCache;

    constructor(vault: Vault) {
        this.vault = vault;
        this.cache = QuranMemoryCache.getInstance();
    }

    public async loadAll(): Promise<boolean> {
        try {
            if (this.cache.getAyahs().length > 0) {
                return true;
            }

            // تحويل مصفوفة الـ JSON وتوليد الـ id الناقص حركياً ليتطابق الهيكل مع الـ Entity تماماً
            const mappedAyahs: Ayah[] = (rawData as any[]).map((a, index) => ({
                id: index + 1,
                surah_id: a.surah_id,
                ayah_id: a.ayah_id,
                surah_name: a.surah_name,
                text: a.text
            }));

            this.cache.setAyahs(mappedAyahs);

            const giantStr = mappedAyahs
                .map(a => QuranText.normalizeForSearch(a.text))
                .join(" @@@ ");
                
            this.cache.setGiantString(giantStr);

            return true;
        } catch (error) {
            console.error("Quran Key Plugin: Critical error parsing embedded ayahs.json inside bundle", error);
            return false;
        }
    }

    public getAllAyahs(): Ayah[] {
        return this.cache.getAyahs();
    }

    public getGiantString(): string {
        return this.cache.getGiantString();
    }
}