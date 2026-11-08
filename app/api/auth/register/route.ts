import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'La création de compte est désactivée. Veuillez utiliser l’un des 5 comptes officiels (Superviseur, Admin, CRNU, CRSF, CRTN).',
    },
    { status: 403 }
  );
}
