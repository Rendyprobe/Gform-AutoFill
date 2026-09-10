import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFormSchema, normalizeFormUrl, validateAnswer, type FormQuestion } from './google-forms';

const formUrl = 'https://docs.google.com/forms/d/e/FORM_ID/viewform';

function formHtml(items: unknown[][]) {
  const form: unknown[] = [];
  form[0] = 'Deskripsi';
  form[1] = items;
  form[8] = 'Form Uji';
  const root: unknown[] = [];
  root[1] = form;
  return `<script>var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(root)};</script>`;
}

function mockGoogleForm(html: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    url: formUrl,
    text: async () => html,
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchFormSchema', () => {
  it('mengenali pertanyaan rating sebagai tipe yang didukung', async () => {
    mockGoogleForm(formHtml([
      [101, 'Nama', null, 0, [[1001, null, 1]]],
      [102, 'Nilai layanan', null, 18, [[1002, [['1'], ['2'], ['3']], 1]]],
    ]));

    const schema = await fetchFormSchema(formUrl);

    expect(schema.supported).toBe(true);
    expect(schema.questions[1]).toMatchObject({ type: 'rating', options: ['1', '2', '3'], min: 1, max: 3 });
  });

  it('memblokir form multi-bagian sampai percabangan dapat diverifikasi', async () => {
    mockGoogleForm(formHtml([
      [101, 'Nama', null, 0, [[1001, null, 1]]],
      [999, 'Bagian kedua', null, 8],
      [102, 'Komentar', null, 1, [[1002, null, 0]]],
    ]));

    const schema = await fetchFormSchema(formUrl);

    expect(schema.pageCount).toBe(2);
    expect(schema.supported).toBe(false);
    expect(schema.warnings.join(' ')).toContain('belum dapat dijalankan dengan aman');
  });
});

describe('validasi input', () => {
  const rating: FormQuestion = {
    id: '1', entryId: '2', columnKey: 'Q01', title: 'Rating', type: 'rating', required: true, options: ['1', '2', '3'], min: 1, max: 3,
  };

  it('menolak URL di luar responder Google Forms', () => {
    expect(() => normalizeFormUrl('https://example.com/forms/d/e/FORM_ID/viewform')).toThrow('docs.google.com');
    expect(() => normalizeFormUrl('https://docs.google.com/forms/d/e/FORM_ID/edit')).toThrow('/viewform');
  });

  it('menolak rating kosong atau di luar pilihan', () => {
    expect(validateAnswer(rating, '')).toBe('Wajib diisi.');
    expect(validateAnswer(rating, '4')).toContain('Pilihan tidak valid');
    expect(validateAnswer(rating, '2')).toBeNull();
  });
});
