import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { ensureDefaultAccountsAndSeed, signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultAccountsAndSeed();
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Veuillez saisir votre nom d’utilisateur et mot de passe' },
        { status: 400 }
      );
    }

    const pool = getPool();
    const res = await pool.query(
      'SELECT id, username, password_hash, display_name, role, custom_db_url FROM caisse_accounts WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: 'Compte introuvable. Vérifiez vos identifiants ou créez un compte.' },
        { status: 401 }
      );
    }

    const account = res.rows[0];
    const match = await bcrypt.compare(password, account.password_hash);
    if (!match) {
      return NextResponse.json(
        { error: 'Mot de passe incorrect.' },
        { status: 401 }
      );
    }

    const user = {
      id: account.id,
      username: account.username,
      displayName: account.display_name,
      role: account.role,
      customDbUrl: account.custom_db_url,
    };

    const token = signToken(user);

    const response = NextResponse.json({ success: true, user });
    response.cookies.set({
      name: 'caisse_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur interne de connexion' },
      { status: 500 }
    );
  }
}

