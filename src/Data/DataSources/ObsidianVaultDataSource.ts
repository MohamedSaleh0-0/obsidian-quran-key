import { Vault, TFile } from "obsidian"; // أضفنا TFile هنا
import { QuranRepository } from "../Repositories/QuranRepository";
import { QuranMemoryCache } from "../Cache/QuranMemoryCache";
import { Ayah } from "../../Domain/Entities/Ayah";
import { QuranText } from "../../Domain/ValueObjects/QuranText";

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

            const files = this.vault.getFiles();
            // قمنا بتحديد نوع المتغير f هنا لتجنب خطأ any
            const quranFile = files.find((f: TFile) => f.name === "ayahs.json");

            if (!quranFile) {
                return false;
            }

            const fileContent = await this.vault.read(quranFile);
            const rawData: Ayah[] = JSON.parse(fileContent);

            this.cache.setAyahs(rawData);

            const giantStr = rawData
                .map(a => QuranText.normalizeForSearch(a.text))
                .join(" @@@ ");
                
            this.cache.setGiantString(giantStr);

            return true;
        } catch (error) {
            console.error("Quran Key Plugin: Error loading ayahs.json", error);
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