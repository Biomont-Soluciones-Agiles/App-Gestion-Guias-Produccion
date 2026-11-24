import React, {useEffect, useState} from 'react';

async function workbookRequest(id, params, options) {
  const query = new URLSearchParams({id, ...params});
  const response = await fetch('/api/workbook?' + query, {cache:'no-store', ...options});
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'No se pudo abrir el libro.');
  return result;
}
function previewUrl(url, sheet, address) {
  const link = new URL(url);
  link.searchParams.set('action','embedview');
  link.searchParams.set('wdDownloadButton','False');
  if (sheet) link.searchParams.set('wdActiveCell',"'" + sheet.replace(/'/g,"''") + "'!" + (address || 'A1'));
  return link.toString();
}

export default function GuideViewer({data, onClose, editable=false, onSaved, onSubmit}) {
  const [book,setBook] = useState(null);
  const [sheet,setSheet] = useState('');
  const [reload,setReload] = useState(0);
  const [address,setAddress] = useState('');
  const [changes,setChanges] = useState({});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setBook(null);
    setError('');
    workbookRequest(data.dbId, editable ? {edit:'1',sheet} : {}, {signal:controller.signal})
      .then(result => {if (!controller.signal.aborted) setBook(result);})
      .catch(e => {if (!controller.signal.aborted) setError(e.message);});
    return () => controller.abort();
  },[data.dbId,editable,sheet,reload]);
  const pending = Object.values(changes);
  const cell = book?.sheet?.cells.find(c => c.address === address);
  const draft = changes[address] || {address, sheet:book?.sheet?.name, value:cell?.value || '', type:cell?.numeric ? 'number' : 'text'};
  const validAddress = /^[A-Z]{1,3}[1-9]\d{0,6}$/.test(address);
  function change(patch) {
    setNotice('');
    setChanges(current => ({...current,[address]:{...draft,...patch}}));
  }
  async function save(submit) {
    setBusy(true); setError('');
    try {
      let itemId=book.itemId;
      if (pending.length) {
        const result=await workbookRequest(data.dbId,{}, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:book.revision,changes:pending})});
        itemId=result.itemId;
        setChanges({}); onSaved(itemId);
        setNotice('Versión guardada en SharePoint.');
        setReload(n=>n+1);
      }
      if (submit) await onSubmit(itemId);
    } catch(e) {setError(e.message);}
    finally {setBusy(false);}
  }
  const input='block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm';
  return <div role="dialog" aria-modal="true" aria-label={data.guide} className="fixed inset-0 z-[60] bg-slate-950/60 p-2 sm:p-4">
    <div className="mx-auto flex h-full max-w-screen-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div><p className="text-xs text-slate-500">{data.id} · {editable ? 'Edición' : 'Solo lectura'}</p><h3 className="font-bold">{data.guide}</h3></div>
        <div className="flex flex-wrap gap-2 text-sm">
          {editable && book && <><button disabled={busy || !pending.length} onClick={()=>save(false)} className="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50">Guardar cambios</button>
          <button disabled={busy} onClick={()=>save(true)} className="rounded bg-emerald-700 px-3 py-2 text-white disabled:opacity-50">Enviar a Jefatura</button></>}
          <button disabled={busy} onClick={()=>{if (!pending.length || window.confirm('¿Cerrar y descartar los cambios pendientes?')) onClose();}} className="rounded border px-3 py-2">Cerrar</button>
        </div>
      </header>
      {error && <div role="alert" className="bg-red-50 p-3 text-sm text-red-800">{error} {!book && <button className="underline" onClick={()=>setReload(n=>n+1)}>Reintentar</button>}</div>}
      {notice && <p role="status" className="bg-emerald-50 px-5 py-2 text-sm text-emerald-800">{notice}</p>}
      {book ? <div className="flex min-h-0 flex-1 flex-col overflow-auto md:flex-row">
        <div className="relative min-h-[35vh] flex-1 overflow-hidden"><iframe title={'Excel · '+data.guide} src={previewUrl(book.webUrl,book.sheet?.name)} className="absolute inset-x-0 top-0 w-full border-0" style={{height:'calc(100% + 32px)'}}/></div>
        {editable && <fieldset disabled={busy} className="w-full space-y-4 overflow-auto border-l bg-slate-50 p-4 md:w-80">
          <label className="block text-sm font-semibold">Hoja<select className={input} disabled={pending.length>0} value={book.sheet.name} onChange={e=>{setSheet(e.target.value);setAddress('');setNotice('');}}>{book.sheets.map(s=><option key={s}>{s}</option>)}</select></label>
          {book.sheet.protected ? <p>Esta hoja está protegida en el libro.</p> : <>
            <label className="block text-sm font-semibold">Celda<input className={input} value={address} placeholder="Ej. B12" list="excel-cells" onChange={e=>setAddress(e.target.value.toUpperCase().trim())}/></label>
            <datalist id="excel-cells">{book.sheet.cells.map(c=><option key={c.address} value={c.address}>{c.value.slice(0,100)}</option>)}</datalist>
            {validAddress && <><label className="block text-sm font-semibold">Valor<textarea rows="4" className={input} disabled={cell?.locked} value={draft.value} onChange={e=>change({value:e.target.value})}/></label>
            {cell?.locked ? <p className="text-sm">Esta celda es de solo lectura.</p> : <label className="block text-sm">Tipo de valor<select className={input} value={draft.type} onChange={e=>change({type:e.target.value})}><option value="text">Texto</option><option value="number">Número</option></select></label>}</>}
            <p className="text-xs text-slate-600">{pending.length ? 'Guarda los cambios para actualizar la vista del Excel y pasar a otra hoja.' : 'Selecciona una celda de la lista o escribe su dirección para modificar el valor.'}</p>
          </>}
        </fieldset>}
      </div> : !error && <p className="p-5 text-sm">Abriendo el Excel de SharePoint…</p>}
    </div>
  </div>;
}
