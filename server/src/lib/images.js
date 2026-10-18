/* =========================================================
   Imágenes: CDN + formatos modernos.
   - Con Cloudinary configurado: f_auto,q_auto (AVIF/WebP según
     el navegador) mediante "fetch" de la URL remota o sobre
     las imágenes ya subidas a la cuenta.
   - Sin Cloudinary: parámetros de Unsplash (auto=format).
   ========================================================= */
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const WIDTHS = [480, 800, 1200];

export function optimizedImage(url, width) {
  if (!url) return null;
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  const t = `f_auto,q_auto,c_fill,w_${width}`;

  if (cloud) {
    const own = `https://res.cloudinary.com/${cloud}/image/upload/`;
    if (url.startsWith(own)) return own + t + '/' + url.slice(own.length);
    return `https://res.cloudinary.com/${cloud}/image/fetch/${t}/${encodeURIComponent(url)}`;
  }
  if (url.startsWith('https://images.unsplash.com/')) {
    const u = new URL(url);
    u.searchParams.set('auto', 'format');
    u.searchParams.set('fit', 'crop');
    u.searchParams.set('w', String(width));
    u.searchParams.set('q', '70');
    return u.toString();
  }
  return url;
}

/** { src, srcset } listo para <img srcset sizes>. */
export function imageSet(url, widths = WIDTHS) {
  if (!url) return null;
  return {
    src: optimizedImage(url, 800),
    srcset: widths.map(w => `${optimizedImage(url, w)} ${w}w`).join(', ')
  };
}

/** Imagen 1200×630 en JPEG para Open Graph / Twitter Cards. */
export function ogImage(url) {
  if (!url) return null;
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  if (cloud) {
    return `https://res.cloudinary.com/${cloud}/image/fetch/f_jpg,q_auto,c_fill,w_1200,h_630/${encodeURIComponent(url)}`;
  }
  if (url.startsWith('https://images.unsplash.com/')) {
    const u = new URL(url);
    u.search = 'fm=jpg&fit=crop&w=1200&h=630&q=75';
    return u.toString();
  }
  return url;
}

export const uploadsEnabled = () =>
  Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

/**
 * Firma para subida directa desde el navegador a Cloudinary.
 * El secreto nunca sale del servidor; el cliente solo recibe la firma.
 */
export function signUpload({ folder }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp };
  const toSign = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const signature = crypto.createHash('sha1').update(toSign + env.CLOUDINARY_API_SECRET).digest('hex');
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: env.CLOUDINARY_API_KEY,
    folder,
    timestamp,
    signature
  };
}
