import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { CommerceEnv } from "@/lib/commerce/env";

export function commerceFixture() {
  const sql = new DatabaseSync(":memory:");
  const migrations = path.join(import.meta.dirname, "../migrations");
  for (const file of fs.readdirSync(migrations).filter((file) => file.endsWith(".sql")).sort()) {
    sql.exec(fs.readFileSync(path.join(migrations, file), "utf8"));
  }
  const prepare = (query: string) => {
    let args: (string | number | null)[] = [];
    const result = {
      bind(...values: (string | number | null)[]) { args = values; return result; },
      async first() { return sql.prepare(query).get(...args) ?? null; },
      async all() { return { results: sql.prepare(query).all(...args) }; },
      async run() { const run = sql.prepare(query).run(...args); return { meta: { changes: Number(run.changes) }, success: true }; },
    };
    return result;
  };
  const env = {
    COMMERCE_DB: { prepare }, AUTH_SECRET: "test-only-auth-secret-with-at-least-32-characters",
    RESEND_API_KEY: "test-only-mail-key", EMAIL_FROM: "Design for AI <hello@example.invalid>",
  } as unknown as CommerceEnv;
  return { sql, env };
}
