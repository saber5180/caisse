import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'La création de compte se fait uniquement par l’administrateur, dans Comptes utilisateurs.',
    },
    { status: 403 }
  );
}
