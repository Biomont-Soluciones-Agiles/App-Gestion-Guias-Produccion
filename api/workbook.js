const crypto = require('node:crypto');
const {session} = require('./_auth');
const {connectLibrary} = require('../lib/sharepoint');
const {getRequest, canEdit, commit, fail} = require('../lib/request-state');
const {openWorkbook} = require('../lib/workbook');

module.exports = async (req,res) => {
  res.setHeader('Cache-Control','private, no-store');
  const user=session(req);
  if (!user) return res.status(401).json({error:'Inicia sesiÃƒÂ³n nuevamente.'});
  try {
    if (!['GET','POST'].includes(req.method)) throw fail(405,'MÃƒÂ©todo no permitido.');
    const row=await getRequest(req.query.id);
    if (!row.sharepoint_item_id) throw fail(404,'La solicitud carece de archivo de SharePoint.');
    const comparing=req.query.compare==='1';
    if (comparing && !['Jefatura','Administrador'].includes(user.role)) throw fail(403,'Acceso reservado a Jefatura.');
    const editing=req.method==='POST' || req.query.edit==='1';
    if (editing && !canEdit(user,row)) throw fail(403,'La ediciÃƒÂ³n estÃƒÂ¡ cerrada para esta solicitud o este usuario.');
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
    if (comparing) {
      const match=/^_RevisionGuia_([A-Za-z0-9-]+)_[0-9a-f-]{36}\.xlsx$/i.exec(item.name);
      if (!match) throw fail(404,'No se registrÃ³ la versiÃ³n anterior para esta solicitud. Las nuevas ediciones guardarÃ¡n su referencia.');
      const previous=await library.item(match[1]);
      const [beforeBytes,afterBytes]=await Promise.all([library.contents(previous.id),library.contents(item.id)]);
      const before=openWorkbook(beforeBytes),after=openWorkbook(afterBytes);
      const name=req.query.sheet || after.sheets[0];
      if (!before.sheets.includes(name) || !after.sheets.includes(name)) throw fail(422,'La hoja no estÃ¡ disponible en ambas versiones.');
      return res.json({sheets:after.sheets.filter(n=>before.sheets.includes(n)),before:before.inspect(name),after:after.inspect(name)});
    }
    if (!editing) return res.json({webUrl});
    if (item.size > 12 * 1024 * 1024) throw fail(413,'El libro excede el lÃƒÂ­mite de ediciÃƒÂ³n de 12 MB.');
    const bytes=await library.contents(item.id);
    const revision=crypto.createHash('sha256').update(item.id).update(bytes).digest('hex');
    const book=openWorkbook(bytes);
    if (!book.sheets.length) throw fail(422,'El libro carece de hojas visibles compatibles.');
    if (req.method==='GET') {
      const sheet=book.inspect(req.query.sheet || book.sheets[0]);
      if (Buffer.byteLength(JSON.stringify(sheet))>3500000) throw fail(413,'La hoja excede el tamaÃƒÂ±o de ediciÃƒÂ³n admitido.');
      return res.json({revision,itemId:item.id,webUrl,sheets:book.sheets,sheet});
    }
    if (req.body?.revision!==revision) throw fail(409,'La guÃƒÂ­a cambiÃƒÂ³. Vuelve a abrirla antes de guardar.');
    const output=book.apply(req.body.changes);
    const latest=await library.item(item.id);
    if (latest.eTag!==item.eTag) throw fail(409,'El Excel cambiÃƒÂ³ en SharePoint. Vuelve a abrirlo.');
    const known=/^_RevisionGuia_([A-Za-z0-9-]+)_[0-9a-f-]{36}\.xlsx$/i.exec(item.name);
    if (item.name.startsWith('_RevisionGuia_') && !known) throw fail(409,'Esta versiÃ³n anterior carece de una referencia de origen para comparar.');
    const baseline=known ? known[1] : (await library.save(bytes,item.id)).id;
    const draft=await library.save(output,baseline);
    try { await commit(row,{sharepoint_item_id:draft.id}); }
    catch(error) {
      // Only discard after a definite compare-and-swap miss. An ambiguous DB response may have committed.
      if (error.status===409) await library.discard(draft.id);
      throw error;
    }
    return res.json({itemId:draft.id,webUrl:draft.webUrl,revision:crypto.createHash('sha256').update(draft.id).update(output).digest('hex')});
  } catch(error) {return res.status(error.status || 502).json({error:error.status ? error.message : 'No se pudo procesar el Excel en SharePoint.'});}
};
