import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AdSlot } from "@/components/ads/AdSlot";

interface DuaRow {
  id: string;
  slug: string | null;
  title: string | null;
  category: string | null;
  content_arabic: string | null;
  content: string | null;
}

const SITE_ORIGIN = "https://noorapp.in";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, "-")
    .replace(/(^-+|-+$)/g, "");

const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;

const DuaCategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [duas, setDuas] = useState<DuaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryName, setCategoryName] = useState<string>("");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("admin_content")
        .select("id, slug, title, category, content_arabic, content")
        .eq("status", "published")
        .in("content_type", ["dua", "Dua"])
        .order("order_index", { ascending: true });

      if (cancelled) return;
      const all = (data ?? []) as unknown as DuaRow[];
      const filtered = all.filter(
        (d) => d.category && slugify(d.category) === slug
      );
      setCategoryName(filtered[0]?.category ?? slug);
      setDuas(filtered);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const seo = useMemo(() => {
    const name = categoryName || slug || "দোয়া";
    const title = truncate(`${name} সম্পর্কিত দোয়া — অর্থ ও ফজিলত | Noor`, 60);
    const description = truncate(
      `${name} সম্পর্কিত সকল দোয়ার আরবি, বাংলা উচ্চারণ, অর্থ ও ফজিলত পড়ুন। সহীহ হাদিস ভিত্তিক ${name} দোয়ার সম্পূর্ণ সংকলন।`,
      155
    );
    return {
      title,
      description,
      url: `${SITE_ORIGIN}/dua/category/${slug}`,
    };
  }, [categoryName, slug]);

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: seo.title,
      description: seo.description,
      url: seo.url,
      inLanguage: "bn",
      hasPart: duas
        .filter((d) => d.slug)
        .map((d) => ({
          "@type": "Article",
          headline: d.title,
          url: `${SITE_ORIGIN}/dua/${d.slug}`,
        })),
    }),
    [seo, duas]
  );

  return (
    <div className="min-h-screen bg-[hsl(158,64%,18%)]">
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <link rel="canonical" href={seo.url} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:url" content={seo.url} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

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
          <h1 className="text-xl font-bold text-white truncate">
            {categoryName} দোয়া
          </h1>
        </div>
      </motion.header>

      <article className="p-4 max-w-3xl mx-auto pb-12 space-y-5">
        {/* Breadcrumb */}
        <nav className="text-xs text-white/60 flex items-center gap-1 flex-wrap">
          <Link to="/" className="hover:text-[hsl(45,93%,58%)]">
            হোম
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/dua" className="hover:text-[hsl(45,93%,58%)]">
            দোয়া
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span>{categoryName}</span>
        </nav>

        <header>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            {categoryName} সম্পর্কিত দোয়া
          </h1>
          <p className="mt-2 text-sm text-white/70">
            {duas.length} টি দোয়া — আরবি, বাংলা অর্থ ও ফজিলতসহ
          </p>
        </header>

        <AdSlot placement="web_dua_middle" />

        {loading ? (
          <p className="text-white/70 text-sm py-8 text-center">লোড হচ্ছে...</p>
        ) : duas.length === 0 ? (
          <p className="text-white/70 text-sm py-8 text-center">
            এই বিভাগে কোনো দোয়া পাওয়া যায়নি।
          </p>
        ) : (
          <div className="space-y-3">
            {duas.map((d, i) => (
              <article
                key={d.id}
                className="p-4 rounded-2xl bg-gradient-to-br from-[hsl(158,55%,25%)] to-[hsl(158,64%,20%)] border border-white/10"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-[hsl(45,93%,58%)]/20 flex items-center justify-center text-xs font-bold text-[hsl(45,93%,58%)]">
                    {i + 1}
                  </span>
                  <h2 className="font-semibold text-white">{d.title}</h2>
                </div>
                {d.content_arabic && (
                  <p
                    dir="rtl"
                    className="text-white/80 font-arabic text-lg leading-loose line-clamp-2 mb-2"
                  >
                    {d.content_arabic}
                  </p>
                )}
                {d.content && (
                  <p className="text-sm text-white/70 line-clamp-2 mb-3">
                    {d.content}
                  </p>
                )}
                {d.slug ? (
                  <Link
                    to={`/dua/${d.slug}`}
                    className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[hsl(45,93%,58%)]/20 text-[hsl(45,93%,58%)] text-xs font-semibold hover:bg-[hsl(45,93%,58%)]/30 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    📖 বিস্তারিত পড়ুন
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </article>
    </div>
  );
};

export default DuaCategoryPage;