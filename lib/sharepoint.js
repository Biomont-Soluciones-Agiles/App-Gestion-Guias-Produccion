const { randomUUID } = require('node:crypto');
const base = 'https://graph.microsoft.com/v1.0';
const draftPrefix = '_RevisionGuia_';

async function connectLibrary() {
  const tokenResponse = await fetch('https://login.microsoftonline.com/' + process.env.MICROSOFT_TENANT_ID + '/oauth2/v2.0/token', {
    method: 'POST', body: new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID, client_secret: process.env.MICROSOFT_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' })
  });
  if (!tokenResponse.ok) throw Error('No se pudo autenticar la aplicación en SharePoint.');
  const { access_token } = await tokenResponse.json();
  async function call(path, options = {}) {
    const response = await fetch(base + path, { ...options, headers: { ...options.headers, Authorization: 'Bearer ' + access_token } });
    if (!response.ok) throw Error('SharePoint devolvió ' + response.status + '.');
    return response;
  }
  const json = async path => (await call(path)).json();
  const siteUrl = new URL(process.env.SHAREPOINT_SITE_URL);
  const site = await json('/sites/' + siteUrl.hostname + ':' + siteUrl.pathname + '?$select=id,displayName,webUrl');
  const drives = await json('/sites/' + site.id + '/drives?$select=id,name,webUrl');
  const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const drive = drives.value.find(x => normalize(x.name) === normalize(process.env.SHAREPOINT_LIBRARY_NAME));
  if (!drive) throw Error('No se encontró la biblioteca configurada.');
  const root = '/drives/' + drive.id;
  return { site, drive, json,
    item: id => json(root + '/items/' + encodeURIComponent(id) + '?$select=id,name,webUrl,size,eTag,file,parentReference,sharepointIds'),
    contents: async id => Buffer.from(await (await call(root + '/items/' + encodeURIComponent(id) + '/content')).arrayBuffer()),
    save: async (bytes, baselineId) => (await call(root + '/root:/' + draftPrefix + baselineId + '_' + randomUUID() + '.xlsx:/content', { method: 'PUT', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body: bytes })).json(),
    discard: id => call(root + '/items/' + encodeURIComponent(id), {method:'DELETE'})
  };
}
module.exports = { connectLibrary, draftPrefix };
