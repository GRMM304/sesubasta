/* Credentials, tokens, cookies and rate limits for the local demo server.
   Uses only node:crypto. Passwords are hashed with scrypt; tokens are stored as SHA-256 digests. */
const crypto=require('node:crypto');

const SCRYPT={N:16384,r:8,p:1,keylen:64};
function hashPassword(password){const salt=crypto.randomBytes(16);const key=crypto.scryptSync(String(password),salt,SCRYPT.keylen,{N:SCRYPT.N,r:SCRYPT.r,p:SCRYPT.p});return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`}
function verifyPassword(password,stored){if(typeof stored!=='string'||!stored.startsWith('scrypt$'))return false;const [,salt,key]=stored.split('$');const expected=Buffer.from(key,'base64');const actual=crypto.scryptSync(String(password),Buffer.from(salt,'base64'),expected.length,{N:SCRYPT.N,r:SCRYPT.r,p:SCRYPT.p});return crypto.timingSafeEqual(expected,actual)}
/* Same work for unknown accounts so response time does not reveal whether an email exists. */
const DUMMY_HASH=hashPassword('cuenta-inexistente');

const randomToken=(bytes=32)=>crypto.randomBytes(bytes).toString('base64url');
const digest=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const id=prefix=>prefix+'_'+crypto.randomBytes(9).toString('base64url');
const code6=()=>String(crypto.randomInt(0,1000000)).padStart(6,'0');
const referenceCode=prefix=>prefix+'-'+crypto.randomBytes(4).toString('hex').toUpperCase();

function passwordProblem(password){const p=String(password||'');if(p.length<10)return 'La contraseña debe tener al menos 10 caracteres.';if(!/[a-záéíóúñ]/i.test(p)||!/\d/.test(p))return 'Usa letras y al menos un número.';if(p.length>128)return 'La contraseña es demasiado larga.';return null}
const normalizeEmail=email=>String(email||'').trim().toLowerCase();
const validEmail=email=>/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(String(email||'').trim());

function parseCookies(header){const out={};for(const part of String(header||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}return out}
function cookie(name,value,{maxAge,secure=false,sameSite='Lax',path='/'}={}){return [`${name}=${encodeURIComponent(value)}`,`Path=${path}`,'HttpOnly',`SameSite=${sameSite}`,secure?'Secure':'',maxAge!==undefined?`Max-Age=${maxAge}`:''].filter(Boolean).join('; ')}

/* Sliding-window limiter kept in memory; enough for a single local process. */
class RateLimiter{constructor(){this.hits=new Map()}
 check(key,limit,windowMs){const now=Date.now();const list=(this.hits.get(key)||[]).filter(t=>now-t<windowMs);if(list.length>=limit){this.hits.set(key,list);return false}list.push(now);this.hits.set(key,list);return true}}

/* Validates the magic bytes of uploaded files instead of trusting the extension or declared type. */
function sniff(buffer){if(buffer.length<12)return null;if(buffer[0]===0x89&&buffer.toString('ascii',1,4)==='PNG')return 'image/png';if(buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return 'image/jpeg';if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return 'image/webp';if(buffer.toString('ascii',0,5)==='%PDF-')return 'application/pdf';return null}
function decodeUpload(dataUrl,{allowed,maxBytes}){const m=/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl||''));if(!m)return {error:'El archivo no es válido.'};const buffer=Buffer.from(m[2],'base64');if(!buffer.length)return {error:'El archivo está vacío.'};if(buffer.length>maxBytes)return {error:`El archivo supera ${Math.round(maxBytes/1e6)} MB.`};const mime=sniff(buffer);if(!mime||!allowed.includes(mime))return {error:'Formato no permitido.'};return {buffer,mime}}

module.exports={hashPassword,verifyPassword,DUMMY_HASH,randomToken,digest,id,code6,referenceCode,passwordProblem,normalizeEmail,validEmail,parseCookies,cookie,RateLimiter,decodeUpload};
