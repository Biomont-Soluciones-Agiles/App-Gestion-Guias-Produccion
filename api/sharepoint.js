const { session } = require('./_auth');

const { connectLibrary, draftPrefix } = require('../lib/sharepoint');

module.exports = async (req, res) => {
  if (!session(req)) return res.status(401).json({ error: 'Sesión requerida.' });
  try {
    const { site, drive, json } = await connectLibrary();
    const items = [];
    let next = `/drives/${drive.id}/root/children?$select=id,name,webUrl,lastModifiedDateTime,file&$expand=listItem($expand=fields)`;
    while (next) {
      const page = await json(next);
      items.push(...(page.value || []));
      const nextLink = page['@odata.nextLink'];
      if (!nextLink) break;
      const nextUrl = new URL(nextLink);
      if (nextUrl.origin !== 'https://graph.microsoft.com' || !nextUrl.pathname.startsWith('/v1.0/')) throw new Error('La respuesta de SharePoint no es válida.');
      next = nextUrl.pathname.slice('/v1.0'.length) + nextUrl.search;
    }
    const guides = items.filter(item => item.file && !item.name.startsWith(draftPrefix) && /\.xlsx$/i.test(item.name)).map(item => ({ id: item.id, name: item.name, webUrl: item.webUrl, modifiedAt: item.lastModifiedDateTime, product: item.listItem?.fields?.Producto || null, phase: item.listItem?.fields?.FaseProduccion || null, line: item.listItem?.fields?.LineaProd || item.listItem?.fields?.LineaProduccion || null, classification: item.listItem?.fields?.Clasificacion || null }));
    return res.status(200).json({ site: { name: site.displayName, url: site.webUrl }, library: { id: drive.id, name: drive.name, url: drive.webUrl }, guides });
  } catch (error) { return res.status(502).json({ error: error.message || 'No fue posible leer SharePoint.' }); }
};
