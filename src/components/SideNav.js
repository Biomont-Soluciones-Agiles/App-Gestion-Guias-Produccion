import React, { useEffect, useRef, useState } from 'react';
import { ClipboardList, FileCheck2, HelpCircle, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';

export default function SideNav({ currentRole, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const close = (event) => { if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const isAsc = currentRole === 'ASC';
  const userName = isAsc ? 'Aseguramiento de la Calidad' : 'María Rodríguez';
  const userRole = isAsc ? 'ASC' : 'Solicitante';
  return <aside className="w-[268px] shrink-0 border-r border-slate-200 bg-white px-4 py-5 flex flex-col justify-between min-h-screen">
    <div>
      <div className="flex items-center gap-3 px-2 pb-6">
        <div className="rounded-full bg-[#e30613] px-3 py-1.5 text-sm font-extrabold tracking-tight text-white">Biomont</div>
        <div><p className="text-sm font-bold leading-tight text-slate-800">Gestión de Guías</p><p className="text-xs text-slate-500">Editables</p></div>
      </div>
      <div className="mb-5 border-t border-slate-100" />
      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">Navegación</p>
      <nav className="space-y-1">
        <button className="flex w-full items-center gap-3 rounded-lg bg-blue-50 px-3 py-2.5 text-left text-sm font-semibold text-blue-800"><ClipboardList size={18} />{isAsc ? 'Solicitudes por revisar' : 'Mis solicitudes'}</button>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"><FileCheck2 size={18} />{isAsc ? 'Historial de decisiones' : 'Guías compartidas'}</button>
        <a href="https://laboratoriosbiomont.with16.glpi-network.cloud/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"><HelpCircle size={18} />Ayuda y soporte</a>
      </nav>
    </div>
    <div className="relative border-t border-slate-100 pt-4" ref={menuRef}>
      {menuOpen && <div className="absolute bottom-[70px] left-0 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"><p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">Configuración</p><button onClick={onLogout} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut size={17} />Cerrar sesión</button></div>}
      <div className="flex items-center gap-2 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><UserRound size={18} /></div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{userName}</p><p className="text-xs text-slate-500">{userRole}</p></div>
        <button aria-label="Configuración" onClick={() => setMenuOpen(!menuOpen)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Settings size={18} /></button>
      </div>

    </div>
  </aside>;
}