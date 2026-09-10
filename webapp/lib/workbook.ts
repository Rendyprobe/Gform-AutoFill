import type ExcelJS from 'exceljs';
import type { FormQuestion, FormSchema } from './google-forms';

export type TestRow = { testCaseId: string; rowNumber: number; answers: Record<string, string | string[]> };
export type ValidationIssue = { row: number; column: string; message: string };

const schemaMarker = 'GFORM_AUTOFILL_SCHEMA_V1';
const legacySchemaMarker = 'GFORM_QA_SCHEMA_V1';

function filenameSafe(value: string) {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50).toLowerCase() || 'gform';
}

function defaultAnswer(question: FormQuestion) {
  if (question.options.length) return question.options[0];
  return question.required ? 'Contoh jawaban uji' : '';
}

export async function downloadTemplate(schema: FormSchema) {
  const ExcelJSRuntime = (await import('exceljs')).default;
  const workbook = new ExcelJSRuntime.Workbook();
  workbook.creator = 'Gform-AutoFill';
  const responseSheet = workbook.addWorksheet('Respons Uji', { views: [{ state: 'frozen', ySplit: 1 }] });
  responseSheet.properties.defaultRowHeight = 22;
  const headers = ['Test Case ID', ...schema.questions.map((question) => `${question.columnKey} — ${question.title}${question.required ? ' *' : ''}`)];
  responseSheet.addRow(headers);
  responseSheet.addRow(['TEST-001', ...schema.questions.map(defaultAnswer)]);

  const header = responseSheet.getRow(1);
  header.height = 42;
  header.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B43D6' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  responseSheet.getColumn(1).width = 18;
  responseSheet.getColumn(1).eachCell({ includeEmpty: true }, (cell, row) => {
    if (row > 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4C2' } };
  });

  const optionsSheet = workbook.addWorksheet('__Options');
  optionsSheet.state = 'veryHidden';
  schema.questions.forEach((question, index) => {
    question.options.forEach((option, optionIndex) => { optionsSheet.getCell(optionIndex + 1, index + 1).value = option; });
    const targetColumn = responseSheet.getColumn(index + 2);
    targetColumn.width = Math.min(48, Math.max(18, question.title.length * 0.72));
    if (question.options.length && question.type !== 'checkboxes') {
      const letter = optionsSheet.getColumn(index + 1).letter;
      for (let row = 2; row <= 26; row += 1) {
        responseSheet.getCell(row, index + 2).dataValidation = {
          type: 'list',
          allowBlank: !question.required,
          formulae: [`'__Options'!$${letter}$1:$${letter}$${question.options.length}`],
          showErrorMessage: true,
          errorTitle: 'Nilai tidak valid',
          error: 'Pilih salah satu nilai yang tersedia.',
        };
      }
    }
  });

  const schemaSheet = workbook.addWorksheet('_Form Schema');
  schemaSheet.state = 'veryHidden';
  const serialized = JSON.stringify(schema);
  schemaSheet.getCell('A1').value = schemaMarker;
  schemaSheet.getCell('A2').value = schema.schemaHash;
  schemaSheet.getCell('A3').value = schema.formUrl;
  for (let index = 0; index < serialized.length; index += 30000) schemaSheet.getCell(5 + index / 30000, 1).value = serialized.slice(index, index + 30000);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `template-${filenameSafe(schema.title)}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function cellText(cell: ExcelJS.Cell) {
  if (cell.value && typeof cell.value === 'object' && 'formula' in cell.value) throw new Error('Formula tidak diizinkan pada data respons.');
  return cell.text.trim();
}

export async function parseWorkbook(file: File, activeSchema: FormSchema) {
  const ExcelJSRuntime = (await import('exceljs')).default;
  const workbook = new ExcelJSRuntime.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const schemaSheet = workbook.getWorksheet('_Form Schema');
  const responseSheet = workbook.getWorksheet('Respons Uji');
  if (!schemaSheet || ![schemaMarker, legacySchemaMarker].includes(schemaSheet.getCell('A1').text)) throw new Error('File bukan template dari Gform-AutoFill.');
  if (schemaSheet.getCell('A2').text !== activeSchema.schemaHash) throw new Error('Template berasal dari versi form yang berbeda. Unduh template baru.');
  if (!responseSheet) throw new Error('Sheet “Respons Uji” tidak ditemukan.');

  const expectedHeaders = ['Test Case ID', ...activeSchema.questions.map((question) => `${question.columnKey} — ${question.title}${question.required ? ' *' : ''}`)];
  const actualHeaders = expectedHeaders.map((_, index) => responseSheet.getRow(1).getCell(index + 1).text.trim());
  if (JSON.stringify(expectedHeaders) !== JSON.stringify(actualHeaders)) throw new Error('Header template berubah. Kembalikan header asli atau unduh template baru.');

  const rows: TestRow[] = [];
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (let rowNumber = 2; rowNumber <= responseSheet.rowCount; rowNumber += 1) {
    const row = responseSheet.getRow(rowNumber);
    const testCaseId = cellText(row.getCell(1));
    const hasAnswers = activeSchema.questions.some((_, index) => cellText(row.getCell(index + 2)) !== '');
    if (!testCaseId && !hasAnswers) continue;
    if (!testCaseId) issues.push({ row: rowNumber, column: 'Test Case ID', message: 'Wajib diisi.' });
    if (seen.has(testCaseId)) issues.push({ row: rowNumber, column: 'Test Case ID', message: 'ID kasus harus unik.' });
    seen.add(testCaseId);
    const answers: Record<string, string | string[]> = {};
    activeSchema.questions.forEach((question, index) => {
      const raw = cellText(row.getCell(index + 2));
      const answer = question.type === 'checkboxes' ? raw.split('|').map((item) => item.trim()).filter(Boolean) : raw;
      answers[question.columnKey] = answer;
      const values = Array.isArray(answer) ? answer : [answer].filter(Boolean);
      if (question.required && values.length === 0) issues.push({ row: rowNumber, column: question.columnKey, message: 'Wajib diisi.' });
      if (question.options.length) {
        const invalid = values.find((value) => !question.options.includes(value));
        if (invalid) issues.push({ row: rowNumber, column: question.columnKey, message: `Pilihan tidak valid: ${invalid}` });
      }
    });
    rows.push({ testCaseId, rowNumber, answers });
  }
  if (!rows.length) throw new Error('Tidak ada baris respons yang diisi.');
  return { rows, issues };
}
