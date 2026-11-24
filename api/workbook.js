const crypto = require('node:crypto');
const {session} = require('./_auth');
const {connectLibrary} = require('../lib/sharepoint');
const {getRequest, canEdit, commit, fail} = require('../lib/request-state');
const {openWorkbook} = require('../lib/workbook');

module.exports = async (req,res) => {
  res.setHeader('Cache-Control','private, no-store');
  const user=session(req);
  if (!user) return res.status(401).json({error:'Inicia sesión nuevamente.'});
  try {
    if (!['GET','POST'].includes(req.method)) throw fail(405,'Método no permitido.');
    const row=await getRequest(req.query.id);
    if (!row.sharepoint_item_id) throw fail(404,'La solicitud carece de archivo de SharePoint.');
    const editing=req.method==='POST' || req.query.edit==='1';
    if (editing && !canEdit(user,row)) throw fail(403,'La edición está cerrada para esta solicitud o este usuario.');
    const library=await connectLibrary();
    const item=await library.item(row.sharepoint_item_id);
    if (!item.file || !/\.xlsx$/i.test(item.name)) throw fail(422,'Se requiere un libro XLSX.');
    let webUrl=item.webUrl;
    const uniqueId=item.sharepointIds?.listItemUniqueId;
    if (uniqueId && /^[0-9a-f-]{36}$/i.test(uniqueId)) {
      const viewer=new URL(library.site.webUrl.replace(/\/$/,'')+'/_layouts/15/Doc.aspx');
      viewer.searchParams.set('sourcedoc','{'+uniqueId+'}');
      webUrl=viewer.toString();
    }
    if (!editing) return res.json({webUrl});
    if (item.size > 12 * 1024 * 1024) throw fail(413,'El libro excede el límite de edición de 12 MB.');
    const bytes=await library.contents(item.id);
    const revision=crypto.createHash('sha256').update(item.id).update(bytes).digest('hex');
    const book=openWorkbook(bytes);
    if (!book.sheets.length) throw fail(422,'El libro carece de hojas visibles compatibles.');
    if (req.method==='GET') {
      const sheet=book.inspect(req.query.sheet || book.sheets[0]);
      if (Buffer.byteLength(JSON.stringify(sheet))>3500000) throw fail(413,'La hoja excede el tamaño de edición admitido.');
      return res.json({revision,itemId:item.id,webUrl,sheets:book.sheets,sheet});
    }
    if (req.body?.revision!==revision) throw fail(409,'La guía cambió. Vuelve a abrirla antes de guardar.');
    const output=book.apply(req.body.changes);
    const latest=await library.item(item.id);
    if (latest.eTag!==item.eTag) throw fail(409,'El Excel cambió en SharePoint. Vuelve a abrirlo.');
    const draft=await library.save(output);
    try { await commit(row,{sharepoint_item_id:draft.id}); }
    catch(error) {
      // Only discard after a definite compare-and-swap miss. An ambiguous DB response may have committed.
      if (error.status===409) await library.discard(draft.id);
      throw error;
    }
    return res.json({itemId:draft.id,webUrl:draft.webUrl,revision:crypto.createHash('sha256').update(draft.id).update(output).digest('hex')});
  } catch(error) {return res.status(error.status || 502).json({error:error.status ? error.message : 'No se pudo procesar el Excel en SharePoint.'});}
};
