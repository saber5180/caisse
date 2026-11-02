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

    // Refresh from DB to get latest customDbUrl / displayName
    const pool = getPool();
    const res = await pool.query(
      'SELECT id, username, display_name, role, custom_db_url FROM caisse_accounts WHERE id = $1',
      [session.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const account = res.rows[0];
    return NextResponse.json({
      authenticated: true,
      user: {
        id: account.id,
        username: account.username,
        displayName: account.display_name,
        role: account.role,
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

