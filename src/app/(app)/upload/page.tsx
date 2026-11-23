import { requireContext } from "@/lib/workspace";
import { Card, CardContent } from "@/components/ui/card";
import { Uploader } from "@/components/upload/uploader";

export default async function UploadPage() {
  const ctx = await requireContext();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload a call</h1>
        <p className="text-sm text-slate-400">
          We&apos;ll transcribe it (English &amp; Hebrew, with speaker labels) and extract insights.
        </p>
      </div>
      <Card>
        <CardContent className="pt-5">
          <Uploader workspaceId={ctx.workspaceId} />
        </CardContent>
      </Card>
    </div>
  );
}
