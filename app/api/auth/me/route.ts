import { NextResponse } from 'next/server';
import { getSessionUser, ensureDefaultAccountsAndSeed } from '@/lib/auth';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    await ensureDefaultAccountsAndSeed();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const pool = getPool();
    const res = await pool.query(
      'SELECT id, username, display_name, role, caisse_code, is_blocked, force_logout_at, custom_db_url FROM caisse_accounts WHERE id = $1',
      [session.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const account = res.rows[0];

    // 1. Check if caisse is blocked by Supervisor
    if (account.is_blocked && account.role === 'cashier') {
      const response = NextResponse.json(
        {
          authenticated: false,
          user: null,
          reason: 'blocked',
          error: `Votre caisse (${account.display_name}) a été temporairement bloquée à distance par le Superviseur.`,
        },
        { status: 403 }
      );
      response.cookies.delete('caisse_session');
      return response;
    }

    // 2. Check if a remote force-logout was triggered after this token was issued
    if (account.force_logout_at) {
      const forceLogoutMs = new Date(account.force_logout_at).getTime();
      const loginAtMs = session.loginAt || (session.iat ? session.iat * 1000 : 0);
      if (loginAtMs > 0 && forceLogoutMs > loginAtMs) {
        const response = NextResponse.json(
          {
            authenticated: false,
            user: null,
            reason: 'force_logout',
            error: `Votre session (${account.display_name}) a été déconnectée à distance par le Superviseur.`,
          },
          { status: 401 }
        );
        response.cookies.delete('caisse_session');
        return response;
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: account.id,
        username: account.username,
        displayName: account.display_name,
        role: account.role,
        caisseCode: account.caisse_code || '',
        isBlocked: Boolean(account.is_blocked),
        customDbUrl: account.custom_db_url,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erreur auth session' },
      { status: 500 }
    );
  }
}
