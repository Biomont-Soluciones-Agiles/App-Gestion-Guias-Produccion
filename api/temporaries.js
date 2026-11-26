const {session,hasRole}=require('./_auth');
const {connectLibrary}=require('../lib/sharepoint');
const {catalogFolder}=require('../lib/guide-catalog-folder');
const {normalizeField}=require('../lib/sharepoint-fields');

module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const user=session(req);
  if(!user) return res.status(401).json({error:'Inicia sesión nuevamente.'});
  if(!hasRole(user,'ASC')) return res.status(403).json({error:'Acceso reservado a ASC.'});
  if(req.method!=='POST') return res.status(405).json({error:'Método no permitido.'});
  const {id,status}=req.body || {};
  if(typeof id!=='string' || !/^[A-Za-z0-9_-]{1,200}$/.test(id) || !['Habilitado','Inhabilitado'].includes(status)) return res.status(400).json({error:'Selecciona una guía y un estado válidos.'});
  try {
    const library=await connectLibrary('temporary'),root=await catalogFolder(library,'temporary'),item=await library.item(id);
    if(!item.file || !/\.xlsx$/i.test(item.name) || item.parentReference?.id!==root.id) return res.status(404).json({error:'No se encontró la guía temporal.'});
    const detailed=await library.json('/drives/'+library.drive.id+'/items/'+encodeURIComponent(id)+'?$select=id&$expand=listItem($expand=fields)');
    const {fieldValue}=require('../lib/sharepoint-fields');
    if(String(fieldValue(detailed.listItem?.fields,['TipoGuia'])).toLowerCase()!=='temporal') return res.status(409).json({error:'Solo se puede cambiar el estado de una guía temporal.'});
    const column=(await library.columns()).find(col=>[col.name,col.displayName].some(name=>normalizeField(name)==='estado'));
    if(!column) return res.status(409).json({error:'No se encontró la columna Estado en SharePoint.'});
    await library.updateFields(item.id,{[column.name]:status});
    return res.json({ok:true,status});
  } catch(error) {
    console.error('No se pudo actualizar el estado temporal',{status:error.status});
    return res.status(502).json({error:'No se pudo actualizar el estado en SharePoint. Verifica la columna Estado.'});
  }
};
