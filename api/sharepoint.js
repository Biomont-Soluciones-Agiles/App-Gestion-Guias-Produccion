const { session, hasRole } = require('./_auth');

const { connectLibrary, draftPrefix } = require('../lib/sharepoint');
const {catalogFolder}=require('../lib/guide-catalog-folder');
const {fieldValue}=require('../lib/sharepoint-fields');

module.exports = async (req, res) => {
  const user = session(req);
  if (!user) return res.status(401).json({ error: 'Sesión requerida.' });
  if (!['Responsable','Jefatura','ASC'].some(role => hasRole(user,role))) return res.status(403).json({ error: 'No tienes acceso al catálogo.' });
  try {
    const source=req.query?.source || 'standard';
    const includeInactive=req.query?.includeInactive==='1';
    if(includeInactive && !hasRole(user,'ASC')) return res.status(403).json({error:'Acceso reservado a ASC.'});
    const library=await connectLibrary(source);
    const { site, drive, json } = library;
    const folder=await catalogFolder(library,source);
    const items = [];
    let next = `/drives/${drive.id}/items/${encodeURIComponent(folder.id)}/children?$select=id,name,webUrl,lastModifiedDateTime,file&$expand=listItem($expand=fields)`;
    while (next) {
      const page = await json(next);
      items.push(...(page.value || []));
      const nextLink = page['@odata.nextLink'];
      if (!nextLink) break;
      const nextUrl = new URL(nextLink);
      if (nextUrl.origin !== 'https://graph.microsoft.com' || !nextUrl.pathname.startsWith('/v1.0/')) throw new Error('La respuesta de SharePoint no es válida.');
      next = nextUrl.pathname.slice('/v1.0'.length) + nextUrl.search;
    }
    const guides = items.filter(item => item.file && !item.name.startsWith(draftPrefix) && /\.xlsx$/i.test(item.name)).map(item => {const fields=item.listItem?.fields || {};return { id:item.id,name:item.name,webUrl:item.webUrl,modifiedAt:item.lastModifiedDateTime,product:fieldValue(fields,['Producto']),phase:fieldValue(fields,['FaseProduccion','Fase']),line:fieldValue(fields,['LineaProd','LineaProduccion','Línea']),classification:fieldValue(fields,['Clasificacion']),batch:fieldValue(fields,['TamanoLote','Tamaño de lote','Tamaño del lote','Tamanodelote']),batchUnit:fieldValue(fields,['UnidadLote','Unidad de lote']),temporaryStatus:fieldValue(fields,['Estado']),guideKind:fieldValue(fields,['TipoGuia']),version:fieldValue(fields,['Version']) };}).filter(item=>source==='temporary' ? String(item.guideKind).toLowerCase()==='temporal' && (includeInactive || String(item.temporaryStatus).toLowerCase()==='activo') : String(item.guideKind).toLowerCase()==='oficial' && String(item.temporaryStatus).toLowerCase()==='activo');
    return res.status(200).json({ site: { name: site.displayName, url: site.webUrl }, library: { id: drive.id, name: drive.name, url: drive.webUrl }, guides });
  } catch (error) { return res.status(error.status || 502).json({ error: error.status ? error.message : 'No fue posible leer SharePoint.' }); }
};
