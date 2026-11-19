import React, { useState } from 'react';
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
  const today = () => new Date().toISOString().slice(0, 10);
  const updateRequest = (id, nextStage, actor, action, note = '') => setRequests(current => current.map(request => request.id !== id ? request : ({ ...request, stage: nextStage, status: nextStage === 'RECHAZADA_ASC_INICIAL' ? 'Rechazado' : nextStage === 'EN_EDICION' || nextStage === 'PENDIENTE_JEFATURA' || nextStage === 'PENDIENTE_ASC_TECNICA' || nextStage === 'APROBADA_TECNICA' ? 'Aprobado' : request.status, history: [...(request.history || []), { actor, action, note, date: today() }] })));
  const addRequest = (data) => setRequests(current => [{ ...data, id: `REQ-${String(current.length + 1).padStart(3, '0')}`, date: today(), stage: 'PENDIENTE_ASC_INICIAL', history: [{ actor: 'Responsable', action: 'Solicitud creada', date: today() }] }, ...current]);
  const saveGuide = (id, guideRows) => setRequests(current => current.map(request => request.id === id ? ({ ...request, guideRows, guideVersion: (request.guideVersion || 0) + 1, history: [...(request.history || []), { actor: 'Responsable', action: 'Nueva versión de guía guardada', date: today() }] }) : request));
  if (!user) return <LoginScreen onLogin={(role) => { setUser(role); setView('main'); }} />;
  const panelProps = { view, requests, updateRequest, onCreate: addRequest };
  return <div className="min-h-screen bg-slate-50 flex"><SideNav currentRole={user} activeView={view} onNavigate={setView} onLogout={() => setUser(null)} /><main className="min-w-0 flex-1"><header className="flex h-[88px] items-center border-b border-slate-200 bg-white px-10"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-blue-700">Gestión de producción</p><h1 className="mt-1 text-xl font-bold text-slate-800">{titles[user][view]}</h1></div></header><div className="p-8 lg:p-10">{user === 'Responsable' ? <ApplicantPanel view={view} requests={requests} setRequests={setRequests} updateRequest={updateRequest} onSaveGuide={saveGuide} /> : user === 'ASC' ? <ASCPanel {...panelProps} /> : <JefaturaPanel {...panelProps} />}</div></main></div>;
}
