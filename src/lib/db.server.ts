import postgres from "postgres";

import { DEFAULT_DATABASE_URL, isRetiredDatabaseUrl } from "./db-config.server";

type Row = Record<string, any>;

let _sql: ReturnType<typeof postgres> | undefined;

function resolveUrl() {
  const fromEnv = process.env["DATABASE_URL"];
  if (fromEnv && !isRetiredDatabaseUrl(fromEnv)) return fromEnv;
  return DEFAULT_DATABASE_URL;
}

function client() {
  if (!_sql) {
    const url = resolveUrl();
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Add your Supabase database connection string to the environment.",
      );
    }

    _sql = postgres(url, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
      ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
    });
  }
  return _sql;
}

/** Run a parameterised SQL query against the database and return the rows. */
export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await client().unsafe(text, params as any[]);
  return rows as unknown as T[];
}

/** Run a query and return the first row (or null). */
export async function q1<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}
