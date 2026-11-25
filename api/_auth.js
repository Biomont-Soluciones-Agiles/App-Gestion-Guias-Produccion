const crypto = require('crypto');
const parse = req => Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=')).filter(v => v.length === 2));
const sign = value => crypto.createHmac('sha256', process.env.AUTH_SESSION_SECRET).update(value).digest('base64url');
const encode = data => { const value = Buffer.from(JSON.stringify(data)).toString('base64url'); return `${value}.${sign(value)}`; };
const decode = token => { if (!token) return null; const [value, signature] = token.split('.'); if (!value || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(value)))) return null; try { const data = JSON.parse(Buffer.from(value, 'base64url').toString()); return data.exp > Date.now() ? data : null; } catch { return null; } };
const set = (res, name, value, seconds) => {
  const cookie = `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
  const existing = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', existing ? [...(Array.isArray(existing) ? existing : [existing]), cookie] : cookie);
};
const session = req => decode(parse(req).gp_session);
const hasRole = (user, role) => user?.role === 'Administrador' || user?.role === role || user?.roles?.includes(role);
module.exports = { parse, encode, decode, set, session, hasRole };
