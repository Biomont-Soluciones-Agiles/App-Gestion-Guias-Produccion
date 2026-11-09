import React, { useState } from 'react';
import { Plus, Eye, XCircle, Folder, Download } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function ApplicantPanel({ requests, setRequests }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewModalData, setViewModalData] = useState(null);

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
      {viewModalData && <ViewRequestModal data={viewModalData} onClose={() => setViewModalData(null)} />}
    </div>
  );
}

function NewRequestModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({ guide: '', area: '', type: 'Última versión de la guía', reason: '', justification: '' });
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">Nueva Solicitud</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto">
          <form id="new-req-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre/Código de la Guía</label>
              <input required type="text" className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500" value={formData.guide} onChange={e => setFormData({...formData, guide: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Área Solicitante</label>
              <select required className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})}>
                <option value="">Seleccione un área...</option>
                <option value="Acondicionado">Acondicionado</option>
                <option value="Desarrollo Farmacéutico - DF">Desarrollo Farmacéutico - DF</option>
                <option value="Planta">Planta</option>
                <option value="Validación - VOT">Validación - VOT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Guía</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="radio" className="text-blue-600" checked={formData.type === 'Última versión de la guía'} onChange={() => setFormData({...formData, type: 'Última versión de la guía'})} /> Última versión
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="radio" className="text-blue-600" checked={formData.type === 'Guía de referencia para producto nuevo'} onChange={() => setFormData({...formData, type: 'Guía de referencia para producto nuevo'})} /> Guía de referencia
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Motivo</label>
              <select required className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})}>
                <option value="">Seleccione motivo...</option>
                <option value="CAPA">CAPA</option>
                <option value="Control de Cambios - CC">Control de Cambios - CC</option>
                <option value="Ajustes Menores">Ajustes Menores</option>
                <option value="Referencia de creación">Referencia de creación</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Justificación</label>
              <textarea required rows="3" className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:border-blue-500 resize-none" value={formData.justification} onChange={e => setFormData({...formData, justification: e.target.value})}></textarea>
            </div>
          </form>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md">Cancelar</button>
          <button type="submit" form="new-req-form" className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md">Enviar Solicitud</button>
        </div>
      </div>
    </div>
  );
}

function ViewRequestModal({ data, onClose }) {
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
              <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2"><Folder size={16} /> Documentos y Carpeta</h4>
              <button className="w-full bg-emerald-600 text-white py-2 rounded text-sm font-medium flex items-center justify-center gap-2"><Download size={16} /> Acceder a Carpeta Compartida</button>
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
