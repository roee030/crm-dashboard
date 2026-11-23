import { Badge } from "@/components/ui/badge";
import type { CallStatus } from "@/types/db";

const map: Record<CallStatus, { tone: "neutral" | "info" | "positive" | "negative" | "warning"; label: string }> = {
  uploaded: { tone: "neutral", label: "Uploaded" },
  transcribing: { tone: "info", label: "Transcribing" },
  transcribed: { tone: "info", label: "Transcribed" },
  analyzing: { tone: "warning", label: "Analyzing" },
  completed: { tone: "positive", label: "Completed" },
  failed: { tone: "negative", label: "Failed" },
};

export function StatusBadge({ status }: { status: CallStatus }) {
  const s = map[status] ?? map.uploaded;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
