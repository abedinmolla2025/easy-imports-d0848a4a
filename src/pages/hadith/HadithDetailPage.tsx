import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ScrollText,
  Lightbulb,
  Languages,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdSlot } from "@/components/ads/AdSlot";

interface HadithRow {
  id: string;
  slug: string | null;
  book_key: string;
  chapter_id: number;
  hadith_number: number;
  arabic: string;
  bengali: string | null;
  english: string | null;
  urdu: string | null;
  topic_bn: string | null;
  explanation_bn: string | null;
  lessons_bn: string[] | null;
}

const SITE_ORIGIN = "https://noorapp.in";
const FALLBACK_OG = `${SITE_ORIGIN}/og-hadith.png`;

const BOOK_LABEL_BN: Record<string, string> = {
  bukhari: "সহীহ বুখারী",
  muslim: "সহীহ মুসলিম",
  abudawud: "সুনান আবু দাউদ",
  tirmidhi: "জামি‘ আত-তিরমিযি",
  nasai: "সুনান নাসায়ী",
  ibnmajah: "সুনান ইবনে মাজাহ",
};

const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;

const HadithDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [hadith, setHadith] = useState<HadithRow | null>(null);
  const [related, setRelated] = useState<HadithRow[]>([]);
  const [prevHadith, setPrevHadith] = useState<HadithRow | null>(null);
  const [nextHadith, setNextHadith] = useState<HadithRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const { data, error } = await supabase
        .from("hadiths")
        .select(
          "id, slug, book_key, chapter_id, hadith_number, arabic, bengali, english, urdu, topic_bn, explanation_bn, lessons_bn",
        )
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setHadith(data as unknown as HadithRow);

      // Related: same book, neighboring numbers
      const { data: rel } = await supabase
        .from("hadiths")
        .select(
          "id, slug, book_key, chapter_id, hadith_number, arabic, bengali, english, urdu, topic_bn, explanation_bn, lessons_bn",
        )
        .eq("book_key", (data as any).book_key)
        .neq("id", (data as any).id)
        .not("slug", "is", null)
        .order("hadith_number", { ascending: true })
        .gte("hadith_number", Math.max(0, (data as any).hadith_number - 3))
        .lte("hadith_number", (data as any).hadith_number + 3)
        .limit(6);
      if (!cancelled && rel) setRelated(rel as unknown as HadithRow[]);

      // Prev / Next navigation (same book)
      const [{ data: prev }, { data: next }] = await Promise.all([
        supabase
          .from("hadiths")
          .select("id, slug, book_key, chapter_id, hadith_number, arabic, bengali, english, urdu, topic_bn, explanation_bn, lessons_bn")
          .eq("book_key", (data as any).book_key)
          .lt("hadith_number", (data as any).hadith_number)
          .not("slug", "is", null)
          .order("hadith_number", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("hadiths")
          .select("id, slug, book_key, chapter_id, hadith_number, arabic, bengali, english, urdu, topic_bn, explanation_bn, lessons_bn")
          .eq("book_key", (data as any).book_key)
          .gt("hadith_number", (data as any).hadith_number)
          .not("slug", "is", null)
          .order("hadith_number", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!cancelled) {
        setPrevHadith((prev as unknown as HadithRow) ?? null);
        setNextHadith((next as unknown as HadithRow) ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const bookLabel = hadith ? BOOK_LABEL_BN[hadith.book_key] ?? hadith.book_key : "";

  const heading = useMemo(() => {
    if (!hadith) return "";
    const topic = hadith.topic_bn?.trim();
    return topic
      ? `${topic} — ${bookLabel} হাদিস ${hadith.hadith_number}`
      : `${bookLabel} হাদিস ${hadith.hadith_number}`;
  }, [hadith, bookLabel]);

  const seo = useMemo(() => {
    if (!hadith) return null;
    const title = truncate(`${heading} | অর্থ ও ব্যাখ্যা — Noor`, 60);
    const baseDesc =
      hadith.explanation_bn?.replace(/\s+/g, " ").trim() ||
      hadith.bengali?.replace(/\s+/g, " ").trim() ||
      `${bookLabel} হাদিস নং ${hadith.hadith_number} এর আরবি, বাংলা অনুবাদ ও বিস্তারিত ব্যাখ্যা।`;
    const description = truncate(baseDesc, 150);
    const url = `${SITE_ORIGIN}/hadith/h/${hadith.slug}`;
    return { title, description, url };
  }, [hadith, heading, bookLabel]);

  const jsonLd = useMemo(() => {
    if (!hadith || !seo) return null;
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: heading,
      inLanguage: "bn",
      mainEntityOfPage: { "@type": "WebPage", "@id": seo.url },
      description: seo.description,
      image: FALLBACK_OG,
      author: { "@type": "Organization", name: "Noor" },
      publisher: {
        "@type": "Organization",
        name: "Noor",
        logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/logo.png` },
      },
      isPartOf: { "@type": "Book", name: bookLabel },
    };
  }, [hadith, seo, heading, bookLabel]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <p className="text-muted-foreground text-sm">হাদিস লোড হচ্ছে...</p>
      </div>
    );
  }

  if (notFound || !hadith) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Helmet>
          <meta name="robots" content="noindex" />
        </Helmet>
        <p className="text-foreground text-lg mb-4">এই হাদিসটি খুঁজে পাওয়া যায়নি।</p>
        <Link
          to="/hadith"
          className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium"
        >
          সব হাদিস দেখুন
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
          <meta property="og:locale" content="bn_BD" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={seo.title} />
          <meta name="twitter:description" content={seo.description} />
          <meta name="twitter:image" content={FALLBACK_OG} />
          {jsonLd && (
            <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
          )}
        </Helmet>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground truncate">
            {bookLabel} • হাদিস {hadith.hadith_number}
          </p>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-6 space-y-8 pb-16">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap"
        >
          <Link to="/" className="hover:text-primary">হোম</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/hadith" className="hover:text-primary">হাদিস</Link>
          <ChevronRight className="w-3 h-3" />
          <Link
            to={`/hadith/sahih-${hadith.book_key}/bn`}
            className="hover:text-primary"
          >
            {bookLabel}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span>হাদিস {hadith.hadith_number}</span>
        </nav>

        {/* H1 */}
        <header className="space-y-2">
          <p className="text-xs font-medium text-primary uppercase tracking-wide">
            {bookLabel} • অধ্যায় {hadith.chapter_id}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
            {heading}
          </h1>
          {seo && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {seo.description}
            </p>
          )}
        </header>

        {/* Arabic */}
        <section
          className="rounded-2xl p-6 border bg-card shadow-sm"
          aria-labelledby="arabic-heading"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2
              id="arabic-heading"
              className="text-xs font-medium text-primary uppercase tracking-wide"
            >
              আরবি
            </h2>
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <p
            dir="rtl"
            lang="ar"
            className="text-2xl md:text-3xl font-arabic leading-[2.2] text-foreground text-center"
          >
            {hadith.arabic}
          </p>
        </section>

        {/* Translation tabs */}
        <section aria-labelledby="translation-heading">
          <div className="flex items-center gap-2 mb-3">
            <Languages className="w-4 h-4 text-primary" />
            <h2
              id="translation-heading"
              className="text-base font-semibold text-foreground"
            >
              অনুবাদ
            </h2>
          </div>
          <Tabs defaultValue="bn" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="bn">বাংলা</TabsTrigger>
              <TabsTrigger value="en">English</TabsTrigger>
              <TabsTrigger value="ur">اردو</TabsTrigger>
            </TabsList>
            <TabsContent value="bn" className="mt-4">
              <div className="rounded-2xl p-5 bg-card border">
                {hadith.bengali ? (
                  <p
                    lang="bn"
                    className="text-foreground text-lg leading-relaxed whitespace-pre-line"
                  >
                    {hadith.bengali}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    বাংলা অনুবাদ এখনো যোগ করা হয়নি।
                  </p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="en" className="mt-4">
              <div className="rounded-2xl p-5 bg-card border">
                {hadith.english ? (
                  <p
                    lang="en"
                    className="text-foreground text-base leading-relaxed whitespace-pre-line"
                  >
                    {hadith.english}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    English translation not available yet.
                  </p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="ur" className="mt-4">
              <div className="rounded-2xl p-5 bg-card border">
                {hadith.urdu ? (
                  <p
                    dir="rtl"
                    lang="ur"
                    className="text-foreground text-lg leading-[2] whitespace-pre-line text-right"
                  >
                    {hadith.urdu}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm" dir="rtl">
                    اردو ترجمہ ابھی دستیاب نہیں ہے۔
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <AdSlot placement="web_hadith_middle" />

        {/* Bengali Explanation (primary SEO content) */}
        {hadith.explanation_bn && (
          <section
            aria-labelledby="explanation-heading"
            className="rounded-2xl p-5 bg-card border"
          >
            <h2
              id="explanation-heading"
              className="flex items-center gap-2 text-lg font-semibold text-foreground mb-3"
            >
              <ScrollText className="w-5 h-5 text-primary" /> বিস্তারিত ব্যাখ্যা
            </h2>
            <div
              lang="bn"
              className="text-foreground/90 leading-relaxed whitespace-pre-line text-base"
            >
              {hadith.explanation_bn}
            </div>
          </section>
        )}

        {/* Bengali Lessons */}
        {hadith.lessons_bn && hadith.lessons_bn.length > 0 && (
          <section
            aria-labelledby="lessons-heading"
            className="rounded-2xl p-5 bg-primary/5 border border-primary/20"
          >
            <h2
              id="lessons-heading"
              className="flex items-center gap-2 text-lg font-semibold text-foreground mb-3"
            >
              <Lightbulb className="w-5 h-5 text-primary" /> এই হাদিস থেকে শিক্ষা
            </h2>
            <ul lang="bn" className="space-y-2 text-foreground/90">
              {hadith.lessons_bn.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary mt-1 font-bold">{i + 1}.</span>
                  <span className="leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Reference */}
        <section className="rounded-2xl p-5 bg-muted/40 border">
          <h2 className="text-xs font-medium text-primary uppercase tracking-wide mb-2">
            রেফারেন্স
          </h2>
          <p className="text-foreground/90">
            {bookLabel}, হাদিস নং {hadith.hadith_number}, অধ্যায় {hadith.chapter_id}
          </p>
        </section>

        {/* Related */}
        {related.length > 0 && (
          <></>
        )}

        {/* Prev / Next navigation */}
        {(prevHadith || nextHadith) && (
          <nav
            aria-label="Hadith navigation"
            className="grid grid-cols-2 gap-3"
          >
            {prevHadith ? (
              <Link
                to={`/hadith/h/${prevHadith.slug}`}
                className="flex items-center gap-2 p-4 rounded-2xl bg-card border hover:border-primary/40 transition"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    আগের হাদিস
                  </div>
                  <div className="text-sm font-medium text-foreground truncate">
                    {bookLabel} {prevHadith.hadith_number}
                  </div>
                </div>
              </Link>
            ) : (
              <div />
            )}
            {nextHadith ? (
              <Link
                to={`/hadith/h/${nextHadith.slug}`}
                className="flex items-center justify-end gap-2 p-4 rounded-2xl bg-card border hover:border-primary/40 transition text-right"
              >
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    পরবর্তী হাদিস
                  </div>
                  <div className="text-sm font-medium text-foreground truncate">
                    {bookLabel} {nextHadith.hadith_number}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            ) : (
              <div />
            )}
          </nav>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section aria-labelledby="related-heading">
            <h2
              id="related-heading"
              className="text-base font-semibold text-foreground mb-3"
            >
              সম্পর্কিত হাদিস
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/hadith/h/${r.slug}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-card border hover:border-primary/40 transition"
                >
                  <span className="text-foreground font-medium text-sm">
                    {BOOK_LABEL_BN[r.book_key] ?? r.book_key} • হাদিস {r.hadith_number}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="pt-4 text-center">
          <Link
            to={`/hadith/sahih-${hadith.book_key}/bn`}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            ← {bookLabel} এর সব হাদিস
          </Link>
        </div>
      </article>
    </div>
  );
};

export default HadithDetailPage;