import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { Driver, TransactionRecord, BilletterieItem, DeskRow } from '@/types/caisse';

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

    // 1. Fetch drivers for this account
    const driversRes = await targetPool.query(
      `SELECT id, nom, tr, statut, date_derniere, reclamation, caisses_dues, programme_jour, circuit_actuel
       FROM caisse_drivers
       WHERE account_id = $1
       ORDER BY tr ASC, nom ASC`,
      [session.id]
    );

    const drivers: Driver[] = driversRes.rows.map((r) => ({
      id: r.id,
      nom: r.nom,
      tr: r.tr,
      statut: r.statut,
      dateDerniere: r.date_derniere ? new Date(r.date_derniere).toISOString() : new Date().toISOString(),
      reclamation: r.reclamation || '',
      caissesDues: r.caisses_dues || 0,
      programmeJour: r.programme_jour || '',
      circuitActuel: r.circuit_actuel || '',
    }));

    // 2. Fetch transactions for this account
    const transRes = await targetPool.query(
      `SELECT id, date, code_chauffeur, nom_chauffeur, recette, t_payer, res_a_payer, versement, status, raw_data
       FROM caisse_transactions
       WHERE account_id = $1
       ORDER BY date DESC`,
      [session.id]
    );

    const transactions: TransactionRecord[] = transRes.rows.map((r) => ({
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

    // 3. Fetch billetterie for this account
    const billRes = await targetPool.query(
      'SELECT items, srf_moins, ver, recette_theorique FROM caisse_billetterie WHERE account_id = $1',
      [session.id]
    );
    let billetterie = null;
    if (billRes.rows.length > 0) {
      const b = billRes.rows[0];
      billetterie = {
        items: b.items as BilletterieItem[],
        srfMoins: parseFloat(b.srf_moins) || 0,
        ver: parseFloat(b.ver) || 0,
        recetteTheorique: parseFloat(b.recette_theorique) || 0,
      };
    }

    // 4. Fetch desk state for this account
    const deskRes = await targetPool.query(
      'SELECT desk_rows, desk_recette, desk_versement, desk_tr_input, selected_driver_id FROM caisse_desk_state WHERE account_id = $1',
      [session.id]
    );
    let deskState = null;
    if (deskRes.rows.length > 0) {
      const d = deskRes.rows[0];
      deskState = {
        deskRows: d.desk_rows as DeskRow[],
        deskRecette: parseFloat(d.desk_recette) || 0,
        deskVersement: parseFloat(d.desk_versement) || 0,
        deskTrInput: d.desk_tr_input || '',
        selectedDriverId: d.selected_driver_id || null,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        drivers,
        transactions,
        billetterie,
        deskState,
      },
    });
  } catch (error: any) {
    console.error('Fetch caisse data error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur lors du chargement des données' },
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
    const { drivers, transactions, billetterie, deskState } = body;

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

    // Save drivers if present
    if (Array.isArray(drivers)) {
      const driverIds = drivers.map((d) => d.id).filter(Boolean);
      if (driverIds.length > 0) {
        await targetPool.query(
          'DELETE FROM caisse_drivers WHERE account_id = $1 AND NOT (id = ANY($2::text[]))',
          [session.id, driverIds]
        );
      } else {
        await targetPool.query('DELETE FROM caisse_drivers WHERE account_id = $1', [session.id]);
      }

      for (const d of drivers) {
        await targetPool.query(
          `INSERT INTO caisse_drivers (id, account_id, nom, tr, statut, date_derniere, reclamation, caisses_dues, programme_jour, circuit_actuel, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
           ON CONFLICT (account_id, id) DO UPDATE SET
             nom = EXCLUDED.nom,
             tr = EXCLUDED.tr,
             statut = EXCLUDED.statut,
             date_derniere = EXCLUDED.date_derniere,
             reclamation = EXCLUDED.reclamation,
             caisses_dues = EXCLUDED.caisses_dues,
             programme_jour = EXCLUDED.programme_jour,
             circuit_actuel = EXCLUDED.circuit_actuel,
             updated_at = CURRENT_TIMESTAMP`,
          [
            d.id,
            session.id,
            d.nom,
            d.tr,
            d.statut,
            d.dateDerniere || new Date().toISOString(),
            d.reclamation || '',
            d.caissesDues || 0,
            d.programmeJour || '',
            d.circuitActuel || '',
          ]
        );
      }
    }

    // Save transactions if present
    if (Array.isArray(transactions)) {
      for (const t of transactions) {
        await targetPool.query(
          `INSERT INTO caisse_transactions (id, account_id, date, code_chauffeur, nom_chauffeur, recette, t_payer, res_a_payer, versement, status, raw_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (account_id, id) DO UPDATE SET
             date = EXCLUDED.date,
             code_chauffeur = EXCLUDED.code_chauffeur,
             nom_chauffeur = EXCLUDED.nom_chauffeur,
             recette = EXCLUDED.recette,
             t_payer = EXCLUDED.t_payer,
             res_a_payer = EXCLUDED.res_a_payer,
             versement = EXCLUDED.versement,
             status = EXCLUDED.status,
             raw_data = EXCLUDED.raw_data`,
          [
            t.id,
            session.id,
            t.date || new Date().toISOString(),
            t.codeChauffeur,
            t.nomChauffeur,
            t.recette,
            t.tPayer,
            t.resAPayer,
            t.versement,
            t.status,
            t.rawData ? JSON.stringify(t.rawData) : null,
          ]
        );
      }
    }

    // Save billetterie if present
    if (billetterie && Array.isArray(billetterie.items)) {
      await targetPool.query(
        `INSERT INTO caisse_billetterie (account_id, items, srf_moins, ver, recette_theorique, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (account_id) DO UPDATE SET
           items = EXCLUDED.items,
           srf_moins = EXCLUDED.srf_moins,
           ver = EXCLUDED.ver,
           recette_theorique = EXCLUDED.recette_theorique,
           updated_at = CURRENT_TIMESTAMP`,
        [
          session.id,
          JSON.stringify(billetterie.items),
          billetterie.srfMoins || 0,
          billetterie.ver || 0,
          billetterie.recetteTheorique || 0,
        ]
      );
    }

    // Save desk state if present
    if (deskState && Array.isArray(deskState.deskRows)) {
      await targetPool.query(
        `INSERT INTO caisse_desk_state (account_id, desk_rows, desk_recette, desk_versement, desk_tr_input, selected_driver_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (account_id) DO UPDATE SET
           desk_rows = EXCLUDED.desk_rows,
           desk_recette = EXCLUDED.desk_recette,
           desk_versement = EXCLUDED.desk_versement,
           desk_tr_input = EXCLUDED.desk_tr_input,
           selected_driver_id = EXCLUDED.selected_driver_id,
           updated_at = CURRENT_TIMESTAMP`,
        [
          session.id,
          JSON.stringify(deskState.deskRows),
          deskState.deskRecette || 0,
          deskState.deskVersement || 0,
          deskState.deskTrInput || '',
          deskState.selectedDriverId || null,
        ]
      );
    }

    return NextResponse.json({ success: true, message: 'Données synchronisées avec succès' });
  } catch (error: any) {
    console.error('Save caisse data error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la sauvegarde des données' },
      { status: 500 }
    );
  }
}

