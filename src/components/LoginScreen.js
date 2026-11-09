import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export default function LoginScreen({ onLogin }) {
  const [selectedRole, setSelectedRole] = useState('Solicitante');
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-blue-900 text-white flex-col justify-center px-20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-gradient-to-br from-blue-600 to-transparent"></div>
        <div className="relative z-10">
          <div className="flex items-center mb-16">
            <div className="bg-red-600 text-white px-4 py-2 font-bold rounded-full text-xl tracking-tight">Biomont</div>
          </div>
          <p className="text-sm font-semibold tracking-widest text-slate-300 mb-4 uppercase">Gestión de Producción</p>
          <h1 className="text-6xl font-bold leading-tight mb-8">Guías que llevan la<br/>producción adelante.</h1>
          <div className="w-16 h-1 bg-red-600 mb-8"></div>
          <p className="text-xl text-slate-200 max-w-md">Solicita, revisa y entrega versiones editables con trazabilidad.</p>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-slate-50">
        <div className="bg-white p-12 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="bg-red-600 text-white px-4 py-1.5 font-bold rounded-full text-lg">Biomont</div>
          </div>
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-red-600 tracking-widest uppercase mb-3">Plataforma de Producción</p>
            <h2 className="text-3xl font-bold text-slate-800">Bienvenido</h2>
            <p className="text-slate-500 mt-2 text-sm">Selecciona tu rol e ingresa con tu contraseña.</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); onLogin(selectedRole); }}>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Rol</label>
              <select className="w-full border border-slate-300 rounded-lg p-3 text-slate-700 bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                <option value="Solicitante">Responsable / Solicitante</option>
                <option value="ASC">Aseguramiento de Sistemas de Calidad (ASC)</option>
              </select>
            </div>
            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Contraseña</label>
              <input type="password" placeholder="Ingresa tu contraseña" required className="w-full border border-slate-300 rounded-lg p-3 text-slate-700 focus:ring-2 focus:ring-blue-600 outline-none transition-all" defaultValue="123456" />
            </div>
            <button type="submit" className="w-full bg-blue-800 hover:bg-blue-700 text-white font-medium py-3.5 rounded-lg flex items-center justify-between px-6 transition-colors shadow-md">
              <span>Ingresar</span>
              <ChevronRight size={18} />
            </button>
          </form>
          <div className="mt-8 text-center text-xs text-slate-400">
            <p className="mb-2">🔒 Acceso seguro para colaboradores Biomont</p>
          </div>
        </div>
      </div>
    </div>
  );
}
