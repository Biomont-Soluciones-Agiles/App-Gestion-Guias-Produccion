const { session } = require('./_auth');

const graph = async (accessToken, path) => {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || 'Error de Microsoft Graph');
  return body;
};

module.exports = async (req, res) => {
  if (!session(req)) return res.status(401).json({ error: 'Sesión requerida.' });
  try {
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID, client_secret: process.env.MICROSOFT_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' })
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error('No fue posible obtener acceso a SharePoint.');
    const siteUrl = new URL(process.env.SHAREPOINT_SITE_URL);
    const site = await graph(token.access_token, `/sites/${siteUrl.hostname}:${siteUrl.pathname}?$select=id,displayName,webUrl`);
    const drives = await graph(token.access_token, `/sites/${site.id}/drives?$select=id,name,webUrl`);
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const drive = drives.value.find(item => normalize(item.name) === normalize(process.env.SHAREPOINT_LIBRARY_NAME));
    if (!drive) return res.status(404).json({ error: 'No se encontró la biblioteca configurada.', library: process.env.SHAREPOINT_LIBRARY_NAME });
    const files = await graph(token.access_token, `/drives/${drive.id}/root/children?$select=id,name,webUrl,lastModifiedDateTime,file&$expand=listItem($expand=fields)`);
    const guides = files.value.filter(item => item.file && /\.xlsx$/i.test(item.name)).map(item => ({ id: item.id, name: item.name, webUrl: item.webUrl, modifiedAt: item.lastModifiedDateTime, product: item.listItem?.fields?.Producto || null, phase: item.listItem?.fields?.FaseProduccion || null }));
    return res.status(200).json({ site: { name: site.displayName, url: site.webUrl }, library: { id: drive.id, name: drive.name, url: drive.webUrl }, guides });
  } catch (error) { return res.status(502).json({ error: error.message || 'No fue posible leer SharePoint.' }); }
};
