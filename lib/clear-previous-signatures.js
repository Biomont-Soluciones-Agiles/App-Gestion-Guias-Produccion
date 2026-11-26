const {openWorkbook}=require('./workbook');

// Las plantillas actuales sitúan las firmas en la fila 8, bajo estos títulos.
// No modifica el archivo original ni elimina imágenes fuera de ese recuadro.
function clearPreviousSignatures(bytes) {
  const book=openWorkbook(bytes),changes=[];
  for(const name of book.sheets) {
    const sheet=book.inspect(name);
    const label=address=>String(sheet.cells.find(cell=>cell.address===address)?.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(!label('B6').includes('elaborado') || !label('F6').includes('revisado') || !label('H6').includes('aprobado')) continue;
    for(const image of sheet.images) {
      if(image.from.row===8 && image.from.col>=1 && image.from.col<=11 && image.to && image.to.row<=9 && image.to.col<=12)
        changes.push({sheet:name,type:'image',id:image.id,action:'delete'});
    }
  }
  return changes.length ? book.apply(changes) : bytes;
}
module.exports={clearPreviousSignatures};
