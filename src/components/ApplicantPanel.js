import React, { useState } from 'react';
import { Plus, Eye, XCircle, FilePenLine, Save } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function ApplicantPanel({ requests, setRequests }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewModalData, setViewModalData] = useState(null);
  const [editingGuide, setEditingGuide] = useState(null);

  const handleSubmit = (newReq) => {
    const request = {
      ...newReq,
      id: `REQ-00${requests.length + 1}`,
      date: new Date().toISOString().split('T')[0],
      status: 'Pendiente'
    };
    setRequests([request, ...requests]);
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Mis Solicitudes</h2>
          <p className="text-slate-500 text-sm">Historial de solicitudes de guías de producción editables.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition-colors">
          <Plus size={16} /> Nueva Solicitud
        </button>
      </div>
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
            {requests.map(req => (
              <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">{req.id}</td>
                <td className="px-6 py-4">{req.guide}</td>
                <td className="px-6 py-4">{req.date}</td>
                <td className="px-6 py-4">
                  <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">{req.type}</span>
                </td>
                <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                <td className="px-6 py-4 text-center">
                  <button onClick={() => setViewModalData(req)} className="text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 text-xs font-medium mx-auto bg-blue-50 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors">
                    <Eye size={14} /> Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && <NewRequestModal onClose={() => setIsModalOpen(false)} onSubmit={handleSubmit} />}
      {viewModalData && <ViewRequestModal data={viewModalData} onClose={() => setViewModalData(null)} onEdit={(request) => { setViewModalData(null); setEditingGuide(request); }} />}
      {editingGuide && <GuideEditorModal data={editingGuide} onClose={() => setEditingGuide(null)} />}
    </div>
  );
}

function NewRequestModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({ guide: '', area: '', type: 'Última versión de la guía', reason: '', justification: '' });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div><h3 className="text-[22px] font-bold leading-tight text-slate-900">Nueva Solicitud de Editable</h3><p className="mt-1 text-sm text-slate-500">Complete los datos para iniciar el flujo de solicitud.</p></div>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"><XCircle size={22} /></button>
        </header>
        <form id="new-req-form" className="space-y-7 overflow-y-auto px-6 py-7" onSubmit={(event) => { event.preventDefault(); onSubmit(formData); }}>
          <div><label className="mb-2 block text-sm font-semibold text-slate-700">Nombre o Código de la Guía <span className="text-red-600">*</span></label><input required type="text" placeholder="Ej. Guía de Envasado Lote X" className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={formData.guide} onChange={(event) => setFormData({ ...formData, guide: event.target.value })} /></div>
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

function ViewRequestModal({ data, onClose, onEdit }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">Detalles de Solicitud {data.id}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex justify-between items-start">
            <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Estado</p><StatusBadge status={data.status} /></div>
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
          {data.status === 'Aprobado' && (
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4">
              <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2"><FilePenLine size={16} /> Editable disponible</h4>
              <p className="mb-3 text-xs text-emerald-800">La guía se edita dentro de la plataforma. No hay descarga ni exportación habilitada.</p>
              <button onClick={() => onEdit(data)} className="w-full bg-emerald-600 text-white py-2 rounded text-sm font-medium flex items-center justify-center gap-2"><FilePenLine size={16} /> Editar guía</button>
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

function GuideEditorModal({ data, onClose }) {
  const [sheet, setSheet] = useState('1');
  const [rows, setRows] = useState([
    ['GUÍA DE FABRICACIÓN', '', 'Código', data.id],
    ['Guía', data.guide, 'Versión', '01'],
    ['Área', data.area, 'Fecha de autorización', 'Pendiente'],
    ['Paso', 'Instrucción', 'Registro', ''],
    ['1.1', 'Verificar que el área se encuentre liberada y limpia.', '', ''],
    ['1.2', 'Registrar las condiciones de inicio de la operación.', '', ''],
  ]);
  const updateCell = (rowIndex, columnIndex, value) => setRows(current => current.map((row, r) => r === rowIndex ? row.map((cell, c) => c === columnIndex ? value : cell) : row));
  return <div className="fixed inset-0 z-[60] bg-slate-950/60 p-3 sm:p-6">
    <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-xl bg-slate-100 shadow-2xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-white px-5 py-4"><div><p className="text-[10px] font-bold tracking-widest text-red-600">EDICIÓN INTERNA · {data.id}</p><h3 className="mt-1 text-base font-bold text-slate-800">{data.guide}</h3><p className="mt-1 text-xs text-slate-500">Solo edición dentro de la plataforma · No hay descarga ni exportación habilitada</p></div><div className="flex gap-2"><button onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cerrar</button><button onClick={() => alert('Cambios guardados temporalmente en este prototipo.')} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"><Save size={15}/> Guardar cambios</button></div></header>
      <div className="flex gap-1 overflow-x-auto px-4 pt-3">{['1','2','3','4','5','6','HISTORIAL'].map(item => <button key={item} onClick={() => setSheet(item)} className={`whitespace-nowrap rounded-t-md border px-3 py-2 text-xs font-semibold ${sheet === item ? 'border-slate-300 bg-white text-blue-700' : 'border-transparent text-slate-500'}`}>{item === 'HISTORIAL' ? 'Historial de cambio' : `Hoja ${item}`}</button>)}</div>
      <div className="m-4 flex-1 overflow-auto rounded-lg border bg-white p-4"><div className="mb-3 border border-slate-300 bg-sky-50 py-2 text-center text-sm font-bold text-slate-800">{sheet === '1' ? 'GUÍA DE FABRICACIÓN' : sheet === 'HISTORIAL' ? 'HISTORIAL DE CAMBIO' : `GUÍA DE FABRICACIÓN · HOJA ${sheet}`}</div><table className="min-w-full border-collapse text-sm"> <tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} className={`min-w-[130px] border border-slate-300 p-0 ${r === 0 || r === 3 ? 'bg-slate-200 font-bold' : ''}`}><input value={cell} onChange={(event) => updateCell(r, c, event.target.value)} className="w-full bg-transparent px-3 py-2 outline-none focus:bg-blue-50" /></td>)}</tr>)}</tbody></table></div>
    </div>
  </div>;
}
