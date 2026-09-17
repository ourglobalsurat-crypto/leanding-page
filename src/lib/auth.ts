import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSql } from "@/lib/db";

const COOKIE_NAME = "gs_admin_session";
const FAKE_PASSWORD_HASH =
  "$2b$12$G7z.hR09kIZ2eUDKDz9ZH.Mk8.kKsoXJ25VbwBLW3lhsK9TO6s0rC";

export type AdminSession = {
  id: string;
  email: string;
  role: "owner" | "editor" | "viewer";
};

type AdminRow = {
  id: string;
  email: string;
  password_hash: string;
  role: AdminSession["role"];
  is_active: boolean;
};

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function findAdminByEmail(email: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `SELECT id, email, password_hash, role, is_active
     FROM admin_users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email.trim()],
  )) as AdminRow[];
  return rows[0] ?? null;
}

export async function validateAdminCredentials(email: string, password: string) {
  const admin = await findAdminByEmail(email);
  const matches = await bcrypt.compare(
    password,
    admin?.password_hash ?? FAKE_PASSWORD_HASH,
  );

  if (!admin || !matches || !admin.is_active) return null;

  return { id: admin.id, email: admin.email, role: admin.role } satisfies AdminSession;
}

export async function createAdminSession(admin: AdminSession) {
  const token = await new SignJWT({ email: admin.email, role: admin.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
    priority: "high",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });

    if (!payload.sub || typeof payload.email !== "string") return null;

    const sql = getSql();
    const rows = (await sql.query(
      `SELECT id, email, role, is_active
       FROM admin_users
       WHERE id = $1
       LIMIT 1`,
      [payload.sub],
    )) as Omit<AdminRow, "password_hash">[];
    const admin = rows[0];

    if (!admin?.is_active) return null;

    return { id: admin.id, email: admin.email, role: admin.role };
  } catch {
    return null;
  }
}

export async function requireAdmin(adminSlug: string) {
  const admin = await getAdminSession();
  if (!admin) redirect(`/${adminSlug}/login`);
  return admin;
}
