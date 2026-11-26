import React,{useEffect,useState} from 'react';
import GuideViewer from './GuideViewer';

async function call(url,options) {
  const response=await fetch(url,{cache:'no-store',...options});
  const body=await response.json();
  if(!response.ok) throw Error(body.error || 'No se pudo procesar la ruta.');
  return body;
}
const labels={Elaborador:'Elaborador',Revision:'Responsable de revisión',Aprobacion:'Aprobador'};

export function SignaturesPanel() {
  const [items,setItems]=useState([]),[viewer,setViewer]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function refresh(){try{setItems((await call('/api/signatures?list=1')).items);}catch(e){setError(e.message);}}
  useEffect(()=>{refresh();},[]);
  async function sign(item) {
    if(!window.confirm('¿Confirmas tu firma de esta guía?')) return;
    setBusy(true);setError('');
    try {const result=await call('/api/signatures?id='+encodeURIComponent(item.requestId),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sign'})});await refresh();if(result.publicationError)setError('Tu firma se registró. La publicación quedó pendiente: '+result.publicationError);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="mx-auto max-w-6xl"><h2 className="text-2xl font-bold text-slate-800">Firmas pendientes</h2>
    {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-6 overflow-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">Solicitud</th><th>Guía</th><th>Etapa</th><th>Acciones</th></tr></thead>
      <tbody>{items.length?items.map(item=><tr key={item.requestId+item.step} className="border-t"><td className="p-4">{item.requestCode}</td><td>{item.guides?.length ? item.guides.map(g=>g.guide_name).join(', ') : item.guide}</td><td>{labels[item.step] || item.step}</td><td className="flex flex-wrap gap-2 p-3">{item.guides?.length ? item.guides.map(g=><button key={g.id} onClick={()=>setViewer({dbId:item.requestId,guide:g.guide_name,guideId:g.id})} className="rounded border px-3 py-2">Ver {g.guide_name}</button>) : <button onClick={()=>setViewer({dbId:item.requestId,guide:item.guide})} className="rounded border px-3 py-2">Ver guía</button>}<button disabled={busy} onClick={()=>sign(item)} className="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50">Firmar</button></td></tr>):<tr><td colSpan="4" className="p-10 text-center text-slate-500">No tienes firmas pendientes.</td></tr>}</tbody>
    </table></div>
    {viewer && <GuideViewer data={viewer} onClose={()=>setViewer(null)}/>}
  </section>;
}

export function SignatureRoutesPanel({requests}) {
  const [selected,setSelected]=useState(null),[options,setOptions]=useState(null),[reviewers,setReviewers]=useState([]),[approvers,setApprovers]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[viewer,setViewer]=useState(null);
  const rows=requests.filter(item=>item.stage==='APROBADA_TECNICA');
  async function open(item) {
    setSelected(item);setOptions(null);setReviewers([]);setApprovers([]);setError('');
    try{setOptions(await call('/api/signatures?id='+encodeURIComponent(item.dbId)+'&options=1'));}catch(e){setError(e.message);}
  }
  function toggle(value,values,setValues){setValues(values.includes(value)?values.filter(v=>v!==value):[...values,value]);}
  async function start() {
    setBusy(true);setError('');
    try {await call('/api/signatures?id='+encodeURIComponent(selected.dbId),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',reviewers,approvers})});setOptions(await call('/api/signatures?id='+encodeURIComponent(selected.dbId)+'&options=1'));}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function publish() {
    setBusy(true);setError('');
    try {await call('/api/signatures?id='+encodeURIComponent(selected.dbId),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'publish'})});setOptions(await call('/api/signatures?id='+encodeURIComponent(selected.dbId)+'&options=1'));}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="mx-auto max-w-6xl"><h2 className="text-2xl font-bold text-slate-800">Rutas de firma</h2>
    <div className="mt-6 overflow-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">Solicitud</th><th>Guía</th><th>Acciones</th></tr></thead>
      <tbody>{rows.length?rows.map(item=><tr key={item.id} className="border-t"><td className="p-4">{item.id}</td><td>{item.guides?.length ? item.guides.map(g=>g.guide_name).join(', ') : item.guide}</td><td><div className="flex flex-wrap gap-2 py-2"><button onClick={()=>open(item)} className="rounded bg-blue-700 px-3 py-2 text-white">Ruta de firma</button>{item.guides?.length ? item.guides.map(g=><button key={g.id} onClick={()=>setViewer({...item,guide:g.guide_name,guideId:g.id})} className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700 hover:bg-blue-100">Ver {g.guide_name}</button>) : <button onClick={()=>setViewer(item)} className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700 hover:bg-blue-100">Ver guía y firmas</button>}</div></td></tr>):<tr><td colSpan="3" className="p-10 text-center text-slate-500">No hay guías aprobadas para firma.</td></tr>}</tbody></table></div>
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6">
      <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">Ruta de firma · {selected.guide}</h3><button onClick={()=>setSelected(null)} className="rounded border px-3 py-2">Cerrar</button></div>
      {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!options && !error && <p className="mt-4 text-sm">Cargando participantes…</p>}
      {options && <><p className="mt-4 text-sm"><strong>Elaborador:</strong> {options.requester || 'No se encontró el solicitante registrado.'}</p>{options.guides?.length>0 && <div className="mt-4 space-y-1"><p className="font-semibold">Guías del combo</p>{options.guides.map(g=><p key={g.id} className="text-sm">{g.guide_name} · {g.publication_state==='Publicada'?'Publicada':'Pendiente de publicación'}</p>)}</div>}
      {options.route ? <div className="mt-4"><p className="font-semibold">Etapa actual: {labels[options.route.step] || options.route.step}</p><ul className="mt-3 space-y-2 text-sm">{options.route.guide_signature_members.map(member=><li key={member.email+member.step} className="rounded border p-3">{labels[member.step]} · {member.display_name} · {member.signed_at?'Firmado':'Pendiente'}</li>)}</ul>{options.route.step==='Lista para publicar' && <button disabled={busy} onClick={publish} className="mt-4 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">Reintentar publicación</button>}</div> : <>
      {[[ 'Responsables de revisión', options.participants.filter(p=>p.can_review),reviewers,setReviewers ],['Aprobadores',options.participants.filter(p=>p.can_approve),approvers,setApprovers]].map(([title,people,values,setValues])=><fieldset key={title} className="mt-5 rounded border p-4"><legend className="px-1 font-semibold">{title}</legend>{people.length?people.map(person=><label key={person.email} className="flex gap-2 py-1 text-sm"><input type="checkbox" checked={values.includes(person.email)} onChange={()=>toggle(person.email,values,setValues)}/>{person.display_name} · {person.email}</label>):<p className="text-sm text-slate-500">No hay participantes habilitados para esta etapa.</p>}</fieldset>)}
      <button disabled={busy || !options.requester || !reviewers.length || !approvers.length} onClick={start} className="mt-5 rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Iniciar ruta</button></>}</>}
    </div></div>}
    {viewer && <GuideViewer data={viewer} onClose={()=>setViewer(null)}/>}
  </section>;
}
