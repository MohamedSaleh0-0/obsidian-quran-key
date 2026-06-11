import { Ayah } from "../../Domain/Entities/Ayah";

export class AnalyticsDashboard {
    private container: HTMLDivElement;

    constructor(parentEl: HTMLElement) {
        this.container = document.createElement("div");
        this.container.id = "quran-analytics-dashboard";
        this.container.style.cssText = "display: flex; justify-content: space-around; align-items: center; background: var(--background-secondary-alt); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; margin: 10px 0; font-size: 0.82em; color: var(--text-normal); direction: rtl; font-family: sans-serif;";
        
        this.container.innerHTML = `
            <div style="flex: 1; text-align: center; border-left: 1px solid var(--border-color);">
                <span style="color: var(--text-muted); display: block; margin-bottom: 4px; font-size: 0.9em;">إجمالي المواضع</span>
                <span id="quran-node-total" style="font-weight: 600; color: var(--text-accent); font-size: 1.1em;">-</span>
            </div>
            <div style="flex: 2; text-align: center; border-left: 1px solid var(--border-color);">
                <span style="color: var(--text-muted); display: block; margin-bottom: 4px; font-size: 0.9em;">الأكثر تكراراً</span>
                <span id="quran-node-max" style="font-weight: 600; color: var(--text-normal); font-size: 1.1em;">-</span>
            </div>
            <div style="flex: 1.5; text-align: center;">
                <span style="color: var(--text-muted); display: block; margin-bottom: 4px; font-size: 0.9em;">الأعلى كثافة نصية</span>
                <span id="quran-node-dense" style="font-weight: 600; color: var(--text-normal); font-size: 1.1em;">-</span>
            </div>
        `;
        
        parentEl.insertAdjacentElement('afterend', this.container);
    }

    /**
     * تحديث أرقام وإحصائيات لوحة العرض فورياً بناءً على فرز نتائج البحث الحالية
     */
    public update(matches: Ayah[], allAyahs: Ayah[]): void {
        const nodeTotal = document.getElementById("quran-node-total");
        const nodeMax = document.getElementById("quran-node-max");
        const nodeDense = document.getElementById("quran-node-dense");

        if (!nodeTotal || !nodeMax || !nodeDense) return;

        if (!matches || matches.length === 0) {
            nodeTotal.innerText = "0";
            nodeMax.innerText = "-";
            nodeDense.innerText = "-";
            return;
        }

        const surahCounts: { [key: number]: number } = {};
        matches.forEach(a => {
            surahCounts[a.surah_id] = (surahCounts[a.surah_id] || 0) + 1;
        });

        let maxSurahId: number | null = null;
        let maxCount = 0;
        for (const id in surahCounts) {
            const count = surahCounts[id];
            if (count > maxCount) {
                maxCount = count;
                maxSurahId = Number(id);
            }
        }

        let maxSurahName = "";
        let maxSurahDensityPercent = "0.000%";
        if (maxSurahId) {
            const matchedAyah = allAyahs.find(a => a.surah_id === maxSurahId);
            maxSurahName = matchedAyah ? matchedAyah.surah_name : "";
            const totalMaxSurahAyahs = allAyahs.filter(a => a.surah_id === maxSurahId);
            const totalMaxWords = totalMaxSurahAyahs.reduce((sum, a) => sum + a.text.split(/\s+/).length, 0);
            maxSurahDensityPercent = ((totalMaxWords ? surahCounts[maxSurahId] / totalMaxWords : 0) * 100).toFixed(3) + "%";
        }

        let highestDensity = 0;
        let denseSurahId: number | null = null;
        for (const id in surahCounts) {
            const sId = Number(id);
            const totalSurahAyahs = allAyahs.filter(a => a.surah_id === sId);
            const totalWords = totalSurahAyahs.reduce((sum, a) => sum + a.text.split(/\s+/).length, 0);
            const density = surahCounts[id] / totalWords;
            if (density > highestDensity) {
                highestDensity = density;
                denseSurahId = sId;
            }
        }

        const denseSample = allAyahs.find(a => a.surah_id === denseSurahId);
        const denseSurahName = denseSample ? denseSample.surah_name : "";

        nodeTotal.innerText = matches.length.toString();
        nodeMax.innerText = maxSurahName ? `${maxSurahName} (${maxCount}, ${maxSurahDensityPercent})` : "-";
        nodeDense.innerText = denseSurahName ? `${denseSurahName} (${(highestDensity * 100).toFixed(3)}%)` : "-";
    }
}