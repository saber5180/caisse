import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { ensureDefaultAccountsAndSeed, getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    await ensureDefaultAccountsAndSeed();
    const { password } = await req.json();
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Mot de passe administrateur requis.' }, { status: 400 });
    }

    const pool = getPool();
    const res = await pool.query(
      `SELECT password_hash FROM caisse_accounts WHERE role = 'admin'`
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Aucun compte administrateur.' }, { status: 403 });
    }

    for (const row of res.rows) {
      const ok = await bcrypt.compare(password, row.password_hash);
      if (ok) return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Mot de passe administrateur incorrect.' }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Vérification impossible.' },
      { status: 500 }
    );
  }
}
