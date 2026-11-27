import { NextRequest, NextResponse } from 'next/server';
import { ensureDefaultAccountsAndSeed, getSessionUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { logAudit } from '@/lib/audit';

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDefaultAccountsAndSeed();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const mainPool = getPool();
    const accRes = await mainPool.query(
      'SELECT id, role, display_name, caisse_code, is_blocked, custom_db_url FROM caisse_accounts WHERE id = $1',
      [session.id]
    );
    if (accRes.rows.length === 0) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
    }

    const account = accRes.rows[0];
    if (account.role === 'superviseur') {
      return NextResponse.json(
        { error: 'Le compte Superviseur est en mode consultation uniquement.' },
        { status: 403 }
      );
    }
    if (account.is_blocked && account.role === 'cashier') {
      return NextResponse.json(
        { error: 'Votre caisse est bloquée par le Superviseur.', reason: 'blocked' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const id = String(body.id || '').trim();
    const requestedOwner = String(body.accountId || '').trim();
    const recette = round3(Number(body.recette));
    const mtEspece = round3(Number(body.mtEspece));
    const versement = round3(Number(body.versement));

    if (!id) {
      return NextResponse.json({ error: 'Identifiant de transaction requis' }, { status: 400 });
    }
    if (![recette, mtEspece, versement].every((n) => Number.isFinite(n) && n >= 0)) {
      return NextResponse.json(
        { error: 'Les montants doivent être des nombres positifs ou nuls.' },
        { status: 400 }
      );
    }

    const ownerId = account.role === 'admin' ? requestedOwner || session.id : session.id;
    if (account.role !== 'admin' && requestedOwner && requestedOwner !== session.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez modifier que les lignes de votre caisse.' },
        { status: 403 }
      );
    }

    const ownerRes = await mainPool.query(
      'SELECT custom_db_url FROM caisse_accounts WHERE id = $1',
      [ownerId]
    );
    if (ownerRes.rows.length === 0) {
      return NextResponse.json({ error: 'Caisse introuvable.' }, { status: 404 });
    }
    const ownerUrl = ownerRes.rows[0].custom_db_url as string | null;
    const ownerPool = ownerUrl ? getPool(ownerUrl) : mainPool;

    const existing = await mainPool.query(
      'SELECT versement, recette, raw_data FROM caisse_transactions WHERE id = $1 AND account_id = $2',
      [id, ownerId]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Transaction introuvable pour cette caisse.' }, { status: 404 });
    }

    const oldVersement = parseFloat(existing.rows[0].versement) || 0;
    const oldRecette = parseFloat(existing.rows[0].recette) || 0;
    let raw = existing.rows[0].raw_data || {};
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = {};
      }
    }
    raw = { ...(raw || {}), recette, versement };

    const tPayer = round3(mtEspece + versement);
    const resAPayer = round3(tPayer - recette);
    const status = resAPayer >= 0 ? 'PAYE' : 'NON PAYE';

    const updateSql = `UPDATE caisse_transactions
       SET recette = $1, t_payer = $2, res_a_payer = $3, versement = $4, status = $5, raw_data = $6
       WHERE id = $7 AND account_id = $8`;
    const updateParams = [recette, tPayer, resAPayer, versement, status, JSON.stringify(raw), id, ownerId];
    await mainPool.query(updateSql, updateParams);
    if (ownerPool !== mainPool) {
      await ownerPool.query(updateSql, updateParams);
    }

    const deltaVer = round3(versement - oldVersement);
    const deltaRecette = round3(recette - oldRecette);
    if (deltaVer !== 0 || deltaRecette !== 0) {
      await ownerPool.query(
        `UPDATE caisse_billetterie
         SET ver = GREATEST(0, ver + $1),
             recette_theorique = GREATEST(0, recette_theorique + $2),
             updated_at = CURRENT_TIMESTAMP
         WHERE account_id = $3`,
        [deltaVer, deltaRecette, ownerId]
      );
    }

    await logAudit(
      mainPool,
      { id: session.id, username: session.username, caisseCode: account.caisse_code },
      'journal_edit',
      { id, ownerId, by: session.username, caisse: account.caisse_code },
      account.caisse_code
    );

    return NextResponse.json({
      success: true,
      transaction: {
        id,
        accountId: ownerId,
        recette,
        mtEspece,
        versement,
        tPayer,
        resAPayer,
        status,
      },
    });
  } catch (error: any) {
    console.error('Update transaction error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la modification' },
      { status: 500 }
    );
  }
}
