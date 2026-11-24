/**
 * In-memory Supabase-compatible client for zero-env demo mode.
 *
 * Implements the slice of the supabase-js query builder the app actually uses
 * (`.from(table).select/insert/update/upsert/delete` + `.eq/.neq/.gte/.lte/.gt/
 * .lt/.in/.order/.limit/.maybeSingle/.single`, `.auth.getUser`, and
 * `.storage.from().createSignedUrl/upload`) over the bilingual demo dataset.
 *
 * Reads are served from a module-level store; writes mutate it (ephemeral, per
 * server process). The store is seeded once from `buildDemoData()`.
 */
import { buildDemoData, type DemoData } from "./data";
import { DEMO_USER_EMAIL, DEMO_USER_ID } from "./mode";

type Row = Record<string, unknown>;
type TableName = keyof DemoData;

let store: DemoData | null = null;
function getStore(): DemoData {
  if (!store) store = buildDemoData();
  return store;
}

/** Reset the store — used by tests to guarantee isolation. */
export function __resetDemoStore() {
  store = null;
}

type Filter = { op: string; col: string; val: unknown };
type Order = { col: string; asc: boolean };
type Result<T = unknown> = { data: T; error: null; count: number | null };

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a < b) return -1;
  return 1;
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    const v = row[f.col];
    switch (f.op) {
      case "eq":
        return v === f.val;
      case "neq":
        return v !== f.val;
      case "gte":
        return v != null && (v as number | string) >= (f.val as number | string);
      case "lte":
        return v != null && (v as number | string) <= (f.val as number | string);
      case "gt":
        return v != null && (v as number | string) > (f.val as number | string);
      case "lt":
        return v != null && (v as number | string) < (f.val as number | string);
      case "in":
        return Array.isArray(f.val) && (f.val as unknown[]).includes(v);
      case "is":
        return v === f.val;
      default:
        return true;
    }
  });
}

function randomId(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `demo-${Date.now().toString(16)}-${Math.floor(Math.random() * 1e9).toString(16)}`;
  }
}

class DemoQuery implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitN: number | null = null;
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private onConflict: string[] = [];
  private singleRow = false;
  private maybe = false;
  private wantCount = false;
  private head = false;
  private returnSelect = false;

  constructor(private table: TableName) {}

  private rows(): Row[] {
    return getStore()[this.table] as unknown as Row[];
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }): this {
    this.returnSelect = true;
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.head = true;
    return this;
  }
  eq(col: string, val: unknown): this {
    this.filters.push({ op: "eq", col, val });
    return this;
  }
  neq(col: string, val: unknown): this {
    this.filters.push({ op: "neq", col, val });
    return this;
  }
  gte(col: string, val: unknown): this {
    this.filters.push({ op: "gte", col, val });
    return this;
  }
  lte(col: string, val: unknown): this {
    this.filters.push({ op: "lte", col, val });
    return this;
  }
  gt(col: string, val: unknown): this {
    this.filters.push({ op: "gt", col, val });
    return this;
  }
  lt(col: string, val: unknown): this {
    this.filters.push({ op: "lt", col, val });
    return this;
  }
  in(col: string, val: unknown[]): this {
    this.filters.push({ op: "in", col, val });
    return this;
  }
  is(col: string, val: unknown): this {
    this.filters.push({ op: "is", col, val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }): this {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  insert(payload: Row | Row[]): this {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row): this {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: Row | Row[], opts?: { onConflict?: string }): this {
    this.op = "upsert";
    this.payload = payload;
    this.onConflict = (opts?.onConflict ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return this;
  }
  delete(): this {
    this.op = "delete";
    return this;
  }
  maybeSingle(): this {
    this.maybe = true;
    return this;
  }
  single(): this {
    this.singleRow = true;
    return this;
  }

  private applyOrder(rows: Row[]): Row[] {
    if (this.orders.length === 0) return rows;
    const out = [...rows];
    out.sort((a, b) => {
      for (const o of this.orders) {
        const d = cmp(a[o.col], b[o.col]);
        if (d !== 0) return o.asc ? d : -d;
      }
      return 0;
    });
    return out;
  }

  private withDefaults(row: Row): Row {
    const copy: Row = { ...row };
    if (copy.id == null) copy.id = randomId();
    if (copy.created_at == null) copy.created_at = new Date().toISOString();
    return copy;
  }

  private run(): Result {
    const table = this.rows();

    if (this.op === "select") {
      const matched = table.filter((r) => matches(r, this.filters));
      if (this.head) return { data: null, error: null, count: matched.length };
      let out = this.applyOrder(matched);
      if (this.limitN != null) out = out.slice(0, this.limitN);
      if (this.singleRow || this.maybe) {
        return { data: out[0] ?? null, error: null, count: this.wantCount ? matched.length : null };
      }
      return { data: out, error: null, count: this.wantCount ? matched.length : null };
    }

    if (this.op === "insert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]).map((r) =>
        this.withDefaults(r),
      );
      table.push(...items);
      const data = this.returnSelect ? (this.singleRow ? items[0] ?? null : items) : null;
      return { data, error: null, count: null };
    }

    if (this.op === "update") {
      const patch = (this.payload ?? {}) as Row;
      const affected: Row[] = [];
      for (const r of table) {
        if (matches(r, this.filters)) {
          Object.assign(r, patch);
          affected.push(r);
        }
      }
      const data = this.returnSelect ? (this.singleRow ? affected[0] ?? null : affected) : null;
      return { data, error: null, count: null };
    }

    if (this.op === "upsert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const affected: Row[] = [];
      for (const item of items) {
        const existing =
          this.onConflict.length > 0
            ? table.find((r) => this.onConflict.every((k) => r[k] === item[k]))
            : undefined;
        if (existing) {
          Object.assign(existing, item);
          affected.push(existing);
        } else {
          const created = this.withDefaults(item);
          table.push(created);
          affected.push(created);
        }
      }
      const data = this.returnSelect ? (this.singleRow ? affected[0] ?? null : affected) : null;
      return { data, error: null, count: null };
    }

    // delete
    const removed: Row[] = [];
    for (let i = table.length - 1; i >= 0; i--) {
      if (matches(table[i], this.filters)) removed.push(...table.splice(i, 1));
    }
    const data = this.returnSelect ? removed : null;
    return { data, error: null, count: null };
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

function demoStorageBucket() {
  return {
    async createSignedUrl(path: string) {
      return { data: { signedUrl: `/api/demo/audio/${encodeURIComponent(path)}` }, error: null };
    },
    async upload() {
      return { data: { path: "demo" }, error: null };
    },
    async remove() {
      return { data: [], error: null };
    },
  };
}

/** Build a demo client that quacks like a Supabase server/admin client. */
export function createDemoClient() {
  return {
    from(table: TableName) {
      return new DemoQuery(table);
    },
    auth: {
      async getUser() {
        return { data: { user: { id: DEMO_USER_ID, email: DEMO_USER_EMAIL } }, error: null };
      },
      async getSession() {
        return { data: { session: { user: { id: DEMO_USER_ID, email: DEMO_USER_EMAIL } } }, error: null };
      },
      // Auth is a no-op in demo mode: any credentials "succeed" into the demo tenant.
      async signInWithPassword() {
        return { data: { user: { id: DEMO_USER_ID, email: DEMO_USER_EMAIL }, session: {} }, error: null };
      },
      async signUp() {
        return { data: { user: { id: DEMO_USER_ID, email: DEMO_USER_EMAIL }, session: {} }, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
    storage: {
      from() {
        return demoStorageBucket();
      },
    },
  };
}

export type DemoClient = ReturnType<typeof createDemoClient>;
