const XLSX = require('xlsx');
const calculate = require('xlsx-calc');
const {unzipSync,zipSync,strFromU8,strToU8}=require('fflate');
const {DOMParser,XMLSerializer}=require('@xmldom/xmldom');
const path=require('node:path').posix;
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const list=(node,name)=>Array.from(node.getElementsByTagNameNS(ns,name));

function recalculate(buffer) {
  const archive=unzipSync(buffer);
  const read=name=>new DOMParser().parseFromString(strFromU8(archive[name]),'application/xml');
  const book=read('xl/workbook.xml');
  const relationships=Array.from(read('xl/_rels/workbook.xml.rels').getElementsByTagName('Relationship'));
  const parsed=XLSX.read(buffer,{type:'buffer',cellFormula:true});
  try { calculate(parsed,{continue_after_error:false,log_error:false}); }
  catch { throw Object.assign(new Error('El libro contiene fórmulas que el motor de cálculo no puede procesar.'),{status:422}); }
  for(const sheet of list(book,'sheet')) {
    const rel=relationships.find(r=>r.getAttribute('Id')===sheet.getAttribute('r:id') && r.getAttribute('Type').endsWith('/worksheet'));
    if(!rel) continue;
    const target=rel.getAttribute('Target'),sheetPath=target.startsWith('/')?target.slice(1):path.normalize(path.join('xl',target));
    const doc=read(sheetPath), values=parsed.Sheets[sheet.getAttribute('name')];
    if(!values) continue;
    for(const cell of list(doc,'c')) {
      if(!list(cell,'f').length) continue;
      const result=values[cell.getAttribute('r')];
      if(result?.v instanceof Date) {
        const day=Date.UTC(result.v.getFullYear(),result.v.getMonth(),result.v.getDate())/86400000;
        const properties=list(book,'workbookPr')[0];
        const uses1904=['1','true'].includes(properties?.getAttribute('date1904'));
        result.v=day+(uses1904?24107:25569);
        result.t='n';
      }
      if(!result || !['n','s','b','e'].includes(result.t)) throw Object.assign(new Error('No se pudo verificar el resultado de una fórmula.'),{status:422});
      if(result.t==='n' && !Number.isFinite(result.v)) throw Object.assign(new Error('El cálculo produjo un número no válido.'),{status:422});
      const existing=list(cell,'v')[0];
      if(existing) existing.parentNode.removeChild(existing);
      cell.setAttribute('t',result.t==='s'?'str':result.t);
      const value=doc.createElementNS(ns,'v');
      const errors={0:'#NULL!',7:'#DIV/0!',15:'#VALUE!',23:'#REF!',29:'#NAME?',36:'#NUM!',42:'#N/A'};
      const computed=result.t==='e'?errors[result.v]:result.t==='b'?(result.v?'1':'0'):String(result.v);
      if(computed===undefined) throw Object.assign(new Error('El libro contiene un error de fórmula no compatible.'),{status:422});
      value.appendChild(doc.createTextNode(computed));
      cell.insertBefore(value,list(cell,'extLst')[0] || null);
    }
    archive[sheetPath]=strToU8(new XMLSerializer().serializeToString(doc));
  }
  return Buffer.from(zipSync(archive));
}
module.exports={recalculate};
