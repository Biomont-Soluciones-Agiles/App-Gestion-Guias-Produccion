import React from 'react';
import { LogOut } from 'lucide-react';

export default function TopNav({ currentRole, onRoleChange, onLogout }) {
  return (
    <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm">
      <div className="flex items-center gap-6">
        <div className="bg-red-600 text-white px-3 py-1 font-bold rounded-full text-sm">Biomont</div>
        <h1 className="text-lg font-bold text-slate-800">Gestión de Guías Editables</h1>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500">Vista actual:</span>
          <select value={currentRole} onChange={(e) => onRoleChange(e.target.value)} className="bg-slate-100 border-none rounded-md py-1.5 px-3 text-sm font-semibold text-blue-800 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500">
            <option value="Solicitante">Panel Solicitante</option>
            <option value="ASC">Bandeja ASC</option>
          </select>
        </div>
        <div className="h-6 w-px bg-slate-200"></div>
        <button onClick={onLogout} className="text-slate-500 hover:text-red-600 flex items-center gap-2 text-sm font-medium transition-colors">
          <LogOut size={16} /> Salir
        </button>
      </div>
    </header>
  );
}
