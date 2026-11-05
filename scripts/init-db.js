const { Pool } = require('pg');

const url = 'postgresql://neondb_owner:npg_Z51pciXwaNoq@ep-small-hat-bea05mpr-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function init() {
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
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id, id)
    );

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
  `);
  console.log('SUCCESS: All 5 tables initialized in Neon database!');
  await pool.end();
}

init().catch(err => {
  console.error(err);
  process.exit(1);
});
