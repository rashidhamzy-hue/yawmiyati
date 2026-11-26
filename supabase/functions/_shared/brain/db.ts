// Tiny PostgREST client for the service role (server-side only).
export type Db = ReturnType<typeof createDb>;

export function createDb(url: string, serviceKey: string, fetchImpl: typeof fetch = fetch) {
  const base = url.replace(/\/$/, "") + "/rest/v1/";
  const headers = (extra: Record<string, string> = {}) => ({ apikey: serviceKey, authorization: "Bearer " + serviceKey, "content-type": "application/json", ...extra });
  async function req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
    const res = await fetchImpl(base + path, { method, headers: headers(extra), body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    if (!res.ok) throw Error(`db_${method}_${path.split("?")[0]}_${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }
  return {
    select: <T = Record<string, unknown>>(table: string, query: string) => req("GET", `${table}?${query}`) as Promise<T[]>,
    insert: (table: string, rows: unknown, returning = false) => req("POST", table, rows, { prefer: returning ? "return=representation" : "return=minimal" }),
    upsert: (table: string, rows: unknown, onConflict: string) => req("POST", `${table}?on_conflict=${onConflict}`, rows, { prefer: "resolution=merge-duplicates,return=minimal" }),
    patch: <T = Record<string, unknown>>(table: string, filter: string, body: unknown) => req("PATCH", `${table}?${filter}`, body, { prefer: "return=representation" }) as Promise<T[]>,
    rpc: <T = unknown>(fn: string, args: unknown) => req("POST", `rpc/${fn}`, args) as Promise<T>,
  };
}
