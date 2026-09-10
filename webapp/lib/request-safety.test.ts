import { describe, expect, it } from 'vitest';
import { assertSameOrigin, readJsonBody } from './request-safety';

describe('keamanan request API lokal', () => {
  it('menolak request lintas situs', () => {
    const request = new Request('http://localhost:3000/api/forms/inspect', { headers: { origin: 'https://evil.example' } });
    expect(() => assertSameOrigin(request)).toThrow('lintas situs');
  });

  it('menerima JSON same-origin dan menolak body terlalu besar', async () => {
    const valid = new Request('http://localhost:3000/api/forms/inspect', {
      method: 'POST', headers: { origin: 'http://localhost:3000' }, body: JSON.stringify({ url: 'ok' }),
    });
    await expect(readJsonBody<{ url: string }>(valid, 100)).resolves.toEqual({ url: 'ok' });

    const oversized = new Request('http://localhost:3000/api/forms/inspect', { method: 'POST', body: JSON.stringify({ value: 'x'.repeat(100) }) });
    await expect(readJsonBody(oversized, 20)).rejects.toThrow('terlalu besar');
  });
});
