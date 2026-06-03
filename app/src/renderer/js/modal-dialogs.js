import { state } from './state.js';
import { translations } from './i18n.js';

function getText(key, fallback) {
  return translations[state.currentLang]?.[key] || translations.tr?.[key] || fallback;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function createDialogOverlay({ title, message, danger = false, confirm = false }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay oslo-runtime-dialog';
  overlay.innerHTML = `
    <div class="modal-card" style="width: min(440px, calc(100vw - 32px)); border-color: ${danger ? 'rgba(239, 68, 68, 0.45)' : 'var(--accent-color)'}; background: rgba(11, 12, 14, 0.92); box-shadow: 0 14px 38px rgba(0,0,0,0.55);">
      <div class="modal-header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding: 16px 20px;">
        <h3 style="font-size: 16px; margin: 0;">${escapeHtml(title)}</h3>
        <button class="modal-close-btn" type="button" aria-label="${escapeHtml(getText('modal-close', 'Kapat'))}">&times;</button>
      </div>
      <div class="modal-body" style="padding: 20px; font-size: 13px; color: var(--text-muted); line-height: 1.55; white-space: pre-wrap;">${escapeHtml(message)}</div>
      <div class="modal-footer" style="border-top: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0,0,0,0.12); padding: 12px 20px; gap: 10px;">
        ${confirm ? `<button class="modal-btn secondary-btn btn-cancel" type="button" style="min-width: 88px; justify-content: center;">${escapeHtml(getText('modal-cancel', 'İptal'))}</button>` : ''}
        <button class="modal-btn primary-btn btn-ok" type="button" style="min-width: 88px; justify-content: center; ${danger ? 'background: #ef4444; color: #fff; border: none;' : 'background: var(--accent-gradient); color: #000; border: none;'}">${escapeHtml(getText('modal-ok', 'Tamam'))}</button>
      </div>
    </div>
  `;
  return overlay;
}

export function showOsloAlert(title, message) {
  return new Promise(resolve => {
    const overlay = createDialogOverlay({ title, message });
    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 160);
    };

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.querySelector('.btn-ok')?.addEventListener('click', close);
    overlay.querySelector('.modal-close-btn')?.addEventListener('click', close);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) close();
    });
  });
}

export function showOsloConfirm(title, message, options = {}) {
  return new Promise(resolve => {
    const overlay = createDialogOverlay({ title, message, danger: options.danger !== false, confirm: true });
    const cleanup = result => {
      overlay.classList.remove('open');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 160);
    };

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.querySelector('.btn-ok')?.addEventListener('click', () => cleanup(true));
    overlay.querySelector('.btn-cancel')?.addEventListener('click', () => cleanup(false));
    overlay.querySelector('.modal-close-btn')?.addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', event => {
      if (event.target === overlay) cleanup(false);
    });
  });
}

export function installNativeAlertBridge(defaultTitle = 'OSLO Browser') {
  window.alert = message => {
    showOsloAlert(defaultTitle, String(message ?? ''));
  };
}
