import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { SignJWT, jwtVerify } from "jose";

import { q, q1 } from "./db.server";

const COOKIE = "edem_session";
const DAYS = 30;

function secret() {
  const raw =
    process.env["SESSION_SECRET"] ||
    process.env["DATABASE_URL"] ||
    "edem-development-secret-change-me";
  return new TextEncoder().encode(raw);
}

/* ---------------------------------- passwords --------------------------------- */

const ITERATIONS = 100_000;

function toB64(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  view.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromB64(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations: ITERATIONS },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const salt = fromB64(parts[2]!);
  const expected = fromB64(parts[3]!);
  const actual = await derive(password, salt);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

/* ----------------------------------- session ---------------------------------- */

export async function startSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DAYS}d`)
    .sign(secret());

  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  deleteCookie(COOKIE, { path: "/" });
}

export async function currentUserId(): Promise<string | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

import type { Viewer } from "./viewer";
export type { Viewer };

export async function loadViewer(): Promise<Viewer | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const user = await q1<{ id: string; email: string; status: string }>(
    `select u.id, u.email, coalesce(p.status,'active') as status
       from users u left join profiles p on p.id = u.id
      where u.id = $1`,
    [userId],
  );
  if (!user) return null;
  const roleRows = await q<{ role: string }>(`select role from user_roles where user_id = $1`, [
    userId,
  ]);
  const roles = roleRows.map((r) => r.role);
  return {
    userId: user.id,
    email: user.email,
    roles,
    isStaff: roles.includes("admin") || roles.includes("moderator"),
    isAdmin: roles.includes("admin"),
    status: user.status,
  };
}
