import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/* ---------------------------------------------------------------------- */
/*  PDF text extraction                                                    */
/* ---------------------------------------------------------------------- */

// Reconstructs visual lines from a PDF's text items by clustering items
// that share roughly the same vertical position, then ordering left to right.
export async function extractPdfLines(arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const lines = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ x: it.transform[4], y: it.transform[5], str: it.str }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    let current = [];
    let currentY = null;
    const flush = () => {
      if (current.length) {
        current.sort((a, b) => a.x - b.x);
        const line = current.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
        if (line) lines.push(line);
      }
      current = [];
    };

    for (const it of items) {
      if (currentY === null || Math.abs(it.y - currentY) < 2.5) {
        current.push(it);
        currentY = currentY === null ? it.y : currentY;
      } else {
        flush();
        current.push(it);
        currentY = it.y;
      }
    }
    flush();
  }

  return lines;
}

/* ---------------------------------------------------------------------- */
/*  Transaction line parsing                                               */
/* ---------------------------------------------------------------------- */

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

const DATE_PATTERNS = [
  { re: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, build: (m) => `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}` },
  { re: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/, build: (m) => `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}` },
  { re: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})\b/, build: (m) => { const y = Number(m[3]) < 70 ? 2000 + Number(m[3]) : 1900 + Number(m[3]); return `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`; } },
  { re: /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i, build: (m) => `${m[3]}-${String(MONTHS[m[2].slice(0, 3).toLowerCase()] + 1).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}` },
];

// Amounts with two decimal places, optional thousands separators, optional
// leading minus / trailing Dr / parentheses to mark a debit.
const AMOUNT_RE = /\(?-?R?\s?\d{1,3}(?:[,\s]\d{3})*\.\d{2}\)?\s?(?:Dr|DR|Cr|CR)?/g;

function isNegativeAmount(token) {
  return /^-|^\(|\bDr\b|\bDR\b/.test(token.trim());
}

function findFirstDate(line) {
  let best = null;
  for (const pattern of DATE_PATTERNS) {
    const m = pattern.re.exec(line);
    if (m && (!best || m.index < best.index)) {
      best = { index: m.index, length: m[0].length, value: pattern.build(m) };
    }
  }
  return best;
}

// Parses raw extracted PDF lines into candidate transactions. A line is only
// treated as a transaction if it contains both a recognisable date and at
// least one currency-shaped amount — everything else (headers, footers,
// running summaries) is discarded. Every result is meant to be reviewed and
// corrected by the user before import, same as the CSV import path.
export function parseStatementLines(lines) {
  const results = [];

  for (const line of lines) {
    const date = findFirstDate(line);
    if (!date) continue;

    const rest = line.slice(date.index + date.length);
    const amountMatches = [...rest.matchAll(AMOUNT_RE)].map((m) => m[0].trim()).filter(Boolean);
    if (amountMatches.length === 0) continue;

    // Common layout is [...description, amount, balance]; when only one
    // number is present, treat it as the amount.
    const amountToken = amountMatches.length >= 2 ? amountMatches[amountMatches.length - 2] : amountMatches[0];
    const numeric = parseFloat(amountToken.replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(numeric) || numeric === 0) continue;

    let description = rest;
    for (const token of amountMatches) description = description.replace(token, " ");
    description = description.replace(/\s+/g, " ").replace(/^[\s\-–:.,]+|[\s\-–:.,]+$/g, "").trim();

    results.push({
      date: date.value,
      description: description || "(no description)",
      amount: Math.abs(numeric),
      negative: isNegativeAmount(amountToken),
    });
  }

  return results;
}
