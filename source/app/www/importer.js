/* Import inputs from a file (PDF, Excel/CSV, Word). An addition to manual entry: it reads label/value
   pairs from the file, matches them to the number boxes on this page, shows them for review, and changes
   nothing until Submit. Runs offline; the readers in lib/ load only when a file is chosen. */
(function () {
  'use strict';
  const LIB = 'lib/';
  const ACCEPT = '.pdf,.xlsx,.xls,.xlsm,.csv,.ods,.docx,.doc,.txt,application/pdf,application/vnd.ms-excel,' +
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/msword,' +
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

  /* ---------- Text normalising and matching ---------- */
  // Phrases first (longest wins by order), then single words. Everything maps to the words used on the page.
  const PHRASES = [
    [/\bangle of repose\b/g, ' repose '], [/\bmean particle size\b|\bmean size\b|\bparticle size\b|\baverage size\b|\bm\.?p\.?s\b/g, ' mps '],
    [/\bbulk density\b|\bb\.?d\b/g, ' density '], [/\bfriction coeff\w*\b|\bcoeff\w* of friction\b/g, ' friction '],
    [/\bcold blast\b|\bblast flow\b|\bwind volume\b|\bb\.?v\b/g, ' blast volume '], [/\boxygen enrichment\b|\bo2 enrichment\b|\bo2\b|\boxygen\b/g, ' oxygen '],
    [/\bt\.?p\b/g, ' top pressure '], [/\bb\.?p\b/g, ' blast pressure '], [/\btop gas temp\w*\b|\btop temp\w*\b/g, ' top temperature '],
    [/\bo\s*\/\s*c\b|\bore\s*\/\s*coke\b|\bore to coke\b|\bore coke ratio\b/g, ' orecoke '],
    [/\br\s*\/\s*min\b|\brpm\b|\brotation speed\b/g, ' speed '], [/\bstock\s*line\b|\bstock level\b/g, ' stockline '],
    [/\bpivot height\b|\bchute pivot height\b|\bheight of pivot\b/g, ' pivot above zero stockline '],
    [/\bzero stockline\b|\bstockline zero\b|\bdatum\b/g, ' datum '],
    [/\blump clo\b|\bcalibrated lump ore\b|\bc\.?l\.?o\b/g, ' clo '], [/\biron ore\b/g, ' lump ore '], [/\bmanganese ore\b|\bmn\.? ore\b/g, ' mn ore '],
    [/\bnut\s*coke\b/g, ' nutcoke '], [/\byard\s*\/\s*second\b/g, ' yard '], [/\bore side\b|\bmetallics?\b/g, ' ore '],
    [/\bno\.? of tuyeres\b|\bnumber of tuyeres\b|\btuyere count\b/g, ' tuyeres number ']
  ];
  const WORDS = {
    dia: 'diameter', diam: 'diameter', 'ø': 'diameter', '⌀': 'diameter', d: 'mps', size: 'mps', rho: 'density', mu: 'friction', 'μ': 'friction',
    rep: 'repose', moist: 'moisture', 'h2o': 'moisture', ht: 'height', len: 'length', 'α': 'angle', alpha: 'angle', tilt: 'angle',
    rev: 'rev', revs: 'rev', revolution: 'rev', revolutions: 'rev', rotations: 'rev', turns: 'rev', temp: 'temperature', temperatures: 'temperature',
    lime: 'limestone', dolo: 'dolomite', pyrox: 'paraxonite', pyroxenite: 'paraxonite', quartzite: 'quartz', mn: 'mn', o2: 'oxygen', pct: '', percent: '',
    tuyere: 'tuyeres', depth: 'height'
  };
  const DROP = new Set(('a an the of to from at in on for and or per with by is are be value values input inputs parameter parameters param actual current ' +
    'data unit units uom flow rate remarks remark qty quantity furnace running operating operation typical average avg approx dry wet total optional ' +
    'm mm cm kg t ton tons tonne nm nm3 nm³ m3 m³ min h hr hrs s sec deg c °c ° % kgf cm2 cm² g bar kpa mpa mt ± x').split(' '));

  const PRETTY = { moist: 'moisture (%)', mps: 'MPS (mm)', d: 'MPS (mm)', rho: 'bulk density (t/m³)', mu: 'friction', rep: 'repose (°)' };
  function ringOf(s) { const m = /\b(?:ring|notch|position|pos|station)\s*(?:no\.?|#)?\s*(\d{1,2})\b/i.exec(s); return m ? +m[1] : null; }
  function tokens(s) {
    let t = ' ' + String(s).toLowerCase().replace(/\b(?:ring|notch|position|pos|station)\s*(?:no\.?|#)?\s*\d{1,2}\b/g, ' ') + ' ';
    t = t.replace(/[_]/g, ' ');
    for (const [re, rep] of PHRASES) t = t.replace(re, rep).replace(/\s+/g, ' ');
    const out = new Set();
    for (let w of t.split(/[^a-z0-9ø⌀αμ²³°%±]+/)) {
      if (!w || /^\d+(\.\d+)?$/.test(w)) continue;
      if (w in WORDS) w = WORDS[w];
      if (w && !DROP.has(w)) out.add(w);
    }
    return out;
  }
  function score(a, b) { let n = 0; a.forEach(w => { if (b.has(w)) n++; }); return n / (a.size + b.size - n || 1); }

  function num(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let s = String(v == null ? '' : v).trim().replace(/−/g, '-').replace(/\s*%$/, '');
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    return /^-?\d*\.?\d+$/.test(s) ? Number(s) : null;
  }

  /* ---------- The page's number boxes ---------- */
  function fields(card) {
    return Array.from(document.querySelectorAll('input[type=number]')).filter(el => el.id && !card.contains(el)).map(el => {
      let lab = el.getAttribute('aria-label');
      if (!lab) { const l = el.closest('label'); if (l) lab = Array.from(l.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join(' '); }
      lab = (lab || el.id).replace(/\s+/g, ' ').trim().replace(/ (moist|mps|d|rho|mu|rep)$/, (_, c) => ' ' + PRETTY[c]);
      const sec = el.closest('.card') && el.closest('.card').querySelector('h2');
      return { id: el.id, label: lab, section: sec ? sec.textContent.trim().replace(/^\d+\s*/, '') : '', ring: ringOf(lab), tok: tokens(lab), el };
    }).filter(f => f.tok.size);
  }

  /* ---------- File readers: everything becomes rows of cells {t, x} ---------- */
  const loaded = {};
  function load(src) {
    return loaded[src] || (loaded[src] = new Promise((ok, bad) => {
      const s = document.createElement('script'); s.src = LIB + src; s.onload = ok; s.onerror = () => bad(new Error('could not load ' + src)); document.head.appendChild(s);
    }));
  }
  function kind(name, b) {
    const ext = (/\.([a-z0-9]+)$/i.exec(name) || [, ''])[1].toLowerCase();
    const sig = Array.from(b.slice(0, 8)).map(x => x.toString(16).padStart(2, '0')).join('');
    if (sig.startsWith('25504446')) return 'pdf';
    if (sig.startsWith('504b0304')) { const head = new TextDecoder('latin1').decode(b.slice(0, Math.min(b.length, 200000)));
      return /word\//.test(head) ? 'docx' : 'sheet'; }
    if (sig.startsWith('d0cf11e0')) return ext === 'doc' ? 'doc' : 'sheet';
    if (ext === 'pdf') return 'pdf'; if (ext === 'docx') return 'docx'; if (ext === 'doc') return 'doc';
    if (ext === 'txt') return 'text';
    if (ext === 'csv') return 'csv';
    return 'sheet';
  }
  function decodeText(b) { try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return new TextDecoder('windows-1252').decode(b); } }
  async function sheetRows(b, csv) {
    await load('xlsx.full.min.js');
    const wb = csv ? XLSX.read(decodeText(b), { type: 'string', raw: true }) : XLSX.read(b, { type: 'array', cellDates: false });
    const rows = [];
    wb.SheetNames.forEach(n => {
      const a = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '', blankrows: true });
      a.forEach((r, i) => rows.push({ cells: r.map((t, x) => ({ t, x })), exact: true, src: n + ' row ' + (i + 1) }));
      rows.push({ cells: [], exact: true });
    });
    return rows;
  }
  async function pdfRows(b) {
    await load('pdf.worker.min.js'); await load('pdf.min.js');   // the worker script runs in-page (no web worker needed offline)
    const doc = await pdfjsLib.getDocument({ data: b, isEvalSupported: false, useSystemFonts: true }).promise;
    const rows = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const items = (await (await doc.getPage(p)).getTextContent()).items.filter(it => it.str && it.str.trim());
      const lines = [];
      items.forEach(it => {
        const y = it.transform[5], x = it.transform[4], h = Math.abs(it.transform[3]) || 10;
        let ln = lines.find(l => Math.abs(l.y - y) < h * 0.5);
        if (!ln) lines.push(ln = { y, h, items: [] });
        ln.items.push({ x, w: it.width || it.str.length * h * 0.5, s: it.str, h });
      });
      lines.sort((a, b) => b.y - a.y);
      lines.forEach((ln, i) => {
        ln.items.sort((a, b) => a.x - b.x);
        const cells = [];
        ln.items.forEach(it => {
          const last = cells[cells.length - 1];
          if (last && it.x - last.end < it.h * 1.2) { last.t += (it.x - last.end > it.h * 0.15 ? ' ' : '') + it.s; last.end = it.x + it.w; }
          else cells.push({ t: it.s, x: it.x, end: it.x + it.w });
        });
        cells.forEach(c => { c.x = (c.x + c.end) / 2; c.t = c.t.trim(); });
        rows.push({ cells, exact: false, src: 'page ' + p + ' line ' + (i + 1) });
      });
      rows.push({ cells: [], exact: false });
    }
    return rows;
  }
  async function docxRows(b) {
    await load('mammoth.browser.min.js');
    const html = (await mammoth.convertToHtml({ arrayBuffer: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) })).value;
    const dom = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
    const rows = []; let t = 0, para = 0;
    Array.from(dom.body.children).forEach(node => {
      if (node.tagName === 'TABLE') {
        t++;
        node.querySelectorAll('tr').forEach((tr, i) => rows.push({ cells: Array.from(tr.children).map((td, x) => ({ t: td.textContent.trim(), x })), exact: true, src: 'table ' + t + ' row ' + (i + 1) }));
        rows.push({ cells: [], exact: true });
      } else {
        (node.tagName === 'UL' || node.tagName === 'OL' ? Array.from(node.children) : [node]).forEach(n => {
          para++; textLine(n.textContent).forEach(r => rows.push({ ...r, src: 'paragraph ' + para }));
        });
      }
    });
    return rows;
  }
  // Old binary .doc: no reader exists for it in the browser, so pull the readable text out of the file (best effort).
  const STYLE = /^(heading|body text|list|listlabel|toc|index|caption|footnote|endnote|header|footer|normal|title|subtitle|quote|table|ww8num|outline|default|annotation|balloon|comment|hyperlink|page number|line number|signature|salutation|closing)\b/i;
  function docRows(b) {
    const take = s => s.replace(/\x07\x07/g, '\n').replace(/\x07/g, '\t').replace(/[^\t\r\n\x20-\x7e -ɏͰ-Ͽ‐-−°²³]+/g, '\n');
    const u16 = take(new TextDecoder('utf-16le').decode(b.slice(0, b.length - (b.length % 2))));
    const l1 = take(new TextDecoder('windows-1252').decode(b));
    const rows = [];
    [u16, l1].forEach(txt => txt.split(/[\r\n]+/).forEach((line, i) => {
      if (!(/[a-z]{2}/i.test(line) || /^[\d.,\t -]+$/.test(line) && /\d\t+\d/.test(line)) || line.length > 400 || STYLE.test(line.trim())) return;
      textLine(line).forEach(r => rows.push({ ...r, src: 'text line ' + (i + 1) }));
    }));
    return rows;
  }
  function textRows(b) {
    const s = decodeText(b);
    return s.split(/\r?\n/).flatMap((line, i) => textLine(line).map(r => ({ ...r, src: 'line ' + (i + 1) })));
  }
  // One line of text: cells split on tab, ':', '=', '|', ';' or two spaces.
  function textLine(s) {
    s = String(s || '').replace(/ /g, ' ').trim();
    if (!s) return [{ cells: [], exact: true }];
    const parts = s.split(/\t|\s*[|;=]\s*|:\s+|:(?=\s*-?\d)|\s{2,}/).map(t => t.trim()).filter(Boolean);
    return [{ cells: parts.map((t, x) => ({ t, x })), exact: true }];
  }

  /* ---------- Rows of cells -> label/value pairs ---------- */
  // A cell holding "Label 12.5 unit" (no separator) is split here; numbers right after Ring/Notch stay in the label.
  function splitFree(text) {
    const w = String(text).split(/\s+/), out = []; let lab = [];
    for (let i = 0; i < w.length; i++) {
      const v = num(w[i]);
      if (v !== null && !(lab.length && /^(ring|notch|position|pos|station|no\.?|#)$/i.test(lab[lab.length - 1]))) {
        if (lab.length && /[a-z]/i.test(lab.join(' '))) out.push({ label: lab.join(' '), value: v });
        lab = [];
      } else lab.push(w[i]);
    }
    return out;
  }
  function pairs(rows) {
    const out = []; let head = null;
    const headAt = (row, c) => {
      if (!head) return '';
      if (row.exact) { const h = head.find(hc => hc.x === c.x); return h ? String(h.t) : ''; }
      let best = null; head.forEach(hc => { const d = Math.abs(hc.x - c.x); if (d < 60 && (!best || d < best.d)) best = { d, t: hc.t }; });
      return best ? String(best.t) : '';
    };
    rows.forEach(row => {
      const cells = row.cells.filter(c => String(c.t).trim() !== '');
      if (!cells.length) { head = null; return; }
      const isNum = cells.map(c => num(c.t) !== null);
      if (!isNum.some(Boolean)) {
        const free = cells.flatMap(c => splitFree(c.t));
        if (free.length) { free.forEach(p => out.push({ ...p, src: row.src })); return; }
        head = cells.length >= 2 ? cells : null;
        return;
      }
      // a leading ring number under a "Ring" style header joins the row label
      let lab = [], start = 0;
      if (isNum[0] && head && /^(ring|notch|position|pos|station|no\.?|#|sl\.?\s*no\.?|s\.?\s*no\.?)$/i.test(headAt(row, cells[0]).trim())) {
        lab.push('ring ' + num(cells[0].t)); start = 1;
      }
      for (let i = start; i < cells.length && !isNum[i]; i++) { lab.push(String(cells[i].t)); start = i + 1; }
      const rowLab = lab.join(' ').trim();
      let first = true;
      for (let i = start; i < cells.length; i++) {
        if (!isNum[i]) {   // text after the numbers: maybe another "label value" pair in the same row
          splitFree(cells[i].t).forEach(p => out.push({ ...p, src: row.src }));
          continue;
        }
        const h = headAt(row, cells[i]);
        const label = (h && num(h) === null && tokens(h).size ? rowLab + ' ' + h : first || h ? rowLab : '').trim();
        if (label && /[a-z]/i.test(label)) out.push({ label, value: num(cells[i].t), src: row.src });
        first = false;
      }
    });
    return out;
  }

  function match(found, flds) {
    const cand = [];
    found.forEach((p, pi) => {
      const pr = ringOf(p.label), pt = tokens(p.label);
      if (!pt.size) return;
      flds.forEach((f, fi) => {
        if (pr !== f.ring) return;
        const s = score(pt, f.tok);
        if (s >= 0.5) cand.push({ pi, fi, s });
      });
    });
    cand.sort((a, b) => b.s - a.s || a.pi - b.pi);
    const usedP = new Set(), usedF = new Set(), res = [];
    cand.forEach(c => {
      if (usedP.has(c.pi) || usedF.has(c.fi)) return;
      usedP.add(c.pi); usedF.add(c.fi);
      const rival = cand.some(o => o !== c && o.s >= c.s - 0.05 && ((o.pi === c.pi && !usedF.has(o.fi)) || (o.fi === c.fi && o.pi !== c.pi && found[o.pi].value !== found[c.pi].value)));
      res.push({ p: found[c.pi], f: flds[c.fi], s: c.s, sure: c.s >= 0.66 && !rival });
    });
    return { res, unmatched: found.filter((_, i) => !usedP.has(i)) };
  }

  /* ---------- Card ---------- */
  const CSS = `
.imp > *, .imp .impreview > * { min-width: 0 }
.imp .impreview { display: grid; gap: 8px }
.imp .impbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center }
.imp .impbar input[type=file] { position: absolute; width: 1px; height: 1px; opacity: 0 }
.imp .impname { font-size: 12.5px; color: var(--ink-2, #47525f); overflow-wrap: anywhere }
.imp .imptable { overflow-x: auto; max-height: 60vh; overflow-y: auto; border: 1px solid var(--line, #d3d9e0); border-radius: 6px }
.imp table { width: 100%; border-collapse: collapse; font-size: 12.5px }
.imp th, .imp td { font-family: var(--f-body, inherit); padding: 5px 7px; border-bottom: 1px solid var(--line, #d3d9e0); text-align: left; vertical-align: middle }
.imp th { position: sticky; top: 0; background: var(--surface-2, #f4f6f8); font-weight: 600; color: var(--ink-2, #47525f) }
.imp td.n { font-family: var(--f-mono, monospace); text-align: right; white-space: nowrap }
.imp td input[type=number] { width: 68px; font: inherit; font-family: var(--f-mono, monospace); padding: 4px 6px }
.imp td .src, .imp td .sec { color: var(--muted, #6f7a87); font-size: 11.5px; font-weight: 400; overflow-wrap: anywhere }
.imp td .warn { color: #8a5a00; font-size: 11.5px; font-weight: 600 }
.imp td:nth-child(2), .imp th:nth-child(2) { min-width: 120px; white-space: normal }
.imp td input[type=checkbox], .imp th input[type=checkbox] { width: auto }
.imp td:first-child, .imp th:first-child { padding-right: 0 }
.imp tr.check td { background: color-mix(in srgb, #e0a000 12%, transparent) }
.imp .imperr { color: #b3261e; font-size: 13px; margin: 0 }
.imp details summary { cursor: pointer; font-size: 12.5px; color: var(--ink-2, #47525f) }
.imp details li { font-size: 12px; color: var(--muted, #6f7a87) }
.imp .impacts { display: flex; gap: 8px; flex-wrap: wrap }
.imp .implink { display: flex; gap: 8px }
.imp .implink input { flex: 1; min-width: 0; font: 13px var(--f-body, system-ui); padding: 8px 10px; border: 1px solid var(--line, #d3d9e0); border-radius: 6px; background: var(--surface-2, #f4f6f8); color: var(--ink, #16202a) }
.imp [hidden] { display: none !important }`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const show = v => (v === '' || v == null ? '–' : esc(v));

  function mount(opts) {
    const card = document.getElementById(opts.card);
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    card.classList.add('imp');
    card.innerHTML = `<header><h2>Import inputs from a file</h2><span class="hint">optional · manual entry works as before</span></header>
      <p class="hint">Choose a PDF, Excel (.xlsx, .xls, .csv) or Word (.docx, .doc) file with your data written as a label and a value, for example
      "Blast volume 2000" or a table row. The app reads the file on this device, shows what it found, and changes nothing until you press Submit.</p>
      <div class="impbar"><label class="btn" tabindex="0">Choose file<input type="file" accept="${ACCEPT}"></label><span class="impname"></span></div>
      ${window.BFUrl ? `<div class="implink"><input type="url" inputmode="url" autocomplete="off" spellcheck="false" aria-label="Link to a file" placeholder="Or paste a link: Google Sheets, Drive, OneDrive, Dropbox or file link" value="${esc(BFUrl.last())}"><button class="btn" type="button">Load link</button></div>
      <p class="hint">A link needs internet; the file is downloaded and read on this device.</p>` : ''}
      <p class="imperr" role="alert" hidden></p>
      <div class="impreview" hidden>
        <p class="hint impsum"></p>
        <div class="imptable"><table><thead><tr><th><input type="checkbox" class="impall" checked aria-label="Use all"></th><th>Input · read from the file as</th><th>Now</th><th>New</th></tr></thead><tbody></tbody></table></div>
        <details class="impmiss"><summary></summary><ul></ul></details>
        <p class="hint">Values must be in the units shown on each input. Ticked rows are applied; shaded rows are unticked because the match or the value needs a check. You can edit any value before submitting.</p>
        <div class="impacts"><button class="btn primary impgo" type="button">Submit</button><button class="btn impno" type="button">Cancel</button></div>
      </div>`;
    const q = s => card.querySelector(s), file = q('input[type=file]'), err = q('.imperr'), rev = q('.impreview'), tb = q('tbody');
    const fail = m => { err.textContent = m; err.hidden = false; rev.hidden = true; };
    let rows = [];
    q('.impbar label').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    file.addEventListener('change', () => { const fl = file.files && file.files[0]; if (fl) read(fl); });
    const link = q('.implink');
    if (link) {
      const box = link.querySelector('input'), go = link.querySelector('button');
      const load = async () => {
        if (!box.value.trim()) { box.focus(); return; }
        err.hidden = true; go.disabled = true; q('.impname').textContent = 'Downloading…';
        try { await read(await BFUrl.load(box.value)); }
        catch (e) { q('.impname').textContent = ''; fail('Could not load the link: ' + (e && e.message || e) + '.'); }
        go.disabled = false;
      };
      go.addEventListener('click', load);
      box.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); load(); } });
    }
    async function read(fl) {
      err.hidden = true; rev.hidden = true; q('.impname').textContent = fl.name + ' · reading…';
      try {
        const b = new Uint8Array(await fl.arrayBuffer()), k = kind(fl.name, b);
        let r = k === 'pdf' ? await pdfRows(b) : k === 'docx' ? await docxRows(b) : k === 'doc' ? docRows(b) : k === 'text' ? textRows(b) : await sheetRows(b, k === 'csv');
        let found = pairs(r);
        if (k === 'sheet' && !found.length && b[0] === 0xd0) found = pairs(docRows(b));   // a .doc saved with another extension
        const flds = fields(card), m = match(found, flds);
        q('.impname').textContent = fl.name;
        if (!found.length) return fail('No label and value pairs were found in this file. Scanned PDFs (pictures of pages) cannot be read; use the original Excel or Word file, or type the values in.');
        if (!m.res.length) return fail(`Found ${found.length} values, but none matched an input on this page. Use the same names as the inputs, for example "Top pressure" or "Ring 3 coke angle".`);
        m.res.sort((a, b) => flds.indexOf(a.f) - flds.indexOf(b.f));
        rows = m.res.map(x => {
          const el = x.f.el, lo = el.min === '' ? -Infinity : +el.min, hi = el.max === '' ? Infinity : +el.max;
          const out = x.p.value < lo || x.p.value > hi;
          return { ...x, out, use: x.sure && !out };
        });
        tb.innerHTML = rows.map((x, i) => `<tr class="${x.use ? '' : 'check'}"><td><input type="checkbox" data-i="${i}" ${x.use ? 'checked' : ''} aria-label="Use ${esc(x.f.label)}"></td>
          <td><b>${esc(x.f.label)}</b>${x.f.section ? ` <span class="sec">· ${esc(x.f.section)}</span>` : ''}<div class="src">“${esc(x.p.label)}”${x.p.src ? ' · ' + esc(x.p.src) : ''}</div>${x.out ? '<div class="warn">Outside ' + esc(x.f.el.min) + '–' + esc(x.f.el.max) + ': check the unit</div>' : x.sure ? '' : '<div class="warn">Check the match</div>'}</td>
          <td class="n">${show(x.f.el.value)}</td><td class="n"><input type="number" data-v="${i}" step="any" value="${x.p.value}" aria-label="New value for ${esc(x.f.label)}"></td></tr>`).join('');
        const nUse = rows.filter(x => x.use).length;
        q('.impsum').textContent = `${fl.name}: ${found.length} values found, ${rows.length} matched to inputs on this page, ${nUse} ticked.`;
        q('.impall').checked = nUse === rows.length;
        const miss = q('.impmiss');
        miss.hidden = !m.unmatched.length;
        miss.querySelector('summary').textContent = `Not matched (${m.unmatched.length}): rename these in the file to an input's name to import them`;
        miss.querySelector('ul').innerHTML = m.unmatched.slice(0, 200).map(p => `<li>${esc(p.label)} = ${esc(p.value)}${p.src ? ' · ' + esc(p.src) : ''}</li>`).join('');
        rev.hidden = false; rev.scrollIntoView({ block: 'nearest' });
      } catch (e) {
        q('.impname').textContent = fl.name;
        fail('Could not read this file (' + (e && e.message || e) + '). Check that it opens in Excel, Word or a PDF viewer.');
      }
    }
    tb.addEventListener('change', e => {
      const i = e.target.dataset.i; if (i !== undefined) { rows[i].use = e.target.checked; e.target.closest('tr').classList.toggle('check', !e.target.checked); }
    });
    q('.impall').addEventListener('change', e => tb.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = e.target.checked; c.dispatchEvent(new Event('change', { bubbles: true })); }));
    q('.impno').addEventListener('click', () => { rev.hidden = true; file.value = ''; q('.impname').textContent = ''; });
    q('.impgo').addEventListener('click', () => {
      let n = 0;
      rows.forEach((x, i) => {
        if (!x.use) return;
        const v = tb.querySelector(`[data-v="${i}"]`).value; if (v === '' || !Number.isFinite(+v)) return;
        const el = document.getElementById(x.f.id); if (!el) return;   // look up again: some tables are redrawn after each change
        el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); n++;
      });
      rev.hidden = true; file.value = '';
      q('.impname').textContent = n ? `${n} inputs updated from the file.` : 'Nothing was applied.';
      if (n && opts.after) opts.after();
    });
  }

  window.BFImport = { mount, _test: { tokens, score, pairs, textLine, splitFree, match, fields, num, docRows } };
})();
