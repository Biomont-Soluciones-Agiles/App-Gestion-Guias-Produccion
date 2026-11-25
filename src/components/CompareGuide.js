import React,{useEffect,useState} from 'react';
import WorksheetGrid from './WorksheetGrid';

function compare(before,after){
  const oldCells=new Map(before.cells.map(c=>[c.address,c]));
  const newCells=new Map(after.cells.map(c=>[c.address,c]));
  const oldMarks={},newMarks={};
  for(const address of new Set([...oldCells.keys(),...newCells.keys()])){
    const a=oldCells.get(address),b=newCells.get(address);
    const oldValue=a?.value || '',newValue=b?.value || '';
    if(oldValue===newValue && !!a?.numeric===!!b?.numeric) continue;
    if(oldValue && !newValue) oldMarks[address]='removed';
    else newMarks[address]='changed';
  }
  return [oldMarks,newMarks];
}
export default function CompareGuide({data,onClose}){
  const [sheet,setSheet]=useState('');
  const [result,setResult]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    const abort=new AbortController();
    setResult(null);setError('');
    const params=new URLSearchParams({id:data.dbId,compare:'1',sheet});
    fetch('/api/workbook?'+params,{signal:abort.signal,cache:'no-store'})
      .then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error);return body;})
      .then(setResult).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return ()=>abort.abort();
  },[data.dbId,sheet]);
  const [oldMarks,newMarks]=result?compare(result.before,result.after):[{},{}];
  return <div className="fixed inset-0 z-[60] flex flex-col bg-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-3"><div><h2 className="text-lg font-bold">Comparar versiones</h2><p className="text-sm text-slate-600">{data.guide}</p></div><button className="rounded border px-4 py-2" onClick={onClose}>Cerrar</button></header>
    <div className="flex flex-wrap gap-4 bg-white px-5 py-2 text-sm"><span>🟨 Modificado o agregado</span><span>❌ Eliminado</span></div>
    {error?<p role="alert" className="m-5 rounded bg-red-50 p-4 text-red-800">{error}</p>:!result?<p className="p-5">Cargando versiones...</p>:<>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-2">
        {[['Versión anterior',result.before,oldMarks],['Nueva versión',result.after,newMarks]].map(([title,view,marks])=><section key={title} className="flex min-h-0 flex-col overflow-hidden rounded border bg-white"><h3 className="bg-slate-800 px-4 py-2 font-semibold text-white">{title}</h3><WorksheetGrid key={title+view.name} sheet={view} readOnly changes={{}} marks={marks}/></section>)}
      </div>
      <nav className="flex gap-1 overflow-x-auto bg-white px-3 py-2">{result.sheets.map(name=><button key={name} onClick={()=>setSheet(name)} className={'rounded px-3 py-1 text-sm '+(name===result.after.name?'bg-blue-100 font-semibold text-blue-800':'text-slate-600')}>{name}</button>)}</nav>
    </>}
  </div>;
}
