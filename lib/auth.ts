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
  role: string;
  customDbUrl?: string | null;
}

export function signToken(user: UserAccount): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      customDbUrl: user.customDbUrl || null,
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

export async function ensureDefaultAccountsAndSeed() {
  await initDatabaseSchema();
  const pool = getPool();

  const countRes = await pool.query('SELECT COUNT(*) FROM caisse_accounts');
  const count = parseInt(countRes.rows[0].count, 10);

  if (count === 0) {
    // Seed default accounts
    const defaultAccounts = [
      {
        id: 'acc-admin',
        username: 'admin',
        password: 'admin123',
        displayName: 'Caisse Principale (Admin)',
        role: 'admin',
      },
      {
        id: 'acc-sfax',
        username: 'sfax',
        password: 'sfax123',
        displayName: 'Caisse Régionale Sfax',
        role: 'cashier',
      },
      {
        id: 'acc-tunis',
        username: 'tunis',
        password: 'tunis123',
        displayName: 'Caisse Régionale Tunis',
        role: 'cashier',
      },
    ];

    for (const acc of defaultAccounts) {
      const hash = await bcrypt.hash(acc.password, 10);
      await pool.query(
        `INSERT INTO caisse_accounts (id, username, password_hash, display_name, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (username) DO NOTHING`,
        [acc.id, acc.username, hash, acc.displayName, acc.role]
      );

      // Seed initial drivers for each account
      for (const d of INITIAL_DRIVERS) {
        await pool.query(
          `INSERT INTO caisse_drivers (id, account_id, nom, tr, statut, date_derniere, reclamation, caisses_dues, programme_jour, circuit_actuel)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (account_id, id) DO NOTHING`,
          [
            d.id,
            acc.id,
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
  }
}

