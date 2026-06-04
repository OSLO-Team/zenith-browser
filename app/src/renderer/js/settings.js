// OSLO Browser - Settings Management Module
import { state } from './state.js';
import { applyLanguage, translations } from './i18n.js';
import { renderBookmarks, renderBookmarksBar } from './panels.js';
import { updateBookmarkIcon } from './tabs.js';
import { showOsloAlert as showCustomAlert, showOsloConfirm as showCustomConfirm } from './modal-dialogs.js';

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
  customCssEnabled: false,
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
  backgroundTabThrottling: 'settings-background-throttling',
  keepPinnedTabsAwake: 'settings-keep-pinned-awake',
  keepAudioTabsAwake: 'settings-keep-audio-awake',
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
  performanceMode: 'settings-performance-mode',
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
      ['settings-sleep-tabs-timeout-row', 'settings-keep-pinned-awake-row', 'settings-keep-audio-awake-row'].forEach(id => {
        const container = document.getElementById(id);
        if (container) container.style.display = value ? 'flex' : 'none';
      });
    }
    return;
  }

  if (privacySelectControls[key]) {
    const select = document.getElementById(privacySelectControls[key]);
    if (select) select.value = String(value);
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
  if (value.length < 12) return true;
  const hasLetter = /[a-zA-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^a-zA-Z0-9]/.test(value);
  return !(hasLetter && hasNumber && hasSymbol);
}

const passwordCharacterSets = {
  uppercase: {
    full: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    reduced: 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  },
  lowercase: {
    full: 'abcdefghijklmnopqrstuvwxyz',
    reduced: 'abcdefghijkmnopqrstuvwxyz'
  },
  numbers: {
    full: '0123456789',
    reduced: '23456789'
  },
  symbols: {
    full: '!@#$%^&*()-_=+[]{};:,.?/',
    reduced: '!@#$%^&*()-_=+[]{};:,.?/'
  }
};

function getGeneratorOptions() {
  const lengthControl = document.getElementById('password-generator-length');
  const length = Math.max(16, Math.min(64, parseInt(lengthControl?.value, 10) || 28));
  return {
    length,
    uppercase: document.getElementById('password-option-uppercase')?.checked !== false,
    lowercase: document.getElementById('password-option-lowercase')?.checked !== false,
    numbers: document.getElementById('password-option-numbers')?.checked !== false,
    symbols: document.getElementById('password-option-symbols')?.checked !== false,
    excludeAmbiguous: document.getElementById('password-option-ambiguous')?.checked !== false
  };
}

function getActivePasswordGroups(options) {
  const useSet = options.excludeAmbiguous ? 'reduced' : 'full';
  const groups = [];
  ['uppercase', 'lowercase', 'numbers', 'symbols'].forEach(key => {
    if (options[key]) groups.push(passwordCharacterSets[key][useSet]);
  });
  return groups;
}

function randomIndex(max) {
  if (!Number.isFinite(max) || max <= 0) return 0;
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % max;
}

const TASK_MANAGER_REALTIME_REFRESH_MS = 1000;
const TASK_MANAGER_BACKGROUND_REFRESH_MS = 15000;
const TASK_MANAGER_HIGH_MEMORY_MB = 750;
const TASK_MANAGER_HIGH_CPU_PERCENT = 15;
let taskManagerRefreshTimer = null;
let taskManagerRenderInFlight = false;
let taskManagerWindowFocused = true;
let taskManagerLifecycleListenersBound = false;
let taskManagerFilter = 'all';
let taskManagerSort = 'resource';
let taskManagerSearch = '';

function getTaskManagerLocale() {
  if (state.currentLang === 'tr') return 'tr-TR';
  if (state.currentLang === 'fr') return 'fr-FR';
  return 'en-US';
}

function isTaskManagerPanelActive() {
  const overlay = document.getElementById('settings-overlay');
  const panel = document.getElementById('settings-tab-ram');
  return !!(overlay?.classList.contains('open') && panel?.classList.contains('active'));
}

function getTaskManagerRefreshMode() {
  if (!isTaskManagerPanelActive()) return 'stopped';
  if (document.hidden || !taskManagerWindowFocused) return 'slow';
  return 'live';
}

function updateTaskManagerRefreshStatus() {
  const status = document.getElementById('task-manager-refresh-state');
  if (!status) return;
  const mode = getTaskManagerRefreshMode();
  status.dataset.mode = mode;
  if (mode === 'live') {
    status.textContent = getText('task-manager-refresh-live', 'Canlı');
  } else if (mode === 'slow') {
    status.textContent = getText('task-manager-refresh-slow', 'Yavaş');
  } else {
    status.textContent = getText('task-manager-refresh-paused', 'Durakladı');
  }
}

function clearTaskManagerRefreshTimer() {
  if (taskManagerRefreshTimer) {
    clearTimeout(taskManagerRefreshTimer);
    taskManagerRefreshTimer = null;
  }
}

function stopTaskManagerLiveRefresh() {
  clearTaskManagerRefreshTimer();
  updateTaskManagerRefreshStatus();
}

function scheduleNextTaskManagerRefresh() {
  clearTaskManagerRefreshTimer();
  const mode = getTaskManagerRefreshMode();
  updateTaskManagerRefreshStatus();
  if (mode === 'stopped') return;
  const delay = mode === 'live' ? TASK_MANAGER_REALTIME_REFRESH_MS : TASK_MANAGER_BACKGROUND_REFRESH_MS;
  taskManagerRefreshTimer = setTimeout(() => {
    taskManagerRefreshTimer = null;
    if (!isTaskManagerPanelActive()) {
      stopTaskManagerLiveRefresh();
      return;
    }
    renderTaskManagerSection();
  }, delay);
}

function ensureTaskManagerLiveRefresh({ immediate = false } = {}) {
  updateTaskManagerRefreshStatus();
  if (!isTaskManagerPanelActive()) {
    stopTaskManagerLiveRefresh();
    return;
  }
  if (immediate) {
    renderTaskManagerSection();
    return;
  }
  if (!taskManagerRefreshTimer && !taskManagerRenderInFlight) {
    scheduleNextTaskManagerRefresh();
  }
}

function syncTaskManagerRefreshLifecycle({ immediate = false } = {}) {
  if (!isTaskManagerPanelActive()) {
    stopTaskManagerLiveRefresh();
    return;
  }
  if (immediate && !document.hidden && taskManagerWindowFocused) {
    renderTaskManagerSection();
    return;
  }
  scheduleNextTaskManagerRefresh();
}

function bindTaskManagerLifecycleListeners() {
  if (taskManagerLifecycleListenersBound) return;
  taskManagerLifecycleListenersBound = true;

  document.addEventListener('visibilitychange', () => {
    syncTaskManagerRefreshLifecycle({ immediate: !document.hidden });
  });

  window.addEventListener('focus', () => {
    taskManagerWindowFocused = true;
    syncTaskManagerRefreshLifecycle({ immediate: true });
  });

  window.addEventListener('blur', () => {
    taskManagerWindowFocused = false;
    syncTaskManagerRefreshLifecycle();
  });
}

function formatTaskManagerMemory(value) {
  const number = Number(value) || 0;
  return `${Math.round(number * 10) / 10} MB`;
}

function formatTaskManagerPercent(value) {
  const number = Number(value) || 0;
  return `${Math.round(number * 10) / 10}%`;
}

function formatTaskManagerDuration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return `${Math.round(value)}s`;
  if (value < 3600) return `${Math.round(value / 60)}m`;
  return `${Math.round((value / 3600) * 10) / 10}h`;
}

function isTaskManagerHighUsage(tab) {
  return (Number(tab.memoryMb) || 0) >= TASK_MANAGER_HIGH_MEMORY_MB || (Number(tab.cpuPercent) || 0) >= TASK_MANAGER_HIGH_CPU_PERCENT;
}

function getTaskManagerResourceScore(tab) {
  return (Number(tab.memoryMb) || 0) + (Number(tab.cpuPercent) || 0) * 10 + (Number(tab.idleWakeups) || 0) * 2;
}

function getTaskManagerHealth(totalMemory, totalCpu, tabs) {
  const heavyTabs = tabs.filter(isTaskManagerHighUsage).length;
  if (totalCpu >= 60 || totalMemory >= 2500 || heavyTabs >= 3) {
    return { level: 'high', label: getText('task-manager-health-high', 'Yüksek kullanım') };
  }
  if (totalCpu >= 25 || totalMemory >= 1200 || heavyTabs > 0) {
    return { level: 'warning', label: getText('task-manager-health-warning', 'Dikkat gerekli') };
  }
  return { level: 'normal', label: getText('task-manager-health-normal', 'Normal') };
}

function getTaskManagerRecommendation(health) {
  if (health.level === 'high') return getText('task-manager-recommendation-high', 'Yoğun sekmeleri kapatın veya uyutun; sistem yükü yüksek.');
  if (health.level === 'warning') return getText('task-manager-recommendation-warning', 'Yüksek kullanan sekmeleri uyutmak performansı artırabilir.');
  return getText('task-manager-recommendation-normal', 'Kaynak kullanımı dengeli görünüyor.');
}

function taskManagerMatchesFilter(tab) {
  if (taskManagerFilter === 'attention') return isTaskManagerHighUsage(tab);
  if (taskManagerFilter === 'active') return !!tab.isActive;
  if (taskManagerFilter === 'sleeping') return !!tab.isSleeping;
  if (taskManagerFilter === 'audio') return !!tab.isPlayingAudio;
  if (taskManagerFilter === 'pinned') return !!tab.isPinned;
  return true;
}

function getVisibleTaskManagerTabs(tabs) {
  const query = taskManagerSearch.trim().toLowerCase();
  const filtered = tabs.filter(tab => {
    if (!taskManagerMatchesFilter(tab)) return false;
    if (!query) return true;
    return `${tab.title || ''} ${tab.url || ''} ${tab.space || ''}`.toLowerCase().includes(query);
  });

  return filtered.sort((a, b) => {
    if (taskManagerSort === 'memory') return (Number(b.memoryMb) || 0) - (Number(a.memoryMb) || 0);
    if (taskManagerSort === 'cpu') return (Number(b.cpuPercent) || 0) - (Number(a.cpuPercent) || 0);
    if (taskManagerSort === 'activity') return (Number(b.lastActiveAt) || 0) - (Number(a.lastActiveAt) || 0);
    if (taskManagerSort === 'title') return String(a.title || '').localeCompare(String(b.title || ''), getTaskManagerLocale());
    return getTaskManagerResourceScore(b) - getTaskManagerResourceScore(a);
  });
}

function buildTaskManagerFlags(tab) {
  const flags = [];
  if (tab.isPinned) flags.push(getText('task-manager-pinned', 'Sabit'));
  if (tab.isPlayingAudio) flags.push(getText('task-manager-audio', 'Ses'));
  if (tab.hasSplit) flags.push(getText('task-manager-split', 'Bölünmüş'));
  if (tab.isLoading) flags.push(getText('task-manager-loading', 'Yükleniyor'));
  return flags;
}

function initTaskManagerControls() {
  const filterControl = document.getElementById('task-manager-filter');
  const sortControl = document.getElementById('task-manager-sort');
  const searchControl = document.getElementById('task-manager-search');

  if (filterControl && !filterControl.dataset.bound) {
    filterControl.dataset.bound = 'true';
    filterControl.addEventListener('change', () => {
      taskManagerFilter = filterControl.value || 'all';
      renderTaskManagerSection();
    });
  }

  if (sortControl && !sortControl.dataset.bound) {
    sortControl.dataset.bound = 'true';
    sortControl.addEventListener('change', () => {
      taskManagerSort = sortControl.value || 'resource';
      renderTaskManagerSection();
    });
  }

  if (searchControl && !searchControl.dataset.bound) {
    searchControl.dataset.bound = 'true';
    searchControl.addEventListener('input', () => {
      taskManagerSearch = searchControl.value || '';
      renderTaskManagerSection();
    });
  }
}

function renderTaskManagerRowHtml(tab) {
  const title = tab.title || getText('new-tab', 'Yeni Sekme');
  const status = tab.isSleeping
    ? getText('task-manager-sleeping', 'Uykuda')
    : (tab.isActive ? getText('task-manager-active', 'Aktif') : getText('task-manager-running', 'Çalışıyor'));
  const isHighUsage = isTaskManagerHighUsage(tab);
  const highUsageBadge = isHighUsage
    ? `<span class="task-manager-hot">${escapeHtml(getText('task-manager-heavy', 'Yüksek'))}</span>`
    : '';
  const flags = buildTaskManagerFlags(tab);
  const flagHtml = flags.length ? `<div class="task-manager-flags">${flags.map(flag => `<span>${escapeHtml(flag)}</span>`).join('')}</div>` : '';
  const inactiveLabel = tab.isActive
    ? getText('task-manager-active', 'Aktif')
    : `${getText('task-manager-inactive', 'Boşta')} ${formatTaskManagerDuration(tab.inactiveSeconds)}`;

  return `
    <div class="task-manager-row ${isHighUsage ? 'attention' : ''}" data-tab-id="${escapeHtml(tab.id)}">
      <div class="task-manager-tab-main">
        <div class="task-manager-title-line">
          <div class="task-manager-tab-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
          ${highUsageBadge}
        </div>
        <div class="task-manager-tab-url" title="${escapeHtml(tab.url || '')}">${escapeHtml(tab.url || tab.space || '')}</div>
        ${flagHtml}
        <div class="task-manager-detail-grid">
          <span>${escapeHtml(getText('task-manager-space', 'Alan'))}: <strong>${escapeHtml(tab.space || '-')}</strong></span>
          <span>${escapeHtml(getText('task-manager-window', 'Pencere'))}: <strong>${escapeHtml(tab.windowId || '-')}</strong></span>
          <span>${escapeHtml(getText('task-manager-zoom', 'Zoom'))}: <strong>${escapeHtml(formatTaskManagerPercent((Number(tab.zoomFactor) || 1) * 100))}</strong></span>
          <span>${escapeHtml(getText('task-manager-process-id', 'PID'))}: <strong>${escapeHtml(tab.pid || '-')}</strong></span>
          <span>${escapeHtml(getText('task-manager-last-active-short', 'Son aktif'))}: <strong>${escapeHtml(inactiveLabel)}</strong></span>
          <span>${escapeHtml(getText('task-manager-idle-wakeups', 'Uyandırma/sn'))}: <strong>${escapeHtml(String(tab.idleWakeups || 0))}</strong></span>
        </div>
      </div>
      <div class="task-manager-pill">${escapeHtml(status)}</div>
      <div class="task-manager-metric"><span>${escapeHtml(getText('task-manager-working-set', 'Çalışma seti'))}</span><strong>${escapeHtml(formatTaskManagerMemory(tab.memoryMb))}</strong><small>${escapeHtml(getText('task-manager-private-memory', 'Özel bellek'))}: ${escapeHtml(formatTaskManagerMemory(tab.privateMemoryMb))}</small></div>
      <div class="task-manager-metric"><span>CPU</span><strong>${escapeHtml(formatTaskManagerPercent(tab.cpuPercent))}</strong><small>${escapeHtml(getText('task-manager-peak-memory', 'Zirve RAM'))}: ${escapeHtml(formatTaskManagerMemory(tab.peakMemoryMb))}</small></div>
      <div class="task-manager-actions">
        <button class="task-manager-btn sleep" ${tab.canSleep ? '' : 'disabled'}>${escapeHtml(getText('task-manager-sleep', 'Uyut'))}</button>
        <button class="task-manager-btn reload" ${tab.isSleeping ? 'disabled' : ''}>${escapeHtml(getText('task-manager-reload', 'Yenile'))}</button>
        <button class="task-manager-btn close">${escapeHtml(getText('task-manager-close', 'Kapat'))}</button>
      </div>
    </div>
  `;
}

function bindTaskManagerRowActions(row) {
  const tabId = row.getAttribute('data-tab-id');
  row.querySelector('.task-manager-btn.sleep')?.addEventListener('click', () => {
    window.oslo.sleepTab(tabId);
    setTimeout(renderTaskManagerSection, 250);
  });
  row.querySelector('.task-manager-btn.reload')?.addEventListener('click', () => {
    refreshTaskManagerRow(tabId);
  });
  row.querySelector('.task-manager-btn.close')?.addEventListener('click', () => {
    window.oslo.closeTab(tabId);
    setTimeout(renderTaskManagerSection, 250);
  });
}

async function refreshTaskManagerRow(tabId) {
  if (!tabId || typeof window.oslo.getTaskManagerTab !== 'function') return;
  const row = document.querySelector(`.task-manager-row[data-tab-id="${CSS.escape(tabId)}"]`);
  const reloadButton = row?.querySelector('.task-manager-btn.reload');
  if (reloadButton) reloadButton.disabled = true;

  try {
    const snapshot = await window.oslo.getTaskManagerTab(tabId);
    const tab = snapshot?.tab;
    if (!tab || !row) {
      renderTaskManagerSection();
      return;
    }

    row.outerHTML = renderTaskManagerRowHtml(tab);
    const nextRow = document.querySelector(`.task-manager-row[data-tab-id="${CSS.escape(tabId)}"]`);
    if (nextRow) bindTaskManagerRowActions(nextRow);
  } catch (error) {
    renderTaskManagerSection();
  }
}

async function renderTaskManagerSection() {
  const list = document.getElementById('task-manager-list');
  if (!list || typeof window.oslo.getTaskManagerTabs !== 'function') return;
  if (!isTaskManagerPanelActive()) {
    stopTaskManagerLiveRefresh();
    return;
  }
  if (taskManagerRenderInFlight) return;

  taskManagerRenderInFlight = true;
  try {
    const snapshot = await window.oslo.getTaskManagerTabs();
    const taskTabs = Array.isArray(snapshot?.tabs) ? snapshot.tabs : [];
    const totalMemory = taskTabs.reduce((sum, tab) => sum + (Number(tab.memoryMb) || 0), 0);
    const totalCpu = taskTabs.reduce((sum, tab) => sum + (Number(tab.cpuPercent) || 0), 0);
    const topMemoryTab = [...taskTabs].sort((a, b) => (Number(b.memoryMb) || 0) - (Number(a.memoryMb) || 0))[0] || null;
    const topCpuTab = [...taskTabs].sort((a, b) => (Number(b.cpuPercent) || 0) - (Number(a.cpuPercent) || 0))[0] || null;
    const visibleTabs = getVisibleTaskManagerTabs(taskTabs);
    const activeCount = taskTabs.filter(tab => tab.isActive).length;
    const sleepingCount = taskTabs.filter(tab => tab.isSleeping).length;
    const highUsageCount = taskTabs.filter(isTaskManagerHighUsage).length;
    const pinnedCount = taskTabs.filter(tab => tab.isPinned).length;
    const audioCount = taskTabs.filter(tab => tab.isPlayingAudio).length;
    const averageMemory = taskTabs.length ? totalMemory / taskTabs.length : 0;
    const sleepingMemorySaved = taskTabs.reduce((sum, tab) => sum + (tab.isSleeping ? (Number(tab.sleepSavedMemoryMb) || Number(tab.peakMemoryMb) || 0) : 0), 0);
    const health = getTaskManagerHealth(totalMemory, totalCpu, taskTabs);

    const totalTabsEl = document.getElementById('task-manager-total-tabs');
    const totalMemoryEl = document.getElementById('task-manager-total-memory');
    const averageMemoryEl = document.getElementById('task-manager-average-memory');
    const totalCpuEl = document.getElementById('task-manager-total-cpu');
    const topTabEl = document.getElementById('task-manager-top-tab');
    const activeTabsEl = document.getElementById('task-manager-active-tabs');
    const sleepingTabsEl = document.getElementById('task-manager-sleeping-tabs');
    const highUsageTabsEl = document.getElementById('task-manager-high-usage-tabs');
    const pinnedTabsEl = document.getElementById('task-manager-pinned-tabs');
    const audioTabsEl = document.getElementById('task-manager-audio-tabs');
    const topCpuEl = document.getElementById('task-manager-top-cpu');
    const healthTextEl = document.getElementById('task-manager-health-text');
    const healthBox = document.querySelector('.task-manager-health');
    const lastUpdatedEl = document.getElementById('task-manager-last-updated');
    const sleepSavingsEl = document.getElementById('task-manager-sleep-savings');
    const recommendationEl = document.getElementById('task-manager-recommendation');
    const visibleCountEl = document.getElementById('task-manager-visible-count');

    if (totalTabsEl) totalTabsEl.textContent = String(taskTabs.length);
    if (totalMemoryEl) totalMemoryEl.textContent = formatTaskManagerMemory(totalMemory);
    if (averageMemoryEl) averageMemoryEl.textContent = formatTaskManagerMemory(averageMemory);
    if (totalCpuEl) totalCpuEl.textContent = formatTaskManagerPercent(totalCpu);
    if (topTabEl) topTabEl.textContent = topMemoryTab ? (topMemoryTab.title || '-') : '-';
    if (activeTabsEl) activeTabsEl.textContent = String(activeCount);
    if (sleepingTabsEl) sleepingTabsEl.textContent = String(sleepingCount);
    if (highUsageTabsEl) highUsageTabsEl.textContent = String(highUsageCount);
    if (pinnedTabsEl) pinnedTabsEl.textContent = String(pinnedCount);
    if (audioTabsEl) audioTabsEl.textContent = String(audioCount);
    if (topCpuEl) topCpuEl.textContent = topCpuTab ? `${topCpuTab.title || '-'} (${formatTaskManagerPercent(topCpuTab.cpuPercent)})` : '-';
    if (healthTextEl) {
      healthTextEl.textContent = health.label;
      healthTextEl.className = health.level;
    }
    if (healthBox) healthBox.dataset.level = health.level;
    if (sleepSavingsEl) sleepSavingsEl.textContent = sleepingMemorySaved > 0 ? formatTaskManagerMemory(sleepingMemorySaved) : '-';
    if (recommendationEl) {
      recommendationEl.textContent = getTaskManagerRecommendation(health);
      recommendationEl.className = health.level;
    }
    if (visibleCountEl) visibleCountEl.textContent = `${visibleTabs.length}/${taskTabs.length}`;
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = new Intl.DateTimeFormat(getTaskManagerLocale(), {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(new Date(snapshot?.generatedAt || Date.now()));
    }

    if (taskTabs.length === 0) {
      list.innerHTML = `<div class="task-manager-empty">${getText('task-manager-empty', 'Açık sekme bulunamadı.')}</div>`;
      return;
    }

    if (visibleTabs.length === 0) {
      list.innerHTML = `<div class="task-manager-empty">${escapeHtml(getText('task-manager-no-results', 'Filtreyle eşleşen sekme yok.'))}</div>`;
      return;
    }

    list.innerHTML = visibleTabs.map(renderTaskManagerRowHtml).join('');

    list.querySelectorAll('.task-manager-row').forEach(row => {
      bindTaskManagerRowActions(row);
    });
  } catch (error) {
    list.innerHTML = `<div class="task-manager-empty">${escapeHtml(getText('task-manager-error', 'Görev yöneticisi verileri alınamadı.'))}</div>`;
  } finally {
    taskManagerRenderInFlight = false;
    scheduleNextTaskManagerRefresh();
  }
}

function shuffleSecure(chars) {
  for (let i = chars.length - 1; i > 0; i--) {
    const swap = randomIndex(i + 1);
    [chars[i], chars[swap]] = [chars[swap], chars[i]];
  }
  return chars;
}

function estimateGeneratedPassword(password, charsetSize) {
  const length = String(password || '').length;
  const entropy = length * Math.log2(Math.max(1, charsetSize));
  if (entropy >= 160) return { entropy, level: 'very-strong', score: 100 };
  if (entropy >= 120) return { entropy, level: 'strong', score: 82 };
  if (entropy >= 90) return { entropy, level: 'good', score: 64 };
  return { entropy, level: 'medium', score: 44 };
}

function updateGeneratedPasswordStrength(password, charsetSize) {
  const fill = document.getElementById('password-strength-fill');
  const label = document.getElementById('password-strength-label');
  const estimate = estimateGeneratedPassword(password, charsetSize);
  const labelKey = `password-strength-${estimate.level}`;

  if (fill) {
    fill.style.width = `${estimate.score}%`;
    fill.className = `password-strength-fill ${estimate.level}`;
  }
  if (label) {
    label.textContent = getText(labelKey, estimate.level === 'very-strong' ? 'Çok güçlü' : 'Güçlü');
  }
}

function generateStrongPassword(options = getGeneratorOptions()) {
  let groups = getActivePasswordGroups(options);
  if (groups.length === 0) {
    ['password-option-uppercase', 'password-option-lowercase', 'password-option-numbers', 'password-option-symbols'].forEach(id => {
      const control = document.getElementById(id);
      if (control) control.checked = true;
    });
    groups = getActivePasswordGroups({ ...options, uppercase: true, lowercase: true, numbers: true, symbols: true });
  }

  const length = Math.max(options.length, groups.length);
  const allChars = groups.join('');
  const chars = groups.map(group => group[randomIndex(group.length)]);

  while (chars.length < length) {
    chars.push(allChars[randomIndex(allChars.length)]);
  }

  const password = shuffleSecure(chars).join('');
  updateGeneratedPasswordStrength(password, allChars.length);
  return password;
}

function setGeneratedPassword() {
  const output = document.getElementById('generated-password-output');
  const lengthControl = document.getElementById('password-generator-length');
  const lengthValue = document.getElementById('password-generator-length-value');
  if (lengthControl && lengthValue) lengthValue.textContent = String(lengthControl.value || 28);
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

let latestPasswordHealthAudit = null;
let passwordHealthRequestToken = 0;
let passwordHealthScanControlsBound = false;

function getCredentialHost(originValue) {
  try {
    return new URL(originValue).hostname.replace(/^www\./, '');
  } catch (error) {
    return String(originValue || '');
  }
}

function getPasswordHealthLevel(score, total) {
  if (!total) return 'empty';
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'warning';
  return 'critical';
}

function getPasswordHealthStatus(level) {
  if (level === 'excellent') return getText('password-health-status-excellent', 'Mükemmel');
  if (level === 'good') return getText('password-health-status-good', 'İyi');
  if (level === 'warning') return getText('password-health-status-warning', 'Dikkat gerekli');
  if (level === 'critical') return getText('password-health-status-critical', 'Acil yenileme gerekli');
  return getText('password-health-no-data', 'Veri yok');
}

function getPasswordHealthSummary(audit, level) {
  const total = audit?.total || 0;
  const weak = audit?.weak || 0;
  const reused = audit?.reused || 0;
  const breached = audit?.breached || 0;
  if (!total) return getText('password-health-empty', 'Kayıtlı şifre bulunmuyor.');
  if (level === 'excellent') return getText('password-health-summary-safe', 'Kayıtlı şifreler güçlü, benzersiz ve sızıntı listelerinde görünmüyor.');
  if (breached > 0) {
    return getText('password-health-summary-critical', '{count} şifre sızıntı listesinde görünüyor. Öncelik bu sitelerde olmalı.')
      .replace('{count}', breached);
  }
  if (weak > 0 && reused > 0) {
    return getText('password-health-summary-mixed', 'Zayıf ve tekrar kullanılan şifreler var. Yenilemeye en riskli sitelerden başlayın.');
  }
  return getText('password-health-summary-attention', 'Bazı kayıtlar yenilenmeli. Daha güçlü ve benzersiz şifreler kullanın.');
}

function getPasswordHealthReasonLabel(reason) {
  if (reason === 'breached') return getText('password-audit-breached-label', 'Sızıntı');
  if (reason === 'reused') return getText('password-audit-reused-label', 'Tekrar');
  return getText('password-audit-weak-label', 'Zayıf');
}

function getPasswordHealthSuggestion(recommendation) {
  const reasons = new Set(recommendation?.reasons || []);
  if (reasons.has('breached')) {
    return getText('password-health-renew-breached', 'Bu sitedeki şifreyi hemen değiştirin; sızıntı listesinde görünüyor.');
  }
  if (reasons.has('weak') && reasons.has('reused')) {
    return getText('password-health-renew-weak-reused', 'Bu site için güçlü ve benzersiz yeni bir şifre oluşturun.');
  }
  if (reasons.has('reused')) {
    return getText('password-health-renew-reused', 'Bu sitede başka yerde kullanılmayan benzersiz bir şifre belirleyin.');
  }
  return getText('password-health-renew-weak', 'Bu sitedeki şifreyi daha uzun ve karmaşık bir şifreyle değiştirin.');
}

function showPasswordCopyFeedback(button, message = getText('password-copy-toast', 'Kopyalandı!')) {
  if (!button) return;
  button.classList.add('copied');
  button.setAttribute('data-copy-feedback', message);
  clearTimeout(button.copyFeedbackTimer);
  button.copyFeedbackTimer = setTimeout(() => {
    button.classList.remove('copied');
    button.removeAttribute('data-copy-feedback');
  }, 1400);
}

async function copyPasswordFieldValue(value, button, message) {
  const text = String(value || '');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    const fallback = document.createElement('textarea');
    fallback.value = text;
    fallback.setAttribute('readonly', '');
    fallback.style.position = 'fixed';
    fallback.style.opacity = '0';
    document.body.appendChild(fallback);
    fallback.select();
    document.execCommand('copy');
    fallback.remove();
  }
  showPasswordCopyFeedback(button, message);
}

function getPasswordHealthSiteList(issues, predicate) {
  const sites = [];
  const seen = new Set();
  issues.filter(predicate).forEach(issue => {
    const host = getCredentialHost(issue.origin) || issue.origin || '-';
    const key = host.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      sites.push(host);
    }
  });
  if (sites.length === 0) return getText('password-health-none', 'Yok');
  const visible = sites.slice(0, 3).join(', ');
  if (sites.length <= 3) return visible;
  return `${visible} ${getText('password-health-more-template', '+{count} daha').replace('{count}', sites.length - 3)}`;
}

function normalizePasswordRecommendations(audit) {
  if (Array.isArray(audit?.recommendations)) return audit.recommendations;
  return (audit?.issues || []).map(issue => ({
    id: issue.id,
    origin: issue.origin,
    username: issue.username,
    reasons: [
      issue.isBreached ? 'breached' : '',
      issue.isWeak ? 'weak' : '',
      issue.isReused ? 'reused' : ''
    ].filter(Boolean),
    priority: issue.isBreached ? 3 : (issue.isWeak && issue.isReused ? 2 : 1),
    breachCount: issue.breachCount || 0,
    reuseCount: issue.reuseCount || 0
  }));
}

function renderPasswordHealthPanel(audit = latestPasswordHealthAudit) {
  const panel = document.getElementById('password-health-panel');
  if (!panel || !audit) return;

  const total = audit.total || 0;
  const score = Number.isFinite(Number(audit.securityScore)) ? Number(audit.securityScore) : 0;
  const level = getPasswordHealthLevel(score, total);
  const issues = audit.issues || [];
  const recommendations = normalizePasswordRecommendations(audit);

  const ring = document.querySelector('.password-health-score-ring');
  const scoreEl = document.getElementById('password-health-score-value');
  const statusEl = document.getElementById('password-health-status');
  const summaryEl = document.getElementById('password-health-summary');
  const totalEl = document.getElementById('password-health-total');
  const weakEl = document.getElementById('password-health-weak');
  const reusedEl = document.getElementById('password-health-reused');
  const breachedEl = document.getElementById('password-health-breached');
  const weakSitesEl = document.getElementById('password-health-weak-sites');
  const reusedSitesEl = document.getElementById('password-health-reused-sites');
  const breachedSitesEl = document.getElementById('password-health-breached-sites');
  const recommendationList = document.getElementById('password-health-recommendation-list');

  if (ring) ring.dataset.level = level;
  if (scoreEl) scoreEl.textContent = total ? String(score) : '--';
  if (statusEl) statusEl.textContent = getPasswordHealthStatus(level);
  if (summaryEl) summaryEl.textContent = getPasswordHealthSummary(audit, level);
  if (totalEl) totalEl.textContent = String(total);
  if (weakEl) weakEl.textContent = String(audit.weak || 0);
  if (reusedEl) reusedEl.textContent = String(audit.reused || 0);
  if (breachedEl) breachedEl.textContent = String(audit.breached || 0);
  if (weakSitesEl) weakSitesEl.textContent = getPasswordHealthSiteList(issues, issue => issue.isWeak);
  if (reusedSitesEl) reusedSitesEl.textContent = getPasswordHealthSiteList(issues, issue => issue.isReused);
  if (breachedSitesEl) breachedSitesEl.textContent = getPasswordHealthSiteList(issues, issue => issue.isBreached);

  if (!recommendationList) return;
  if (recommendations.length === 0) {
    recommendationList.innerHTML = `<div class="password-health-empty">${escapeHtml(
      total
        ? getText('password-health-no-recommendations', 'Yenileme önerisi yok.')
        : getText('password-health-empty', 'Kayıtlı şifre bulunmuyor.')
    )}</div>`;
    return;
  }

  recommendationList.innerHTML = recommendations.slice(0, 8).map(recommendation => {
    const host = getCredentialHost(recommendation.origin) || recommendation.origin || '-';
    const username = recommendation.username || '-';
    const reasons = (recommendation.reasons || []).map(reason => (
      `<span class="password-health-reason ${escapeHtml(reason)}">${escapeHtml(getPasswordHealthReasonLabel(reason))}</span>`
    )).join('');
    return `
      <div class="password-health-recommendation-row">
        <div class="password-health-recommendation-info">
          <span class="password-health-recommendation-site">${escapeHtml(host)}</span>
          <span class="password-health-recommendation-detail">${escapeHtml(username)} · ${escapeHtml(getPasswordHealthSuggestion(recommendation))}</span>
        </div>
        <div class="password-health-reason-list">${reasons}</div>
      </div>
    `;
  }).join('');
}

async function refreshPasswordHealthPanel({ force = false } = {}) {
  const panel = document.getElementById('password-health-panel');
  const refreshButton = document.getElementById('settings-refresh-password-health');
  const recommendationList = document.getElementById('password-health-recommendation-list');
  if (!panel) return;
  if (typeof window.oslo?.auditPasswords !== 'function') {
    if (recommendationList) {
      recommendationList.innerHTML = `<div class="password-health-empty">${escapeHtml(getText('password-health-error', 'Şifre sağlığı yüklenemedi.'))}</div>`;
    }
    return;
  }
  if (!force && latestPasswordHealthAudit) {
    renderPasswordHealthPanel(latestPasswordHealthAudit);
    return;
  }

  const token = ++passwordHealthRequestToken;
  panel.classList.add('loading');
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.dataset.originalText = refreshButton.textContent || '';
    refreshButton.textContent = getText('password-health-scanning-short', 'Taranıyor...');
  }
  if (recommendationList) {
    recommendationList.innerHTML = `<div class="password-health-empty">${escapeHtml(getText('password-health-scanning', 'Şifre sağlığı taranıyor...'))}</div>`;
  }
  try {
    await new Promise(resolve => requestAnimationFrame(resolve));
    const audit = await window.oslo.auditPasswords();
    if (token !== passwordHealthRequestToken) return;
    latestPasswordHealthAudit = audit;
    renderPasswordHealthPanel(audit);
  } catch (error) {
    console.error('Password health panel failed:', error);
    if (recommendationList) {
      recommendationList.innerHTML = `<div class="password-health-empty">${escapeHtml(getText('password-health-error', 'Şifre sağlığı yüklenemedi.'))}</div>`;
    }
  } finally {
    if (token === passwordHealthRequestToken && refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent = refreshButton.dataset.originalText || getText('password-health-refresh', 'Tara');
      delete refreshButton.dataset.originalText;
    }
    if (token === passwordHealthRequestToken) panel.classList.remove('loading');
  }
}

function bindPasswordHealthScanControls() {
  const refreshButton = document.getElementById('settings-refresh-password-health');
  if (refreshButton) refreshButton.dataset.bound = 'true';

  if (!passwordHealthScanControlsBound) {
    passwordHealthScanControlsBound = true;
    document.addEventListener('click', (event) => {
      const target = event.target?.closest?.('#settings-refresh-password-health');
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      if (target.disabled) return;
      refreshPasswordHealthPanel({ force: true });
    }, true);
    document.addEventListener('keydown', (event) => {
      const target = event.target?.closest?.('#settings-refresh-password-health');
      if (!target) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      if (target.disabled) return;
      refreshPasswordHealthPanel({ force: true });
    }, true);
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
    latestPasswordHealthAudit = audit;
    renderPasswordHealthPanel(audit);
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
    showCustomAlert(getText('password-audit-title', 'Şifre Güvenliği'), getText('password-audit-error', 'Şifre taraması tamamlanamadı.'));
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
      stopTaskManagerLiveRefresh();
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
      if (tabName !== 'ram') stopTaskManagerLiveRefresh();

      if (tabName === 'passwords') {
        renderSavedPasswords();
        refreshPasswordHealthPanel();
      } else if (tabName === 'about') {
        loadAboutTabSystemInfo();
      } else if (tabName === 'ram') {
        initTaskManagerControls();
        ensureTaskManagerLiveRefresh({ immediate: true });
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
      const value = key === 'sleepTabsTimeout' ? parseFloat(control.value) : control.value;
      window.oslo.setSetting(key, value);
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

  bindTaskManagerLifecycleListeners();
  initTaskManagerControls();
  ensureTaskManagerLiveRefresh();

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
  document.getElementById('settings-audit-passwords-saved')?.addEventListener('click', auditSavedPasswords);
  bindPasswordHealthScanControls();
  document.getElementById('saved-passwords-search')?.addEventListener('input', renderSavedPasswords);

  ['password-generator-length', 'password-option-uppercase', 'password-option-lowercase', 'password-option-numbers', 'password-option-symbols', 'password-option-ambiguous'].forEach(id => {
    const control = document.getElementById(id);
    const eventName = control?.type === 'range' ? 'input' : 'change';
    control?.addEventListener(eventName, setGeneratedPassword);
  });

  document.getElementById('btn-generate-password')?.addEventListener('click', setGeneratedPassword);
  document.getElementById('btn-copy-generated-password')?.addEventListener('click', async () => {
    const output = document.getElementById('generated-password-output');
    const value = output?.value || '';
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showCustomAlert(getText('password-generator-title', 'Şifre Üreticisi'), getText('password-copy-success', 'Şifre panoya kopyalandı.'));
    } catch (error) {
      output?.select();
      document.execCommand('copy');
      showCustomAlert(getText('password-generator-title', 'Şifre Üreticisi'), getText('password-copy-success', 'Şifre panoya kopyalandı.'));
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
          showCustomAlert(getText('saved-passwords-title', 'Kayıtlı Şifreler'), msg);
          renderSavedPasswords();
          refreshPasswordHealthPanel({ force: true });
        } else if (res.message === 'no_credentials_found') {
          const msg = translations[state.currentLang]['passwords-import-empty'] || 'Seçilen dosyada şifre bulunamadı.';
          showCustomAlert(getText('saved-passwords-title', 'Kayıtlı Şifreler'), msg);
        } else if (res.message !== 'canceled') {
          let msg = translations[state.currentLang]['passwords-import-error'] || 'İçe aktarma hatası: {error}';
          msg = msg.replace('{error}', res.message);
          showCustomAlert(getText('saved-passwords-title', 'Kayıtlı Şifreler'), msg);
        }
      });
    });
  }

  if (exportPasswordsBtn) {
    exportPasswordsBtn.addEventListener('click', () => {
      window.oslo.exportPasswords().then((res) => {
        if (!res) return;
        if (res.success) {
          let msg = translations[state.currentLang]['passwords-export-success'] || 'Şifreler başarıyla dışa aktarıldı!\nToplam: {count}';
          msg = msg.replace('{count}', res.count);
          showCustomAlert(getText('saved-passwords-title', 'Kayıtlı Şifreler'), msg);
        } else if (res.message === 'no_passwords_to_export') {
          const msg = translations[state.currentLang]['passwords-export-empty'] || 'Dışa aktarılacak şifre bulunmuyor.';
          showCustomAlert(getText('saved-passwords-title', 'Kayıtlı Şifreler'), msg);
        } else if (res.message !== 'canceled') {
          let msg = translations[state.currentLang]['passwords-export-error'] || 'Dışa aktarma hatası: {error}';
          msg = msg.replace('{error}', res.message);
          showCustomAlert(getText('saved-passwords-title', 'Kayıtlı Şifreler'), msg);
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
      renderPasswordHealthPanel();
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
    const allPasswords = Array.isArray(passwords) ? passwords : [];
    const query = (document.getElementById('saved-passwords-search')?.value || '').toLowerCase().trim();
    const countEl = document.getElementById('saved-passwords-count');
    const getHost = (originValue) => {
      try {
        return new URL(originValue).hostname.replace(/^www\./, '');
      } catch (error) {
        return String(originValue || '');
      }
    };
    const filteredPasswords = allPasswords
      .filter(cred => {
        if (!query) return true;
        return [cred.origin, getHost(cred.origin), cred.username].join(' ').toLowerCase().includes(query);
      })
      .sort((a, b) => getHost(a.origin).localeCompare(getHost(b.origin), undefined, { sensitivity: 'base' }));

    if (countEl) countEl.textContent = query ? `${filteredPasswords.length}/${allPasswords.length}` : String(allPasswords.length);

    if (allPasswords.length === 0) {
      const emptyMsg = translations[state.currentLang]['no-saved-passwords'] || 'Kayıtlı şifre bulunmuyor.';
      container.innerHTML = `<div class="passwords-empty">${emptyMsg}</div>`;
      return;
    }

    if (filteredPasswords.length === 0) {
      const emptyMsg = translations[state.currentLang]['saved-passwords-no-results'] || 'Aramanızla eşleşen kayıt yok.';
      container.innerHTML = `<div class="passwords-empty">${emptyMsg}</div>`;
      return;
    }

    filteredPasswords.forEach(cred => {
      const row = document.createElement('div');
      row.className = 'password-row';
      const host = getHost(cred.origin);
      const strength = isWeakPassword(cred.password) ? 'weak' : 'strong';
      const strengthText = strength === 'weak'
        ? (translations[state.currentLang]['password-strength-weak'] || 'Zayıf')
        : (translations[state.currentLang]['password-strength-strong'] || 'Güçlü');

      const avatar = document.createElement('div');
      avatar.className = 'password-site-avatar';
      avatar.textContent = (host || '?').charAt(0).toUpperCase();

      const info = document.createElement('div');
      info.className = 'password-site-info';

      const origin = document.createElement('span');
      origin.className = 'password-origin';
      origin.textContent = host || cred.origin;

      const username = document.createElement('span');
      username.className = 'password-username';
      username.textContent = cred.username || '-';

      const originDetail = document.createElement('span');
      originDetail.className = 'password-origin-detail';
      originDetail.textContent = cred.origin || '';

      info.appendChild(origin);
      info.appendChild(username);
      info.appendChild(originDetail);

      const valContainer = document.createElement('div');
      valContainer.className = 'password-value-container';

      const input = document.createElement('input');
      input.type = 'password';
      input.className = 'password-display-input';
      input.value = cred.password;
      input.readOnly = true;

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'password-action-btn toggle-visibility';
      toggleBtn.title = translations[state.currentLang]['password-show'] || 'Şifreyi Göster';
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
      `;

      toggleBtn.addEventListener('click', () => {
        if (input.type === 'password') {
          input.type = 'text';
          toggleBtn.title = translations[state.currentLang]['password-hide'] || 'Şifreyi Gizle';
          toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.82l2.92 2.92c1.51-1.39 2.7-3.14 3.44-5.12-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22l1.41-1.41L3.41 2.86 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-7.8l1.86 1.86c-.56-.17-1.14-.26-1.7-.26-2.76 0-5 2.24-5 5 0 .56.09 1.14.26 1.7L3.08 6.13C4.47 4.74 6.22 3.55 8.2 2.81c1.24-.45 2.58-.7 3.98-.7z"/>
            </svg>
          `;
        } else {
          input.type = 'password';
          toggleBtn.title = translations[state.currentLang]['password-show'] || 'Şifreyi Göster';
          toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          `;
        }
      });

      valContainer.appendChild(input);
      valContainer.appendChild(toggleBtn);

      const strengthBadge = document.createElement('span');
      strengthBadge.className = `password-strength-badge ${strength}`;
      strengthBadge.textContent = strengthText;

      const copyUserBtn = document.createElement('button');
      copyUserBtn.className = 'password-action-btn';
      copyUserBtn.title = translations[state.currentLang]['password-copy-username'] || 'Kullanıcı adını kopyala';
      copyUserBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      `;
      copyUserBtn.addEventListener('click', async () => {
        await copyPasswordFieldValue(
          cred.username || '',
          copyUserBtn,
          getText('password-copy-username-success', 'Kullanıcı adı kopyalandı.')
        );
      });

      const copyPasswordBtn = document.createElement('button');
      copyPasswordBtn.className = 'password-action-btn';
      copyPasswordBtn.title = translations[state.currentLang]['password-copy-password'] || 'Şifreyi kopyala';
      copyPasswordBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      `;
      copyPasswordBtn.addEventListener('click', async () => {
        await copyPasswordFieldValue(
          cred.password || '',
          copyPasswordBtn,
          getText('password-copy-password-success', 'Şifre kopyalandı.')
        );
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'password-action-btn delete-btn';
      deleteBtn.title = translations[state.currentLang]['password-delete'] || 'Sil';
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      `;

      deleteBtn.addEventListener('click', () => {
        const title = translations[state.currentLang]['password-delete'] || 'Sil';
        const template = translations[state.currentLang]['password-delete-confirm'] || '{site} için kayıtlı şifre silinsin mi?';
        showCustomConfirm(title, template.replace('{site}', host || cred.origin || '')).then((confirmed) => {
          if (!confirmed) return;
          window.oslo.deleteCredential(cred.id).then(() => {
            renderSavedPasswords();
            refreshPasswordHealthPanel({ force: true });
          });
        });
      });

      const actions = document.createElement('div');
      actions.className = 'password-row-actions';
      actions.appendChild(copyUserBtn);
      actions.appendChild(copyPasswordBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(avatar);
      row.appendChild(info);
      row.appendChild(valContainer);
      row.appendChild(strengthBadge);
      row.appendChild(actions);

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

    if (versionDisplay) versionDisplay.textContent = info.appVersion || '1.0.0-beta.3';
    if (versionDisplayMain) versionDisplayMain.textContent = info.appVersion || '1.0.0-beta.3';
    if (valElectron) valElectron.textContent = info.electron || '-';
    if (valChrome) valChrome.textContent = info.chrome || '-';
    if (valNode) valNode.textContent = info.node || '-';
    if (valV8) valV8.textContent = info.v8 || '-';
    if (valUseragent) valUseragent.textContent = navigator.userAgent || '-';
  }).catch(err => {
    console.error('Failed to load browser info:', err);
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
