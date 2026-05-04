import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

export interface ExtractedDocument {
  text: string;
  metadata: {
    pageCount?: number;
    author?: string;
    title?: string;
    sheetNames?: string[];
    wordCount: number;
  };
}

export async function extractText(filePath: string, mimeType: string): Promise<ExtractedDocument> {
  const ext = path.extname(filePath).toLowerCase();

  logger.info(`Extracting text from ${ext} file`, { filePath, mimeType });

  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return extractPDF(filePath);
  } else if (ext === '.docx' || mimeType.includes('wordprocessingml')) {
    return extractDOCX(filePath);
  } else if (ext === '.xlsx' || ext === '.xls' || mimeType.includes('spreadsheetml')) {
    return extractXLSX(filePath);
  } else if (ext === '.csv' || mimeType === 'text/csv') {
    return extractCSV(filePath);
  } else if (ext === '.txt' || mimeType === 'text/plain') {
    return extractTXT(filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
}

async function extractPDF(filePath: string): Promise<ExtractedDocument> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number; info: { Author?: string; Title?: string } }>;
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  return {
    text: data.text.trim(),
    metadata: {
      pageCount: data.numpages,
      author: data.info?.Author,
      title: data.info?.Title,
      wordCount: countWords(data.text),
    },
  };
}

async function extractDOCX(filePath: string): Promise<ExtractedDocument> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mammoth = require('mammoth') as { extractRawText: (opts: { path: string }) => Promise<{ value: string }> };
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ path: filePath });

  return {
    text: result.value.trim(),
    metadata: {
      wordCount: countWords(result.value),
    },
  };
}

async function extractXLSX(filePath: string): Promise<ExtractedDocument> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require('xlsx') as {
    readFile: (path: string) => { SheetNames: string[]; Sheets: Record<string, unknown> };
    utils: { sheet_to_csv: (sheet: unknown) => string };
  };
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  const textParts: string[] = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    textParts.push(`=== Sheet: ${sheetName} ===\n${csv}`);
  }

  const text = textParts.join('\n\n');
  return {
    text: text.trim(),
    metadata: {
      sheetNames,
      wordCount: countWords(text),
    },
  };
}

async function extractCSV(filePath: string): Promise<ExtractedDocument> {
  const content = fs.readFileSync(filePath, 'utf-8');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Papa = require('papaparse') as {
    parse: (content: string, opts: { header: boolean; skipEmptyLines: boolean }) => {
      data: Record<string, unknown>[];
      meta: { fields?: string[] };
    };
  };

  const result = Papa.parse(content, { header: true, skipEmptyLines: true });
  const headers = result.meta.fields ?? [];

  // Convert to readable text
  const lines = [
    `Columns: ${headers.join(', ')}`,
    `Total rows: ${result.data.length}`,
    '',
    ...result.data.map((row) =>
      headers.map((h) => `${h}: ${String(row[h] ?? '')}`).join(' | ')
    ),
  ];

  const text = lines.join('\n');
  return {
    text,
    metadata: {
      wordCount: countWords(text),
    },
  };
}

async function extractTXT(filePath: string): Promise<ExtractedDocument> {
  const text = fs.readFileSync(filePath, 'utf-8');
  return {
    text: text.trim(),
    metadata: {
      wordCount: countWords(text),
    },
  };
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
