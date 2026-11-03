import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Vite bundles the worker locally; a failed PDF must not turn into an unread file upload.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfPageResult {
  pageNumber: number;
  dataUrl: string;
  text: string;
  width: number;
  height: number;
}

export interface PdfConversionResult {
  pages: PdfPageResult[];
  fullText: string;
  pageCount: number;
  /** Original page numbers without extractable text. They are left out of pages and fullText. */
  skippedPages: number[];
}

interface TextItemGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

function geometry(item: Record<string, unknown>): TextItemGeometry | undefined {
  const transform = item.transform;
  if (!Array.isArray(transform) || !Number.isFinite(transform[4]) || !Number.isFinite(transform[5])) return undefined;
  return {
    x: transform[4], y: transform[5],
    width: typeof item.width === 'number' ? item.width : 0,
    height: typeof item.height === 'number' ? Math.abs(item.height) : 10,
  };
}

/** Preserve PDF line boundaries instead of flattening every article into one line. */
export function extractTextItems(items: readonly unknown[]): string {
  let text = '';
  let previous: TextItemGeometry | undefined;
  for (const value of items) {
    if (!value || typeof value !== 'object' || !('str' in value) || typeof value.str !== 'string') continue;
    const item = value as Record<string, unknown>;
    const next = geometry(item);
    const content = value.str.replace(/\r\n?/g, '\n');
    if (content && text && !/\s$/.test(text) && !/^\s/.test(content)) {
      const lineChanged = previous && next && (
        Math.abs(next.y - previous.y) > Math.max(2, Math.min(previous.height, next.height) * 0.4)
        || next.x < previous.x - 2
      );
      if (lineChanged) text += '\n';
      else if (!previous || !next || next.x - (previous.x + previous.width) > Math.max(1, next.height * 0.12)) text += ' ';
    } else if (content && previous && next && !text.endsWith('\n')
      && Math.abs(next.y - previous.y) > Math.max(2, Math.min(previous.height, next.height) * 0.4)) {
      text = text.trimEnd() + '\n';
    }
    text += content;
    if (item.hasEOL === true && !text.endsWith('\n')) text += '\n';
    if (content.trim()) previous = next;
  }
  return text.trim();
}

/** Reject unreadable PDFs. Returns the page numbers without text so the caller can warn and drop them. */
export function validatePdfTextPages(
  pages: readonly Pick<PdfPageResult, 'pageNumber' | 'text'>[],
  pageCount: number
): number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pages.length !== pageCount
    || pages.some((page, index) => page.pageNumber !== index + 1)) {
    throw new Error('PDF의 전체 페이지를 읽지 못했습니다. 파일을 확인한 뒤 다시 선택해 주세요.');
  }
  const missing = pages.filter((page) => !page.text.trim()).map((page) => page.pageNumber);
  if (missing.length === pages.length) {
    throw new Error('텍스트를 추출한 페이지가 없습니다. 스캔 문서일 수 있습니다. OCR로 전체 문서를 텍스트로 변환한 뒤 ‘직접 텍스트/OCR 입력’에 붙여넣어 주세요. 이 PDF는 추가되지 않았습니다.');
  }
  return missing;
}

export function unsupportedPdfFiles(files: readonly Pick<File, 'name' | 'type'>[]): string[] {
  return files.filter((file) => file.type.startsWith('image/')
    || !(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))).map((file) => file.name);
}

/** Read and render every page. No implicit page cap or partial-success fallback is used. */
export async function renderPdfToPages(file: File, scale = 1.5): Promise<PdfConversionResult> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });

  try {
    const pdf = await loadingTask.promise;
    const extracted: { pageNumber: number; text: string }[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      try {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        extracted.push({ pageNumber, text: extractTextItems(textContent.items) });
      } catch {
        throw new Error(`${pageNumber}페이지의 텍스트를 읽지 못했습니다. OCR로 전체 문서를 변환한 뒤 텍스트 입력을 이용해 주세요.`);
      }
    }
    const skippedPages = validatePdfTextPages(extracted, pdf.numPages);

    const pages: PdfPageResult[] = [];
    for (const extractedPage of extracted.filter((page) => !skippedPages.includes(page.pageNumber))) {
      const pageNumber = extractedPage.pageNumber;
      const canvas = document.createElement('canvas');
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('캔버스를 만들 수 없습니다.');
        await page.render({ canvasContext: context, canvas: null, viewport, background: '#ffffff' }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        if (!dataUrl.startsWith('data:image/')) throw new Error('미리보기를 만들 수 없습니다.');
        pages.push({ ...extractedPage, dataUrl, width: viewport.width, height: viewport.height });
        page.cleanup();
      } catch {
        throw new Error(`${pageNumber}페이지의 미리보기를 만들지 못해 PDF를 추가하지 않았습니다. 파일을 다시 확인하거나 전체 원문을 텍스트로 입력해 주세요.`);
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
    return {
      pages,
      fullText: pages.map((page) => `[페이지 ${page.pageNumber}]\n${page.text}`).join('\n\n'),
      pageCount: pdf.numPages,
      skippedPages,
    };
  } finally {
    await loadingTask.destroy();
  }
}

export async function extractPdfText(file: File): Promise<string> {
  return (await renderPdfToPages(file, 1)).fullText;
}
