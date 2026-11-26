const test=require('node:test');
const assert=require('node:assert/strict');
const {temporaryColumns,temporaryFields}=require('../lib/temporary-metadata');
const columns=['TamanoLote','Estado','TipoGuia','Version','Producto','FaseProduccion','LineaProduccion'].map(name=>({name,displayName:name}));
test('prepara metadatos de guía temporal con versión 01 y lote',()=>{
  const spec=temporaryColumns(columns),fields=temporaryFields(spec,{product:'Proteggo',production_phase:'Fabricación',production_line:'Sólidos'},{batch:'500',unit:'kg'});
  assert.deepEqual(fields,{Estado:'Activo',TipoGuia:'Temporal',Version:'01',TamanoLote:'500 kg',Producto:'Proteggo',FaseProduccion:'Fabricación',LineaProduccion:'Sólidos'});
});
test('detiene la publicación si falta una columna o una opción requerida',()=>{
  assert.throws(()=>temporaryColumns(columns.filter(column=>column.name!=='Estado')),/Faltan columnas/);
  assert.throws(()=>temporaryColumns(columns.map(column=>column.name==='Estado'?{...column,choice:{choices:['Activo']}}:column)),/opciones esperadas/);
});
