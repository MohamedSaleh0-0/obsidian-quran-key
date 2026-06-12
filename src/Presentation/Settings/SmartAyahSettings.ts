import { App, PluginSettingTab, Setting } from "obsidian";
import QuranKeyPlugin from "../../main";

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

        // إضافة مفتاح التحكم التخصيصي في لوحة الإحصائيات النصية بناءً على طلبك
        new Setting(containerEl)
            .setName("إظهار لوحة التحليلات والإحصائيات")
            .setDesc("تفعيل أو تعطيل ظهور لوحة البيانات الفورية (إجمالي المواضع، الأكثر تكراراً، الكثافة) أسفل شريط البحث مباشرة داخل نوافذ الفرز.")
            .addToggle(toggle => toggle
                .setValue((this.plugin.settings as any).showAnalytics)
                .onChange(async (value) => {
                    (this.plugin.settings as any).showAnalytics = value;
                    await this.plugin.saveSettings();
                }));

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