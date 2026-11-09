import React, { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function ASCPanel({ requests, setRequests }) {
  const [selectedReq, setSelectedReq] = useState(null);
  const [toast, setToast] = useState('');
  const pendingRequests = requests.filter(r => r.status === 'Pendiente');

  const handleDecision = (id, isApproved, rejectReason = '') => {
    setRequests(requests.map(r => r.id === id ? { ...r, status: isApproved ? 'Aprobado' : 'Rechazado', rejectReason } : r));
    setSelectedReq(null);
    setToast(isApproved ? 'Carpeta compartida y correo enviado correctamente.' : 'Solicitud rechazada.');
    setTimeout(() => setToast(''), 4000);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-24 right-8 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-fade-in">
          <CheckCircle size={20} />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Bandeja de Entrada - ASC</h2>
        <p className="text-slate-500 text-sm">Solicitudes pendientes de revisión y entrega de editables.</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Área</th>
              <th className="px-6 py-4">Guía</th>
              <th className="px-6 py-4">Motivo</th>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pendingRequests.length === 0 ? (
              <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No hay solicitudes pendientes.</td></tr>
            ) : (
              pendingRequests.map(req => (
                <tr key={req.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedReq(req)}>
                  <td className="px-6 py-4 font-medium text-slate-900">{req.id}</td>
                  <td className="px-6 py-4">{req.area}</td>
                  <td className="px-6 py-4 font-medium">{req.guide}</td>
                  <td className="px-6 py-4">{req.reason}</td>
                  <td className="px-6 py-4">{req.date}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-blue-600 font-medium text-xs bg-blue-50 px-3 py-1.5 rounded hover:bg-blue-100">Revisar</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {selectedReq && <ASCReviewModal data={selectedReq} onClose={() => setSelectedReq(null)} onDecision={handleDecision} />}
    </div>
  );
}

function ASCReviewModal({ data, onClose, onDecision }) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = () => {
    if (!rejecting) { setRejecting(true); return; }
    if (!rejectReason.trim()) return;
    onDecision(data.id, false, rejectReason);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div><h3 className="text-lg font-bold text-slate-800">Revisión: {data.id}</h3></div>
          <button onClick={onClose} className="text-slate-400"><XCircle size={24} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg border">
              <p className="text-xs text-slate-500 font-bold uppercase mb-1">Documento</p>
              <p className="font-medium">{data.guide}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border">
              <p className="text-xs text-slate-500 font-bold uppercase mb-1">Motivo</p>
              <p className="font-medium">{data.reason}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase mb-2">Justificación</p>
            <div className="bg-white border p-4 rounded-lg text-sm text-slate-700">{data.justification}</div>
          </div>
          <div className="border-t pt-6">
            {!rejecting ? (
              <div className="flex gap-4">
                <button onClick={handleReject} className="flex-1 py-3 border border-red-300 text-red-700 rounded-lg font-bold hover:bg-red-50 flex justify-center items-center gap-2"><XCircle size={18}/> Rechazar</button>
                <button onClick={() => onDecision(data.id, true)} className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 flex justify-center items-center gap-2"><CheckCircle size={18}/> Aprobar y Compartir</button>
              </div>
            ) : (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200 animate-fade-in">
                <label className="block text-sm font-bold text-red-800 mb-2">Motivo de rechazo</label>
                <textarea rows="3" className="w-full border-red-300 rounded p-3 text-sm" value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus></textarea>
                <div className="flex gap-3 justify-end mt-3">
                  <button onClick={() => setRejecting(false)} className="px-4 py-2 text-sm bg-white border rounded">Cancelar</button>
                  <button onClick={handleReject} disabled={!rejectReason.trim()} className="px-4 py-2 text-sm text-white bg-red-600 rounded disabled:opacity-50">Confirmar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
