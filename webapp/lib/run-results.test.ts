import { describe, expect, it } from 'vitest';
import { prepareResume, type RunResult } from './run-results';

describe('melanjutkan respons yang dilewati', () => {
  it('tidak mengirim ulang respons yang sudah terkirim atau gagal', () => {
    const results: RunResult[] = [
      { testCaseId: 'TEST-1', status: 'sent', message: 'Dikonfirmasi pengguna' },
      { testCaseId: 'TEST-2', status: 'skipped', message: 'Dilewati' },
      { testCaseId: 'TEST-3', status: 'failed', message: 'Ditolak' },
    ];
    const resumed = prepareResume(results);
    expect(resumed.filter((result) => result.status === 'pending').map((result) => result.testCaseId)).toEqual(['TEST-2']);
    expect(resumed[0]).toEqual(results[0]);
    expect(results[1].status).toBe('skipped');
  });
  it('melanjutkan tanpa konfirmasi dan tidak mengirim ulang hasil yang belum pasti', () => {
    const resumed = prepareResume([
      { testCaseId: 'TEST-1', status: 'unknown', message: '' },
      { testCaseId: 'TEST-2', status: 'skipped', message: '' },
    ]);
    expect(resumed.map((result) => result.status)).toEqual(['unknown', 'pending']);
  });
});
