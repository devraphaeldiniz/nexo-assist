import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AuthenticationError, NotFoundError } from '@/lib/errors';
import { SignJWT, jwtVerify } from 'jose';

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'dev-secret-change-in-production-min-32-chars!!'
);

const SESSION_COOKIE_NAME = 'nexod_session';

export interface SessionPayload {
  userId: number;
  email: string;
  name: string;
  role: 'employee' | 'analyst';
  exp: number;
}

export async function createSession(payload: Omit<SessionPayload, 'exp'>): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  return new SignJWT({ ...payload, exp })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(SESSION_SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSessionFromCookie(cookies: string): Promise<SessionPayload | null> {
  const match = cookies.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match?.[1]) return null;
  return verifySession(decodeURIComponent(match[1]));
}

// `user` é o shape retornado pelo Drizzle (`typeof users.$inferSelect`), mas
// preferimos não importar o tipo de linha do schema aqui para não acoplar o
// retorno público do service ao modelo de dados interno (service → db é uma
// via de mão única, mas o inverso não precisa "vazar" para os chamadores).
export async function authenticateUser(email: string, _password: string): Promise<{ user: any; token: string }> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user[0]) {
    throw new AuthenticationError('E-mail não encontrado');
  }

  const token = await createSession({
    userId: user[0].id,
    email: user[0].email,
    name: user[0].name,
    role: user[0].role,
  });

  return { user: user[0], token };
}

export async function getUserById(userId: number) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user[0]) {
    throw new NotFoundError('Usuário não encontrado');
  }

  return user[0];
}

export function getSessionCookieOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    },
  };
}