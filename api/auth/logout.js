const { set } = require('../_auth'); module.exports = (req,res) => { set(res,'gp_session','',0); set(res,'gp_graph','',0); res.status(204).end(); };
