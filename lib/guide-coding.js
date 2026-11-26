const {openWorkbook}=require('./workbook');
const {recalculate}=require('./recalculate');
const {fail}=require('./request-state');

const codes={
  fabricacion:{prefix:'GF',guide:'123'},
  envasado:{prefix:'GE',guide:'456'},
  acondicionado:{prefix:'GA',guide:'789'}
};
function prepareGuideVersion(buffer,phase,baselineBuffer=buffer,temporary=false) {
  const key=String(phase || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const format=codes[key];
  if(!format) throw fail(422,'La fase de producción no permite asignar el código automáticamente.');
  const book=openWorkbook(buffer);
  const sheet=book.sheets[0];
  if(!sheet) throw fail(422,'La guía no contiene una hoja visible.');
  const baseline=openWorkbook(baselineBuffer);
  if(!baseline.sheets.includes(sheet)) throw fail(422,'La versión anterior no contiene la hoja principal.');
  const current=baseline.inspect(sheet);
  const normalize=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(!normalize(current.cells.find(c=>c.address==='I2')?.value).includes('codigo') ||
     !normalize(current.cells.find(c=>c.address==='I3')?.value).includes('version')) {
    throw fail(422,'La guía no tiene el formato esperado para actualizar código y versión.');
  }
  const raw=current.cells.find(c=>c.address==='J3')?.value?.trim() || '';
  const previous=/^\d{1,2}$/.test(raw) ? Number(raw) : raw.toUpperCase()==='XX' || raw==='' ? 1 : NaN;
  if(!Number.isInteger(previous) || previous<1 || previous>=99) throw fail(422,'La versión actual no se pudo interpretar. Revisa la celda J3.');
  const version=temporary?'01':String(previous+1).padStart(2,'0');
  const code=format.prefix+'-'+version+'-'+format.guide;
  const changed=book.apply([
    {sheet,address:'J2',value:code,type:'text'},
    {sheet,address:'J3',value:version,type:'text'}
  ]);
  return {bytes:recalculate(changed),code,version};
}
module.exports={prepareGuideVersion};
