import { NextResponse } from 'next/server';
import { fetchFormSchema } from '@/lib/google-forms';
import { readJsonBody } from '@/lib/request-safety';

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{ url?: string }>(request, 8 * 1024);
    if (!body.url) throw new Error('URL Google Form wajib diisi.');
    const schema = await fetchFormSchema(body.url);
    return NextResponse.json({ schema });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Form tidak dapat dibaca.' }, { status: 400 });
  }
}
