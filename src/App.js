import React, { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import SideNav from './components/SideNav';
import ApplicantPanel from './components/ApplicantPanel';
import ASCPanel from './components/ASCPanel';

const mockRequests = [
  { id: 'REQ-001', area: 'Validación - VOT', guide: 'Validación de Línea Líquidos', reason: 'Referencia de creación', date: '2026-11-09', type: 'Guía de referencia', status: 'Pendiente', justification: 'Se requiere para iniciar el protocolo de validación del nuevo producto.' },
  { id: 'REQ-002', area: 'Acondicionado', guide: 'Guía de Envasado Lote 402', reason: 'Ajustes Menores', date: '2026-11-08', type: 'Última versión de la guía', status: 'Aprobado', justification: 'Actualización de rendimientos en la etapa de estuchado.' },
  { id: 'REQ-003', area: 'Desarrollo Farmacéutico - DF', guide: 'Fórmula Maestra Paracetamol', reason: 'Control de Cambios - CC', date: '2026-11-08', type: 'Última versión de la guía', status: 'Rechazado', justification: 'Cambio de excipiente por desabastecimiento.', rejectReason: 'Falta adjuntar el anexo técnico del CC.' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState(mockRequests);
  if (!user) return <LoginScreen onLogin={setUser} />;
  const isAsc = user === 'ASC';
  return <div className="min-h-screen bg-slate-50 flex">
    <SideNav currentRole={user} onLogout={() => setUser(null)} />
    <main className="min-w-0 flex-1">
      <header className="flex h-[88px] items-center border-b border-slate-200 bg-white px-10">
        <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-blue-700">Gestión de producción</p><h1 className="mt-1 text-xl font-bold text-slate-800">{isAsc ? 'Solicitudes por revisar' : 'Mis solicitudes'}</h1></div>
      </header>
      <div className="p-8 lg:p-10">{isAsc ? <ASCPanel requests={requests} setRequests={setRequests} /> : <ApplicantPanel requests={requests} setRequests={setRequests} />}</div>
    </main>
  </div>;
}