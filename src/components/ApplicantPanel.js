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
  const canEdit = req => ['EN_EDICION', 'OBSERVADA_JEFATURA', 'OBSERVADA_ASC_TECNICA'].includes(req.stage) && (user.role === 'Administrador' || (req.history?.find(event => event.event_type === 'Solicitud creada')?.note || 'molin@biomont.com.pe') === user.email);
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
                  {!isHistory && canEdit(req) && <button onClick={() => setEditingGuide(req)} className="mt-2 mx-auto flex items-center justify-center gap-1 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"><FileEdit size={14} /> Editar guía</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && <NewRequestModal onClose={() => setIsModalOpen(false)} onSubmit={handleSubmit} />}
      {viewModalData && <ViewRequestModal data={viewModalData} editable={canEdit(viewModalData)} onClose={() => setViewModalData(null)} onView={setViewingGuide} onEdit={(request) => { setViewModalData(null); setEditingGuide(request); }} />}
      {viewingGuide && <GuideViewer data={viewingGuide} onClose={() => setViewingGuide(null)} />}
      {editingGuide && <GuideViewer editable data={editingGuide} onClose={() => setEditingGuide(null)}
        onSaved={itemId => onWorkbookSaved(editingGuide.id, itemId)}
        onSubmit={async itemId => {
          const ok = await updateRequest(editingGuide.id, 'PENDIENTE_JEFATURA', 'Responsable', 'Nueva versión enviada a revisión de Jefatura', '', itemId);
          if (ok) setEditingGuide(null);
        }} />}
    </div>
  );
}

function NewRequestModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({ productIndex: '', guide: '', area: '', type: 'Última versión de la guía', reason: '', justification: '' });
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setCatalogStatus('loading');
    fetch('/api/sharepoint', { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('No se pudo consultar el catálogo.'); return response.json(); })
      .then(data => { if (!Array.isArray(data.guides)) throw new Error('Respuesta inválida.'); setProducts(data.guides.map(item => ({ ...item, line: item.line || '', product: item.product || item.name.replace(/\.xlsx$/i, ''), phase: item.phase || '', classification: item.classification || '' }))); setCatalogStatus('ready'); })
      .catch(error => { if (error.name !== 'AbortError') setCatalogStatus('error'); });
    return () => controller.abort();
  }, [attempt]);
  const selectedProduct = formData.productIndex === '' ? null : products[Number(formData.productIndex)];
  const selectProduct = (index) => {
    const selected = products[Number(index)];
    setSearch(selected ? selected.product : '');
    setFormData({ ...formData, productIndex: index, guide: selected ? selected.name : '' });
  };
  const filteredProducts = products.filter((item) => `${item.name} ${item.line} ${item.product} ${item.phase}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div><h3 className="text-[22px] font-bold leading-tight text-slate-900">Nueva Solicitud de Editable</h3><p className="mt-1 text-sm text-slate-500">Complete los datos para iniciar el flujo de solicitud.</p></div>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"><XCircle size={22} /></button>
        </header>
        <form id="new-req-form" className="space-y-7 overflow-y-auto px-6 py-7" onSubmit={(event) => { event.preventDefault(); if (!formData.guide || !selectedProduct) return; onSubmit({ ...selectedProduct, ...formData }); }}>
          {catalogStatus === 'loading' && <p role="status" className="text-sm text-slate-500">Cargando guías de SharePoint...</p>}
          {catalogStatus === 'error' && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">No se pudo cargar el catálogo de SharePoint. <button type="button" className="font-semibold underline" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
          {catalogStatus === 'ready' && products.length === 0 && <p role="status" className="text-sm text-slate-500">No hay archivos Excel disponibles en la biblioteca de SharePoint.</p>}
          <div><label className="mb-2 block text-sm font-semibold text-slate-700">Buscar producto de la guía <span className="text-red-600">*</span></label><input required value={search} onChange={(event) => { setSearch(event.target.value); setFormData({ ...formData, productIndex: '', guide: '' }); }} placeholder="Escriba línea, producto o fase..." className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />{!selectedProduct && search && <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">{filteredProducts.map((item) => { const index = products.indexOf(item); return <button type="button" key={item.id} onClick={() => selectProduct(index)} className="block w-full border-b border-slate-100 px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-blue-50"><strong>{item.product}</strong><span className="ml-2 text-xs text-slate-500">{[item.name, item.line, item.phase, item.classification].filter(Boolean).join(" · ")}</span></button>; })}{filteredProducts.length === 0 && <p className="px-3.5 py-3 text-sm text-slate-500">No se encontraron productos.</p>}</div>}{selectedProduct && <p className="mt-2 text-xs text-slate-500">Guía: {formData.guide}</p>}</div>
          <div className="grid gap-4 sm:grid-cols-3"><div><label className="mb-2 block text-sm font-semibold text-slate-700">Línea</label><input readOnly value={selectedProduct?.line || ''} placeholder="Automático" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600" /></div><div><label className="mb-2 block text-sm font-semibold text-slate-700">Producto</label><input readOnly value={selectedProduct?.product || ''} placeholder="Automático" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600" /></div><div><label className="mb-2 block text-sm font-semibold text-slate-700">Fase</label><input readOnly value={selectedProduct?.phase || ''} placeholder="Automático" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600" /></div></div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div><label className="mb-2 block text-sm font-semibold text-slate-700">Área Solicitante <span className="text-red-600">*</span></label><select required className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={formData.area} onChange={(event) => setFormData({ ...formData, area: event.target.value })}><option value="">Seleccione un área...</option><option value="Acondicionado">Acondicionado</option><option value="Desarrollo Farmacéutico - DF">Desarrollo Farmacéutico - DF</option><option value="Planta">Planta</option><option value="Validación - VOT">Validación - VOT</option></select></div>
            <div><label className="mb-2 block text-sm font-semibold text-slate-700">Motivo de la Solicitud <span className="text-red-600">*</span></label><select required className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={formData.reason} onChange={(event) => setFormData({ ...formData, reason: event.target.value })}><option value="">Seleccione un motivo...</option><option value="CAPA">CAPA</option><option value="Control de Cambios - CC">Control de Cambios - CC</option><option value="Ajustes Menores">Ajustes Menores</option><option value="Referencia de creación">Referencia de creación</option></select></div>
          </div>
          <div><p className="mb-3 text-sm font-semibold text-slate-700">Tipo de Guía <span className="text-red-600">*</span></p><div className="flex flex-wrap gap-x-7 gap-y-3"><label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"><input type="radio" className="h-4 w-4 accent-blue-600" checked={formData.type === 'Última versión de la guía'} onChange={() => setFormData({ ...formData, type: 'Última versión de la guía' })} />Última versión de la guía</label><label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"><input type="radio" className="h-4 w-4 accent-blue-600" checked={formData.type === 'Guía de referencia para producto nuevo'} onChange={() => setFormData({ ...formData, type: 'Guía de referencia para producto nuevo' })} />Guía de referencia (Producto nuevo)</label></div></div>
          <div><label className="mb-2 block text-sm font-semibold text-slate-700">Justificación detallada <span className="text-red-600">*</span></label><textarea required rows="4" placeholder="Explique brevemente el porqué de la solicitud..." className="w-full resize-none rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={formData.justification} onChange={(event) => setFormData({ ...formData, justification: event.target.value })} /></div>
        </form>
        <footer className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button><button type="submit" form="new-req-form" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">⌁&nbsp; Enviar Solicitud</button></footer>
      </div>
    </div>
  );
}

function ViewRequestModal({ data, editable, onClose, onEdit, onView }) {
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
            </div>
            <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Justificación</p><p className="text-sm bg-white p-3 border rounded">{data.justification}</p></div>
          </div>
          {editable && (
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
