import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BATCH_SIZE = 10;

type Stats = { total: number; pending: number };

export default function DuaSeoGeneratorPanel() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [processedTotal, setProcessedTotal] = useState(0);
  const [failedTotal, setFailedTotal] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const stopRef = useRef(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("generate-dua-seo", {
      body: { action: "stats" },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Stats লোড করা যায়নি", description: error.message, variant: "destructive" });
      return;
    }
    setStats(data as Stats);
  }, [toast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const start = useCallback(async () => {
    if (running) return;
    stopRef.current = false;
    setRunning(true);
    setProcessedTotal(0);
    setFailedTotal(0);
    setErrors([]);

    let pending = stats?.pending ?? Infinity;
    let totalSoFar = 0;
    let failSoFar = 0;

    while (!stopRef.current && pending > 0) {
      const { data, error } = await supabase.functions.invoke("generate-dua-seo", {
        body: { action: "process", batchSize: BATCH_SIZE },
      });
      if (error) {
        toast({ title: "Generation error", description: error.message, variant: "destructive" });
        break;
      }
      const res = data as { processed: number; failed: number; errors?: string[]; pending: number; done: boolean };
      totalSoFar += res.processed;
      failSoFar += res.failed;
      setProcessedTotal(totalSoFar);
      setFailedTotal(failSoFar);
      if (res.errors?.length) {
        setErrors((prev) => [...res.errors!, ...prev].slice(0, 20));
      }
      pending = res.pending;
      setStats((s) => (s ? { ...s, pending } : s));
      if (res.done) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    setRunning(false);
    toast({
      title: stopRef.current ? "থামানো হয়েছে" : "সম্পন্ন",
      description: `${totalSoFar} টি দোয়ায় SEO content যোগ হয়েছে। ${failSoFar} টি ব্যর্থ।`,
    });
    loadStats();
  }, [running, stats, toast, loadStats]);

  const stop = useCallback(() => {
    stopRef.current = true;
  }, []);

  const total = stats?.total ?? 0;
  const pending = stats?.pending ?? 0;
  const completed = total - pending;
  const overallPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Generate SEO Content (Bengali)
        </CardTitle>
        <CardDescription>
          প্রতিটি দোয়ার জন্য AI দিয়ে বাংলা <code>explanation_bn</code> (১০০–১৫০ শব্দ) ও <code>benefits_bn</code> (৩–৫ পয়েন্ট) তৈরি করো।
          বিদ্যমান কন্টেন্ট overwrite হবে না। Batch size: {BATCH_SIZE}।
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{total}</p>
            <p className="text-xs text-muted-foreground">মোট দোয়া</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{completed}</p>
            <p className="text-xs text-muted-foreground">SEO সম্পন্ন</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{pending}</p>
            <p className="text-xs text-muted-foreground">বাকি আছে</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Overall Progress</span>
            <span>{overallPct}%</span>
          </div>
          <Progress value={overallPct} className="h-2" />
        </div>

        {running && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>
              এই সেশনে: <strong>{processedTotal}</strong> সফল, <strong>{failedTotal}</strong> ব্যর্থ।
            </span>
          </div>
        )}

        {!running && processedTotal + failedTotal > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>
              শেষ সেশন: <strong>{processedTotal}</strong> সফল, <strong>{failedTotal}</strong> ব্যর্থ।
            </span>
          </div>
        )}

        {errors.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Error log ({errors.length})
            </summary>
            <ul className="mt-2 max-h-40 overflow-y-auto space-y-1 rounded border p-2">
              {errors.map((e, i) => (
                <li key={i} className="text-muted-foreground break-all">{e}</li>
              ))}
            </ul>
          </details>
        )}

        <div className="flex gap-2">
          {!running ? (
            <Button onClick={start} disabled={loading || pending === 0} className="flex-1">
              <Sparkles className="mr-2 h-4 w-4" />
              {pending === 0 ? "সব দোয়ার SEO content তৈরি হয়ে গেছে" : `Generate SEO Content (${pending} বাকি)`}
            </Button>
          ) : (
            <Button onClick={stop} variant="destructive" className="flex-1">
              <Square className="mr-2 h-4 w-4" /> থামাও
            </Button>
          )}
          <Button onClick={loadStats} variant="outline" disabled={loading || running}>
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}