"use client";

import { useRef, useState } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isStaticDemo, demoChatAnswer } from "@/lib/demo/static";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What are our top 3 pricing objections this month?",
  "Which deals have negative sentiment and need attention?",
  "סכם כל מה שאנחנו יודעים על הלקוחות בעברית",
];

export function AskAiDrawer() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    // Placeholder assistant message we stream into.
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    // Static demo (GitHub Pages): synthesize + stream the answer in the browser.
    if (isStaticDemo()) {
      try {
        const answer = demoChatAnswer(next);
        const words = answer.split(/(\s+)/);
        let acc = "";
        for (const w of words) {
          acc += w;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: acc };
            return copy;
          });
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
          await new Promise((r) => setTimeout(r, 18));
        }
      } finally {
        setStreaming(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        throw new Error((await res.text()) || "Request failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Sorry — ${e instanceof Error ? e.message : "something went wrong"}.`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-indigo-600/15 px-3 py-1.5 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-600/25"
      >
        <Sparkles className="h-4 w-4" />
        Ask AI
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2 font-medium text-slate-100">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                Ask SignalDesk AI
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-400">
                    Ask about your workspace&apos;s calls, objections, sentiment, and deals.
                  </p>
                  <div className="space-y-2">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        dir="auto"
                        onClick={() => send(s)}
                        className="w-full rounded-lg border border-slate-800 px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:border-indigo-600/50 hover:bg-slate-900"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      dir="auto"
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        m.role === "user"
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-900 text-slate-200",
                      )}
                    >
                      {m.content || (streaming ? "…" : "")}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t border-slate-800 p-3"
            >
              <Input
                dir="auto"
                placeholder="Ask anything about your calls…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={streaming}
              />
              <Button type="submit" size="md" disabled={streaming || !input.trim()}>
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
