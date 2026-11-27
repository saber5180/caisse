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

const DEFAULT_ADMIN = {
  id: 'acc-admin',
  username: 'admin',
  password: 'admin123',
  displayName: 'Administration Générale',
  role: 'admin',
  caisseCode: 'ADMIN',
} as const;

export function signToken(user: UserAccount): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      caisseCode: user.caisseCode || '',
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

  const existingAdmin = await pool.query(
    `SELECT id FROM caisse_accounts
     WHERE LOWER(username) = $1 OR id = $2 OR role = 'admin'
     LIMIT 1`,
    [DEFAULT_ADMIN.username, DEFAULT_ADMIN.id]
  );

  if (existingAdmin.rows.length === 0) {
    const hash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
    await pool.query(
      `INSERT INTO caisse_accounts (id, username, password_hash, display_name, role, caisse_code, is_blocked)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)
       ON CONFLICT (id) DO NOTHING`,
      [
        DEFAULT_ADMIN.id,
        DEFAULT_ADMIN.username,
        hash,
        DEFAULT_ADMIN.displayName,
        DEFAULT_ADMIN.role,
        DEFAULT_ADMIN.caisseCode,
      ]
    );
  }

  accountsInitialized = true;
}

