/* Logger mínimo: JSON en producción (lo indexan Render/Railway), legible en local. */
import { env } from '../config/env.js';

function write(level, msg, meta = {}) {
  if (env.isTest && level !== 'error') return;
  if (env.isProd) {
    const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...meta });
    (level === 'error' ? console.error : console.log)(line);
    return;
  }
  const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  const tag = { info: '·', warn: '!', error: '✖' }[level];
  (level === 'error' ? console.error : console.log)(`${tag} ${msg}${extra}`);
}

export const log = {
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta)
};
