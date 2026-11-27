import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureDefaultAccountsAndSeed, getSessionUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { logAudit } from '@/lib/audit';

const CAISSE_ASSIGNMENTS = ['CRNU', 'CRSF', 'CRTN', 'SUPERVISEUR'] as const;

async function requireAdmin() {
  await ensureDefaultAccountsAndSeed();
  const session = await getSessionUser();
  if (!session) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  }
  const pool = getPool();
  const res = await pool.query('SELECT id, username, role, caisse_code FROM caisse_accounts WHERE id = $1', [
    session.id,
  ]);
  if (res.rows.length === 0 || res.rows[0].role !== 'admin') {
    return { error: NextResponse.json({ error: 'Réservé à l’administrateur.' }, { status: 403 }) };
  }
  return { pool, session: { ...session, username: res.rows[0].username } };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const res = await auth.pool.query(
      `SELECT id, username, display_name, role, caisse_code, is_blocked, created_at, updated_at
       FROM caisse_accounts
       ORDER BY role ASC, caisse_code ASC, username ASC`
    );
    return NextResponse.json({
      success: true,
      data: res.rows.map((r) => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        role: r.role,
        caisseCode: r.caisse_code || '',
        isBlocked: Boolean(r.is_blocked),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erreur de chargement' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const body = await req.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim();
    const assignment = String(body.assignment || '').toUpperCase();

    if (!username || username.length < 3) {
      return NextResponse.json({ error: 'Pseudo trop court (3 caractères minimum).' }, { status: 400 });
    }
    if (!password || password.length < 4) {
      return NextResponse.json({ error: 'Mot de passe trop court (4 caractères minimum).' }, { status: 400 });
    }
    if (!displayName) {
      return NextResponse.json({ error: 'Le nom affiché est obligatoire.' }, { status: 400 });
    }
    if (!CAISSE_ASSIGNMENTS.includes(assignment as (typeof CAISSE_ASSIGNMENTS)[number])) {
      return NextResponse.json(
        { error: 'Choisissez CRNU, CRSF, CRTN ou Superviseur.' },
        { status: 400 }
      );
    }

    const exists = await auth.pool.query('SELECT id FROM caisse_accounts WHERE LOWER(username) = $1', [
      username,
    ]);
    if (exists.rows.length > 0) {
      return NextResponse.json({ error: 'Ce pseudo existe déjà.' }, { status: 409 });
    }

    const role = assignment === 'SUPERVISEUR' ? 'superviseur' : 'cashier';
    const caisseCode = assignment === 'SUPERVISEUR' ? 'SUP' : assignment;
    const id = `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const hash = await bcrypt.hash(password, 10);

    await auth.pool.query(
      `INSERT INTO caisse_accounts (id, username, password_hash, display_name, role, caisse_code, is_blocked)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
      [id, username, hash, displayName, role, caisseCode]
    );

    await logAudit(
      auth.pool,
      auth.session,
      'account_create',
      { id, username, displayName, role, caisseCode, by: auth.session.username },
      caisseCode
    );

    return NextResponse.json({
      success: true,
      message: `Compte ${username} créé pour ${assignment === 'SUPERVISEUR' ? 'Superviseur' : `Caisse ${caisseCode}`}.`,
      id,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Création impossible' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const body = await req.json();
    const id = String(body.id || '');
    const action = String(body.action || '');
    if (!id) return NextResponse.json({ error: 'Compte manquant.' }, { status: 400 });

    const targetRes = await auth.pool.query(
      'SELECT id, username, role, caisse_code, display_name FROM caisse_accounts WHERE id = $1',
      [id]
    );
    if (targetRes.rows.length === 0) {
      return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
    }
    const target = targetRes.rows[0];
    if (target.role === 'admin') {
      return NextResponse.json({ error: 'Le compte administrateur ne peut pas être modifié ici.' }, { status: 403 });
    }

    if (action === 'block' || action === 'unblock') {
      const blocked = action === 'block';
      await auth.pool.query(
        `UPDATE caisse_accounts
         SET is_blocked = $2, force_logout_at = CASE WHEN $2 THEN NOW() ELSE force_logout_at END, updated_at = NOW()
         WHERE id = $1`,
        [id, blocked]
      );
      await logAudit(
        auth.pool,
        auth.session,
        blocked ? 'account_block' : 'account_unblock',
        { id, username: target.username, by: auth.session.username },
        target.caisse_code
      );
      return NextResponse.json({
        success: true,
        message: blocked
          ? `Compte ${target.username} bloqué.`
          : `Compte ${target.username} débloqué.`,
      });
    }

    if (action === 'password') {
      const password = String(body.password || '');
      if (password.length < 4) {
        return NextResponse.json({ error: 'Mot de passe trop court (4 caractères minimum).' }, { status: 400 });
      }
      const hash = await bcrypt.hash(password, 10);
      await auth.pool.query(
        `UPDATE caisse_accounts SET password_hash = $2, force_logout_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [id, hash]
      );
      await logAudit(
        auth.pool,
        auth.session,
        'account_password',
        { id, username: target.username, by: auth.session.username },
        target.caisse_code
      );
      return NextResponse.json({
        success: true,
        message: `Mot de passe de ${target.username} mis à jour. L’utilisateur devra se reconnecter.`,
      });
    }

    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Mise à jour impossible' }, { status: 500 });
  }
}
