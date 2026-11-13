import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionUser,
  ensureDefaultAccountsAndSeed,
  GLOBAL_FLEET_ACCOUNT_ID,
} from '@/lib/auth';
import { getPool } from '@/lib/db';
import {
  Driver,
  TransactionRecord,
  BilletterieItem,
  DeskRow,
  CaisseLiveSummary,
} from '@/types/caisse';
import { cleanScannerTr, applyProgrammeRowsToFleet } from '@/lib/utils';
import { DEFAULT_PROGRAMME_EXCEL_ROWS } from '@/data/programmeJourDefault';

const CAISSE_CODES_MAP: Record<string, { code: 'CRNU' | 'CRSF' | 'CRTN'; name: string }> = {
  'acc-crnu': { code: 'CRNU', name: 'Caisse CRNU' },
  'acc-crsf': { code: 'CRSF', name: 'Caisse CRSF' },
  'acc-crtn': { code: 'CRTN', name: 'Caisse CRTN' },
};

export async function GET() {
  try {
    await ensureDefaultAccountsAndSeed();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const mainPool = getPool();
    const accRes = await mainPool.query(
      'SELECT id, username, display_name, role, caisse_code, is_blocked, force_logout_at, custom_db_url FROM caisse_accounts WHERE id = $1',
      [session.id]
    );

    if (accRes.rows.length === 0) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
    }

    const account = accRes.rows[0];

    // Check remote block / force logout
    if (account.is_blocked && account.role === 'cashier') {
      const response = NextResponse.json(
        {
          error: `Votre caisse (${account.display_name}) a été temporairement bloquée par le Superviseur.`,
          reason: 'blocked',
        },
        { status: 403 }
      );
      response.cookies.delete('caisse_session');
      return response;
    }

    if (account.force_logout_at) {
      const forceLogoutMs = new Date(account.force_logout_at).getTime();
      const loginAtMs = session.loginAt || (session.iat ? session.iat * 1000 : 0);
      if (loginAtMs > 0 && forceLogoutMs > loginAtMs) {
        const response = NextResponse.json(
          {
            error: `Votre session (${account.display_name}) a été déconnectée à distance par le Superviseur.`,
            reason: 'force_logout',
          },
          { status: 401 }
        );
        response.cookies.delete('caisse_session');
        return response;
      }
    }

    const targetPool = account.custom_db_url ? getPool(account.custom_db_url) : mainPool;
    const isSupervisorOrAdmin = account.role === 'superviseur' || account.role === 'admin';

    // 1. Fetch ALL active transactions across all accounts so we can:
    //    a) Synchronize driver paid status globally across all caisses
    //    b) Build real-time multi-caisse summaries (CRNU, CRSF, CRTN)
    const allTransRes = await mainPool.query(
      `SELECT t.id, t.account_id, t.date, t.code_chauffeur, t.nom_chauffeur, t.recette, t.t_payer, t.res_a_payer, t.versement, t.status, t.raw_data,
              a.caisse_code, a.display_name, a.username
       FROM caisse_transactions t
       LEFT JOIN caisse_accounts a ON a.id = t.account_id
       ORDER BY t.date DESC`
    );

    const allTransactions: TransactionRecord[] = allTransRes.rows.map((r) => {
      const tPayer = parseFloat(r.t_payer) || 0;
      const versement = parseFloat(r.versement) || 0;
      const mtEspece = Math.round((tPayer - versement) * 1000) / 1000;
      const caisseCode =
        r.caisse_code ||
        CAISSE_CODES_MAP[r.account_id]?.code ||
        (r.username ? r.username.toUpperCase() : 'CAISSE');
      const caisseName =
        r.display_name || CAISSE_CODES_MAP[r.account_id]?.name || caisseCode;

      return {
        id: r.id,
        accountId: r.account_id,
        caisseCode,
        caisseName,
        date: r.date ? new Date(r.date).toISOString() : new Date().toISOString(),
        codeChauffeur: r.code_chauffeur,
        nomChauffeur: r.nom_chauffeur,
        recette: parseFloat(r.recette) || 0,
        tPayer,
        mtEspece,
        resAPayer: parseFloat(r.res_a_payer) || 0,
        versement,
        status: r.status,
        rawData: r.raw_data || undefined,
      };
    });

    // Map of drivers who have validated a payment in ANY caisse today
    const paidDriverTrMap = new Map<string, { date: string; caisseCode: string }>();
    for (const t of allTransactions) {
      if (t.status === 'PAYE' && t.codeChauffeur) {
        const cleanTr = cleanScannerTr(t.codeChauffeur).toUpperCase();
        if (!paidDriverTrMap.has(cleanTr)) {
          paidDriverTrMap.set(cleanTr, {
            date: t.date,
            caisseCode: t.caisseCode || 'CAISSE',
          });
        }
      }
    }

    // 2. Fetch shared global drivers fleet (stored under GLOBAL_FLEET_ACCOUNT_ID)
    const driversRes = await mainPool.query(
      `SELECT id, nom, tr, statut, date_derniere, reclamation, caisses_dues, programme_jour, circuit_actuel, serie, sous_serie, montant_bordereau, programme_historique, programme_date
       FROM caisse_drivers
       WHERE account_id = $1
       ORDER BY tr ASC, nom ASC`,
      [GLOBAL_FLEET_ACCOUNT_ID]
    );

    const drivers: Driver[] = driversRes.rows.map((r) => {
      const cleanTr = cleanScannerTr(r.tr).toUpperCase();
      const paidInfo = paidDriverTrMap.get(cleanTr);
      const progMs = r.programme_date ? new Date(r.programme_date).getTime() : 0;
      const paidMs = paidInfo?.date ? new Date(paidInfo.date).getTime() : 0;
      const hist = Array.isArray(r.programme_historique) ? r.programme_historique : [];
      const unpaidHistCount = hist.filter((h: any) => !h.paid).length;
      // Une transaction ne passe le chauffeur en PAYE que s'il n'a plus aucune caisse impayée dans son historique et que la transaction est postérieure au programme du jour
      const isPaidForCurrentProg =
        r.statut === 'PAYE' ||
        (unpaidHistCount === 0 && Boolean(paidInfo) && progMs > 0 && paidMs >= progMs);
      const effectiveStatut = isPaidForCurrentProg ? 'PAYE' : r.statut;
      const effectiveCaissesDues =
        effectiveStatut === 'PAYE' ? 0 : Math.max(unpaidHistCount, r.caisses_dues || 0);

      return {
        id: r.id,
        nom: r.nom,
        tr: r.tr,
        statut: effectiveStatut,
        dateDerniere:
          isPaidForCurrentProg && paidInfo?.date && paidMs >= progMs
            ? paidInfo.date
            : r.date_derniere
            ? new Date(r.date_derniere).toISOString()
            : new Date().toISOString(),
        reclamation: r.reclamation || '',
        caissesDues: effectiveCaissesDues,
        programmeJour: r.programme_jour || '',
        circuitActuel: r.circuit_actuel || '',
        serie: r.serie || '',
        sousSerie: r.sous_serie || '',
        montantBordereau: parseFloat(r.montant_bordereau) || 0,
        programmeHistorique: Array.isArray(r.programme_historique) ? r.programme_historique : [],
        programmeDate: r.programme_date ? new Date(r.programme_date).toISOString() : undefined,
      };
    }).filter((d) => d.id !== 'DRV-GLOBAL-0' && d.id !== 'DRV-GLOBAL-1' && d.tr !== '0');

    // Transactions for current view:
    // - Supervisor & Admin get all transactions across all caisses
    // - Individual Caisse (CRNU, CRSF, CRTN) gets its own active transactions
    const transactions = isSupervisorOrAdmin
      ? allTransactions
      : allTransactions.filter((t) => t.accountId === session.id);

    // 3. Build real-time Caisse Live Summary for CRNU, CRSF, CRTN
    const caisseAccRes = await mainPool.query(
      `SELECT id, username, display_name, caisse_code, is_blocked, force_logout_at, updated_at
       FROM caisse_accounts
       WHERE id IN ('acc-crnu', 'acc-crsf', 'acc-crtn')`
    );
    const caisseAccMap = new Map<string, any>();
    for (const row of caisseAccRes.rows) {
      caisseAccMap.set(row.id, row);
    }

    const historyTotalsRes = await mainPool.query(
      `SELECT account_id,
              COUNT(*) AS nb_clotures,
              COALESCE(SUM(tt_physique), 0) AS total_cloture,
              COALESCE(SUM(total_coupures), 0) AS total_coupures,
              COALESCE(SUM(ver), 0) AS total_ver
       FROM caisse_billetterie_history
       WHERE account_id IN ('acc-crnu', 'acc-crsf', 'acc-crtn')
       GROUP BY account_id`
    );
    const historyTotalsMap = new Map<string, any>();
    for (const row of historyTotalsRes.rows) {
      historyTotalsMap.set(row.account_id, row);
    }

    const orderedCaisseIds: Array<{ id: string; code: 'CRNU' | 'CRSF' | 'CRTN'; name: string; user: string }> = [
      { id: 'acc-crnu', code: 'CRNU', name: 'Caisse CRNU', user: 'crnu' },
      { id: 'acc-crsf', code: 'CRSF', name: 'Caisse CRSF', user: 'crsf' },
      { id: 'acc-crtn', code: 'CRTN', name: 'Caisse CRTN', user: 'crtn' },
    ];

    const caissesSummary: CaisseLiveSummary[] = orderedCaisseIds.map((item) => {
      const dbAcc = caisseAccMap.get(item.id);
      const caisseTxns = allTransactions.filter((t) => t.accountId === item.id);
      const montantActuel = caisseTxns.reduce((sum, t) => sum + t.tPayer, 0);
      const versement = caisseTxns.reduce((sum, t) => sum + t.versement, 0);
      const mtEspece = Math.round((montantActuel - versement) * 1000) / 1000;
      const recetteAttendue = caisseTxns.reduce((sum, t) => sum + t.recette, 0);
      const ecart = Math.round((montantActuel - recetteAttendue) * 1000) / 1000;

      const hist = historyTotalsMap.get(item.id);

      return {
        accountId: item.id,
        caisseCode: item.code,
        displayName: dbAcc?.display_name || item.name,
        username: dbAcc?.username || item.user,
        isBlocked: Boolean(dbAcc?.is_blocked),
        forceLogoutAt: dbAcc?.force_logout_at
          ? new Date(dbAcc.force_logout_at).toISOString()
          : null,
        updatedAt: dbAcc?.updated_at ? new Date(dbAcc.updated_at).toISOString() : null,
        montantActuel: Math.round(montantActuel * 1000) / 1000,
        mtEspece: Math.round(mtEspece * 1000) / 1000,
        versement: Math.round(versement * 1000) / 1000,
        recetteAttendue: Math.round(recetteAttendue * 1000) / 1000,
        ecart,
        nbTransactions: caisseTxns.length,
        totalCloture: hist ? parseFloat(hist.total_cloture) || 0 : 0,
        totalClotureEspece: hist ? parseFloat(hist.total_coupures) || 0 : 0,
        totalClotureVersement: hist ? parseFloat(hist.total_ver) || 0 : 0,
        nbClotures: hist ? parseInt(hist.nb_clotures, 10) || 0 : 0,
      };
    });

    // 4. Fetch billetterie for this account
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

    // 5. Fetch desk state for this account
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
        allTransactions: isSupervisorOrAdmin ? allTransactions : transactions,
        caissesSummary: isSupervisorOrAdmin ? caissesSummary : [],
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
    await ensureDefaultAccountsAndSeed();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const mainPool = getPool();
    const accRes = await mainPool.query(
      'SELECT id, role, display_name, is_blocked, force_logout_at, custom_db_url FROM caisse_accounts WHERE id = $1',
      [session.id]
    );

    if (accRes.rows.length === 0) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
    }

    const account = accRes.rows[0];

    // Consultation-only check for Superviseur
    if (account.role === 'superviseur') {
      return NextResponse.json(
        { error: 'Compte Superviseur en mode consultation uniquement.' },
        { status: 403 }
      );
    }

    // Block check for cashiers
    if (account.is_blocked && account.role === 'cashier') {
      return NextResponse.json(
        {
          error: `Opération refusée : Votre caisse (${account.display_name}) est bloquée par le Superviseur.`,
          reason: 'blocked',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { drivers, transactions, billetterie, deskState, clearAllHistory } = body;

    const targetPool = account.custom_db_url ? getPool(account.custom_db_url) : mainPool;

    if (clearAllHistory) {
      await mainPool.query('DELETE FROM caisse_drivers');
      await mainPool.query('DELETE FROM caisse_transactions');
      await mainPool.query("UPDATE caisse_desk_state SET selected_driver_id = NULL, desk_tr_input = ''");
      return NextResponse.json({ success: true, message: 'Tous les chauffeurs et historiques ont été supprimés' });
    }

    // 1. Save shared global drivers if provided
    if (Array.isArray(drivers)) {
      const realDrivers = drivers.filter(
        (d) => d.id !== 'DRV-GLOBAL-0' && d.id !== 'DRV-GLOBAL-1'
      );
      const driverIds = realDrivers.map((d) => d.id).filter(Boolean);
      if (driverIds.length === 0) {
        await mainPool.query(
          'DELETE FROM caisse_drivers WHERE account_id = $1',
          [GLOBAL_FLEET_ACCOUNT_ID]
        );
      } else {
        await mainPool.query(
          'DELETE FROM caisse_drivers WHERE account_id = $1 AND NOT (id = ANY($2::text[]))',
          [GLOBAL_FLEET_ACCOUNT_ID, driverIds]
        );
      }

      for (const d of realDrivers) {
        await mainPool.query(
          `INSERT INTO caisse_drivers (id, account_id, nom, tr, statut, date_derniere, reclamation, caisses_dues, programme_jour, circuit_actuel, serie, sous_serie, montant_bordereau, programme_historique, programme_date, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, CURRENT_TIMESTAMP)
           ON CONFLICT (account_id, id) DO UPDATE SET
             nom = EXCLUDED.nom,
             tr = EXCLUDED.tr,
             statut = EXCLUDED.statut,
             date_derniere = EXCLUDED.date_derniere,
             reclamation = EXCLUDED.reclamation,
             caisses_dues = EXCLUDED.caisses_dues,
             programme_jour = EXCLUDED.programme_jour,
             circuit_actuel = EXCLUDED.circuit_actuel,
             serie = EXCLUDED.serie,
             sous_serie = EXCLUDED.sous_serie,
             montant_bordereau = EXCLUDED.montant_bordereau,
             programme_historique = EXCLUDED.programme_historique,
             programme_date = EXCLUDED.programme_date,
             updated_at = CURRENT_TIMESTAMP`,
          [
            d.id,
            GLOBAL_FLEET_ACCOUNT_ID,
            d.nom,
            d.tr,
            d.statut,
            d.dateDerniere || new Date().toISOString(),
            d.reclamation || '',
            d.caissesDues || 0,
            d.programmeJour || '',
            d.circuitActuel || '',
            d.serie || '',
            d.sousSerie || '',
            d.montantBordereau || 0,
            JSON.stringify(Array.isArray(d.programmeHistorique) ? d.programmeHistorique : []),
            d.programmeDate || null,
          ]
        );
      }
    }

    // 2. Save transactions for this caisse account
    if (Array.isArray(transactions)) {
      const txnIds = transactions.map((t) => t.id).filter(Boolean);
      if (txnIds.length === 0) {
        await targetPool.query('DELETE FROM caisse_transactions WHERE account_id = $1', [
          session.id,
        ]);
      } else {
        await targetPool.query(
          'DELETE FROM caisse_transactions WHERE account_id = $1 AND NOT (id = ANY($2::text[]))',
          [session.id, txnIds]
        );
      }

      for (const t of transactions) {
        const txnDate = t.date || new Date().toISOString();
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
            txnDate,
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

        // Liaison automatique inter-modules : uniquement si la transaction est plus récente que le programme du jour du chauffeur
        if (t.status === 'PAYE' && t.codeChauffeur && !Array.isArray(drivers)) {
          await mainPool.query(
            `UPDATE caisse_drivers
             SET statut = 'PAYE',
                 caisses_dues = 0,
                 date_derniere = $3,
                 reclamation = 'CAISSE REGLEE - AUCUNE RECLAMATION',
                 updated_at = CURRENT_TIMESTAMP
             WHERE account_id = $1
               AND (tr = $2 OR TRIM(LEADING '0' FROM tr) = TRIM(LEADING '0' FROM $2))
               AND (programme_date IS NULL OR programme_date <= $3)`,
            [GLOBAL_FLEET_ACCOUNT_ID, String(t.codeChauffeur), txnDate]
          );
        }
      }
    }

    // 3. Save billetterie if present
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

    // 4. Save desk state if present
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
