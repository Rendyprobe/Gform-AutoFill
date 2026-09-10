import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendFormResponse } from './form-submission';

afterEach(() => vi.unstubAllGlobals());

describe('hasil pengiriman Google Form', () => {
  it.each([
    ['Your response has been recorded', 'sent'],
    ['Terima kasih atas partisipasi Anda', 'unknown'],
  ])('mengklasifikasikan konfirmasi tanpa mengasumsikan sukses: %s', async (html, status) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(html));
    vi.stubGlobal('fetch', fetchMock);
    expect((await sendFormResponse('https://docs.google.com/formResponse', new URLSearchParams())).status).toBe(status);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mempertahankan kegagalan HTTP yang eksplisit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Rejected', { status: 403 })));
    expect(await sendFormResponse('https://docs.google.com/formResponse', new URLSearchParams())).toMatchObject({ status: 'failed', message: expect.stringContaining('403') });
  });

  it.each(['fetch', 'body'])('timeout pada %s bukan bukti gagal dan tidak memicu pengiriman ulang', async (stage) => {
    const timeout = new DOMException('Timeout', 'TimeoutError');
    const fetchMock = stage === 'fetch' ? vi.fn().mockRejectedValue(timeout)
      : vi.fn().mockResolvedValue({ ok: true, text: async () => { throw timeout; } });
    vi.stubGlobal('fetch', fetchMock);
    expect((await sendFormResponse('https://docs.google.com/formResponse', new URLSearchParams())).status).toBe('unknown');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
