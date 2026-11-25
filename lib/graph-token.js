const crypto = require('crypto');

function key() {
  return crypto.createHash('sha256').update(process.env.AUTH_SESSION_SECRET).update('graph-token-v1').digest();
}
function encrypt(token) {
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const payload=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),payload]).toString('base64url');
}
function decrypt(value) {
  try {
    const bytes=Buffer.from(value,'base64url');
    const cipher=crypto.createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));
    cipher.setAuthTag(bytes.subarray(12,28));
    return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8');
  } catch {return null;}
}
module.exports={encrypt,decrypt};
