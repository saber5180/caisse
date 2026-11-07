import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { BilletterieHistoryEntry } from '@/types/caisse';

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const mainPool = getPool();
    const accRes = await mainPool.query(
      'SELECT id, custom_db_url FROM caisse_accounts WHERE id = $1',
      [session.id]
    );

    if (accRes.rows.length === 0) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
    }

    const account = accRes.rows[0];
    const targetPool = account.custom_db_url ? getPool(account.custom_db_url) : mainPool;

    const res = await targetPool.query(
      `SELECT id, account_id, date_cloture, total_coupures, srf_pieces, srf_moins, ver, tt_physique, recette_theorique, ecart_reste, items, archived_transactions, caissier_nom, notes, created_at
       FROM caisse_billetterie_history
       WHERE account_id = $1
       ORDER BY date_cloture DESC`,
      [session.id]
    );

    const history: BilletterieHistoryEntry[] = res.rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      dateCloture: r.date_cloture ? new Date(r.date_cloture).toISOString() : new Date().toISOString(),
      totalCoupures: parseFloat(r.total_coupures) || 0,
      srfPieces: parseFloat(r.srf_pieces) || 0,
      srfMoins: parseFloat(r.srf_moins) || 0,
      ver: parseFloat(r.ver) || 0,
      ttPhysique: parseFloat(r.tt_physique) || 0,
      recetteTheorique: parseFloat(r.recette_theorique) || 0,
      ecartReste: parseFloat(r.ecart_reste) || 0,
      items: Array.isArray(r.items) ? r.items : [],
      archivedTransactions: Array.isArray(r.archived_transactions) ? r.archived_transactions : [],
      caissierNom: r.caissier_nom || '',
      notes: r.notes || '',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));

    return NextResponse.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Billetterie history GET error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la récupération de l’historique' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json();
    const {
      totalCoupures = 0,
      srfPieces = 0,
      srfMoins = 0,
      ver = 0,
      ttPhysique = 0,
      recetteTheorique = 0,
      ecartReste = 0,
      items = [],
      notes = '',
    } = body;

    const id = `CLOT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const mainPool = getPool();
    const accRes = await mainPool.query(
      'SELECT id, custom_db_url, display_name FROM caisse_accounts WHERE id = $1',
      [session.id]
    );

    if (accRes.rows.length === 0) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
    }

    const account = accRes.rows[0];
    const targetPool = account.custom_db_url ? getPool(account.custom_db_url) : mainPool;

    // 1. Récupérer toutes les transactions actives de la journée pour les archiver
    const activeTransRes = await targetPool.query(
      `SELECT id, date, code_chauffeur, nom_chauffeur, recette, t_payer, res_a_payer, versement, status, raw_data
       FROM caisse_transactions
       WHERE account_id = $1
       ORDER BY date DESC`,
      [session.id]
    );

    const activeTransactions = activeTransRes.rows.map((r) => ({
      id: r.id,
      date: r.date ? new Date(r.date).toISOString() : new Date().toISOString(),
      codeChauffeur: r.code_chauffeur,
      nomChauffeur: r.nom_chauffeur,
      recette: parseFloat(r.recette) || 0,
      tPayer: parseFloat(r.t_payer) || 0,
      resAPayer: parseFloat(r.res_a_payer) || 0,
      versement: parseFloat(r.versement) || 0,
      status: r.status,
      rawData: r.raw_data || undefined,
    }));

    // 2. Enregistrer la clôture avec l'ensemble des transactions archivées
    await targetPool.query(
      `INSERT INTO caisse_billetterie_history (
        id, account_id, date_cloture, total_coupures, srf_pieces, srf_moins, ver, tt_physique, recette_theorique, ecart_reste, items, archived_transactions, caissier_nom, notes
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        session.id,
        totalCoupures,
        srfPieces,
        srfMoins,
        ver,
        ttPhysique,
        recetteTheorique,
        ecartReste,
        JSON.stringify(items),
        JSON.stringify(activeTransactions),
        session.username || account.display_name,
        notes,
      ]
    );

    // 3. Vider les transactions actives du journal en cours après clôture réussie
    await targetPool.query(
      'DELETE FROM caisse_transactions WHERE account_id = $1',
      [session.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Clôture de journée enregistrée avec succès !',
      id,
    });
  } catch (error: any) {
    console.error('Billetterie history POST error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de l’enregistrement de la clôture' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Identifiant requis' }, { status: 400 });
    }

    const mainPool = getPool();
    const accRes = await mainPool.query(
      'SELECT id, custom_db_url FROM caisse_accounts WHERE id = $1',
      [session.id]
    );

    if (accRes.rows.length === 0) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
    }

    const account = accRes.rows[0];
    const targetPool = account.custom_db_url ? getPool(account.custom_db_url) : mainPool;

    await targetPool.query(
      'DELETE FROM caisse_billetterie_history WHERE account_id = $1 AND id = $2',
      [session.id, id]
    );

    return NextResponse.json({ success: true, message: 'Clôture supprimée avec succès' });
  } catch (error: any) {
    console.error('Billetterie history DELETE error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}

