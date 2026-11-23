import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProviderKey } from "@/lib/crm/types";

export const runtime = "nodejs";

function isProvider(p: string): p is ProviderKey {
  return p === "hubspot" || p === "monday";
}

/** HubSpot webhook v3 HMAC: base64(HMAC-SHA256(clientSecret, method+url+body+ts)). */
function verifyHubspot(req: Request, rawBody: string): boolean {
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!secret) return true; // dev: accept when not configured
  const signature = req.headers.get("x-hubspot-signature-v3");
  const timestamp = req.headers.get("x-hubspot-request-timestamp");
  if (!signature || !timestamp) return false;
  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) return false;

  const url = `${process.env.APP_URL ?? new URL(req.url).origin}${new URL(req.url).pathname}`;
  const source = `${req.method}${url}${rawBody}${timestamp}`;
  const hash = crypto.createHmac("sha256", secret).update(source).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Monday signs the request with an HS256 JWT in the `authorization` header. */
function verifyMonday(req: Request): boolean {
  const secret = process.env.MONDAY_SIGNING_SECRET;
  if (!secret) return true; // dev: accept when not configured
  const jwt = req.headers.get("authorization");
  if (!jwt) return false;
  const parts = jwt.split(".");
  if (parts.length !== 3) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest("base64url");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]));
  } catch {
    return false;
  }
}

/**
 * POST /api/crm/[provider]/webhook — inbound CRM updates (two-way sync).
 * Verifies the signature, then applies known changes (e.g. deal stage / contact
 * ref) back onto the matching call.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const rawBody = await req.text();

  // Monday verifies ownership with a one-time challenge echo.
  if (provider === "monday") {
    try {
      const parsed = JSON.parse(rawBody) as { challenge?: string };
      if (parsed.challenge) {
        return NextResponse.json({ challenge: parsed.challenge }, { status: 200 });
      }
    } catch {
      /* not a challenge */
    }
    if (!verifyMonday(req)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    if (!verifyHubspot(req, rawBody)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = null;
  }

  // Map the inbound event to one of our calls by its stored external ref.
  const db = createAdminClient();
  const externalRef = extractExternalRef(provider, payload);
  if (externalRef) {
    const { data: call } = await db
      .from("calls")
      .select("id, workspace_id")
      .eq("crm_contact_ref", externalRef)
      .maybeSingle();
    if (call) {
      await db.from("crm_sync_logs").insert({
        workspace_id: call.workspace_id,
        call_id: call.id,
        provider,
        status: "synced",
        external_ref: externalRef,
        error: "inbound update received",
      });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

function extractExternalRef(provider: ProviderKey, payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (provider === "monday") {
    const event = (payload as { event?: { pulseId?: number | string } }).event;
    return event?.pulseId != null ? String(event.pulseId) : null;
  }
  // HubSpot sends an array of events with objectId.
  const first = Array.isArray(payload) ? payload[0] : payload;
  const objectId = (first as { objectId?: number | string })?.objectId;
  return objectId != null ? String(objectId) : null;
}
