import React from 'react';

export default function StatusBadge({ status }) {
  const styles = {
    Pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
    Aprobado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Rechazado: 'bg-red-100 text-red-700 border-red-200'
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${styles[status]}`}>{status}</span>;
}
