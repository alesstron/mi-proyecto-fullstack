/* PWA: registro del Service Worker y avisos de conexión. */
import { toast } from './ui/toast.js';

export function initPwa() {
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && secure) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* sin SW la web funciona igual */ });
    });
  }
  addEventListener('offline', () => toast({ type: 'error', title: 'Sin conexión', desc: 'Puedes seguir mirando destinos; las reservas se enviarán cuando vuelvas.' }));
  addEventListener('online', () => toast({ type: 'success', title: 'Conexión recuperada', duration: 2500 }));
}
