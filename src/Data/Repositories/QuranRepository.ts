import { Ayah } from "../../Domain/Entities/Ayah";

export interface QuranRepository {
    loadAll(): Promise<boolean>;
    getAllAyahs(): Ayah[];
    getGiantString(): string;
}