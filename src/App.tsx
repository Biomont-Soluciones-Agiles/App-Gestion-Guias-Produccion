import { FormEvent, useState } from 'react';

type Role = 'Responsable' | 'ASC';
type Status = 'Pendiente de revisión ASC' | 'Editable compartido' | 'Solicitud rechazada';
type Request = { id: number; guide: string; reason: string; status: Status; response?: string };

const guides = ['Guía de limpieza y sanitización', 'Guía de preparación de lote', 'Guía de control de envasado'];

export function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [screen, setScreen] = useState<'home' | 'new' | 'review'>('home');
  const [selected, setSelected] = useState<Request | null>(null);
  const [notice, setNotice] = useState('');

  const show = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3600); };
  const logout = () => { setRole(null); setScreen('home'); setSelected(null); };
  const createRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const guide = String(form.get('guide') || '');
    const reason = String(form.get('reason') || '').trim();
    if (!guide || !reason) return;
    setRequests((current) => [{ id: Date.now(), guide, reason, status: 'Pendiente de revisión ASC' }, ...current]);
    setScreen('home'); show('Solicitud enviada a ASC para revisión.');
  };
  const resolve = (status: Status, response: string) => {
    if (!selected) return;
    setRequests((current) => current.map((request) => request.id === selected.id ? { ...request, status, response } : request));
    setSelected(null); setScreen('home');
    show(status === 'Editable compartido' ? 'Carpeta compartida con el Responsable.' : 'Solicitud rechazada y notificada.');
  };
  if (!role) return <Login onAccess={setRole} />;

  return <div className="app-shell">
    <aside className="sidebar"><div><div className="brand-lockup"><span className="brand-oval">Biomont</span><span className="brand-app">Guías de<br />Producción</span></div><div className="sidebar-rule" /><p className="sidebar-role">{role === 'ASC' ? 'ASEGURAMIENTO DE LA CALIDAD' : 'ÁREA SOLICITANTE'}</p><button className={'nav-item active'} type="button" onClick={() => { setScreen('home'); setSelected(null); }}><span>⌂</span>{role === 'ASC' ? 'Solicitudes por revisar' : 'Mis solicitudes'}</button><a className="nav-item" href="https://laboratoriosbiomont.with16.glpi-network.cloud/" target="_blank" rel="noreferrer"><span>?</span>Ayuda y soporte</a></div><button className="profile" type="button" onClick={logout}><span className="avatar">{role === 'ASC' ? 'AC' : 'R'}</span><span><strong>{role}</strong><small>Cambiar rol</small></span><span className="profile-more">↗</span></button></aside>

    <main className="dashboard"><header className="topbar"><div><p className="breadcrumb">GESTIÓN DE GUÍAS DE PRODUCCIÓN</p><h1>{role === 'ASC' ? 'Revisión de solicitudes' : 'Solicitud de editables'}</h1></div><button className="user-chip" type="button" onClick={logout}>{role === 'ASC' ? 'AC' : 'R'}</button></header>
      <div className="page-content">
        {role === 'Responsable' && screen === 'home' && <ResponsibleHome requests={requests} onNew={() => setScreen('new')} />}
        {role === 'Responsable' && screen === 'new' && <RequestForm cancel={() => setScreen('home')} submit={createRequest} />}
        {role === 'ASC' && screen === 'home' && <AscHome requests={requests} review={(request) => { setSelected(request); setScreen('review'); }} />}
        {role === 'ASC' && screen === 'review' && selected && <Review request={selected} cancel={() => { setSelected(null); setScreen('home'); }} approve={(folder) => resolve('Editable compartido', folder)} reject={(note) => resolve('Solicitud rechazada', note)} />}
      </div>
      {notice && <div className="toast" role="status"><span>✓</span>{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}
    </main>
  </div>;
}

function Login({ onAccess }: { onAccess: (role: Role) => void }) {
  const [role, setRole] = useState<Role>('Responsable'); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (password !== 'password') { setError('La contraseña ingresada no es válida.'); return; } onAccess(role); };
  return <div className="login-page"><section className="login-story"><div className="story-brand">Biomont</div><div className="story-copy"><p>GESTIÓN DE PRODUCCIÓN</p><h1>Guías que llevan la producción adelante.</h1><span /><strong>Solicita, revisa y entrega versiones editables con trazabilidad.</strong></div><div className="story-footer">DOCUMENTACIÓN · TRAZABILIDAD · CALIDAD</div></section><section className="login-side"><div className="login-card"><div className="login-brand">Biomont</div><div className="login-divider" /><p className="eyebrow">PLATAFORMA DE PRODUCCIÓN</p><h2>Bienvenido</h2><p className="login-subtitle">Selecciona tu rol e ingresa con tu contraseña.</p><form className="login-form" onSubmit={submit}><label>Rol<select value={role} onChange={(event) => setRole(event.target.value as Role)}><option>Responsable</option><option>ASC</option></select></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ingresa tu contraseña" required /></label>{error && <p className="login-error">{error}</p>}<button className="primary-button login-button" type="submit">Ingresar <span>→</span></button></form><p className="secure-note">◈ Acceso seguro para colaboradores Biomont</p><a className="ticket-link" href="https://laboratoriosbiomont.with16.glpi-network.cloud/" target="_blank" rel="noreferrer">¿Encontraste una falla? Ingresa un ticket por aquí.</a></div></section></div>;
}

function ResponsibleHome({ requests, onNew }: { requests: Request[]; onNew: () => void }) {
 return <><section className="welcome-panel flow-header"><div><p className="eyebrow">INICIO DEL FLUJO</p><h2>Solicita el editable de una guía</h2><p>ASC revisará la solicitud y, si corresponde, compartirá una carpeta con los archivos editables.</p></div><button className="primary-button" type="button" onClick={onNew}>Solicitar editable</button></section><section className="process-note"><span>1</span><p>Selecciona la guía que necesitas actualizar e indica el motivo de la solicitud.</p><span>2</span><p>Recibirás la respuesta de ASC en esta misma pantalla.</p></section><RequestList title="Mis solicitudes" requests={requests} empty="Aún no has enviado solicitudes de editables." /></>;
}
function RequestForm({ cancel, submit }: { cancel: () => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
 return <section className="card form-card"><p className="eyebrow">NUEVA SOLICITUD</p><h2>Solicitar editable de guía</h2><p className="section-copy">Tu solicitud será enviada a ASC para verificación de la versión vigente y de los documentos asociados.</p><form className="form-stack" onSubmit={submit}><label>Guía de producción<select name="guide" required defaultValue=""><option value="" disabled>Selecciona una guía</option>{guides.map((guide) => <option key={guide}>{guide}</option>)}</select></label><label>Motivo de la solicitud<textarea name="reason" rows={5} placeholder="Ej. Actualización de procedimiento, CAPA o mejora de redacción." required /></label><div className="dialog-actions"><button className="secondary-button" type="button" onClick={cancel}>Cancelar</button><button className="primary-button" type="submit">Enviar solicitud</button></div></form></section>;
}
function AscHome({ requests, review }: { requests: Request[]; review: (request: Request) => void }) {
 const pending = requests.filter((request) => request.status === 'Pendiente de revisión ASC');
 return <><section className="welcome-panel flow-header"><div><p className="eyebrow">BANDEJA ASC</p><h2>Revisa solicitudes de editables</h2><p>Verifica la guía, su versión vigente y los documentos necesarios antes de compartir o rechazar.</p></div></section><section className="process-note asc-note"><span>1</span><p>Revisar la solicitud y la documentación relacionada.</p><span>2</span><p>Compartir carpeta de editables o rechazar indicando el motivo.</p></section><RequestList title="Solicitudes pendientes" requests={pending} empty="No tienes solicitudes pendientes de revisión." action={review} /></>;
}
function Review({ request, cancel, approve, reject }: { request: Request; cancel: () => void; approve: (folder: string) => void; reject: (note: string) => void }) {
 const [decision, setDecision] = useState<'share' | 'reject'>('share'); const [detail, setDetail] = useState('');
 return <section className="card form-card"><p className="eyebrow">REVISIÓN ASC</p><h2>{request.guide}</h2><div className="request-summary"><p><strong>Motivo indicado</strong>{request.reason}</p></div><form className="form-stack" onSubmit={(event) => { event.preventDefault(); if (!detail.trim()) return; decision === 'share' ? approve(detail) : reject(detail); }}><label>Decisión<select value={decision} onChange={(event) => setDecision(event.target.value as 'share' | 'reject')}><option value="share">Compartir carpeta con archivos editables</option><option value="reject">Rechazar solicitud</option></select></label><label>{decision === 'share' ? 'Enlace o ubicación de la carpeta compartida' : 'Motivo del rechazo'}<textarea rows={4} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={decision === 'share' ? 'Ej. SharePoint / Producción / Guías / GP-031' : 'Indica qué debe corregirse antes de volver a solicitarla.'} required /></label><div className="dialog-actions"><button className="secondary-button" type="button" onClick={cancel}>Volver</button><button className={decision === 'reject' ? 'danger-button' : 'primary-button'} type="submit">{decision === 'share' ? 'Compartir editable' : 'Rechazar solicitud'}</button></div></form></section>;
}
function RequestList({ title, requests, empty, action }: { title: string; requests: Request[]; empty: string; action?: (request: Request) => void }) {
 return <section className="requests card"><div className="section-heading"><div><p className="eyebrow">SEGUIMIENTO</p><h2>{title}</h2></div></div>{requests.length === 0 ? <p className="empty-copy">{empty}</p> : <div className="table-wrap"><table><thead><tr><th>Guía</th><th>Motivo / respuesta</th><th>Estado</th>{action && <th />}</tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><strong>{request.guide}</strong><small>Solicitud #{String(request.id).slice(-5)}</small></td><td>{request.response || request.reason}</td><td><Status status={request.status} /></td>{action && <td><button className="row-action" type="button" onClick={() => action(request)}>Revisar</button></td>}</tr>)}</tbody></table></div>}</section>;
}
function Status({ status }: { status: Status }) { const tone = status === 'Pendiente de revisión ASC' ? 'review' : status === 'Editable compartido' ? 'available' : 'rejected'; return <span className={'status ' + tone}>{status}</span>; }