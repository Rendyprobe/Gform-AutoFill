import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSubmissionParams, fetchFormSchema, normalizeFormUrl, validateAnswer, type FormQuestion } from './google-forms';

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
  it('mengulang pembacaan setelah body timeout, tanpa mengirim jawaban', async () => {
    const html = formHtml([[101, 'Nama', null, 0, [[1001, null, 1]]]]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, url: formUrl, text: async () => { throw new DOMException('Timeout', 'TimeoutError'); } })
      .mockResolvedValueOnce({ ok: true, url: formUrl, text: async () => html });
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchFormSchema(formUrl)).supported).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true);
  });

  it('menjelaskan bahwa respons belum dikirim setelah pembacaan gagal dua kali', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('Timeout', 'TimeoutError'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchFormSchema(formUrl)).rejects.toThrow('Respons belum dikirim');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('mengenali pertanyaan rating sebagai tipe yang didukung', async () => {
    mockGoogleForm(formHtml([
      [101, 'Nama', null, 0, [[1001, null, 1]]],
      [102, 'Nilai layanan', null, 18, [[1002, [['1'], ['2'], ['3']], 1]]],
    ]));

    const schema = await fetchFormSchema(formUrl);

    expect(schema.supported).toBe(true);
    expect(schema.questions[1]).toMatchObject({ type: 'rating', options: ['1', '2', '3'], min: 1, max: 3 });
  });

  it('mendukung dua bagian dan mengirim jawaban keduanya dengan urutan halaman', async () => {
    mockGoogleForm(formHtml([
      [101, 'Nama', null, 0, [[1001, null, 1]]],
      [999, 'Bagian kedua', null, 8],
      [102, 'Komentar', null, 1, [[1002, null, 0]]],
    ]));

    const schema = await fetchFormSchema(formUrl);

    expect(schema.pageCount).toBe(2);
    expect(schema.supported).toBe(true);
    expect(schema.questions.map((question) => question.sectionIndex)).toEqual([0, 1]);
    const params = buildSubmissionParams(schema, { Q01: 'TEST-Nama', Q02: 'Komentar bagian kedua' });
    expect(params.get('pageHistory')).toBe('0,1');
    expect(params.get('entry.1001')).toBe('TEST-Nama');
    expect(params.get('entry.1002')).toBe('Komentar bagian kedua');
  });

  it('memvalidasi jawaban wajib di bagian kedua sebelum pengiriman', async () => {
    mockGoogleForm(formHtml([[101, 'Nama', null, 0, [[1001, null, 1]]], [999, 'Bagian kedua', null, 8], [102, 'Komentar', null, 1, [[1002, null, 1]]]]));
    const schema = await fetchFormSchema(formUrl);
    expect(() => buildSubmissionParams(schema, { Q01: 'TEST-Nama' })).toThrow('Q02');
  });

  it('memblokir tiga bagian dan percabangan pilihan maupun bagian', async () => {
    for (const items of [
      [[101, 'Nama', null, 0, [[1001, null, 1]]], [998, 'Dua', null, 8], [999, 'Tiga', null, 8]],
      [[101, 'Pilihan', null, 2, [[1001, [['Ya', null, 999]], 1]]], [999, 'Dua', null, 8]],
      [[101, 'Nama', null, 0, [[1001, null, 1]]], [999, 'Dua', null, 8, null, -3]],
    ]) {
      mockGoogleForm(formHtml(items));
      const schema = await fetchFormSchema(formUrl);
      expect(schema.supported).toBe(false);
      expect(() => buildSubmissionParams(schema, { Q01: 'Ya' })).toThrow('belum didukung');
    }
  });

  it('mengubah hash ketika pembagian halaman berubah', async () => {
    const first = [101, 'Nama', null, 0, [[1001, null, 1]]];
    const second = [102, 'Komentar', null, 1, [[1002, null, 0]]];
    mockGoogleForm(formHtml([first, second]));
    const one = await fetchFormSchema(formUrl);
    expect(buildSubmissionParams(one, { Q01: 'TEST-Nama' }).get('pageHistory')).toBe('0');
    mockGoogleForm(formHtml([first, [999, 'Dua', null, 8], second]));
    const two = await fetchFormSchema(formUrl);
    expect(two.schemaHash).not.toBe(one.schemaHash);
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
