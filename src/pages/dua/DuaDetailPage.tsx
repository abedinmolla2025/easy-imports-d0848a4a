import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, BookOpen, Sparkles, Heart, Star, Clock, ScrollText, ChevronRight, ChevronLeft, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import DuaAudioPlayer from "@/components/DuaAudioPlayer";
import { AdSlot } from "@/components/ads/AdSlot";
import { useToast } from "@/hooks/use-toast";

interface DuaRow {
  id: string;
  slug: string | null;
  title: string | null;
  title_en: string | null;
  category: string | null;
  content_arabic: string | null;
  content_pronunciation: string | null;
  content: string | null;
  explanation_bn: string | null;
  benefits_bn: string[] | null;
  when_to_recite_bn: string | null;
  hadith_reference: string | null;
}

const SITE_ORIGIN = "https://noorapp.in";
const FALLBACK_OG = `${SITE_ORIGIN}/og-dua.png`;

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

const slugifyCategory = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, "-")
    .replace(/(^-+|-+$)/g, "");

type NavSibling = { slug: string; title: string };

const DuaDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dua, setDua] = useState<DuaRow | null>(null);
  const [related, setRelated] = useState<DuaRow[]>([]);
  const [prevDua, setPrevDua] = useState<NavSibling | null>(null);
  const [nextDua, setNextDua] = useState<NavSibling | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const { data, error } = await supabase
        .from("admin_content")
        .select(
          "id, slug, title, title_en, category, content_arabic, content_pronunciation, content, explanation_bn, benefits_bn, when_to_recite_bn, hadith_reference"
        )
        .eq("slug", slug)
        .eq("status", "published")
        .in("content_type", ["dua", "Dua"])
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setDua(data as unknown as DuaRow);

      // Related: same category, exclude self
      const cat = (data as any).category;
      if (cat) {
        const { data: rel } = await supabase
          .from("admin_content")
          .select("id, slug, title, title_en, category, content_arabic, content_pronunciation, content, explanation_bn, benefits_bn, when_to_recite_bn, hadith_reference")
          .eq("category", cat)
          .eq("status", "published")
          .in("content_type", ["dua", "Dua"])
          .neq("id", (data as any).id)
          .not("slug", "is", null)
          .limit(5);
        if (!cancelled && rel) setRelated(rel as unknown as DuaRow[]);
      }

      // Prev/Next siblings ordered by created_at across all duas with slug
      const { data: siblings } = await supabase
        .from("admin_content")
        .select("id, slug, title")
        .eq("status", "published")
        .in("content_type", ["dua", "Dua"])
        .not("slug", "is", null)
        .order("created_at", { ascending: true });
      if (!cancelled && siblings) {
        const list = siblings as Array<{ id: string; slug: string | null; title: string | null }>;
        const idx = list.findIndex((s) => s.id === (data as any).id);
        if (idx >= 0) {
          const p = list[idx - 1];
          const n = list[idx + 1];
          setPrevDua(p?.slug ? { slug: p.slug, title: p.title || "পূর্ববর্তী দোয়া" } : null);
          setNextDua(n?.slug ? { slug: n.slug, title: n.title || "পরবর্তী দোয়া" } : null);
        }
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const seo = useMemo(() => {
    if (!dua) return null;
    const baseTitle = dua.title || "দোয়া";
    // Format: "{Dua Name} Bangla Meaning, Benefits, Arabic Text"
    const title = truncate(
      `${baseTitle} — বাংলা অর্থ, ফজিলত ও আরবি টেক্সট | Noor`,
      60,
    );
    const description = truncate(
      dua.explanation_bn?.replace(/\s+/g, " ").trim() ||
        dua.content?.replace(/\s+/g, " ").trim() ||
        `${dua.title} এর আরবি, বাংলা উচ্চারণ, অর্থ ও ফজিলত পড়ুন।`,
      150
    );
    const url = `${SITE_ORIGIN}/dua/${dua.slug}`;
    return { title, description, url };
  }, [dua]);

  const handleShare = async () => {
    if (!dua || !seo) return;
    const shareData = {
      title: dua.title || "দোয়া",
      text: seo.description,
      url: seo.url,
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(seo.url);
        toast({ title: "লিংক কপি হয়েছে", description: seo.url });
      }
    } catch {
      // user cancelled — ignore
    }
  };

  const jsonLd = useMemo(() => {
    if (!dua) return null;
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: dua.title || "দোয়া",
      inLanguage: "bn",
      mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_ORIGIN}/dua/${dua.slug}` },
      description: seo?.description,
      image: FALLBACK_OG,
      author: { "@type": "Organization", name: "Noor" },
      publisher: {
        "@type": "Organization",
        name: "Noor",
        logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/logo.png` },
      },
    };
  }, [dua, seo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(158,64%,18%)] grid place-items-center">
        <p className="text-white/70 text-sm">দোয়া লোড হচ্ছে...</p>
      </div>
    );
  }

  if (notFound || !dua) {
    return (
      <div className="min-h-screen bg-[hsl(158,64%,18%)] flex flex-col items-center justify-center p-6 text-center">
        <Helmet><meta name="robots" content="noindex" /></Helmet>
        <p className="text-white text-lg mb-4">এই দোয়াটি খুঁজে পাওয়া যায়নি।</p>
        <Link to="/dua" className="px-4 py-2 rounded-full bg-[hsl(45,93%,58%)] text-[hsl(158,64%,15%)] font-medium">
          সব দোয়া দেখুন
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(158,64%,18%)]">
      {seo && (
        <Helmet>
          <title>{seo.title}</title>
          <meta name="description" content={seo.description} />
          <link rel="canonical" href={seo.url} />
          <meta property="og:type" content="article" />
          <meta property="og:title" content={seo.title} />
          <meta property="og:description" content={seo.description} />
          <meta property="og:url" content={seo.url} />
          <meta property="og:image" content={FALLBACK_OG} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={seo.title} />
          <meta name="twitter:description" content={seo.description} />
          <meta name="twitter:image" content={FALLBACK_OG} />
          {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
        </Helmet>
      )}

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 bg-gradient-to-b from-[hsl(158,55%,22%)] to-[hsl(158,55%,22%)]/95 backdrop-blur-lg border-b border-white/10"
      >
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(45,93%,58%)] to-[hsl(45,93%,48%)] flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[hsl(158,64%,15%)]" />
          </div>
          <h1 className="text-xl font-bold text-white truncate">{dua.title}</h1>
        </div>
      </motion.header>

      <article className="p-4 space-y-6 max-w-3xl mx-auto pb-12">
        {/* Breadcrumb */}
        <nav className="text-xs text-white/60 flex items-center gap-1 flex-wrap">
          <Link to="/" className="hover:text-[hsl(45,93%,58%)]">হোম</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/dua" className="hover:text-[hsl(45,93%,58%)]">দোয়া</Link>
          {dua.category && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link
                to={`/dua/category/${slugifyCategory(dua.category)}`}
                className="hover:text-[hsl(45,93%,58%)]"
              >
                {dua.category}
              </Link>
            </>
          )}
        </nav>

        {/* H1 */}
        <header>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight flex-1">
              {dua.title}
            </h1>
            <button
              onClick={handleShare}
              aria-label="Share"
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-[hsl(45,93%,58%)]/20 text-[hsl(45,93%,58%)] text-xs font-semibold hover:bg-[hsl(45,93%,58%)]/30 transition"
            >
              <Share2 className="w-3.5 h-3.5" /> শেয়ার
            </button>
          </div>
          {dua.category && (
            <Link
              to={`/dua/category/${slugifyCategory(dua.category)}`}
              className="mt-2 inline-block text-sm text-[hsl(45,93%,58%)] hover:underline"
            >
              বিভাগ: {dua.category} →
            </Link>
          )}
        </header>

        {/* Arabic */}
        {dua.content_arabic && (
          <section className="relative bg-gradient-to-br from-[hsl(158,55%,25%)] to-[hsl(158,64%,20%)] rounded-3xl p-6 border border-[hsl(45,93%,58%)]/20 shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[hsl(45,93%,58%)]/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-[hsl(45,93%,58%)]" />
                <h2 className="text-xs font-medium text-[hsl(45,93%,58%)] uppercase tracking-wide">আরবি</h2>
                <Sparkles className="w-4 h-4 text-[hsl(45,93%,58%)]" />
              </div>
              <p dir="rtl" className="text-3xl md:text-4xl font-arabic leading-[2] text-white text-center">
                {dua.content_arabic}
              </p>
            </div>
          </section>
        )}

        {/* Pronunciation */}
        {dua.content_pronunciation && (
          <section className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <h2 className="flex items-center gap-2 text-xs font-medium text-[hsl(45,93%,58%)] uppercase tracking-wide mb-3">
              <Sparkles className="w-4 h-4" /> বাংলা উচ্চারণ
            </h2>
            <p className="text-white/90 text-lg leading-relaxed">{dua.content_pronunciation}</p>
          </section>
        )}

        {/* Meaning */}
        {dua.content && (
          <section className="bg-gradient-to-br from-[hsl(45,93%,58%)]/10 to-transparent rounded-2xl p-5 border border-[hsl(45,93%,58%)]/20">
            <h2 className="flex items-center gap-2 text-xs font-medium text-[hsl(45,93%,58%)] uppercase tracking-wide mb-3">
              <Heart className="w-4 h-4" /> অর্থ
            </h2>
            <p className="text-white text-lg leading-relaxed">{dua.content}</p>
          </section>
        )}

        {/* Audio */}
        {dua.content_arabic && (
          <DuaAudioPlayer arabicText={dua.content_arabic} duaId={dua.id} />
        )}

        <AdSlot placement="web_dua_middle" />

        {/* Explanation */}
        {dua.explanation_bn && (
          <section className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white mb-3">
              <ScrollText className="w-5 h-5 text-[hsl(45,93%,58%)]" /> বিস্তারিত ব্যাখ্যা
            </h2>
            <div className="text-white/85 leading-relaxed whitespace-pre-line">{dua.explanation_bn}</div>
          </section>
        )}

        {/* Benefits */}
        {dua.benefits_bn && dua.benefits_bn.length > 0 && (
          <section className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white mb-3">
              <Star className="w-5 h-5 text-[hsl(45,93%,58%)]" /> ফজিলত
            </h2>
            <ul className="space-y-2 text-white/85">
              {dua.benefits_bn.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[hsl(45,93%,58%)] mt-1">•</span>
                  <span className="leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* When to recite */}
        {dua.when_to_recite_bn && (
          <section className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white mb-3">
              <Clock className="w-5 h-5 text-[hsl(45,93%,58%)]" /> কখন পড়তে হয়
            </h2>
            <p className="text-white/85 leading-relaxed whitespace-pre-line">{dua.when_to_recite_bn}</p>
          </section>
        )}

        {/* Hadith reference */}
        {dua.hadith_reference && (
          <section className="bg-[hsl(45,93%,58%)]/10 rounded-2xl p-5 border border-[hsl(45,93%,58%)]/30">
            <h2 className="text-xs font-medium text-[hsl(45,93%,58%)] uppercase tracking-wide mb-2">হাদিস রেফারেন্স</h2>
            <p className="text-white/90 italic leading-relaxed">{dua.hadith_reference}</p>
          </section>
        )}

        {/* Related Duas */}
        {related.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-white mb-3">সম্পর্কিত দোয়া</h2>
            <div className="space-y-2">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/dua/${r.slug}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-br from-[hsl(158,55%,25%)] to-[hsl(158,64%,20%)] border border-white/10 hover:border-[hsl(45,93%,58%)]/30 transition"
                >
                  <span className="text-white font-medium">{r.title}</span>
                  <ChevronRight className="w-4 h-4 text-white/50" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Prev / Next nav */}
        {(prevDua || nextDua) && (
          <nav className="grid grid-cols-2 gap-3 pt-2" aria-label="দোয়া navigation">
            {prevDua ? (
              <Link
                to={`/dua/${prevDua.slug}`}
                className="flex items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-[hsl(45,93%,58%)]/30 transition"
              >
                <ChevronLeft className="w-4 h-4 text-[hsl(45,93%,58%)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">পূর্ববর্তী</p>
                  <p className="text-sm text-white truncate">{prevDua.title}</p>
                </div>
              </Link>
            ) : <div />}
            {nextDua ? (
              <Link
                to={`/dua/${nextDua.slug}`}
                className="flex items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-[hsl(45,93%,58%)]/30 transition text-right"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">পরবর্তী</p>
                  <p className="text-sm text-white truncate">{nextDua.title}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[hsl(45,93%,58%)] shrink-0" />
              </Link>
            ) : <div />}
          </nav>
        )}

        <div className="pt-4 text-center">
          <Link to="/dua" className="inline-flex items-center gap-2 text-sm text-[hsl(45,93%,58%)] hover:underline">
            ← সব দোয়া দেখুন
          </Link>
        </div>
      </article>
    </div>
  );
};

export default DuaDetailPage;
