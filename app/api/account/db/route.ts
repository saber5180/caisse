import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getPool, initDatabaseSchema } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { customDbUrl, testOnly } = await req.json();

    if (customDbUrl && customDbUrl.trim().length > 0) {
      try {
        const testPool = getPool(customDbUrl.trim());
        await testPool.query('SELECT 1');
        await initDatabaseSchema(customDbUrl.trim());
      } catch (err: any) {
        return NextResponse.json(
          { error: `Échec de connexion à la base de données : ${err.message}` },
          { status: 400 }
        );
      }
    }

    if (testOnly) {
      return NextResponse.json({ success: true, message: 'Connexion à la base de données réussie !' });
    }

    // Save to user account
    const mainPool = getPool();
    await mainPool.query(
      'UPDATE caisse_accounts SET custom_db_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [customDbUrl && customDbUrl.trim().length > 0 ? customDbUrl.trim() : null, session.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Configuration de la base de données enregistrée avec succès.',
      customDbUrl: customDbUrl && customDbUrl.trim().length > 0 ? customDbUrl.trim() : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la configuration de la base de données' },
      { status: 500 }
    );
  }
}

