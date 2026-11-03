import type { HighlightType } from '../types';

export type ExportFormat = 'pdf' | 'hwpx' | 'docx';

/** One run of the original text; `type` is set where the result view underlines it. */
export interface ExportSegment { text: string; type?: HighlightType; count?: number }
export interface ExportInput { title: string; segments: ExportSegment[] }

const LABEL: Record<HighlightType, string> = { DANGER: '위험', IMPORTANT: '조건', ACTION: '행동' };
// Same colours as the underlines in the result view.
const TEXT_COLOR: Record<HighlightType, string> = { DANGER: '991b1b', IMPORTANT: '92400e', ACTION: '1e40af' };
const LINE_COLOR: Record<HighlightType, string> = { DANGER: 'ef4444', IMPORTANT: 'f59e0b', ACTION: '3b82f6' };
const TAG = (segment: ExportSegment) => segment.type ? `[${LABEL[segment.type]}${segment.count && segment.count > 1 ? ` ${segment.count}` : ''}]` : '';

const safeName = (title: string) => (title || '문서').replace(/[\\/:*?"<>|]+/g, '_');
const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Splits runs at line breaks so each output line becomes its own paragraph.
function toLines(segments: ExportSegment[]): ExportSegment[][] {
  const lines: ExportSegment[][] = [[]];
  for (const segment of segments) {
    segment.text.replace(/\r\n?/g, '\n').split('\n').forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ ...segment, text: part });
    });
  }
  return lines;
}

export function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportDocx({ title, segments }: ExportInput): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, UnderlineType } = await import('docx');
  const runsOf = (line: ExportSegment[]) => line.flatMap((segment) => segment.type
    ? [new TextRun({ text: segment.text, color: TEXT_COLOR[segment.type], underline: { type: UnderlineType.SINGLE, color: LINE_COLOR[segment.type] } }),
      new TextRun({ text: TAG(segment), bold: true, size: 16, color: TEXT_COLOR[segment.type] })]
    : [new TextRun({ text: segment.text })]);
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Malgun Gothic', size: 22 } } } },
    sections: [{ children: [
      new Paragraph({ children: [new TextRun({ text: title || '문서', bold: true, size: 32 })], spacing: { after: 240 } }),
      ...toLines(segments).map((line) => new Paragraph({ children: runsOf(line), spacing: { after: 80 } })),
    ] }],
  });
  return Packer.toBlob(doc);
}

async function exportHwpx({ title, segments }: ExportInput): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const NS = 'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/"';
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
  // charPr 0 = body, 1 = title, 2..4 = danger / important / action (coloured and underlined)
  const charPr = (id: number, color: string, height: number, bold: boolean, underline?: string) => `<hh:charPr id="${id}" height="${height}" textColor="#${color}" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1"><hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>${bold ? '<hh:bold/>' : ''}<hh:underline type="${underline ? 'BOTTOM' : 'NONE'}" shape="SOLID" color="#${underline || '000000'}"/><hh:strikeout shape="NONE" color="#000000"/><hh:outline type="NONE"/><hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/></hh:charPr>`;
  const types: HighlightType[] = ['DANGER', 'IMPORTANT', 'ACTION'];
  const header = `${XML}<hh:head ${NS} version="1.4" secCnt="1"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList>`
    + '<hh:fontfaces itemCnt="7">' + ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'].map((lang) => `<hh:fontface lang="${lang}" fontCnt="1"><hh:font id="0" face="맑은 고딕" type="TTF" isEmbedded="0"/></hh:fontface>`).join('') + '</hh:fontfaces>'
    + '<hh:borderFills itemCnt="1"><hh:borderFill id="1" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/><hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/><hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/><hh:topBorder type="NONE" width="0.1 mm" color="#000000"/><hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/><hh:diagonal type="NONE" width="0.1 mm" color="#000000"/></hh:borderFill></hh:borderFills>'
    + `<hh:charProperties itemCnt="5">${charPr(0, '000000', 1100, false)}${charPr(1, '000000', 1600, true)}${types.map((type, index) => charPr(index + 2, TEXT_COLOR[type], 1100, false, LINE_COLOR[type])).join('')}</hh:charProperties>`
    + '<hh:paraProperties itemCnt="1"><hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0"><hh:align horizontal="JUSTIFY" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/><hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/><hh:autoSpacing eAsianEng="0" eAsianNum="0"/><hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="0" unit="HWPUNIT"/><hc:next value="400" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/><hh:border borderFillIDRef="1" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr></hh:paraProperties>'
    + '<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>'
    + '</hh:refList><hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument></hh:head>';
  const run = (charId: number, text: string) => `<hp:run charPrIDRef="${charId}"><hp:t>${escapeXml(text)}</hp:t></hp:run>`;
  const secPr = '<hp:run charPrIDRef="0"><hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="0" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="59528" height="84186" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/></hp:pagePr></hp:secPr></hp:run>';
  const paragraph = (runs: string, first = false) => `<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${first ? secPr : ''}${runs}</hp:p>`;
  const body = [
    paragraph(run(1, title || '문서'), true),
    ...toLines(segments).map((line) => paragraph(line.length ? line.map((segment) => segment.type
      ? run(2 + types.indexOf(segment.type), segment.text) + run(0, TAG(segment))
      : run(0, segment.text)).join('') : run(0, ''))),
  ].join('');
  const section = `${XML}<hs:sec ${NS}>${body}</hs:sec>`;

  const zip = new JSZip();
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
  zip.file('version.xml', `${XML}<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="0" micro="5" buildNumber="0" os="1" xmlVersion="1.4" application="Hancom Office Hangul" appVersion="9, 1, 1, 5656 WIN32LEWindows_Unknown_Version"/>`);
  zip.file('META-INF/container.xml', `${XML}<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>`);
  zip.file('META-INF/manifest.xml', `${XML}<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`);
  zip.file('Contents/content.hpf', `${XML}<opf:package ${NS} version="" unique-identifier="" id=""><opf:metadata><opf:title>${escapeXml(title || '문서')}</opf:title><opf:language>ko</opf:language></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>`);
  zip.file('Contents/header.xml', header);
  zip.file('Contents/section0.xml', section);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
}

async function exportPdf({ title, segments }: ExportInput): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  // Rendered off-screen so the PDF looks the same whatever the viewer's zoom, pan or view mode is.
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;left:-10000px;top:0;width:680px;padding:48px 52px;box-sizing:border-box;background:#fff;color:#1e293b;font:15px/1.9 "Pretendard","Malgun Gothic",sans-serif;white-space:pre-wrap;word-break:break-word';
  const heading = document.createElement('h2');
  heading.textContent = title || '문서';
  heading.style.cssText = 'margin:0 0 24px;font-size:22px;color:#0f172a';
  sheet.append(heading);
  for (const segment of segments) {
    const node = document.createElement(segment.type ? 'u' : 'span');
    node.textContent = segment.text;
    if (segment.type) {
      node.style.cssText = `text-decoration:underline 3px solid #${LINE_COLOR[segment.type]};text-underline-offset:5px;color:#${TEXT_COLOR[segment.type]}`;
      const tag = document.createElement('b');
      tag.textContent = TAG(segment);
      tag.style.cssText = `font-size:11px;margin:0 3px;color:#${TEXT_COLOR[segment.type]}`;
      sheet.append(node, tag);
    } else sheet.append(node);
  }
  document.body.append(sheet);
  try {
    const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const sliceHeight = Math.floor(canvas.width * pageHeight / pageWidth);
    for (let y = 0, page = 0; y < canvas.height; y += sliceHeight, page++) {
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.min(sliceHeight, canvas.height - y);
      slice.getContext('2d')?.drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageWidth, slice.height * pageWidth / canvas.width);
    }
    return pdf.output('blob');
  } finally {
    sheet.remove();
  }
}

export async function exportDocument(format: ExportFormat, input: ExportInput): Promise<void> {
  const blob = format === 'docx' ? await exportDocx(input) : format === 'hwpx' ? await exportHwpx(input) : await exportPdf(input);
  download(blob, `${safeName(input.title)}.${format}`);
}
