import { App, PluginSettingTab, Setting } from "obsidian";
import QuranKeyPlugin from "../../main";
import { TAFSIR_BOOKS_LIST } from "../../Domain/Constants/TafsirBooksList";

export class QuranKeySettingTab extends PluginSettingTab {
    plugin: QuranKeyPlugin;

    constructor(app: App, plugin: QuranKeyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "إعدادات مفتاح القرآن — Quran Key Settings" });

        // ==========================================
        // Section 1: Core Quranic Content and Takhrij
        // ==========================================
        containerEl.createEl("h3", { text: "التحكم في النصوص والتخريج" });

        new Setting(containerEl)
            .setName("إدراج النص مجرداً من التشكيل")
            .setDesc("عند تفعيل هذا الخيار، سيتم جلب الآيات القرآنية وحذف علامات الضبط والتشكيل والتنوين تلقائياً كحالة افتراضية.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.stripTashkeel)
                .onChange(async (value) => {
                    this.plugin.settings.stripTashkeel = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("استخدام الأرقام المزخرفة")
            .setDesc("تحويل أرقام الآيات العادية بين القوسين إلى الرمز المصحفي الفاخر مع الأرقام العربية المشروطة.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useOrnateNumbers)
                .onChange(async (value) => {
                    this.plugin.settings.useOrnateNumbers = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("صيغة الإحالة المرجعية")
            .setDesc("تخصيص شكل كتابة اسم السورة ورقم الآية المصاحب للنص.")
            .addText(text => text
                .setPlaceholder("[Surah:Verse]")
                .setValue(this.plugin.settings.referenceFormat)
                .onChange(async (value) => {
                    this.plugin.settings.referenceFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("إظهار لوحة التحليلات والإحصائيات")
            .setDesc("تفعيل أو تعطيل ظهور لوحة البيانات الفورية (إجمالي المواضع، الأكثر تكراراً، الكثافة) أسفل شريط البحث مباشرة داخل نوافذ الفرز.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showAnalytics)
                .onChange(async (value) => {
                    this.plugin.settings.showAnalytics = value;
                    await this.plugin.saveSettings();
                }));

        // ==========================================
        // Section 2: Contextual Tafsir Engine (v2)
        // ==========================================
        containerEl.createEl("h3", { text: "إعدادات محرك التفسير السياقي" });

        new Setting(containerEl)
            .setName("الكتاب الافتراضي")
            .setDesc("التفسير الذي سيتم اعتماده تلقائياً إذا لم تكتب اسماً محدداً في سطر الأوامر.")
            .addDropdown(dropdown => {
                TAFSIR_BOOKS_LIST.forEach(book => {
                    dropdown.addOption(book.id, book.name);
                });
                dropdown.setValue(this.plugin.settings.defaultTafsirBookId);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.defaultTafsirBookId = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName("حجم عنوان نطاق الآيات")
            .setDesc("مستوى الـ Heading لعنوان النطاق الرئيسي المنسق (مثال: ### تفسير سورة الفاتحة).")
            .addDropdown(dropdown => {
                dropdown.addOption("##", "Heading 2 (##)")
                        .addOption("###", "Heading 3 (###)")
                        .addOption("####", "Heading 4 (####)")
                        .setValue(this.plugin.settings.rangeHeadingLevel);
                dropdown.onChange(async (value: string) => {
                    if (value === "##" || value === "###" || value === "####") {
                        this.plugin.settings.rangeHeadingLevel = value;
                        await this.plugin.saveSettings();
                    }
                });
            });

        new Setting(containerEl)
            .setName("حجم عنوان كتاب التفسير")
            .setDesc("مستوى الـ Heading لاسم كتاب التفسير الفرعي داخل الملاحظة.")
            .addDropdown(dropdown => {
                dropdown.addOption("###", "Heading 3 (###)")
                        .addOption("####", "Heading 4 (####)")
                        .addOption("#####", "Heading 5 (#####)")
                        .setValue(this.plugin.settings.bookHeadingLevel);
                dropdown.onChange(async (value: string) => {
                    if (value === "###" || value === "####" || value === "#####") {
                        this.plugin.settings.bookHeadingLevel = value;
                        await this.plugin.saveSettings();
                    }
                });
            });

        new Setting(containerEl)
            .setName("تضمين نص الآية القرآنية")
            .setDesc("طباعة نص الآية الكريمة داخل علامات اقتباس قبل إدراج متن التفسير الخاص بها.")
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.includeAyahTextInTafsir);
                toggle.onChange(async (value) => {
                    this.plugin.settings.includeAyahTextInTafsir = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName("استخدام فاصل أفقي")
            .setDesc("إدراج خط فاصل متميز (---) بين كتب التفسير المتعددة عند جلب أكثر من تفسير للسطر الواحد.")
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.useHorizontalDivider);
                toggle.onChange(async (value) => {
                    this.plugin.settings.useHorizontalDivider = value;
                    await this.plugin.saveSettings();
                });
            });

        // Safe DOM styling injection via native cssText properties
        const favoritesSection = containerEl.createEl("details");
        favoritesSection.style.cssText = "margin-top: 15px; padding: 10px; background: var(--background-secondary); border-radius: 4px; cursor: pointer;";
        
        const summaryEl = favoritesSection.createEl("summary", { text: "تخصيص قائمة كتب التفسير المفضلة للـ Fallbacks" });
        summaryEl.style.cssText = "font-weight: 500; color: var(--text-normal);";
        
        const listContainer = favoritesSection.createEl("div");
        listContainer.style.cssText = "margin-top: 10px; display: grid; grid-template-columns: 1fr; gap: 6px; cursor: default;";
        
        TAFSIR_BOOKS_LIST.forEach(book => {
            const row = listContainer.createEl("div");
            row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--background-modifier-border);";
            
            const labelEl = row.createEl("span", { text: book.name });
            labelEl.style.cssText = "font-size: 0.9em; color: var(--text-muted);";
            
            const isFav = this.plugin.settings.favoriteBooksIds.indexOf(book.id) !== -1;
            
            const checkbox = row.createEl("input", { type: "checkbox" });
            checkbox.checked = isFav;
            checkbox.addEventListener("change", async () => {
                const currentFavs = [...this.plugin.settings.favoriteBooksIds];
                const index = currentFavs.indexOf(book.id);
                
                if (checkbox.checked && index === -1) {
                    currentFavs.push(book.id);
                } else if (!checkbox.checked && index !== -1) {
                    currentFavs.splice(index, 1);
                }
                
                this.plugin.settings.favoriteBooksIds = currentFavs;
                await this.plugin.saveSettings();
            });
        });

        // ==========================================
        // Section 3: Aesthetics and Visual Profiles
        // ==========================================
        containerEl.createEl("h3", { text: "تنسيق مفسر الأقواس المزخرفة (Dynamic Highlights Style)" });

        new Setting(containerEl)
            .setName("نوع الخط المصحفي (Font Family)")
            .setDesc("اسم الخط المستخدم لتنسيق الآيات داخل الأقواس (مثال: 'Amiri' أو 'Traditional Arabic').")
            .addText(text => text
                .setValue(this.plugin.settings.quranFontFamily)
                .onChange(async (value) => {
                    this.plugin.settings.quranFontFamily = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("حجم الخط (Font Size)")
            .setDesc("التحكم بحجم خط الآية بوحدة الـ (em) بالنسبة لمتن النص الأساسي.")
            .addSlider(slider => slider
                .setLimits(0.8, 2.0, 0.05)
                .setValue(this.plugin.settings.quranFontSize)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.quranFontSize = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("ارتفاع السطر (Line Height)")
            .setDesc("التحكم بتباعد الأسطر لمنع تداخل الحركات وعلامات الوقف المصحفية العالية.")
            .addSlider(slider => slider
                .setLimits(1.5, 3.5, 0.1)
                .setValue(this.plugin.settings.quranLineHeight)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.quranLineHeight = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("لون الآيات (Quran Accent Color)")
            .setDesc("اختر اللون المخصص لتمييز الشواهد القرآنية داخل الأقواس المزخرفة.")
            .addColorPicker(color => color
                .setValue(this.plugin.settings.quranColor)
                .onChange(async (value) => {
                    this.plugin.settings.quranColor = value;
                    await this.plugin.saveSettings();
                }));
    }
}