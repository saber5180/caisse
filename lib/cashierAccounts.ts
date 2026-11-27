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

export async function loadCashierAccounts(
  pool: Pool
): Promise<Map<CashierCode, CashierAccountRow[]>> {
  const res = await pool.query(
    `SELECT id, username, display_name, caisse_code, is_blocked, force_logout_at, updated_at, custom_db_url
     FROM caisse_accounts
     WHERE role = 'cashier'
       AND UPPER(caisse_code) IN ('CRNU', 'CRSF', 'CRTN')`
  );

  const map = new Map<CashierCode, CashierAccountRow[]>();
  for (const code of CASHIER_CODES) map.set(code, []);
  for (const row of res.rows as CashierAccountRow[]) {
    const code = String(row.caisse_code || '').toUpperCase() as CashierCode;
    if (!CASHIER_CODES.includes(code)) continue;
    map.get(code)!.push(row);
  }
  return map;
}

export function allCashierRows(map: Map<CashierCode, CashierAccountRow[]>): CashierAccountRow[] {
  return CASHIER_CODES.flatMap((code) => map.get(code) || []);
}

export function belongsToCaisse(
  txn: { accountId?: string; caisseCode?: string },
  accounts: CashierAccountRow[] | undefined,
  code: CashierCode
): boolean {
  if (accounts?.some((a) => a.id === txn.accountId)) return true;
  return String(txn.caisseCode || '').toUpperCase() === code;
}

export async function fetchTransactionsFromPool(
  pool: Pool,
  accountId?: string | string[]
): Promise<any[]> {
  const base = `SELECT t.id, t.account_id, t.date, t.code_chauffeur, t.nom_chauffeur, t.recette, t.t_payer, t.res_a_payer, t.versement, t.status, t.raw_data,
              a.caisse_code, a.display_name, a.username
       FROM caisse_transactions t
       LEFT JOIN caisse_accounts a ON a.id = t.account_id`;
  if (!accountId) {
    const res = await pool.query(`${base} ORDER BY t.date DESC`);
    return res.rows;
  }
  const ids = Array.isArray(accountId) ? accountId : [accountId];
  const res = await pool.query(`${base} WHERE t.account_id = ANY($1::text[]) ORDER BY t.date DESC`, [
    ids,
  ]);
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
