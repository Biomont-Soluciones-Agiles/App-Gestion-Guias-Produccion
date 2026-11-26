const {openWorkbook}=require('./workbook');
const {fail}=require('./request-state');

function temporaryGuideInfo(bytes,originalName) {
  const book=openWorkbook(bytes),sheet=book.inspect(book.sheets[0]);
  const value=address=>String(sheet.cells.find(cell=>cell.address===address)?.value || '').trim();
  const label=value('E4').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(!label.includes('tamano') || !label.includes('lote')) throw fail(422,'La guía no tiene el campo de tamaño de lote en la posición esperada.');
  const batch=value('G4'),unit=value('H4');
  if(!batch || /^(x+|pendiente)$/i.test(batch) || !/^[\p{L}\p{N}., _-]{1,50}$/u.test(batch) || (unit && !/^[\p{L}\p{N}., _-]{1,20}$/u.test(unit))) throw fail(422,'Completa un tamaño de lote válido en la guía antes de publicarla.');
  const base=String(originalName || '').replace(/\.xlsx$/i,'').replace(/[\\/:*?"<>|#%]/g,' ').trim();
  if(!base) throw fail(422,'El nombre de la guía no es válido.');
  const suffix=[batch,unit].filter(Boolean).join(' ');
  const name=`${base} - Temporal - ${suffix}.xlsx`;
  if(name.length>200) throw fail(422,'El nombre de la guía temporal es demasiado largo.');
  return {batch,unit,name};
}
module.exports={temporaryGuideInfo};
