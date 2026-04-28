import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';

const pdfPath = pathToFileURL('C:/Users/יוחנן שבדרון/Downloads/dn/node_modules/pdfjs-dist/legacy/build/pdf.mjs').href;
const { getDocument, GlobalWorkerOptions } = await import(pdfPath);

const workerPath = pathToFileURL('C:/Users/יוחנן שבדרון/Downloads/dn/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs').href;
GlobalWorkerOptions.workerSrc = workerPath;

const filePath = 'C:/Users/יוחנן שבדרון/Downloads/dn/מצגת קורס AI.pdf';
const data = new Uint8Array(readFileSync(filePath));

const loadingTask = getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true, disableFontFace: true });
const pdf = await loadingTask.promise;

console.log('=== AI COURSE PDF ===');
console.log('Number of pages:', pdf.numPages);

const metadata = await pdf.getMetadata();
console.log('\n=== METADATA ===');
console.log(JSON.stringify(metadata.info, null, 2));

let allText = '';
// Extract all pages
for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  const page = await pdf.getPage(pageNum);
  const textContent = await page.getTextContent();
  const pageText = textContent.items.map(item => item.str).join(' ');
  if (pageText.trim()) {
    allText += `\n--- Page ${pageNum} ---\n${pageText}`;
  }
}

console.log('\n=== ALL TEXT ===');
console.log(allText);
