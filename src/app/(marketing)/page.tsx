import Link from "next/link";
import { Check, X, ArrowRight, Sparkles } from "lucide-react";
import { LiveAnalyzer } from "@/components/marketing/live-analyzer";
import { LeadForm } from "@/components/marketing/lead-form";

const TIERS = [
  {
    name: "Starter",
    price: "$0",
    note: "For trying it out",
    features: ["25 calls / month", "AI insights & coaching", "1 workspace", "Email support"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$49",
    note: "per user / month",
    features: ["Unlimited calls", "HubSpot & Monday sync", "Auto-sync on completion", "Ask AI copilot"],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Team",
    price: "Custom",
    note: "For scaling orgs",
    features: ["Everything in Growth", "SSO & roles", "Priority support", "Custom CRM fields"],
    cta: "Talk to sales",
    highlight: false,
  },
];

const FAQ = [
  ["Which languages are supported?", "English and Hebrew today, with speaker diarization and RTL-aware rendering throughout."],
  ["Do you support HubSpot and Monday.com?", "Yes — connect in seconds with an API token or OAuth. We log notes, update deal stages, and create follow-up tasks automatically."],
  ["How does pricing work?", "Start free with 25 calls/month. Growth unlocks unlimited calls and CRM sync. Team adds SSO and custom fields."],
  ["Is my call data secure?", "Every workspace is isolated with row-level security, and CRM tokens are encrypted at rest with AES-256-GCM."],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="text-lg font-semibold">
          Signal<span className="text-indigo-400">Desk</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#pricing" className="text-slate-400 hover:text-slate-200">Pricing</a>
          <a href="#faq" className="text-slate-400 hover:text-slate-200">FAQ</a>
          <Link href="/login" className="text-slate-300 hover:text-white">Sign in</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 text-center">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          AI conversation intelligence for revenue teams
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Turn every sales call into <span className="text-indigo-400">CRM-ready</span> intelligence.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
          SignalDesk transcribes your calls, extracts summaries, sentiment, objections, and
          next steps with Claude — then syncs them straight to HubSpot or Monday.com. No more
          manual note-taking after every call.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-6 py-3 font-medium text-slate-200 hover:bg-slate-900"
          >
            Try live demo
          </a>
        </div>
      </section>

      {/* Pain vs Solution */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-rose-400">Without SignalDesk</h3>
            <ul className="space-y-3 text-sm text-slate-300">
              {["Reps retype call notes into the CRM", "Objections and next steps get forgotten", "Managers can't see why deals slip", "Deal stages go stale between calls"].map((t) => (
                <li key={t} className="flex items-start gap-2"><X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-400">With SignalDesk</h3>
            <ul className="space-y-3 text-sm text-slate-300">
              {["Notes, tasks & stages sync automatically", "Every objection captured with counters", "Executive dashboard of sentiment & pipeline", "Follow-up emails drafted in one click"].map((t) => (
                <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Interactive demo */}
      <section id="demo" className="mx-auto max-w-4xl scroll-mt-8 px-6 py-12">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">See it on a real call</h2>
          <p className="mt-2 text-slate-400">Toggle English or Hebrew, then inspect the transcript, AI insights, follow-up email, and the exact CRM payload.</p>
        </div>
        <LiveAnalyzer />
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-8 px-6 py-16">
        <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight">Simple, transparent pricing</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={
                t.highlight
                  ? "relative rounded-2xl border-2 border-indigo-500 bg-slate-900 p-6"
                  : "rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
              }
            >
              {t.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-medium text-white">
                  Most popular
                </span>
              )}
              <div className="text-sm text-slate-400">{t.name}</div>
              <div className="mt-2 text-3xl font-bold">{t.price}</div>
              <div className="text-xs text-slate-500">{t.note}</div>
              <ul className="my-6 space-y-2 text-sm text-slate-300">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-400" />{f}</li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={
                  t.highlight
                    ? "block rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-indigo-500"
                    : "block rounded-lg border border-slate-700 px-4 py-2.5 text-center text-sm font-medium text-slate-200 hover:bg-slate-800"
                }
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Lead magnet */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-600/10 p-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Get early access</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-300">
            Join the waitlist and we&apos;ll analyze 5 of your real sales calls for free — transcript,
            insights, and the CRM payload we&apos;d generate.
          </p>
          <div className="mx-auto mt-6 max-w-md text-left">
            <LeadForm />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-8 px-6 py-16">
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">Frequently asked</h2>
        <div className="space-y-4">
          {FAQ.map(([q, a]) => (
            <div key={q} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="font-medium text-slate-100">{q}</h3>
              <p className="mt-1.5 text-sm text-slate-400">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} SignalDesk · AI Conversation Intelligence
      </footer>
    </div>
  );
}
