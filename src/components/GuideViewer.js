import React, { useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';

export default function GuideViewer({ data, onClose }) {
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    if (!data.sharepointItemId) {
      setError('Esta solicitud aún no está vinculada a un archivo de SharePoint.');
      return () => controller.abort();
    }
    fetch('/api/sharepoint', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('No se pudo consultar SharePoint.');
        return response.json();
      })
      .then(result => {
        const file = result.guides?.find(guide => guide.id === data.sharepointItemId);
        if (!file?.webUrl) throw new Error('No se encontró el archivo vinculado en la biblioteca.');
        const link = new URL(file.webUrl);
        const site = new URL(result.site.url);
        if (link.protocol !== 'https:' || link.hostname !== site.hostname) throw new Error('La dirección del archivo no es válida.');
        link.searchParams.set('action', 'embedview');
        link.searchParams.set('wdDownloadButton', 'False');
        setSource(link.toString());
      })
      .catch(reason => { if (reason.name !== 'AbortError') setError(reason.message || 'No se pudo abrir la guía.'); });
    return () => controller.abort();
  }, [data.sharepointItemId]);
  return <div className="fixed inset-0 z-[60] bg-slate-950/60 p-4"><div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-xl bg-slate-100 shadow-2xl"><header className="flex items-center justify-between gap-4 border-b bg-white px-5 py-4"><div><p className="text-[10px] font-bold tracking-widest text-blue-700">ARCHIVO DE SHAREPOINT · {data.id}</p><h3 className="mt-1 font-bold text-slate-800">{data.guide}</h3><p className="mt-1 text-xs text-slate-500">Vista del archivo original en SharePoint. La edición de prueba de la app aún no se refleja aquí.</p></div><button onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700"><XCircle size={16} className="mr-1 inline"/>Cerrar</button></header><div className="m-4 flex flex-1 flex-col overflow-hidden rounded-lg border bg-white">{error ? <p role="alert" className="p-6 text-sm text-red-700">{error}</p> : source ? <><p className="border-b px-4 py-2 text-xs text-slate-500">Si no se muestra, inicia sesión en SharePoint con tu cuenta de Biomont y comprueba que tengas acceso al archivo.</p><iframe title={`Guía ${data.guide}`} src={source} className="h-full w-full flex-1 border-0" /></> : <p role="status" className="p-6 text-sm text-slate-500">Cargando guía de SharePoint...</p>}</div></div></div>;
}
