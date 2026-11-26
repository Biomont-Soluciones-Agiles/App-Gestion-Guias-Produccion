import React, {useEffect, useState} from 'react';
import WorksheetGrid from './WorksheetGrid';

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

  const [changes,setChanges] = useState({});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setBook(null);
    setError('');
    workbookRequest(data.dbId, {...(editable ? {edit:'1',sheet} : {sheet}),...(data.guideId ? {guideId:data.guideId} : {})}, {signal:controller.signal})
      .then(result => {if (!controller.signal.aborted) setBook(result);})
      .catch(e => {if (!controller.signal.aborted) setError(e.message);});
    return () => controller.abort();
  },[data.dbId,data.guideId,editable,sheet,reload]);
  const pending = Object.values(changes);
  function change(address,cell,value) {
    setNotice('');
    setChanges(current => {
      const next={...current};
      if (value === (cell?.value ?? '')) delete next[address];
      else {
        const numeric=/^[+-]?(?:0|[1-9]\d*)(?:[.,]\d+)?(?:e[+-]?\d+)?$/i.test(value);
        next[address]={address,sheet:book.sheet.name,value,type:numeric?'number':'text'};
      }
      return next;
    });
  }
  function changeImage(id, patch) {
    setNotice('');
    setChanges(current=>({...current,['image:'+id]:{sheet:book.sheet.name,type:'image',id,...patch}}));
  }
  async function save(submit) {
    setBusy(true); setError('');
    try {
      let itemId=book.itemId;
      if (pending.length || data.guideId) {
        const result=await workbookRequest(data.dbId,data.guideId ? {guideId:data.guideId} : {}, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:book.revision,changes:pending.map(c=>c.type==='number'?{...c,value:c.value.replace(',','.')}:c)})});
        itemId=result.itemId;
        setChanges({}); onSaved(itemId);
        setNotice('Cambios guardados.');
        setReload(n=>n+1);
      }
      if (submit) await onSubmit(itemId);
    } catch(e) {setError(e.message);}
    finally {setBusy(false);}
  }

  return <div role="dialog" aria-modal="true" aria-label={data.guide} className="fixed inset-0 z-[60] bg-slate-950/60 p-2 sm:p-4">
    <div className="mx-auto flex h-full max-w-screen-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div><p className="text-xs text-slate-500">{data.id} · {editable ? 'Edición' : 'Solo lectura'}</p><h3 className="font-bold">{data.guide}</h3></div>
        <div className="flex flex-wrap gap-2 text-sm">
          {editable && book && <><button disabled={busy || (!pending.length && !data.guideId)} onClick={()=>save(false)} className="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50">Guardar cambios</button>
          {onSubmit && <button disabled={busy} onClick={()=>save(true)} className="rounded bg-emerald-700 px-3 py-2 text-white disabled:opacity-50">Enviar a Jefatura</button>}</>}
          <button disabled={busy} onClick={()=>{if (!pending.length || window.confirm('¿Cerrar y descartar los cambios pendientes?')) onClose();}} className="rounded border px-3 py-2">Cerrar</button>
        </div>
      </header>
      {error && <div role="alert" className="bg-red-50 p-3 text-sm text-red-800">{error} {!book && <button className="underline" onClick={()=>setReload(n=>n+1)}>Reintentar</button>}</div>}
      {notice && <p role="status" className="bg-emerald-50 px-5 py-2 text-sm text-emerald-800">{notice}</p>}
      {book ? editable ? <>
        <WorksheetGrid key={book.sheet.name} sheet={book.sheet} changes={changes} onChange={change} onImageChange={changeImage} busy={busy}/>
        <div className="flex flex-wrap items-center gap-1 border-t bg-slate-50 px-3 py-1.5">
          {book.sheets.map(name=><button key={name} aria-pressed={name===book.sheet.name} disabled={busy || pending.length>0}
            onClick={()=>{setSheet(name);setNotice('');}} className={'rounded px-3 py-1 text-sm '+(name===book.sheet.name?'bg-white font-bold text-emerald-800 shadow':'text-slate-600')}>{name}</button>)}
          <span role="status" className="ml-auto text-xs text-slate-600">{book.sheet.protected?'Hoja protegida':pending.length?'Guarda para cambiar de hoja.':'Haz clic en una celda para editarla.'}</span>
        </div>
      </> : book.sheet ? <>
        <WorksheetGrid key={book.sheet.name} sheet={book.sheet} readOnly changes={{}} />
        <nav className="flex gap-1 overflow-x-auto border-t bg-white px-3 py-2">{book.sheets.map(name=><button key={name} onClick={()=>setSheet(name)} className="rounded px-3 py-1 text-sm">{name}</button>)}</nav>
      </> : <div className="relative flex-1 overflow-hidden"><iframe title={'Excel · '+data.guide} src={previewUrl(book.webUrl)} className="absolute inset-x-0 top-0 w-full border-0" style={{height:'calc(100% + 32px)'}}/></div> : !error && <p className="p-5 text-sm">Abriendo la guía…</p>}
    </div>
  </div>;
}
