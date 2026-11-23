export type DemoUtterance = { speaker: string; text: string };

export type DemoCall = {
  key: "en" | "he";
  label: string;
  language: string;
  customer: string;
  transcript: DemoUtterance[];
  insights: {
    summary: string;
    sentiment: string;
    objections: { text: string; category: string }[];
    action_items: string[];
    deal_stage: string;
  };
  followUpEmail: { subject: string; body: string };
  hubspotPayload: Record<string, unknown>;
  mondayPayload: Record<string, unknown>;
};

export const DEMO_CALLS: DemoCall[] = [
  {
    key: "en",
    label: "English · B2B SaaS",
    language: "en",
    customer: "Northwind Analytics",
    transcript: [
      { speaker: "A", text: "Thanks for hopping on. We've been drowning in manual CRM updates after every call." },
      { speaker: "B", text: "That's exactly what we fix. How many reps are logging notes today?" },
      { speaker: "A", text: "About twelve. Honestly the pricing feels a bit high versus what we budgeted." },
      { speaker: "B", text: "Fair — let's look at the time saved per rep. If each saves 30 minutes a day…" },
      { speaker: "A", text: "If you can prove that ROI, we'd want to start a pilot next quarter." },
    ],
    insights: {
      summary:
        "Northwind is losing time to manual CRM entry across 12 reps. Strong interest, gated on price justification and a Q2 pilot.",
      sentiment: "positive",
      objections: [
        { text: "Pricing feels high versus budget", category: "price" },
        { text: "Wants proof of ROI before committing", category: "trust" },
      ],
      action_items: ["Send ROI model (30 min/rep/day)", "Propose Q2 pilot scope"],
      deal_stage: "Discovery",
    },
    followUpEmail: {
      subject: "ROI model + pilot plan for Northwind",
      body:
        "Hi there,\n\nGreat speaking today. You flagged two things: pricing vs. budget, and proof of ROI before committing.\n\nAttached is an ROI model assuming each of your 12 reps saves ~30 minutes/day on CRM entry — that's roughly 30 hours/week back to selling. I've also outlined a lightweight Q2 pilot so you can validate before scaling.\n\nWant to grab 20 minutes next week to walk through it?\n\nBest,\nAlex",
    },
    hubspotPayload: {
      note: { hs_note_body: "SignalDesk — Northwind Analytics: positive (+62). Objections: price, trust.", associations: ["contact:202", "deal:214"] },
      dealUpdate: { dealstage: "appointmentscheduled" },
      tasks: [{ hs_task_subject: "Send ROI model (30 min/rep/day)" }, { hs_task_subject: "Propose Q2 pilot scope" }],
    },
    mondayPayload: {
      create_update: { item: "Northwind Analytics", body: "Summary + sentiment + objections…" },
      status: { column: "status", label: "Discovery" },
      subitems: ["Send ROI model (30 min/rep/day)", "Propose Q2 pilot scope"],
    },
  },
  {
    key: "he",
    label: "עברית · שיחת מכירה",
    language: "he",
    customer: "מובייל פלוס",
    transcript: [
      { speaker: "A", text: "תודה שהצטרפת. אנחנו מבזבזים המון זמן על עדכון ה-CRM אחרי כל שיחה." },
      { speaker: "B", text: "זה בדיוק מה שאנחנו פותרים. כמה אנשי מכירות מתעדים היום?" },
      { speaker: "A", text: "בערך עשרה. האמת שהמחיר קצת גבוה ממה שתכננו בתקציב." },
      { speaker: "B", text: "הוגן. בוא נסתכל על הזמן שנחסך לכל נציג בכל יום." },
      { speaker: "A", text: "אם נגיע להסכמה על תנאי התשלום, נתקדם לחתימה החודש." },
    ],
    insights: {
      summary:
        "מובייל פלוס מבזבזת זמן על תיעוד ידני. עניין חיובי, נותרו תנאי תשלום לסגירה החודש.",
      sentiment: "positive",
      objections: [{ text: "המחיר גבוה מהתקציב", category: "price" }],
      action_items: ["להכין טיוטת חוזה", "לשלוח מודל ROI"],
      deal_stage: "Negotiation",
    },
    followUpEmail: {
      subject: "סיכום שיחה והמשך תהליך — מובייל פלוס",
      body:
        "שלום,\n\nתודה על השיחה היום. ציינת שני דברים: המחיר מול התקציב, והרצון להתקדם לחתימה החודש.\n\nמצורפת טיוטת חוזה וכן מודל ROI שמראה את הזמן הנחסך לכל נציג ביום. נשמח לסגור את תנאי התשלום השבוע כדי להתקדם.\n\nאשמח לתאם 20 דקות מחר.\n\nבברכה,\nדנה",
    },
    hubspotPayload: {
      note: { hs_note_body: "SignalDesk — מובייל פלוס: positive (+70). Objections: price.", associations: ["contact:202", "deal:214"] },
      dealUpdate: { dealstage: "contractsent" },
      tasks: [{ hs_task_subject: "להכין טיוטת חוזה" }, { hs_task_subject: "לשלוח מודל ROI" }],
    },
    mondayPayload: {
      create_update: { item: "מובייל פלוס", body: "סיכום + סנטימנט + התנגדויות…" },
      status: { column: "status", label: "Negotiation" },
      subitems: ["להכין טיוטת חוזה", "לשלוח מודל ROI"],
    },
  },
];
