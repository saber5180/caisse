import { Pool } from 'pg';
import { getPool } from './db';

export type CashierCode = 'CRNU' | 'CRSF' | 'CRTN';

export type CashierAccountRow = {
  id: string;
  username: string;
  display_name: string;
  caisse_code: string | null;
  is_blocked: boolean;
  force_logout_at: Date | string | null;
  updated_at: Date | string | null;
  custom_db_url: string | null;
};

const CASHIER_CODES: CashierCode[] = ['CRNU', 'CRSF', 'CRTN'];

export function isMainPoolUrl(customUrl?: string | null): boolean {
  if (!customUrl) return true;
  try {
    return getPool(customUrl) === getPool();
  } catch {
    return true;
  }
}

export async function loadCashierAccounts(pool: Pool): Promise<Map<CashierCode, CashierAccountRow>> {
  const res = await pool.query(
    `SELECT id, username, display_name, caisse_code, is_blocked, force_logout_at, updated_at, custom_db_url
     FROM caisse_accounts
     WHERE LOWER(username) IN ('crnu', 'crsf', 'crtn')
        OR UPPER(caisse_code) IN ('CRNU', 'CRSF', 'CRTN')
        OR id IN ('acc-crnu', 'acc-crsf', 'acc-crtn')`
  );

  const map = new Map<CashierCode, CashierAccountRow>();
  for (const row of res.rows as CashierAccountRow[]) {
    const code = String(row.caisse_code || row.username || '')
      .toUpperCase()
      .replace(/^ACC-/, '') as CashierCode;
    if (!CASHIER_CODES.includes(code)) continue;
    const existing = map.get(code);
    if (!existing) {
      map.set(code, row);
      continue;
    }
    const officialId = `acc-${code.toLowerCase()}`;
    const rowIsOfficial = row.id === officialId;
    const existingIsOfficial = existing.id === officialId;
    if (row.username?.toLowerCase() === code.toLowerCase() && existing.username?.toLowerCase() !== code.toLowerCase()) {
      map.set(code, row);
    } else if (rowIsOfficial && !existingIsOfficial && existing.username?.toLowerCase() !== code.toLowerCase()) {
      map.set(code, row);
    }
  }
  return map;
}

export function belongsToCaisse(
  txn: { accountId?: string; caisseCode?: string },
  account: CashierAccountRow | undefined,
  code: CashierCode
): boolean {
  if (account && txn.accountId === account.id) return true;
  return String(txn.caisseCode || '').toUpperCase() === code;
}

export async function fetchTransactionsFromPool(
  pool: Pool,
  accountId?: string
): Promise<any[]> {
  const sql = accountId
    ? `SELECT t.id, t.account_id, t.date, t.code_chauffeur, t.nom_chauffeur, t.recette, t.t_payer, t.res_a_payer, t.versement, t.status, t.raw_data,
              a.caisse_code, a.display_name, a.username
       FROM caisse_transactions t
       LEFT JOIN caisse_accounts a ON a.id = t.account_id
       WHERE t.account_id = $1
       ORDER BY t.date DESC`
    : `SELECT t.id, t.account_id, t.date, t.code_chauffeur, t.nom_chauffeur, t.recette, t.t_payer, t.res_a_payer, t.versement, t.status, t.raw_data,
              a.caisse_code, a.display_name, a.username
       FROM caisse_transactions t
       LEFT JOIN caisse_accounts a ON a.id = t.account_id
       ORDER BY t.date DESC`;
  const res = accountId ? await pool.query(sql, [accountId]) : await pool.query(sql);
  return res.rows;
}

export async function fetchHistoryFromPool(pool: Pool, accountId?: string): Promise<any[]> {
  const sql = accountId
    ? `SELECT h.id, h.account_id, h.date_cloture, h.total_coupures, h.srf_pieces, h.srf_moins, h.ver, h.tt_physique, h.recette_theorique, h.ecart_reste, h.items, h.archived_transactions, h.caissier_nom, h.notes, h.created_at,
              a.caisse_code, a.display_name, a.username
       FROM caisse_billetterie_history h
       LEFT JOIN caisse_accounts a ON a.id = h.account_id
       WHERE h.account_id = $1
       ORDER BY h.date_cloture DESC`
    : `SELECT h.id, h.account_id, h.date_cloture, h.total_coupures, h.srf_pieces, h.srf_moins, h.ver, h.tt_physique, h.recette_theorique, h.ecart_reste, h.items, h.archived_transactions, h.caissier_nom, h.notes, h.created_at,
              a.caisse_code, a.display_name, a.username
       FROM caisse_billetterie_history h
       LEFT JOIN caisse_accounts a ON a.id = h.account_id
       ORDER BY h.date_cloture DESC`;
  const res = accountId ? await pool.query(sql, [accountId]) : await pool.query(sql);
  return res.rows;
}
