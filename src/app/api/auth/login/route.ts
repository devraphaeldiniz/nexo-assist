import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSessionCookieOptions } from '@/services/auth/service';
import { ensureDb } from '@/lib/ensure-db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await ensureDb();
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
    }

    const { user, token } = await authenticateUser(email, password);

    const { name, options } = getSessionCookieOptions();
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        department: user.department,
        role: user.role,
        avatarInitials: user.avatarInitials,
      },
      redirectTo: user.role === 'analyst' ? '/console' : '/chat',
    });

    response.cookies.set(name, token, options);

    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes('não encontrado')) {
      return NextResponse.json({ error: 'E-mail não encontrado' }, { status: 401 });
    }
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 });
  }
}