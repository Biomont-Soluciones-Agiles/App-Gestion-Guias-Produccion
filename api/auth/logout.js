const { set } = require('../_auth'); module.exports = (req,res) => { set(res,'gp_session','',0); res.status(204).end(); };
