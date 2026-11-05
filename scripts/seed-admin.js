const { Pool } = require('pg');

const url = 'postgresql://neondb_owner:npg_Z51pciXwaNoq@ep-small-hat-bea05mpr-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function seed() {
  await pool.query(
    `INSERT INTO caisse_accounts (id, username, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (username) DO NOTHING`,
    ['acc-admin', 'admin', 'admin123', 'Administrateur Caisse', 'admin']
  );
  console.log('Admin account created / verified successfully in new Neon DB!');
  await pool.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
