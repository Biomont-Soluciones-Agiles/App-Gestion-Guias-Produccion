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
  const [testRole, setTestRole] = useState('Responsable');
  const [view, setView] = useState('main');
  const [requests, setRequests] = useState(initialRequests);
  const normalize = (row) => ({ id: row.request_code, dbId: row.id, sharepointItemId: row.sharepoint_item_id, area: row.requester_area, guide: row.guide_name, product: row.product, line: row.production_line, phase: row.production_phase, reason: row.request_reason, type: row.guide_type, justification: row.justification, date: row.created_at?.slice(0, 10), stage: row.workflow_stage, status: row.workflow_stage === 'RECHAZADA_ASC_INICIAL' ? 'Rechazado' : row.workflow_stage === 'PENDIENTE_ASC_INICIAL' ? 'Pendiente' : 'Aprobado', history: row.workflow_events || [], guideRows: row.guide_versions?.sort((a,b) => b.version_number-a.version_number)[0]?.spreadsheet_data });
  useEffect(() => { if (!user) return; fetch('/api/requests').then(async r => { if (!r.ok) throw new Error('No se pudieron cargar las solicitudes.'); return r.json(); }).then(rows => setRequests(Array.isArray(rows) ? rows.map(normalize) : [])).catch(error => window.alert(error.message)); }, [user]);
  const today = () => new Date().toISOString().slice(0, 10);
  const updateRequest = async (id, nextStage, actor, action, note = '') => { const request = requests.find(r => r.id === id); if (!request) return; try { const response = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: request.dbId, stage: nextStage, actor, event: action, note }) }); if (!response.ok) throw new Error('No se pudo actualizar la solicitud.'); setRequests(current => current.map(r => r.id !== id ? r : ({ ...r, stage: nextStage, status: nextStage === 'RECHAZADA_ASC_INICIAL' ? 'Rechazado' : nextStage === 'PENDIENTE_ASC_INICIAL' ? 'Pendiente' : 'Aprobado', history: [...(r.history || []), { actor, action, note, date: today() }] }))); } catch (error) { window.alert(error.message); } };
  const addRequest = async (data) => { const request_code = `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; const payload = { request_code, sharepoint_item_id: data.sharepointItemId, guide_name: data.guide, product: data.product, production_line: data.line, production_phase: data.phase, requester_area: data.area, request_reason: data.reason, guide_type: data.type, justification: data.justification }; const response = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', request: payload }) }); const row = await response.json(); if (!response.ok || !row?.id) throw new Error('No se pudo guardar la solicitud en Supabase. Inténtalo de nuevo.'); setRequests(current => [normalize(row), ...current]); };
  const saveGuide = async (id, guideRows) => { const request = requests.find(r => r.id === id); if (!request) throw new Error('No se encontró la solicitud.'); const response = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-guide', id: request.dbId, guideRows }) }); if (!response.ok) throw new Error('No se pudieron guardar los cambios.'); setRequests(current => current.map(r => r.id === id ? ({ ...r, guideRows }) : r)); };
  useEffect(() => { fetch('/api/auth/session').then(r => r.ok ? r.json() : null).then(data => { if (data) { setUser(data); setTestRole(data.role === 'Administrador' ? 'Responsable' : data.role); setView('main'); } }).catch(() => {}); }, []);
  if (!user) return <LoginScreen />;
  const activeRole = user.role === 'Administrador' ? testRole : user.role;
  const changeTestRole = (role) => { setTestRole(role); setView('main'); };
  const panelProps = { view, requests, updateRequest, onCreate: addRequest };
  return <div className="min-h-screen bg-slate-50 flex"><SideNav currentRole={activeRole} displayName={user.name} displayRole={user.role === 'Administrador' ? `Administrador · Vista ${activeRole}` : activeRole} activeView={view} onNavigate={setView} onLogout={() => fetch('/api/auth/logout').finally(() => { setUser(null); window.location.assign('/'); })} /><main className="min-w-0 flex-1"><header className="flex h-[88px] items-center justify-between border-b border-slate-200 bg-white px-10"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-blue-700">Gestión de producción</p><h1 className="mt-1 text-xl font-bold text-slate-800">{titles[activeRole][view]}</h1></div>{user.role === 'Administrador' && <label className="text-sm font-semibold text-slate-600">Vista de pruebas<select value={activeRole} onChange={e => changeTestRole(e.target.value)} className="ml-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-800"><option>Responsable</option><option>Jefatura</option><option>ASC</option></select></label>}</header><div className="p-8 lg:p-10">{activeRole === 'Responsable' ? <ApplicantPanel view={view} requests={requests} setRequests={setRequests} updateRequest={updateRequest} onSaveGuide={saveGuide} onCreate={addRequest} /> : activeRole === 'ASC' ? <ASCPanel {...panelProps} /> : <JefaturaPanel {...panelProps} />}</div></main></div>;
}
