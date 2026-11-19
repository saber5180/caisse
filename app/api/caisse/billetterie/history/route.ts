import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, ensureDefaultAccountsAndSeed } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { BilletterieHistoryEntry } from '@/types/caisse';
import {
  fetchHistoryFromPool,
  fetchTransactionsFromPool,
  isMainPoolUrl,
  loadCashierAccounts,
  type CashierAccountRow,
  type CashierCode,
} from '@/lib/cashierAccounts';

const CAISSE_CODES_MAP: Record<string, { code: string; name: string }> = {
  'acc-crnu': { code: 'CRNU', name: 'Caisse CRNU' },
  'acc-crsf': { code: 'CRSF', name: 'Caisse CRSF' },
  'acc-crtn': { code: 'CRTN', name: 'Caisse CRTN' },
  'acc-admin': { code: 'ADMIN', name: 'Administration Générale' },
};

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function mapHistoryRow(r: any): BilletterieHistoryEntry {
  const caisseCode =
    r.caisse_code ||
    CAISSE_CODES_MAP[r.account_id]?.code ||
    (r.username ? r.username.toUpperCase() : 'CAISSE');
  const caisseName = r.display_name || CAISSE_CODES_MAP[r.account_id]?.name || caisseCode;

  const archivedTxns = Array.isArray(r.archived_transactions)
    ? r.archived_transactions.map((t: any) => ({
        ...t,
        caisseCode: t.caisseCode || caisseCode,
        caisseName: t.caisseName || caisseName,
        mtEspece:
          typeof t.mtEspece === 'number'
            ? t.mtEspece
            : round3((parseFloat(t.tPayer) || 0) - (parseFloat(t.versement) || 0)),
      }))
    : [];

  return {
    id: r.id,
    accountId: r.account_id,
    caisseCode,
    caisseName,
    dateCloture: r.date_cloture ? new Date(r.date_cloture).toISOString() : new Date().toISOString(),
    totalCoupures: parseFloat(r.total_coupures) || 0,
    srfPieces: parseFloat(r.srf_pieces) || 0,
    srfMoins: parseFloat(r.srf_moins) || 0,
    ver: parseFloat(r.ver) || 0,
    ttPhysique: parseFloat(r.tt_physique) || 0,
    recetteTheorique: parseFloat(r.recette_theorique) || 0,
    ecartReste: parseFloat(r.ecart_reste) || 0,
    items: Array.isArray(r.items) ? r.items : [],
    archivedTransactions: archivedTxns,
    caissierNom: r.caissier_nom || caisseCode,
    notes: r.notes || '',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    isOpenDay: false,
  };
}

async function buildOpenDayEntry(
  pool: ReturnType<typeof getPool>,
  acc: CashierAccountRow,
  code: CashierCode
): Promise<BilletterieHistoryEntry | null> {
  const txnRows = await fetchTransactionsFromPool(pool, acc.id);
  const billRes = await pool.query(
    'SELECT items, srf_moins, ver, recette_theorique FROM caisse_billetterie WHERE account_id = $1',
    [acc.id]
  );
  const bill = billRes.rows[0];
  if (txnRows.length === 0 && !bill) return null;

  const archivedTransactions = txnRows.map((r: any) => {
    const tPayer = parseFloat(r.t_payer) || 0;
    const versement = parseFloat(r.versement) || 0;
    return {
      id: r.id,
      accountId: r.account_id,
      caisseCode: code,
      caisseName: acc.display_name,
      date: r.date ? new Date(r.date).toISOString() : new Date().toISOString(),
      codeChauffeur: r.code_chauffeur,
      nomChauffeur: r.nom_chauffeur,
      recette: parseFloat(r.recette) || 0,
      tPayer,
      mtEspece: round3(tPayer - versement),
      resAPayer: parseFloat(r.res_a_payer) || 0,
      versement,
      status: r.status,
      rawData: r.raw_data || undefined,
    };
  });

  const txnTPayer = archivedTransactions.reduce((s, t) => s + t.tPayer, 0);
  const txnVer = archivedTransactions.reduce((s, t) => s + t.versement, 0);
  const txnRecette = archivedTransactions.reduce((s, t) => s + t.recette, 0);
  const items = Array.isArray(bill?.items) ? bill.items : [];
  const fromItems = items.reduce(
    (s: number, item: any) => s + (Number(item.nombre) || 0) * (Number(item.valeur) || 0),
    0
  );
  const totalCoupures = round3(fromItems > 0 ? fromItems : txnTPayer - txnVer);
  const srfMoins = parseFloat(bill?.srf_moins) || 0;
  const ver = bill ? parseFloat(bill.ver) || 0 : round3(txnVer);
  const recetteTheorique = bill ? parseFloat(bill.recette_theorique) || 0 : round3(txnRecette);
  const ttPhysique = round3(totalCoupures - srfMoins + ver);
  const latest = archivedTransactions[0]?.date || new Date().toISOString();

  return {
    id: `LIVE-${code}`,
    accountId: acc.id,
    caisseCode: code,
    caisseName: acc.display_name || `Caisse ${code}`,
    dateCloture: latest,
    totalCoupures,
    srfPieces: 0,
    srfMoins,
    ver,
    ttPhysique,
    recetteTheorique: round3(recetteTheorique),
    ecartReste: round3(ttPhysique - recetteTheorique),
    items,
    archivedTransactions,
    caissierNom: code,
    notes: 'Journée en cours — non clôturée',
    createdAt: latest,
    isOpenDay: true,
  };
}

export async function GET() {
  try {
    await ensureDefaultAccountsAndSeed();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const mainPool = getPool();
    const accRes = await mainPool.query(
      'SELECT id, role, caisse_code, display_name, custom_db_url FROM caisse_accounts WHERE id = $1',
      [session.id]
    );

    if (accRes.rows.length === 0) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
    }

    const account = accRes.rows[0];
    const isSupervisorOrAdmin = account.role === 'superviseur' || account.role === 'admin';
    const targetPool = account.custom_db_url ? getPool(account.custom_db_url) : mainPool;

    let historyRows: any[] = [];
    if (isSupervisorOrAdmin) {
      const byId = new Map<string, any>();
      for (const row of await fetchHistoryFromPool(mainPool)) {
        byId.set(row.id, row);
      }
      const cashiers = await loadCashierAccounts(mainPool);
      for (const acc of cashiers.values()) {
        if (isMainPoolUrl(acc.custom_db_url)) continue;
        try {
          const extra = await fetchHistoryFromPool(getPool(acc.custom_db_url || undefined), acc.id);
          for (const row of extra) {
            if (!byId.has(row.id)) byId.set(row.id, row);
          }
        } catch (err) {
          console.error(`Lecture historique ${acc.username} (base dédiée) :`, err);
        }
      }
      historyRows = Array.from(byId.values());
    } else {
      historyRows = await fetchHistoryFromPool(targetPool, session.id);
    }

    const history: BilletterieHistoryEntry[] = historyRows.map(mapHistoryRow);

    const cashiers = await loadCashierAccounts(mainPool);
    const openTargets: Array<{ acc: CashierAccountRow; code: CashierCode }> = isSupervisorOrAdmin
      ? (['CRNU', 'CRSF', 'CRTN'] as const)
          .map((code) => {
            const acc = cashiers.get(code);
            return acc ? { acc, code } : null;
          })
          .filter((x): x is { acc: CashierAccountRow; code: CashierCode } => Boolean(x))
      : (() => {
          const code = String(account.caisse_code || session.username || '').toUpperCase() as CashierCode;
          const acc =
            cashiers.get(code) ||
            ({
              id: session.id,
              username: session.username,
              display_name: account.display_name,
              caisse_code: account.caisse_code,
              is_blocked: false,
              force_logout_at: null,
              updated_at: null,
              custom_db_url: account.custom_db_url,
            } as CashierAccountRow);
          return [{ acc, code: (['CRNU', 'CRSF', 'CRTN'] as const).includes(code) ? code : 'CRNU' }];
        })();

    for (const { acc, code } of openTargets) {
      const pools = [isSupervisorOrAdmin ? mainPool : targetPool];
      if (!isMainPoolUrl(acc.custom_db_url)) {
        pools.push(getPool(acc.custom_db_url || undefined));
      }
      let open: BilletterieHistoryEntry | null = null;
      for (const pool of pools) {
        try {
          const candidate = await buildOpenDayEntry(pool, acc, code);
          if (candidate && (!open || (candidate.archivedTransactions?.length || 0) > (open.archivedTransactions?.length || 0))) {
            open = candidate;
          }
        } catch (err) {
          console.error(`Lecture journée en cours ${code} :`, err);
        }
      }
      if (open) history.unshift(open);
    }

    history.sort((a, b) => {
      if (Boolean(a.isOpenDay) !== Boolean(b.isOpenDay)) return a.isOpenDay ? -1 : 1;
      return new Date(b.dateCloture).getTime() - new Date(a.dateCloture).getTime();
    });

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
    await ensureDefaultAccountsAndSeed();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const mainPool = getPool();
    const accRes = await mainPool.query(
      'SELECT id, role, caisse_code, is_blocked, custom_db_url, display_name FROM caisse_accounts WHERE id = $1',
      [session.id]
    );

    if (accRes.rows.length === 0) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
    }

    const account = accRes.rows[0];
    if (account.role === 'superviseur') {
      return NextResponse.json(
        { error: 'Compte Superviseur en mode consultation uniquement.' },
        { status: 403 }
      );
    }
    if (account.is_blocked && account.role === 'cashier') {
      return NextResponse.json(
        { error: 'Votre caisse est bloquée par le Superviseur.' },
        { status: 403 }
      );
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

    const id = `CLOT-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    const targetPool = account.custom_db_url ? getPool(account.custom_db_url) : mainPool;
    const caisseCode =
      account.caisse_code || CAISSE_CODES_MAP[session.id]?.code || session.username.toUpperCase();

    // 1. Récupérer toutes les transactions actives de la journée pour les archiver
    const activeTransRes = await targetPool.query(
      `SELECT id, date, code_chauffeur, nom_chauffeur, recette, t_payer, res_a_payer, versement, status, raw_data
       FROM caisse_transactions
       WHERE account_id = $1
       ORDER BY date DESC`,
      [session.id]
    );

    const activeTransactions = activeTransRes.rows.map((r) => {
      const tPayer = parseFloat(r.t_payer) || 0;
      const versement = parseFloat(r.versement) || 0;
      return {
        id: r.id,
        caisseCode,
        caisseName: account.display_name,
        date: r.date ? new Date(r.date).toISOString() : new Date().toISOString(),
        codeChauffeur: r.code_chauffeur,
        nomChauffeur: r.nom_chauffeur,
        recette: parseFloat(r.recette) || 0,
        tPayer,
        mtEspece: Math.round((tPayer - versement) * 1000) / 1000,
        resAPayer: parseFloat(r.res_a_payer) || 0,
        versement,
        status: r.status,
        rawData: r.raw_data || undefined,
      };
    });

    const historyPools = [targetPool];
    if (account.custom_db_url && targetPool !== mainPool) {
      historyPools.push(mainPool);
    }

    const insertParams = [
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
      caisseCode,
      notes,
    ];
    const insertSql = `INSERT INTO caisse_billetterie_history (
        id, account_id, date_cloture, total_coupures, srf_pieces, srf_moins, ver, tt_physique, recette_theorique, ecart_reste, items, archived_transactions, caissier_nom, notes
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`;

    for (const pool of historyPools) {
      await pool.query(insertSql, insertParams);
    }

    for (const pool of historyPools) {
      await pool.query('DELETE FROM caisse_transactions WHERE account_id = $1', [session.id]);
    }

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

async function requireSuperviseur() {
  await ensureDefaultAccountsAndSeed();
  const session = await getSessionUser();
  if (!session) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  }
  const mainPool = getPool();
  const accRes = await mainPool.query(
    'SELECT id, role FROM caisse_accounts WHERE id = $1',
    [session.id]
  );
  if (accRes.rows.length === 0 || accRes.rows[0].role !== 'superviseur') {
    return {
      error: NextResponse.json(
        { error: 'Réservé au Superviseur Général.' },
        { status: 403 }
      ),
    };
  }
  return { mainPool };
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireSuperviseur();
    if (auth.error || !auth.mainPool) return auth.error!;
    const mainPool = auth.mainPool;

    const body = await req.json();
    const id = String(body.id || '').trim();
    const accountId = String(body.accountId || '').trim();
    const totalCoupures = round3(Number(body.totalCoupures));
    const srfMoins = round3(Number(body.srfMoins));
    const ver = round3(Number(body.ver));
    const recetteTheorique = round3(Number(body.recetteTheorique));
    const notes = String(body.notes || '');

    if (!id || !accountId) {
      return NextResponse.json({ error: 'Clôture introuvable.' }, { status: 400 });
    }
    if (![totalCoupures, srfMoins, ver, recetteTheorique].every((n) => Number.isFinite(n))) {
      return NextResponse.json({ error: 'Montants invalides.' }, { status: 400 });
    }

    const ttPhysique = round3(totalCoupures + srfMoins + ver);
    const ecartReste = round3(ttPhysique - recetteTheorique);

    const ownerRes = await mainPool.query(
      'SELECT custom_db_url FROM caisse_accounts WHERE id = $1',
      [accountId]
    );
    const ownerUrl = ownerRes.rows[0]?.custom_db_url as string | null;
    const ownerPool = ownerUrl ? getPool(ownerUrl) : mainPool;

    const sql = `UPDATE caisse_billetterie_history
       SET total_coupures = $1, srf_moins = $2, ver = $3, tt_physique = $4,
           recette_theorique = $5, ecart_reste = $6, notes = $7
       WHERE id = $8 AND account_id = $9`;
    const params = [totalCoupures, srfMoins, ver, ttPhysique, recetteTheorique, ecartReste, notes, id, accountId];
    const updated = await mainPool.query(sql, params);
    if (ownerPool !== mainPool) {
      await ownerPool.query(sql, params);
    }
    if ((updated.rowCount || 0) === 0) {
      return NextResponse.json({ error: 'Clôture introuvable.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      entry: { id, accountId, totalCoupures, srfMoins, ver, ttPhysique, recetteTheorique, ecartReste, notes },
    });
  } catch (error: any) {
    console.error('Billetterie history PATCH error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la modification' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireSuperviseur();
    if (auth.error || !auth.mainPool) return auth.error!;
    const mainPool = auth.mainPool;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const accountId = searchParams.get('accountId');
    if (!id || !accountId) {
      return NextResponse.json({ error: 'Identifiant requis' }, { status: 400 });
    }

    const ownerRes = await mainPool.query(
      'SELECT custom_db_url FROM caisse_accounts WHERE id = $1',
      [accountId]
    );
    const ownerUrl = ownerRes.rows[0]?.custom_db_url as string | null;
    const ownerPool = ownerUrl ? getPool(ownerUrl) : mainPool;

    const deleted = await mainPool.query(
      'DELETE FROM caisse_billetterie_history WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );
    if (ownerPool !== mainPool) {
      await ownerPool.query(
        'DELETE FROM caisse_billetterie_history WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );
    }
    if ((deleted.rowCount || 0) === 0) {
      return NextResponse.json({ error: 'Clôture introuvable.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Clôture supprimée.' });
  } catch (error: any) {
    console.error('Billetterie history DELETE error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}
