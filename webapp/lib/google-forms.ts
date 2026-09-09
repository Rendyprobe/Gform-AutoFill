export type QuestionType = 'short' | 'paragraph' | 'multipleChoice' | 'dropdown' | 'checkboxes' | 'scale' | 'unsupported';

export type FormQuestion = {
  id: string;
  entryId: string;
  columnKey: string;
  title: string;
  type: QuestionType;
  required: boolean;
  options: string[];
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
};

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
  const response = await fetch(normalized.formUrl, {
    redirect: 'follow',
    headers: { 'user-agent': 'Gform-AutoFill/0.1 (+local testing tool)' },
  });
  if (!response.ok) throw new Error(`Google Form tidak dapat dibuka (HTTP ${response.status}).`);
  if (new URL(response.url).hostname !== 'docs.google.com') {
    throw new Error('Form mengarahkan ke halaman login. Form seperti ini belum didukung.');
  }

  const html = await response.text();
  const root = extractLoadData(html);
  const form = root[1] as unknown[];
  const items = Array.isArray(form?.[1]) ? (form[1] as unknown[][]) : [];
  const warnings: string[] = [];
  const questions: FormQuestion[] = [];
  let sections = 0;

  for (const item of items) {
    if (!Array.isArray(item)) continue;
    const rawType = Number(item[3]);
    if (rawType === 8) {
      sections += 1;
      continue;
    }
    const answerGroups = item[4];
    if (!Array.isArray(answerGroups) || !Array.isArray(answerGroups[0])) continue;
    const definition = answerGroups[0] as unknown[];
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
      ...(type === 'scale' && options.length ? { min: Number(options[0]), max: Number(options.at(-1)) } : {}),
    });
    if (type === 'unsupported') warnings.push(`“${title}” memakai tipe pertanyaan yang belum didukung.`);
  }

  if (!questions.length) throw new Error('Tidak ada pertanyaan yang dapat dibaca dari form ini.');
  if (/type="file"|fileUpload/i.test(html)) warnings.push('Form memiliki upload file dan tidak dapat dijalankan oleh MVP.');
  if (sections > 0) warnings.push(`${sections + 1} bagian terdeteksi. Hanya alur lurus tanpa percabangan yang didukung.`);

  const signature = questions.map(({ entryId, title, type, required, options }) => ({ entryId, title, type, required, options }));
  const schemaHash = await sha256(JSON.stringify(signature));
  return {
    version: 1,
    ...normalized,
    title: cleanText(form?.[8]) || cleanText(html.match(/<title>([\s\S]*?)<\/title>/)?.[1]) || 'Google Form',
    description: cleanText(form?.[0]),
    schemaHash,
    pageCount: sections + 1,
    questions,
    warnings,
    supported: !questions.some((question) => question.type === 'unsupported') && !/type="file"|fileUpload/i.test(html),
  };
}

export function validateAnswer(question: FormQuestion, answer: unknown): string | null {
  const toText = (value: unknown) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value).trim() : '';
  const values = Array.isArray(answer) ? answer.map(toText).filter(Boolean) : [toText(answer)].filter(Boolean);
  if (question.required && values.length === 0) return 'Wajib diisi.';
  if (values.length === 0) return null;
  if (question.type === 'unsupported') return 'Tipe pertanyaan belum didukung.';
  if (question.type === 'checkboxes' && !Array.isArray(answer)) return 'Pisahkan beberapa pilihan dengan tanda |.';
  if (['multipleChoice', 'dropdown', 'checkboxes', 'scale'].includes(question.type)) {
    const invalid = values.find((value) => !question.options.includes(value));
    if (invalid) return `Pilihan tidak valid: ${invalid}`;
  }
  return null;
}
