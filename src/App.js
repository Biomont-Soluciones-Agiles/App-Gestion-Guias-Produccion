import React, { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import TopNav from './components/TopNav';
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

  const login = (role) => setUser(role);
  const logout = () => setUser(null);

  if (!user) return <LoginScreen onLogin={login} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav currentRole={user} onRoleChange={setUser} onLogout={logout} />
      <main className="flex-grow p-8">
        {user === 'Solicitante' ? 
          <ApplicantPanel requests={requests} setRequests={setRequests} /> : 
          <ASCPanel requests={requests} setRequests={setRequests} />
        }
      </main>
    </div>
  );
}
