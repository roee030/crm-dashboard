import { describe, it, expect } from "vitest";
import { formatNoteBody } from "@/lib/crm/types";
import {
  HUBSPOT_ASSOC,
  buildNoteAssociations,
  buildTaskAssociations,
} from "@/lib/crm/hubspot";
import { buildStatusColumnValues } from "@/lib/crm/monday";

const call = {
  id: "c1",
  title: "Acme Discovery",
  customer_name: "Acme",
  customer_email: "a@acme.com",
  customer_phone: null,
};
const insight = {
  summary: "Good call",
  sentiment_label: "positive",
  sentiment_score: 0.6,
  objections: [{ text: "Too pricey", category: "price" }],
  action_items: [{ text: "Send ROI", owner: "AE", due_hint: "this week" }],
  deal_stage_recommendation: "Discovery",
};

describe("formatNoteBody", () => {
  it("includes summary, sentiment, objections and action items", () => {
    const body = formatNoteBody(call, insight);
    expect(body).toContain("Acme Discovery");
    expect(body).toContain("Good call");
    expect(body).toContain("Sentiment: positive (+60)");
    expect(body).toContain("[price] Too pricey");
    expect(body).toContain("Send ROI (AE, this week)");
  });

  it("preserves Hebrew content in the note body", () => {
    const body = formatNoteBody(
      { ...call, customer_name: "מובייל" },
      { ...insight, summary: "שיחה חיובית", objections: [{ text: "מחיר גבוה", category: "price" }] },
    );
    expect(body).toContain("שיחה חיובית");
    expect(body).toContain("מחיר גבוה");
  });
});

describe("HubSpot associations", () => {
  it("maps note associations to contact only when no deal", () => {
    const assoc = buildNoteAssociations("111");
    expect(assoc).toHaveLength(1);
    expect(assoc[0].types[0].associationTypeId).toBe(HUBSPOT_ASSOC.noteToContact);
    expect(assoc[0].types[0].associationCategory).toBe("HUBSPOT_DEFINED");
  });

  it("maps note associations to contact and deal", () => {
    const assoc = buildNoteAssociations("111", "222");
    expect(assoc).toHaveLength(2);
    expect(assoc[1].to.id).toBe("222");
    expect(assoc[1].types[0].associationTypeId).toBe(HUBSPOT_ASSOC.noteToDeal);
  });

  it("maps task associations with the correct type ids", () => {
    const assoc = buildTaskAssociations("111", "222");
    expect(assoc[0].types[0].associationTypeId).toBe(HUBSPOT_ASSOC.taskToContact);
    expect(assoc[1].types[0].associationTypeId).toBe(HUBSPOT_ASSOC.taskToDeal);
  });
});

describe("Monday column values", () => {
  it("builds valid status column_values JSON", () => {
    const vals = buildStatusColumnValues("status", "Negotiation");
    expect(JSON.parse(vals)).toEqual({ status: { label: "Negotiation" } });
  });
});
