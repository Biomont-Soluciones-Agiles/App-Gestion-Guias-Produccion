const { randomUUID } = require('node:crypto');
const base = 'https://graph.microsoft.com/v1.0';
const draftPrefix = '_RevisionGuia_';

async function connectLibrary(source='standard') {
  const tokenResponse = await fetch('https://login.microsoftonline.com/' + process.env.MICROSOFT_TENANT_ID + '/oauth2/v2.0/token', {
    method: 'POST', body: new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID, client_secret: process.env.MICROSOFT_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' })
  });
  if (!tokenResponse.ok) throw Error('No se pudo autenticar la aplicación en SharePoint.');
  const { access_token } = await tokenResponse.json();
  async function call(path, options = {}) {
    const response = await fetch(base + path, { ...options, headers: { ...options.headers, Authorization: 'Bearer ' + access_token } });
    if (!response.ok) throw Object.assign(Error('SharePoint devolvió ' + response.status + '.'), {status:response.status});
    return response;
  }
  const json = async path => (await call(path)).json();
  const siteUrl = new URL(process.env.SHAREPOINT_SITE_URL);
  const site = await json('/sites/' + siteUrl.hostname + ':' + siteUrl.pathname + '?$select=id,displayName,webUrl');
  const drives = await json('/sites/' + site.id + '/drives?$select=id,name,webUrl');
  const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if(!['standard','temporary','history'].includes(source)) throw Error('Catálogo de SharePoint inválido.');
  const historyPath='/sites/Documentacinaplicaciones/Historial de version';
  const drive = source==='history' ? drives.value.find(x=>{try {const address=new URL(x.webUrl);return address.hostname.toLowerCase()===siteUrl.hostname.toLowerCase() && normalize(decodeURIComponent(address.pathname).replace(/\/$/,''))===normalize(historyPath);}catch{return false;}}) : drives.value.find(x => normalize(x.name) === normalize(process.env.SHAREPOINT_LIBRARY_NAME));
  if (!drive) throw Error('No se encontró la biblioteca configurada.');
  const root = '/drives/' + drive.id;
  return { site, drive, json,
    columns: async () => {
      const rootItem=await json(root+'/root?$select=sharepointIds');
      const listId=rootItem.sharepointIds?.listId;
      if(!listId) throw Error('No se pudo identificar la biblioteca de SharePoint.');
      const columns=[];let next='/sites/'+encodeURIComponent(site.id)+'/lists/'+encodeURIComponent(listId)+'/columns?$select=name,displayName,choice,text,number';
      while(next) {
        const page=await json(next);columns.push(...(page.value || []));
        if(!page['@odata.nextLink'])break;
        const link=new URL(page['@odata.nextLink']);
        if(link.origin!=='https://graph.microsoft.com' || !link.pathname.startsWith('/v1.0/')) throw Error('Respuesta de columnas no válida.');
        next=link.pathname.slice('/v1.0'.length)+link.search;
      }
      return columns;
    },
    item: id => json(root + '/items/' + encodeURIComponent(id) + '?$select=id,name,webUrl,size,eTag,file,parentReference,sharepointIds'),
    contents: async id => Buffer.from(await (await call(root + '/items/' + encodeURIComponent(id) + '/content')).arrayBuffer()),
    findByName: async name => {try{return await json(root+'/root:/'+encodeURIComponent(name)+'?$select=id,name,file,eTag');}catch(error){if(error.status===404)return null;throw error;}},
    updateFields: async (id,fields) => {
      const item=await json(root+'/items/'+encodeURIComponent(id)+'?$select=sharepointIds');
      const ids=item.sharepointIds;
      if(!ids?.listId || !ids?.listItemId) throw Error('No se encontraron los datos de la fila de SharePoint.');
      return (await call('/sites/'+encodeURIComponent(site.id)+'/lists/'+encodeURIComponent(ids.listId)+'/items/'+encodeURIComponent(ids.listItemId)+'/fields',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)})).json();
    },
    createNew: async (name,bytes) => {
      if(!name || /[\\/:*?"<>|#%]/.test(name) || !bytes.length || bytes.length>12*1024*1024) throw Error('Nombre o tamaño de archivo no válido.');
      const session=await (await call(root+'/root:/'+encodeURIComponent(name)+':/createUploadSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item:{'@microsoft.graph.conflictBehavior':'fail',name}})})).json();
      const upload=new URL(session.uploadUrl);
      if(upload.protocol!=='https:') throw Error('La dirección de carga de SharePoint no es válida.');
      const chunk=10*1024*1024;let result;
      for(let start=0;start<bytes.length;start+=chunk) {
        const end=Math.min(start+chunk,bytes.length)-1;
        const response=await fetch(upload.toString(),{method:'PUT',headers:{'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${bytes.length}`},body:bytes.subarray(start,end+1)});
        if(!response.ok) throw Object.assign(Error('No se pudo crear la guía temporal en SharePoint.'),{status:response.status});
        result=await response.json();
      }
      if(!result?.id) throw Error('SharePoint no confirmó el archivo temporal.');
      return result;
    },
    replace: async (id, bytes, etag) => (await call(root + '/items/' + encodeURIComponent(id) + '/content', {method:'PUT',headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','If-Match':etag},body:bytes})).json(),
    save: async (bytes, baselineId) => (await call(root + '/root:/' + draftPrefix + baselineId + '_' + randomUUID() + '.xlsx:/content', { method: 'PUT', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body: bytes })).json(),
    discard: id => call(root + '/items/' + encodeURIComponent(id), {method:'DELETE'})
  };
}
module.exports = { connectLibrary, draftPrefix };
