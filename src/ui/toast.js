import { esc } from './format.js';

let container;

export function toast(message, kind = 'info', ms = 6000) {
  container ||= document.getElementById('toasts');
  const colors = {
    info: 'border-sky-500/40 text-sky-100',
    warn: 'border-amber-500/40 text-amber-100',
    error: 'border-rose-500/40 text-rose-100',
    success: 'border-emerald-500/40 text-emerald-100',
  };
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.className = `pointer-events-auto max-w-sm rounded-lg border bg-slate-900/95 px-4 py-2.5 text-sm shadow-xl backdrop-blur transition-opacity duration-300 ${colors[kind] || colors.info}`;
  el.innerHTML = esc(message);
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, ms);
}
