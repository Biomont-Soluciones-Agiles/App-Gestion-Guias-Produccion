function normalizeField(name) {
  return String(name).replace(/_x([0-9a-f]{4})_/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
}
function fieldValue(fields,names) {
  const wanted=new Set(names.map(normalizeField));
  const entry=Object.entries(fields || {}).find(([key])=>wanted.has(normalizeField(key)));
  return entry?.[1] ?? null;
}
module.exports={normalizeField,fieldValue};
