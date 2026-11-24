const { unzipSync, zipSync, strFromU8, strToU8 } = require('fflate');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const path = require('node:path').posix;
const { fail } = require('./request-state');
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const elements = (node, tag) => Array.from(node.getElementsByTagNameNS(ns, tag));
const cellPosition = address => {
  const parts = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(address);
  if (!parts) throw fail(400,'Introduce una dirección de celda válida.');
  const col = [...parts[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
  const row = Number(parts[2]);
  if (col > 16384 || row > 1048576) throw fail(400,'La celda está fuera de la hoja.');
  return { col, row };
};
function openWorkbook(bytes) {
  let expanded = 0;
  const files = unzipSync(bytes, {filter(entry) {
    expanded += entry.originalSize;
    if (expanded > 60 * 1024 * 1024) throw fail(413,'El archivo excede el tamaño de edición admitido.');
    return true;
  }});
  if (Object.keys(files).some(s => s.startsWith('_xmlsignatures/'))) throw fail(422,'Este archivo tiene una firma digital que impide modificarlo.');
  const read = name => {
    if (!files[name]) throw fail(422,'La estructura del libro no es compatible.');
    const xml = strFromU8(files[name]);
    if (/<!DOCTYPE/i.test(xml)) throw fail(422,'El libro contiene una declaración XML no admitida.');
    return new DOMParser().parseFromString(xml,'application/xml');
  };
  const bookPath = 'xl/workbook.xml';
  const book = read(bookPath);
  const rels = Array.from(read('xl/_rels/workbook.xml.rels').getElementsByTagName('Relationship'));
  const resolve = rel => path.normalize(rel.getAttribute('Target').startsWith('/') ? rel.getAttribute('Target').slice(1) : path.join('xl',rel.getAttribute('Target')));
  const stringRel = rels.find(r => r.getAttribute('Type').endsWith('/sharedStrings'));
  const strings = stringRel ? elements(read(resolve(stringRel)), 'si').map(si => elements(si,'t').map(t => t.textContent).join('')) : [];
  const sheets = elements(book,'sheet').filter(s => !['hidden','veryHidden'].includes(s.getAttribute('state'))).flatMap(s => {
    const rel = rels.find(r => r.getAttribute('Id') === s.getAttribute('r:id') && r.getAttribute('Type').endsWith('/worksheet'));
    return rel ? [{name:s.getAttribute('name'), path:resolve(rel)}] : [];
  });
  function sheetData(name) {
    const sheet = sheets.find(s => s.name === name);
    if (!sheet) throw fail(400,'Selecciona una hoja del archivo.');
    const doc = read(sheet.path);
    const cells = new Map(elements(doc,'c').map(c => [c.getAttribute('r'),c]));
    const value = c => {
      const raw = elements(c,'v')[0]?.textContent || '';
      if (c.getAttribute('t') === 's') return strings[Number(raw)] || '';
      if (c.getAttribute('t') === 'inlineStr') return elements(c,'t').map(t=>t.textContent).join('');
      return raw;
    };
    return {sheet, doc, cells, value};
  }
  function inspect(name) {
    const { doc, cells, value } = sheetData(name);
    return { name, protected:elements(doc,'sheetProtection').length > 0, cells:Array.from(cells, ([address,c]) => {
      const formula = elements(c,'f')[0];
      return {address, value:value(c), locked:Boolean(formula) || ['b','e','d'].includes(c.getAttribute('t')), numeric:!formula && ['n','',null].includes(c.getAttribute('t')) && value(c) !== ''};
    }).filter(c => c.value || c.locked) };
  }
  function apply(changes) {
    if (!Array.isArray(changes) || !changes.length || changes.length > 500) throw fail(400,'Guarda entre 1 y 500 cambios por vez.');
    for (const name of new Set(changes.map(c=>c.sheet))) {
      const {sheet,doc,cells} = sheetData(name);
      if (elements(doc,'sheetProtection').length) throw fail(403,'La hoja está protegida.');
      const ranges = [...elements(doc,'mergeCell'), ...elements(doc,'f').filter(f=>f.hasAttribute('ref'))].map(n => {
        const [a,b] = n.getAttribute('ref').split(':'); return {a:cellPosition(a), b:cellPosition(b || a), merged:n.localName==='mergeCell'};
      });
      const data = elements(doc,'sheetData')[0];
      const rows = new Map(elements(data,'row').map(r=>[Number(r.getAttribute('r')),r]));
      for (const {address, value, type} of changes.filter(c=>c.sheet===name)) {
        if (typeof value!=='string' || value.length>32767 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value) || !['number','text'].includes(type)) throw fail(400,'El valor de celda es inválido.');
        const pos = cellPosition(address);
        if (ranges.some(({a,b,merged})=>pos.col>=a.col && pos.col<=b.col && pos.row>=a.row && pos.row<=b.row && !(merged && pos.row===a.row && pos.col===a.col))) throw fail(400,'Selecciona la celda principal de la combinación o una celda sin fórmula.');
        let cell=cells.get(address);
        if (cell && (elements(cell,'f').length || ['b','e','d'].includes(cell.getAttribute('t')))) throw fail(400,'La celda seleccionada es de solo lectura.');
        let row=rows.get(pos.row);
        if (!row) {
          row=doc.createElementNS(ns,'row'); row.setAttribute('r',String(pos.row));
          data.insertBefore(row,elements(data,'row').find(r=>Number(r.getAttribute('r'))>pos.row) || null);
          rows.set(pos.row,row);
        }
        if (!cell) {
          cell=doc.createElementNS(ns,'c'); cell.setAttribute('r',address);
          row.insertBefore(cell,elements(row,'c').find(c=>cellPosition(c.getAttribute('r')).col>pos.col) || elements(row,'extLst')[0] || null);
          cells.set(address,cell);
        }
        for (const child of Array.from(cell.childNodes)) if (['v','is'].includes(child.localName)) cell.removeChild(child);
        cell.removeAttribute('t');
        if (value !== '') {
          const numeric=type==='number';
          if (numeric && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) || !Number.isFinite(Number(value)))) throw fail(400,'Introduce un número válido.');
          const payload=doc.createElementNS(ns,numeric?'v':'is');
          if (numeric) payload.appendChild(doc.createTextNode(value));
          else {
            cell.setAttribute('t','inlineStr');
            const t=doc.createElementNS(ns,'t'); t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
            t.appendChild(doc.createTextNode(value)); payload.appendChild(t);
          }
          cell.insertBefore(payload,elements(cell,'extLst')[0] || null);
        }
      }
      const dim=elements(doc,'dimension')[0];
      if (dim) dim.parentNode.removeChild(dim);
      files[sheet.path]=strToU8(new XMLSerializer().serializeToString(doc));
    }
    const calc=elements(book,'calcPr')[0];
    if (calc) {calc.setAttribute('fullCalcOnLoad','1'); files[bookPath]=strToU8(new XMLSerializer().serializeToString(book));}
    return Buffer.from(zipSync(files));
  }
  return {sheets:sheets.map(s=>s.name),inspect,apply};
}
module.exports={openWorkbook};
