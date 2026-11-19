import React, { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import SideNav from './components/SideNav';
import ApplicantPanel from './components/ApplicantPanel';
import ASCPanel from './components/ASCPanel';
import JefaturaPanel from './components/JefaturaPanel';

const initialRequests = [
  { id: 'REQ-001', area: 'Validación - VOT', guide: 'Líquido POTENCIL 25% Envasado - F', reason: 'Referencia de creación', date: '2026-11-09', type: 'Guía de referencia', stage: 'PENDIENTE_ASC_INICIAL', justification: 'Se requiere para iniciar el protocolo de validación.', history: [] },
  { id: 'REQ-002', area: 'Acondicionado', guide: 'Semisólido POTENZA CAPS Envasado - F', reason: 'Ajustes menores', date: '2026-11-08', type: 'Última versión de la guía', stage: 'EN_EDICION', justification: 'Actualización de rendimientos en la etapa de estuchado.', history: [{ actor: 'ASC', action: 'Solicitud inicial aprobada', date: '2026-11-08' }] },
  { id: 'REQ-003', area: 'Planta', guide: 'Polvo BIOMICIN SUPER Envasado - A', reason: 'Control de cambios', date: '2026-11-07', type: 'Última versión de la guía', stage: 'PENDIENTE_JEFATURA', justification: 'Cambio documentado en proceso de fabricación.', history: [{ actor: 'ASC', action: 'Solicitud inicial aprobada', date: '2026-11-07' }, { actor: 'Responsable', action: 'Guía enviada a Jefatura', date: '2026-11-08' }] },
  { id: 'REQ-004', area: 'Desarrollo Farmacéutico - DF', guide: 'Sólido UPROFIX 3.6 TAB Fabricación - F', reason: 'CAPA', date: '2026-11-06', type: 'Última versión de la guía', stage: 'PENDIENTE_ASC_TECNICA', justification: 'Se incorporaron acciones correctivas aprobadas.', history: [{ actor: 'ASC', action: 'Solicitud inicial aprobada', date: '2026-11-06' }, { actor: 'Jefatura', action: 'Guía aprobada para revisión técnica', date: '2026-11-08' }] },
];

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
  const updateRequest = (id, nextStage, actor, action, note = '') => setRequests(current => current.map(request => request.id !== id ? request : ({ ...request, stage: nextStage, history: [...(request.history || []), { actor, action, note, date: today() }] })));
  const addRequest = (data) => setRequests(current => [{ ...data, id: `REQ-${String(current.length + 1).padStart(3, '0')}`, date: today(), stage: 'PENDIENTE_ASC_INICIAL', history: [{ actor: 'Responsable', action: 'Solicitud creada', date: today() }] }, ...current]);
  if (!user) return <LoginScreen onLogin={(role) => { setUser(role); setView('main'); }} />;
  const panelProps = { view, requests, updateRequest, onCreate: addRequest };
  return <div className="min-h-screen bg-slate-50 flex"><SideNav currentRole={user} activeView={view} onNavigate={setView} onLogout={() => setUser(null)} /><main className="min-w-0 flex-1"><header className="flex h-[88px] items-center border-b border-slate-200 bg-white px-10"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-blue-700">Gestión de producción</p><h1 className="mt-1 text-xl font-bold text-slate-800">{titles[user][view]}</h1></div></header><div className="p-8 lg:p-10">{user === 'Responsable' ? <ApplicantPanel {...panelProps} /> : user === 'ASC' ? <ASCPanel {...panelProps} /> : <JefaturaPanel {...panelProps} />}</div></main></div>;
}
