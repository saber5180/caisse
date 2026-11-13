import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, ensureDefaultAccountsAndSeed } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Séries / Sous-série / Valeur : strictement propres à CHAQUE compte caisse (account_id)
export async function GET() {
  try {
    await ensureDefaultAccountsAndSeed();
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const res = await getPool().query(
      'SELECT serie1, serie2, serie3, sous_serie, valeur FROM caisse_hero_state WHERE account_id = $1',
      [session.id]
    );
    const r = res.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        serie1: r?.serie1 || '',
        serie2: r?.serie2 || '',
        serie3: r?.serie3 || '',
        sousSerie: r?.sous_serie || '',
        valeur: r?.valeur || '',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultAccountsAndSeed();
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const b = await req.json();
    const clip = (v: any, n: number) => String(v ?? '').slice(0, n);
    await getPool().query(
      `INSERT INTO caisse_hero_state (account_id, serie1, serie2, serie3, sous_serie, valeur, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (account_id) DO UPDATE SET
         serie1 = EXCLUDED.serie1, serie2 = EXCLUDED.serie2, serie3 = EXCLUDED.serie3,
         sous_serie = EXCLUDED.sous_serie, valeur = EXCLUDED.valeur, updated_at = CURRENT_TIMESTAMP`,
      [session.id, clip(b.serie1, 120), clip(b.serie2, 120), clip(b.serie3, 120), clip(b.sousSerie, 120), clip(b.valeur, 40)]
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 500 });
  }
}