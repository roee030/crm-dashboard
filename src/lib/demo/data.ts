/**
 * Rich bilingual in-memory dataset powering zero-env demo mode.
 *
 * `buildDemoData()` returns a FRESH deep copy each call, so the mock client can
 * seed a mutable store without the exported fixtures ever being mutated, and so
 * tests can assert against a clean snapshot.
 *
 * Every tenant row carries workspace_id = DEMO_WORKSPACE_ID. Calls are
 * `completed` with transcripts (diarized utterances + realistic ms timestamps),
 * insights (deal health, risk flags, playbook results, cached coaching), CRM
 * integrations, sync logs, playbooks, ingestion keys, and alert rules.
 */
import {
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  DEMO_WORKSPACE_ID,
  DEMO_WORKSPACE_NAME,
} from "./mode";
import type {
  CallRow,
  CrmIntegrationRow,
  CrmSyncLogRow,
  InsightRow,
  LeadRow,
  PlaybookRow,
  TranscriptRow,
  UserRow,
  Utterance,
  WorkspaceAlertRuleRow,
  WorkspaceApiKeyRow,
  WorkspaceMemberRow,
  WorkspaceRow,
} from "@/types/db";

export type DemoData = {
  users: UserRow[];
  workspaces: WorkspaceRow[];
  workspace_members: WorkspaceMemberRow[];
  calls: CallRow[];
  transcripts: TranscriptRow[];
  insights: InsightRow[];
  crm_integrations: CrmIntegrationRow[];
  crm_sync_logs: CrmSyncLogRow[];
  playbooks: PlaybookRow[];
  workspace_api_keys: WorkspaceApiKeyRow[];
  workspace_alert_rules: WorkspaceAlertRuleRow[];
  leads: LeadRow[];
};

const DAY = 24 * 60 * 60 * 1000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

/** Terse utterance builder. */
function u(speaker: string, start_ms: number, end_ms: number, text: string): Utterance {
  return { speaker, start_ms, end_ms, text };
}

type CallSpec = {
  id: string;
  title: string;
  direction: CallRow["direction"];
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  language: "en" | "he";
  duration_sec: number;
  daysAgo: number;
  utterances: Utterance[];
  transcriptModel: string;
  confidence: number;
  insight: {
    summary: string;
    sentiment_label: InsightRow["sentiment_label"];
    sentiment_score: number;
    objections: InsightRow["objections"];
    action_items: InsightRow["action_items"];
    deal_stage_recommendation: string;
    deal_health_score: number;
    risk_flags: InsightRow["risk_flags"];
    playbook_results: InsightRow["playbook_results"];
    call_coaching: unknown;
  };
};

// --- Playbook criteria (match migration 0004 provisioning) -------------------
const BANT_CRITERIA = [
  { id: "budget", key: "budget", label: "Budget", description: "Did the rep uncover budget / willingness to pay?", weight: 25 },
  { id: "authority", key: "authority", label: "Authority", description: "Was the decision-maker identified and engaged?", weight: 25 },
  { id: "need", key: "need", label: "Need", description: "Was a concrete pain / need established?", weight: 30 },
  { id: "timing", key: "timing", label: "Timing", description: "Was a timeline or next step agreed?", weight: 20 },
];
const B2B_HE_CRITERIA = [
  { id: "pain", key: "pain", label: "כאב / צורך", description: "האם זוהה כאב עסקי ברור?", weight: 30 },
  { id: "decision_maker", key: "decision_maker", label: "מקבל ההחלטות", description: "האם מקבל ההחלטות זוהה ומעורב?", weight: 25 },
  { id: "next_step", key: "next_step", label: "צעד הבא", description: "האם סוכם צעד הבא קונקרטי?", weight: 25 },
  { id: "competition", key: "competition", label: "תחרות", description: "האם טופלה תחרות / חלופות?", weight: 20 },
];

// Helper to build a BANT-keyed playbook_results map.
function pr(
  budget: [number, string, string],
  authority: [number, string, string],
  need: [number, string, string],
  timing: [number, string, string],
): InsightRow["playbook_results"] {
  const mk = ([score, evidence, coaching_tip]: [number, string, string]) => ({ score, evidence, coaching_tip });
  return { budget: mk(budget), authority: mk(authority), need: mk(need), timing: mk(timing) };
}

const CALLS: CallSpec[] = [
  // ======================= ENGLISH =======================
  {
    id: "d0000000-0000-0000-0000-000000000001",
    title: "Acme Corp — Discovery",
    direction: "outbound",
    customer_name: "Acme Corp",
    customer_email: "jordan@acme.io",
    customer_phone: "+1-415-555-0142",
    language: "en",
    duration_sec: 96,
    daysAgo: 1,
    transcriptModel: "assemblyai-stt-3-7",
    confidence: 0.95,
    utterances: [
      u("A", 0, 7000, "Thanks for making time, Jordan. I'd love to understand how your team handles call notes today."),
      u("B", 7200, 16000, "Sure. Right now the reps type everything into HubSpot manually after each call. It's painful and half of it never gets logged."),
      u("A", 16200, 23000, "That's exactly what we fix. Roughly how many discovery calls does the team run in a week?"),
      u("B", 23200, 31000, "About forty across six reps. Losing the objections and next steps is costing us deals, honestly."),
      u("A", 31200, 40000, "Understood. If SignalDesk auto-logged every summary, objection, and task into HubSpot, who signs off on a tool like this?"),
      u("B", 40200, 49000, "I own the RevOps budget, so me. If it saves the team real time I can approve it this quarter."),
      u("A", 49200, 58000, "Great. We integrate with HubSpot in minutes. What would a successful trial look like for you?"),
      u("B", 58200, 68000, "If my reps stop retyping notes and managers can see sentiment trends, that's a win. Let's line up a pilot."),
      u("A", 68200, 78000, "Perfect — I'll send a pilot plan and we can start next week. I'll include the security overview too."),
      u("B", 78200, 88000, "Sounds good. Send it over and I'll loop in my ops lead."),
    ],
    insight: {
      summary: "Strong discovery with Acme Corp. Clear pain (manual HubSpot note-taking across 40 calls/week), economic buyer identified (Jordan owns RevOps budget), and mutual agreement to start a pilot next week.",
      sentiment_label: "positive",
      sentiment_score: 0.72,
      objections: [
        { text: "Need to see it save reps real time before approving", category: "value" },
        { text: "Wants a security overview before rollout", category: "security" },
      ],
      action_items: [
        { text: "Send pilot plan + security overview", owner: "Rep", due_hint: "this week" },
        { text: "Schedule HubSpot integration walkthrough", owner: "Rep", due_hint: "next week" },
      ],
      deal_stage_recommendation: "Qualified",
      deal_health_score: 88,
      risk_flags: [],
      playbook_results: pr(
        [2, "Jordan owns the RevOps budget and can approve this quarter.", "Confirm the dollar range in the next call."],
        [2, "Economic buyer engaged directly on the call.", "Keep the buyer in the loop through the pilot."],
        [2, "Manual note-taking across 40 calls/week is losing deals.", "Quantify hours lost per rep to sharpen ROI."],
        [2, "Pilot agreed to start next week.", "Send the mutual action plan same-day."],
      ),
      call_coaching: {
        scorecard: {
          discovery: { score: 9, feedback: "Excellent pain discovery and quantification of call volume." },
          objection_handling: { score: 8, feedback: "Pre-empted the security concern well; tie value to rep hours saved." },
          next_step_closing: { score: 9, feedback: "Secured a concrete pilot with a date — textbook close." },
        },
        missed_opportunities: [
          { objection: "Wants proof it saves reps time", suggested_response: "Offer a before/after time study from a comparable 6-rep team during the pilot." },
        ],
        follow_up_email: {
          language: "en",
          subject: "Your SignalDesk pilot plan + security overview",
          body: "Hi Jordan,\n\nGreat speaking today. As promised, here's the pilot plan to auto-log summaries, objections, and tasks straight into HubSpot for your six reps, plus our security overview (RLS isolation + AES-256-GCM token encryption).\n\nProposed start: next week. I'll include a before/after time study so you can see the hours saved per rep.\n\nBest,\nThe SignalDesk team",
        },
      },
    },
  },
  {
    id: "d0000000-0000-0000-0000-000000000002",
    title: "Globex — Pricing Negotiation",
    direction: "inbound",
    customer_name: "Globex Industries",
    customer_email: "priya@globex.com",
    customer_phone: "+1-212-555-0199",
    language: "en",
    duration_sec: 108,
    daysAgo: 2,
    transcriptModel: "assemblyai-stt-3-7",
    confidence: 0.93,
    utterances: [
      u("A", 0, 7000, "Hi Priya, I know pricing is the open item. What's giving you pause?"),
      u("B", 7200, 17000, "Honestly the per-seat cost is higher than Chorus quoted us, and my CFO is pushing back hard."),
      u("A", 17200, 26000, "I hear you. Can I ask what the Chorus quote covered — did it include CRM write-back and Hebrew support?"),
      u("B", 26200, 35000, "Not Hebrew, no. But price is price, and we're being told to cut tooling spend this quarter."),
      u("A", 35200, 45000, "Understood. If budget is the blocker, would an annual commitment at a lower effective rate help the CFO?"),
      u("B", 45200, 55000, "Maybe. But I can't promise anything until the finance review in two weeks, and we're also still evaluating Gong."),
      u("A", 55200, 65000, "Fair. What would need to be true for SignalDesk to be the clear choice over Gong?"),
      u("B", 65200, 76000, "Lower cost and the bilingual support actually working. If it slips past this quarter it probably dies."),
      u("A", 76200, 86000, "Let me get you a revised annual proposal and a Hebrew proof-of-value by Friday."),
      u("B", 86200, 98000, "Okay. No guarantees, but send it and I'll bring it to finance."),
    ],
    insight: {
      summary: "Globex is price-sensitive and comparing against Chorus and Gong. CFO is pushing to cut tooling spend; decision gated by a finance review in two weeks. Deal is at risk of slipping past quarter-end.",
      sentiment_label: "negative",
      sentiment_score: -0.35,
      objections: [
        { text: "Per-seat cost higher than Chorus quote", category: "pricing" },
        { text: "CFO mandate to cut tooling spend", category: "budget" },
        { text: "Still evaluating Gong", category: "competitor" },
      ],
      action_items: [
        { text: "Send revised annual proposal (lower effective rate)", owner: "Rep", due_hint: "by Friday" },
        { text: "Deliver Hebrew proof-of-value", owner: "Solutions", due_hint: "by Friday" },
      ],
      deal_stage_recommendation: "Negotiation",
      deal_health_score: 44,
      risk_flags: [
        { severity: "high", code: "price_pressure", title: "Price pressure vs. competitor", evidence_quote: "the per-seat cost is higher than Chorus quoted us" },
        { severity: "medium", code: "budget_cut", title: "CFO cutting tooling spend", evidence_quote: "we're being told to cut tooling spend this quarter" },
        { severity: "medium", code: "competitor_gong", title: "Active competitor evaluation", evidence_quote: "we're also still evaluating Gong" },
      ],
      playbook_results: pr(
        [1, "CFO is cutting tooling spend; price is the blocker.", "Reframe on total value and annual pricing early."],
        [1, "Champion cannot approve until finance review.", "Get a direct line to the CFO before the review."],
        [2, "Bilingual CRM write-back is a real need Chorus can't meet.", "Lead with the Hebrew differentiator Gong lacks."],
        [1, "Decision gated two weeks out and may slip past quarter.", "Create urgency with a time-boxed annual incentive."],
      ),
      call_coaching: {
        scorecard: {
          discovery: { score: 7, feedback: "Good probing on the competitor quote and the real blocker." },
          objection_handling: { score: 6, feedback: "Reframed toward annual pricing, but didn't neutralize the Gong comparison." },
          next_step_closing: { score: 5, feedback: "Next step is soft — no committed meeting with the CFO." },
        },
        missed_opportunities: [
          { objection: "Chorus is cheaper", suggested_response: "Quantify the cost of missed Hebrew calls and manual CRM entry Chorus can't automate — reframe price as total cost." },
          { objection: "Still evaluating Gong", suggested_response: "Offer a side-by-side bilingual bake-off; Gong has no Hebrew diarization." },
        ],
        follow_up_email: {
          language: "en",
          subject: "Revised annual proposal + Hebrew proof-of-value",
          body: "Hi Priya,\n\nThanks for the candid conversation. Attached is a revised annual proposal at a lower effective per-seat rate, plus a Hebrew proof-of-value you can put in front of finance.\n\nThe key difference from Chorus and Gong: bilingual diarization and automatic CRM write-back — the manual work your team is doing today disappears. Happy to join the finance review if useful.\n\nBest,\nThe SignalDesk team",
        },
      },
    },
  },
  {
    id: "d0000000-0000-0000-0000-000000000003",
    title: "Initech — Contract Close",
    direction: "outbound",
    customer_name: "Initech",
    customer_email: "bill@initech.com",
    customer_phone: "+1-408-555-0121",
    language: "en",
    duration_sec: 84,
    daysAgo: 4,
    transcriptModel: "universal-2",
    confidence: 0.96,
    utterances: [
      u("A", 0, 7000, "Bill, great news — legal came back clean on the MSA. Are we good to countersign?"),
      u("B", 7200, 15000, "We are. The team loved the pilot. Honestly the auto-logging alone sold everyone internally."),
      u("A", 15200, 23000, "That's wonderful to hear. So we're confirming 12 seats on the annual Growth plan?"),
      u("B", 23200, 31000, "Twelve to start, and we'll likely add the support team next quarter."),
      u("A", 31200, 40000, "Perfect. I'll send the order form now. Anything you need for a smooth rollout?"),
      u("B", 40200, 49000, "Just the onboarding session for the new reps and the HubSpot field mapping doc."),
      u("A", 49200, 58000, "Both included. I'll schedule onboarding for Monday and attach the mapping guide."),
      u("B", 58200, 68000, "Excellent. Sending the signed form back today. Looking forward to it."),
      u("A", 68200, 77000, "Thank you, Bill. Welcome aboard — we're thrilled to have Initech."),
    ],
    insight: {
      summary: "Initech is closing: legal cleared the MSA, pilot was a success, and Bill is countersigning 12 seats on the annual Growth plan with expansion to the support team likely next quarter.",
      sentiment_label: "positive",
      sentiment_score: 0.92,
      objections: [],
      action_items: [
        { text: "Send order form for 12 seats", owner: "Rep", due_hint: "today" },
        { text: "Schedule onboarding for new reps", owner: "CS", due_hint: "Monday" },
        { text: "Attach HubSpot field-mapping guide", owner: "Rep", due_hint: "today" },
      ],
      deal_stage_recommendation: "Closed Won",
      deal_health_score: 94,
      risk_flags: [],
      playbook_results: pr(
        [2, "Annual Growth plan budget confirmed for 12 seats.", "Note the expansion signal for a Q+1 upsell."],
        [2, "Bill is signing; full internal buy-in from the pilot.", "Ask for an intro to the support-team lead now."],
        [2, "Auto-logging solved the core pain and sold the team.", "Capture the quantified pilot win as a case study."],
        [2, "Signing today; onboarding booked for Monday.", "Confirm the order form is returned before EOD."],
      ),
      call_coaching: {
        scorecard: {
          discovery: { score: 8, feedback: "Pilot success was well leveraged to confirm value." },
          objection_handling: { score: 9, feedback: "No open objections — clean path to signature." },
          next_step_closing: { score: 10, feedback: "Textbook close: seats confirmed, order form out, onboarding booked." },
        },
        missed_opportunities: [],
        follow_up_email: {
          language: "en",
          subject: "Welcome aboard — order form, onboarding & field mapping",
          body: "Hi Bill,\n\nDelighted to have Initech on board! Attached is the order form for 12 annual Growth seats, the HubSpot field-mapping guide, and a calendar hold for Monday's onboarding session.\n\nWhen you're ready to add the support team next quarter, just say the word.\n\nWelcome aboard,\nThe SignalDesk team",
        },
      },
    },
  },
  {
    id: "d0000000-0000-0000-0000-000000000004",
    title: "Umbrella Health — Product Demo",
    direction: "outbound",
    customer_name: "Umbrella Health",
    customer_email: "sam@umbrellahealth.com",
    customer_phone: "+1-617-555-0188",
    language: "en",
    duration_sec: 120,
    daysAgo: 6,
    transcriptModel: "assemblyai-stt-3-7",
    confidence: 0.92,
    utterances: [
      u("A", 0, 8000, "Welcome, Sam. Today I'll show how SignalDesk turns a call into a CRM-ready record. Sound good?"),
      u("B", 8200, 16000, "Yes, though my main concern is compliance — we're in healthcare, so data handling matters a lot."),
      u("A", 16200, 26000, "Absolutely. Every workspace is isolated with row-level security and tokens are encrypted at rest."),
      u("B", 26200, 36000, "Good. And where is the audio stored? We have strict requirements about PHI."),
      u("A", 36200, 46000, "Audio sits in your private Supabase storage bucket; access is signed and short-lived."),
      u("B", 46200, 57000, "Okay. The insights look useful, but I'd need our security team to review before we commit."),
      u("A", 57200, 67000, "That's reasonable. I can send a security packet and join a call with your team."),
      u("B", 67200, 78000, "Let's do that. Budget-wise we haven't scoped this, so it's early, but the demo was strong."),
      u("A", 78200, 89000, "No problem. I'll send the packet and a short ROI model to help you scope it internally."),
      u("B", 89200, 100000, "Appreciated. Let me get security's feedback and I'll come back to you in a couple weeks."),
    ],
    insight: {
      summary: "Solid demo for Umbrella Health. Strong interest in the product, but the deal is early: budget isn't scoped and a healthcare security review is required before progressing. Compliance is the central theme.",
      sentiment_label: "neutral",
      sentiment_score: 0.12,
      objections: [
        { text: "Healthcare compliance / PHI handling review required", category: "security" },
        { text: "Budget not yet scoped", category: "budget" },
      ],
      action_items: [
        { text: "Send security packet (RLS, encryption, storage)", owner: "Rep", due_hint: "this week" },
        { text: "Share short ROI model for internal scoping", owner: "Rep", due_hint: "this week" },
        { text: "Schedule review with their security team", owner: "Rep", due_hint: "2 weeks" },
      ],
      deal_stage_recommendation: "Demo Scheduled",
      deal_health_score: 61,
      risk_flags: [
        { severity: "medium", code: "security_review", title: "Healthcare security review gate", evidence_quote: "I'd need our security team to review before we commit" },
        { severity: "low", code: "budget_unscoped", title: "Budget not yet scoped", evidence_quote: "we haven't scoped this, so it's early" },
      ],
      playbook_results: pr(
        [1, "Budget has not been scoped yet.", "Deliver the ROI model to seed the budget conversation."],
        [1, "Security team are hidden decision-influencers.", "Get them on the next call to avoid a late veto."],
        [2, "Clear compliance pain around PHI handling.", "Lead with the security architecture up front."],
        [1, "Follow-up is a vague 'couple of weeks'.", "Book the security review date before the call ends."],
      ),
      call_coaching: {
        scorecard: {
          discovery: { score: 7, feedback: "Surfaced compliance as the core theme quickly." },
          objection_handling: { score: 8, feedback: "Answered PHI/storage concerns crisply and credibly." },
          next_step_closing: { score: 5, feedback: "Left with a soft timeline — pin the security review date." },
        },
        missed_opportunities: [
          { objection: "Need security team sign-off", suggested_response: "Offer to run a 30-minute architecture review this week so the gate doesn't add two weeks." },
        ],
        follow_up_email: {
          language: "en",
          subject: "Security packet + ROI model for Umbrella Health",
          body: "Hi Sam,\n\nThanks for the thoughtful questions on compliance. Attached is our security packet covering workspace isolation (RLS), AES-256-GCM token encryption, and signed short-lived audio access, plus a short ROI model to help you scope internally.\n\nHappy to run a 30-minute architecture review with your security team this week so the review doesn't hold things up.\n\nBest,\nThe SignalDesk team",
        },
      },
    },
  },
  // ======================= HEBREW (RTL) =======================
  {
    id: "d0000000-0000-0000-0000-000000000005",
    title: "חברת אלפא — שיחת גילוי",
    direction: "outbound",
    customer_name: "חברת אלפא טכנולוגיות",
    customer_email: "noa@alpha.co.il",
    customer_phone: "+972-3-555-0142",
    language: "he",
    duration_sec: 98,
    daysAgo: 1,
    transcriptModel: "assemblyai-stt-3-7",
    confidence: 0.94,
    utterances: [
      u("A", 0, 8000, "נועה, תודה על הזמן. אשמח להבין איך הצוות שלכם מתעד שיחות מכירה היום."),
      u("B", 8200, 18000, "כרגע כל נציג רושם סיכום ידני ב-Monday אחרי כל שיחה, וחצי מהדברים פשוט הולכים לאיבוד."),
      u("A", 18200, 27000, "זה בדיוק מה שאנחנו פותרים. כמה שיחות גילוי אתם מבצעים בשבוע בערך?"),
      u("B", 27200, 37000, "בסביבות שלושים, עם ארבעה נציגים. אובדן ההתנגדויות והצעדים הבאים עולה לנו בעסקאות."),
      u("A", 37200, 47000, "מובן. אם SignalDesk היה מתעד אוטומטית כל סיכום והתנגדות ישירות ל-Monday, מי מאשר כלי כזה?"),
      u("B", 47200, 57000, "אני מנהלת את התקציב של הצוות, אז אני. אם זה חוסך זמן אמיתי אני יכולה לאשר ברבעון הזה."),
      u("A", 57200, 67000, "מצוין. אנחנו מתחברים ל-Monday תוך דקות. איך נראית הצלחה עבורך בפיילוט?"),
      u("B", 67200, 78000, "אם הנציגים יפסיקו להקליד סיכומים וההנהלה תראה מגמות סנטימנט — זה ניצחון. בואו נקבע פיילוט."),
      u("A", 78200, 90000, "מושלם. אשלח תוכנית פיילוט ונתחיל בשבוע הבא, כולל סקירת אבטחה."),
    ],
    insight: {
      summary: "שיחת גילוי חזקה עם חברת אלפא. כאב ברור (תיעוד ידני ב-Monday על פני 30 שיחות בשבוע), מקבלת ההחלטות (נועה, מנהלת התקציב) מעורבת, והוסכם על פיילוט שמתחיל בשבוע הבא.",
      sentiment_label: "positive",
      sentiment_score: 0.68,
      objections: [
        { text: "צריכה לראות חיסכון זמן אמיתי לפני אישור", category: "value" },
        { text: "דרושה סקירת אבטחה", category: "security" },
      ],
      action_items: [
        { text: "לשלוח תוכנית פיילוט וסקירת אבטחה", owner: "נציג", due_hint: "השבוע" },
        { text: "לקבוע הדרכת אינטגרציה ל-Monday", owner: "נציג", due_hint: "שבוע הבא" },
      ],
      deal_stage_recommendation: "Qualified",
      deal_health_score: 82,
      risk_flags: [],
      playbook_results: pr(
        [2, "נועה מנהלת את תקציב הצוות ויכולה לאשר ברבעון.", "לאמת טווח תקציבי בשיחה הבאה."],
        [2, "מקבלת ההחלטות מעורבת ישירות בשיחה.", "לשמור אותה מעורבת לאורך הפיילוט."],
        [2, "תיעוד ידני על פני 30 שיחות בשבוע גורם לאובדן עסקאות.", "לכמת שעות שאובדות לכל נציג."],
        [2, "הוסכם על פיילוט שמתחיל בשבוע הבא.", "לשלוח תוכנית פעולה משותפת עוד היום."],
      ),
      call_coaching: {
        scorecard: {
          discovery: { score: 9, feedback: "גילוי כאב מצוין וכימות נפח השיחות." },
          objection_handling: { score: 8, feedback: "הקדמת את חשש האבטחה יפה; חבר/י ערך לשעות שנחסכות." },
          next_step_closing: { score: 9, feedback: "נסגר פיילוט עם מועד — סגירה לדוגמה." },
        },
        missed_opportunities: [
          { objection: "רוצה הוכחה לחיסכון בזמן", suggested_response: "הצע/י מדידת זמן לפני/אחרי מצוות דומה בן ארבעה נציגים במהלך הפיילוט." },
        ],
        follow_up_email: {
          language: "he",
          subject: "תוכנית הפיילוט שלך ל-SignalDesk + סקירת אבטחה",
          body: "שלום נועה,\n\nנעים היה לדבר היום. כפי שהבטחתי, מצורפת תוכנית פיילוט לתיעוד אוטומטי של סיכומים והתנגדויות ישירות ל-Monday עבור ארבעת הנציגים, יחד עם סקירת אבטחה (בידוד הרשאות ברמת-שורה והצפנת AES-256-GCM).\n\nמועד מוצע להתחלה: שבוע הבא. אצרף מדידת זמן לפני/אחרי כדי להראות את השעות שנחסכות לכל נציג.\n\nבברכה,\nצוות SignalDesk",
        },
      },
    },
  },
  {
    id: "d0000000-0000-0000-0000-000000000006",
    title: "גלובוס טק — התנגדות מחיר",
    direction: "inbound",
    customer_name: "גלובוס טכנולוגיות",
    customer_email: "amir@globus.co.il",
    customer_phone: "+972-9-555-0199",
    language: "he",
    duration_sec: 112,
    daysAgo: 3,
    transcriptModel: "assemblyai-stt-3-7",
    confidence: 0.91,
    utterances: [
      u("A", 0, 8000, "אמיר, אני יודע שהמחיר הוא הנושא הפתוח. מה גורם להיסוס?"),
      u("B", 8200, 19000, "בכנות, העלות לכל משתמש גבוהה ממה שהצעתם לנו המתחרים, והמנכ\"ל לוחץ חזק להוריד הוצאות."),
      u("A", 19200, 29000, "אני שומע אותך. אפשר לשאול מה המתחרה כלל? האם הוא תומך בעברית ובכתיבה חזרה ל-CRM?"),
      u("B", 29200, 39000, "לא בעברית, לא. אבל מחיר זה מחיר, ואומרים לנו לקצץ בכלים ברבעון הזה."),
      u("A", 39200, 50000, "מובן. אם התקציב הוא החסם, התחייבות שנתית בתעריף אפקטיבי נמוך יותר תעזור למנכ\"ל?"),
      u("B", 50200, 61000, "אולי. אבל אני לא יכול להבטיח כלום עד הדיון הפיננסי בעוד שבועיים, ואנחנו עדיין בוחנים חלופה."),
      u("A", 61200, 72000, "הוגן. מה צריך להיות נכון כדי ש-SignalDesk תהיה הבחירה הברורה?"),
      u("B", 72200, 84000, "מחיר נמוך יותר ושהתמיכה הדו-לשונית באמת תעבוד. אם זה יחליק מעבר לרבעון זה כנראה מת."),
      u("A", 84200, 95000, "תן לי להכין הצעה שנתית מעודכנת והוכחת ערך בעברית עד יום חמישי."),
      u("B", 95200, 106000, "בסדר. בלי הבטחות, אבל שלח ואביא את זה לדיון הפיננסי."),
    ],
    insight: {
      summary: "גלובוס טק רגישה למחיר ומשווה מול מתחרים. המנכ\"ל לוחץ לקצץ בהוצאות כלים; ההחלטה חסומה עד דיון פיננסי בעוד שבועיים. העסקה בסיכון גבוה להחליק מעבר לסוף הרבעון.",
      sentiment_label: "negative",
      sentiment_score: -0.65,
      objections: [
        { text: "עלות למשתמש גבוהה מהצעת המתחרה", category: "pricing" },
        { text: "הנחיית מנכ\"ל לקצץ בהוצאות כלים", category: "budget" },
        { text: "בוחנים חלופה מתחרה", category: "competitor" },
      ],
      action_items: [
        { text: "לשלוח הצעה שנתית מעודכנת בתעריף נמוך יותר", owner: "נציג", due_hint: "עד יום חמישי" },
        { text: "לספק הוכחת ערך בעברית", owner: "פתרונות", due_hint: "עד יום חמישי" },
      ],
      deal_stage_recommendation: "At Risk",
      deal_health_score: 28,
      risk_flags: [
        { severity: "high", code: "price_pressure", title: "לחץ מחיר מול מתחרה", evidence_quote: "העלות לכל משתמש גבוהה ממה שהצעתם לנו המתחרים" },
        { severity: "high", code: "budget_cut", title: "מנכ\"ל מקצץ בהוצאות כלים", evidence_quote: "אומרים לנו לקצץ בכלים ברבעון הזה" },
        { severity: "medium", code: "slip_risk", title: "סיכון להחלקה מעבר לרבעון", evidence_quote: "אם זה יחליק מעבר לרבעון זה כנראה מת" },
      ],
      playbook_results: pr(
        [0, "המנכ\"ל מקצץ בהוצאות; המחיר הוא החסם.", "למסגר מחדש על ערך כולל ותמחור שנתי מוקדם."],
        [1, "השגריר לא יכול לאשר עד הדיון הפיננסי.", "להשיג קו ישיר למנכ\"ל לפני הדיון."],
        [2, "כתיבה חזרה דו-לשונית ל-CRM היא צורך שהמתחרה לא עונה עליו.", "להוביל עם הבידול של העברית."],
        [0, "ההחלטה חסומה שבועיים וייתכן שתחליק.", "ליצור דחיפות עם תמריץ שנתי מתוחם בזמן."],
      ),
      call_coaching: {
        scorecard: {
          discovery: { score: 6, feedback: "תחקור טוב של הצעת המתחרה והחסם האמיתי." },
          objection_handling: { score: 5, feedback: "מסגרת מחדש לתמחור שנתי, אך לא ניטרלת את ההשוואה למתחרה." },
          next_step_closing: { score: 4, feedback: "הצעד הבא רך — אין פגישה מחייבת עם המנכ\"ל." },
        },
        missed_opportunities: [
          { objection: "המתחרה זול יותר", suggested_response: "כמת/י את עלות השיחות בעברית שאובדות ואת התיעוד הידני שהמתחרה לא מבצע — מסגר/י מחיר כעלות כוללת." },
          { objection: "עדיין בוחנים חלופה", suggested_response: "הצע/י השוואה דו-לשונית צד-לצד; למתחרה אין דיאריזציה בעברית." },
        ],
        follow_up_email: {
          language: "he",
          subject: "הצעה שנתית מעודכנת + הוכחת ערך בעברית",
          body: "שלום אמיר,\n\nתודה על השיחה הכנה. מצורפת הצעה שנתית מעודכנת בתעריף אפקטיבי נמוך יותר למשתמש, יחד עם הוכחת ערך בעברית שתוכל להציג בדיון הפיננסי.\n\nההבדל המרכזי מהמתחרה: דיאריזציה דו-לשונית וכתיבה אוטומטית חזרה ל-CRM — העבודה הידנית שהצוות עושה היום פשוט נעלמת. אשמח להצטרף לדיון הפיננסי אם זה יעזור.\n\nבברכה,\nצוות SignalDesk",
        },
      },
    },
  },
  {
    id: "d0000000-0000-0000-0000-000000000007",
    title: "מדיטק פתרונות — הדגמת מוצר",
    direction: "outbound",
    customer_name: "מדיטק פתרונות",
    customer_email: "dana@meditech.co.il",
    customer_phone: "+972-4-555-0188",
    language: "he",
    duration_sec: 104,
    daysAgo: 7,
    transcriptModel: "universal-2",
    confidence: 0.9,
    utterances: [
      u("A", 0, 8000, "ברוכה הבאה, דנה. היום אראה איך SignalDesk הופכת שיחה לרשומת CRM מוכנה. נשמע טוב?"),
      u("B", 8200, 17000, "כן, אבל הדאגה העיקרית שלי היא עמידה ברגולציה — אנחנו בתחום הבריאות, אז טיפול בנתונים קריטי."),
      u("A", 17200, 27000, "בהחלט. כל סביבת עבודה מבודדת בהרשאות ברמת-שורה והטוקנים מוצפנים במנוחה."),
      u("B", 27200, 38000, "יפה. ואיפה האודיו מאוחסן? יש לנו דרישות מחמירות לגבי מידע רפואי."),
      u("A", 38200, 48000, "האודיו יושב בדלי אחסון פרטי שלכם; הגישה חתומה וקצרת-מועד."),
      u("B", 48200, 59000, "בסדר. התובנות נראות שימושיות, אבל אצטרך שצוות האבטחה יבדוק לפני התחייבות."),
      u("A", 59200, 69000, "הגיוני. אשלח חבילת אבטחה ואצטרף לשיחה עם הצוות שלכם."),
      u("B", 69200, 80000, "בואו נעשה את זה. מבחינת תקציב עוד לא הגדרנו, אז זה מוקדם, אבל ההדגמה הייתה חזקה."),
      u("A", 80200, 92000, "אין בעיה. אשלח את החבילה ומודל ROI קצר שיעזור לכם להגדיר תקציב פנימית."),
    ],
    insight: {
      summary: "הדגמה מוצלחת למדיטק. עניין חזק במוצר, אך העסקה מוקדמת: התקציב לא הוגדר ונדרשת סקירת אבטחה בתחום הבריאות לפני התקדמות. עמידה ברגולציה היא הנושא המרכזי.",
      sentiment_label: "neutral",
      sentiment_score: 0.2,
      objections: [
        { text: "נדרשת סקירת עמידה ברגולציה בתחום הבריאות", category: "security" },
        { text: "תקציב לא הוגדר עדיין", category: "budget" },
      ],
      action_items: [
        { text: "לשלוח חבילת אבטחה (הרשאות, הצפנה, אחסון)", owner: "נציג", due_hint: "השבוע" },
        { text: "לשתף מודל ROI להגדרת תקציב פנימית", owner: "נציג", due_hint: "השבוע" },
        { text: "לקבוע סקירה עם צוות האבטחה", owner: "נציג", due_hint: "שבועיים" },
      ],
      deal_stage_recommendation: "Demo",
      deal_health_score: 57,
      risk_flags: [
        { severity: "medium", code: "security_review", title: "שער סקירת אבטחה בבריאות", evidence_quote: "אצטרך שצוות האבטחה יבדוק לפני התחייבות" },
        { severity: "low", code: "budget_unscoped", title: "תקציב לא הוגדר", evidence_quote: "מבחינת תקציב עוד לא הגדרנו, אז זה מוקדם" },
      ],
      playbook_results: pr(
        [1, "התקציב עדיין לא הוגדר.", "לספק מודל ROI כדי לפתוח את שיחת התקציב."],
        [1, "צוות האבטחה הם משפיעי-החלטה נסתרים.", "לצרף אותם לשיחה הבאה כדי להימנע מווטו מאוחר."],
        [2, "כאב רגולטורי ברור סביב טיפול במידע רפואי.", "להוביל עם ארכיטקטורת האבטחה מראש."],
        [1, "המעקב מעורפל — 'בעוד שבועיים'.", "לקבוע את מועד סקירת האבטחה לפני סיום השיחה."],
      ),
      call_coaching: {
        scorecard: {
          discovery: { score: 7, feedback: "העלת את עמידה ברגולציה כנושא מרכזי במהירות." },
          objection_handling: { score: 8, feedback: "ענית על חששות המידע הרפואי והאחסון בצורה אמינה." },
          next_step_closing: { score: 5, feedback: "נותרת עם לוח זמנים רך — קבע/י את מועד סקירת האבטחה." },
        },
        missed_opportunities: [
          { objection: "צריך אישור צוות אבטחה", suggested_response: "הצע/י סקירת ארכיטקטורה של 30 דקות השבוע כדי שהשער לא יוסיף שבועיים." },
        ],
        follow_up_email: {
          language: "he",
          subject: "חבילת אבטחה + מודל ROI עבור מדיטק",
          body: "שלום דנה,\n\nתודה על השאלות המעמיקות בנושא עמידה ברגולציה. מצורפת חבילת האבטחה שלנו הכוללת בידוד סביבות עבודה (הרשאות ברמת-שורה), הצפנת טוקנים AES-256-GCM וגישת אודיו חתומה וקצרת-מועד, יחד עם מודל ROI קצר שיעזור להגדיר תקציב פנימית.\n\nאשמח להעביר סקירת ארכיטקטורה של 30 דקות עם צוות האבטחה שלכם השבוע כדי שהסקירה לא תעכב.\n\nבברכה,\nצוות SignalDesk",
        },
      },
    },
  },
  {
    id: "d0000000-0000-0000-0000-000000000008",
    title: "בנק הפועלים דיגיטל — סגירת עסקה",
    direction: "outbound",
    customer_name: "בנק הפועלים דיגיטל",
    customer_email: "yael@poalim-digital.co.il",
    customer_phone: "+972-3-555-0121",
    language: "he",
    duration_sec: 88,
    daysAgo: 5,
    transcriptModel: "assemblyai-stt-3-7",
    confidence: 0.95,
    utterances: [
      u("A", 0, 8000, "יעל, חדשות טובות — המחלקה המשפטית אישרה את ההסכם. אנחנו טובים לחתימה?"),
      u("B", 8200, 16000, "אנחנו טובים. הצוות אהב את הפיילוט. התיעוד האוטומטי לבדו שכנע את כולם פנימית."),
      u("A", 16200, 25000, "נהדר לשמוע. אז אנחנו מאשרים עשרים מושבים בתוכנית השנתית?"),
      u("B", 25200, 34000, "עשרים להתחלה, וכנראה נוסיף את צוות השירות ברבעון הבא."),
      u("A", 34200, 44000, "מושלם. אשלח את טופס ההזמנה עכשיו. צריכה משהו להטמעה חלקה?"),
      u("B", 44200, 54000, "רק הדרכה לנציגים החדשים ומסמך מיפוי השדות ל-CRM."),
      u("A", 54200, 64000, "שניהם כלולים. אקבע הדרכה ליום ראשון ואצרף את מדריך המיפוי."),
      u("B", 64200, 74000, "מצוין. מחזירה את הטופס החתום היום. מצפה להתחיל."),
      u("A", 74200, 83000, "תודה, יעל. ברוכים הבאים — אנחנו נרגשים לעבוד עם בנק הפועלים דיגיטל."),
    ],
    insight: {
      summary: "בנק הפועלים דיגיטל בסגירה: המחלקה המשפטית אישרה את ההסכם, הפיילוט הצליח, ויעל חותמת על עשרים מושבים בתוכנית השנתית עם הרחבה צפויה לצוות השירות ברבעון הבא.",
      sentiment_label: "positive",
      sentiment_score: 0.85,
      objections: [],
      action_items: [
        { text: "לשלוח טופס הזמנה ל-20 מושבים", owner: "נציג", due_hint: "היום" },
        { text: "לקבוע הדרכה לנציגים החדשים", owner: "הצלחת לקוח", due_hint: "יום ראשון" },
        { text: "לצרף מדריך מיפוי שדות ל-CRM", owner: "נציג", due_hint: "היום" },
      ],
      deal_stage_recommendation: "Closed Won",
      deal_health_score: 90,
      risk_flags: [],
      playbook_results: pr(
        [2, "תקציב התוכנית השנתית אושר ל-20 מושבים.", "לרשום את אות ההרחבה לאפסייל ברבעון הבא."],
        [2, "יעל חותמת; קנייה פנימית מלאה מהפיילוט.", "לבקש הכרות עם מוביל צוות השירות עכשיו."],
        [2, "תיעוד אוטומטי פתר את הכאב המרכזי ושכנע את הצוות.", "לתעד את הניצחון המכומת כמקרה בוחן."],
        [2, "חותמת היום; הדרכה נקבעה ליום ראשון.", "לוודא שהטופס מוחזר לפני סוף היום."],
      ),
      call_coaching: {
        scorecard: {
          discovery: { score: 8, feedback: "הצלחת הפיילוט מונפה היטב לאישור הערך." },
          objection_handling: { score: 9, feedback: "אין התנגדויות פתוחות — מסלול נקי לחתימה." },
          next_step_closing: { score: 10, feedback: "סגירה לדוגמה: מושבים אושרו, טופס נשלח, הדרכה נקבעה." },
        },
        missed_opportunities: [],
        follow_up_email: {
          language: "he",
          subject: "ברוכים הבאים — טופס הזמנה, הטמעה ומיפוי שדות",
          body: "שלום יעל,\n\nשמחים לקבל את בנק הפועלים דיגיטל! מצורף טופס ההזמנה ל-20 מושבים שנתיים בתוכנית Growth, מדריך מיפוי השדות ל-CRM, וזימון להדרכת ההטמעה ביום ראשון.\n\nכשתהיו מוכנים להוסיף את צוות השירות ברבעון הבא — רק תגידו מילה.\n\nברוכים הבאים,\nצוות SignalDesk",
        },
      },
    },
  },
];

/** Build a fresh, deep-cloned snapshot of the demo dataset. */
export function buildDemoData(): DemoData {
  const workspace: WorkspaceRow = {
    id: DEMO_WORKSPACE_ID,
    name: DEMO_WORKSPACE_NAME,
    owner_id: DEMO_USER_ID,
    created_at: iso(30 * DAY),
  };

  const user: UserRow = {
    id: DEMO_USER_ID,
    email: DEMO_USER_EMAIL,
    full_name: "Roee Angel",
    avatar_url: null,
    created_at: iso(30 * DAY),
  };

  const member: WorkspaceMemberRow = {
    id: "00000000-0000-0000-0000-0000000000a1",
    workspace_id: DEMO_WORKSPACE_ID,
    user_id: DEMO_USER_ID,
    role: "owner",
    created_at: iso(30 * DAY),
  };

  const calls: CallRow[] = [];
  const transcripts: TranscriptRow[] = [];
  const insights: InsightRow[] = [];

  for (const c of CALLS) {
    const createdAt = iso(c.daysAgo * DAY);
    calls.push({
      id: c.id,
      workspace_id: DEMO_WORKSPACE_ID,
      uploaded_by: DEMO_USER_ID,
      title: c.title,
      direction: c.direction,
      customer_name: c.customer_name,
      customer_email: c.customer_email,
      customer_phone: c.customer_phone,
      audio_path: c.id, // demo audio route keys off the call id
      duration_sec: c.duration_sec,
      language: c.language,
      status: "completed",
      error_message: null,
      external_provider_id: `demo-transcript-${c.id.slice(-4)}`,
      external_call_id: null,
      crm_contact_ref: c.insight.deal_stage_recommendation.toLowerCase().includes("won")
        ? `crm-${c.id.slice(-4)}`
        : null,
      created_at: createdAt,
      updated_at: createdAt,
    });

    transcripts.push({
      id: `t${c.id.slice(1)}`,
      call_id: c.id,
      workspace_id: DEMO_WORKSPACE_ID,
      provider: "assemblyai",
      model: c.transcriptModel,
      language: c.language,
      full_text: c.utterances.map((x) => x.text).join("\n"),
      utterances: c.utterances,
      confidence: c.confidence,
      created_at: createdAt,
    });

    insights.push({
      id: `i${c.id.slice(1)}`,
      call_id: c.id,
      workspace_id: DEMO_WORKSPACE_ID,
      model: "claude-sonnet-4-6",
      summary: c.insight.summary,
      sentiment_label: c.insight.sentiment_label,
      sentiment_score: c.insight.sentiment_score,
      objections: c.insight.objections,
      action_items: c.insight.action_items,
      deal_stage_recommendation: c.insight.deal_stage_recommendation,
      raw: { demo: true },
      call_coaching: c.insight.call_coaching,
      deal_health_score: c.insight.deal_health_score,
      risk_flags: c.insight.risk_flags,
      playbook_results: c.insight.playbook_results,
      created_at: createdAt,
    });
  }

  const crm_integrations: CrmIntegrationRow[] = [
    {
      id: "00000000-0000-0000-0000-0000000000b1",
      workspace_id: DEMO_WORKSPACE_ID,
      provider: "hubspot",
      access_token: "demo-encrypted-token",
      refresh_token: "demo-encrypted-refresh",
      expires_at: iso(-6 * 60 * 60 * 1000), // valid 6h from now
      account_label: "Acme GTM (HubSpot)",
      config: { auth_mode: "oauth", auto_sync: true, pipeline_id: "default", portal_id: "demo-4242" },
      is_active: true,
      created_at: iso(20 * DAY),
    },
    {
      id: "00000000-0000-0000-0000-0000000000b2",
      workspace_id: DEMO_WORKSPACE_ID,
      provider: "monday",
      access_token: "demo-encrypted-token",
      refresh_token: null,
      expires_at: null,
      account_label: "RevOps Board (Monday)",
      config: { auth_mode: "token", auto_sync: false, board_id: "987654321" },
      is_active: true,
      created_at: iso(18 * DAY),
    },
  ];

  const crm_sync_logs: CrmSyncLogRow[] = [
    { id: "s1", workspace_id: DEMO_WORKSPACE_ID, call_id: CALLS[0].id, provider: "hubspot", status: "synced", external_ref: "hs-note-88213", error: null, created_at: iso(1 * DAY + 3 * 60 * 60 * 1000) },
    { id: "s2", workspace_id: DEMO_WORKSPACE_ID, call_id: CALLS[2].id, provider: "hubspot", status: "synced", external_ref: "hs-deal-77120", error: null, created_at: iso(4 * DAY) },
    { id: "s3", workspace_id: DEMO_WORKSPACE_ID, call_id: CALLS[2].id, provider: "monday", status: "synced", external_ref: "mon-item-5521", error: null, created_at: iso(4 * DAY - 60 * 1000) },
    { id: "s4", workspace_id: DEMO_WORKSPACE_ID, call_id: CALLS[1].id, provider: "hubspot", status: "failed", external_ref: null, error: "Rate limited by HubSpot (429) — will retry", created_at: iso(2 * DAY) },
    { id: "s5", workspace_id: DEMO_WORKSPACE_ID, call_id: CALLS[4].id, provider: "monday", status: "synced", external_ref: "mon-item-5530", error: null, created_at: iso(1 * DAY) },
    { id: "s6", workspace_id: DEMO_WORKSPACE_ID, call_id: CALLS[7].id, provider: "hubspot", status: "synced", external_ref: "hs-deal-77140", error: null, created_at: iso(5 * DAY) },
    { id: "s7", workspace_id: DEMO_WORKSPACE_ID, call_id: CALLS[3].id, provider: "monday", status: "pending", external_ref: null, error: null, created_at: iso(6 * DAY) },
  ];

  const playbooks: PlaybookRow[] = [
    {
      id: "00000000-0000-0000-0000-0000000000c1",
      workspace_id: DEMO_WORKSPACE_ID,
      name: "BANT Discovery",
      description: "Classic BANT qualification for discovery calls.",
      language: "en",
      criteria: BANT_CRITERIA,
      is_default: true,
      created_at: iso(25 * DAY),
    },
    {
      id: "00000000-0000-0000-0000-0000000000c2",
      workspace_id: DEMO_WORKSPACE_ID,
      name: "כשירות מכירה B2B",
      description: "מסגרת כשירות למכירות B2B בעברית.",
      language: "he",
      criteria: B2B_HE_CRITERIA,
      is_default: false,
      created_at: iso(25 * DAY),
    },
  ];

  const workspace_api_keys: WorkspaceApiKeyRow[] = [
    {
      id: "00000000-0000-0000-0000-0000000000d1",
      workspace_id: DEMO_WORKSPACE_ID,
      label: "Zapier Production",
      key_prefix: "sd_live_8f2a4c",
      key_hash: "demo-sha256-not-a-real-hash",
      created_by: DEMO_USER_ID,
      last_used_at: iso(6 * 60 * 60 * 1000),
      revoked_at: null,
      created_at: iso(14 * DAY),
    },
    {
      id: "00000000-0000-0000-0000-0000000000d2",
      workspace_id: DEMO_WORKSPACE_ID,
      label: "Twilio Studio (test)",
      key_prefix: "sd_live_1b9e07",
      key_hash: "demo-sha256-not-a-real-hash-2",
      created_by: DEMO_USER_ID,
      last_used_at: null,
      revoked_at: null,
      created_at: iso(9 * DAY),
    },
  ];

  const workspace_alert_rules: WorkspaceAlertRuleRow[] = [
    {
      id: "00000000-0000-0000-0000-0000000000e1",
      workspace_id: DEMO_WORKSPACE_ID,
      webhook_url: "https://hooks.slack.com/services/DEMO/T000/B000/xxxxxxxxxxxx",
      triggers: ["on_high_risk_deal", "on_negative_sentiment"],
      is_active: true,
      created_at: iso(12 * DAY),
    },
  ];

  const leads: LeadRow[] = [];

  return {
    users: [user],
    workspaces: [workspace],
    workspace_members: [member],
    calls,
    transcripts,
    insights,
    crm_integrations,
    crm_sync_logs,
    playbooks,
    workspace_api_keys,
    workspace_alert_rules,
    leads,
  };
}

/** Stable count of demo calls, for tests and banners. */
export const DEMO_CALL_COUNT = CALLS.length;
