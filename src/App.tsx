import { FormEvent, useEffect, useState } from 'react';
import { guardarSolicitud, listarSolicitudes, type Solicitud } from './datos/solicitudes';
import { notificarAsc } from './simulado/notificarAsc';

const guiaOpciones = ['GP-031 · Validación de línea', 'GP-032 · Preparación de materiales', 'GP-033 · Registro de lote'];

export function App() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guia, setGuia] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => { listarSolicitudes().then(setSolicitudes); }, []);

  async function enviarSolicitud(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guia) return;
    const nuevaSolicitud = await guardarSolicitud(guia);
    setSolicitudes((actuales) => [nuevaSolicitud, ...actuales]);
    setModalAbierto(false);
    setGuia('');
    setAviso(notificarAsc());
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div>
        <div className="brand">Biomont</div><div className="brand-rule" />
        <h1>Guías de Producción</h1>
        <nav aria-label="Navegación principal">
          <a className="nav-item active" href="#inicio"><span>⌂</span>Inicio</a>
          <a className="nav-item" href="#guias"><span>▱</span>Guías compartidas</a>
          <a className="nav-item" href="#ayuda"><span>?</span>Ayuda</a>
        </nav>
      </div>
      <button className="profile" type="button"><span className="avatar">M</span><span><strong>María</strong><small>RESPONSABLE</small></span><span className="chevron">⌄</span></button>
    </aside>
    <main>
      <header className="topbar"><p>Buenos días, María</p><button className="notification" type="button" aria-label="Notificaciones">♧<i /></button></header>
      <section className="content" id="inicio">
        <div className="hero"><div className="hero-copy"><span className="hero-accent" /><div><h2>Gestiona tus guías de producción</h2><p>Solicita a ASC el archivo editable que necesitas para iniciar o actualizar una guía.</p><button className="primary-button" type="button" onClick={() => setModalAbierto(true)}>＋ Nueva solicitud de editable</button></div></div></div>
        {aviso && <div className="simulation-notice" role="status">{aviso}</div>}
        <section className="metrics" aria-label="Resumen de solicitudes">
          <Metric icon="◷" title="Solicitudes en curso" subtitle="Pendientes de ASC" value="5" />
          <Metric icon="✓" title="Editables recibidos" subtitle="Aprobadas y enviadas" value="2" />
          <Metric rejected icon="×" title="Solicitudes rechazadas" subtitle="Rechazadas por ASC" value="1" />
        </section>
        <section className="requests"><div className="section-heading"><h2>Mis solicitudes recientes</h2><button className="text-button" type="button">Ver todas</button></div><div className="table-wrap"><table><thead><tr><th>Guía</th><th>Área</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr></thead><tbody>{solicitudes.map((solicitud) => <tr key={solicitud.id}><td>{solicitud.guia}</td><td>{solicitud.area}</td><td><span className={`status ${claseEstado(solicitud.estado)}`}>{solicitud.estado}</span></td><td>{solicitud.fecha}</td><td><button className="outline-button" type="button">{solicitud.estado === 'Borrador' ? 'Continuar' : solicitud.estado === 'Editable disponible' ? 'Abrir' : 'Ver detalle'}</button></td></tr>)}</tbody></table></div></section>
      </section>
    </main>
    {modalAbierto && <div className="modal-backdrop" role="presentation"><form className="modal" onSubmit={enviarSolicitud}><div className="dialog-header"><div><p className="eyebrow">NUEVA SOLICITUD</p><h2>Solicitar editable a ASC</h2></div><button className="close" onClick={() => setModalAbierto(false)} type="button">×</button></div><p className="dialog-copy">Completa la información para enviar la solicitud al equipo de Aseguramiento de la Calidad.</p><label>Guía de producción<select value={guia} onChange={(event) => setGuia(event.target.value)} required><option value="">Selecciona una guía</option>{guiaOpciones.map((opcion) => <option key={opcion}>{opcion}</option>)}</select></label><label>Motivo de la solicitud<textarea rows={4} required placeholder="Describe la actualización o el uso previsto del editable" /></label><div className="dialog-actions"><button className="secondary-button" onClick={() => setModalAbierto(false)} type="button">Cancelar</button><button className="primary-button" type="submit">Enviar a ASC</button></div></form></div>}
  </div>;
}

function Metric({ icon, title, subtitle, value, rejected = false }: { icon: string; title: string; subtitle: string; value: string; rejected?: boolean }) {
  return <article className={`metric-card ${rejected ? 'rejected' : ''}`}><span className="metric-icon">{icon}</span><div><h3>{title}</h3><p>{subtitle}</p><strong>{value}</strong></div></article>;
}
function claseEstado(estado: Solicitud['estado']) { return estado === 'En revisión ASC' ? 'review' : estado === 'Editable disponible' ? 'available' : 'draft'; }