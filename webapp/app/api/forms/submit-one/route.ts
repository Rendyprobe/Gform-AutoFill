import { NextResponse } from 'next/server';
import { buildSubmissionParams, fetchFormSchema } from '@/lib/google-forms';
import { sendFormResponse } from '@/lib/form-submission';
import { readJsonBody } from '@/lib/request-safety';

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

    const params = buildSubmissionParams(schema, body.answers);

    lastSubmissionByForm.set(schema.formId, Date.now());
    return NextResponse.json(await sendFormResponse(schema.responseUrl, params));
  } catch (error) {
    return NextResponse.json({ status: 'failed', error: error instanceof Error ? error.message : 'Pengiriman gagal.' }, { status: 400 });
  }
}
