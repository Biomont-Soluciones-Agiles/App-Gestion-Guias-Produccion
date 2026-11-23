const { session } = require('../_auth'); module.exports = (req,res) => { const data=session(req); res.status(data?200:401).json(data||{error:'Sesión no iniciada'}); };
