export type QuestionType = 'short' | 'paragraph' | 'multipleChoice' | 'dropdown' | 'checkboxes' | 'scale' | 'rating' | 'unsupported';

export type FormQuestion = {
  id: string;
  entryId: string;
  columnKey: string;
  title: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  sectionIndex?: number;
  min?: number;
  max?: number;
};

export type FormSchema = {
  version: 1;
  formId: string;
  formUrl: string;
  responseUrl: string;
  title: string;
  description: string;
  schemaHash: string;
  pageCount: number;
  questions: FormQuestion[];
  warnings: string[];
  supported: boolean;
};

const typeMap: Record<number, QuestionType> = {
  0: 'short',
  1: 'paragraph',
  2: 'multipleChoice',
  3: 'dropdown',
  4: 'checkboxes',
  5: 'scale',
  18: 'rating',
};

const formFetchTimeoutMs = 30_000;
const maxFormHtmlCharacters = 5 * 1024 * 1024;

function cleanText(value: unknown): string {
  const text = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeFormUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('URL tidak valid. Tempel URL responder Google Form yang lengkap.');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') {
    throw new Error('Hanya URL HTTPS dari docs.google.com/forms yang didukung.');
  }
  const match = url.pathname.match(/^\/forms\/d\/(?:e\/)?([^/]+)\/(viewform|formResponse)\/?$/);
  if (!match) {
    throw new Error('Gunakan URL responder yang berakhiran /viewform, bukan URL editor.');
  }
  const formId = match[1];
  const base = `${url.origin}${url.pathname.replace(/\/(viewform|formResponse)\/?$/, '')}`;
  return { formId, formUrl: `${base}/viewform`, responseUrl: `${base}/formResponse` };
}

function extractLoadData(html: string): unknown[] {
  const marker = 'var FB_PUBLIC_LOAD_DATA_ = ';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('Struktur form tidak ditemukan. Pastikan form dipublikasikan dan tidak meminta login.');
  const jsonStart = start + marker.length;
  const end = html.indexOf(';</script>', jsonStart);
  if (end < 0) throw new Error('Metadata form tidak lengkap atau format Google Forms telah berubah.');
  try {
    return JSON.parse(html.slice(jsonStart, end));
  } catch {
    throw new Error('Metadata form tidak dapat dibaca. Format Google Forms mungkin telah berubah.');
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function optionsFrom(definition: unknown): string[] {
  if (!Array.isArray(definition)) return [];
  return definition
    .filter(Array.isArray)
    .map((option) => cleanText(option[0]))
    .filter(Boolean);
}

export async function fetchFormSchema(inputUrl: string): Promise<FormSchema> {
  const normalized = normalizeFormUrl(inputUrl);
  let response: Response | undefined;
  let html = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(normalized.formUrl, {
        redirect: 'follow',
        headers: { 'user-agent': 'Gform-AutoFill/0.1 (+local testing tool)' },
        signal: AbortSignal.timeout(formFetchTimeoutMs),
      });
      html = await response.text();
      break;
    } catch (error) {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
      throw new Error(timedOut
        ? 'Pembacaan Google Form timeout setelah 2 percobaan (30 detik per percobaan). Respons belum dikirim.'
        : 'Google Form tidak dapat dibaca setelah 2 percobaan. Respons belum dikirim.');
    }
  }
  if (!response || !response.ok) throw new Error(`Google Form tidak dapat dibuka (HTTP ${response?.status}). Respons belum dikirim.`);
  if (new URL(response.url).hostname !== 'docs.google.com') {
    throw new Error('Form mengarahkan ke halaman login. Respons belum dikirim.');
  }

  if (html.length > maxFormHtmlCharacters) throw new Error('Ukuran Google Form terlalu besar untuk diproses dengan aman.');
  const root = extractLoadData(html);
  const form = root[1] as unknown[];
  const items = Array.isArray(form?.[1]) ? (form[1] as unknown[][]) : [];
  const warnings: string[] = [];
  const questions: FormQuestion[] = [];
  let sections = 0;
  let hasBranching = false;

  for (const item of items) {
    if (!Array.isArray(item)) continue;
    const rawType = Number(item[3]);
    if (rawType === 8) {
      // Explicit page destinations are not part of the supported linear flow.
      if (item[5] != null && item[5] !== -2) hasBranching = true;
      sections += 1;
      continue;
    }
    const answerGroups = item[4];
    if (!Array.isArray(answerGroups) || !Array.isArray(answerGroups[0])) continue;
    const definition = answerGroups[0] as unknown[];
    if (Array.isArray(definition[1]) && definition[1].some((option: unknown) =>
      Array.isArray(option) && option[2] != null && option[2] !== -2
    )) hasBranching = true;
    const entryId = typeof definition[0] === 'number' || typeof definition[0] === 'string' ? String(definition[0]) : '';
    if (!/^\d+$/.test(entryId)) continue;

    const type = typeMap[rawType] ?? 'unsupported';
    const options = optionsFrom(definition[1]);
    const questionNumber = questions.length + 1;
    const title = cleanText(item[1]) || `Pertanyaan ${questionNumber}`;
    questions.push({
      id: typeof item[0] === 'number' || typeof item[0] === 'string' ? String(item[0]) : entryId,
      entryId,
      columnKey: `Q${String(questionNumber).padStart(2, '0')}`,
      title,
      type,
      required: Boolean(definition[2]),
      options,
      sectionIndex: sections,
      ...(['scale', 'rating'].includes(type) && options.length ? { min: Number(options[0]), max: Number(options.at(-1)) } : {}),
    });
    if (type === 'unsupported') warnings.push(`“${title}” memakai tipe pertanyaan yang belum didukung.`);
  }

  if (!questions.length) throw new Error('Tidak ada pertanyaan yang dapat dibaca dari form ini.');
  if (/type="file"|fileUpload/i.test(html)) warnings.push('Form memiliki upload file dan tidak dapat dijalankan oleh MVP.');
  if (sections > 1) warnings.push(`${sections + 1} bagian terdeteksi. Saat ini maksimal 2 bagian berurutan yang didukung.`);
  if (hasBranching) warnings.push('Form memiliki percabangan atau tujuan bagian khusus. Gunakan alur berurutan tanpa percabangan.');

  const signature = questions.map(({ entryId, title, type, required, options }) => ({ entryId, title, type, required, options }));
  const schemaHash = await sha256(JSON.stringify(sections > 0
    ? { questions: signature, sections: questions.map((question) => question.sectionIndex), pageCount: sections + 1, hasBranching }
    : signature));
  return {
    version: 1,
    ...normalized,
    title: cleanText(form?.[8]) || cleanText(html.match(/<title>([\s\S]*?)<\/title>/)?.[1]) || 'Google Form',
    description: cleanText(form?.[0]),
    schemaHash,
    pageCount: sections + 1,
    questions,
    warnings,
    supported: !questions.some((question) => question.type === 'unsupported') && !/type="file"|fileUpload/i.test(html) && sections <= 1 && !hasBranching,
  };
}

export function buildSubmissionParams(schema: FormSchema, answers: Record<string, string | string[]>) {
  if (!schema.supported || schema.pageCount < 1 || schema.pageCount > 2) throw new Error('Struktur form belum didukung.');
  const params = new URLSearchParams();
  params.set('fvv', '1');
  params.set('pageHistory', Array.from({ length: schema.pageCount }, (_, index) => index).join(','));
  for (const question of schema.questions) {
    const answer = answers[question.columnKey];
    const problem = validateAnswer(question, answer);
    if (problem) throw new Error(`${question.columnKey} — ${problem}`);
    for (const value of Array.isArray(answer) ? answer : [answer]) {
      if (String(value ?? '').trim()) params.append(`entry.${question.entryId}`, String(value).trim());
    }
  }
  return params;
}

export function validateAnswer(question: FormQuestion, answer: unknown): string | null {
  const toText = (value: unknown) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value).trim() : '';
  const values = Array.isArray(answer) ? answer.map(toText).filter(Boolean) : [toText(answer)].filter(Boolean);
  if (question.required && values.length === 0) return 'Wajib diisi.';
  if (values.length === 0) return null;
  if (question.type === 'unsupported') return 'Tipe pertanyaan belum didukung.';
  if (question.type === 'checkboxes' && !Array.isArray(answer)) return 'Pisahkan beberapa pilihan dengan tanda |.';
  if (['multipleChoice', 'dropdown', 'checkboxes', 'scale', 'rating'].includes(question.type)) {
    const invalid = values.find((value) => !question.options.includes(value));
    if (invalid) return `Pilihan tidak valid: ${invalid}`;
  }
  return null;
}
