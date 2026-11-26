import React, { useEffect, useState } from 'react';
import { Plus, Eye, XCircle, FileEdit } from 'lucide-react';
import StatusBadge, { SignatureStatus } from './StatusBadge';
import FilterBar, { useFilters } from './FilterBar';
import GuideViewer from './GuideViewer';

export default function ApplicantPanel({ view, requests, setRequests, updateRequest, onWorkbookSaved, onCreate, user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewModalData, setViewModalData] = useState(null);
  const [editingGuide, setEditingGuide] = useState(null);
  const [viewingGuide, setViewingGuide] = useState(null);
  const isHistory = view === 'history';
  const isFinished = req => ['RECHAZADA_ASC_INICIAL', 'CANCELADA', 'APROBADA_TECNICA'].includes(req.stage);
  const canEdit = req => !(req.type==='Guía temporal' && req.requiresModifications===false) && ['EN_EDICION', 'OBSERVADA_JEFATURA', 'OBSERVADA_ASC_TECNICA'].includes(req.stage) && (user.role === 'Administrador' || (req.history?.find(event => event.event_type === 'Solicitud creada')?.note || 'molin@biomont.com.pe') === user.email);
  const visibleRequests = requests.filter(req => isHistory ? isFinished(req) : !isFinished(req));
  const { filters, setFilters, filtered } = useFilters(visibleRequests);

  const handleSubmit = async (newReq) => {
    const request = {
      ...newReq,
      sharepointItemId: newReq.id,
      id: `REQ-00${requests.length + 1}`,
      date: new Date().toISOString().split('T')[0],
      status: 'Pendiente',
      stage: 'PENDIENTE_ASC_INICIAL',
      history: [{ actor: 'Responsable', action: 'Solicitud creada', date: new Date().toISOString().split('T')[0] }]
    };
    try { if (onCreate) await onCreate(request); else setRequests([request, ...requests]); setIsModalOpen(false); } catch (error) { window.alert(error.message || 'No se pudo guardar la solicitud.'); }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">{isHistory ? 'Historial' : 'Mis solicitudes'}</h2>
          <p className="text-slate-500 text-sm">{isHistory ? 'Solicitudes aprobadas técnicamente, rechazadas o canceladas.' : 'Consulta el estado de tus solicitudes y edita las guías disponibles.'}</p>
        </div>
        {!isHistory && <button onClick={() => setIsModalOpen(true)} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition-colors"><Plus size={16} /> Nueva Solicitud</button>}
      </div>
      <FilterBar filters={filters} setFilters={setFilters} rows={visibleRequests} />
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Guía</th>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan="6" className="px-6 py-14 text-center"><p className="text-sm font-semibold text-slate-600">{isHistory ? 'No hay solicitudes en el historial.' : 'No hay solicitudes en curso.'}</p></td></tr>
            ) : filtered.map(req => (
              <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">{req.id}</td>
                <td className="px-6 py-4">{req.guide}</td>
                <td className="px-6 py-4">{req.date}</td>
                <td className="px-6 py-4">
                  <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">{req.type}</span>
                </td>
                <td className="px-6 py-4"><div className="flex flex-col items-start gap-1"><StatusBadge status={req.stage} />{isHistory && req.stage==='APROBADA_TECNICA' && <SignatureStatus step={req.signatureStep}/>}</div></td>
                <td className="px-6 py-4 text-center">
                  <button onClick={() => setViewModalData(req)} className="text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 text-xs font-medium mx-auto bg-blue-50 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors">
                    <Eye size={14} /> Ver
                  </button>
                  {!isHistory && canEdit(req) && <button onClick={() => req.guides?.length ? setViewModalData(req) : setEditingGuide(req)} className="mt-2 mx-auto flex items-center justify-center gap-1 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"><FileEdit size={14} /> {req.guides?.length?'Editar guías':'Editar guía'}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && <NewRequestModal onClose={() => setIsModalOpen(false)} onSubmit={handleSubmit} />}
      {viewModalData && <ViewRequestModal data={viewModalData} editable={canEdit(viewModalData)} onClose={() => setViewModalData(null)} onView={setViewingGuide} onEdit={(request) => { setViewModalData(null); setEditingGuide(request); }} onSend={async request=>{if(await updateRequest(request.id,'PENDIENTE_JEFATURA','Responsable','Combo enviado a revisión de Jefatura'))setViewModalData(null);}} />}
      {viewingGuide && <GuideViewer data={viewingGuide} onClose={() => setViewingGuide(null)} />}
      {editingGuide && <GuideViewer editable data={editingGuide} onClose={() => setEditingGuide(null)}
        onSaved={itemId => onWorkbookSaved(editingGuide.id, itemId)}
        onSubmit={editingGuide.guideId ? undefined : async itemId => {
          const ok = await updateRequest(editingGuide.id, 'PENDIENTE_JEFATURA', 'Responsable', 'Nueva versión enviada a revisión de Jefatura', '', itemId);
          if (ok) setEditingGuide(null);
        }} />}
    </div>
  );
}

export function NewRequestModal({ onClose, onSubmit, assigning=false }) {
  const [formData, setFormData] = useState({ productIndex: '', guide: '', area: '', type: '', requiresModifications: '', reason: '', justification: '' });
  const [search, setSearch] = useState('');
  const [selectedGuides, setSelectedGuides] = useState([]);
  const [products, setProducts] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState('loading');
  const [catalogError, setCatalogError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [emitters,setEmitters]=useState([]);
  const [emitter,setEmitter]=useState('');
  const [emitterError,setEmitterError]=useState('');
  const [submitting,setSubmitting]=useState(false);
  useEffect(()=>{
    if(!assigning) return;
    const controller=new AbortController();
    fetch('/api/requests?emitters=1',{signal:controller.signal,cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('No se pudo cargar la lista de emisores.');return response.json();}).then(setEmitters).catch(error=>{if(error.name!=='AbortError')setEmitterError(error.message);});
    return ()=>controller.abort();
  },[assigning]);
  const catalogSource=formData.type==='Guía temporal' && formData.requiresModifications==='no' ? 'temporary' : 'standard';
  useEffect(() => {
    const controller = new AbortController();
    setCatalogStatus('loading');
    setCatalogError('');
    fetch('/api/sharepoint?source='+catalogSource, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const body=await response.json(); if (!response.ok) throw new Error(body.error || 'No se pudo consultar el catálogo.'); return body; })
      .then(data => { if (!Array.isArray(data.guides)) throw new Error('Respuesta inválida.'); setProducts(data.guides.map(item => ({ ...item, line: item.line || '', product: item.product || item.name.replace(/\.xlsx$/i, ''), phase: item.phase || '', classification: item.classification || '' }))); setCatalogStatus('ready'); })
      .catch(error => { if (error.name !== 'AbortError') {setCatalogError(error.message);setCatalogStatus('error');} });
    return () => controller.abort();
  }, [attempt,catalogSource]);
  const selectedProduct = formData.productIndex === '' ? null : products[Number(formData.productIndex)];
  const selectProduct = (index) => {
    const selected = products[Number(index)];
    if (!selected || selectedGuides.some(item => item.id === selected.id)) return;
    const next = [...selectedGuides, selected];
    setSelectedGuides(next);
    setSearch('');
    setFormData({ ...formData, productIndex: String(products.indexOf(next[0])), guide: next[0].name });
  };
  const removeProduct = id => {
    const next = selectedGuides.filter(item => item.id !== id);
    setSelectedGuides(next);
    setFormData({ ...formData, productIndex: next.length ? String(products.indexOf(next[0])) : '', guide: next[0]?.name || '' });
  };
  const filteredProducts = products.filter((item) => `${item.name} ${item.line} ${item.product} ${item.phase} ${item.batch ?? ""}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div><h3 className="text-[22px] font-bold leading-tight text-slate-900">{assigning?'Asignar guía':'Nueva solicitud de guía'}</h3><p className="mt-1 text-sm text-slate-500">{assigning?'Selecciona las guías y el usuario responsable.':'Complete los datos para iniciar el flujo de solicitud.'}</p></div>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"><XCircle size={22} /></button>
        </header>
        <form id="new-req-form" className="space-y-7 overflow-y-auto px-6 py-7" onSubmit={async event => { event.preventDefault(); if (submitting || !formData.guide || !selectedProduct || !formData.type || (formData.type==='Guía temporal' && !formData.requiresModifications) || (assigning && !emitter)) return; setSubmitting(true); try {await onSubmit({ ...selectedProduct, ...formData, guides:selectedGuides, emitter });} finally {setSubmitting(false);} }}>
          {assigning && <div><label htmlFor="assigned-emitter" className="mb-2 block text-sm font-semibold text-slate-700">Usuario emisor <span className="text-red-600">*</span></label><select id="assigned-emitter" required value={emitter} onChange={event=>setEmitter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm"><option value="">Selecciona un emisor...</option>{emitters.map(person=><option key={person.email} value={person.email}>{person.display_name} · {person.email}</option>)}</select>{emitterError && <p role="alert" className="mt-2 text-sm text-red-700">{emitterError}</p>}{!emitterError && !emitters.length && <p className="mt-2 text-xs text-slate-500">No hay emisores activos disponibles o la lista está cargando.</p>}</div>}
          <fieldset><legend className="mb-3 text-sm font-semibold text-slate-700">Tipo de guía <span className="text-red-600">*</span></legend><div className="flex flex-wrap gap-x-7 gap-y-3">{['Guía monitorizada','Producto nuevo','Guía oficial','Guía temporal'].map(type=><label key={type} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"><input required name="guide-type" type="radio" className="h-4 w-4 accent-blue-600" checked={formData.type===type} onChange={()=>{setSelectedGuides([]);setSearch('');setFormData({...formData,type,requiresModifications:'',guide:'',productIndex:''});}}/>{type}</label>)}</div></fieldset>
          {['Guía monitorizada','Producto nuevo'].includes(formData.type) && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">El flujo para este tipo de guía está pendiente de definición.</p>}
          {formData.type==='Guía temporal' && <fieldset><legend className="mb-3 text-sm font-semibold text-slate-700">¿Requiere modificaciones? <span className="text-red-600">*</span></legend><div className="flex gap-6">{[['si','Sí'],['no','No']].map(([value,label])=><label key={value} className="flex items-center gap-2 text-sm text-slate-600"><input required name="temporary-modifications" type="radio" className="h-4 w-4 accent-blue-600" checked={formData.requiresModifications===value} onChange={()=>{setSelectedGuides([]);setSearch('');setFormData({...formData,requiresModifications:value,guide:'',productIndex:''});}}/>{label}</label>)}</div></fieldset>}
          {catalogStatus === 'loading' && <p role="status" className="text-sm text-slate-500">Cargando guías de SharePoint...</p>}
          {catalogStatus === 'error' && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{catalogError || 'No se pudo cargar el catálogo de SharePoint.'} <button type="button" className="font-semibold underline" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
          {catalogStatus === 'ready' && products.length === 0 && <p role="status" className="text-sm text-slate-500">No hay archivos Excel disponibles en la biblioteca de SharePoint.</p>}
          <div><label htmlFor="combo-search" className="mb-2 block text-sm font-semibold text-slate-700">{catalogSource==='temporary'?'Buscar producto':'Buscar guías'} <span className="text-red-600">*</span></label><input id="combo-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Escriba línea, producto o fase..." className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm" />
            {catalogSource==='temporary' ? <div className="mt-3"><label htmlFor="temporary-batch" className="mb-2 block text-sm font-semibold text-slate-700">Guía temporal y tamaño de lote</label><select id="temporary-batch" value="" disabled={!search.trim() || catalogStatus!=='ready'} onChange={event=>{if(event.target.value)selectProduct(Number(event.target.value));}} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm"><option value="">{search.trim()?'Selecciona una guía y lote...':'Busca primero el producto...'}</option>{filteredProducts.filter(item=>!selectedGuides.some(selected=>selected.id===item.id)).map(item=><option key={item.id} value={products.indexOf(item)}>{item.name} · {item.phase || 'Sin fase'} · Lote: {item.batch ?? 'No especificado'} {item.batchUnit || ''}</option>)}</select></div> : search && <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">{filteredProducts.filter(item=>!selectedGuides.some(selected=>selected.id===item.id)).map(item=><button type="button" key={item.id} onClick={()=>selectProduct(products.indexOf(item))} className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-blue-50"><strong>{item.product}</strong><span className="ml-2 text-slate-500">{[item.name,item.line,item.phase].filter(Boolean).join(' · ')}</span></button>)}</div>}
            <p className="mt-2 text-xs text-slate-500">Selecciona una o varias guías para la solicitud.</p></div>
          <div className="space-y-3" aria-label="Guías seleccionadas">
            <p className="text-sm font-semibold text-slate-700">Guías seleccionadas</p>
            {selectedGuides.length === 0 ? <p className="text-sm text-slate-500">Selecciona una guía para ver su línea, producto y fase.</p> : selectedGuides.map(item => <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><p className="break-words text-sm font-semibold text-slate-800">{item.name}</p><button type="button" onClick={() => removeProduct(item.id)} aria-label={'Quitar ' + item.name} className="shrink-0 text-sm font-semibold text-red-700 hover:text-red-800">Quitar</button></div>
              <dl className="grid gap-3 sm:grid-cols-3">{[['Línea', item.line], ['Producto', item.product], ['Fase', item.phase], ...(catalogSource==='temporary' ? [['Tamaño de lote', item.batch == null ? '' : String(item.batch)+(item.batchUnit?' '+item.batchUnit:'')]] : [])].map(([label, value]) => <div key={label}><dt className="mb-1 text-xs font-semibold text-slate-500">{label}</dt><dd className="break-words text-sm text-slate-800">{value || 'No especificado en SharePoint'}</dd></div>)}</dl>
            </div>)}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div><label className="mb-2 block text-sm font-semibold text-slate-700">Área Solicitante <span className="text-red-600">*</span></label><select required className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={formData.area} onChange={(event) => setFormData({ ...formData, area: event.target.value })}><option value="">Seleccione un área...</option><option value="Acondicionado">Acondicionado</option><option value="Desarrollo Farmacéutico - DF">Desarrollo Farmacéutico - DF</option><option value="Planta">Planta</option><option value="Validación - VOT">Validación - VOT</option></select></div>
            <div><label className="mb-2 block text-sm font-semibold text-slate-700">Motivo de la Solicitud <span className="text-red-600">*</span></label><select required className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={formData.reason} onChange={(event) => setFormData({ ...formData, reason: event.target.value })}><option value="">Seleccione un motivo...</option><option value="CAPA">CAPA</option><option value="Control de Cambios - CC">Control de Cambios - CC</option><option value="Ajustes Menores">Ajustes Menores</option><option value="Referencia de creación">Referencia de creación</option></select></div>
          </div>
          <div><label className="mb-2 block text-sm font-semibold text-slate-700">Justificación detallada <span className="text-red-600">*</span></label><textarea required rows="4" placeholder="Explique brevemente el porqué de la solicitud..." className="w-full resize-none rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={formData.justification} onChange={(event) => setFormData({ ...formData, justification: event.target.value })} /></div>
        </form>
        <footer className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4"><button type="button" disabled={submitting} onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button><button type="submit" form="new-req-form" disabled={submitting || ['Guía monitorizada','Producto nuevo'].includes(formData.type)} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">{submitting?'Guardando...':assigning?'Asignar':'Enviar Solicitud'}</button></footer>
      </div>
    </div>
  );
}

function ViewRequestModal({ data, editable, onClose, onEdit, onView, onSend }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">Detalles de Solicitud {data.id}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex justify-between items-start">
            <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Estado</p><StatusBadge status={data.stage} /></div>
            <div className="text-right"><p className="text-xs text-slate-500 uppercase font-bold mb-1">Fecha</p><p className="text-sm font-medium">{data.date}</p></div>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
            <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Guía Solicitada</p><p className="text-sm font-medium">{data.guide}</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Área</p><p className="text-sm">{data.area}</p></div>
              <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Motivo</p><p className="text-sm">{data.reason}</p></div>
              {data.type==='Guía temporal' && <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">¿Requiere modificaciones?</p><p className="text-sm">{data.requiresModifications===true?'Sí':data.requiresModifications===false?'No':'No especificado'}</p></div>}
            </div>
            <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Justificación</p><p className="text-sm bg-white p-3 border rounded">{data.justification}</p></div>
          </div>
          {data.stage==='TEMPORAL_COMPARTIDA' && !data.guides?.length && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="mb-3 text-sm text-emerald-800">Guía temporal compartida para consulta.</p><button onClick={()=>onView(data)} className="w-full rounded bg-blue-700 py-2 text-sm font-medium text-white">Ver guía temporal</button></div>}
          {data.guides?.length>0 && <div className="space-y-2"><p className="text-sm font-bold">Guías del combo</p>{data.guides.map(guide=><div key={guide.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"><span>{guide.guide_name} · {guide.production_phase}</span><div className="flex gap-2"><button onClick={()=>onView({...data,guide:guide.guide_name,guideId:guide.id})} className="rounded border px-2 py-1">Ver</button>{editable && <button onClick={()=>onEdit({...data,guide:guide.guide_name,guideId:guide.id})} className="rounded bg-blue-700 px-2 py-1 text-white">Editar</button>}</div></div>)}{editable && <button onClick={()=>onSend(data)} className="w-full rounded bg-emerald-700 p-2 text-sm text-white">Enviar combo a Jefatura</button>}</div>}
          {editable && !data.guides?.length && (
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4">
              <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2"><FileEdit size={16} /> Editable disponible</h4>
              <p className="mb-3 text-xs text-emerald-800">Edita la guía y envía la versión guardada a Jefatura.</p>
              <button onClick={() => onView(data)} className="mb-2 w-full bg-blue-700 text-white py-2 rounded text-sm font-medium flex items-center justify-center gap-2"><Eye size={16} /> Ver Excel</button>
              <button onClick={() => onEdit(data)} className="w-full bg-emerald-600 text-white py-2 rounded text-sm font-medium flex items-center justify-center gap-2"><FileEdit size={16} /> Editar guía</button>
            </div>
          )}
          {data.status === 'Rechazado' && data.rejectReason && (
            <div className="border border-red-200 bg-red-50 rounded-lg p-4"><h4 className="text-sm font-bold text-red-800 mb-1">Motivo de Rechazo</h4><p className="text-sm text-red-700">{data.rejectReason}</p></div>
          )}
        </div>
        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 bg-white border rounded">Cerrar</button></div>
      </div>
    </div>
  );
}
