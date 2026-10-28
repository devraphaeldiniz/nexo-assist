import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/services/auth/service';
import { getUserById } from '@/services/auth/service';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request.headers.get('cookie') || '');
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const user = await getUserById(session.userId);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        department: user.department,
        role: user.role,
        avatarInitials: user.avatarInitials,
      },
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ user: null });
  }
}