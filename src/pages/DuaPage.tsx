import { useState, useEffect, useMemo } from "react";
import { Search, BookOpen, ChevronRight, ArrowLeft, Sparkles, Heart, Volume2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import DuaAudioPlayer from "@/components/DuaAudioPlayer";
import { supabase } from "@/integrations/supabase/client";
import { AdSlot } from "@/components/ads/AdSlot";

type Language = "bengali" | "english" | "hindi" | "urdu";

const LANGUAGE_LABELS: Record<Language, string> = {
  bengali: "বাংলা",
  english: "English",
  hindi: "हिंदी",
  urdu: "اردو",
};

const SECTION_LABELS = {
  arabic: {
    bengali: "আরবি",
    english: "Arabic",
    hindi: "अरबी",
    urdu: "عربی",
  },
  transliteration: {
    bengali: "বাংলা উচ্চারণ",
    english: "Transliteration",
    hindi: "उच्चारण",
    urdu: "تلفظ",
  },
  translation: {
    bengali: "অনুবাদ",
    english: "Translation",
    hindi: "अनुवाद",
    urdu: "ترجمہ",
  },
} as const;

const CATEGORY_TRANSLATIONS: Record<string, Record<Language, string>> = {
  Food: { bengali: "খাবার", english: "Food", hindi: "भोजन", urdu: "کھانا" },
  Protection: { bengali: "সুরক্ষা", english: "Protection", hindi: "सुरक्षा", urdu: "حفاظت" },
  Guidance: { bengali: "হেদায়াত", english: "Guidance", hindi: "मार्गदर्शन", urdu: "ہدایت" },
  Daily: { bengali: "দৈনন্দিন", english: "Daily", hindi: "दैनिक", urdu: "روزانہ" },
  Quran: { bengali: "কুরআন", english: "Quran", hindi: "क़ुरान", urdu: "قرآن" },
  Death: { bengali: "মৃত্যু", english: "Death", hindi: "मृत्यु", urdu: "موت" },
  Morning: { bengali: "সকাল", english: "Morning", hindi: "सुबह", urdu: "صبح" },
  Knowledge: { bengali: "জ্ঞান", english: "Knowledge", hindi: "ज्ञान", urdu: "علم" },
  Sleep: { bengali: "ঘুম", english: "Sleep", hindi: "नींद", urdu: "نیند" },
  Hajj: { bengali: "হজ", english: "Hajj", hindi: "हज", urdu: "حج" },
  Health: { bengali: "স্বাস্থ্য", english: "Health", hindi: "स्वास्थ्य", urdu: "صحت" },
  Family: { bengali: "পরিবার", english: "Family", hindi: "परिवार", urdu: "خاندان" },
  Salah: { bengali: "সালাত", english: "Salah", hindi: "सलाह", urdu: "صلاة" },
  Masjid: { bengali: "মসজিদ", english: "Masjid", hindi: "मस्जिद", urdu: "مسجد" },
  Fasting: { bengali: "রোজা", english: "Fasting", hindi: "रोज़ा", urdu: "روزہ" },
  Travel: { bengali: "সফর", english: "Travel", hindi: "यात्रा", urdu: "سفر" },
  Evening: { bengali: "সন্ধ্যা", english: "Evening", hindi: "शाम", urdu: "شام" },
  Forgiveness: { bengali: "ক্ষমা", english: "Forgiveness", hindi: "क्षमा", urdu: "معافی" },
  Wudu: { bengali: "অজু", english: "Wudu", hindi: "वुज़ू", urdu: "وضو" },
  Weather: { bengali: "আবহাওয়া", english: "Weather", hindi: "मौसम", urdu: "موسم" },
  Dua: { bengali: "দোয়া", english: "Dua", hindi: "दुआ", urdu: "دعا" },
};

const getCategoryLabel = (category: string, lang: Language): string => {
  return CATEGORY_TRANSLATIONS[category]?.[lang] || category;
};

const slugifyCategory = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, "-")
    .replace(/(^-+|-+$)/g, "");

const UI_LABELS = {
  loading: {
    bengali: "দোয়া লোড হচ্ছে...",
    english: "Loading duas...",
    hindi: "दुआएं लोड हो रही हैं...",
    urdu: "دعائیں لوڈ ہو رہی ہیں...",
  },
  errorMessage: {
    bengali: "দোয়া লোড করতে সমস্যা হয়েছে।",
    english: "Failed to load duas. Please try again.",
    hindi: "दुआएं लोड करने में विफल।",
    urdu: "دعائیں لوڈ کرنے میں ناکامی۔",
  },
  noDuasFound: {
    bengali: "কোনো দোয়া পাওয়া যায়নি।",
    english: "No duas found.",
    hindi: "कोई दुआ नहीं मिली।",
    urdu: "کوئی دعا نہیں ملی۔",
  },
  searchPlaceholder: {
    bengali: "দোয়া খুঁজুন...",
    english: "Search duas...",
    hindi: "दुआ खोजें...",
    urdu: "دعا تلاش کریں...",
  },
} as const;

interface DuaTranslation {
  title: string;
  translation: string;
  category: string;
}

interface Dua {
  id: string;
  slug?: string | null;
  arabic: string;
  bengaliTransliteration?: string;
  pronunciationEn?: string;
  pronunciationHi?: string;
  pronunciationUr?: string;
  translations: Record<Language, DuaTranslation>;
}

interface AdminContentDuaRow {
  id: string;
  slug?: string | null;
  title: string | null;
  title_en: string | null;
  title_hi: string | null;
  title_ur: string | null;
  content: string | null;
  content_arabic: string | null;
  content_en: string | null;
  content_hi: string | null;
  content_ur: string | null;
  content_pronunciation: string | null;
  content_pronunciation_en?: string | null;
  content_pronunciation_hi?: string | null;
  content_pronunciation_ur?: string | null;
  category: string | null;
}


const DuaPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [language, setLanguage] = useState<Language>("bengali");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDua, setSelectedDua] = useState<Dua | null>(null);
  const [duas, setDuas] = useState<Dua[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryParam = searchParams.get("category");
  const duaParam = searchParams.get("dua");

  useEffect(() => {
    const fetchDuas = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("admin_content")
        .select("*")
        .eq("status", "published")
        .in("content_type", ["dua", "Dua"]) // Support both lowercase and capitalized types
        .order("published_at", { ascending: false });

      if (error) {
        console.error("Error loading duas", error);
        setError("Failed to load duas. Please try again.");
        setLoading(false);
        return;
      }

      const mapped: Dua[] = (data as unknown as AdminContentDuaRow[]).map((row) => ({
        id: row.id,
        slug: row.slug ?? null,
        arabic: row.content_arabic || "",
        bengaliTransliteration: row.content_pronunciation || undefined,
        pronunciationEn: row.content_pronunciation_en || undefined,
        pronunciationHi: row.content_pronunciation_hi || undefined,
        pronunciationUr: row.content_pronunciation_ur || undefined,
        translations: {
          bengali: {
            title: row.title || "দোয়া",
            category: row.category || "দোয়া",
            translation: row.content || "",
          },
          english: {
            title: row.title_en || row.title || "Dua",
            category: row.category || "Dua",
            translation: row.content_en || row.content || "",
          },
          hindi: {
            title: row.title_hi || row.title || "दुआ",
            category: row.category || "दुआ",
            translation: row.content_hi || row.content || "",
          },
          urdu: {
            title: row.title_ur || row.title || "دعا",
            category: row.category || "دعا",
            translation: row.content_ur || row.content || "",
          },
        },
      }));

      setDuas(mapped);
      setLoading(false);
    };

    fetchDuas();
  }, []);

  // Sync UI state from URL (enables step-by-step browser back)
  useEffect(() => {
    // Category from URL
    setSelectedCategory(categoryParam || null);

    // Dua from URL (wait until data exists)
    if (duaParam) {
      const found = duas.find((d) => d.id === duaParam) ?? null;
      setSelectedDua(found);
    } else {
      setSelectedDua(null);
    }
    // Intentionally depends on `duas` (so it resolves after fetch)
  }, [categoryParam, duaParam, duas]);

  const categories = useMemo(
    () => [...new Set(duas.map((d) => d.translations.english.category))],
    [duas]
  );

  const filteredDuas = useMemo(() => {
    return duas.filter((dua) => {
    const translation = dua.translations[language];
    const matchesSearch =
      translation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dua.bengaliTransliteration || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dua.pronunciationEn || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dua.pronunciationHi || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dua.pronunciationUr || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      translation.translation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || translation.category === selectedCategory;
    return matchesSearch && matchesCategory;
    });
  }, [duas, language, searchQuery, selectedCategory]);

  const pushCategory = (cat: string) => {
    setSearchParams({ category: cat }, { replace: false });
  };

  const pushDua = (duaId: string) => {
    const cat = selectedCategory || categoryParam || "";
    const next: Record<string, string> = {};
    if (cat) next.category = cat;
    next.dua = duaId;
    setSearchParams(next, { replace: false });
  };

  const handleBack = () => {
    // Let router history unwind (dua -> category -> list -> previous route)
    navigate(-1);
  };

  const getTitle = () => {
    if (selectedDua) return selectedDua.translations[language].title;
    if (selectedCategory) return selectedCategory;
    return language === "bengali" ? "দোয়া সংকলন" : 
           language === "hindi" ? "दुआ संग्रह" : 
           language === "urdu" ? "دعا مجموعہ" : "Dua Collection";
  };

  return (
    <div className="min-h-screen bg-[hsl(158,64%,18%)]">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 bg-gradient-to-b from-[hsl(158,55%,22%)] to-[hsl(158,55%,22%)]/95 backdrop-blur-lg border-b border-white/10"
      >
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(45,93%,58%)] to-[hsl(45,93%,48%)] flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[hsl(158,64%,15%)]" />
          </div>
          <h1 className="text-xl font-bold text-white">{getTitle()}</h1>
        </div>

        {/* Language Selector */}
        <div className="px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => {
                  setLanguage(lang);
                  // Reset drilldown when language changes (and keep history clean)
                  setSearchParams({}, { replace: true });
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  language === lang
                    ? "bg-gradient-to-r from-[hsl(45,93%,58%)] to-[hsl(45,93%,48%)] text-[hsl(158,64%,15%)] shadow-md"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                {LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>
        </div>
      </motion.header>

      {/* Web Ad Slot */}
      {!loading && !error && (
        <div className="px-4 pt-4">
          <AdSlot placement="web_dua_middle" />
        </div>
      )}

      {loading && (
        <div className="p-4 text-center text-white/70 text-sm">{UI_LABELS.loading[language]}</div>
      )}
      {error && (
        <div className="p-4 text-center text-red-300 text-sm">{UI_LABELS.errorMessage[language]}</div>
      )}

      <AnimatePresence mode="wait">
        {selectedDua ? (
          // Dua Detail View
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="p-4 space-y-6"
          >
            <div className="text-center space-y-6 py-6">
              {/* Arabic Text Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-gradient-to-br from-[hsl(158,55%,25%)] to-[hsl(158,64%,20%)] rounded-3xl p-6 border border-[hsl(45,93%,58%)]/20 shadow-lg overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[hsl(45,93%,58%)]/10 rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-[hsl(158,64%,30%)]/30 rounded-full blur-xl" />
                <div className="relative">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-[hsl(45,93%,58%)]" />
                    <span className="text-xs font-medium text-[hsl(45,93%,58%)]">
                      {SECTION_LABELS.arabic[language]}
                    </span>
                    <Sparkles className="w-4 h-4 text-[hsl(45,93%,58%)]" />
                  </div>
                  <p className="text-3xl md:text-4xl font-arabic leading-[2] text-white">
                    {selectedDua.arabic}
                  </p>
                </div>
              </motion.div>

              {/* Transliteration */}
              {(() => {
                const translitText =
                  language === "bengali"
                    ? selectedDua.bengaliTransliteration
                    : language === "english"
                    ? selectedDua.pronunciationEn
                    : language === "hindi"
                    ? selectedDua.pronunciationHi
                    : selectedDua.pronunciationUr;

                const fallbackText =
                  translitText ||
                  selectedDua.bengaliTransliteration ||
                  selectedDua.pronunciationEn ||
                  selectedDua.pronunciationHi ||
                  selectedDua.pronunciationUr;

                if (!fallbackText) return null;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="bg-white/5 rounded-2xl p-5 border border-white/10"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-[hsl(45,93%,58%)]" />
                      <p className="text-xs font-medium text-[hsl(45,93%,58%)]">
                        {SECTION_LABELS.transliteration[language]}
                      </p>
                    </div>
                    <p className="text-white/90 text-lg md:text-xl leading-relaxed">
                      {fallbackText}
                    </p>
                  </motion.div>
                );
              })()}

              {/* Translation */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-[hsl(45,93%,58%)]/10 to-transparent rounded-2xl p-5 border border-[hsl(45,93%,58%)]/20"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-4 h-4 text-[hsl(45,93%,58%)]" />
                  <p className="text-xs font-medium text-[hsl(45,93%,58%)]">
                    {SECTION_LABELS.translation[language]}
                  </p>
                </div>
                <p className="text-white text-lg md:text-xl leading-relaxed">
                  {selectedDua.translations[language].translation}
                </p>
              </motion.div>

              {/* Audio Player */}
              <DuaAudioPlayer 
                arabicText={selectedDua.arabic} 
                duaId={selectedDua.id} 
              />
            </div>
          </motion.div>
        ) : (
          // List View
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 space-y-4"
          >
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <Input
                placeholder={UI_LABELS.searchPlaceholder[language]}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 rounded-2xl bg-white/10 border-white/10 text-white placeholder:text-white/50 focus:border-[hsl(45,93%,58%)]/50"
              />
            </div>

            {/* Categories */}
            {!selectedCategory && (
              <>
                {/* Daily Dua — deterministic per calendar day */}
                {!searchQuery && (() => {
                  const slugged = duas.filter((d) => d.slug);
                  if (slugged.length === 0) return null;
                  const today = new Date();
                  const dayKey =
                    today.getFullYear() * 10000 +
                    (today.getMonth() + 1) * 100 +
                    today.getDate();
                  const daily = slugged[dayKey % slugged.length];
                  return (
                    <Link
                      to={`/dua/${daily.slug}`}
                      className="block p-4 rounded-2xl bg-gradient-to-br from-[hsl(45,93%,58%)]/20 to-[hsl(45,93%,48%)]/5 border border-[hsl(45,93%,58%)]/40 hover:border-[hsl(45,93%,58%)] transition"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-[hsl(45,93%,58%)]" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(45,93%,58%)]">
                          আজকের দোয়া
                        </span>
                      </div>
                      <p className="text-base font-bold text-white line-clamp-1">
                        {daily.translations[language].title}
                      </p>
                      <p
                        dir="rtl"
                        className="mt-2 text-sm text-white/80 font-arabic line-clamp-2 leading-loose"
                      >
                        {daily.arabic}
                      </p>
                      <p className="mt-2 text-xs text-[hsl(45,93%,58%)] font-medium">
                        📖 বিস্তারিত পড়ুন →
                      </p>
                    </Link>
                  );
                })()}

                {/* SEO category cards (link to dedicated /dua/category/:slug pages) */}
                {!searchQuery && categories.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {categories.slice(0, 6).map((cat) => (
                      <Link
                        key={`seo-cat-${cat}`}
                        to={`/dua/category/${slugifyCategory(cat)}`}
                        className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-[hsl(45,93%,58%)]/30 transition text-center"
                      >
                        <p className="text-sm font-semibold text-white">
                          {getCategoryLabel(cat, language)}
                        </p>
                        <p className="text-[11px] text-white/60 mt-0.5">
                          সব দোয়া দেখুন →
                        </p>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Featured Duas (4–6 items with slug) */}
                {!searchQuery && (
                  (() => {
                    const featured = duas.filter((d) => d.slug).slice(0, 6);
                    if (featured.length === 0) return null;
                    return (
                      <section className="space-y-2">
                        <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[hsl(45,93%,58%)]" />
                          নির্বাচিত দোয়া
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {featured.map((d) => (
                            <Link
                              key={`feat-${d.id}`}
                              to={`/dua/${d.slug}`}
                              className="p-3 rounded-2xl bg-gradient-to-br from-[hsl(158,55%,25%)] to-[hsl(158,64%,20%)] border border-white/10 hover:border-[hsl(45,93%,58%)]/40 transition"
                            >
                              <p className="text-sm font-semibold text-white line-clamp-1">
                                {d.translations[language].title}
                              </p>
                              <p className="text-xs text-white/60 line-clamp-1 mt-1 font-arabic">
                                {d.arabic}
                              </p>
                            </Link>
                          ))}
                        </div>
                      </section>
                    );
                  })()
                )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2 flex-wrap"
              >
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => pushCategory(cat)}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-white/10 text-white/80 hover:bg-[hsl(45,93%,58%)]/20 hover:text-[hsl(45,93%,58%)] transition-all border border-transparent hover:border-[hsl(45,93%,58%)]/30"
                  >
                    {getCategoryLabel(cat, language)}
                  </button>
                ))}
              </motion.div>
              </>
            )}

            {/* Dua List */}
            {!loading && !error && filteredDuas.length === 0 ? (
              <div className="py-8 text-center text-white/70 text-sm">
                {UI_LABELS.noDuasFound[language]}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDuas.map((dua, index) => (
                  <motion.button
                    key={dua.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => {
                      if (dua.slug) {
                        navigate(`/dua/${dua.slug}`);
                      } else {
                        pushDua(dua.id);
                      }
                    }}
                    className="w-full text-left p-4 rounded-2xl bg-gradient-to-br from-[hsl(158,55%,25%)] to-[hsl(158,64%,20%)] border border-white/10 hover:border-[hsl(45,93%,58%)]/30 transition-all active:scale-[0.98] group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[hsl(45,93%,58%)]/20 flex items-center justify-center text-xs font-bold text-[hsl(45,93%,58%)]">
                            {index + 1}
                          </span>
                          <p className="font-semibold text-white">{dua.translations[language].title}</p>
                        </div>
                        <p className="text-sm text-white/60 line-clamp-1 font-arabic">
                          {dua.arabic}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-[hsl(45,93%,58%)] transition-colors" />
                    </div>
                    {dua.slug && (
                      <span
                        role="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dua/${dua.slug}`);
                        }}
                        className="mt-3 inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[hsl(45,93%,58%)]/20 text-[hsl(45,93%,58%)] text-xs font-semibold hover:bg-[hsl(45,93%,58%)]/30 transition"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        📖 বিস্তারিত পড়ুন
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DuaPage;
