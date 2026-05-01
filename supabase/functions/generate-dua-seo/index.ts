import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = [
  "তুমি একজন ইসলামিক স্কলার এবং বাংলা SEO কন্টেন্ট লেখক।",
  "প্রতিটি দোয়ার জন্য সহজ, প্রাঞ্জল বাংলায় ব্যাখ্যা ও ফজিলত লিখবে।",
  "explanation_bn: ১০০–১৫০ শব্দ, সহজ বাংলা; দোয়ার অর্থ, প্রেক্ষাপট ও বাস্তব শিক্ষা ব্যাখ্যা করো।",
  "স্বাভাবিকভাবে অন্তত একবার এই phrase গুলোর কোনো একটি ব্যবহার করো: \"এই দোয়ার ফজিলত\", \"আমরা শিখি\", \"ইসলামে শিক্ষা\"।",
  "benefits_bn: ৩–৫টি ছোট bullet point, প্রতিটি ৬–১৫ শব্দ; দোয়ার আধ্যাত্মিক ও ব্যবহারিক উপকার।",
  "প্রতিটি দোয়ার জন্য কন্টেন্ট unique হতে হবে।",
  "শুধু tool call এর মাধ্যমে structured output দাও, free text নয়।",
].join("\n");

async function generateForDua(args: {
  title: string | null;
  arabic: string | null;
  bengali: string | null;
  category: string | null;
}) {
  const userText = `দোয়ার নাম: ${args.title || "(নাম নেই)"}\nবিভাগ: ${args.category || "সাধারণ"}\n\nআরবি:\n${args.arabic || "(আরবি নেই)"}\n\nবাংলা অর্থ:\n${args.bengali || "(অনুবাদ নেই, আরবি থেকে বের করো)"}\n\nএই দোয়ার জন্য বাংলা explanation_bn ও benefits_bn তৈরি করো।`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_dua_seo",
            description: "Save the Bengali SEO explanation and benefits for a dua.",
            parameters: {
              type: "object",
              properties: {
                explanation_bn: { type: "string" },
                benefits_bn: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 5,
                },
              },
              required: ["explanation_bn", "benefits_bn"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_dua_seo" } },
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error(`AI ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("no tool call returned");
  const parsed = JSON.parse(call.function.arguments);
  if (!parsed.explanation_bn || !Array.isArray(parsed.benefits_bn)) {
    throw new Error("invalid tool args");
  }
  return {
    explanation_bn: String(parsed.explanation_bn).trim(),
    benefits_bn: parsed.benefits_bn.map((s: any) => String(s).trim()).filter(Boolean),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "process";
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (action === "stats") {
      const { count: total } = await supabase
        .from("admin_content")
        .select("*", { count: "exact", head: true })
        .in("content_type", ["dua", "Dua"]);
      const { count: pending } = await supabase
        .from("admin_content")
        .select("*", { count: "exact", head: true })
        .in("content_type", ["dua", "Dua"])
        .or("explanation_bn.is.null,benefits_bn.is.null");
      return new Response(
        JSON.stringify({ total: total ?? 0, pending: pending ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const batchSize = Math.min(Math.max(Number(body.batchSize) || 10, 1), 20);

    const { data: rows, error } = await supabase
      .from("admin_content")
      .select("id, title, category, content_arabic, content, explanation_bn, benefits_bn")
      .in("content_type", ["dua", "Dua"])
      .or("explanation_bn.is.null,benefits_bn.is.null")
      .limit(batchSize);

    if (error) throw error;
    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, failed: 0, pending: 0, done: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    const concurrency = 3;
    for (let i = 0; i < rows.length; i += concurrency) {
      const slice = rows.slice(i, i + concurrency);
      await Promise.all(
        slice.map(async (d: any) => {
          try {
            const out = await generateForDua({
              title: d.title,
              arabic: d.content_arabic,
              bengali: d.content,
              category: d.category,
            });
            const update: Record<string, unknown> = {};
            if (!d.explanation_bn) update.explanation_bn = out.explanation_bn;
            if (!d.benefits_bn || d.benefits_bn.length === 0)
              update.benefits_bn = out.benefits_bn;
            if (Object.keys(update).length === 0) return;
            const { error: upErr } = await supabase
              .from("admin_content")
              .update(update)
              .eq("id", d.id);
            if (upErr) throw upErr;
            processed++;
          } catch (e) {
            failed++;
            errors.push(`${d.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }),
      );
    }

    const { count: pending } = await supabase
      .from("admin_content")
      .select("*", { count: "exact", head: true })
      .in("content_type", ["dua", "Dua"])
      .or("explanation_bn.is.null,benefits_bn.is.null");

    return new Response(
      JSON.stringify({
        processed,
        failed,
        errors: errors.slice(0, 5),
        pending: pending ?? 0,
        done: (pending ?? 0) === 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-dua-seo error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});