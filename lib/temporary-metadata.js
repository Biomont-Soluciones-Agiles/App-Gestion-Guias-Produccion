const {normalizeField}=require('./sharepoint-fields');
const {fail}=require('./request-state');

function temporaryColumns(columns) {
  const match=names=>columns.find(column=>names.map(normalizeField).some(name=>normalizeField(column.name)===name || normalizeField(column.displayName)===name));
  const spec={batch:match(['TamanoLote','Tamaño de lote']),status:match(['Estado']),kind:match(['TipoGuia','Tipo de guía']),version:match(['Version','Versión']),product:match(['Producto']),phase:match(['FaseProduccion','Fase de producción']),line:match(['LineaProduccion','LineaProd','Línea de producción'])};
  const missing=Object.entries(spec).filter(([,column])=>!column).map(([name])=>({batch:'TamanoLote',status:'Estado',kind:'TipoGuia',version:'Versión',product:'Producto',phase:'FaseProduccion',line:'LineaProduccion'}[name]));
  if(missing.length) throw fail(409,'Faltan columnas de SharePoint: '+missing.join(', ')+'.');
  for(const [column,values] of [[spec.status,['Habilitado','Inhabilitado']],[spec.kind,['Oficial','Temporal']]]) {
    if(column.choice && values.some(value=>!column.choice.choices?.includes(value))) throw fail(409,`La columna ${column.displayName} no tiene las opciones esperadas: ${values.join(', ')}.`);
  }
  return spec;
}
function temporaryFields(spec,guide,details) {
  for(const [name,value] of [['producto',guide.product],['fase',guide.production_phase],['línea',guide.production_line]]) if(!String(value || '').trim()) throw fail(409,'La guía no tiene '+name+' registrado en SharePoint.');
  const version=spec.version.number?1:'01';
  const batch=[details.batch,details.unit].filter(Boolean).join(' ');
  if(spec.batch.number && (!Number.isFinite(Number(details.batch)) || details.unit)) throw fail(409,'La columna TamanoLote debe ser de texto para guardar el lote con su unidad.');
  return {[spec.status.name]:'Habilitado',[spec.kind.name]:'Temporal',[spec.version.name]:version,[spec.batch.name]:spec.batch.number?Number(details.batch):batch,[spec.product.name]:guide.product,[spec.phase.name]:guide.production_phase,[spec.line.name]:guide.production_line};
}
module.exports={temporaryColumns,temporaryFields};
