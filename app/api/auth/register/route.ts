import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool, cleanConnectionString, initDatabaseSchema } from '@/lib/db';
import { ensureDefaultAccountsAndSeed, signToken } from '@/lib/auth';
import { INITIAL_DRIVERS } from '@/data/initialDrivers';

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultAccountsAndSeed();
    const { username, password, displayName, customDbUrl } = await req.json();

    if (!username || !password || !displayName) {
      return NextResponse.json(
        { error: 'Le nom d’utilisateur, le mot de passe et le nom de la caisse sont requis.' },
        { status: 400 }
      );
    }

    const cleanUser = username.trim().toLowerCase();
    const pool = getPool();

    const exists = await pool.query(
      'SELECT id FROM caisse_accounts WHERE LOWER(username) = $1',
      [cleanUser]
    );

    if (exists.rows.length > 0) {
      return NextResponse.json(
        { error: 'Ce nom d’utilisateur existe déjà. Veuillez en choisir un autre.' },
        { status: 409 }
      );
    }

    // If custom database URL is provided, test it first
    let verifiedCustomDbUrl: string | null = null;
    if (customDbUrl && customDbUrl.trim().length > 0) {
      try {
        const testPool = getPool(customDbUrl.trim());
        await testPool.query('SELECT 1');
        await initDatabaseSchema(customDbUrl.trim());
        verifiedCustomDbUrl = customDbUrl.trim();
      } catch (err: any) {
        return NextResponse.json(
          { error: `Impossible de se connecter à la base de données personnalisée : ${err.message}` },
          { status: 400 }
        );
      }
    }

    const accountId = `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO caisse_accounts (id, username, password_hash, display_name, role, custom_db_url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [accountId, cleanUser, hash, displayName.trim(), 'cashier', verifiedCustomDbUrl]
    );

    // Target pool for driver initialization
    const user = {
      id: accountId,
      username: cleanUser,
      displayName: displayName.trim(),
      role: 'cashier',
      customDbUrl: verifiedCustomDbUrl,
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
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la création du compte' },
      { status: 500 }
    );
  }
}

