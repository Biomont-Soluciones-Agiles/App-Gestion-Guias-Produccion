import React,{useEffect,useState} from 'react';
import {Search} from 'lucide-react';

async function request(url,options) {
  const response=await fetch(url,{cache:'no-store',...options});
  const data=await response.json();
  if(!response.ok) throw Error(data.error || 'No se pudo procesar la solicitud.');
  return data;
}
export default function FunctionalSettings() {
  const [tab,setTab]=useState('licencias');
  const [rows,setRows]=useState([]);
  const [query,setQuery]=useState('');
  const [users,setUsers]=useState([]);
  const [selected,setSelected]=useState(null);
  const [license,setLicense]=useState('Emisor');
  const [review,setReview]=useState(false);
  const [approve,setApprove]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function refresh() {
    try {setRows(await request('/api/configuration'));} catch(e){setError(e.message);}
  }
  useEffect(()=>{refresh();},[]);
  useEffect(()=>{
    if(query.trim().length<2 || selected) {setUsers([]);return;}
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      request('/api/configuration?directory=1&search='+encodeURIComponent(query),{signal:controller.signal})
        .then(result=>setUsers(result.users)).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    },300);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[query,selected]);
  async function save(event) {
    event.preventDefault();
    if(!selected)return;
    setBusy(true);setError('');
    try {
      await request('/api/configuration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:selected.id,license,review,approve})});
      setSelected(null);setQuery('');setReview(false);setApprove(false);
      await refresh();
    } catch(e){setError(e.message);} finally{setBusy(false);}
  }
  async function saveFlow(row) {
    setBusy(true);setError('');setMessage('');
    try {
      await request('/api/configuration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'flow',email:row.email,review:row.can_review,approve:row.can_approve})});
      setMessage('Flujo actualizado.');
      await refresh();
    } catch(e){setError(e.message);} finally{setBusy(false);}
  }
  return <section className="mx-auto max-w-5xl">
    <h2 className="text-2xl font-bold text-slate-800">Configuración funcional</h2>
    <div className="mt-5 flex gap-2 border-b border-slate-200">{[['licencias','Licencias'],['flujos','Flujos']].map(([value,label])=><button key={value} onClick={()=>setTab(value)} className={'px-4 py-3 text-sm font-semibold '+(tab===value?'border-b-2 border-blue-700 text-blue-700':'text-slate-600')}>{label}</button>)}</div>
    {message && <p role="status" className="mt-4 rounded bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {tab==='licencias' ? <>
      <form onSubmit={save} className="mt-6 rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold">Asignar licencia</h3>
        <label className="mt-4 block text-sm font-semibold">Buscar usuario de Biomont</label>
        <div className="relative mt-1"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);}} placeholder="Nombre o correo" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"/></div>
        {users.length>0 && <div className="max-h-48 overflow-auto rounded border bg-white">{users.map(person=><button key={person.id} type="button" onClick={()=>{setSelected(person);setQuery(person.displayName+' · '+(person.mail||person.userPrincipalName));setUsers([]);}} className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-blue-50">{person.displayName} · {person.mail||person.userPrincipalName}</button>)}</div>}
        <label className="mt-4 block text-sm font-semibold">Licencia<select value={license} onChange={e=>{setLicense(e.target.value);setReview(false);setApprove(false);}} className="mt-1 block rounded-lg border border-slate-300 p-2 text-sm"><option>Emisor</option><option>Participante</option></select></label>
        {license==='Participante' && <div className="mt-4 flex gap-5 text-sm"><label><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)}/> Responsable de revisión</label><label><input type="checkbox" checked={approve} onChange={e=>setApprove(e.target.checked)}/> Aprobador</label></div>}
        <button disabled={!selected || busy} className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?'Guardando…':'Guardar'}</button>
      </form>
      <h3 className="mt-7 font-bold">Licencias asignadas</h3>
      <div className="mt-3 overflow-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Usuario</th><th>Correo</th><th>Licencia</th></tr></thead><tbody>{rows.map(row=><tr key={row.email} className="border-t"><td className="p-3">{row.display_name}</td><td>{row.email}</td><td>{row.license_type}</td></tr>)}</tbody></table></div>
    </> : <><h3 className="mt-6 font-bold">Participantes habilitados</h3><p className="mt-1 text-sm text-slate-500">Selecciona los pasos en los que cada participante puede intervenir.</p><div className="mt-4 overflow-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Usuario</th><th>Responsable de revisión</th><th>Aprobador</th><th></th></tr></thead><tbody>{rows.filter(r=>r.license_type==='Participante').map(row=><tr key={row.email} className="border-t"><td className="p-3">{row.display_name}</td><td><input aria-label={'Responsable de revisión para '+row.display_name} type="checkbox" checked={row.can_review} onChange={e=>setRows(current=>current.map(item=>item.email===row.email?{...item,can_review:e.target.checked}:item))}/></td><td><input aria-label={'Aprobador para '+row.display_name} type="checkbox" checked={row.can_approve} onChange={e=>setRows(current=>current.map(item=>item.email===row.email?{...item,can_approve:e.target.checked}:item))}/></td><td className="p-3"><button type="button" disabled={busy} onClick={()=>saveFlow(row)} className="rounded bg-blue-700 px-3 py-1.5 text-white disabled:opacity-50">Guardar</button></td></tr>)}</tbody></table></div></>}
  </section>;
}
