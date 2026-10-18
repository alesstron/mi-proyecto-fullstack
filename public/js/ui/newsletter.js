/* Newsletter del footer: validación, alta en la API y estado de éxito animado. */
import { $, EASE, motion, shake } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast } from './toast.js';
import { EMAIL_RE } from '../../shared/constraints.js';

export function initNewsletter() {
  const form = $('#newsForm'), input = $('#newsEmail'), btn = $('#newsBtn');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = input.value.trim();
    if (!EMAIL_RE.test(email)) {
      shake(form);
      input.setAttribute('aria-invalid', 'true');
      toast({ type: 'error', title: 'Ese correo no es válido', desc: 'Usa el formato nombre@dominio.com.' });
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    try {
      await api('/api/newsletter/subscribe', { method: 'POST', body: { email, website: $('#newsWebsite').value } });
      form.classList.add('is-done');
      btn.textContent = 'Suscrito ✓';
      if (!motion.reduced) btn.animate([{ transform: 'scale(.92)' }, { transform: 'scale(1.04)' }, { transform: 'none' }], { duration: 380, easing: EASE });
      toast({ type: 'success', title: 'Suscripción confirmada', desc: 'Te enviamos un correo de bienvenida. La próxima carta llega el primer lunes del mes.' });
      input.value = '';
      setTimeout(() => { form.classList.remove('is-done'); btn.textContent = 'Suscribirme'; }, 3200);
    } catch (err) {
      btn.textContent = 'Suscribirme';
      if (err.status === 409) {
        toast({ type: 'info', title: 'Ya estabas en la lista', desc: err.message });
      } else {
        shake(form);
        if (err.code === 'VALIDATION_ERROR') input.setAttribute('aria-invalid', 'true');
        toast({ type: 'error', title: 'No pudimos suscribirte', desc: err.message });
      }
    } finally {
      btn.disabled = false;
    }
  });
}
