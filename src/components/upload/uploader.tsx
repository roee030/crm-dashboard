"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Uploader({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!file && !audioUrl.trim()) {
      setError("Drop an audio file or paste a public audio URL.");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("workspace_id", workspaceId);
      if (title) form.set("title", title);
      if (customer) form.set("customer_name", customer);
      if (file) form.set("file", file);
      else form.set("audio_url", audioUrl.trim());

      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Upload failed");
        setSubmitting(false);
        return;
      }
      router.push(`/calls/${json.call_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
          dragging
            ? "border-indigo-500 bg-indigo-500/5"
            : "border-slate-700 hover:border-slate-600 hover:bg-slate-900/40",
        )}
      >
        <UploadCloud className="h-8 w-8 text-slate-500" />
        {file ? (
          <div className="text-sm text-slate-200">{file.name}</div>
        ) : (
          <>
            <div className="text-sm font-medium text-slate-200">
              Drag &amp; drop an audio file
            </div>
            <div className="text-xs text-slate-500">MP3, WAV, M4A — or click to browse</div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <div className="h-px flex-1 bg-slate-800" />
        or paste a public URL
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <Input
        placeholder="https://example.com/call.mp3"
        value={audioUrl}
        onChange={(e) => setAudioUrl(e.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Call title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Customer name (optional)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
      </div>

      {error && (
        <p className="rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-400">{error}</p>
      )}

      <Button size="lg" onClick={submit} disabled={submitting} className="w-full sm:w-auto">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
        {submitting ? "Submitting…" : "Transcribe & analyze"}
      </Button>
    </div>
  );
}
