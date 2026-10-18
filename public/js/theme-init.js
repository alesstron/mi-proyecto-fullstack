/* Tema inicial antes de pintar: preferencia guardada o la del sistema. Script clásico y bloqueante a propósito. */
(function () {
  var t;
  try { t = localStorage.getItem('rn-theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  document.documentElement.classList.add('js');
})();
