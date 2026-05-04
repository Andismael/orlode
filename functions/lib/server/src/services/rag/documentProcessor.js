"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractText = extractText;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../../utils/logger");
async function extractText(filePath, mimeType) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    logger_1.logger.info(`Extracting text from ${ext} file`, { filePath, mimeType });
    if (ext === '.pdf' || mimeType === 'application/pdf') {
        return extractPDF(filePath);
    }
    else if (ext === '.docx' || mimeType.includes('wordprocessingml')) {
        return extractDOCX(filePath);
    }
    else if (ext === '.xlsx' || ext === '.xls' || mimeType.includes('spreadsheetml')) {
        return extractXLSX(filePath);
    }
    else if (ext === '.csv' || mimeType === 'text/csv') {
        return extractCSV(filePath);
    }
    else if (ext === '.txt' || mimeType === 'text/plain') {
        return extractTXT(filePath);
    }
    else {
        throw new Error(`Unsupported file type: ${ext}`);
    }
}
async function extractPDF(filePath) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse');
    const buffer = fs_1.default.readFileSync(filePath);
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
async function extractDOCX(filePath) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth');
    const buffer = fs_1.default.readFileSync(filePath);
    const result = await mammoth.extractRawText({ path: filePath });
    return {
        text: result.value.trim(),
        metadata: {
            wordCount: countWords(result.value),
        },
    };
}
async function extractXLSX(filePath) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    const textParts = [];
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
async function extractCSV(filePath) {
    const content = fs_1.default.readFileSync(filePath, 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Papa = require('papaparse');
    const result = Papa.parse(content, { header: true, skipEmptyLines: true });
    const headers = result.meta.fields ?? [];
    // Convert to readable text
    const lines = [
        `Columns: ${headers.join(', ')}`,
        `Total rows: ${result.data.length}`,
        '',
        ...result.data.map((row) => headers.map((h) => `${h}: ${String(row[h] ?? '')}`).join(' | ')),
    ];
    const text = lines.join('\n');
    return {
        text,
        metadata: {
            wordCount: countWords(text),
        },
    };
}
async function extractTXT(filePath) {
    const text = fs_1.default.readFileSync(filePath, 'utf-8');
    return {
        text: text.trim(),
        metadata: {
            wordCount: countWords(text),
        },
    };
}
function countWords(text) {
    return text.split(/\s+/).filter(Boolean).length;
}
//# sourceMappingURL=documentProcessor.js.map