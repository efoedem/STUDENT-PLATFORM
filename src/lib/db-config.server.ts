/**
 * Database connection used by the app (server-side only).
 *
 * The app reads DATABASE_URL from the environment when it points at this
 * project's database. If the environment still holds an old connection
 * (for example the previous Neon database), the value below is used instead.
 *
 * Change this value if your database password changes.
 */
export const DEFAULT_DATABASE_URL =
  "postgresql://postgres:Titivate123456789@db.srqrupvntilfximrtfex.supabase.co:5432/postgres";

/** Connections we deliberately ignore because the app no longer uses them. */
export function isRetiredDatabaseUrl(url: string) {
  return url.includes("neon.tech");
}
