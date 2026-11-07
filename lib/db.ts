import { Pool } from 'pg';

const globalPools = globalThis as unknown as {
  pools?: Map<string, Pool>;
  schemaInitialized?: boolean;
};

if (!globalPools.pools) {
  globalPools.pools = new Map<string, Pool>();
}

export function cleanConnectionString(rawUrl?: string): string {
  const url = rawUrl || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return url.replace(/&?channel_binding=require/g, '');
}

export function getPool(customUrl?: string): Pool {
  const url = cleanConnectionString(customUrl);
  let pool = globalPools.pools!.get(url);
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });
    globalPools.pools!.set(url, pool);
  }
  return pool;
}

export async function initDatabaseSchema(customUrl?: string) {
  const pool = getPool(customUrl);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS caisse_accounts (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'cashier',
      custom_db_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS caisse_drivers (
      id VARCHAR(64) NOT NULL,
      account_id VARCHAR(64) NOT NULL REFERENCES caisse_accounts(id) ON DELETE CASCADE,
      nom VARCHAR(255) NOT NULL,
      tr VARCHAR(50) NOT NULL,
      statut VARCHAR(50) NOT NULL,
      date_derniere TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      reclamation TEXT DEFAULT '',
      caisses_dues INT DEFAULT 0,
      programme_jour VARCHAR(100) DEFAULT '',
      circuit_actuel VARCHAR(100) DEFAULT '',
      serie VARCHAR(50) DEFAULT '',
      sous_serie VARCHAR(50) DEFAULT '',
      montant_bordereau NUMERIC(12, 3) DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id, id)
    );

    -- Auto-migrations for existing installations
    ALTER TABLE caisse_drivers ADD COLUMN IF NOT EXISTS serie VARCHAR(50) DEFAULT '';
    ALTER TABLE caisse_drivers ADD COLUMN IF NOT EXISTS sous_serie VARCHAR(50) DEFAULT '';
    ALTER TABLE caisse_drivers ADD COLUMN IF NOT EXISTS montant_bordereau NUMERIC(12, 3) DEFAULT 0;

    CREATE TABLE IF NOT EXISTS caisse_transactions (
      id VARCHAR(64) NOT NULL,
      account_id VARCHAR(64) NOT NULL REFERENCES caisse_accounts(id) ON DELETE CASCADE,
      date TIMESTAMP WITH TIME ZONE NOT NULL,
      code_chauffeur VARCHAR(50) NOT NULL,
      nom_chauffeur VARCHAR(255) NOT NULL,
      recette NUMERIC(12, 3) NOT NULL DEFAULT 0,
      t_payer NUMERIC(12, 3) NOT NULL DEFAULT 0,
      res_a_payer NUMERIC(12, 3) NOT NULL DEFAULT 0,
      versement NUMERIC(12, 3) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'PAYE',
      raw_data JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id, id)
    );

    CREATE TABLE IF NOT EXISTS caisse_billetterie (
      account_id VARCHAR(64) PRIMARY KEY REFERENCES caisse_accounts(id) ON DELETE CASCADE,
      items JSONB NOT NULL,
      srf_moins NUMERIC(12, 3) NOT NULL DEFAULT 0,
      ver NUMERIC(12, 3) NOT NULL DEFAULT 0,
      recette_theorique NUMERIC(12, 3) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS caisse_desk_state (
      account_id VARCHAR(64) PRIMARY KEY REFERENCES caisse_accounts(id) ON DELETE CASCADE,
      desk_rows JSONB NOT NULL,
      desk_recette NUMERIC(12, 3) NOT NULL DEFAULT 0,
      desk_versement NUMERIC(12, 3) NOT NULL DEFAULT 0,
      desk_tr_input VARCHAR(50) DEFAULT '',
      selected_driver_id VARCHAR(64),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS caisse_billetterie_history (
      id VARCHAR(64) NOT NULL,
      account_id VARCHAR(64) NOT NULL REFERENCES caisse_accounts(id) ON DELETE CASCADE,
      date_cloture TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      total_coupures NUMERIC(12, 3) NOT NULL DEFAULT 0,
      srf_pieces NUMERIC(12, 3) NOT NULL DEFAULT 0,
      srf_moins NUMERIC(12, 3) NOT NULL DEFAULT 0,
      ver NUMERIC(12, 3) NOT NULL DEFAULT 0,
      tt_physique NUMERIC(12, 3) NOT NULL DEFAULT 0,
      recette_theorique NUMERIC(12, 3) NOT NULL DEFAULT 0,
      ecart_reste NUMERIC(12, 3) NOT NULL DEFAULT 0,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      archived_transactions JSONB NOT NULL DEFAULT '[]'::jsonb,
      caissier_nom VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id, id)
    );

    ALTER TABLE caisse_billetterie_history ADD COLUMN IF NOT EXISTS archived_transactions JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
}

