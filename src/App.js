import React, { useEffect, useState } from 'react';
import LoginScreen from './components/LoginScreen';
import SideNav from './components/SideNav';
import ApplicantPanel from './components/ApplicantPanel';
import ASCPanel from './components/ASCPanel';
import JefaturaPanel from './components/JefaturaPanel';

const initialRequests = [];

const titles = {
  Responsable: { main: 'Mis solicitudes', shared: 'Guías en edición', history: 'Historial' },
  ASC: { main: 'Solicitudes iniciales', technical: 'Revisión técnica', history: 'Historial de decisiones' },
  Jefatura: { main: 'Revisiones pendientes', history: 'Historial de revisiones' },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('main');
  const [requests, setRequests] = useState(initialRequests);
  const normalize = (row) => ({ id: row.request_code, dbId: row.id, area: row.requester_area, guide: row.guide_name, product: row.product, line: row.production_line, phase: row.production_phase, reason: row.request_reason, type: row.guide_type, justification: row.justification, date: row.created_at?.slice(0, 10), stage: row.workflow_stage, status: row.workflow_stage === 'RECHAZADA_ASC_INICIAL' ? 'Rechazado' : row.workflow_stage === 'PENDIENTE_ASC_INICIAL' ? 'Pendiente' : 'Aprobado', history: row.workflow_events || [], guideRows: row.guide_versions?.sort((a,b) => b.version_number-a.version_number)[0]?.spreadsheet_data });
  useEffect(() => { fetch('/api/requests').then(r => r.ok ? r.json() : []).then(rows => setRequests(Array.isArray(rows) ? rows.map(normalize) : [])).catch(() => {}); }, []);
  const today = () => new Date().toISOString().slice(0, 10);
  const updateRequest = (id, nextStage, actor, action, note = '') => { const request = requests.find(r => r.id === id); if (!request) return; fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: request.dbId, stage: nextStage, actor, event: action, note }) }).then(() => setRequests(current => current.map(r => r.id !== id ? r : ({ ...r, stage: nextStage, status: nextStage === 'RECHAZADA_ASC_INICIAL' ? 'Rechazado' : nextStage === 'PENDIENTE_ASC_INICIAL' ? 'Pendiente' : 'Aprobado', history: [...(r.history || []), { actor, action, note, date: today() }] })))); };
  const addRequest = (data) => { const request_code = `REQ-${String(Date.now()).slice(-6)}`; const payload = { request_code, guide_name: data.guide, product: data.product, production_line: data.line, production_phase: data.phase, requester_area: data.area, request_reason: data.reason, guide_type: data.type, justification: data.justification }; fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', request: payload }) }).then(r => r.json()).then(row => { if (row?.id) setRequests(current => [normalize(row), ...current]); }); };
  const saveGuide = (id, guideRows) => { const request = requests.find(r => r.id === id); if (!request) return; fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-guide', id: request.dbId, guideRows }) }); setRequests(current => current.map(r => r.id === id ? ({ ...r, guideRows }) : r)); };
  useEffect(() => { fetch('/api/auth/session').then(r => r.ok ? r.json() : null).then(data => { if (data) { setUser(data.role === 'Administrador' ? 'Responsable' : data.role); setView('main'); } }).catch(() => {}); }, []);
  if (!user) return <LoginScreen />;
  const panelProps = { view, requests, updateRequest, onCreate: addRequest };
  return <div className="min-h-screen bg-slate-50 flex"><SideNav currentRole={user} activeView={view} onNavigate={setView} onLogout={() => fetch('/api/auth/logout').finally(() => { setUser(null); window.location.assign('/'); })} /><main className="min-w-0 flex-1"><header className="flex h-[88px] items-center border-b border-slate-200 bg-white px-10"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-blue-700">Gestión de producción</p><h1 className="mt-1 text-xl font-bold text-slate-800">{titles[user][view]}</h1></div></header><div className="p-8 lg:p-10">{user === 'Responsable' ? <ApplicantPanel view={view} requests={requests} setRequests={setRequests} updateRequest={updateRequest} onSaveGuide={saveGuide} onCreate={addRequest} /> : user === 'ASC' ? <ASCPanel {...panelProps} /> : <JefaturaPanel {...panelProps} />}</div></main></div>;
}
