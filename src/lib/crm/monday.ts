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

const ENDPOINT = "https://api.monday.com/v2";

/** Pure helper: Monday status column_values JSON for a mapped label. */
export function buildStatusColumnValues(columnId: string, label: string): string {
  return JSON.stringify({ [columnId]: { label } });
}

export class MondayProvider implements CrmProvider {
  key = "monday" as const;
  constructor(private creds: CrmCredentials) {}

  private async gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: this.creds.accessToken,
        "Content-Type": "application/json",
        "API-Version": "2024-10",
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) {
      throw new Error(`Monday: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    if (!res.ok || !json.data) {
      throw new Error(`Monday HTTP ${res.status}`);
    }
    return json.data;
  }

  async verifyConnection(): Promise<VerifyResult> {
    try {
      const data = await this.gql<{ me: { name: string } }>("query { me { name } }");
      return { ok: true, account: data.me?.name ?? "Connected" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async listTargets(): Promise<TargetOption[]> {
    const data = await this.gql<{ boards: { id: string; name: string }[] }>(
      "query { boards(limit: 100, order_by: used_at) { id name } }",
    );
    return (data.boards ?? []).map((b) => ({ id: String(b.id), name: b.name }));
  }

  private async findItemId(boardId: string, name: string): Promise<string | null> {
    const data = await this.gql<{
      items_page_by_column_values: { items: { id: string }[] };
    }>(
      `query ($boardId: ID!, $name: String!) {
        items_page_by_column_values(board_id: $boardId, columns: [{column_id: "name", column_values: [$name]}]) {
          items { id }
        }
      }`,
      { boardId, name },
    );
    return data.items_page_by_column_values?.items?.[0]?.id ?? null;
  }

  private async createItem(boardId: string, name: string): Promise<string> {
    const data = await this.gql<{ create_item: { id: string } }>(
      `mutation ($boardId: ID!, $name: String!) {
        create_item(board_id: $boardId, item_name: $name) { id }
      }`,
      { boardId, name },
    );
    return data.create_item.id;
  }

  async sync(call: SyncCall, insight: SyncInsight): Promise<SyncResult> {
    const boardId = this.creds.config.board_id;
    if (!boardId) throw new Error("No Monday board_id configured");

    const itemName = call.customer_name || call.title || "SignalDesk call";
    const itemId = (await this.findItemId(boardId, itemName)) ?? (await this.createItem(boardId, itemName));

    // 1) Post the summary/sentiment/objections as an update.
    await this.gql(
      `mutation ($itemId: ID!, $body: String!) {
        create_update(item_id: $itemId, body: $body) { id }
      }`,
      { itemId, body: formatNoteBody(call, insight) },
    );

    // 2) Update mapped status column.
    const statusCol = this.creds.config.status_column_id;
    const mapped =
      insight.deal_stage_recommendation &&
      this.creds.config.status_map?.[insight.deal_stage_recommendation];
    if (statusCol && mapped) {
      await this.gql(
        `mutation ($boardId: ID!, $itemId: ID!, $vals: JSON!) {
          change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $vals) { id }
        }`,
        { boardId, itemId, vals: buildStatusColumnValues(statusCol, mapped) },
      );
    }

    // 3) Create a subitem per action item.
    for (const item of insight.action_items) {
      await this.gql(
        `mutation ($parent: ID!, $name: String!) {
          create_subitem(parent_item_id: $parent, item_name: $name) { id }
        }`,
        { parent: itemId, name: item.text.slice(0, 250) },
      );
    }

    return {
      externalRef: String(itemId),
      detail: `item ${itemId}, ${insight.action_items.length} subitem(s)`,
    };
  }
}
