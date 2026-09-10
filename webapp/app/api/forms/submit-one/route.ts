import { NextResponse } from 'next/server';
import { fetchFormSchema, validateAnswer } from '@/lib/google-forms';
import { readJsonBody } from '@/lib/request-safety';

type SubmissionBody = {
  formUrl?: string;
  schemaHash?: string;
  testCaseId?: string;
  answers?: Record<string, string | string[]>;
};

const lastSubmissionByForm = new Map<string, number>();
const minimumIntervalMs = 1900;
const submitTimeoutMs = 20_000;
const maxConfirmationCharacters = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<SubmissionBody>(request);
    if (
      typeof body.formUrl !== 'string' ||
      typeof body.schemaHash !== 'string' ||
      typeof body.testCaseId !== 'string' ||
      !body.answers ||
      typeof body.answers !== 'object' ||
      Array.isArray(body.answers)
    ) throw new Error('Data pengiriman tidak lengkap atau formatnya salah.');
    if (body.testCaseId.length > 100) throw new Error('Test Case ID maksimal 100 karakter.');
    const schema = await fetchFormSchema(body.formUrl);
    if (!schema.supported) throw new Error('Form memiliki fitur yang belum didukung.');
    if (schema.schemaHash !== body.schemaHash) throw new Error('Form berubah sejak template dibuat. Unduh template baru.');
    if (Object.keys(body.answers).length > schema.questions.length) throw new Error('Data jawaban memiliki kolom yang tidak dikenali.');
    if (Object.values(body.answers).some((answer) => typeof answer !== 'string' && (!Array.isArray(answer) || answer.some((value) => typeof value !== 'string')))) {
      throw new Error('Nilai jawaban harus berupa teks.');
    }
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
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'accept-language': 'id,en;q=0.8',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(submitTimeoutMs),
      });
    } catch {
      return NextResponse.json({ status: 'unknown', message: 'Koneksi terputus saat mengirim. Periksa respons form sebelum mencoba ulang.' });
    }

    const responseText = await googleResponse.text();
    if (responseText.length > maxConfirmationCharacters) throw new Error('Halaman konfirmasi terlalu besar untuk diverifikasi.');
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
