import React, { useEffect, useRef, useState } from 'react';
import { ClipboardList, FileEdit, History, LogOut, SearchCheck, Settings, Headphones } from 'lucide-react';

const navigation = {
  Responsable: [{ id: 'main', label: 'Mis solicitudes', icon: ClipboardList }, { id: 'shared', label: 'Guías compartidas', icon: FileEdit }, { id: 'history', label: 'Historial', icon: History }],
  ASC: [{ id: 'main', label: 'Solicitudes iniciales', icon: ClipboardList }, { id: 'technical', label: 'Revisión técnica', icon: SearchCheck }, { id: 'history', label: 'Historial de decisiones', icon: History }, { id: 'settings', label: 'Configuración funcional', icon: Settings }],
  Participante: [{ id: 'main', label: 'Firmas pendientes', icon: ClipboardList }],
  Jefatura: [{ id: 'main', label: 'Revisiones pendientes', icon: ClipboardList }, { id: 'history', label: 'Historial de revisiones', icon: History }]
};

export default function SideNav({ currentRole, displayName, displayRole, activeView, onNavigate, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);
  const name = displayName || currentRole;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('');
  useEffect(() => {
    const close = event => { if (ref.current && !ref.current.contains(event.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return <aside className="flex min-h-screen w-[260px] shrink-0 flex-col justify-between bg-[#003945] px-4 py-6 text-white max-md:w-[210px]">
    <div>
      <div className="flex items-center gap-3 px-1 pb-8">
        <img src="/biomont.png" alt="Biomont" className="h-auto w-[105px] shrink-0" />
        <span aria-hidden="true" className="h-9 w-px bg-white/40" />
        <p className="text-sm font-bold leading-tight">Guías de<br />Producción</p>
      </div>
      <nav aria-label="Navegación principal" className="space-y-1.5">
        {navigation[currentRole].map(({ id, label, icon: Icon }) => <button key={id} onClick={() => onNavigate(id)}
          aria-current={activeView === id ? 'page' : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors ${activeView === id ? 'bg-[#0867e8] font-semibold text-white shadow-sm' : 'font-medium text-white/85 hover:bg-white/10 hover:text-white'}`}>
          <Icon size={18} className="shrink-0" />{label}
        </button>)}
        <a href="https://laboratoriosbiomont.with16.glpi-network.cloud/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white"><Headphones size={18} />Ayuda y soporte</a>
      </nav>
    </div>
    <div ref={ref} className="relative border-t border-white/20 pt-5">
      {menuOpen && <div className="absolute bottom-16 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-xl"><button onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut size={16} />Cerrar sesión</button></div>}
      <div className="flex items-center gap-3 px-1">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 text-xs font-bold">{initials}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="text-xs text-white/70">{displayRole || currentRole}</p></div>
        <button aria-label="Configuración" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white"><Settings size={18} /></button>
      </div>
    </div>
  </aside>;
}
