const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers.cjs');

function harness({ pages = 1, scannedPage, allScanned, brokenPage, brokenRender } = {}) {
  const calls = { extracted: [], rendered: [], destroyed: false };
  const pdf = { numPages: pages, getPage: async number => ({
    getTextContent: async () => {
      if (number === brokenPage) throw new Error('bad text');
      calls.extracted.push(number);
      return { items: allScanned || number === scannedPage ? [] : [{str:`제${number}조 계약`,hasEOL:true},{str:'월간 보고서를 제출한다.'}] };
    },
    getViewport: () => ({width:100,height:100}),
    render: () => ({ promise: number === brokenRender ? Promise.reject(new Error('bad rendering')) : Promise.resolve().then(() => calls.rendered.push(number)) }),
    cleanup() {},
  }) };
  const api = loadTs('src/utils/pdf.ts', {
    'pdfjs-dist': { GlobalWorkerOptions: {}, version:'test', getDocument: () => ({promise:Promise.resolve(pdf),destroy:async()=>{calls.destroyed=true;}}) },
    'pdfjs-dist/build/pdf.worker.min.mjs?url': {default:'/assets/test-worker.js'},
    globals: { document: {createElement:()=>({width:0,height:0,getContext:()=>({}),toDataURL:()=> 'data:image/jpeg;base64,dGVzdA=='})} },
  });
  return { api, calls, file: new File(['test'], 'test.pdf', {type:'application/pdf'}) };
}

test('PDF text extraction preserves explicit and geometric article boundaries', () => {
  const { api } = harness();
  const output = api.extractTextItems([{str:'제1조 기간',hasEOL:true},{str:'계약기간은 12개월이다.',transform:[1,0,0,10,0,100],width:100,height:10},{str:'제2조 업무',transform:[1,0,0,10,0,80],width:100,height:10}]);
  assert.equal(output, '제1조 기간\n계약기간은 12개월이다.\n제2조 업무');
});

test('every PDF page beyond the previous ten-page limit is extracted and rendered', async () => {
  const { api, calls, file } = harness({pages:12});
  const result = await api.renderPdfToPages(file);
  assert.equal(result.pages.length,12);
  assert.equal(result.pageCount,12);
  assert.ok(result.fullText.includes('제12조'));
  assert.equal(calls.extracted.length,12);
  assert.equal(calls.rendered.length,12);
  assert.equal(calls.destroyed,true);
});

test('a blank page is skipped with its number reported while other pages are kept', async () => {
  const { api, calls, file } = harness({pages:12,scannedPage:11});
  const result = await api.renderPdfToPages(file);
  assert.deepEqual([...result.skippedPages],[11]);
  assert.equal(result.pages.length,11);
  assert.ok(!result.pages.some(page=>page.pageNumber===11));
  assert.ok(!result.fullText.includes('제11조'));
  assert.equal(calls.rendered.length,11);
  assert.equal(calls.destroyed,true);
});

test('a PDF with no extractable text at all is rejected and requests OCR', async () => {
  const { api, calls, file } = harness({pages:3,allScanned:true});
  await assert.rejects(api.renderPdfToPages(file), /OCR/);
  assert.equal(calls.rendered.length,0);
  assert.equal(calls.destroyed,true);
});

test('extraction and rendering errors are propagated without unread-file fallbacks', async () => {
  for (const options of [{brokenPage:2},{brokenRender:2}]) {
    const {api,calls,file}=harness({pages:3,...options});
    await assert.rejects(api.renderPdfToPages(file), /2페이지/);
    assert.equal(calls.destroyed,true);
  }
});

test('image files including disguised PDFs are rejected while text PDFs are accepted', () => {
  const {api}=harness();
  const unsupported=api.unsupportedPdfFiles([{name:'photo.png',type:'image/png'},{name:'pretend.pdf',type:'image/jpeg'},{name:'real.pdf',type:'application/pdf'}]);
  assert.equal([...unsupported].join(','),'photo.png,pretend.pdf');
});
