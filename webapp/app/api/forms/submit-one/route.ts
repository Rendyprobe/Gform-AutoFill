import { NextResponse } from 'next/server';
import { fetchFormSchema, validateAnswer } from '@/lib/google-forms';

type SubmissionBody = {
  formUrl?: string;
  schemaHash?: string;
  testCaseId?: string;
  answers?: Record<string, string | string[]>;
};

const lastSubmissionByForm = new Map<string, number>();
const minimumIntervalMs = 1900;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmissionBody;
    if (!body.formUrl || !body.schemaHash || !body.testCaseId || !body.answers) throw new Error('Data pengiriman tidak lengkap.');
    const schema = await fetchFormSchema(body.formUrl);
    if (!schema.supported) throw new Error('Form memiliki fitur yang belum didukung.');
    if (schema.schemaHash !== body.schemaHash) throw new Error('Form berubah sejak template dibuat. Unduh template baru.');
    const now = Date.now();
    const lastSubmission = lastSubmissionByForm.get(schema.formId) ?? 0;
    if (now - lastSubmission < minimumIntervalMs) {
      return NextResponse.json({ status: 'failed', error: 'Pengiriman terlalu cepat. Tunggu minimal 2 detik.' }, { status: 429 });
    }

    const params = new URLSearchParams();
    params.set('fvv', '1');
    params.set('pageHistory', Array.from({ length: schema.pageCount }, (_, index) => index).join(','));

    for (const question of schema.questions) {
      const answer = body.answers[question.columnKey];
      const problem = validateAnswer(question, answer);
      if (problem) throw new Error(`${question.columnKey} — ${problem}`);
      const values = Array.isArray(answer) ? answer : [answer];
      for (const value of values) {
        if (String(value ?? '').trim()) params.append(`entry.${question.entryId}`, String(value).trim());
      }
    }

    let googleResponse: Response;
    try {
      lastSubmissionByForm.set(schema.formId, Date.now());
      googleResponse = await fetch(schema.responseUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: params.toString(),
      });
    } catch {
      return NextResponse.json({ status: 'unknown', message: 'Koneksi terputus saat mengirim. Periksa respons form sebelum mencoba ulang.' });
    }

    const responseText = await googleResponse.text();
    if (!googleResponse.ok) throw new Error(`Google menolak respons (HTTP ${googleResponse.status}).`);
    const successMarker = /Jawaban Anda telah direkam|Respons Anda telah direkam|Your response has been recorded/i.test(responseText);
    if (!successMarker) {
      return NextResponse.json({ status: 'unknown', message: 'Google menerima permintaan, tetapi halaman konfirmasi tidak dikenali. Jangan kirim ulang sebelum memeriksa form.' });
    }
    return NextResponse.json({ status: 'sent', message: 'Respons uji berhasil dikirim.' });
  } catch (error) {
    return NextResponse.json({ status: 'failed', error: error instanceof Error ? error.message : 'Pengiriman gagal.' }, { status: 400 });
  }
}
