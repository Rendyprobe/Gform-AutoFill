export type RunStatus = 'pending' | 'sent' | 'failed' | 'unknown' | 'skipped';
export type RunResult = { testCaseId: string; status: RunStatus; message: string };

export function prepareResume(results: RunResult[]): RunResult[] {
  return results.map((result) => result.status === 'skipped'
    ? { ...result, status: 'pending', message: 'Menunggu giliran.' }
    : { ...result });
}
