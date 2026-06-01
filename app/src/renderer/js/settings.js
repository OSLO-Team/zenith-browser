// OSLO Browser - Settings Management Module
import { state } from './state.js';
import { applyLanguage, translations } from './i18n.js';
import { renderBookmarks, renderBookmarksBar } from './panels.js';
import { updateBookmarkIcon } from './tabs.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

const appearanceDefaults = {
  theme: 'dark',
  accentColor: '#00ddff',
  compactMode: false,
  tabCornerStyle: 'rounded',
  activeTabStyle: 'filled',
  tabHeight: 36,
  sidebarAutoHide: false,
  sidebarIconOnly: false,
  sidebarWidth: 240,
  topBarAutoHide: false,
  uiFontSize: 'normal',
  defaultPageZoom: 1,
  reduceMotion: false,
  transparencyEnabled: true,
  customCss: '',
  customCssEnabled: true,
  newtabBackgroundType: 'default',
  newtabWallpaper: '',
  newtabBackgroundColor: '#0b0c0e',
  newtabPresetWallpaper: 'aurora',
  newtabShowClock: true,
  newtabShowDate: true,
  newtabShowWeather: true,
  newtabShowSearch: true,
  newtabShowShortcuts: true
};

const appearanceSettingKeys = new Set(Object.keys(appearanceDefaults));
let appearanceSettings = { ...appearanceDefaults };
let systemThemeQuery = null;

const newtabSurfaceBackgrounds = {
  aurora: 'radial-gradient(circle at 20% 20%, rgba(0, 221, 255, 0.28), transparent 34%), radial-gradient(circle at 78% 18%, rgba(139, 92, 246, 0.22), transparent 30%), linear-gradient(135deg, #071014 0%, #111827 100%)',
  dawn: 'linear-gradient(135deg, #1f2937 0%, #7c2d12 45%, #f59e0b 100%)',
  forest: 'linear-gradient(135deg, #052e16 0%, #14532d 45%, #0f172a 100%)',
  mono: 'linear-gradient(135deg, #0f172a 0%, #27272a 50%, #111827 100%)'
};

const privacyCheckboxControls = {
  clearCookiesOnExit: 'settings-clear-cookies-on-exit',
  fingerprintProtection: 'settings-fingerprint-protection',
  globalPrivacyControl: 'settings-global-privacy-control',
  webRtcIpProtection: 'settings-webrtc-protection',
  passwordSecurityWarnings: 'settings-password-security-warnings',
  clearHistoryOnExit: 'settings-clear-history-on-exit',
  clearCacheOnExit: 'settings-clear-cache-on-exit',
  clearDownloadsOnExit: 'settings-clear-downloads-on-exit',
  clearLocalStorageOnExit: 'settings-clear-local-storage-on-exit',
  incognitoForgetDownloads: 'settings-incognito-forget-downloads',
  incognitoBlockThirdPartyCookies: 'settings-incognito-block-third-party-cookies',
  sleepTabsEnabled: 'settings-sleep-tabs-checkbox',
  downloadPromptEnabled: 'settings-download-prompt-checkbox',
  telemetryEnabled: 'settings-telemetry-checkbox'
};

const privacySelectControls = {
  cookiePolicy: 'settings-cookie-policy',
  trackingProtectionLevel: 'settings-tracking-protection-level',
  refererPolicy: 'settings-referer-policy',
  dangerousDownloadsProtection: 'settings-dangerous-downloads',
  permissionNotifications: 'settings-permission-notifications',
  permissionCamera: 'settings-permission-camera',
  permissionMicrophone: 'settings-permission-microphone',
  permissionLocation: 'settings-permission-location',
  permissionClipboard: 'settings-permission-clipboard',
  permissionAutoplay: 'settings-permission-autoplay',
  sleepTabsTimeout: 'settings-sleep-tabs-timeout'
};

const privacyTextControls = {
  httpsOnlyExceptions: 'settings-https-exceptions',
  dnsOverHttpsCustomProvider: 'settings-dns-custom-provider'
};

function getText(key, fallback) {
  return translations[state.currentLang]?.[key] || fallback;
}

function updateDnsCustomProviderVisibility() {
  const provider = document.getElementById('settings-dns-provider');
  const customProvider = document.getElementById('settings-dns-custom-provider');
  if (customProvider && provider) {
    customProvider.style.display = provider.value === 'custom' ? 'block' : 'none';
  }
}

function normalizeHexColor(value, fallback = '#00ddff') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function hexToRgb(hex) {
  const clean = normalizeHexColor(hex).replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function shadeHexColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const next = [r, g, b].map(channel => {
    const value = amount < 0
      ? channel * (1 + amount)
      : channel + (255 - channel) * amount;
    return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
  });
  return `#${next.join('')}`;
}

function applyAccentColor(value) {
  const color = normalizeHexColor(value);
  const rgb = hexToRgb(color);
  const darker = shadeHexColor(color, -0.32);
  const root = document.documentElement;
  const body = document.body;
  root.style.setProperty('--accent-color', color);
  root.style.setProperty('--accent-blue', darker);
  root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${color} 0%, ${darker} 100%)`);
  root.style.setProperty('--accent-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
  root.style.setProperty('--accent-soft-hover', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`);
  root.style.setProperty('--border-focus', color);
  body.style.setProperty('--accent-color', color);
  body.style.setProperty('--accent-blue', darker);
  body.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${color} 0%, ${darker} 100%)`);
  body.style.setProperty('--accent-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
  body.style.setProperty('--accent-soft-hover', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`);
  body.style.setProperty('--border-focus', color);
}

function resolveThemeMode(mode) {
  if (mode === 'system') {
    if (!systemThemeQuery && window.matchMedia) {
      systemThemeQuery = window.matchMedia('(prefers-color-scheme: light)');
      const handleSystemThemeChange = () => applyAppearancePreferences();
      if (typeof systemThemeQuery.addEventListener === 'function') {
        systemThemeQuery.addEventListener('change', handleSystemThemeChange);
      } else if (typeof systemThemeQuery.addListener === 'function') {
        systemThemeQuery.addListener(handleSystemThemeChange);
      }
    }
    return systemThemeQuery?.matches ? 'light' : 'dark';
  }
  return mode === 'light' ? 'light' : 'dark';
}

function sanitizeCssUrl(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, '');
}

function isActiveNewTab() {
  const activeTab = state.tabs[state.activeTabId];
  if (!activeTab) return true;

  const url = activeTab.url || '';
  return !url || url === 'oslo://newtab' || url.includes('newtab.html');
}

function getNewTabSurface() {
  const resolvedTheme = resolveThemeMode(appearanceSettings.theme);
  const type = appearanceSettings.newtabBackgroundType || 'default';
  const wallpaper = (appearanceSettings.newtabWallpaper || '').trim();

  if ((type === 'url' || type === 'file') && wallpaper) {
    return {
      color: resolvedTheme === 'light' ? '#f3f4f6' : '#0b0c0e',
      image: `linear-gradient(rgba(0, 0, 0, 0.38), rgba(0, 0, 0, 0.38)), url("${sanitizeCssUrl(wallpaper)}")`
    };
  }

  if (type === 'color') {
    return {
      color: normalizeHexColor(appearanceSettings.newtabBackgroundColor, resolvedTheme === 'light' ? '#f3f4f6' : '#0b0c0e'),
      image: 'none'
    };
  }

  if (type === 'preset') {
    return {
      color: '#0b0c0e',
      image: newtabSurfaceBackgrounds[appearanceSettings.newtabPresetWallpaper] || newtabSurfaceBackgrounds.aurora
    };
  }

  return resolvedTheme === 'light'
    ? { color: '#f3f4f6', image: 'linear-gradient(135deg, #f8fafc 0%, #e5e7eb 100%)' }
    : { color: '#0b0c0e', image: newtabSurfaceBackgrounds.aurora };
}

export function syncContentAreaSurface() {
  const contentArea = document.getElementById('content-area');
  if (!contentArea) return;

  const isNewTab = isActiveNewTab();
  const surface = isNewTab
    ? getNewTabSurface()
    : { color: 'var(--bg-primary)', image: 'none' };

  contentArea.classList.toggle('newtab-surface', isNewTab);
  contentArea.style.setProperty('--content-surface-color', surface.color);
  contentArea.style.setProperty('--content-surface-image', surface.image);
}

function applyThemeMode(mode) {
  const resolved = resolveThemeMode(mode);
  document.body.classList.toggle('light-mode', resolved === 'light');
  document.body.classList.toggle('dark-mode', resolved !== 'light');
}

function updateAccentSwatches() {
  const activeColor = normalizeHexColor(appearanceSettings.accentColor).toLowerCase();
  document.querySelectorAll('.settings-color-swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.accent?.toLowerCase() === activeColor);
  });
}

function updateBackgroundPanels() {
  const type = appearanceSettings.newtabBackgroundType || 'default';
  document.querySelectorAll('[data-background-panel]').forEach((panel) => {
    panel.style.display = panel.dataset.backgroundPanel === type ? 'flex' : 'none';
  });
}

function updateAppearanceControl(key, value) {
  const controlMap = {
    theme: ['settings-theme-mode', 'value'],
    accentColor: ['settings-accent-color', 'value'],
    compactMode: ['settings-compact-mode', 'checked'],
    tabCornerStyle: ['settings-tab-corner-style', 'value'],
    activeTabStyle: ['settings-active-tab-style', 'value'],
    tabHeight: ['settings-tab-height', 'value'],
    sidebarAutoHide: ['settings-sidebar-auto-hide', 'checked'],
    sidebarWidth: ['settings-sidebar-width', 'value'],
    topBarAutoHide: ['settings-topbar-auto-hide', 'checked'],
    uiFontSize: ['settings-ui-font-size', 'value'],
    defaultPageZoom: ['settings-default-page-zoom', 'value'],
    reduceMotion: ['settings-reduce-motion', 'checked'],
    transparencyEnabled: ['settings-transparency-enabled', 'checked'],
    customCssEnabled: ['settings-custom-css-enabled', 'checked'],
    newtabBackgroundType: ['settings-newtab-background-type', 'value'],
    newtabWallpaper: ['settings-wallpaper-url', 'value'],
    newtabBackgroundColor: ['settings-newtab-background-color', 'value'],
    newtabPresetWallpaper: ['settings-newtab-preset-wallpaper', 'value'],
    newtabShowClock: ['settings-newtab-show-clock', 'checked'],
    newtabShowDate: ['settings-newtab-show-date', 'checked'],
    newtabShowWeather: ['settings-newtab-show-weather', 'checked'],
    newtabShowSearch: ['settings-newtab-show-search', 'checked'],
    newtabShowShortcuts: ['settings-newtab-show-shortcuts', 'checked']
  };

  if (key === 'customCss') {
    const textarea = document.getElementById('settings-custom-css');
    if (textarea && document.activeElement !== textarea) textarea.value = value || '';
  }

  const controlConfig = controlMap[key];
  if (controlConfig) {
    const [id, property] = controlConfig;
    const control = document.getElementById(id);
    if (control) control[property] = value;
  }

  const tabHeightValue = document.getElementById('settings-tab-height-value');
  if (tabHeightValue) tabHeightValue.textContent = `${appearanceSettings.tabHeight}px`;

  const sidebarWidthValue = document.getElementById('settings-sidebar-width-value');
  if (sidebarWidthValue) sidebarWidthValue.textContent = `${appearanceSettings.sidebarWidth}px`;

  const fileLabel = document.getElementById('settings-wallpaper-file-label');
  if (fileLabel) {
    if (appearanceSettings.newtabWallpaper && appearanceSettings.newtabBackgroundType === 'file') {
      fileLabel.textContent = decodeURIComponent(appearanceSettings.newtabWallpaper.split('/').pop() || appearanceSettings.newtabWallpaper);
    } else {
      fileLabel.textContent = getText('wallpaper-file-empty', 'Dosya seçilmedi.');
    }
  }

  updateAccentSwatches();
  updateBackgroundPanels();
}

function applyAppearancePreferences() {
  applyThemeMode(appearanceSettings.theme);
  applyAccentColor(appearanceSettings.accentColor);

  const body = document.body;
  body.classList.toggle('compact-mode', !!appearanceSettings.compactMode);
  body.classList.toggle('sidebar-auto-hide', !!appearanceSettings.sidebarAutoHide);
  body.classList.toggle('topbar-auto-hide', !!appearanceSettings.topBarAutoHide);
  body.classList.toggle('reduce-motion', !!appearanceSettings.reduceMotion);
  body.classList.toggle('transparency-enabled', !!appearanceSettings.transparencyEnabled);
  body.classList.toggle('transparency-disabled', !appearanceSettings.transparencyEnabled);

  ['rounded', 'soft', 'square'].forEach(style => {
    body.classList.toggle(`tab-corners-${style}`, appearanceSettings.tabCornerStyle === style);
  });
  ['filled', 'outline', 'underline'].forEach(style => {
    body.classList.toggle(`active-tab-${style}`, appearanceSettings.activeTabStyle === style);
  });
  ['small', 'normal', 'large'].forEach(size => {
    body.classList.toggle(`ui-font-${size}`, appearanceSettings.uiFontSize === size);
  });

  const tabHeight = Math.max(32, Math.min(52, parseInt(appearanceSettings.tabHeight, 10) || 36));
  const sidebarWidth = Math.max(220, Math.min(320, parseInt(appearanceSettings.sidebarWidth, 10) || 240));
  document.documentElement.style.setProperty('--tab-item-height', `${tabHeight}px`);
  document.documentElement.style.setProperty('--sidebar-width-expanded', `${sidebarWidth}px`);

  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    if (appearanceSettings.sidebarIconOnly) {
      sidebar.classList.add('collapsed');
      sidebar.classList.remove('expanded');
    } else {
      sidebar.classList.add('expanded');
      sidebar.classList.remove('collapsed');
    }
  }

  applyLocalCustomCss(appearanceSettings.customCss || '');
  updateAppearanceControl('tabHeight', appearanceSettings.tabHeight);
  updateAppearanceControl('sidebarWidth', appearanceSettings.sidebarWidth);
  syncContentAreaSurface();
  window.dispatchEvent(new Event('resize'));
}

function applyAppearanceSetting(key, value) {
  appearanceSettings = { ...appearanceSettings, [key]: value };
  updateAppearanceControl(key, value);
  applyAppearancePreferences();
}

export function applySettingChange(key, value) {
  if (appearanceSettingKeys.has(key)) {
    applyAppearanceSetting(key, value);
    return;
  }

  if (privacyCheckboxControls[key]) {
    const checkbox = document.getElementById(privacyCheckboxControls[key]);
    if (checkbox) checkbox.checked = !!value;
    if (key === 'sleepTabsEnabled') {
      const container = document.getElementById('settings-sleep-tabs-timeout-row');
      if (container) container.style.display = value ? 'flex' : 'none';
    }
    return;
  }

  if (privacySelectControls[key]) {
    const select = document.getElementById(privacySelectControls[key]);
    if (select) select.value = value;
    return;
  }

  if (privacyTextControls[key]) {
    const input = document.getElementById(privacyTextControls[key]);
    if (input && document.activeElement !== input) input.value = value || '';
    return;
  }

  switch (key) {
    case 'theme': {
      applyAppearanceSetting('theme', value);
      break;
    }
    case 'language': {
      const select = document.getElementById('settings-language');
      if (select) select.value = value;
      applyLanguage(value);
      break;
    }
    case 'searchEngine': {
      const select = document.getElementById('settings-search-engine');
      if (select) select.value = value;
      break;
    }
    case 'adblockEnabled': {
      const checkbox = document.getElementById('settings-adblock-checkbox');
      if (checkbox) checkbox.checked = !!value;
      break;
    }
    case 'httpsOnlyEnabled': {
      const checkbox = document.getElementById('settings-https-checkbox');
      if (checkbox) checkbox.checked = !!value;
      const container = document.getElementById('settings-https-exceptions-container');
      if (container) container.style.display = value ? 'flex' : 'none';
      break;
    }
    case 'customCss': {
      const textarea = document.getElementById('settings-custom-css');
      if (textarea) textarea.value = value || '';
      applyLocalCustomCss(value || '');
      break;
    }
    case 'newtabWallpaper': {
      const input = document.getElementById('settings-wallpaper-url');
      if (input) input.value = value || '';
      break;
    }
    case 'bookmarksBarEnabled': {
      const checkbox = document.getElementById('settings-bookmarks-bar-checkbox');
      if (checkbox) checkbox.checked = !!value;

      const bookmarksBar = document.getElementById('bookmarks-bar');
      if (bookmarksBar) {
        bookmarksBar.style.display = value ? 'flex' : 'none';
      }
      // Notify layout resize bounds
      window.dispatchEvent(new Event('resize'));
      break;
    }
    case 'homeButtonEnabled': {
      const checkbox = document.getElementById('settings-home-checkbox');
      if (checkbox) checkbox.checked = !!value;

      const container = document.getElementById('settings-home-url-container');
      if (container) container.style.display = value ? 'flex' : 'none';

      const navHome = document.getElementById('nav-home');
      if (navHome) navHome.style.display = value ? 'flex' : 'none';

      // Notify layout resize bounds
      window.dispatchEvent(new Event('resize'));
      break;
    }
    case 'homePageUrl': {
      const input = document.getElementById('settings-home-url');
      if (input) input.value = value || '';
      break;
    }
    case 'blockedCount': {
      const el = document.getElementById('settings-blocked-count');
      if (el) {
        el.textContent = value;
        el.style.transform = 'scale(1.25)';
        el.style.color = '#ef4444';
        el.style.transition = 'all 0.1s ease';
        setTimeout(() => {
          el.style.transform = 'scale(1)';
          el.style.color = '';
        }, 150);
      }
      break;
    }
    case 'historyLimit': {
      const select = document.getElementById('settings-history-limit');
      if (select) select.value = value;
      break;
    }
    case 'telemetryEnabled': {
      const checkbox = document.getElementById('settings-telemetry-checkbox');
      if (checkbox) checkbox.checked = !!value;
      break;
    }
    case 'dnsOverHttpsEnabled': {
      const checkbox = document.getElementById('settings-dns-checkbox');
      if (checkbox) checkbox.checked = !!value;
      const container = document.getElementById('settings-dns-provider-container');
      if (container) container.style.display = value ? 'flex' : 'none';
      updateDnsCustomProviderVisibility();
      break;
    }
    case 'dnsOverHttpsProvider': {
      const select = document.getElementById('settings-dns-provider');
      if (select) select.value = value || 'cloudflare';
      updateDnsCustomProviderVisibility();
      break;
    }
    case 'sessionRestoreEnabled': {
      const checkbox = document.getElementById('settings-session-restore-checkbox');
      if (checkbox) checkbox.checked = !!value;
      break;
    }
    case 'savePasswordsEnabled': {
      const checkbox = document.getElementById('settings-save-passwords-checkbox');
      if (checkbox) checkbox.checked = !!value;
      break;
    }
    case 'autofillEnabled': {
      const checkbox = document.getElementById('settings-autofill-checkbox');
      if (checkbox) checkbox.checked = !!value;
      break;
    }
  }
}

function applyLocalCustomCss(css, forcePreview = false) {
  let styleEl = document.getElementById('user-custom-css');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'user-custom-css';
    document.head.appendChild(styleEl);
  }
  const textarea = document.getElementById('settings-custom-css');
  const currentCss = textarea ? textarea.value : css;
  styleEl.textContent = (appearanceSettings.customCssEnabled || forcePreview) ? currentCss : '';
}

function showCustomCssStatus(messageKey) {
  const statusEl = document.getElementById('settings-custom-css-status');
  if (!statusEl) return;

  const msgs = {
    tr: {
      preview: 'Geçici önizleme uygulandı. Kalıcı olması için Kaydet butonuna basın.',
      save: 'Özel CSS kuralları başarıyla kaydedildi ve etkinleştirildi.',
      reset: 'Özel CSS kuralları sıfırlandı.'
    },
    en: {
      preview: 'Temporary preview applied. Click Save to make it permanent.',
      save: 'Custom CSS rules saved and activated successfully.',
      reset: 'Custom CSS rules have been reset.'
    },
    fr: {
      preview: 'Aperçu temporaire appliqué. Cliquez sur Enregistrer pour le rendre permanent.',
      save: 'Les règles CSS personnalisées ont été enregistrées et activées.',
      reset: 'Les règles CSS personnalisées ont été réinitialisées.'
    }
  };

  const lang = state.currentLang || 'en';
  const text = (msgs[lang] || msgs['en'])[messageKey];
  statusEl.textContent = text;
  statusEl.style.display = 'block';

  if (statusEl.timeoutId) {
    clearTimeout(statusEl.timeoutId);
  }

  statusEl.timeoutId = setTimeout(() => {
    statusEl.style.display = 'none';
  }, 4000);
}

function isWeakPassword(password) {
  const value = String(password || '');
  if (value.length < 10) return true;
  const hasLetter = /[a-zA-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^a-zA-Z0-9]/.test(value);
  return !(hasLetter && hasNumber && hasSymbol);
}

function generateStrongPassword(length = 20) {
  const groups = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%^&*()-_=+[]{};:,.?'
  ];
  const allChars = groups.join('');
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  const chars = groups.map((group, idx) => group[values[idx] % group.length]);
  for (let i = chars.length; i < length; i++) {
    chars.push(allChars[values[i] % allChars.length]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const swap = values[i] % (i + 1);
    [chars[i], chars[swap]] = [chars[swap], chars[i]];
  }
  return chars.join('');
}

function setGeneratedPassword() {
  const output = document.getElementById('generated-password-output');
  if (output) output.value = generateStrongPassword();
}

function formatDateTime(timestamp) {
  if (!timestamp) return '-';
  try {
    return new Date(timestamp).toLocaleString();
  } catch (err) {
    return '-';
  }
}

async function auditSavedPasswords() {
  const modal = document.getElementById('password-audit-modal');
  if (!modal) return;

  const loadingState = document.getElementById('password-audit-loading');
  const resultsState = document.getElementById('password-audit-results');
  if (loadingState) loadingState.style.display = 'flex';
  if (resultsState) resultsState.style.display = 'none';

  modal.classList.add('open');
  window.dispatchEvent(new Event('resize'));

  try {
    const audit = await window.oslo.auditPasswords();
    const totalCount = audit?.total || 0;
    const weakCount = audit?.weak || 0;
    const reusedCount = audit?.reused || 0;
    const breachedCount = audit?.breached || 0;

    const risksList = document.getElementById('audit-risks-list');
    const risksContainer = document.getElementById('audit-risks-container');
    const allSafeEl = document.getElementById('audit-all-safe');

    if (risksList) risksList.innerHTML = '';

    const issues = audit?.issues || [];

    const totalEl = document.getElementById('audit-total-count');
    const weakEl = document.getElementById('audit-weak-count');
    const reusedEl = document.getElementById('audit-reused-count');
    const breachedEl = document.getElementById('audit-breached-count');

    if (totalEl) totalEl.textContent = totalCount;
    if (weakEl) weakEl.textContent = weakCount;
    if (reusedEl) reusedEl.textContent = reusedCount;
    if (breachedEl) breachedEl.textContent = breachedCount;

    if (totalCount === 0) {
      if (risksContainer) risksContainer.style.display = 'none';
      if (allSafeEl) {
        allSafeEl.style.display = 'flex';
        const safeTitle = allSafeEl.querySelector('h4');
        const safeDesc = allSafeEl.querySelector('p');
        const safeIcon = allSafeEl.querySelector('div');
        if (safeTitle) safeTitle.textContent = getText('no-saved-passwords', 'Kayıtlı şifre bulunmuyor.');
        if (safeDesc) safeDesc.textContent = '';
        if (safeIcon) {
          safeIcon.innerHTML = `
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
          `;
          safeIcon.style.color = 'var(--text-muted)';
          safeIcon.style.backgroundColor = 'rgba(255,255,255,0.05)';
          safeIcon.style.boxShadow = 'none';
        }
      }
    } else if (issues.length === 0) {
      if (risksContainer) risksContainer.style.display = 'none';
      if (allSafeEl) {
        allSafeEl.style.display = 'flex';
        const safeTitle = allSafeEl.querySelector('h4');
        const safeDesc = allSafeEl.querySelector('p');
        const safeIcon = allSafeEl.querySelector('div');
        if (safeTitle) safeTitle.textContent = getText('password-audit-no-issues', 'Güvenlik riski bulunamadı!');
        if (safeDesc) {
          safeDesc.textContent = audit?.leakChecksFailed > 0
            ? getText('password-audit-leak-offline', 'Sızıntı kontrolü çevrimdışı kaldı; zayıf ve tekrarlanan şifre bulunmadı.')
            : getText('password-audit-safe-desc', 'Tüm şifreleriniz güçlü, benzersiz ve sızıntı listelerinde görünmüyor.');
        }
        if (safeIcon) {
          safeIcon.innerHTML = `
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
          `;
          safeIcon.style.color = '#10b981';
          safeIcon.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
          safeIcon.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.2)';
        }
      }
    } else {
      if (risksContainer) risksContainer.style.display = 'flex';
      if (allSafeEl) allSafeEl.style.display = 'none';

      issues.forEach(issue => {
        const row = document.createElement('div');
        row.className = 'password-audit-risk-row';
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background-color: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; gap: 10px;';

        const info = document.createElement('div');
        info.style.cssText = 'display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;';

        const origin = document.createElement('span');
        origin.style.cssText = 'color: var(--text-main); font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        origin.textContent = issue.origin;

        const username = document.createElement('span');
        username.style.cssText = 'color: var(--text-muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        username.textContent = issue.username;

        info.appendChild(origin);
        info.appendChild(username);

        const badgeContainer = document.createElement('div');
        badgeContainer.style.cssText = 'display: flex; gap: 6px; flex-shrink: 0;';

        if (issue.isWeak) {
          const badge = document.createElement('span');
          badge.style.cssText = 'font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 6px; background-color: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2);';
          badge.textContent = getText('password-audit-weak-label', 'Zayıf');
          badgeContainer.appendChild(badge);
        }

        if (issue.isReused) {
          const badge = document.createElement('span');
          badge.style.cssText = 'font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 6px; background-color: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2);';
          badge.textContent = getText('password-audit-reused-label', 'Tekrar');
          badgeContainer.appendChild(badge);
        }

        if (issue.isBreached) {
          const badge = document.createElement('span');
          badge.style.cssText = 'font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 6px; background-color: rgba(220, 38, 38, 0.16); color: #fecaca; border: 1px solid rgba(220, 38, 38, 0.35);';
          const count = issue.breachCount ? ` (${issue.breachCount})` : '';
          badge.textContent = `${getText('password-audit-breached-label', 'Sızıntı')}${count}`;
          badgeContainer.appendChild(badge);
        }

        row.appendChild(info);
        row.appendChild(badgeContainer);
        if (risksList) risksList.appendChild(row);
      });
    }

    setTimeout(() => {
      if (loadingState) loadingState.style.display = 'none';
      if (resultsState) resultsState.style.display = 'flex';
      window.dispatchEvent(new Event('resize'));
    }, 850);

  } catch (err) {
    console.error('Password audit failed:', err);
    if (loadingState) loadingState.style.display = 'none';
    alert(getText('password-audit-error', 'Şifre taraması tamamlanamadı.'));
    modal.classList.remove('open');
    window.dispatchEvent(new Event('resize'));
  }
}

function createPrivacyDataRow(title, subtitle, actionText, onAction) {
  const row = document.createElement('div');
  row.className = 'privacy-data-row';

  const info = document.createElement('div');
  info.className = 'privacy-data-info';

  const titleEl = document.createElement('div');
  titleEl.className = 'privacy-data-title';
  titleEl.textContent = title;

  const subtitleEl = document.createElement('div');
  subtitleEl.className = 'privacy-data-subtitle';
  subtitleEl.textContent = subtitle;

  info.appendChild(titleEl);
  info.appendChild(subtitleEl);

  const button = document.createElement('button');
  button.className = 'settings-action-btn danger privacy-data-action';
  button.type = 'button';
  button.textContent = actionText;
  button.addEventListener('click', onAction);

  row.appendChild(info);
  row.appendChild(button);
  return row;
}

async function renderSiteDataList() {
  const list = document.getElementById('site-data-list');
  if (!list) return;
  list.innerHTML = `<div class="privacy-empty">${getText('loading', 'Yükleniyor...')}</div>`;

  try {
    const siteData = await window.oslo.getSiteData();
    list.innerHTML = '';
    if (!siteData || siteData.length === 0) {
      list.innerHTML = `<div class="privacy-empty">${getText('no-site-data', 'Kayıtlı site verisi yok.')}</div>`;
      return;
    }

    siteData.forEach(item => {
      const subtitle = getText(
        'site-data-row-desc',
        '{cookies} çerez, {secure} güvenli, {session} oturum çerezi'
      )
        .replace('{cookies}', item.cookieCount || 0)
        .replace('{secure}', item.secureCookieCount || 0)
        .replace('{session}', item.sessionCookieCount || 0);
      const row = createPrivacyDataRow(
        item.domain || '-',
        subtitle,
        getText('clear-site-data', 'Temizle'),
        async () => {
          await window.oslo.clearSiteData(item.domain);
          renderSiteDataList();
        }
      );
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = `<div class="privacy-empty">${getText('site-data-error', 'Site verileri yüklenemedi.')}</div>`;
  }
}

async function renderCertificateExceptionsList() {
  const list = document.getElementById('certificate-exceptions-list');
  if (!list) return;
  list.innerHTML = `<div class="privacy-empty">${getText('loading', 'Yükleniyor...')}</div>`;

  try {
    const exceptions = await window.oslo.getCertificateExceptions();
    const entries = Object.entries(exceptions || {}).sort(([a], [b]) => a.localeCompare(b));
    list.innerHTML = '';
    if (entries.length === 0) {
      list.innerHTML = `<div class="privacy-empty">${getText('no-certificate-exceptions', 'Kayıtlı sertifika istisnası yok.')}</div>`;
      return;
    }

    entries.forEach(([host, item]) => {
      const subtitle = `${item.error || '-'} · ${formatDateTime(item.addedAt)}`;
      const row = createPrivacyDataRow(
        host,
        subtitle,
        getText('modal-delete', 'Sil'),
        async () => {
          await window.oslo.deleteCertificateException(host);
          renderCertificateExceptionsList();
        }
      );
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = `<div class="privacy-empty">${getText('certificate-exceptions-error', 'Sertifika istisnaları yüklenemedi.')}</div>`;
  }
}

function openPrivacyModal(id, renderFn) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  window.dispatchEvent(new Event('resize'));
  renderFn?.();
}

function closePrivacyModal(id) {
  const modal = document.getElementById(id);
  modal?.classList.remove('open');
  window.dispatchEvent(new Event('resize'));
}

export function initSettings() {
  const settingsOverlay = document.getElementById('settings-overlay');
  const closeSettings = document.getElementById('close-settings');

  if (closeSettings) {
    closeSettings.addEventListener('click', () => {
      settingsOverlay?.classList.remove('open');
      window.dispatchEvent(new Event('resize'));
    });
  }

  // Settings Tab Navigation
  const navItems = settingsOverlay?.querySelectorAll('[data-settings-tab]') || [];
  const tabContents = settingsOverlay?.querySelectorAll('.settings-tab-content') || [];

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-settings-tab');
      if (!tabName) return;
      navItems.forEach(n => n.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));
      item.classList.add('active');
      const target = document.getElementById(`settings-tab-${tabName}`);
      if (target) target.classList.add('active');

      if (tabName === 'passwords') {
        renderSavedPasswords();
      } else if (tabName === 'about') {
        loadAboutTabSystemInfo();
      }
    });
  });

  const settingsSearchEngine = document.getElementById('settings-search-engine');
  const settingsAdblockCheckbox = document.getElementById('settings-adblock-checkbox');
  const settingsHttpsCheckbox = document.getElementById('settings-https-checkbox');
  const settingsCustomCss = document.getElementById('settings-custom-css');
  const settingsWallpaperUrl = document.getElementById('settings-wallpaper-url');
  const settingsLanguage = document.getElementById('settings-language');
  const settingsBookmarksBarCheckbox = document.getElementById('settings-bookmarks-bar-checkbox');
  const settingsHomeCheckbox = document.getElementById('settings-home-checkbox');
  const settingsHomeUrl = document.getElementById('settings-home-url');
  const navHome = document.getElementById('nav-home');


  if (settingsSearchEngine) {
    settingsSearchEngine.addEventListener('change', () => {
      window.oslo.setSetting('searchEngine', settingsSearchEngine.value);
    });
  }

  if (settingsAdblockCheckbox) {
    settingsAdblockCheckbox.addEventListener('change', () => {
      window.oslo.setSetting('adblockEnabled', settingsAdblockCheckbox.checked);
    });
  }

  if (settingsHttpsCheckbox) {
    settingsHttpsCheckbox.addEventListener('change', () => {
      window.oslo.setSetting('httpsOnlyEnabled', settingsHttpsCheckbox.checked).then(() => {
        const container = document.getElementById('settings-https-exceptions-container');
        if (container) container.style.display = settingsHttpsCheckbox.checked ? 'flex' : 'none';
      });
    });
  }

  if (settingsCustomCss) {
    settingsCustomCss.addEventListener('input', () => {
      applyLocalCustomCss(settingsCustomCss.value, true);
    });
  }

  if (settingsWallpaperUrl) {
    settingsWallpaperUrl.addEventListener('input', () => {
      window.oslo.setSetting('newtabWallpaper', settingsWallpaperUrl.value.trim());
    });
  }

  const bindAppearanceSelect = (id, key, transform = value => value) => {
    const control = document.getElementById(id);
    if (!control) return;
    control.addEventListener('change', () => {
      window.oslo.setSetting(key, transform(control.value));
    });
  };

  const bindAppearanceCheckbox = (id, key) => {
    const control = document.getElementById(id);
    if (!control) return;
    control.addEventListener('change', () => {
      window.oslo.setSetting(key, control.checked);
    });
  };

  bindAppearanceSelect('settings-theme-mode', 'theme');
  bindAppearanceSelect('settings-ui-font-size', 'uiFontSize');
  bindAppearanceSelect('settings-default-page-zoom', 'defaultPageZoom', parseFloat);
  bindAppearanceSelect('settings-tab-corner-style', 'tabCornerStyle');
  bindAppearanceSelect('settings-active-tab-style', 'activeTabStyle');
  bindAppearanceSelect('settings-newtab-background-type', 'newtabBackgroundType');
  bindAppearanceSelect('settings-newtab-preset-wallpaper', 'newtabPresetWallpaper');

  bindAppearanceCheckbox('settings-compact-mode', 'compactMode');
  bindAppearanceCheckbox('settings-sidebar-auto-hide', 'sidebarAutoHide');
  bindAppearanceCheckbox('settings-topbar-auto-hide', 'topBarAutoHide');
  bindAppearanceCheckbox('settings-reduce-motion', 'reduceMotion');
  bindAppearanceCheckbox('settings-transparency-enabled', 'transparencyEnabled');
  bindAppearanceCheckbox('settings-custom-css-enabled', 'customCssEnabled');
  bindAppearanceCheckbox('settings-newtab-show-clock', 'newtabShowClock');
  bindAppearanceCheckbox('settings-newtab-show-date', 'newtabShowDate');
  bindAppearanceCheckbox('settings-newtab-show-weather', 'newtabShowWeather');
  bindAppearanceCheckbox('settings-newtab-show-search', 'newtabShowSearch');
  bindAppearanceCheckbox('settings-newtab-show-shortcuts', 'newtabShowShortcuts');

  const settingsAccentColor = document.getElementById('settings-accent-color');
  if (settingsAccentColor) {
    settingsAccentColor.addEventListener('input', () => {
      window.oslo.setSetting('accentColor', settingsAccentColor.value);
    });
  }

  document.querySelectorAll('.settings-color-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.accent;
      if (color) window.oslo.setSetting('accentColor', color);
    });
  });

  const settingsNewtabBackgroundColor = document.getElementById('settings-newtab-background-color');
  if (settingsNewtabBackgroundColor) {
    settingsNewtabBackgroundColor.addEventListener('input', () => {
      window.oslo.setSetting('newtabBackgroundColor', settingsNewtabBackgroundColor.value);
    });
  }

  const settingsTabHeight = document.getElementById('settings-tab-height');
  if (settingsTabHeight) {
    settingsTabHeight.addEventListener('input', () => {
      const value = parseInt(settingsTabHeight.value, 10);
      applyAppearanceSetting('tabHeight', value);
      window.oslo.setSetting('tabHeight', value);
    });
  }

  const settingsSidebarWidth = document.getElementById('settings-sidebar-width');
  if (settingsSidebarWidth) {
    settingsSidebarWidth.addEventListener('input', () => {
      const value = parseInt(settingsSidebarWidth.value, 10);
      applyAppearanceSetting('sidebarWidth', value);
      window.oslo.setSetting('sidebarWidth', value);
    });
  }

  const wallpaperFileBtn = document.getElementById('settings-wallpaper-file-btn');
  if (wallpaperFileBtn) {
    wallpaperFileBtn.addEventListener('click', () => {
      window.oslo.selectNewtabWallpaperFile().then((fileUrl) => {
        if (!fileUrl) return;
        window.oslo.setSetting('newtabWallpaper', fileUrl);
        window.oslo.setSetting('newtabBackgroundType', 'file');
      });
    });
  }

  document.getElementById('settings-custom-css-preview')?.addEventListener('click', () => {
    applyLocalCustomCss(settingsCustomCss?.value || '', true);
    showCustomCssStatus('preview');
  });

  document.getElementById('settings-custom-css-save')?.addEventListener('click', () => {
    const css = settingsCustomCss?.value || '';
    window.oslo.setSetting('customCss', css);
    window.oslo.setSetting('customCssEnabled', true);
    showCustomCssStatus('save');
  });

  document.getElementById('settings-custom-css-reset')?.addEventListener('click', () => {
    if (settingsCustomCss) settingsCustomCss.value = '';
    window.oslo.setSetting('customCss', '');
    applyLocalCustomCss('', true);
    showCustomCssStatus('reset');
  });

  if (settingsLanguage) {
    settingsLanguage.addEventListener('change', () => {
      window.oslo.setSetting('language', settingsLanguage.value);
    });
  }

  if (settingsBookmarksBarCheckbox) {
    settingsBookmarksBarCheckbox.addEventListener('change', () => {
      window.oslo.setSetting('bookmarksBarEnabled', settingsBookmarksBarCheckbox.checked);
    });
  }

  if (settingsHomeCheckbox) {
    settingsHomeCheckbox.addEventListener('change', () => {
      window.oslo.setSetting('homeButtonEnabled', settingsHomeCheckbox.checked);
    });
  }

  if (settingsHomeUrl) {
    settingsHomeUrl.addEventListener('input', () => {
      window.oslo.setSetting('homePageUrl', settingsHomeUrl.value.trim());
    });
  }

  const settingsHistoryLimit = document.getElementById('settings-history-limit');
  if (settingsHistoryLimit) {
    settingsHistoryLimit.addEventListener('change', () => {
      window.oslo.setSetting('historyLimit', parseInt(settingsHistoryLimit.value, 10));
    });
  }



  const bindSettingSelect = (id, key) => {
    const control = document.getElementById(id);
    if (!control) return;
    control.addEventListener('change', () => {
      window.oslo.setSetting(key, control.value);
    });
  };

  const bindSettingCheckbox = (id, key) => {
    const control = document.getElementById(id);
    if (!control) return;
    control.addEventListener('change', () => {
      window.oslo.setSetting(key, control.checked);
    });
  };

  const bindSettingText = (id, key) => {
    const control = document.getElementById(id);
    if (!control) return;
    control.addEventListener('input', () => {
      window.oslo.setSetting(key, control.value.trim());
    });
  };

  Object.entries(privacySelectControls).forEach(([key, id]) => bindSettingSelect(id, key));
  Object.entries(privacyCheckboxControls).forEach(([key, id]) => bindSettingCheckbox(id, key));
  Object.entries(privacyTextControls).forEach(([key, id]) => bindSettingText(id, key));

  const settingsDnsCheckbox = document.getElementById('settings-dns-checkbox');
  const settingsDnsProvider = document.getElementById('settings-dns-provider');
  const settingsDnsCustomProvider = document.getElementById('settings-dns-custom-provider');
  const dnsRestartNotice = document.getElementById('dns-restart-notice');

  if (settingsDnsCheckbox) {
    settingsDnsCheckbox.addEventListener('change', () => {
      window.oslo.setSetting('dnsOverHttpsEnabled', settingsDnsCheckbox.checked).then(() => {
        const container = document.getElementById('settings-dns-provider-container');
        if (container) container.style.display = settingsDnsCheckbox.checked ? 'flex' : 'none';
        if (dnsRestartNotice) dnsRestartNotice.style.display = 'block';
      });
    });
  }

  if (settingsDnsProvider) {
    settingsDnsProvider.addEventListener('change', () => {
      updateDnsCustomProviderVisibility();
      window.oslo.setSetting('dnsOverHttpsProvider', settingsDnsProvider.value).then(() => {
        if (dnsRestartNotice) dnsRestartNotice.style.display = 'block';
      });
    });
  }

  if (settingsDnsCustomProvider) {
    settingsDnsCustomProvider.addEventListener('input', () => {
      if (dnsRestartNotice) dnsRestartNotice.style.display = 'block';
    });
  }

  updateDnsCustomProviderVisibility();

  document.getElementById('settings-audit-passwords')?.addEventListener('click', auditSavedPasswords);
  document.getElementById('btn-generate-password')?.addEventListener('click', setGeneratedPassword);
  document.getElementById('btn-copy-generated-password')?.addEventListener('click', async () => {
    const output = document.getElementById('generated-password-output');
    const value = output?.value || '';
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showCustomAlert(getText('password-generator-title', 'Güçlü Şifre Üretici'), getText('password-copy-success', 'Şifre panoya kopyalandı.'));
    } catch (error) {
      output?.select();
      document.execCommand('copy');
      showCustomAlert(getText('password-generator-title', 'Güçlü Şifre Üretici'), getText('password-copy-success', 'Şifre panoya kopyalandı.'));
    }
  });
  setGeneratedPassword();

  document.getElementById('close-password-audit-modal')?.addEventListener('click', () => {
    document.getElementById('password-audit-modal')?.classList.remove('open');
    window.dispatchEvent(new Event('resize'));
  });

  document.getElementById('btn-close-password-audit-modal')?.addEventListener('click', () => {
    document.getElementById('password-audit-modal')?.classList.remove('open');
    window.dispatchEvent(new Event('resize'));
  });

  document.getElementById('password-audit-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('password-audit-modal')?.classList.remove('open');
      window.dispatchEvent(new Event('resize'));
    }
  });

  document.getElementById('settings-manage-site-data')?.addEventListener('click', () => {
    openPrivacyModal('site-data-modal', renderSiteDataList);
  });

  document.getElementById('settings-manage-certificates')?.addEventListener('click', () => {
    openPrivacyModal('certificate-exceptions-modal', renderCertificateExceptionsList);
  });

  document.getElementById('close-site-data-modal')?.addEventListener('click', () => closePrivacyModal('site-data-modal'));
  document.getElementById('btn-close-site-data-modal')?.addEventListener('click', () => closePrivacyModal('site-data-modal'));
  document.getElementById('site-data-modal')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closePrivacyModal('site-data-modal');
  });

  document.getElementById('close-certificate-exceptions-modal')?.addEventListener('click', () => closePrivacyModal('certificate-exceptions-modal'));
  document.getElementById('btn-close-certificate-exceptions-modal')?.addEventListener('click', () => closePrivacyModal('certificate-exceptions-modal'));
  document.getElementById('certificate-exceptions-modal')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closePrivacyModal('certificate-exceptions-modal');
  });
  document.getElementById('btn-clear-certificate-exceptions')?.addEventListener('click', async () => {
    await window.oslo.clearCertificateExceptions();
    renderCertificateExceptionsList();
  });

  loadAboutTabSystemInfo();

  if (navHome) {
    navHome.addEventListener('click', () => {
      if (state.activeTabId) {
        window.oslo.getAllSettings().then(settings => {
          const url = settings.homePageUrl || '';
          window.oslo.navigate(state.activeTabId, url || 'oslo://newtab');
        });
      }
    });
  }

  const importBookmarksBtn = document.getElementById('settings-import-bookmarks');
  const exportBookmarksBtn = document.getElementById('settings-export-bookmarks');

  if (importBookmarksBtn) {
    importBookmarksBtn.addEventListener('click', () => {
      window.oslo.importBookmarks().then((res) => {
        if (res && res.bookmarks) {
          state.bookmarks = res.bookmarks;
          updateBookmarkIcon();
          renderBookmarks();
          renderBookmarksBar();

          showBookmarksImportExportModal('import', res);
        }
      }).catch((err) => {
        console.error(err);
      });
    });
  }

  if (exportBookmarksBtn) {
    exportBookmarksBtn.addEventListener('click', () => {
      window.oslo.exportBookmarks().then((res) => {
        if (res) {
          showBookmarksImportExportModal('export', res);
        }
      }).catch((err) => {
        console.error(err);
      });
    });
  }

  const exportSettingsBtn = document.getElementById('settings-export-settings');
  const importSettingsBtn = document.getElementById('settings-import-settings');
  const resetSettingsBtn = document.getElementById('settings-reset-all');

  if (exportSettingsBtn) {
    exportSettingsBtn.addEventListener('click', () => {
      window.oslo.exportSettings().then((success) => {
        if (success) {
          const title = translations[state.currentLang]['export-settings'] || 'Ayarları Dışa Aktar';
          const msg = translations[state.currentLang]['settings-export-success'] || 'Ayarlar başarıyla dışa aktarıldı!';
          showCustomAlert(title, msg);
        }
      }).catch((err) => {
        console.error(err);
      });
    });
  }

  if (importSettingsBtn) {
    importSettingsBtn.addEventListener('click', () => {
      window.oslo.importSettings().then((updated) => {
        if (updated) {
          const title = translations[state.currentLang]['import-settings'] || 'Ayarları İçe Aktar';
          const msg = translations[state.currentLang]['settings-import-success'] || 'Ayarlar başarıyla içe aktarıldı!\nDeğişikliklerin tamamen uygulanması için sayfa yenilenecek.';
          showCustomAlert(title, msg).then(() => {
            window.location.reload();
          });
        }
      }).catch((err) => {
        const title = translations[state.currentLang]['import-settings'] || 'Ayarları İçe Aktar';
        let msg = translations[state.currentLang]['settings-import-error'] || 'Ayarlar içe aktarılamadı: {error}';
        msg = msg.replace('{error}', err.message || err);
        showCustomAlert(title, msg);
      });
    });
  }

  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', () => {
      const title = translations[state.currentLang]['reset-all-settings'] || 'Fabrika Ayarlarına Sıfırla';
      const confirmMsg = translations[state.currentLang]['settings-reset-confirm'] || 'Tüm tarayıcı verilerini fabrika varsayılanlarına sıfırlamak istediğinizden emin misiniz? Bu işlem geri alınamaz.';
      showCustomConfirm(title, confirmMsg).then((confirmed) => {
        if (confirmed) {
          window.oslo.resetSettings().then((updated) => {
            if (updated) {
              Object.entries(updated).forEach(([key, value]) => {
                applySettingChange(key, value);
              });
              const successMsg = translations[state.currentLang]['settings-reset-success'] || 'Tüm ayarlar ve kayıtlı tarayıcı verileri başarıyla sıfırlandı!';
              showCustomAlert(title, successMsg).then(() => {
                window.location.reload();
              });
            }
          }).catch((err) => {
            console.error(err);
          });
        }
      });
    });
  }

  const importPasswordsBtn = document.getElementById('settings-passwords-import-btn');
  const exportPasswordsBtn = document.getElementById('settings-passwords-export-btn');

  if (importPasswordsBtn) {
    importPasswordsBtn.addEventListener('click', () => {
      window.oslo.importPasswords().then((res) => {
        if (!res) return;
        if (res.success) {
          let msg = translations[state.currentLang]['passwords-import-success'] || 'Şifreler başarıyla içe aktarıldı!\nYeni: {added}\nGüncellenen: {updated}';
          msg = msg.replace('{added}', res.added).replace('{updated}', res.updated);
          alert(msg);
          renderSavedPasswords();
        } else if (res.message === 'no_credentials_found') {
          const msg = translations[state.currentLang]['passwords-import-empty'] || 'Seçilen dosyada şifre bulunamadı.';
          alert(msg);
        } else if (res.message !== 'canceled') {
          let msg = translations[state.currentLang]['passwords-import-error'] || 'İçe aktarma hatası: {error}';
          msg = msg.replace('{error}', res.message);
          alert(msg);
        }
      });
    });
  }

  if (exportPasswordsBtn) {
    exportPasswordsBtn.addEventListener('click', () => {
      window.oslo.exportPasswords().then((res) => {
        if (!res) return;
        if (res.success) {
          let msg = translations[state.currentLang]['passwords-export-success'] || 'Şifreler başarıyla dışarı aktarıldı!\nToplam: {count}';
          msg = msg.replace('{count}', res.count);
          alert(msg);
        } else if (res.message === 'no_passwords_to_export') {
          const msg = translations[state.currentLang]['passwords-export-empty'] || 'Dışarı aktarılacak şifre bulunmuyor.';
          alert(msg);
        } else if (res.message !== 'canceled') {
          let msg = translations[state.currentLang]['passwords-export-error'] || 'Dışarı aktarma hatası: {error}';
          msg = msg.replace('{error}', res.message);
          alert(msg);
        }
      });
    });
  }

  const settingsSessionRestoreCheckbox = document.getElementById('settings-session-restore-checkbox');
  if (settingsSessionRestoreCheckbox) {
    settingsSessionRestoreCheckbox.addEventListener('change', () => {
      window.oslo.setSetting('sessionRestoreEnabled', settingsSessionRestoreCheckbox.checked);
    });
  }

  const settingsSavePasswordsCheckbox = document.getElementById('settings-save-passwords-checkbox');
  if (settingsSavePasswordsCheckbox) {
    settingsSavePasswordsCheckbox.addEventListener('change', () => {
      window.oslo.setSetting('savePasswordsEnabled', settingsSavePasswordsCheckbox.checked);
    });
  }

  const settingsAutofillCheckbox = document.getElementById('settings-autofill-checkbox');
  if (settingsAutofillCheckbox) {
    settingsAutofillCheckbox.addEventListener('change', () => {
      window.oslo.setSetting('autofillEnabled', settingsAutofillCheckbox.checked);
    });
  }

  window.addEventListener('language-changed', () => {
    updateAppearanceControl('newtabWallpaper', appearanceSettings.newtabWallpaper);
    const passwordsTab = document.getElementById('settings-tab-passwords');
    if (passwordsTab && passwordsTab.classList.contains('active')) {
      renderSavedPasswords();
    }
  });

  // Load all settings
  window.oslo.getAllSettings().then(settings => {
    Object.keys(settings).forEach(key => {
      applySettingChange(key, settings[key]);
    });
  }).catch(err => {
    console.error('Failed to load settings in settings.js:', err);
  });

  // Listen to live settings changes
  window.oslo.onSettingsUpdated((data) => {
    applySettingChange(data.key, data.value);
  });

  const btnClearBrowserData = document.getElementById('btn-clear-browser-data');
  const clearBrowserDataModal = document.getElementById('clear-browser-data-modal');
  const closeClearBrowserDataModal = document.getElementById('close-clear-browser-data-modal');
  const clearBrowserDataBody = document.getElementById('clear-browser-data-body');
  const clearBrowserDataFooter = document.getElementById('clear-browser-data-footer');

  const handleConfirmClearBrowserData = () => {
    // Show loading state
    if (clearBrowserDataBody) {
      const loadingText = translations[state.currentLang]['clear-data-loading'] || 'Temizleniyor...';
      clearBrowserDataBody.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px 0;">
          <div class="settings-logo-spin" style="width: 28px; height: 28px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <span style="font-size: 13px; color: var(--text-main); font-weight: 500;">${loadingText}</span>
        </div>
      `;
    }
    if (clearBrowserDataFooter) {
      clearBrowserDataFooter.innerHTML = ''; // Hide buttons during operation
    }

    window.oslo.clearBrowserData().then(res => {
      if (res && res.success) {
        // Show success state
        if (clearBrowserDataBody) {
          const successMsg = translations[state.currentLang]['clear-data-success-msg'] || 'Tarayıcı verileri ve önbelleği başarıyla temizlendi.';
          clearBrowserDataBody.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 10px 0; color: #4ade80;">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span style="font-size: 14px; font-weight: 600; text-align: center;">${successMsg}</span>
            </div>
          `;
        }
      } else {
        // Show error state
        if (clearBrowserDataBody) {
          let errorMsg = translations[state.currentLang]['clear-data-error-msg'] || 'Temizleme hatası: {error}';
          errorMsg = errorMsg.replace('{error}', res ? res.message : 'Unknown');
          clearBrowserDataBody.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 10px 0; color: #f87171;">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span style="font-size: 13px; font-weight: 600; text-align: center;">${errorMsg}</span>
            </div>
          `;
        }
      }

      // Add "OK" button
      if (clearBrowserDataFooter) {
        const okText = translations[state.currentLang]['modal-ok'] || 'Tamam';
        clearBrowserDataFooter.innerHTML = `
          <button id="btn-ok-clear-browser-data" class="modal-btn primary-btn" style="background: var(--accent-gradient); color: #000; border:none; width: 100px; justify-content: center;">${okText}</button>
        `;
        document.getElementById('btn-ok-clear-browser-data')?.addEventListener('click', () => {
          clearBrowserDataModal?.classList.remove('open');
          window.dispatchEvent(new Event('resize')); // Recalculate bounds
        });
      }
    });
  };

  const showClearBrowserDataModal = () => {
    // Reset modal content
    if (clearBrowserDataBody) {
      const confirmText = translations[state.currentLang]['clear-data-confirm'] || 'Tüm önbellek, çerezler ve tarayıcı verileri temizlenecek. Devam etmek istiyor musunuz?';
      clearBrowserDataBody.innerHTML = `
        <div style="font-size: 13px; color: var(--text-main); line-height: 1.5;">
          <p id="clear-browser-data-confirm-text">${confirmText}</p>
        </div>
      `;
    }
    if (clearBrowserDataFooter) {
      const cancelText = translations[state.currentLang]['modal-cancel'] || 'İptal';
      const clearText = translations[state.currentLang]['clear-data'] || 'Temizle';
      clearBrowserDataFooter.innerHTML = `
        <button id="btn-cancel-clear-browser-data" class="modal-btn secondary-btn">${cancelText}</button>
        <button id="btn-confirm-clear-browser-data" class="modal-btn primary-btn"
          style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: #fff; border:none;">${clearText}</button>
      `;
      // Rebind click listeners to dynamic buttons
      document.getElementById('btn-cancel-clear-browser-data')?.addEventListener('click', () => {
        clearBrowserDataModal?.classList.remove('open');
        window.dispatchEvent(new Event('resize')); // Recalculate bounds
      });
      document.getElementById('btn-confirm-clear-browser-data')?.addEventListener('click', handleConfirmClearBrowserData);
    }
    clearBrowserDataModal?.classList.add('open');
    window.dispatchEvent(new Event('resize')); // Recalculate bounds
  };

  if (btnClearBrowserData) {
    btnClearBrowserData.addEventListener('click', showClearBrowserDataModal);
  }

  if (closeClearBrowserDataModal) {
    closeClearBrowserDataModal.addEventListener('click', () => {
      clearBrowserDataModal?.classList.remove('open');
      window.dispatchEvent(new Event('resize'));
    });
  }

  const linkVisitWebsite = document.getElementById('link-visit-website');
  if (linkVisitWebsite) {
    linkVisitWebsite.addEventListener('click', (e) => {
      e.preventDefault();
      window.oslo.createTab({ url: 'https://oslobrowser.com' });
      settingsOverlay?.classList.remove('open');
      window.dispatchEvent(new Event('resize'));
    });
  }
}

export function renderSavedPasswords() {
  const container = document.getElementById('saved-passwords-list');
  if (!container) return;
  container.innerHTML = '';

  window.oslo.getPasswords().then(passwords => {
    if (!passwords || passwords.length === 0) {
      const emptyMsg = translations[state.currentLang]['no-saved-passwords'] || 'Kayıtlı şifre bulunmuyor.';
      container.innerHTML = `<div class="passwords-empty">${emptyMsg}</div>`;
      return;
    }

    passwords.forEach(cred => {
      const row = document.createElement('div');
      row.className = 'password-row';

      const info = document.createElement('div');
      info.className = 'password-site-info';

      const origin = document.createElement('span');
      origin.className = 'password-origin';
      origin.textContent = cred.origin;

      const username = document.createElement('span');
      username.className = 'password-username';
      username.textContent = cred.username;

      info.appendChild(origin);
      info.appendChild(username);

      const valContainer = document.createElement('div');
      valContainer.className = 'password-value-container';

      const input = document.createElement('input');
      input.type = 'password';
      input.className = 'password-display-input';
      input.value = cred.password;
      input.readOnly = true;

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'password-action-btn toggle-visibility';
      toggleBtn.title = state.currentLang === 'tr' ? 'Şifreyi Göster' : (state.currentLang === 'fr' ? 'Afficher le mot de passe' : 'Show Password');
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
      `;

      toggleBtn.addEventListener('click', () => {
        if (input.type === 'password') {
          input.type = 'text';
          toggleBtn.title = state.currentLang === 'tr' ? 'Şifreyi Gizle' : (state.currentLang === 'fr' ? 'Masquer le mot de passe' : 'Hide Password');
          toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.82l2.92 2.92c1.51-1.39 2.7-3.14 3.44-5.12-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22l1.41-1.41L3.41 2.86 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-7.8l1.86 1.86c-.56-.17-1.14-.26-1.7-.26-2.76 0-5 2.24-5 5 0 .56.09 1.14.26 1.7L3.08 6.13C4.47 4.74 6.22 3.55 8.2 2.81c1.24-.45 2.58-.7 3.98-.7z"/>
            </svg>
          `;
        } else {
          input.type = 'password';
          toggleBtn.title = state.currentLang === 'tr' ? 'Şifreyi Göster' : (state.currentLang === 'fr' ? 'Afficher le mot de passe' : 'Show Password');
          toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          `;
        }
      });

      valContainer.appendChild(input);
      valContainer.appendChild(toggleBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'password-action-btn delete-btn';
      deleteBtn.title = state.currentLang === 'tr' ? 'Sil' : (state.currentLang === 'fr' ? 'Supprimer' : 'Delete');
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      `;

      deleteBtn.addEventListener('click', () => {
        window.oslo.deleteCredential(cred.id).then(() => {
          renderSavedPasswords();
        });
      });

      row.appendChild(info);
      row.appendChild(valContainer);
      row.appendChild(deleteBtn);

      container.appendChild(row);
    });
  }).catch(err => {
    console.error('Failed to render saved passwords:', err);
  });
}

export function loadAboutTabSystemInfo() {
  window.oslo.getSystemInfo().then(info => {
    if (!info) return;
    const versionDisplay = document.getElementById('about-version-display');
    const versionDisplayMain = document.getElementById('about-version-display-main');
    const valElectron = document.getElementById('sys-val-electron');
    const valChrome = document.getElementById('sys-val-chrome');
    const valNode = document.getElementById('sys-val-node');
    const valV8 = document.getElementById('sys-val-v8');
    const valUseragent = document.getElementById('sys-val-useragent');
    
    if (versionDisplay) versionDisplay.textContent = info.appVersion || '1.0.0-alpha.10';
    if (versionDisplayMain) versionDisplayMain.textContent = info.appVersion || '1.0.0-alpha.10';
    if (valElectron) valElectron.textContent = info.electron || '-';
    if (valChrome) valChrome.textContent = info.chrome || '-';
    if (valNode) valNode.textContent = info.node || '-';
    if (valV8) valV8.textContent = info.v8 || '-';
    if (valUseragent) valUseragent.textContent = navigator.userAgent || '-';
  }).catch(err => {
    console.error('Failed to load browser info:', err);
  });
}

function showCustomAlert(title, message) {
  return new Promise((resolve) => {
    const modalId = 'custom-alert-modal-' + Date.now();
    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'modal-overlay';
    
    let iconHtml = `
      <svg viewBox="0 0 24 24" width="24" height="24" fill="var(--accent-color)" style="flex-shrink:0;">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h-2v2h2v4h-2v2h6v-2zm0-8h-2V7h2v2z"/>
      </svg>
    `;
    
    overlay.innerHTML = `
      <div class="modal-card" style="width: 420px; border-color: var(--accent-color); background: rgba(11, 12, 14, 0.85); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div class="modal-header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 16px 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            ${iconHtml}
            <h3 style="font-size: 15px; font-weight: 600; color: var(--text-main); margin:0;">${escapeHtml(title)}</h3>
          </div>
          <button class="modal-close-btn" style="font-size: 20px;">&times;</button>
        </div>
        <div class="modal-body" style="padding: 20px; font-size: 13px; color: var(--text-muted); line-height: 1.5; white-space: pre-wrap;">
          ${escapeHtml(message)}
        </div>
        <div class="modal-footer" style="border-top: 1px solid rgba(255, 255, 255, 0.05); background: rgba(0,0,0,0.1); padding: 12px 20px;">
          <button class="modal-btn primary-btn btn-ok" style="padding: 8px 18px; font-size: 12px; min-width: 80px; justify-content: center; display: flex; align-items: center;">${translations[state.currentLang]['modal-ok'] || 'Tamam'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    
    setTimeout(() => {
      overlay.classList.add('open');
    }, 10);

    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 250);
    };

    overlay.querySelector('.modal-close-btn').addEventListener('click', close);
    overlay.querySelector('.btn-ok').addEventListener('click', close);
  });
}

function showCustomConfirm(title, message) {
  return new Promise((resolve) => {
    const modalId = 'custom-confirm-modal-' + Date.now();
    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'modal-overlay';
    
    let iconHtml = `
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#ff4d4d" style="flex-shrink:0;">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    `;
    
    overlay.innerHTML = `
      <div class="modal-card" style="width: 440px; border-color: rgba(255, 77, 77, 0.4); background: rgba(11, 12, 14, 0.85); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div class="modal-header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 16px 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            ${iconHtml}
            <h3 style="font-size: 15px; font-weight: 600; color: var(--text-main); margin:0;">${escapeHtml(title)}</h3>
          </div>
          <button class="modal-close-btn" style="font-size: 20px;">&times;</button>
        </div>
        <div class="modal-body" style="padding: 20px; font-size: 13px; color: var(--text-muted); line-height: 1.5; white-space: pre-wrap;">
          ${escapeHtml(message)}
        </div>
        <div class="modal-footer" style="border-top: 1px solid rgba(255, 255, 255, 0.05); background: rgba(0,0,0,0.1); padding: 12px 20px;">
          <button class="modal-btn secondary-btn btn-cancel" style="padding: 8px 18px; font-size: 12px; min-width: 80px; justify-content: center; display: flex; align-items: center;">${translations[state.currentLang]['modal-cancel'] || 'İptal'}</button>
          <button class="modal-btn primary-btn btn-confirm" style="padding: 8px 18px; font-size: 12px; min-width: 80px; justify-content: center; display: flex; align-items: center; background: #ff4d4d; color: #fff;">${translations[state.currentLang]['modal-ok'] || 'Tamam'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    
    setTimeout(() => {
      overlay.classList.add('open');
    }, 10);

    const cleanup = (value) => {
      overlay.classList.remove('open');
      setTimeout(() => {
        overlay.remove();
        resolve(value);
      }, 250);
    };

    overlay.querySelector('.modal-close-btn').addEventListener('click', () => cleanup(false));
    overlay.querySelector('.btn-cancel').addEventListener('click', () => cleanup(false));
    overlay.querySelector('.btn-confirm').addEventListener('click', () => cleanup(true));
  });
}

function showBookmarksImportExportModal(type, res) {
  return new Promise((resolve) => {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'bookmarks-success-modal-overlay';
    
    const lang = state.currentLang || 'en';
    const isImport = type === 'import';
    
    const locales = {
      tr: {
        importTitle: 'İçe Aktarma Başarılı!',
        exportTitle: 'Dışa Aktarma Başarılı!',
        importDesc: 'Yer imleriniz başarıyla tarayıcınıza aktarıldı ve kullanıma hazır.',
        exportDesc: 'Yer imleriniz başarıyla dışa aktarıldı.',
        foldersLabel: isImport ? 'Eklenen Klasörler' : 'Aktarılan Klasörler',
        linksLabel: isImport ? 'Eklenen Bağlantılar' : 'Aktarılan Bağlantılar',
        btnText: 'Harika!',
      },
      en: {
        importTitle: 'Import Successful!',
        exportTitle: 'Export Successful!',
        importDesc: 'Your bookmarks have been successfully imported and are ready to use.',
        exportDesc: 'Your bookmarks have been successfully exported.',
        foldersLabel: isImport ? 'Folders Added' : 'Folders Exported',
        linksLabel: isImport ? 'Links Added' : 'Links Exported',
        btnText: 'Awesome!',
      },
      fr: {
        importTitle: 'Importation Réussie !',
        exportTitle: 'Exportation Réussie !',
        importDesc: 'Vos favoris ont été importés avec succès et sont prêts à être utilisés.',
        exportDesc: 'Vos favoris ont été exportés avec succès.',
        foldersLabel: isImport ? 'Dossiers Ajoutés' : 'Dossiers Exportés',
        linksLabel: isImport ? 'Liens Ajoutés' : 'Liens Exportés',
        btnText: 'Super !',
      }
    };
    
    const text = locales[lang] || locales.en;
    
    const foldersCount = isImport ? (res.foldersAdded || 0) : (res.totalFolders || 0);
    const linksCount = isImport ? (res.linksAdded || 0) : (res.totalLinks || 0);
    
    modalOverlay.innerHTML = `
      <div class="bookmarks-success-card">
        <div class="bookmarks-success-icon-container">
          <div class="bookmarks-success-icon-glow"></div>
          <svg viewBox="0 0 24 24" width="38" height="38" fill="var(--accent-color)">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
        </div>
        <h3 class="bookmarks-success-title">${isImport ? text.importTitle : text.exportTitle}</h3>
        <p class="bookmarks-success-desc">${isImport ? text.importDesc : text.exportDesc}</p>
        <div class="bookmarks-stats-grid">
          <div class="bookmarks-stat-card">
            <div class="bookmarks-stat-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
            </div>
            <div class="bookmarks-stat-value" id="folders-value">${foldersCount}</div>
            <div class="bookmarks-stat-label">${text.foldersLabel}</div>
          </div>
          <div class="bookmarks-stat-card">
            <div class="bookmarks-stat-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
              </svg>
            </div>
            <div class="bookmarks-stat-value" id="links-value">${linksCount}</div>
            <div class="bookmarks-stat-label">${text.linksLabel}</div>
          </div>
        </div>
        <button class="bookmarks-success-btn">${text.btnText}</button>
      </div>
    `;
    
    document.body.appendChild(modalOverlay);
    
    window.dispatchEvent(new Event('resize'));
    
    setTimeout(() => {
      modalOverlay.classList.add('open');
    }, 10);
    
    const close = () => {
      modalOverlay.classList.remove('open');
      setTimeout(() => {
        modalOverlay.remove();
        window.dispatchEvent(new Event('resize'));
        resolve();
      }, 300);
    };
    
    modalOverlay.querySelector('.bookmarks-success-btn').addEventListener('click', close);
  });
}
