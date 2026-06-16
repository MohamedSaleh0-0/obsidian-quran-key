export interface TafsirRepository {
    fetchTafsir(bookId: string, surahId: number, ayahId: number): Promise<string>;
}