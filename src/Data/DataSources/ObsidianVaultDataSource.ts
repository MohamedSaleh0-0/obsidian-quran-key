import { Vault } from "obsidian";
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

    /**
     * قراءة الملف حتمياً من داخل مجلد الإضافة المخصص لتجنب تلوث الفولت الشخصي للمخدم
     */
    public async loadAll(): Promise<boolean> {
        try {
            if (this.cache.getAyahs().length > 0) {
                return true;
            }

            // استخدام الـ configDir للوصول للمجلد المخفي .obsidian/plugins/quran-key
            const configDirectory = (this.vault as any).configDir || ".obsidian";
            const ayahsFilePath = `${configDirectory}/plugins/quran-key/ayahs.json`;

            // التحقق من وجود ملف البيانات داخل المجلد الخاص بالإضافة عبر الـ Adapter
            const fileExists = await this.vault.adapter.exists(ayahsFilePath);
            if (!fileExists) {
                console.error("Quran Key Plugin: ayahs.json was not found inside the plugin directory.");
                return false;
            }

            const fileContent = await this.vault.adapter.read(ayahsFilePath);
            const rawData: Ayah[] = JSON.parse(fileContent);

            this.cache.setAyahs(rawData);

            const giantStr = rawData
                .map(a => QuranText.normalizeForSearch(a.text))
                .join(" @@@ ");
                
            this.cache.setGiantString(giantStr);

            return true;
        } catch (error) {
            console.error("Quran Key Plugin: Critical error reading ayahs.json from plugin folder", error);
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