const defaultMaxBodyBytes = 256 * 1024;

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return;

  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    throw new Error('Alamat permintaan tidak valid.');
  }

  if (origin !== requestOrigin) throw new Error('Permintaan lintas situs ditolak.');
}

export async function readJsonBody<T>(request: Request, maxBytes = defaultMaxBodyBytes): Promise<T> {
  assertSameOrigin(request);
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error('Ukuran permintaan terlalu besar.');

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('Ukuran permintaan terlalu besar.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Format permintaan tidak valid.');
  }
}
