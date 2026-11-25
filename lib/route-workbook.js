const {openWorkbook}=require('./workbook');
const {stampSignature}=require('./signature-stamp');
const {fail}=require('./request-state');

async function decorateRouteWorkbook(bytes,members) {
  if(!Array.isArray(members) || !members.length) return bytes;
  const book=openWorkbook(bytes),sheet=book.sheets[0],info=book.inspect(sheet);
  const value=address=>String(info.cells.find(cell=>cell.address===address)?.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(!value('B6').includes('elaborado') || !value('F6').includes('revisado') || !value('H6').includes('aprobado')) throw fail(422,'La guía no tiene las áreas de firma esperadas en la primera hoja.');
  let result=bytes;
  for(const step of ['Elaborador','Revision','Aprobacion']) {
    const signed=members.filter(member=>member.step===step && member.signed_at);
    if(signed.length) result=await stampSignature(result,step,signed);
  }
  const names=['Elaborador','Revision','Aprobacion'].map(step=>members.filter(member=>member.step===step).map(member=>member.display_name).join(' / '));
  return openWorkbook(result).apply(['B7','F7','H7'].map((address,index)=>({sheet,address,value:names[index],type:'text'})));
}
module.exports={decorateRouteWorkbook};
