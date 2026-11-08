import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, ensureDefaultAccountsAndSeed } from '@/lib/auth';
import { getPool } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultAccountsAndSeed();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const pool = getPool();
    const meRes = await pool.query(
      'SELECT role FROM caisse_accounts WHERE id = $1',
      [session.id]
    );
    const myRole = meRes.rows[0]?.role || session.role;

    if (myRole !== 'superviseur' && myRole !== 'admin') {
      return NextResponse.json(
        { error: 'Accès réservé au Superviseur ou à l’Administrateur.' },
        { status: 403 }
      );
    }

    const { accountId, action } = await req.json();
    if (!accountId || !['block', 'unblock', 'force_logout'].includes(action)) {
      return NextResponse.json(
        { error: 'Paramètres de contrôle invalides.' },
        { status: 400 }
      );
    }

    const targetRes = await pool.query(
      'SELECT id, display_name, caisse_code FROM caisse_accounts WHERE id = $1',
      [accountId]
    );

    if (targetRes.rows.length === 0) {
      return NextResponse.json({ error: 'Caisse introuvable.' }, { status: 404 });
    }

    const target = targetRes.rows[0];
    const label = target.caisse_code || target.display_name;

    if (action === 'block') {
      await pool.query(
        `UPDATE caisse_accounts
         SET is_blocked = TRUE, force_logout_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [accountId]
      );
      return NextResponse.json({
        success: true,
        message: `La caisse ${label} a été bloquée à distance et sa session a été déconnectée.`,
      });
    } else if (action === 'unblock') {
      await pool.query(
        `UPDATE caisse_accounts
         SET is_blocked = FALSE, updated_at = NOW()
         WHERE id = $1`,
        [accountId]
      );
      return NextResponse.json({
        success: true,
        message: `La caisse ${label} a été débloquée et peut à nouveau se connecter.`,
      });
    } else {
      // force_logout
      await pool.query(
        `UPDATE caisse_accounts
         SET force_logout_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [accountId]
      );
      return NextResponse.json({
        success: true,
        message: `Déconnexion forcée envoyée avec succès à la caisse ${label}.`,
      });
    }
  } catch (error: any) {
    console.error('Supervisor control error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de l’exécution de la commande' },
      { status: 500 }
    );
  }
}

