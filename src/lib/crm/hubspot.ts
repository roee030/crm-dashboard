import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto";
import { oauthConfig } from "./oauth";
import {
  type CrmCredentials,
  type CrmProvider,
  type SyncCall,
  type SyncInsight,
  type SyncResult,
  type TargetOption,
  type VerifyResult,
  formatNoteBody,
} from "./types";

const BASE = "https://api.hubapi.com";

// HUBSPOT_DEFINED association type ids (verified against the API spec).
export const HUBSPOT_ASSOC = {
  noteToContact: 202,
  noteToDeal: 214,
  taskToContact: 204,
  taskToDeal: 216,
} as const;

export type HsAssociation = {
  to: { id: string };
  types: { associationCategory: "HUBSPOT_DEFINED"; associationTypeId: number }[];
};

/** Pure helper: note associations to the contact (+ deal when present). */
export function buildNoteAssociations(contactId: string, dealId?: string | null): HsAssociation[] {
  const assocs: HsAssociation[] = [
    { to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: HUBSPOT_ASSOC.noteToContact }] },
  ];
  if (dealId) {
    assocs.push({ to: { id: dealId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: HUBSPOT_ASSOC.noteToDeal }] });
  }
  return assocs;
}

/** Pure helper: task associations to the contact (+ deal when present). */
export function buildTaskAssociations(contactId: string, dealId?: string | null): HsAssociation[] {
  const assocs: HsAssociation[] = [
    { to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: HUBSPOT_ASSOC.taskToContact }] },
  ];
  if (dealId) {
    assocs.push({ to: { id: dealId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: HUBSPOT_ASSOC.taskToDeal }] });
  }
  return assocs;
}

/**
 * Refresh a HubSpot OAuth access token when it is within 5 minutes of expiry,
 * persisting the re-encrypted tokens to crm_integrations. Returns the token to
 * use (new if refreshed, otherwise the current one).
 */
export async function refreshHubspotTokenIfNeeded(args: {
  workspaceId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
}): Promise<string> {
  if (!args.refreshToken || !args.expiresAt) return args.accessToken;
  const expMs = new Date(args.expiresAt).getTime();
  if (Number.isNaN(expMs) || expMs - Date.now() > 5 * 60 * 1000) return args.accessToken;

  const cfg = oauthConfig("hubspot");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: cfg.clientId ?? "",
    client_secret: cfg.clientSecret ?? "",
    refresh_token: args.refreshToken,
  });
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) return args.accessToken; // fall back; verify surfaces the failure
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };

  const expiresAt = json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null;
  const db = createAdminClient();
  await db
    .from("crm_integrations")
    .update({
      access_token: encryptSecret(json.access_token),
      refresh_token: encryptSecret(json.refresh_token ?? args.refreshToken),
      expires_at: expiresAt,
    })
    .eq("workspace_id", args.workspaceId)
    .eq("provider", "hubspot");

  return json.access_token;
}

export class HubSpotProvider implements CrmProvider {
  key = "hubspot" as const;
  constructor(private creds: CrmCredentials) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.creds.accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HubSpot ${res.status}: ${text.slice(0, 300)}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  async verifyConnection(): Promise<VerifyResult> {
    try {
      const info = await this.req<{ portalId?: number }>("/account-info/v3/details");
      return { ok: true, account: info.portalId ? `Portal ${info.portalId}` : "Connected" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async listTargets(): Promise<TargetOption[]> {
    const data = await this.req<{ results: { id: string; label: string }[] }>(
      "/crm/v3/pipelines/deals",
    );
    return (data.results ?? []).map((p) => ({ id: p.id, name: p.label }));
  }

  private async findContactId(call: SyncCall): Promise<string | null> {
    const tryFilter = async (propertyName: string, value: string) => {
      const body = {
        filterGroups: [{ filters: [{ propertyName, operator: "EQ", value }] }],
        properties: ["email"],
        limit: 1,
      };
      const data = await this.req<{ results: { id: string }[] }>(
        "/crm/v3/objects/contacts/search",
        { method: "POST", body: JSON.stringify(body) },
      );
      return data.results?.[0]?.id ?? null;
    };

    if (call.customer_email) {
      const id = await tryFilter("email", call.customer_email);
      if (id) return id;
    }
    if (call.customer_phone) {
      const id = await tryFilter("phone", call.customer_phone);
      if (id) return id;
    }
    if (call.customer_name) {
      const id = await tryFilter("firstname", call.customer_name);
      if (id) return id;
    }
    return null;
  }

  private async createContact(call: SyncCall): Promise<string> {
    const properties: Record<string, string> = {};
    if (call.customer_email) properties.email = call.customer_email;
    if (call.customer_phone) properties.phone = call.customer_phone;
    if (call.customer_name) properties.firstname = call.customer_name;
    const data = await this.req<{ id: string }>("/crm/v3/objects/contacts", {
      method: "POST",
      body: JSON.stringify({ properties }),
    });
    return data.id;
  }

  private async firstAssociatedDeal(contactId: string): Promise<string | null> {
    try {
      const data = await this.req<{ results: { toObjectId: string }[] }>(
        `/crm/v4/objects/contacts/${contactId}/associations/deals?limit=1`,
      );
      return data.results?.[0]?.toObjectId ?? null;
    } catch {
      return null;
    }
  }

  async sync(call: SyncCall, insight: SyncInsight): Promise<SyncResult> {
    const contactId = (await this.findContactId(call)) ?? (await this.createContact(call));
    const dealId = await this.firstAssociatedDeal(contactId);

    const noteAssocs = buildNoteAssociations(contactId, dealId);

    // 1) Engagement note.
    const note = await this.req<{ id: string }>("/crm/v3/objects/notes", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_note_body: formatNoteBody(call, insight),
          hs_timestamp: new Date().toISOString(),
        },
        associations: noteAssocs,
      }),
    });

    // 2) Update mapped deal stage.
    const mappedStage =
      insight.deal_stage_recommendation &&
      this.creds.config.deal_stage_map?.[insight.deal_stage_recommendation];
    if (dealId && mappedStage) {
      await this.req(`/crm/v3/objects/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: { dealstage: mappedStage } }),
      });
    }

    // 3) One task per action item.
    for (const item of insight.action_items) {
      const taskAssocs = buildTaskAssociations(contactId, dealId);
      await this.req("/crm/v3/objects/tasks", {
        method: "POST",
        body: JSON.stringify({
          properties: {
            hs_task_subject: item.text.slice(0, 120),
            hs_task_body: [item.text, item.owner, item.due_hint].filter(Boolean).join(" · "),
            hs_task_status: "NOT_STARTED",
            hs_task_priority: "MEDIUM",
            hs_timestamp: new Date().toISOString(),
          },
          associations: taskAssocs,
        }),
      });
    }

    let url: string | undefined;
    try {
      const info = await this.req<{ portalId?: number }>("/account-info/v3/details");
      if (info.portalId) {
        url = `https://app.hubspot.com/contacts/${info.portalId}/record/0-1/${contactId}`;
      }
    } catch {
      /* non-fatal */
    }

    return {
      externalRef: contactId,
      url,
      detail: `note ${note.id}${dealId ? `, deal ${dealId}` : ""}, ${insight.action_items.length} task(s)`,
    };
  }
}
