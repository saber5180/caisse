import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getPool, initDatabaseSchema } from './db';
import { INITIAL_DRIVERS } from '@/data/initialDrivers';

const JWT_SECRET = process.env.JWT_SECRET || 'caisse-chauffeurs-secret-key-2026';
const COOKIE_NAME = 'caisse_session';

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  role: string; // 'superviseur' | 'admin' | 'cashier'
  caisseCode?: string; // 'CRNU' | 'CRSF' | 'CRTN' | 'SUP' | 'ADMIN'
  isBlocked?: boolean;
  customDbUrl?: string | null;
  loginAt?: number;
  iat?: number;
}

export const GLOBAL_FLEET_ACCOUNT_ID = 'acc-admin';

export const OFFICIAL_ACCOUNTS = [
  {
    id: 'acc-superviseur',
    username: 'superviseur',
    password: 'sup123',
    displayName: 'Superviseur Général',
    role: 'superviseur',
    caisseCode: 'SUP',
  },
  {
    id: 'acc-admin',
    username: 'admin',
    password: 'admin123',
    displayName: 'Administration Générale',
    role: 'admin',
    caisseCode: 'ADMIN',
  },
  {
    id: 'acc-crnu',
    username: 'crnu',
    password: 'crnu123',
    displayName: 'Caisse CRNU',
    role: 'cashier',
    caisseCode: 'CRNU',
  },
  {
    id: 'acc-crsf',
    username: 'crsf',
    password: 'crsf123',
    displayName: 'Caisse CRSF',
    role: 'cashier',
    caisseCode: 'CRSF',
  },
  {
    id: 'acc-crtn',
    username: 'crtn',
    password: 'crtn123',
    displayName: 'Caisse CRTN',
    role: 'cashier',
    caisseCode: 'CRTN',
  },
] as const;

export function signToken(user: UserAccount): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      caisseCode: user.caisseCode || '',
      customDbUrl: user.customDbUrl || null,
      loginAt: Date.now(),
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): UserAccount | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserAccount;
    return decoded;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<UserAccount | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

let accountsInitialized = false;

export async function ensureDefaultAccountsAndSeed() {
  await initDatabaseSchema();
  if (accountsInitialized) return;

  const pool = getPool();

  for (const acc of OFFICIAL_ACCOUNTS) {
    const existing = await pool.query(
      'SELECT id, role, caisse_code FROM caisse_accounts WHERE username = $1',
      [acc.username]
    );

    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(acc.password, 10);
      await pool.query(
        `INSERT INTO caisse_accounts (id, username, password_hash, display_name, role, caisse_code, is_blocked)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE)
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username,
           display_name = EXCLUDED.display_name,
           role = EXCLUDED.role,
           caisse_code = EXCLUDED.caisse_code`,
        [acc.id, acc.username, hash, acc.displayName, acc.role, acc.caisseCode]
      );
    } else {
      await pool.query(
        `UPDATE caisse_accounts
         SET display_name = $1, role = $2, caisse_code = $3
         WHERE username = $4`,
        [acc.displayName, acc.role, acc.caisseCode, acc.username]
      );
    }
  }

  // Ensure the shared global fleet (stored under GLOBAL_FLEET_ACCOUNT_ID = 'acc-admin') is seeded
  const drvCountRes = await pool.query(
    'SELECT COUNT(*) FROM caisse_drivers WHERE account_id = $1',
    [GLOBAL_FLEET_ACCOUNT_ID]
  );
  const drvCount = parseInt(drvCountRes.rows[0].count, 10);

  if (drvCount === 0) {
    for (const d of INITIAL_DRIVERS) {
      await pool.query(
        `INSERT INTO caisse_drivers (id, account_id, nom, tr, statut, date_derniere, reclamation, caisses_dues, programme_jour, circuit_actuel)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (account_id, id) DO NOTHING`,
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
        ]
      );
    }
  }

  accountsInitialized = true;
}

