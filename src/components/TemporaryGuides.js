import React,{useEffect,useState} from 'react';

export default function TemporaryGuides() {
  const [guides,setGuides]=useState([]),[search,setSearch]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState('');
  async function refresh() {
    try {const response=await fetch('/api/sharepoint?source=temporary&includeInactive=1',{cache:'no-store'}),body=await response.json();if(!response.ok)throw Error(body.error || 'No se pudo consultar la biblioteca.');setGuides(body.guides || []);}
    catch(error){setError(error.message);}
  }
  useEffect(()=>{refresh();},[]);
  async function toggle(guide) {
    const status=guide.temporaryStatus==='Habilitado'?'Inhabilitado':'Habilitado';
    if(!window.confirm(`${status==='Inhabilitado'?'¿Inhabilitar':'¿Habilitar'} la guía ${guide.name}?`)) return;
    setBusy(guide.id);setError('');
    try {const response=await fetch('/api/temporaries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:guide.id,status})}),body=await response.json();if(!response.ok)throw Error(body.error);await refresh();}
    catch(error){setError(error.message || 'No se pudo cambiar el estado.');}finally{setBusy('');}
  }
  const normalized=search.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const rows=guides.filter(guide=>`${guide.name} ${guide.product || ''} ${guide.phase || ''} ${guide.batch ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(normalized));
  return <section className="mx-auto max-w-6xl"><h2 className="text-2xl font-bold text-slate-800">Guías temporales</h2><p className="mt-1 text-sm text-slate-500">Administra las guías temporales disponibles para solicitar.</p>
    {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar producto, guía o lote" aria-label="Buscar guía temporal" className="my-5 rounded-lg border px-3 py-2 text-sm"/>
    <div className="overflow-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">Guía</th><th>Producto</th><th>Fase</th><th>Tamaño de lote</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{rows.length?rows.map(guide=><tr key={guide.id} className="border-t"><td className="p-4">{guide.name}</td><td>{guide.product || '—'}</td><td>{guide.phase || '—'}</td><td>{guide.batch ?? 'No especificado'}</td><td>{guide.temporaryStatus || 'Sin estado'}</td><td><button disabled={!!busy} onClick={()=>toggle(guide)} className="rounded border px-3 py-2 text-blue-700 disabled:opacity-50">{guide.temporaryStatus==='Habilitado'?'Inhabilitar':'Habilitar'}</button></td></tr>):<tr><td colSpan="6" className="p-10 text-center text-slate-500">No hay guías temporales para mostrar.</td></tr>}</tbody></table></div>
  </section>;
}
