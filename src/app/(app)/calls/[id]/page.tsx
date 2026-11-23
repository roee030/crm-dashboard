import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireContext } from "@/lib/workspace";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusTracker } from "@/components/calls/status-tracker";
import { TranscriptViewer } from "@/components/calls/transcript-viewer";
import { InsightsCard } from "@/components/calls/insights-card";
import { AudioPlayer } from "@/components/calls/audio-player";
import { SyncCrmButton } from "@/components/calls/sync-crm-button";
import { SyncHistory, type SyncLog } from "@/components/calls/sync-history";
import { TalkRatio } from "@/components/calls/talk-ratio";
import { CoachPanel } from "@/components/calls/coach-panel";
import { DealHealthCard } from "@/components/calls/deal-health-card";
import { PlaybookScorecard } from "@/components/calls/playbook-scorecard";
import { computeTalkMetrics } from "@/lib/transcript-metrics";
import { coachingSchema } from "@/schemas/coaching";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Criterion } from "@/lib/playbooks/scoring";
import type { InsightRow, RiskFlagRow, Utterance } from "@/types/db";

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireContext();
  const supabase = await createServerSupabase();

  // RLS scopes this to the user's workspace automatically.
  const { data: call } = await supabase
    .from("calls")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!call) notFound();

  const [{ data: transcript }, { data: insight }, { data: syncLogs }] = await Promise.all([
    supabase.from("transcripts").select("*").eq("call_id", id).maybeSingle(),
    supabase.from("insights").select("*").eq("call_id", id).maybeSingle(),
    supabase
      .from("crm_sync_logs")
      .select("id, provider, status, external_ref, error, created_at")
      .eq("call_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Server-side signed URL for secure private-bucket playback.
  let audioSrc: string | null = null;
  if (call.audio_path) {
    const { data: signed } = await supabase.storage
      .from("call-audio")
      .createSignedUrl(call.audio_path, 3600);
    audioSrc = signed?.signedUrl ?? null;
  }

  // Active playbook (default first) for scorecard labels.
  const { data: playbook } = await supabase
    .from("playbooks")
    .select("name, criteria")
    .eq("workspace_id", call.workspace_id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const criteria = (playbook?.criteria ?? []) as Criterion[];

  const utterances = (transcript?.utterances ?? []) as Utterance[];
  const talkMetrics = computeTalkMetrics(utterances);
  const cachedCoaching = insight?.call_coaching
    ? coachingSchema.safeParse(insight.call_coaching)
    : null;
  const initialCoaching = cachedCoaching?.success ? cachedCoaching.data : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/calls" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" />
        Back to calls
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{call.title || "Untitled call"}</h1>
          <p className="text-sm text-slate-400">
            {call.customer_name || "—"} · {call.direction} · {formatDuration(call.duration_sec)} ·{" "}
            {formatDate(call.created_at)} · <span className="uppercase">{call.language || "?"}</span>
          </p>
        </div>
        <SyncCrmButton callId={call.id} />
      </div>

      <StatusTracker
        callId={call.id}
        initialStatus={call.status}
        initialError={call.error_message}
      />

      {insight && (
        <DealHealthCard
          callId={call.id}
          score={insight.deal_health_score}
          riskFlags={(insight.risk_flags ?? []) as RiskFlagRow[]}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Talk Ratio &amp; Speaker Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <TalkRatio metrics={talkMetrics} />
            </CardContent>
          </Card>

          {insight && criteria.length > 0 && (
            <PlaybookScorecard
              playbookName={playbook?.name ?? "Playbook"}
              criteria={criteria}
              results={(insight.playbook_results ?? {}) as Record<string, { score: number; evidence: string; coaching_tip: string }>}
            />
          )}

          <CoachPanel callId={call.id} initial={initialCoaching} />

          <Card>
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <TranscriptViewer utterances={utterances} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Audio</CardTitle>
            </CardHeader>
            <CardContent>
              <AudioPlayer src={audioSrc} />
            </CardContent>
          </Card>

          {insight ? (
            <InsightsCard insight={insight as InsightRow} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>AI Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">
                  Insights appear here once analysis completes.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>CRM Sync History</CardTitle>
            </CardHeader>
            <CardContent>
              <SyncHistory logs={(syncLogs ?? []) as SyncLog[]} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
