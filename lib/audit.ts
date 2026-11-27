import { Pool } from 'pg';
import { UserAccount } from './auth';

export async function logAudit(
  pool: Pool,
  actor: Pick<UserAccount, 'id' | 'username' | 'caisseCode'> | null,
  action: string,
  details: Record<string, unknown> = {},
  caisseCode?: string
) {
  try {
    await pool.query(
      `INSERT INTO caisse_audit_log (id, actor_id, actor_username, caisse_code, action, details)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        `AUD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        actor?.id || null,
        actor?.username || 'systeme',
        (caisseCode || actor?.caisseCode || '').toUpperCase(),
        action,
        JSON.stringify(details),
      ]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
