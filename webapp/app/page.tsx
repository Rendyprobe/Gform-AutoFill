'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, CircleStop, Download,
  FileCheck2, FileSpreadsheet, LoaderCircle, Play, RotateCcw, ShieldCheck, Upload, XCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FormSchema } from '@/lib/google-forms';
import { downloadTemplate, parseWorkbook, type TestRow, type ValidationIssue } from '@/lib/workbook';

const steps = ['Pilih form', 'Isi Excel', 'Validasi', 'Jalankan'];
type RunStatus = 'pending' | 'sent' | 'failed' | 'unknown' | 'skipped';
type RunResult = { testCaseId: string; status: RunStatus; message: string };

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: object;
        annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
        execute: (input: unknown) => object | Promise<object>;
      }, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

function statusBadge(status: RunStatus) {
  const labels: Record<RunStatus, string> = { pending: 'Menunggu', sent: 'Terkirim', failed: 'Gagal', unknown: 'Periksa manual', skipped: 'Dilewati' };
  const classes: Record<RunStatus, string> = {
    pending: 'border-slate-200 bg-slate-50 text-slate-700', sent: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    failed: 'border-red-200 bg-red-50 text-red-800', unknown: 'border-amber-200 bg-amber-50 text-amber-900',
    skipped: 'border-slate-200 bg-slate-50 text-slate-500',
  };
  return <Badge variant="outline" className={classes[status]}>{labels[status]}</Badge>;
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [formUrl, setFormUrl] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<TestRow[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [delaySeconds, setDelaySeconds] = useState(3);
  const [results, setResults] = useState<RunResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stopRef = useRef(false);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'stage_google_form_url',
      title: 'Siapkan URL Google Form',
      description: 'Mengisi URL responder Google Form pada layar awal. Pengguna tetap harus menyatakan izin sebelum form dibaca.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL responder Google Form yang berakhiran /viewform.' } },
        required: ['url'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const url = typeof input === 'object' && input !== null && 'url' in input ? String((input as { url: unknown }).url).trim() : '';
        if (!url.startsWith('https://docs.google.com/forms/')) throw new Error('URL harus berasal dari https://docs.google.com/forms/.');
        setFormUrl(url); setStep(1); setSchema(null); setRows([]); setIssues([]); setResults([]); setError(''); setAgreed(false);
        return { status: 'staged', url, requiresPermissionConfirmation: true };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  async function inspectForm() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/forms/inspect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: formUrl }) });
      const data = await response.json() as { schema?: FormSchema; error?: string };
      if (!response.ok || !data.schema) throw new Error(data.error || 'Form tidak dapat dibaca.');
      setSchema(data.schema); setRows([]); setIssues([]); setFileName(''); setResults([]); setStep(2);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Form tidak dapat dibaca.'); }
    finally { setBusy(false); }
  }

  async function uploadWorkbook(file?: File) {
    if (!file || !schema) return;
    setBusy(true); setError('');
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Pilih file .xlsx yang dibuat oleh aplikasi ini.');
      if (file.size > 10 * 1024 * 1024) throw new Error('Ukuran file maksimal 10 MB.');
      const parsed = await parseWorkbook(file, schema);
      setFileName(file.name); setRows(parsed.rows); setIssues(parsed.issues); setResults([]); setStep(3);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Excel tidak dapat dibaca.'); }
    finally { setBusy(false); }
  }

  async function runJob() {
    if (!schema || issues.length || !rows.length) return;
    stopRef.current = false; setBusy(true); setError(''); setStep(4);
    const next: RunResult[] = rows.map((row) => ({ testCaseId: row.testCaseId, status: 'pending', message: 'Menunggu giliran.' }));
    setResults([...next]);
    for (let index = 0; index < rows.length; index += 1) {
      if (stopRef.current) {
        for (let skipped = index; skipped < next.length; skipped += 1) next[skipped] = { ...next[skipped], status: 'skipped', message: 'Job dihentikan pengguna.' };
        setResults([...next]); break;
      }
      try {
        const response = await fetch('/api/forms/submit-one', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ formUrl: schema.formUrl, schemaHash: schema.schemaHash, testCaseId: rows[index].testCaseId, answers: rows[index].answers }),
        });
        const data = await response.json() as { status?: RunStatus; message?: string; error?: string };
        const status: RunStatus = data.status || (response.ok ? 'unknown' : 'failed');
        next[index] = { testCaseId: rows[index].testCaseId, status, message: data.message || data.error || 'Tidak ada pesan hasil.' };
        setResults([...next]);
        if (status === 'unknown') {
          stopRef.current = true;
          for (let skipped = index + 1; skipped < next.length; skipped += 1) next[skipped] = { ...next[skipped], status: 'skipped', message: 'Dihentikan karena status respons sebelumnya tidak pasti.' };
          setResults([...next]); break;
        }
      } catch {
        next[index] = { testCaseId: rows[index].testCaseId, status: 'unknown', message: 'Koneksi terputus. Periksa form sebelum mencoba ulang.' };
        for (let skipped = index + 1; skipped < next.length; skipped += 1) next[skipped] = { ...next[skipped], status: 'skipped', message: 'Dihentikan untuk mencegah duplikasi.' };
        setResults([...next]); break;
      }
      if (index < rows.length - 1 && !stopRef.current) await new Promise((resolve) => window.setTimeout(resolve, Math.max(2, delaySeconds) * 1000));
    }
    setBusy(false);
  }

  function downloadReport() {
    const csv = ['Test Case ID,Status,Pesan', ...results.map((result) => [result.testCaseId, result.status, result.message].map((value) => `"${value.replaceAll('"', '""')}"`).join(','))].join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `laporan-gform-${Date.now()}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  function resetAll() {
    setStep(1); setSchema(null); setRows([]); setIssues([]); setResults([]); setFileName(''); setError('');
  }

  const completed = results.filter((result) => result.status !== 'pending').length;
  const progress = rows.length ? Math.round((completed / rows.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <button className="flex items-center gap-3 text-left" onClick={resetAll} aria-label="Mulai ulang">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><FileSpreadsheet className="size-5" /></span>
            <span><span className="block text-base font-bold tracking-tight">Gform-AutoFill</span><span className="block text-xs text-muted-foreground">Pengujian form berulang dari Excel</span></span>
          </button>
          <Badge variant="outline" className="hidden gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-800 sm:flex"><ShieldCheck className="size-3.5" /> Aplikasi berjalan lokal</Badge>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-8 lg:py-12">
        <aside className="rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-8 lg:h-fit">
          <p className="px-2 pb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Alur kerja</p>
          <ol className="grid grid-cols-4 gap-2 lg:grid-cols-1">
            {steps.map((label, index) => (
              <li key={label} className={`step-item ${step === index + 1 ? 'step-active' : ''} ${step > index + 1 ? 'step-done' : ''}`}>
                <span className="step-number">{step > index + 1 ? <CheckCircle2 className="size-4" /> : index + 1}</span>
                <span className="hidden text-sm font-medium lg:block">{label}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 hidden border-t border-border px-2 pt-5 text-xs leading-5 text-muted-foreground lg:block">Tidak mendukung form satu akun satu respons, login wajib, CAPTCHA, atau upload file.</div>
        </aside>

        <section className="min-w-0">
          {error && <Alert variant="destructive" className="mb-6 bg-red-50"><XCircle className="size-4" /><AlertTitle>Proses belum berhasil</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

          {step === 1 && <>
            <PageHeading eyebrow="Langkah 1 dari 4" title="Mulai dari Google Form yang ingin diuji" description="Masukkan tautan responder. Aplikasi akan membaca pertanyaan dan menyiapkan template Excel yang sesuai." />
            <Card className="app-card"><CardContent className="p-0">
              <SectionBar title="Form tujuan" />
              <div className="space-y-6 p-6 sm:p-8">
                <div className="space-y-2.5"><Label htmlFor="form-url">URL Google Form</Label><Input id="form-url" value={formUrl} onChange={(event) => setFormUrl(event.target.value)} placeholder="https://docs.google.com/forms/d/e/.../viewform" className="h-12 bg-background text-base" /><p className="text-sm text-muted-foreground">Gunakan URL yang dibuka oleh responden, bukan URL editor.</p></div>
                <CompatibilityNote />
                <div className="flex items-start gap-3 rounded-xl border border-border p-4"><Checkbox id="permission" checked={agreed} onCheckedChange={(value) => setAgreed(value === true)} /><Label htmlFor="permission" className="cursor-pointer text-sm font-normal leading-6">Saya pemilik form ini atau memiliki izin untuk menjalankan respons pengujian.</Label></div>
                <div className="flex justify-end"><Button size="lg" disabled={!agreed || !formUrl || busy} onClick={inspectForm} className="min-w-40 gap-2">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <>Baca form <ArrowRight className="size-4" /></>}</Button></div>
              </div>
            </CardContent></Card>
          </>}

          {step === 2 && schema && <>
            <PageHeading eyebrow="Langkah 2 dari 4" title="Template Excel siap dibuat" description="Periksa ringkasan form, unduh template, isi datanya, lalu unggah file yang sama." />
            <Card className="app-card"><CardContent className="p-0">
              <SectionBar title={schema.title} trailing={<Badge variant="secondary">{schema.questions.length} pertanyaan</Badge>} />
              <div className="space-y-6 p-6 sm:p-8">
                {!schema.supported && <Alert className="border-red-200 bg-red-50 text-red-950"><AlertTriangle className="size-4" /><AlertTitle>Form belum dapat dijalankan</AlertTitle><AlertDescription>Masih ada tipe pertanyaan yang belum didukung. Template dapat diperiksa, tetapi eksekusi dinonaktifkan.</AlertDescription></Alert>}
                {schema.warnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-semibold text-amber-950">Catatan kompatibilitas</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900/80">{schema.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
                <div className="grid gap-3 sm:grid-cols-3"><Metric label="Bagian" value={String(schema.pageCount)} /><Metric label="Wajib" value={String(schema.questions.filter((q) => q.required).length)} /><Metric label="Didukung" value={String(schema.questions.filter((q) => q.type !== 'unsupported').length)} /></div>
                <div className="max-h-60 overflow-auto rounded-xl border border-border"><Table><TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Pertanyaan</TableHead><TableHead>Tipe</TableHead></TableRow></TableHeader><TableBody>{schema.questions.map((question) => <TableRow key={question.columnKey}><TableCell className="font-mono text-xs">{question.columnKey}</TableCell><TableCell>{question.title}{question.required && <span className="ml-1 text-red-600">*</span>}</TableCell><TableCell><Badge variant="outline">{question.type}</Badge></TableCell></TableRow>)}</TableBody></Table></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Button variant="outline" size="lg" className="h-auto justify-start gap-3 p-4" onClick={() => downloadTemplate(schema)}><Download className="size-5 text-primary" /><span className="text-left"><span className="block font-semibold">Unduh template Excel</span><span className="block text-xs font-normal text-muted-foreground">Sudah berisi pilihan dan satu contoh</span></span></Button>
                  <Label className="flex h-auto cursor-pointer items-center justify-start gap-3 rounded-lg bg-primary p-4 text-primary-foreground hover:bg-primary/90"><Upload className="size-5" /><span><span className="block font-semibold">Unggah Excel yang sudah diisi</span><span className="block text-xs font-normal opacity-80">Maksimal 10 MB dan 25 baris</span></span><input className="sr-only" type="file" accept=".xlsx" onChange={(event) => uploadWorkbook(event.target.files?.[0])} /></Label>
                </div>
                <Button variant="ghost" onClick={() => setStep(1)} className="gap-2"><ArrowLeft className="size-4" /> Ganti form</Button>
              </div>
            </CardContent></Card>
          </>}

          {step === 3 && schema && <>
            <PageHeading eyebrow="Langkah 3 dari 4" title={issues.length ? 'Ada data yang perlu diperbaiki' : 'Data siap dijalankan'} description={`${fileName} • ${rows.length} baris respons ditemukan`} />
            <Card className="app-card"><CardContent className="p-0"><SectionBar title="Hasil validasi" trailing={issues.length ? <Badge variant="destructive">{issues.length} masalah</Badge> : <Badge className="bg-emerald-600">Semua valid</Badge>} />
              <div className="space-y-6 p-6 sm:p-8">
                {issues.length > 0 && <Alert className="border-amber-200 bg-amber-50 text-amber-950"><AlertTriangle className="size-4" /><AlertTitle>Perbaiki Excel lalu unggah ulang</AlertTitle><AlertDescription><ul className="mt-2 space-y-1">{issues.slice(0, 8).map((issue, index) => <li key={`${issue.row}-${issue.column}-${index}`}>{issue.row ? `Baris ${issue.row}, ` : ''}{issue.column}: {issue.message}</li>)}</ul>{issues.length > 8 && <p className="mt-2">...dan {issues.length - 8} masalah lainnya.</p>}</AlertDescription></Alert>}
                <div className="overflow-auto rounded-xl border border-border"><Table><TableHeader><TableRow><TableHead>Baris</TableHead><TableHead>Test Case ID</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{rows.slice(0, 12).map((row) => { const rowIssues = issues.filter((issue) => issue.row === row.rowNumber); return <TableRow key={`${row.rowNumber}-${row.testCaseId}`}><TableCell>{row.rowNumber}</TableCell><TableCell className="font-medium">{row.testCaseId || '—'}</TableCell><TableCell>{rowIssues.length ? <Badge variant="destructive">{rowIssues.length} error</Badge> : <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Valid</Badge>}</TableCell></TableRow>; })}</TableBody></Table></div>
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted"><Upload className="size-4" /> Unggah ulang<input className="sr-only" type="file" accept=".xlsx" onChange={(event) => uploadWorkbook(event.target.files?.[0])} /></Label><Button disabled={issues.length > 0 || !schema.supported} onClick={() => setStep(4)} className="gap-2">Lanjutkan <ArrowRight className="size-4" /></Button></div>
              </div>
            </CardContent></Card>
          </>}

          {step === 4 && schema && <>
            <PageHeading eyebrow="Langkah 4 dari 4" title={results.length ? 'Hasil eksekusi' : 'Jalankan respons uji'} description={`${schema.title} • ${rows.length} respons uji`} />
            <Card className="app-card"><CardContent className="p-0"><SectionBar title="Kontrol job" trailing={busy ? <Badge className="bg-violet-600">Sedang berjalan</Badge> : results.length ? <Badge variant="secondary">Selesai</Badge> : undefined} />
              <div className="space-y-6 p-6 sm:p-8">
                {!results.length && <><CompatibilityNote compact /><div className="grid gap-4 sm:grid-cols-3"><Metric label="Jumlah respons" value={String(rows.length)} /><div className="rounded-xl border border-border bg-muted/45 p-4"><Label htmlFor="delay" className="text-xs font-medium text-muted-foreground">Jeda antarrespons</Label><div className="mt-1 flex items-center gap-2"><Input id="delay" type="number" min={2} max={60} value={delaySeconds} onChange={(event) => setDelaySeconds(Math.min(60, Math.max(2, Number(event.target.value))))} className="h-9 w-20 bg-background" /><span className="text-sm">detik</span></div></div><Metric label="Estimasi" value={`${Math.max(0, (rows.length - 1) * delaySeconds)} detik`} /></div>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button variant="ghost" onClick={() => setStep(3)} className="gap-2"><ArrowLeft className="size-4" /> Kembali</Button><AlertDialog><AlertDialogTrigger render={<Button className="gap-2" />}><Play className="size-4" /> Tinjau dan jalankan</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Kirim {rows.length} respons uji?</AlertDialogTitle><AlertDialogDescription>Respons akan dikirim ke “{schema.title}” dengan jeda {delaySeconds} detik. Pastikan form memang menerima pengisian berulang dan kamu berwenang mengujinya.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={runJob}>Ya, jalankan</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></>}
                {results.length > 0 && <><div className="space-y-2"><div className="flex justify-between text-sm"><span>{completed} dari {rows.length} selesai</span><span className="font-semibold">{progress}%</span></div><Progress value={progress} /></div><div className="overflow-auto rounded-xl border border-border"><Table><TableHeader><TableRow><TableHead>Test Case ID</TableHead><TableHead>Status</TableHead><TableHead>Pesan</TableHead></TableRow></TableHeader><TableBody>{results.map((result) => <TableRow key={result.testCaseId}><TableCell className="font-medium">{result.testCaseId}</TableCell><TableCell>{statusBadge(result.status)}</TableCell><TableCell className="max-w-md text-sm text-muted-foreground">{result.message}</TableCell></TableRow>)}</TableBody></Table></div><div className="flex flex-wrap justify-between gap-3">{busy ? <Button variant="destructive" onClick={() => { stopRef.current = true; }} className="gap-2"><CircleStop className="size-4" /> Hentikan setelah respons ini</Button> : <Button variant="ghost" onClick={resetAll} className="gap-2"><RotateCcw className="size-4" /> Mulai job baru</Button>}<Button variant="outline" onClick={downloadReport} disabled={busy} className="gap-2"><FileCheck2 className="size-4" /> Unduh laporan CSV</Button></div></>}
              </div>
            </CardContent></Card>
          </>}
        </section>
      </div>
    </main>
  );
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="mb-8 max-w-3xl"><div className="mb-3 text-sm font-semibold text-primary">{eyebrow}</div><h1 className="text-balance text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p></div>;
}

function SectionBar({ title, trailing }: { title: string; trailing?: React.ReactNode }) {
  return <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-secondary/55 px-6 py-3"><p className="truncate text-sm font-semibold">{title}</p>{trailing}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-muted/45 p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight">{value}</p></div>;
}

function CompatibilityNote({ compact = false }: { compact?: boolean }) {
  return <div className="compatibility-note"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" /><div><p className="font-semibold text-amber-950">Hanya untuk form yang bisa diisi berulang</p>{!compact && <p className="mt-1 text-sm leading-6 text-amber-900/80">Form harus dapat dibuka tanpa login dan pengaturan “Batasi ke 1 respons” harus nonaktif. Login, CAPTCHA, percabangan kompleks, dan upload file tidak didukung.</p>}</div></div>;
}
