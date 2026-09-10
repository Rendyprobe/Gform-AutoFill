import type { RunStatus } from './run-results';

type SubmissionResult = { status: Extract<RunStatus, 'sent' | 'failed' | 'unknown'>; message: string };

export async function sendFormResponse(url: string, params: URLSearchParams): Promise<SubmissionResult> {
  // Never retry this POST: a lost response does not mean Google lost the answers.
  try {
    const response = await fetch(url, {
      method: 'POST', redirect: 'follow',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'accept-language': 'id,en;q=0.8' },
      body: params.toString(), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      return { status: 'failed', message: `Google mengembalikan HTTP ${response.status}. Pengiriman tidak diulang otomatis.` };
    }
    const html = await response.text();
    if (html.length <= 2 * 1024 * 1024 && /Jawaban Anda telah direkam|Respons Anda telah direkam|Your response has been recorded/i.test(html)) {
      return { status: 'sent', message: 'Respons uji berhasil dikirim.' };
    }
    return { status: 'unknown', message: 'Google merespons, tetapi penyimpanan jawaban belum terverifikasi. Otomatis lanjut tanpa mengirim ulang baris ini.' };
  } catch {
    return { status: 'unknown', message: 'Koneksi atau pembacaan konfirmasi terputus setelah pengiriman dimulai. Otomatis lanjut tanpa mengirim ulang baris ini.' };
  }
}
