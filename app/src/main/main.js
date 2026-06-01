const { app, BrowserWindow, WebContentsView, ipcMain, session, shell, dialog, safeStorage, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const crypto = require('crypto');
const Store = require('./store');
const adblock = require('./adblock');

// GitHub repository configuration for updates
const GITHUB_REPO = 'OSLO-Team/oslo-browser'; // Format: 'owner/repo'
const EXPECTED_UPDATE_PUBLISHERS = ['OSLO Browser', 'oslobrowser.com', 'Emir Can Turan'];
const REQUIRE_SIGNED_UPDATES = process.env.OSLO_REQUIRE_SIGNED_UPDATES === '1';
const UPDATE_STATE_FILE = 'pending-update.json';

// Create local stores
let activeDownloads = {}; // downloadId -> { item, win, name, total }

const DEFAULT_SETTINGS = {
  searchEngine: 'duckduckgo',
  adblockEnabled: true,
  blockedCount: 0,
  httpsOnlyEnabled: false,
  httpsOnlyExceptions: '',
  customCss: '',
  customCssEnabled: true,
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
  language: 'tr',
  newtabBackgroundType: 'default',
  newtabWallpaper: '',
  newtabBackgroundColor: '#0b0c0e',
  newtabPresetWallpaper: 'aurora',
  newtabShowClock: true,
  newtabShowDate: true,
  newtabShowWeather: true,
  newtabShowSearch: true,
  newtabShowShortcuts: true,
  homeButtonEnabled: false,
  homePageUrl: '',
  bookmarksBarEnabled: false,
  historyLimit: 2000,
  telemetryEnabled: false,
  dnsOverHttpsEnabled: false,
  dnsOverHttpsProvider: 'cloudflare',
  dnsOverHttpsCustomProvider: '',
  cookiePolicy: 'block-third-party',
  clearCookiesOnExit: false,
  trackingProtectionLevel: 'balanced',
  fingerprintProtection: true,
  refererPolicy: 'cross-origin',
  webRtcIpProtection: true,
  dangerousDownloadsProtection: 'warn',
  passwordSecurityWarnings: true,
  clearHistoryOnExit: false,
  clearCacheOnExit: false,
  clearDownloadsOnExit: false,
  clearLocalStorageOnExit: false,
  incognitoForgetDownloads: true,
  incognitoBlockThirdPartyCookies: true,
  permissionNotifications: 'ask',
  permissionCamera: 'ask',
  permissionMicrophone: 'ask',
  permissionLocation: 'ask',
  permissionClipboard: 'ask',
  permissionAutoplay: 'allow',
  globalPrivacyControl: true,
  sessionRestoreEnabled: false,
  savePasswordsEnabled: true,
  autofillEnabled: true,
  sleepTabsEnabled: true,
  sleepTabsTimeout: 15,
  downloadPromptEnabled: false,
  hardwareAutoOptimized: false
};

const FACTORY_DEFAULT_SETTINGS = Object.freeze({ ...DEFAULT_SETTINGS });

function createDefaultSettings() {
  return { ...FACTORY_DEFAULT_SETTINGS };
}

const settingsStore = new Store('settings', createDefaultSettings());
const bookmarksStore = new Store('bookmarks', { bookmarks: [] });
const historyStore = new Store('history', { history: [] });
const downloadsStore = new Store('downloads', { downloads: [] });
const spacesStore = new Store('spaces', { spaces: ['Genel'] });
const telemetryStore = new Store('telemetry', { events: [], crashes: [] });
const faviconCacheStore = new Store('favicon-cache', { cache: {} });
const sessionStore = new Store('session', { tabs: [], tabOrders: {} });
const passwordsStore = new Store('passwords', { passwords: [] });
const certificateExceptionsStore = new Store('certificate-exceptions', { exceptions: {} });
const passwordBreachCacheStore = new Store('password-breach-cache', { cache: {} });
const PASSWORD_ENCODING = 'safeStorage:v1';

function isPasswordEncryptionAvailable() {
  try {
    return !!safeStorage && safeStorage.isEncryptionAvailable();
  } catch (error) {
    return false;
  }
}

function protectPassword(password) {
  const value = typeof password === 'string' ? password : '';
  if (!value) {
    return { password: '', passwordEncoding: PASSWORD_ENCODING };
  }

  if (!isPasswordEncryptionAvailable()) {
    console.warn('[PasswordManager] safeStorage is unavailable; keeping password in legacy format.');
    return { password: value, passwordEncoding: 'plain' };
  }

  return {
    password: safeStorage.encryptString(value).toString('base64'),
    passwordEncoding: PASSWORD_ENCODING
  };
}

function revealPassword(entry) {
  if (!entry || typeof entry.password !== 'string') return '';
  if (entry.passwordEncoding !== PASSWORD_ENCODING) {
    return entry.password || '';
  }

  try {
    return safeStorage.decryptString(Buffer.from(entry.password, 'base64'));
  } catch (error) {
    console.error('[PasswordManager] Failed to decrypt saved password:', error);
    return '';
  }
}

function toPublicCredential(entry) {
  return {
    ...entry,
    password: revealPassword(entry),
    passwordEncoding: undefined
  };
}

function migratePasswordsToEncryptedStorage() {
  if (!isPasswordEncryptionAvailable()) return;
  const list = passwordsStore.get('passwords') || [];
  let changed = false;
  const migrated = list.map(entry => {
    if (!entry || entry.passwordEncoding === PASSWORD_ENCODING) return entry;
    const protectedSecret = protectPassword(entry.password || '');
    changed = true;
    return {
      ...entry,
      ...protectedSecret
    };
  });

  if (changed) {
    passwordsStore.set('passwords', migrated);
  }
}

function scorePasswordStrength(password) {
  const value = String(password || '');
  let score = 0;
  if (value.length >= 12) score += 2;
  else if (value.length >= 10) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^a-zA-Z0-9]/.test(value)) score += 1;
  if (value.length >= 16) score += 1;
  if (/(.)\1{2,}/.test(value)) score -= 1;
  if (/password|qwerty|123456|admin|oslo|sifre|şifre/i.test(value)) score -= 2;
  return Math.max(0, score);
}

function isWeakPasswordValue(password) {
  return scorePasswordStrength(password) < 4;
}

async function checkPasswordBreach(password) {
  const value = String(password || '');
  if (!value) return { breached: false, count: 0, checked: false };

  const sha1 = crypto.createHash('sha1').update(value).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const cache = passwordBreachCacheStore.get('cache') || {};
  if (cache[sha1]) return cache[sha1];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await net.fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'oslo-browser-password-audit',
        'Add-Padding': 'true'
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HIBP status ${response.status}`);
    const body = await response.text();
    const match = body.split(/\r?\n/).find(line => line.startsWith(suffix));
    const count = match ? parseInt(match.split(':')[1], 10) || 0 : 0;
    const result = { breached: count > 0, count, checked: true };
    cache[sha1] = result;
    passwordBreachCacheStore.set('cache', cache);
    return result;
  } catch (error) {
    console.error('[PasswordAudit] Breach check failed:', error.message || error);
    return { breached: false, count: 0, checked: false, error: error.message || String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

// DNS-over-HTTPS Setup
const dohTemplates = {
  cloudflare: 'https://chrome.cloudflare-dns.com/dns-query',
  google: 'https://dns.google/dns-query',
  quad9: 'https://dns.quad9.net/dns-query'
};

const dnsEnabled = settingsStore.get('dnsOverHttpsEnabled') || false;
if (dnsEnabled) {
  const provider = settingsStore.get('dnsOverHttpsProvider') || 'cloudflare';
  const customTemplate = settingsStore.get('dnsOverHttpsCustomProvider') || '';
  const template = provider === 'custom' && customTemplate ? customTemplate : (dohTemplates[provider] || dohTemplates.cloudflare);
  app.commandLine.appendSwitch('enable-features', 'DnsOverHttps');
  app.commandLine.appendSwitch('dns-over-https-templates', template);
}

if (settingsStore.get('webRtcIpProtection') !== false) {
  app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
  app.commandLine.appendSwitch('webrtc-ip-handling-policy', 'disable_non_proxied_udp');
}

if (settingsStore.get('permissionAutoplay') === 'block') {
  app.commandLine.appendSwitch('autoplay-policy', 'user-gesture-required');
}

// Uncaught exceptions crash logging
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in Main Process:', error);
  if (settingsStore.get('telemetryEnabled')) {
    const crashes = telemetryStore.get('crashes') || [];
    crashes.push({
      timestamp: Date.now(),
      message: error.message || String(error),
      stack: error.stack || '',
      process: 'main'
    });
    if (crashes.length > 50) crashes.splice(0, crashes.length - 50);
    telemetryStore.set('crashes', crashes);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in Main Process:', reason);
  if (settingsStore.get('telemetryEnabled')) {
    const crashes = telemetryStore.get('crashes') || [];
    crashes.push({
      timestamp: Date.now(),
      message: reason ? (reason.message || String(reason)) : 'Unhandled Rejection',
      stack: reason ? (reason.stack || '') : '',
      process: 'main'
    });
    if (crashes.length > 50) crashes.splice(0, crashes.length - 50);
    telemetryStore.set('crashes', crashes);
  }
});

let windows = new Set();
let tabs = {}; // tabId -> { id, view, url, title, isLoading, isIncognito, space, lastActive, isSleeping }
let activeTabs = {}; // windowId -> activeTabId
let windowBounds = {}; // windowId -> bounds
let tabOrders = {}; // windowId -> [tabId, tabId, ...]
let incognitoSession = null;
const spaceSessions = new Map();
const configuredProfilePartitions = new Set();
let pendingPermissionRequests = {};
let permissionRequestId = 0;
const permissionsStore = new Store('permissions', { permissions: {} });

function getSpacePartition(spaceName) {
  const normalized = String(spaceName || 'Genel').trim() || 'Genel';
  const slug = normalized
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  const hash = crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 8);
  return `persist:oslo-space-${slug || 'genel'}-${hash}`;
}

function cleanSessionUserAgent(sessionInstance) {
  try {
    const rawUa = sessionInstance.getUserAgent();
    const cleanUa = rawUa
      .replace(/Electron\/[0-9.]+\s?/g, '')
      .replace(/oslo[- ]?browser\/[0-9a-z.-]+\s?/gi, '')
      .replace(/oslobrowser\/[0-9a-z.-]+\s?/gi, '')
      .replace(/oslo\/[0-9a-z.-]+\s?/gi, '')
      .trim();
    sessionInstance.setUserAgent(cleanUa);
  } catch (err) {
    console.error('Failed to clean User Agent:', err);
  }
}

function setupProfilePermissionHandler(sessionInstance) {
  sessionInstance.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || webContents.getURL();
    let domain = '';
    try {
      domain = new URL(requestingUrl).hostname;
    } catch (e) {
      domain = requestingUrl;
    }

    const resolvePermissionType = () => {
      if (permission === 'notifications') return 'notifications';
      if (permission === 'geolocation') return 'location';
      if (permission === 'clipboard-read') return 'clipboard';
      if (permission === 'media') {
        const types = details.mediaTypes || [];
        if (types.includes('video')) return 'camera';
        if (types.includes('audio')) return 'microphone';
        return 'camera';
      }
      return permission;
    };

    const permissionType = resolvePermissionType();
    const defaultSettingMap = {
      notifications: 'permissionNotifications',
      camera: 'permissionCamera',
      microphone: 'permissionMicrophone',
      location: 'permissionLocation',
      clipboard: 'permissionClipboard'
    };

    if (defaultSettingMap[permissionType]) {
      const saved = permissionsStore.get('permissions') || {};
      const decision = saved[`${domain}:${permissionType}`];

      if (decision !== undefined) {
        return callback(decision);
      }

      const defaultDecision = settingsStore.get(defaultSettingMap[permissionType]) || 'ask';
      if (defaultDecision === 'allow') return callback(true);
      if (defaultDecision === 'block') return callback(false);

      let win = BrowserWindow.fromWebContents(webContents);
      if (!win) {
        const tab = Object.values(tabs).find(item => item.view && item.view.webContents === webContents);
        if (tab && tab.windowId) {
          win = BrowserWindow.fromId(tab.windowId);
        }
      }
      if (win) {
        const reqId = ++permissionRequestId;
        pendingPermissionRequests[reqId] = { callback, domain, permission: permissionType };
        sendToUI(win, 'ui-permission-request', { id: reqId, domain, permission: permissionType });
      } else {
        callback(false);
      }
    } else {
      callback(true);
    }
  });
}

function configureProfileSession(sessionInstance, label, isIncognito = false) {
  const partition = sessionInstance.getPartition ? sessionInstance.getPartition() : label;
  if (configuredProfilePartitions.has(partition)) return sessionInstance;
  cleanSessionUserAgent(sessionInstance);
  adblock.setupAdBlocker(sessionInstance, label);
  setupDownloadListener(sessionInstance, isIncognito);
  setupProfilePermissionHandler(sessionInstance);
  configuredProfilePartitions.add(partition);
  return sessionInstance;
}

function getSessionForSpace(spaceName, isIncognito = false) {
  if (isIncognito) return incognitoSession || session.fromPartition('incognito');
  const partition = getSpacePartition(spaceName);
  if (!spaceSessions.has(partition)) {
    const spaceSession = session.fromPartition(partition);
    configureProfileSession(spaceSession, `space:${spaceName || 'Genel'}`, false);
    spaceSessions.set(partition, spaceSession);
  }
  return spaceSessions.get(partition);
}

function getManagedSessions(includeIncognito = false) {
  const sessions = new Set([session.defaultSession, ...spaceSessions.values()]);
  if (includeIncognito && incognitoSession) sessions.add(incognitoSession);
  return Array.from(sessions);
}

function getNetworkPrivacyOptions() {
  return {
    cookiePolicy: settingsStore.get('cookiePolicy') || 'block-third-party',
    trackingProtectionLevel: settingsStore.get('trackingProtectionLevel') || 'balanced',
    fingerprintProtection: settingsStore.get('fingerprintProtection') !== false,
    refererPolicy: settingsStore.get('refererPolicy') || 'cross-origin',
    globalPrivacyControl: settingsStore.get('globalPrivacyControl') !== false,
    incognitoBlockThirdPartyCookies: settingsStore.get('incognitoBlockThirdPartyCookies') !== false,
    httpsOnlyExceptions: settingsStore.get('httpsOnlyExceptions') || ''
  };
}

function syncNetworkPrivacyOptions() {
  adblock.setPrivacyOptions(getNetworkPrivacyOptions());
}

function getHostnameFromUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch (error) {
    return '';
  }
}

function normalizeFaviconHost(hostname) {
  return String(hostname || '').toLowerCase().replace(/^www\./, '');
}

function normalizeFaviconUrl(value) {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/';
    const port = parsed.port ? `:${parsed.port}` : '';
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${port}${parsed.pathname}`;
  } catch (error) {
    return '';
  }
}

function getGoogleDocsAppKey(value) {
  try {
    const parsed = new URL(value);
    if (parsed.hostname.toLowerCase() !== 'docs.google.com') return '';

    const app = parsed.pathname.split('/').filter(Boolean)[0] || '';
    const knownApps = new Set(['document', 'spreadsheets', 'presentation', 'forms', 'drawings']);
    return knownApps.has(app) ? `google-docs-app:${app}` : '';
  } catch (error) {
    return '';
  }
}

function getCachedFaviconForUrl(url) {
  const hostname = getHostnameFromUrl(url);
  if (!hostname) return '';

  const cache = faviconCacheStore.get('cache') || {};
  const normalizedUrl = normalizeFaviconUrl(url);
  const googleDocsAppKey = getGoogleDocsAppKey(url);
  if (normalizedUrl && cache[normalizedUrl]) return cache[normalizedUrl];
  if (googleDocsAppKey) return cache[googleDocsAppKey] || '';

  return cache[hostname] || cache[normalizeFaviconHost(hostname)] || '';
}

function cacheFaviconForUrl(url, favicon) {
  const hostname = getHostnameFromUrl(url);
  if (!hostname || !favicon) return;

  const cache = faviconCacheStore.get('cache') || {};
  const normalizedUrl = normalizeFaviconUrl(url);
  const googleDocsAppKey = getGoogleDocsAppKey(url);
  if (normalizedUrl) cache[normalizedUrl] = favicon;
  if (googleDocsAppKey) {
    cache[googleDocsAppKey] = favicon;
  } else {
    cache[hostname] = favicon;
    cache[normalizeFaviconHost(hostname)] = favicon;
  }
  faviconCacheStore.set('cache', cache);
}

function hydrateBookmarkFavicons(bookmarks) {
  let changed = false;
  const hydrated = (bookmarks || []).map(bookmark => {
    if (!bookmark || bookmark.isFolder || bookmark.favicon) return bookmark;

    const favicon = getCachedFaviconForUrl(bookmark.url);
    if (!favicon) return bookmark;

    changed = true;
    return { ...bookmark, favicon };
  });

  return { bookmarks: hydrated, changed };
}

function updateBookmarkFaviconsForUrl(url, favicon) {
  const hostname = normalizeFaviconHost(getHostnameFromUrl(url));
  if (!hostname || !favicon) return;

  const normalizedUrl = normalizeFaviconUrl(url);
  const googleDocsAppKey = getGoogleDocsAppKey(url);
  const bookmarks = bookmarksStore.get('bookmarks') || [];
  let changed = false;
  const updated = bookmarks.map(bookmark => {
    if (!bookmark || bookmark.isFolder || bookmark.favicon === favicon) return bookmark;

    const bookmarkUrl = normalizeFaviconUrl(bookmark.url);
    if (bookmarkUrl && normalizedUrl && bookmarkUrl === normalizedUrl) {
      changed = true;
      return { ...bookmark, favicon };
    }

    if (googleDocsAppKey) {
      if (getGoogleDocsAppKey(bookmark.url) !== googleDocsAppKey) return bookmark;
      changed = true;
      return { ...bookmark, favicon };
    }

    const bookmarkHost = normalizeFaviconHost(getHostnameFromUrl(bookmark.url));
    if (bookmarkHost !== hostname) return bookmark;

    changed = true;
    return { ...bookmark, favicon };
  });

  if (changed) {
    bookmarksStore.set('bookmarks', updated);
    windows.forEach(win => {
      sendToUI(win, 'ui-bookmarks-updated', updated);
    });
  }
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // frameless window for Zen-like design
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#111214'
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  windows.add(win);

  // Context Menu for main UI (editable inputs copy/paste)
  win.webContents.on('context-menu', (event, params) => {
    const { Menu, MenuItem } = require('electron');
    const menu = new Menu();
    const lang = settingsStore.get('language') || 'tr';
    const labels = {
      cut: lang === 'tr' ? 'Kes' : (lang === 'fr' ? 'Couper' : 'Cut'),
      copy: lang === 'tr' ? 'Kopyala' : (lang === 'fr' ? 'Copier' : 'Copy'),
      paste: lang === 'tr' ? 'Yapıştır' : (lang === 'fr' ? 'Coller' : 'Paste'),
      selectAll: lang === 'tr' ? 'Tümünü Seç' : (lang === 'fr' ? 'Tout sélectionner' : 'Select All')
    };

    if (params.isEditable) {
      menu.append(new MenuItem({ label: labels.cut, role: 'cut' }));
      menu.append(new MenuItem({ label: labels.copy, role: 'copy' }));
      menu.append(new MenuItem({ label: labels.paste, role: 'paste' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: labels.selectAll, role: 'selectAll' }));
      menu.popup({ window: win });
    } else if (params.selectionText && params.selectionText.trim() !== '') {
      menu.append(new MenuItem({ label: labels.copy, role: 'copy' }));
      menu.popup({ window: win });
    }
  });

  win.on('closed', () => {
    windows.delete(win);
    // Destroy all tabs belonging to this window
    Object.keys(tabs).forEach(id => {
      if (tabs[id] && tabs[id].windowId === win.id) {
        destroyTab(id);
      }
    });
    delete activeTabs[win.id];
    delete windowBounds[win.id];
  });

  return win;
}

function removeCustomCssFromView(view) {
  const wc = view?.webContents;
  if (!wc || wc.isDestroyed()) return;

  const keys = view.__osloCustomCssKeys || [];
  view.__osloCustomCssKeys = [];
  if (typeof wc.removeInsertedCSS !== 'function') return;

  keys.forEach(key => {
    if (key) {
      wc.removeInsertedCSS(key).catch(() => { });
    }
  });
}

function applyCustomCssToView(view, css) {
  const wc = view?.webContents;
  if (!wc || wc.isDestroyed()) return;

  removeCustomCssFromView(view);
  const nextCss = typeof css === 'string' ? css : '';
  if (!nextCss.trim()) return;

  wc.insertCSS(nextCss)
    .then(key => {
      if (key) view.__osloCustomCssKeys = [key];
    })
    .catch(err => console.error('Failed to inject custom CSS:', err));
}

function applyCustomCssToOpenTabs(css) {
  Object.values(tabs).forEach(tab => {
    if (tab.view && !tab.isSleeping) {
      applyCustomCssToView(tab.view, css);
    }
    if (tab.splitView && !tab.isSleeping) {
      applyCustomCssToView(tab.splitView, css);
    }
  });
}

function setupViewListeners(tab, view, isSplitSide) {
  if (!view) return;
  const wc = view.webContents;
  const tabId = tab.id;
  const getWin = () => BrowserWindow.fromId(tab.windowId);

  wc.on('did-start-loading', () => {
    const isActive = isSplitSide ? (tab.activeSplitSide === 'split') : (tab.activeSplitSide === 'main');
    if (isSplitSide) tab.isSplitLoading = true;
    else tab.isLoading = true;

    if (isActive) {
      sendToUI(getWin(), 'ui-tab-updated', { id: tabId, isLoading: true });
    }
  });

  wc.on('did-stop-loading', () => {
    const isActive = isSplitSide ? (tab.activeSplitSide === 'split') : (tab.activeSplitSide === 'main');
    if (isSplitSide) tab.isSplitLoading = false;
    else tab.isLoading = false;

    if (isActive) {
      sendToUI(getWin(), 'ui-tab-updated', { id: tabId, isLoading: false });
    }
  });

  wc.on('page-title-updated', (event, title) => {
    if (!isSplitSide) {
      tab.title = title;
      sendToUI(getWin(), 'ui-tab-updated', { id: tabId, title: title });
    }
  });

  wc.on('page-favicon-updated', (event, favicons) => {
    if (!favicons || favicons.length === 0) return;

    const favicon = favicons[0];
    const currentUrl = wc.getURL() || (isSplitSide ? tab.splitUrl : tab.url);
    cacheFaviconForUrl(currentUrl, favicon);
    updateBookmarkFaviconsForUrl(currentUrl, favicon);

    if (!isSplitSide) {
      tab.favicon = favicon;
      sendToUI(getWin(), 'ui-tab-updated', { id: tabId, favicon });
    }
  });

  wc.on('did-navigate', (event, newUrl) => {
    if (isSplitSide) {
      tab.splitUrl = newUrl;
    } else {
      tab.url = newUrl;
    }
    tab.canGoBack = wc.canGoBack();
    tab.canGoForward = wc.canGoForward();

    let newFavicon = null;
    if (!isSplitSide) {
      try {
        const domain = new URL(newUrl).hostname;
        if (domain) {
          newFavicon = getCachedFaviconForUrl(newUrl);
        }
      } catch (e) { }
      tab.favicon = newFavicon;
    }

    const isActive = isSplitSide ? (tab.activeSplitSide === 'split') : (tab.activeSplitSide === 'main');
    if (isActive) {
      sendToUI(getWin(), 'ui-tab-updated', {
        id: tabId,
        url: newUrl,
        canGoBack: tab.canGoBack,
        canGoForward: tab.canGoForward,
        favicon: isSplitSide ? undefined : newFavicon
      });
    }

    // Add to history if not incognito
    if (!tab.isIncognito && !newUrl.includes('newtab.html') && !newUrl.startsWith('file://')) {
      const historyEntry = {
        title: tab.title || newUrl,
        url: newUrl,
        timestamp: Date.now()
      };
      const history = historyStore.get('history') || [];
      const todayStr = new Date().toDateString();
      const duplicateIdx = history.findIndex(h => {
        return h.url === newUrl && new Date(h.timestamp).toDateString() === todayStr;
      });

      if (duplicateIdx !== -1) {
        history[duplicateIdx].timestamp = Date.now();
        history[duplicateIdx].title = tab.title || newUrl;
      } else {
        history.push(historyEntry);
      }

      const limit = parseInt(settingsStore.get('historyLimit'), 10) || 2000;
      if (history.length > limit) {
        history.splice(0, history.length - limit);
      }
      historyStore.set('history', history);
    }
    saveSession();
  });

  wc.on('did-navigate-in-page', (event, newUrl) => {
    if (isSplitSide) {
      tab.splitUrl = newUrl;
    } else {
      tab.url = newUrl;
    }
    tab.canGoBack = wc.canGoBack();
    tab.canGoForward = wc.canGoForward();

    const isActive = isSplitSide ? (tab.activeSplitSide === 'split') : (tab.activeSplitSide === 'main');
    if (isActive) {
      sendToUI(getWin(), 'ui-tab-updated', {
        id: tabId,
        url: newUrl,
        canGoBack: tab.canGoBack,
        canGoForward: tab.canGoForward
      });
    }
    saveSession();
  });

  wc.on('found-in-page', (event, result) => {
    sendToUI(getWin(), 'find-result', result);
  });

  wc.on('media-started-playing', () => {
    tab.isPlayingAudio = true;
    sendToUI(getWin(), 'ui-tab-updated', { id: tabId, isPlayingAudio: true });
  });

  wc.on('media-stopped-playing', () => {
    const otherView = isSplitSide ? tab.view : tab.splitView;
    const otherPlaying = otherView && otherView.webContents && otherView.webContents.isAudioActive();
    if (!otherPlaying) {
      tab.isPlayingAudio = false;
      sendToUI(getWin(), 'ui-tab-updated', { id: tabId, isPlayingAudio: false });
    }
  });

  wc.setWindowOpenHandler((details) => {
    // Block popups targeting ad or tracker domains
    if (adblock.isAdBlockEnabled() && adblock.shouldBlock(details.url, 'popup', undefined, details.referrer ? details.referrer.url : undefined)) {
      return { action: 'deny' };
    }

    const referrerUrl = details.referrer ? details.referrer.url : undefined;
    const isGoogleAuthPopup = adblock.isGoogleAuth(details.url, referrerUrl);
    if (details.features || isGoogleAuthPopup) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInSubFrames: true,
            session: wc.session,
            plugins: true
          }
        }
      };
    }
    const targetWin = getWin();
    createAndNotifyTab(details.url, tab.isIncognito, tab.space, targetWin ? targetWin.id : null);
    return { action: 'deny' };
  });

  wc.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const isControl = process.platform === 'darwin' ? input.meta : input.control;

      // Ctrl + T (New Tab)
      if (isControl && input.key.toLowerCase() === 't') {
        event.preventDefault();
        sendToUI(getWin(), 'ui-hotkey-newtab');
      }
      // Ctrl + R (Reload)
      if (isControl && input.key.toLowerCase() === 'r') {
        event.preventDefault();
        wc.reload();
      }
      // Ctrl + L (Focus Address Bar)
      if (isControl && input.key.toLowerCase() === 'l') {
        event.preventDefault();
        sendToUI(getWin(), 'ui-hotkey-focusaddress');
      }
      // Ctrl + D (Add Bookmark)
      if (isControl && input.key.toLowerCase() === 'd') {
        event.preventDefault();
        sendToUI(getWin(), 'ui-hotkey-bookmark');
      }
      // Alt + Left (Go Back)
      if (input.alt && input.key === 'ArrowLeft') {
        event.preventDefault();
        if (wc.canGoBack()) wc.goBack();
      }
      // Alt + Right (Go Forward)
      if (input.alt && input.key === 'ArrowRight') {
        event.preventDefault();
        if (wc.canGoForward()) wc.goForward();
      }
      // Ctrl + W (Close Active Tab)
      if (isControl && input.key.toLowerCase() === 'w') {
        event.preventDefault();
        sendToUI(getWin(), 'ui-hotkey-closetab');
      }
      // Ctrl + N (New Window)
      if (isControl && input.key.toLowerCase() === 'n' && !input.shift) {
        event.preventDefault();
        createMainWindow();
      }
      // Ctrl + Shift + P or N (New Incognito Tab)
      if (isControl && input.shift && (input.key.toLowerCase() === 'p' || input.key.toLowerCase() === 'n')) {
        event.preventDefault();
        sendToUI(getWin(), 'ui-hotkey-incognitotab');
      }
      // Ctrl + Tab (Next Tab)
      if (isControl && input.key === 'Tab' && !input.shift) {
        event.preventDefault();
        sendToUI(getWin(), 'ui-hotkey-nexttab');
      }
      // Ctrl + Shift + Tab (Prev Tab)
      if (isControl && input.key === 'Tab' && input.shift) {
        event.preventDefault();
        sendToUI(getWin(), 'ui-hotkey-prevtab');
      }
      // Ctrl + B (Toggle Bookmarks Panel)
      if (isControl && input.key.toLowerCase() === 'b') {
        event.preventDefault();
        sendToUI(getWin(), 'ui-hotkey-togglebookmarks');
      }
      // Ctrl + H (Toggle History Panel)
      if (isControl && input.key.toLowerCase() === 'h') {
        event.preventDefault();
        sendToUI(getWin(), 'ui-hotkey-togglehistory');
      }
      // Ctrl + F (Find in Page)
      if (isControl && input.key.toLowerCase() === 'f') {
        event.preventDefault();
        sendToUI(getWin(), 'ui-hotkey-findinpage');
      }
      // Ctrl + P (Print)
      if (isControl && input.key.toLowerCase() === 'p') {
        event.preventDefault();
        wc.print();
      }
      // Ctrl + = or Ctrl + + (Zoom In)
      if (isControl && (input.key === '=' || input.key === '+')) {
        event.preventDefault();
        const currentZoom = wc.getZoomFactor();
        const nextZoom = currentZoom + 0.1;
        if (nextZoom <= 3.0) {
          wc.setZoomFactor(nextZoom);
          tab.zoomFactor = nextZoom;
          sendToUI(getWin(), 'ui-zoom-changed', { tabId, zoom: nextZoom });
          saveSession();
        }
      }
      // Ctrl + - (Zoom Out)
      if (isControl && input.key === '-') {
        event.preventDefault();
        const currentZoom = wc.getZoomFactor();
        const nextZoom = currentZoom - 0.1;
        if (nextZoom >= 0.3) {
          wc.setZoomFactor(nextZoom);
          tab.zoomFactor = nextZoom;
          sendToUI(getWin(), 'ui-zoom-changed', { tabId, zoom: nextZoom });
          saveSession();
        }
      }
      // Ctrl + 0 (Reset Zoom)
      if (isControl && input.key === '0') {
        event.preventDefault();
        wc.setZoomFactor(1.0);
        tab.zoomFactor = 1.0;
        sendToUI(getWin(), 'ui-zoom-changed', { tabId, zoom: 1.0 });
        saveSession();
      }
    }
  });

  // Custom CSS injection
  wc.on('did-finish-load', () => {
    const customCss = settingsStore.get('customCss');
    if (settingsStore.get('customCssEnabled') !== false && customCss) {
      applyCustomCssToView(view, customCss);
    } else {
      removeCustomCssFromView(view);
    }
  });

  // Native Context Menu inside pages
  wc.on('context-menu', (event, params) => {
    const { Menu, MenuItem } = require('electron');
    const menu = new Menu();
    const lang = settingsStore.get('language') || 'tr';
    const labels = {
      back: lang === 'tr' ? 'Geri' : (lang === 'fr' ? 'Retour' : 'Back'),
      forward: lang === 'tr' ? 'İleri' : (lang === 'fr' ? 'Suivant' : 'Forward'),
      reload: lang === 'tr' ? 'Yeniden Yükle' : (lang === 'fr' ? 'Recharger' : 'Reload'),
      cut: lang === 'tr' ? 'Kes' : (lang === 'fr' ? 'Couper' : 'Cut'),
      copy: lang === 'tr' ? 'Kopyala' : (lang === 'fr' ? 'Copier' : 'Copy'),
      paste: lang === 'tr' ? 'Yapıştır' : (lang === 'fr' ? 'Coller' : 'Paste'),
      selectAll: lang === 'tr' ? 'Tümünü Seç' : (lang === 'fr' ? 'Tout sélectionner' : 'Select All'),
      openLinkNewTab: lang === 'tr' ? 'Bağlantıyı Yeni Sekmede Aç' : (lang === 'fr' ? 'Ouvrir le lien dans un nouvel onglet' : 'Open Link in New Tab'),
      openLinkNewIncognitoTab: lang === 'tr' ? 'Bağlantıyı Yeni Gizli Sekmede Aç' : (lang === 'fr' ? 'Ouvrir le lien dans un nouvel onglet privé' : 'Open Link in New Incognito Tab')
    };

    if (params.linkURL) {
      menu.append(new MenuItem({
        label: labels.openLinkNewTab,
        click: () => {
          const targetWin = getWin();
          createAndNotifyTab(params.linkURL, false, tab.space, targetWin ? targetWin.id : null);
        }
      }));
      menu.append(new MenuItem({
        label: labels.openLinkNewIncognitoTab,
        click: () => {
          const targetWin = getWin();
          createAndNotifyTab(params.linkURL, true, tab.space, targetWin ? targetWin.id : null);
        }
      }));
      menu.append(new MenuItem({ type: 'separator' }));
    }

    if (params.isEditable) {
      menu.append(new MenuItem({ label: labels.cut, role: 'cut' }));
      menu.append(new MenuItem({ label: labels.copy, role: 'copy' }));
      menu.append(new MenuItem({ label: labels.paste, role: 'paste' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: labels.selectAll, role: 'selectAll' }));
    } else if (params.selectionText && params.selectionText.trim() !== '') {
      menu.append(new MenuItem({ label: labels.copy, role: 'copy' }));
    } else {
      menu.append(new MenuItem({ label: labels.back, enabled: wc.canGoBack(), click: () => wc.goBack() }));
      menu.append(new MenuItem({ label: labels.forward, enabled: wc.canGoForward(), click: () => wc.goForward() }));
      menu.append(new MenuItem({ label: labels.reload, click: () => wc.reload() }));
    }
    menu.popup({ window: getWin() });
  });

  wc.on('close', (e) => {
    e.preventDefault();
    closeTab(tabId);
  });
}

function setupTabListeners(tab) {
  if (tab.view) {
    setupViewListeners(tab, tab.view, false);
  }
}

// Helpers for Tab management
function createTab(url, isIncognito = false, space = 'Genel', winId = null, tabId = null, isPinned = false, zoomFactor = null) {
  const finalTabId = tabId || ('tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
  const defaultZoom = parseFloat(settingsStore.get('defaultPageZoom')) || 1.0;
  const initialZoom = typeof zoomFactor === 'number' ? zoomFactor : defaultZoom;

  const viewSession = getSessionForSpace(space, isIncognito);

  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: true,
      session: viewSession,
      plugins: true
    }
  });

  const lang = settingsStore.get('language') || 'tr';
  const defaultTitle = lang === 'tr' ? 'Yeni Sekme' : (lang === 'fr' ? 'Nouvel Onglet' : 'New Tab');

  const tab = {
    id: finalTabId,
    view: view,
    splitView: null,
    splitUrl: '',
    activeSplitSide: 'main',
    url: url || '',
    title: defaultTitle,
    isLoading: false,
    isIncognito: isIncognito,
    space: space,
    windowId: winId,
    lastActive: Date.now(),
    isSleeping: false,
    isPinned: isPinned,
    zoomFactor: initialZoom
  };

  tabs[finalTabId] = tab;

  if (initialZoom !== 1.0) {
    view.webContents.setZoomFactor(initialZoom);
  }

  if (winId) {
    if (!tabOrders[winId]) tabOrders[winId] = [];
    if (!tabOrders[winId].includes(finalTabId)) {
      tabOrders[winId].push(finalTabId);
    }
  }

  // Precheck favicon cache
  if (url) {
    tab.favicon = getCachedFaviconForUrl(url) || tab.favicon;
  }

  setupTabListeners(tab);

  // Load the initial URL or local newtab.html
  if (url) {
    view.webContents.loadURL(formatUrl(url));
  } else {
    view.webContents.loadFile(path.join(__dirname, '../newtab/newtab.html'));
  }

  return tab;
}

function createAndNotifyTab(url, isIncognito = false, space = 'Genel', winId = null, tabId = null, isPinned = false, zoomFactor = null) {
  const tab = createTab(url, isIncognito, space, winId, tabId, isPinned, zoomFactor);
  const win = winId ? BrowserWindow.fromId(winId) : null;
  if (win) {
    sendToUI(win, 'ui-tab-created', {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      isLoading: tab.isLoading,
      isIncognito: tab.isIncognito,
      space: tab.space,
      isPinned: tab.isPinned,
      zoomFactor: tab.zoomFactor,
      favicon: tab.favicon || null
    });

    if (tab.view && tab.zoomFactor !== 1.0) {
      tab.view.webContents.setZoomFactor(tab.zoomFactor);
    }

    selectTab(tab.id);
  }
  saveSession();
  return tab;
}

function destroyTab(tabId) {
  const tab = tabs[tabId];
  if (!tab) return;

  // Remove from tabs map first to prevent re-entry / infinite loops
  delete tabs[tabId];

  const win = BrowserWindow.fromId(tab.windowId);
  if (tab.view) {
    try {
      if (win && win.contentView.children.includes(tab.view)) {
        win.contentView.removeChildView(tab.view);
      }
    } catch (e) {
      console.error('Error removing child view:', e);
    }
    // Clean up webContents
    try {
      if (!tab.view.webContents.isDestroyed()) {
        tab.view.webContents.close();
      }
    } catch (e) {
      console.error('Error closing webContents:', e);
    }
  }

  if (tab.splitView) {
    try {
      if (win && win.contentView.children.includes(tab.splitView)) {
        win.contentView.removeChildView(tab.splitView);
      }
    } catch (e) {
      console.error('Error removing split view:', e);
    }
    try {
      if (!tab.splitView.webContents.isDestroyed()) {
        tab.splitView.webContents.close();
      }
    } catch (e) {
      console.error('Error closing split webContents:', e);
    }
  }

  if (tab.windowId && tabOrders[tab.windowId]) {
    tabOrders[tab.windowId] = tabOrders[tab.windowId].filter(id => id !== tabId);
  }
}

function closeTab(tabId) {
  const tab = tabs[tabId];
  if (!tab) return;
  const win = BrowserWindow.fromId(tab.windowId);
  if (!win) return;

  const wasActive = (activeTabs[win.id] === tabId);
  const closedTabSpace = tab.space || 'Genel';

  destroyTab(tabId);
  sendToUI(win, 'ui-tab-closed', tabId);

  // If active tab was closed, select another tab if possible
  if (wasActive) {
    let windowOrder = tabOrders[win.id] || [];
    let tabIds = windowOrder.filter(id => tabs[id] && tabs[id].space === closedTabSpace);
    if (tabIds.length === 0) {
      tabIds = Object.keys(tabs).filter(id => tabs[id].windowId === win.id && tabs[id].space === closedTabSpace);
    }

    if (tabIds.length > 0) {
      selectTab(tabIds[tabIds.length - 1]);
    } else {
      let remainingAll = windowOrder.filter(id => tabs[id]);
      if (remainingAll.length === 0) {
        remainingAll = Object.keys(tabs).filter(id => tabs[id].windowId === win.id);
      }

      if (remainingAll.length > 0) {
        selectTab(remainingAll[remainingAll.length - 1]);
      } else {
        activeTabs[win.id] = null;
        const newTab = createAndNotifyTab(null, false, closedTabSpace, win.id);
        selectTab(newTab.id);
      }
    }
  }
  saveSession();
}

async function sleepTab(tabId) {
  const tab = tabs[tabId];
  if (!tab || tab.isSleeping) return;

  tab.isSleeping = true;
  tab.scrollX = 0;
  tab.scrollY = 0;

  const win = BrowserWindow.fromId(tab.windowId);
  if (tab.view) {
    try {
      const scroll = await tab.view.webContents.executeJavaScript('({ x: window.scrollX, y: window.scrollY })');
      tab.scrollX = scroll.x || 0;
      tab.scrollY = scroll.y || 0;
    } catch (e) {
      // Ignore
    }

    if (win && win.contentView.children.includes(tab.view)) {
      win.contentView.removeChildView(tab.view);
    }
    tab.view.webContents.close();
    tab.view = null;
  }

  sendToUI(win, 'ui-tab-updated', { id: tabId, isSleeping: true });
}

function wakeTab(tabId) {
  const tab = tabs[tabId];
  if (!tab || !tab.isSleeping) return;

  const viewSession = getSessionForSpace(tab.space, tab.isIncognito);

  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: true,
      session: viewSession,
      plugins: true
    }
  });

  tab.view = view;
  tab.isSleeping = false;
  tab.lastActive = Date.now();

  setupTabListeners(tab);

  if (tab.url) {
    view.webContents.loadURL(formatUrl(tab.url));
  } else {
    view.webContents.loadFile(path.join(__dirname, '../newtab/newtab.html'));
  }

  const win = BrowserWindow.fromId(tab.windowId);

  // Restore scroll positions after finish-load
  view.webContents.once('did-finish-load', () => {
    if (tab.scrollX > 0 || tab.scrollY > 0) {
      const x = tab.scrollX;
      const y = tab.scrollY;
      setTimeout(() => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`window.scrollTo(${x}, ${y})`).catch(() => { });
        }
      }, 100);
    }
  });

  sendToUI(win, 'ui-tab-updated', { id: tabId, isSleeping: false });
}

function selectTab(tabId) {
  const tab = tabs[tabId];
  if (!tab) return;

  const win = BrowserWindow.fromId(tab.windowId) || [...windows][0];
  if (!win) return;

  // Wake up if sleeping
  if (tab.isSleeping) {
    wakeTab(tabId);
  }

  // Update last active
  tab.lastActive = Date.now();

  const prevActiveTabId = activeTabs[win.id];

  // Remove previous active views of THIS window from win.contentView
  if (prevActiveTabId && tabs[prevActiveTabId]) {
    const prevTab = tabs[prevActiveTabId];
    if (prevTab.view && win.contentView.children.includes(prevTab.view)) {
      win.contentView.removeChildView(prevTab.view);
    }
    if (prevTab.splitView && win.contentView.children.includes(prevTab.splitView)) {
      win.contentView.removeChildView(prevTab.splitView);
    }
  }

  activeTabs[win.id] = tabId;

  const bounds = windowBounds[win.id] || { x: 0, y: 0, width: 0, height: 0 };

  if (bounds.width > 0 && bounds.height > 0) {
    if (tab.view) {
      if (!win.contentView.children.includes(tab.view)) {
        win.contentView.addChildView(tab.view);
      }
      if (tab.splitView) {
        tab.view.setBounds({
          x: bounds.x,
          y: bounds.y,
          width: Math.floor(bounds.width / 2),
          height: bounds.height
        });
      } else {
        tab.view.setBounds(bounds);
      }
    }
    if (tab.splitView) {
      if (!win.contentView.children.includes(tab.splitView)) {
        win.contentView.addChildView(tab.splitView);
      }
      tab.splitView.setBounds({
        x: bounds.x + Math.floor(bounds.width / 2),
        y: bounds.y,
        width: Math.ceil(bounds.width / 2),
        height: bounds.height
      });
    }
  }

  // Focus the active web contents
  const activeWc = (tab.activeSplitSide === 'split' && tab.splitView) ? tab.splitView.webContents : (tab.view ? tab.view.webContents : null);
  if (activeWc) {
    activeWc.focus();
    tab.canGoBack = activeWc.canGoBack();
    tab.canGoForward = activeWc.canGoForward();
  }

  sendToUI(win, 'ui-tab-updated', {
    id: tabId,
    url: (tab.activeSplitSide === 'split' && tab.splitView) ? tab.splitUrl : tab.url,
    canGoBack: tab.canGoBack || false,
    canGoForward: tab.canGoForward || false,
    hasSplit: !!tab.splitView,
    activeSplitSide: tab.activeSplitSide
  });

  sendToUI(win, 'ui-tab-selected', tabId);
}

function formatUrl(val) {
  let url = val.trim();
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
    return url;
  }

  // Check if it looks like a domain name
  const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/\S*)?$/;
  if (domainPattern.test(url)) {
    return 'https://' + url;
  }

  // Default search query
  const engine = settingsStore.get('searchEngine') || 'duckduckgo';
  const searchEngines = {
    google: 'https://www.google.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    bing: 'https://www.bing.com/search?q=',
    yahoo: 'https://search.yahoo.com/search?p=',
    yandex: 'https://yandex.com/search/?text=',
    brave: 'https://search.brave.com/search?q=',
    ecosia: 'https://www.ecosia.org/search?q=',
    startpage: 'https://www.startpage.com/do/dsearch?query='
  };
  const searchUrl = searchEngines[engine] || searchEngines.duckduckgo;
  return searchUrl + encodeURIComponent(url);
}

function sendToUI(win, channel, data) {
  if (win && win.webContents) {
    win.webContents.send(channel, data);
  } else {
    windows.forEach(w => {
      if (w.webContents) {
        w.webContents.send(channel, data);
      }
    });
  }
}

function isMainUiSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  return !!(win && windows.has(win) && win.webContents === event.sender);
}

function getSenderTab(event) {
  return Object.values(tabs).find(tab =>
    (tab.view && tab.view.webContents === event.sender) ||
    (tab.splitView && tab.splitView.webContents === event.sender)
  ) || null;
}

function isKnownTabSender(event) {
  return !!getSenderTab(event);
}

function getSenderWebOrigin(event) {
  try {
    const url = event.sender.getURL();
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch (error) { }
  return '';
}

function assertMainUiSender(event) {
  if (!isMainUiSender(event)) {
    throw new Error('Unauthorized IPC sender');
  }
  return BrowserWindow.fromWebContents(event.sender);
}

function ignoreUntrustedMainUiSender(event, channel) {
  if (isMainUiSender(event)) return false;
  console.warn(`[IPC] Blocked ${channel} from untrusted sender:`, event.senderFrame?.url || event.sender.getURL());
  return true;
}

function assertKnownTabSender(event) {
  const tab = getSenderTab(event);
  if (!tab) {
    throw new Error('Unauthorized tab IPC sender');
  }
  return tab;
}

function isLocalNewTabSender(event) {
  if (!isKnownTabSender(event)) return false;
  try {
    const url = event.sender.getURL().replace(/\\/g, '/').toLowerCase();
    return url.startsWith('file:') && url.endsWith('/newtab/newtab.html');
  } catch (error) {
    return false;
  }
}

function assertSettingsReadSender(event) {
  if (isMainUiSender(event) || isLocalNewTabSender(event)) return;
  throw new Error('Unauthorized settings IPC sender');
}

function isKnownSettingKey(key) {
  return Object.prototype.hasOwnProperty.call(FACTORY_DEFAULT_SETTINGS, key);
}

function isValidSettingValue(key, value) {
  if (!isKnownSettingKey(key)) return false;

  const defaultValue = FACTORY_DEFAULT_SETTINGS[key];
  if (typeof defaultValue === 'boolean') return typeof value === 'boolean';
  if (typeof defaultValue === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (typeof defaultValue === 'string') return typeof value === 'string';
  return typeof value === typeof defaultValue;
}

function saveSession() {
  if (!settingsStore.get('sessionRestoreEnabled')) {
    sessionStore.set('tabs', []);
    sessionStore.set('tabOrders', {});
    return;
  }
  const sessionTabs = Object.values(tabs).map(tab => {
    let url = tab.url;
    if (tab.view && !tab.isSleeping && tab.view.webContents) {
      try {
        url = tab.view.webContents.getURL();
      } catch (e) { }
    }
    return {
      id: tab.id,
      url: url,
      space: tab.space,
      isPinned: !!tab.isPinned,
      title: tab.title,
      lastActive: tab.lastActive,
      isSleeping: !!tab.isSleeping,
      windowId: tab.windowId,
      zoomFactor: tab.zoomFactor || 1.0
    };
  });
  sessionStore.set('tabs', sessionTabs);
  sessionStore.set('tabOrders', tabOrders);
}

// Download manager handler
function setupDownloadListener(sessionInstance, isIncognito = false) {
  sessionInstance.on('will-download', (event, item, webContents) => {
    const fs = require('fs');
    const rawFileName = item.getFilename() || 'download';
    const fileName = rawFileName.replace(/[\\/:*?"<>|]/g, '_');
    const totalBytes = item.getTotalBytes();
    const downloadId = Date.now();
    const dangerousExtensions = new Set(['exe', 'msi', 'bat', 'cmd', 'ps1', 'vbs', 'js', 'jar', 'scr', 'com', 'reg']);
    const fileExtension = path.extname(fileName).replace('.', '').toLowerCase();
    const dangerousMode = settingsStore.get('dangerousDownloadsProtection') || 'warn';

    let win = null;
    try {
      win = BrowserWindow.fromWebContents(webContents);
      const tab = Object.values(tabs).find(t => t.view && t.view.webContents === webContents);
      if (tab && tab.windowId) {
        win = win || BrowserWindow.fromId(tab.windowId);
      }
    } catch (e) {
      console.error('[Download Manager] Error finding window for webContents:', e);
    }

    const safeWin = (win && !win.isDestroyed()) ? win : null;

    if (dangerousExtensions.has(fileExtension) && dangerousMode === 'block') {
      event.preventDefault();
      sendToUI(safeWin, 'download-progress', {
        id: downloadId,
        name: fileName,
        status: 'cancelled',
        progress: 0,
        received: 0,
        total: totalBytes
      });
      return;
    }

    const lang = settingsStore.get('language') || 'tr';
    const title = lang === 'tr' ? 'Farklı Kaydet' : (lang === 'fr' ? 'Enregistrer sous' : 'Save As');

    const downloadsDir = app.getPath('downloads');
    if (!fs.existsSync(downloadsDir)) {
      try {
        fs.mkdirSync(downloadsDir, { recursive: true });
      } catch (err) {
        console.error('[Download Manager] Failed to create downloads directory:', err);
      }
    }
    const defaultPath = path.join(downloadsDir, fileName);

    const promptUser = settingsStore.get('downloadPromptEnabled') === true;
    if (promptUser) {
      item.setSaveDialogOptions({
        title: title,
        defaultPath: defaultPath
      });
    } else {
      item.setSavePath(defaultPath);
    }

    activeDownloads[downloadId] = {
      item,
      win: safeWin,
      name: fileName,
      total: totalBytes
    };

    if (dangerousExtensions.has(fileExtension) && dangerousMode === 'warn') {
      const lang = settingsStore.get('language') || 'tr';
      const titleWarn = lang === 'tr' ? 'Güvenli İndirme Uyarısı' : (lang === 'fr' ? 'Avertissement de téléchargement' : 'Download Safety Warning');
      const messageWarn = lang === 'tr'
        ? `"${fileName}" riskli bir dosya türü olabilir. İndirmeye devam edilsin mi?`
        : (lang === 'fr'
          ? `"${fileName}" peut être un type de fichier risqué. Continuer le téléchargement ?`
          : `"${fileName}" may be a risky file type. Continue downloading?`);
      const warningOptions = {
        type: 'warning',
        buttons: lang === 'tr' ? ['Devam Et', 'İptal'] : (lang === 'fr' ? ['Continuer', 'Annuler'] : ['Continue', 'Cancel']),
        defaultId: 1,
        cancelId: 1,
        title: titleWarn,
        message: messageWarn
      };
      item.pause();
      const warningDialog = safeWin ? dialog.showMessageBox(safeWin, warningOptions) : dialog.showMessageBox(warningOptions);
      warningDialog.then(({ response }) => {
        if (response === 0 && !item.isDestroyed?.()) {
          item.resume();
        } else {
          item.cancel();
        }
      }).catch(() => item.cancel());
    }

    // Immediately broadcast initial progress state to the UI
    sendToUI(safeWin, 'download-progress', {
      id: downloadId,
      name: fileName,
      status: 'progressing',
      progress: 0,
      received: 0,
      total: totalBytes
    });

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        sendToUI(safeWin, 'download-progress', {
          id: downloadId,
          name: fileName,
          status: 'interrupted',
          progress: 0
        });
      } else if (state === 'progressing') {
        const progress = totalBytes > 0 ? Math.round((item.getReceivedBytes() / totalBytes) * 100) : 0;
        sendToUI(safeWin, 'download-progress', {
          id: downloadId,
          name: fileName,
          status: item.isPaused() ? 'paused' : 'progressing',
          progress: progress,
          received: item.getReceivedBytes(),
          total: totalBytes
        });
      }
    });

    item.once('done', (event, state) => {
      delete activeDownloads[downloadId];
      const dlEntry = {
        id: downloadId,
        name: fileName,
        status: state === 'completed' ? 'completed' : (state === 'cancelled' ? 'cancelled' : 'failed'),
        progress: state === 'completed' ? 100 : 0,
        path: state === 'completed' ? item.getSavePath() : '',
        received: item.getReceivedBytes(),
        total: totalBytes,
        timestamp: Date.now()
      };
      if (!(isIncognito && settingsStore.get('incognitoForgetDownloads') !== false)) {
        downloadsStore.push('downloads', dlEntry);
      }
      sendToUI(safeWin, 'download-progress', dlEntry);
    });
  });
}

// IPC Listeners
ipcMain.on('tab-create', (event, data) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-create')) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  const winId = win ? win.id : null;
  const url = typeof data === 'string' ? data : (data ? data.url : null);
  const isIncognito = data && typeof data === 'object' ? !!data.isIncognito : false;
  const space = data && typeof data === 'object' ? data.space || 'Genel' : 'Genel';
  const tabId = data && typeof data === 'object' ? data.id || null : null;
  const isPinned = data && typeof data === 'object' ? !!data.isPinned : false;
  const zoomFactor = data && typeof data === 'object' && typeof data.zoomFactor === 'number' ? data.zoomFactor : null;

  createAndNotifyTab(url, isIncognito, space, winId, tabId, isPinned, zoomFactor);
});

ipcMain.on('tab-sleep', (event, tabId) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-sleep')) return;
  const tab = tabs[tabId];
  if (tab) {
    const win = BrowserWindow.fromId(tab.windowId);
    if (win && tabId !== activeTabs[win.id]) {
      sleepTab(tabId);
    }
  }
});

ipcMain.on('tabs-reorder', (event, tabIds) => {
  if (ignoreUntrustedMainUiSender(event, 'tabs-reorder')) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && Array.isArray(tabIds)) {
    tabOrders[win.id] = tabIds;
    saveSession();
  }
});

ipcMain.on('tab-close', (event, tabId) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-close')) return;
  closeTab(tabId);
});

ipcMain.on('tab-select', (event, tabId) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-select')) return;
  selectTab(tabId);
});

ipcMain.on('tab-navigate', (event, { tabId, url }) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-navigate')) return;
  const tab = tabs[tabId];
  if (tab) {
    if (tab.isSleeping) {
      wakeTab(tabId);
    }
    const targetUrl = (url || '').trim();
    const isSplit = tab.activeSplitSide === 'split' && tab.splitView;
    const targetView = isSplit ? tab.splitView : tab.view;
    if (isSplit) {
      tab.splitUrl = targetUrl;
    } else {
      tab.url = targetUrl;
    }
    if (targetUrl === 'oslo://newtab' || targetUrl === '') {
      targetView.webContents.loadFile(path.join(__dirname, '../newtab/newtab.html'));
    } else {
      targetView.webContents.loadURL(formatUrl(targetUrl));
    }
  }
});

ipcMain.on('tab-back', (event, tabId) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-back')) return;
  const tab = tabs[tabId];
  if (tab) {
    const isSplit = tab.activeSplitSide === 'split' && tab.splitView;
    const targetView = isSplit ? tab.splitView : tab.view;
    if (targetView && targetView.webContents.canGoBack()) {
      targetView.webContents.goBack();
    }
  }
});

ipcMain.on('tab-forward', (event, tabId) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-forward')) return;
  const tab = tabs[tabId];
  if (tab) {
    const isSplit = tab.activeSplitSide === 'split' && tab.splitView;
    const targetView = isSplit ? tab.splitView : tab.view;
    if (targetView && targetView.webContents.canGoForward()) {
      targetView.webContents.goForward();
    }
  }
});

ipcMain.on('tab-reload', (event, tabId) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-reload')) return;
  const tab = tabs[tabId];
  if (tab) {
    const isSplit = tab.activeSplitSide === 'split' && tab.splitView;
    const targetView = isSplit ? tab.splitView : tab.view;
    if (targetView) {
      targetView.webContents.reload();
    }
  }
});

ipcMain.on('tab-update-space', (event, { tabId, space }) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-update-space')) return;
  const tab = tabs[tabId];
  if (tab) {
    const previousSpace = tab.space;
    tab.space = space;
    const win = BrowserWindow.fromId(tab.windowId);
    if (!tab.isIncognito && previousSpace !== space && tab.view && !tab.isSleeping) {
      const currentUrl = tab.view.webContents.getURL() || tab.url;
      const oldView = tab.view;
      if (win && win.contentView.children.includes(oldView)) {
        win.contentView.removeChildView(oldView);
      }
      oldView.webContents.close();

      const view = new WebContentsView({
        webPreferences: {
          preload: path.join(__dirname, '../preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          nodeIntegrationInSubFrames: true,
          session: getSessionForSpace(space, false),
          plugins: true
        }
      });

      tab.view = view;
      setupTabListeners(tab);
      view.webContents.setZoomFactor(tab.zoomFactor || parseFloat(settingsStore.get('defaultPageZoom')) || 1.0);

      if (currentUrl && !currentUrl.includes('newtab.html')) {
        view.webContents.loadURL(formatUrl(currentUrl));
      } else {
        view.webContents.loadFile(path.join(__dirname, '../newtab/newtab.html'));
      }

      if (win && activeTabs[win.id] === tabId && windowBounds[win.id] && windowBounds[win.id].width > 0) {
        win.contentView.addChildView(view);
        view.setBounds(windowBounds[win.id]);
      }
    }
    sendToUI(win, 'ui-tab-updated', { id: tabId, space: space });
    saveSession();
  }
});

ipcMain.on('tab-set-zoom', (event, { tabId, zoom }) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-set-zoom')) return;
  const tab = tabs[tabId];
  if (tab) {
    tab.zoomFactor = zoom;
    const isSplit = tab.activeSplitSide === 'split' && tab.splitView;
    const targetView = isSplit ? tab.splitView : tab.view;
    if (targetView && !tab.isSleeping && targetView.webContents) {
      targetView.webContents.setZoomFactor(zoom);
    }
    const win = BrowserWindow.fromId(tab.windowId);
    sendToUI(win, 'ui-zoom-changed', { tabId, zoom });
    saveSession();
  }
});

// Update WebContentsView position and size based on Renderer UI container
ipcMain.on('tab-bounds', (event, bounds) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-bounds')) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  windowBounds[win.id] = {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height)
  };

  const activeId = activeTabs[win.id];
  if (activeId && tabs[activeId]) {
    const tab = tabs[activeId];
    if (windowBounds[win.id].width === 0 && windowBounds[win.id].height === 0) {
      if (tab.view && win.contentView.children.includes(tab.view)) {
        win.contentView.removeChildView(tab.view);
      }
      if (tab.splitView && win.contentView.children.includes(tab.splitView)) {
        win.contentView.removeChildView(tab.splitView);
      }
    } else {
      if (tab.view) {
        if (!win.contentView.children.includes(tab.view)) {
          win.contentView.addChildView(tab.view);
        }
        if (tab.splitView) {
          tab.view.setBounds({
            x: windowBounds[win.id].x,
            y: windowBounds[win.id].y,
            width: Math.floor(windowBounds[win.id].width / 2),
            height: windowBounds[win.id].height
          });
        } else {
          tab.view.setBounds(windowBounds[win.id]);
        }
      }
      if (tab.splitView) {
        if (!win.contentView.children.includes(tab.splitView)) {
          win.contentView.addChildView(tab.splitView);
        }
        tab.splitView.setBounds({
          x: windowBounds[win.id].x + Math.floor(windowBounds[win.id].width / 2),
          y: windowBounds[win.id].y,
          width: Math.ceil(windowBounds[win.id].width / 2),
          height: windowBounds[win.id].height
        });
      }
    }
  }
});

ipcMain.on('tab-toggle-split', (event, tabId) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-toggle-split')) return;
  const tab = tabs[tabId];
  if (!tab) return;

  const win = BrowserWindow.fromId(tab.windowId);

  if (tab.splitView) {
    const splitUrl = tab.splitUrl;
    const isRealUrl = splitUrl && !splitUrl.includes('newtab.html') && splitUrl !== 'oslo://newtab';

    // Turn split screen OFF
    if (win && win.contentView.children.includes(tab.splitView)) {
      win.contentView.removeChildView(tab.splitView);
    }
    try {
      if (!tab.splitView.webContents.isDestroyed()) {
        tab.splitView.webContents.close();
      }
    } catch (e) {
      console.error('[Split Screen] Error closing split webContents:', e);
    }
    tab.splitView = null;
    tab.splitUrl = '';
    tab.activeSplitSide = 'main';

    if (win && activeTabs[win.id] === tab.id && windowBounds[win.id]) {
      tab.view.setBounds(windowBounds[win.id]);
    }

    if (tab.view && tab.view.webContents) {
      tab.view.webContents.focus();
    }

    sendToUI(win, 'ui-tab-updated', {
      id: tab.id,
      url: tab.url,
      canGoBack: tab.view ? tab.view.webContents.canGoBack() : false,
      canGoForward: tab.view ? tab.view.webContents.canGoForward() : false,
      hasSplit: false
    });
    sendToUI(win, 'ui-split-side-focused', { tabId: tab.id, side: 'main' });

    // Spawn a new tab in the background for the split view site!
    if (isRealUrl && win) {
      const newTab = createTab(splitUrl, tab.isIncognito, tab.space, win.id);
      sendToUI(win, 'ui-tab-created', {
        id: newTab.id,
        url: newTab.url,
        title: newTab.title,
        isLoading: newTab.isLoading,
        isIncognito: newTab.isIncognito,
        space: newTab.space,
        isPinned: newTab.isPinned,
        zoomFactor: newTab.zoomFactor,
        favicon: newTab.favicon || null
      });

      // Force UI back to the current tab, since ui-tab-created sets activeTabId in the renderer
      sendToUI(win, 'ui-tab-selected', tab.id);

      saveSession();
    }
  } else {
    // Turn split screen ON
    const viewSession = getSessionForSpace(tab.space, tab.isIncognito);
    const splitView = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, '../preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInSubFrames: true,
        session: viewSession,
        plugins: true
      }
    });

    tab.splitView = splitView;
    tab.splitUrl = 'oslo://newtab';
    tab.activeSplitSide = 'split';

    setupViewListeners(tab, splitView, true);

    splitView.webContents.loadFile(path.join(__dirname, '../newtab/newtab.html'));

    const defaultZoom = parseFloat(settingsStore.get('defaultPageZoom')) || 1.0;
    splitView.webContents.setZoomFactor(tab.zoomFactor || defaultZoom);

    if (win && activeTabs[win.id] === tab.id && windowBounds[win.id]) {
      const bounds = windowBounds[win.id];
      tab.view.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: Math.floor(bounds.width / 2),
        height: bounds.height
      });
      win.contentView.addChildView(splitView);
      splitView.setBounds({
        x: bounds.x + Math.floor(bounds.width / 2),
        y: bounds.y,
        width: Math.ceil(bounds.width / 2),
        height: bounds.height
      });
    }

    splitView.webContents.focus();

    sendToUI(win, 'ui-tab-updated', {
      id: tab.id,
      url: tab.splitUrl,
      canGoBack: false,
      canGoForward: false,
      hasSplit: true
    });
    sendToUI(win, 'ui-split-side-focused', { tabId: tab.id, side: 'split' });
  }
});

ipcMain.on('tab-view-focus', (event) => {
  const tab = Object.values(tabs).find(t =>
    (t.view && t.view.webContents === event.sender) ||
    (t.splitView && t.splitView.webContents === event.sender)
  );
  if (!tab) return;
  const side = (tab.splitView && tab.splitView.webContents === event.sender) ? 'split' : 'main';
  if (tab.activeSplitSide !== side) {
    tab.activeSplitSide = side;
    const win = BrowserWindow.fromId(tab.windowId);
    const activeWc = side === 'split' ? tab.splitView.webContents : tab.view.webContents;

    if (activeWc && !activeWc.isFocused()) {
      activeWc.focus();
    }

    sendToUI(win, 'ui-split-side-focused', { tabId: tab.id, side: side });

    sendToUI(win, 'ui-tab-updated', {
      id: tab.id,
      url: side === 'split' ? tab.splitUrl : tab.url,
      canGoBack: activeWc.canGoBack(),
      canGoForward: activeWc.canGoForward()
    });
  }
});

// Window Control IPC
ipcMain.on('window-minimize', (event) => {
  if (ignoreUntrustedMainUiSender(event, 'window-minimize')) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('window-maximize', (event) => {
  if (ignoreUntrustedMainUiSender(event, 'window-maximize')) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('window-close', (event) => {
  if (ignoreUntrustedMainUiSender(event, 'window-close')) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.on('window-new', (event) => {
  if (ignoreUntrustedMainUiSender(event, 'window-new')) return;
  createMainWindow();
});

ipcMain.on('download-open', (event, filePath) => {
  if (ignoreUntrustedMainUiSender(event, 'download-open')) return;
  if (filePath) {
    shell.openPath(filePath);
  }
});

ipcMain.on('open-external', (event, url) => {
  if (ignoreUntrustedMainUiSender(event, 'open-external')) return;
  if (url) {
    shell.openExternal(url);
  }
});

ipcMain.handle('active-tab-capture-preview', async (event) => {
  const win = assertMainUiSender(event);
  const activeTabId = activeTabs[win.id];
  const tab = activeTabId ? tabs[activeTabId] : null;
  const view = tab && tab.activeSplitSide === 'split' && tab.splitView ? tab.splitView : tab?.view;
  const wc = view?.webContents;

  if (!wc || wc.isDestroyed()) return '';

  try {
    const image = await wc.capturePage();
    if (!image || image.isEmpty()) return '';
    return image.toDataURL();
  } catch (err) {
    console.error('[Preview] Failed to capture active tab:', err);
    return '';
  }
});

// Storage and Preferences IPC handlers
ipcMain.handle('bookmarks-get', (event) => {
  assertMainUiSender(event);
  const { bookmarks, changed } = hydrateBookmarkFavicons(bookmarksStore.get('bookmarks') || []);
  if (changed) {
    bookmarksStore.set('bookmarks', bookmarks);
  }
  return bookmarks;
});

function buildNativeBookmarksMenu(bookmarks, folderId, win) {
  const { Menu, MenuItem } = require('electron');
  const items = bookmarks.filter(b => {
    const bFolderId = b.folderId === undefined ? null : b.folderId;
    return bFolderId === folderId;
  });
  if (items.length === 0) {
    const menu = new Menu();
    menu.append(new MenuItem({ label: '(Klasör boş)', enabled: false }));
    return menu;
  }
  const menu = new Menu();
  items.forEach(b => {
    if (b.isFolder) {
      const submenu = buildNativeBookmarksMenu(bookmarks, b.id, win);
      menu.append(new MenuItem({
        label: `📁 ${b.title}`,
        submenu: submenu
      }));
    } else {
      menu.append(new MenuItem({
        label: b.title,
        click: () => {
          const activeTabId = activeTabs[win.id];
          if (activeTabId && tabs[activeTabId]) {
            const targetUrl = b.url || '';
            if (tabs[activeTabId].isSleeping) {
              wakeTab(activeTabId);
            }
            if (tabs[activeTabId].view) {
              tabs[activeTabId].view.webContents.loadURL(formatUrl(targetUrl));
            }
          }
        }
      }));
    }
  });
  return menu;
}

ipcMain.on('show-bookmarks-folder-menu', (event, { folderId, x, y }) => {
  if (ignoreUntrustedMainUiSender(event, 'show-bookmarks-folder-menu')) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  const bookmarks = bookmarksStore.get('bookmarks') || [];
  const menu = buildNativeBookmarksMenu(bookmarks, folderId, win);
  menu.popup({
    window: win,
    x: x ? Math.round(x) : undefined,
    y: y ? Math.round(y) : undefined
  });
});

ipcMain.handle('bookmarks-set', (event, bookmarks) => {
  assertMainUiSender(event);
  const { bookmarks: hydrated } = hydrateBookmarkFavicons(bookmarks || []);
  bookmarksStore.set('bookmarks', hydrated);
  return hydrated;
});

ipcMain.handle('bookmarks-add', (event, bookmark) => {
  assertMainUiSender(event);
  const bookmarks = bookmarksStore.get('bookmarks') || [];
  const nextBookmark = bookmark && !bookmark.favicon
    ? { ...bookmark, favicon: getCachedFaviconForUrl(bookmark.url) || '' }
    : bookmark;
  if (!nextBookmark || !nextBookmark.url) return bookmarks;
  if (!bookmarks.some(b => b.url === nextBookmark.url)) {
    bookmarksStore.push('bookmarks', nextBookmark);
  }
  return bookmarksStore.get('bookmarks');
});

ipcMain.handle('bookmarks-remove', (event, url) => {
  assertMainUiSender(event);
  bookmarksStore.filter('bookmarks', b => b.url !== url);
  return bookmarksStore.get('bookmarks');
});

ipcMain.handle('bookmarks-update', (event, { oldUrl, bookmark }) => {
  assertMainUiSender(event);
  const bookmarks = bookmarksStore.get('bookmarks') || [];
  const index = bookmarks.findIndex(b => b.url === oldUrl);
  if (index !== -1) {
    // If the URL changed, make sure we don't collide with an existing one unless it is the same bookmark
    bookmarks[index] = bookmark && !bookmark.favicon
      ? { ...bookmark, favicon: getCachedFaviconForUrl(bookmark.url) || '' }
      : bookmark;
    bookmarksStore.set('bookmarks', bookmarks);
  }
  return bookmarksStore.get('bookmarks');
});

ipcMain.handle('history-get', (event) => {
  assertMainUiSender(event);
  return historyStore.get('history');
});

ipcMain.handle('history-clear', (event, range) => {
  assertMainUiSender(event);
  if (!range || range === 'all') {
    historyStore.set('history', []);
  } else {
    const history = historyStore.get('history') || [];
    const now = Date.now();
    let threshold = 0;
    if (range === 'hour') threshold = now - 60 * 60 * 1000;
    else if (range === 'day') threshold = now - 24 * 60 * 60 * 1000;
    else if (range === 'week') threshold = now - 7 * 24 * 60 * 60 * 1000;

    if (threshold > 0) {
      const filtered = history.filter(item => item.timestamp < threshold);
      historyStore.set('history', filtered);
    }
  }
  return [];
});

function normalizeVersion(value) {
  return String(value || '').trim().replace(/^v/i, '');
}

function parseComparableVersion(value) {
  const normalized = normalizeVersion(value);
  const withoutBuild = normalized.split('+')[0];
  const [core, prerelease = ''] = withoutBuild.split('-', 2);
  const coreParts = core.split('.').map(part => Number.parseInt(part, 10));
  if (coreParts.length !== 3 || coreParts.some(part => !Number.isInteger(part) || part < 0)) {
    return null;
  }
  return {
    core: coreParts,
    prerelease: prerelease ? prerelease.split('.') : []
  };
}

function comparePrereleaseIdentifier(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) {
    return Number(left) - Number(right);
  }
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left.localeCompare(right);
}

function compareVersions(left, right) {
  const parsedLeft = parseComparableVersion(left);
  const parsedRight = parseComparableVersion(right);
  if (!parsedLeft || !parsedRight) return 0;

  for (let i = 0; i < 3; i++) {
    if (parsedLeft.core[i] !== parsedRight.core[i]) {
      return parsedLeft.core[i] - parsedRight.core[i];
    }
  }

  const leftPre = parsedLeft.prerelease;
  const rightPre = parsedRight.prerelease;
  if (!leftPre.length && !rightPre.length) return 0;
  if (!leftPre.length) return 1;
  if (!rightPre.length) return -1;

  for (let i = 0; i < Math.max(leftPre.length, rightPre.length); i++) {
    if (leftPre[i] === undefined) return -1;
    if (rightPre[i] === undefined) return 1;
    const diff = comparePrereleaseIdentifier(leftPre[i], rightPre[i]);
    if (diff !== 0) return diff;
  }

  return 0;
}

function isNewerVersion(current, latest) {
  return compareVersions(latest, current) > 0;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtmlText(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function checksumPatternsFor(algorithm) {
  if (algorithm === 'sha512') {
    return [
      { encoding: 'base64', pattern: '[A-Za-z0-9+/=]{88}' },
      { encoding: 'hex', pattern: '[a-fA-F0-9]{128}' }
    ];
  }
  return [{ encoding: 'hex', pattern: '[a-fA-F0-9]{64}' }];
}

function normalizeChecksumMatch(value, algorithm, encoding) {
  if (!value || typeof value !== 'string') return null;
  return {
    algorithm,
    encoding,
    value: encoding === 'hex' ? value.toLowerCase() : value
  };
}

function extractChecksumFromText(text, algorithm, assetName = '') {
  if (!text || typeof text !== 'string') return null;

  for (const { encoding, pattern } of checksumPatternsFor(algorithm)) {
    if (assetName) {
      const assetMatch = text.match(new RegExp(`${escapeRegExp(assetName)}[\\s\\S]{0,300}?\\b(${pattern})\\b`, 'i'));
      if (assetMatch) return normalizeChecksumMatch(assetMatch[1], algorithm, encoding);
    }

    const label = algorithm === 'sha512'
      ? 'sha(?:-?512)?(?:sum|checksum)?'
      : 'sha(?:-?256)?(?:sum|checksum)?';
    const labeledMatch = text.match(new RegExp(`\\b${label}\\b[^A-Za-z0-9+/=]{0,80}(${pattern})`, 'i'));
    if (labeledMatch) return normalizeChecksumMatch(labeledMatch[1], algorithm, encoding);

    const anyMatch = text.match(new RegExp(`\\b(${pattern})\\b`, 'i'));
    if (anyMatch) return normalizeChecksumMatch(anyMatch[1], algorithm, encoding);
  }

  return null;
}

async function fetchReleaseAssetText(asset) {
  const response = await net.fetch(asset.browser_download_url, {
    headers: { 'User-Agent': 'oslo-browser-updater' }
  });
  if (!response.ok) return '';
  return response.text();
}

async function resolveReleaseChecksum(release, winAsset) {
  const assetName = winAsset?.name || '';
  for (const algorithm of ['sha256', 'sha512']) {
    const bodyChecksum = extractChecksumFromText(release.body || '', algorithm, assetName);
    if (bodyChecksum) return bodyChecksum;
  }

  const checksumAsset = (release.assets || []).find(asset => {
    const name = String(asset.name || '').toLowerCase();
    return asset.browser_download_url && (
      name.endsWith('.sha256') ||
      name.endsWith('.sha256sum') ||
      name.endsWith('.sha512') ||
      name.endsWith('.sha512sum') ||
      name.includes('checksum')
    );
  });

  if (checksumAsset) {
    try {
      const checksumText = await fetchReleaseAssetText(checksumAsset);
      for (const algorithm of ['sha256', 'sha512']) {
        const checksum = extractChecksumFromText(checksumText, algorithm, assetName);
        if (checksum) return checksum;
      }
    } catch (error) {
      console.error('Failed to read update checksum asset:', error);
    }
  }

  const latestYmlAsset = (release.assets || []).find(asset => {
    const name = String(asset.name || '').toLowerCase();
    return asset.browser_download_url && (name === 'latest.yml' || name === 'latest.yaml');
  });

  if (latestYmlAsset) {
    try {
      const latestYmlText = await fetchReleaseAssetText(latestYmlAsset);
      return extractChecksumFromText(latestYmlText, 'sha512', assetName);
    } catch (error) {
      console.error('Failed to read update metadata asset:', error);
    }
  }

  return null;
}

function isValidUpdateVersion(value) {
  return typeof value === 'string' && /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/i.test(value);
}

function isValidSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function normalizeChecksumAlgorithm(algorithm, checksum = '') {
  const normalized = typeof algorithm === 'string' ? algorithm.toLowerCase() : '';
  if (normalized === 'sha256' || normalized === 'sha512') return normalized;
  return typeof checksum === 'string' && checksum.length === 128 ? 'sha512' : 'sha256';
}

function normalizeChecksumEncoding(algorithm, checksum = '', encoding = '') {
  const normalized = typeof encoding === 'string' ? encoding.toLowerCase() : '';
  if (normalized === 'hex' || normalized === 'base64') return normalized;
  if (algorithm === 'sha512' && /^[a-f0-9]{128}$/i.test(checksum)) return 'hex';
  return algorithm === 'sha512' ? 'base64' : 'hex';
}

function isValidChecksum(value, algorithm, encoding) {
  if (algorithm === 'sha512') {
    if (encoding === 'hex') return typeof value === 'string' && /^[a-f0-9]{128}$/i.test(value);
    return typeof value === 'string' && /^[a-z0-9+/=]{88}$/i.test(value);
  }
  return encoding === 'hex' && isValidSha256(value);
}

function isTrustedUpdateUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const parsed = new URL(value);
    const allowedHosts = new Set(['github.com', 'oslobrowser.com', 'www.oslobrowser.com']);
    return parsed.protocol === 'https:' && allowedHosts.has(parsed.hostname.toLowerCase());
  } catch (error) {
    return false;
  }
}

function verifyWindowsInstallerSignature(filePath) {
  if (process.platform !== 'win32') {
    return { status: 'Skipped', subject: '', issuer: '', platform: process.platform };
  }

  const { spawnSync } = require('child_process');
  const script = `
    $sig = Get-AuthenticodeSignature -LiteralPath ${JSON.stringify(filePath)}
    $subject = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { '' }
    $issuer = if ($sig.SignerCertificate) { $sig.SignerCertificate.Issuer } else { '' }
    [pscustomobject]@{
      Status = $sig.Status.ToString()
      Subject = $subject
      Issuer = $issuer
    } | ConvertTo-Json -Compress
  `;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Signature verification failed: ${result.stderr || 'PowerShell exited with an error'}`);
  }

  return JSON.parse(result.stdout || '{}');
}

function assertTrustedInstallerSignature(filePath) {
  const signature = verifyWindowsInstallerSignature(filePath);
  if (signature.status === 'Skipped') return signature;
  if (signature.Status !== 'Valid' && signature.status !== 'Valid') {
    if (REQUIRE_SIGNED_UPDATES) {
      throw new Error(`Güncelleme imzası geçerli değil: ${signature.Status || signature.status || 'Unknown'}`);
    }
    console.warn('[Updater] Installer signature is not valid; continuing after checksum verification:', signature.Status || signature.status || 'Unknown');
    return {
      ...signature,
      trusted: false,
      required: false
    };
  }

  const subject = signature.Subject || signature.subject || '';
  const normalizedSubject = subject.toLowerCase();
  const publisherOk = EXPECTED_UPDATE_PUBLISHERS.some(name => normalizedSubject.includes(name.toLowerCase()));
  if (!publisherOk) {
    throw new Error(`Güncelleme yayıncısı güvenilir listede değil: ${subject || 'Bilinmiyor'}`);
  }

  return {
    ...signature,
    trusted: true,
    required: REQUIRE_SIGNED_UPDATES
  };
}

function getPendingUpdatePath() {
  return path.join(app.getPath('userData'), UPDATE_STATE_FILE);
}

function writePendingUpdateState(state) {
  const fs = require('fs');
  fs.writeFileSync(getPendingUpdatePath(), JSON.stringify(state, null, 2), 'utf8');
}

function reconcilePendingUpdateState() {
  const fs = require('fs');
  const statePath = getPendingUpdatePath();
  if (!fs.existsSync(statePath)) return;

  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (state.targetVersion && app.getVersion() === state.targetVersion) {
      fs.unlinkSync(statePath);
      return;
    }

    if (state.status === 'installer-started') {
      state.status = 'rollback-required';
      state.lastSeenVersion = app.getVersion();
      state.checkedAt = Date.now();
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
      console.warn('[Updater] Pending update did not complete. Rollback marker left for diagnostics:', state);
    }
  } catch (error) {
    console.error('[Updater] Failed to reconcile pending update state:', error);
  }
}

ipcMain.handle('check-for-updates', async (event) => {
  assertMainUiSender(event);
  const currentVersion = app.getVersion();
  try {
    const response = await net.fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        'User-Agent': 'oslo-browser-updater'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned status ${response.status}`);
    }

    const release = await response.json();
    const latestVersion = normalizeVersion(release.tag_name);

    let downloadUrl = 'https://oslobrowser.com/download';
    let assetName = '';
    let checksum = null;
    if (release.assets && release.assets.length > 0) {
      const winAsset = release.assets.find(asset => /\.exe$/i.test(asset.name || '') && /setup|installer/i.test(asset.name || '')) ||
        release.assets.find(asset => /\.exe$/i.test(asset.name || ''));
      if (winAsset) {
        downloadUrl = winAsset.browser_download_url;
        assetName = winAsset.name;
        checksum = await resolveReleaseChecksum(release, winAsset);
      } else {
        downloadUrl = release.html_url;
      }
    } else {
      downloadUrl = release.html_url;
    }

    return {
      updateAvailable: isNewerVersion(currentVersion, latestVersion),
      currentVersion,
      latestVersion,
      releaseNotes: release.body || '',
      downloadUrl,
      assetName,
      checksum: checksum?.value || '',
      checksumAlgorithm: checksum?.algorithm || '',
      checksumEncoding: checksum?.encoding || '',
      sha256: checksum?.algorithm === 'sha256' ? checksum.value : '',
      expectedSha256: checksum?.algorithm === 'sha256' ? checksum.value : ''
    };
  } catch (error) {
    console.error('Failed to check for updates from GitHub:', error);
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseNotes: '',
      downloadUrl: '',
      error: error.message
    };
  }
});

ipcMain.handle('download-update', async (event, { url, version, sha256, checksum, checksumAlgorithm, checksumEncoding }) => {
  assertMainUiSender(event);
  const fs = require('fs');
  const { spawn } = require('child_process');
  const os = require('os');
  const path = require('path');

  const win = BrowserWindow.fromWebContents(event.sender);
  const tempDir = os.tmpdir();
  const targetVersion = normalizeVersion(version);
  const installerPath = path.join(tempDir, `OSLO-Browser-v${targetVersion || 'update'}-Setup-${Date.now()}.exe`);

  let file;
  try {
    if (!isValidUpdateVersion(targetVersion)) {
      throw new Error('Geçersiz güncelleme sürümü.');
    }
    if (!isTrustedUpdateUrl(url) || !/\.exe(?:$|[?#])/i.test(url)) {
      throw new Error('Güncelleme paketi güvenilir bir HTTPS kurulum dosyası değil.');
    }
    const expectedChecksum = checksum || sha256 || '';
    const algorithm = normalizeChecksumAlgorithm(checksumAlgorithm, expectedChecksum);
    const encoding = normalizeChecksumEncoding(algorithm, expectedChecksum, checksumEncoding);
    if (!isValidChecksum(expectedChecksum, algorithm, encoding)) {
      throw new Error('Güncelleme paketi için doğrulama bilgisi eksik veya geçersiz.');
    }

    // Fetch automatically handles HTTP/HTTPS redirects out-of-the-box
    const response = await net.fetch(url, {
      headers: {
        'User-Agent': 'oslo-browser-updater'
      }
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}: ${response.statusText}`);
    }

    file = fs.createWriteStream(installerPath);
    const reader = response.body.getReader();
    const totalSize = parseInt(response.headers.get('content-length'), 10) || 0;
    let downloadedSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      downloadedSize += value.length;
      const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
      if (win && !win.isDestroyed()) {
        win.webContents.send('update-download-progress', { progress });
      }

      file.write(Buffer.from(value));
    }

    await new Promise((resolve) => file.end(resolve));

    const actualChecksum = crypto.createHash(algorithm).update(fs.readFileSync(installerPath)).digest(encoding);
    if (actualChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
      throw new Error('Güncelleme paketi doğrulamasından geçemedi.');
    }

    const signature = assertTrustedInstallerSignature(installerPath);

    writePendingUpdateState({
      status: 'installer-started',
      targetVersion,
      previousVersion: app.getVersion(),
      installerPath,
      checksum: actualChecksum,
      checksumAlgorithm: algorithm,
      checksumEncoding: encoding,
      sha256: algorithm === 'sha256' ? actualChecksum : '',
      signature,
      startedAt: Date.now()
    });

    // Spawn the installer detached from OSLO so it remains alive after OSLO exits
    const child = spawn(installerPath, [], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    // Quit the app immediately so the installer can overwrite locked executable/resources
    setTimeout(() => {
      app.quit();
    }, 1500);

    return { success: true };
  } catch (err) {
    console.error('Update download failed:', err);
    try {
      if (file) {
        file.destroy();
      }
    } catch (e) { }
    try {
      if (fs.existsSync(installerPath)) {
        fs.unlinkSync(installerPath);
      }
    } catch (e) { }
    throw err;
  }
});

ipcMain.handle('system-info-get', (event) => {
  assertMainUiSender(event);
  const os = require('os');
  return {
    appVersion: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    totalMem: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
    freeMem: Math.round(os.freemem() / (1024 * 1024 * 1024)) + ' GB',
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    uptime: Math.round(os.uptime() / 3600) + ' hours'
  };
});

ipcMain.handle('clear-browser-data', async (event) => {
  assertMainUiSender(event);
  try {
    await Promise.all(getManagedSessions(false).map(async (profileSession) => {
      await profileSession.clearCache();
      await profileSession.clearStorageData({
        storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
      });
    }));
    return { success: true };
  } catch (error) {
    console.error('Failed to clear browser data:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.on('telemetry-log-event', (event, { action, data }) => {
  if (ignoreUntrustedMainUiSender(event, 'telemetry-log-event')) return;
  if (settingsStore.get('telemetryEnabled')) {
    const events = telemetryStore.get('events') || [];
    events.push({
      timestamp: Date.now(),
      action,
      data
    });
    if (events.length > 100) events.splice(0, events.length - 100);
    telemetryStore.set('events', events);
  }
});

ipcMain.on('telemetry-log-crash', (event, error) => {
  if (ignoreUntrustedMainUiSender(event, 'telemetry-log-crash')) return;
  if (settingsStore.get('telemetryEnabled') && error) {
    const crashes = telemetryStore.get('crashes') || [];
    crashes.push({
      timestamp: Date.now(),
      message: error.message || String(error),
      stack: error.stack || '',
      process: 'renderer'
    });
    if (crashes.length > 50) crashes.splice(0, crashes.length - 50);
    telemetryStore.set('crashes', crashes);
  }
});

ipcMain.handle('telemetry-get-logs', (event) => {
  assertMainUiSender(event);
  return {
    events: telemetryStore.get('events') || [],
    crashes: telemetryStore.get('crashes') || []
  };
});

ipcMain.handle('telemetry-clear-logs', (event) => {
  assertMainUiSender(event);
  telemetryStore.set('events', []);
  telemetryStore.set('crashes', []);
  return { success: true };
});

ipcMain.handle('permissions-get-all', (event) => {
  assertMainUiSender(event);
  return permissionsStore.get('permissions') || {};
});

ipcMain.handle('permissions-delete', (event, key) => {
  assertMainUiSender(event);
  const saved = permissionsStore.get('permissions') || {};
  delete saved[key];
  permissionsStore.set('permissions', saved);
  return saved;
});

ipcMain.handle('permissions-set', (event, key, value) => {
  assertMainUiSender(event);
  const saved = permissionsStore.get('permissions') || {};
  if (value === null || value === undefined) {
    delete saved[key];
  } else {
    saved[key] = value;
  }
  permissionsStore.set('permissions', saved);
  return saved;
});

ipcMain.handle('site-data-get', async (event) => {
  assertMainUiSender(event);
  const cookies = await session.defaultSession.cookies.get({});
  const grouped = new Map();

  cookies.forEach(cookie => {
    const domain = String(cookie.domain || '').replace(/^\./, '') || 'local';
    if (!grouped.has(domain)) {
      grouped.set(domain, {
        domain,
        cookieCount: 0,
        secureCookieCount: 0,
        sessionCookieCount: 0
      });
    }
    const item = grouped.get(domain);
    item.cookieCount += 1;
    if (cookie.secure) item.secureCookieCount += 1;
    if (!cookie.expirationDate) item.sessionCookieCount += 1;
  });

  return Array.from(grouped.values()).sort((a, b) => a.domain.localeCompare(b.domain));
});

ipcMain.handle('site-data-clear', async (event, domain) => {
  assertMainUiSender(event);
  const cleanDomain = String(domain || '').replace(/^\./, '');
  if (!cleanDomain) return { success: false, message: 'missing_domain' };

  const cookies = await session.defaultSession.cookies.get({});
  const matches = cookies.filter(cookie => String(cookie.domain || '').replace(/^\./, '') === cleanDomain);
  await Promise.all(matches.map(cookie => {
    const scheme = cookie.secure ? 'https' : 'http';
    const cookieUrl = `${scheme}://${cleanDomain}${cookie.path || '/'}`;
    return session.defaultSession.cookies.remove(cookieUrl, cookie.name).catch(() => null);
  }));

  await Promise.all(['http', 'https'].map(scheme => {
    return session.defaultSession.clearStorageData({
      origin: `${scheme}://${cleanDomain}`,
      storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'websql', 'serviceworkers', 'cachestorage']
    }).catch(() => null);
  }));

  return { success: true };
});

ipcMain.handle('certificate-exceptions-get', (event) => {
  assertMainUiSender(event);
  return certificateExceptionsStore.get('exceptions') || {};
});

ipcMain.handle('certificate-exceptions-delete', (event, host) => {
  assertMainUiSender(event);
  const exceptions = certificateExceptionsStore.get('exceptions') || {};
  delete exceptions[host];
  certificateExceptionsStore.set('exceptions', exceptions);
  return exceptions;
});

ipcMain.handle('certificate-exceptions-clear', (event) => {
  assertMainUiSender(event);
  certificateExceptionsStore.set('exceptions', {});
  return {};
});

ipcMain.handle('downloads-get', (event) => {
  assertMainUiSender(event);
  return downloadsStore.get('downloads') || [];
});

ipcMain.handle('downloads-clear', (event) => {
  assertMainUiSender(event);
  downloadsStore.set('downloads', []);
  return [];
});

ipcMain.handle('spaces-get', (event) => {
  assertMainUiSender(event);
  const raw = spacesStore.get('spaces') || ['Genel'];
  let migrated = raw.map(s => {
    let obj = typeof s === 'string' ? { name: s, emoji: '🌐', color: '#000000' } : s;
    if (obj.name === 'Genel') {
      obj.color = '#000000';
    }
    return obj;
  });
  if (JSON.stringify(raw) !== JSON.stringify(migrated)) {
    spacesStore.set('spaces', migrated);
  }
  return migrated;
});

ipcMain.handle('spaces-add', (event, space) => {
  assertMainUiSender(event);
  const raw = spacesStore.get('spaces') || ['Genel'];
  let spaces = raw.map(s => {
    let obj = typeof s === 'string' ? { name: s, emoji: '🌐', color: '#000000' } : s;
    if (obj.name === 'Genel') {
      obj.color = '#000000';
    }
    return obj;
  });

  const spaceObj = typeof space === 'string' ? { name: space, emoji: '🌐', color: '#10b981' } : space;
  if (!spaces.some(s => s.name === spaceObj.name)) {
    spaces.push(spaceObj);
    spacesStore.set('spaces', spaces);
  }
  return spaces;
});

ipcMain.handle('spaces-delete', (event, spaceName) => {
  assertMainUiSender(event);
  const raw = spacesStore.get('spaces') || ['Genel'];
  let spaces = raw.map(s => {
    let obj = typeof s === 'string' ? { name: s, emoji: '🌐', color: '#000000' } : s;
    if (obj.name === 'Genel') {
      obj.color = '#000000';
    }
    return obj;
  });

  let filtered = spaces.filter(s => s.name !== spaceName);
  if (filtered.length === 0) {
    filtered.push({ name: 'Genel', emoji: '🌐', color: '#000000' });
  }
  spacesStore.set('spaces', filtered);
  return filtered;
});

ipcMain.handle('spaces-update', (event, { oldName, space }) => {
  assertMainUiSender(event);
  const raw = spacesStore.get('spaces') || ['Genel'];
  let spaces = raw.map(s => {
    let obj = typeof s === 'string' ? { name: s, emoji: '🌐', color: '#000000' } : s;
    if (obj.name === 'Genel') {
      obj.color = '#000000';
    }
    return obj;
  });

  const idx = spaces.findIndex(s => s.name === oldName);
  if (idx !== -1) {
    if (space.name === 'Genel' || oldName === 'Genel') {
      space.color = '#000000';
    }
    spaces[idx] = space;
    spacesStore.set('spaces', spaces);
  }
  return spaces;
});

ipcMain.on('find-in-page', (event, { text, options }) => {
  if (ignoreUntrustedMainUiSender(event, 'find-in-page')) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const activeTabId = activeTabs[win.id];
  if (activeTabId && tabs[activeTabId] && tabs[activeTabId].view) {
    tabs[activeTabId].view.webContents.findInPage(text, options);
  }
});

ipcMain.on('stop-find-in-page', (event, { action }) => {
  if (ignoreUntrustedMainUiSender(event, 'stop-find-in-page')) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const activeTabId = activeTabs[win.id];
  if (activeTabId && tabs[activeTabId] && tabs[activeTabId].view) {
    tabs[activeTabId].view.webContents.stopFindInPage(action);
  }
});

// Unified Settings Handlers
ipcMain.handle('settings-get-all', (event) => {
  assertSettingsReadSender(event);
  return settingsStore.data;
});

function applySetting(key, value) {
  const networkPrivacyKeys = new Set([
    'cookiePolicy',
    'trackingProtectionLevel',
    'fingerprintProtection',
    'refererPolicy',
    'globalPrivacyControl',
    'incognitoBlockThirdPartyCookies',
    'httpsOnlyExceptions'
  ]);

  if (key === 'adblockEnabled') {
    adblock.setAdBlockEnabled(value);
  } else if (key === 'httpsOnlyEnabled') {
    adblock.setHttpsOnlyEnabled(value);
  } else if (networkPrivacyKeys.has(key)) {
    syncNetworkPrivacyOptions();
  } else if (key === 'customCss') {
    if (settingsStore.get('customCssEnabled') !== false) {
      applyCustomCssToOpenTabs(value);
    } else if (!value) {
      applyCustomCssToOpenTabs('');
    }
  } else if (key === 'customCssEnabled') {
    applyCustomCssToOpenTabs(value ? (settingsStore.get('customCss') || '') : '');
  } else if (key === 'defaultPageZoom') {
    const zoom = parseFloat(value) || 1.0;
    Object.values(tabs).forEach(tab => {
      tab.zoomFactor = zoom;
      [tab.view, tab.splitView].forEach(view => {
        if (view && !tab.isSleeping && view.webContents) {
          view.webContents.setZoomFactor(zoom);
        }
      });
      const tabWindow = BrowserWindow.fromId(tab.windowId);
      sendToUI(tabWindow, 'ui-zoom-changed', { tabId: tab.id, zoom });
    });
    saveSession();
  }

  // Broadcast to main window and all active tabs
  const broadcastData = { key, value };
  windows.forEach(win => {
    sendToUI(win, 'ui-settings-updated', broadcastData);
  });
  Object.values(tabs).forEach(tab => {
    if (tab.view && !tab.isSleeping && tab.view.webContents) {
      tab.view.webContents.send('ui-settings-updated', broadcastData);
    }
  });
}

ipcMain.handle('settings-set', (event, { key, value }) => {
  assertMainUiSender(event);
  if (!isKnownSettingKey(key)) {
    throw new Error(`Unknown setting key: ${key}`);
  }
  settingsStore.set(key, value);
  applySetting(key, value);
  return value;
});

ipcMain.handle('settings-export', async (event) => {
  const win = assertMainUiSender(event);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Ayarları Dışa Aktar',
    defaultPath: 'oslo-settings.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (canceled || !filePath) return false;

  const fs = require('fs');
  try {
    fs.writeFileSync(filePath, JSON.stringify(settingsStore.data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to export settings:', error);
    throw error;
  }
});

ipcMain.handle('settings-import', async (event) => {
  const win = assertMainUiSender(event);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Ayarları İçe Aktar',
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (canceled || !filePaths || filePaths.length === 0) return null;

  const fs = require('fs');
  try {
    const content = fs.readFileSync(filePaths[0], 'utf-8');
    const imported = JSON.parse(content);
    if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
      throw new Error('Geçersiz ayar dosyası formatı.');
    }

    const importedSettings = Object.entries(imported).filter(([key]) => isKnownSettingKey(key));
    for (const [key, value] of importedSettings) {
      if (!isValidSettingValue(key, value)) {
        throw new Error(`Invalid setting value: ${key}`);
      }
    }

    for (const [key, value] of importedSettings) {
      settingsStore.set(key, value);
      applySetting(key, value);
    }

    return settingsStore.data;
  } catch (error) {
    console.error('Failed to import settings:', error);
    throw error;
  }
});

ipcMain.handle('settings-reset', async (event) => {
  assertMainUiSender(event);
  try {
    const defaults = createDefaultSettings();
    settingsStore.replace(defaults);
    bookmarksStore.set('bookmarks', []);
    for (const [key, value] of Object.entries(defaults)) {
      applySetting(key, value);
    }
    windows.forEach(win => {
      sendToUI(win, 'ui-bookmarks-updated', []);
    });
    return settingsStore.data;
  } catch (error) {
    console.error('Failed to reset settings:', error);
    throw error;
  }
});

ipcMain.handle('newtab-wallpaper-select-file', async (event) => {
  const win = assertMainUiSender(event);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Yeni Sekme Arka Planı Seç',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (canceled || !filePaths || filePaths.length === 0) {
    return null;
  }

  return pathToFileURL(filePaths[0]).toString();
});

// Password Management IPC Handlers
ipcMain.handle('passwords-get', (event) => {
  assertMainUiSender(event);
  return (passwordsStore.get('passwords') || []).map(toPublicCredential);
});

ipcMain.handle('passwords-audit', async (event) => {
  assertMainUiSender(event);
  const list = (passwordsStore.get('passwords') || []).map(toPublicCredential);
  const passwordGroups = new Map();
  list.forEach(item => {
    const key = String(item.password || '');
    if (!key) return;
    if (!passwordGroups.has(key)) passwordGroups.set(key, []);
    passwordGroups.get(key).push(item);
  });

  const issues = [];
  let weakCount = 0;
  let reusedCount = 0;
  let breachedCount = 0;
  let leakChecksCompleted = 0;
  let leakChecksFailed = 0;
  let breachServiceAvailable = true;

  for (const item of list) {
    const password = String(item.password || '');
    const isWeak = isWeakPasswordValue(password);
    const reuseGroup = passwordGroups.get(password) || [];
    const isReused = !!password && reuseGroup.length > 1;
    const breach = breachServiceAvailable
      ? await checkPasswordBreach(password)
      : { breached: false, count: 0, checked: false, error: 'breach_service_unavailable' };
    if (breach.error) breachServiceAvailable = false;
    const isBreached = !!breach.breached;

    if (isWeak) weakCount += 1;
    if (isReused) reusedCount += 1;
    if (isBreached) breachedCount += 1;
    if (breach.checked) leakChecksCompleted += 1;
    else leakChecksFailed += 1;

    if (isWeak || isReused || isBreached) {
      issues.push({
        id: item.id,
        origin: item.origin,
        username: item.username,
        isWeak,
        isReused,
        isBreached,
        breachCount: breach.count || 0,
        strengthScore: scorePasswordStrength(password),
        reuseCount: reuseGroup.length
      });
    }
  }

  return {
    total: list.length,
    weak: weakCount,
    reused: reusedCount,
    breached: breachedCount,
    leakChecksCompleted,
    leakChecksFailed,
    issues
  };
});

ipcMain.handle('passwords-save', (event, credential) => {
  assertMainUiSender(event);
  if (!credential || typeof credential !== 'object' || !credential.origin || !credential.username) {
    throw new Error('Invalid credential payload');
  }
  const list = passwordsStore.get('passwords') || [];
  const protectedSecret = protectPassword(credential.password || '');

  // Check if same origin and username already exist to overwrite
  const idx = list.findIndex(p => p.origin === credential.origin && p.username === credential.username);
  if (idx !== -1) {
    list[idx] = {
      ...list[idx],
      ...protectedSecret
    };
  } else {
    const newEntry = {
      id: 'pw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      origin: credential.origin,
      username: credential.username,
      ...protectedSecret
    };
    list.push(newEntry);
  }

  passwordsStore.set('passwords', list);
  return list.map(toPublicCredential);
});

ipcMain.handle('passwords-delete', (event, id) => {
  assertMainUiSender(event);
  let list = passwordsStore.get('passwords') || [];
  list = list.filter(p => p.id !== id);
  passwordsStore.set('passwords', list);
  return list.map(toPublicCredential);
});

// CSV Parser Helper for importing passwords
function parsePasswordsCsv(content) {
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return [];

  const splitCsvLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase());

  // Find column indices based on common CSV headers
  let urlIdx = headers.findIndex(h => h.includes('url') || h.includes('website') || h.includes('origin') || h.includes('link'));
  let userIdx = headers.findIndex(h => h.includes('username') || h.includes('login') || h.includes('user') || h.includes('email'));
  let passIdx = headers.findIndex(h => h.includes('password') || h.includes('pass') || h.includes('şifre') || h.includes('sifre'));

  // Fallbacks if headers are missing or unrecognized (Chrome export typically has name,url,username,password)
  if (urlIdx === -1) urlIdx = headers.findIndex(h => h === 'name') !== -1 ? 1 : 0;
  if (userIdx === -1) userIdx = urlIdx === 0 ? 1 : 2;
  if (passIdx === -1) passIdx = userIdx + 1;

  // Safety bounds check fallback
  if (urlIdx === -1) urlIdx = 0;
  if (userIdx === -1) userIdx = 1;
  if (passIdx === -1) passIdx = 2;

  const imported = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitCsvLine(line);
    const maxIdx = Math.max(urlIdx, userIdx, passIdx);
    if (cells.length <= maxIdx) continue;

    let origin = cells[urlIdx];
    const username = cells[userIdx];
    const password = cells[passIdx];

    if (!origin || !username || !password) continue;

    // Ensure origin starts with a protocol
    if (!/^https?:\/\//i.test(origin)) {
      if (origin.includes('.')) {
        origin = 'https://' + origin;
      } else {
        origin = 'http://' + origin;
      }
    }

    imported.push({ origin, username, password });
  }
  return imported;
}

ipcMain.handle('passwords-import', async (event) => {
  const focusedWindow = assertMainUiSender(event);
  const { canceled, filePaths } = await dialog.showOpenDialog(focusedWindow, {
    title: 'Şifreleri İçe Aktar (CSV)',
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) {
    return { success: false, message: 'canceled' };
  }

  try {
    const fs = require('fs');
    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    const imported = parsePasswordsCsv(content);

    if (imported.length === 0) {
      return { success: false, message: 'no_credentials_found' };
    }

    const list = passwordsStore.get('passwords') || [];
    let addedCount = 0;
    let updatedCount = 0;

    for (const item of imported) {
      const idx = list.findIndex(p => p.origin === item.origin && p.username === item.username);
      const protectedSecret = protectPassword(item.password);
      if (idx !== -1) {
        if (revealPassword(list[idx]) !== item.password) {
          list[idx] = {
            ...list[idx],
            ...protectedSecret
          };
          updatedCount++;
        }
      } else {
        list.push({
          id: 'pw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '_' + addedCount,
          origin: item.origin,
          username: item.username,
          ...protectedSecret
        });
        addedCount++;
      }
    }

    passwordsStore.set('passwords', list);
    return { success: true, added: addedCount, updated: updatedCount, total: imported.length };
  } catch (error) {
    console.error('Failed to import passwords:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('passwords-export', async (event) => {
  assertMainUiSender(event);
  const list = (passwordsStore.get('passwords') || []).map(toPublicCredential);
  if (list.length === 0) {
    return { success: false, message: 'no_passwords_to_export' };
  }

  const focusedWindow = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(focusedWindow, {
    title: 'Şifreleri Dışarı Aktar (CSV)',
    defaultPath: 'oslo_passwords.csv',
    filters: [
      { name: 'CSV Files', extensions: ['csv'] }
    ]
  });

  if (canceled || !filePath) {
    return { success: false, message: 'canceled' };
  }

  try {
    const fs = require('fs');
    let csvContent = 'name,url,username,password\n';

    const escapeCsv = (str) => {
      if (typeof str !== 'string') return '';
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    for (const p of list) {
      let name = p.origin;
      try {
        const urlObj = new URL(p.origin);
        name = urlObj.hostname;
      } catch (e) { }

      csvContent += `${escapeCsv(name)},${escapeCsv(p.origin)},${escapeCsv(p.username)},${escapeCsv(p.password)}\n`;
    }

    fs.writeFileSync(filePath, csvContent, 'utf-8');
    return { success: true, count: list.length };
  } catch (error) {
    console.error('Failed to export passwords:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-saved-credentials', (event) => {
  assertKnownTabSender(event);
  if (!settingsStore.get('autofillEnabled')) return [];
  const origin = getSenderWebOrigin(event);
  if (!origin) return [];
  const list = passwordsStore.get('passwords') || [];
  return list.filter(p => p.origin === origin).map(toPublicCredential);
});

// Handle form submissions from preload.js
ipcMain.on('login-form-submitted', (event, data) => {
  let tab = null;
  try {
    tab = assertKnownTabSender(event);
  } catch (error) {
    console.warn('[PasswordManager] Blocked login-form-submitted from unknown sender.');
    return;
  }

  const origin = getSenderWebOrigin(event);

  if (!settingsStore.get('savePasswordsEnabled')) {
    return;
  }
  if (!origin || !data?.username || !data?.password) {
    return;
  }

  const list = passwordsStore.get('passwords') || [];
  const existing = list.find(p => p.origin === origin && p.username === data.username);

  // If it doesn't exist or has a different password, prompt to save/update
  if (!existing || revealPassword(existing) !== data.password) {
    // Try to find the tab by matching event.sender to tab.view.webContents
    let win = null;

    if (tab && tab.windowId) {
      win = BrowserWindow.fromId(tab.windowId);
    }

    // Fallback: use BrowserWindow.fromWebContents which traverses parent chain
    if (!win) {
      win = BrowserWindow.fromWebContents(event.sender);
    }

    // Last resort: use the first available window
    if (!win && windows.size > 0) {
      win = Array.from(windows)[0];
    }

    if (win) {
      sendToUI(win, 'ui-password-save-prompt', {
        origin,
        username: data.username,
        password: data.password,
        isUpdate: !!existing
      });
    } else {
      console.warn('[PasswordManager] No window available to show save prompt.');
    }
  }
});

// Legacy Handlers as fallback
ipcMain.handle('adblock-get', (event) => {
  assertMainUiSender(event);
  return adblock.isAdBlockEnabled();
});
ipcMain.on('adblock-get-sync', (event) => {
  event.returnValue = adblock.isAdBlockEnabled();
});
ipcMain.on('privacy-shields-get-sync', (event) => {
  event.returnValue = {
    adBlockEnabled: adblock.isAdBlockEnabled(),
    fingerprintProtection: settingsStore.get('fingerprintProtection') !== false
  };
});
ipcMain.handle('adblock-set', (event, enabled) => {
  assertMainUiSender(event);
  adblock.setAdBlockEnabled(enabled);
  settingsStore.set('adblockEnabled', enabled);
  return enabled;
});
ipcMain.handle('adblock-get-count', (event) => {
  assertMainUiSender(event);
  return settingsStore.get('blockedCount') || 0;
});
ipcMain.handle('httpsonly-get', (event) => {
  assertMainUiSender(event);
  return settingsStore.get('httpsOnlyEnabled') || false;
});
ipcMain.handle('httpsonly-set', (event, enabled) => {
  assertMainUiSender(event);
  settingsStore.set('httpsOnlyEnabled', enabled);
  adblock.setHttpsOnlyEnabled(enabled);
  return enabled;
});
ipcMain.handle('searchengine-get', (event) => {
  assertSettingsReadSender(event);
  return settingsStore.get('searchEngine');
});
ipcMain.handle('searchengine-set', (event, engine) => {
  assertMainUiSender(event);
  settingsStore.set('searchEngine', engine);
  return engine;
});
ipcMain.handle('custom-css-get', (event) => {
  assertMainUiSender(event);
  return settingsStore.get('customCss') || '';
});
ipcMain.handle('custom-css-set', (event, css) => {
  assertMainUiSender(event);
  settingsStore.set('customCss', css);
  if (settingsStore.get('customCssEnabled') !== false) {
    applyCustomCssToOpenTabs(css);
  }
  return css;
});

// Enhanced Download Controls
ipcMain.on('download-pause', (event, id) => {
  if (ignoreUntrustedMainUiSender(event, 'download-pause')) return;
  const download = activeDownloads[id];
  const item = download && (download.item || download);
  if (item && !item.isPaused()) {
    try {
      item.pause();
      sendToUI(download.win, 'download-progress', {
        id,
        name: download.name,
        status: 'paused',
        progress: Math.max(0, Math.min(Math.round(item.getPercentComplete()) || 0, 100)),
        received: item.getReceivedBytes(),
        total: download.total
      });
    } catch (err) {
      console.error('[Download Manager] Failed to pause download:', err);
    }
  }
});
ipcMain.on('download-resume', (event, id) => {
  if (ignoreUntrustedMainUiSender(event, 'download-resume')) return;
  const download = activeDownloads[id];
  const item = download && (download.item || download);
  if (item && item.isPaused()) {
    try {
      item.resume();
      sendToUI(download.win, 'download-progress', {
        id,
        name: download.name,
        status: 'progressing',
        progress: Math.max(0, Math.min(Math.round(item.getPercentComplete()) || 0, 100)),
        received: item.getReceivedBytes(),
        total: download.total
      });
    } catch (err) {
      console.error('[Download Manager] Failed to resume download:', err);
    }
  }
});
ipcMain.on('download-cancel', (event, id) => {
  if (ignoreUntrustedMainUiSender(event, 'download-cancel')) return;
  const download = activeDownloads[id];
  const item = download && (download.item || download);
  if (item) {
    try {
      item.cancel();
      sendToUI(download.win, 'download-progress', {
        id,
        name: download.name,
        status: 'cancelled',
        progress: 0,
        received: item.getReceivedBytes(),
        total: download.total
      });
    } catch (err) {
      console.error('[Download Manager] Failed to cancel download:', err);
      delete activeDownloads[id];
    }
  }
});

// Memory Saver / Sleeping Tabs Background Timer
setInterval(() => {
  if (settingsStore.get('sleepTabsEnabled') === false) return;

  const now = Date.now();
  const sleepTimeoutMinutes = parseFloat(settingsStore.get('sleepTabsTimeout')) || 15;
  const sleepThreshold = sleepTimeoutMinutes * 60 * 1000;

  Object.keys(tabs).forEach(id => {
    const tab = tabs[id];
    if (!tab.view || !tab.view.webContents) return;
    // Memory Saver / Sleeping Tabs Background Timer
    const win = BrowserWindow.fromWebContents(tab.view.webContents);
    const activeId = win ? activeTabs[win.id] : null;
    if (id === activeId || tab.isSleeping || tab.isLoading || tab.isIncognito) return;

    if (now - tab.lastActive > sleepThreshold) {
      sleepTab(id);
    }
  });
}, 30000); // Check every 30 seconds

function optimizePerformanceForHardware() {
  const os = require('os');
  const totalMemoryGB = os.totalmem() / (1024 * 1024 * 1024);
  const cpuCores = os.cpus().length;

  if (settingsStore.get('hardwareAutoOptimized')) {
    return;
  }

  // Criteria: RAM <= 8.5 GB or CPU cores <= 4
  const isOldHardware = totalMemoryGB <= 8.5 || cpuCores <= 4;

  if (isOldHardware) {
    // Enable performance optimizations
    settingsStore.set('sleepTabsEnabled', true);
    settingsStore.set('sleepTabsTimeout', 15);
    settingsStore.set('reduceMotion', true);
    settingsStore.set('transparencyEnabled', false);

    // Log telemetry event if enabled
    if (settingsStore.get('telemetryEnabled')) {
      try {
        const events = telemetryStore.get('events') || [];
        events.push({
          timestamp: Date.now(),
          event: 'hardware-optimize',
          details: {
            ramGB: totalMemoryGB,
            cores: cpuCores,
            message: 'Performance settings optimized for low-end hardware.'
          }
        });
        if (events.length > 50) events.splice(0, events.length - 50);
        telemetryStore.set('events', events);
      } catch (e) {
        console.error('Failed to log hardware optimization telemetry event:', e);
      }
    }
  }

  settingsStore.set('hardwareAutoOptimized', true);
}

// App Startup
app.whenReady().then(() => {
  migratePasswordsToEncryptedStorage();
  optimizePerformanceForHardware();
  reconcilePendingUpdateState();

  // SSL Certificate error popup handling
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    const win = BrowserWindow.fromWebContents(webContents);
    let host = url;
    try {
      host = new URL(url).hostname;
    } catch (e) { }

    const exceptions = certificateExceptionsStore.get('exceptions') || {};
    if (exceptions[host]) {
      callback(true);
      return;
    }

    const lang = settingsStore.get('language') || 'tr';
    const title = lang === 'tr' ? 'Güvenlik Uyarısı' : (lang === 'fr' ? 'Alerte de Sécurité' : 'Security Warning');
    const message = lang === 'tr' ? `"${url}" sitesinin güvenlik sertifikası güvenilmez.` :
      (lang === 'fr' ? `Le certificat de sécurité pour "${url}" n'est pas fiable.` :
        `The security certificate for "${url}" is not trusted.`);
    const detail = lang === 'tr' ? `Hata: ${error}\nYine de devam etmek istiyor musunuz?` :
      (lang === 'fr' ? `Erreur: ${error}\nVoulez-vous continuer quand même ?` :
        `Error: ${error}\nDo you want to proceed anyway?`);
    const buttons = lang === 'tr' ? ['Yine de Devam Et', 'Geri Dön'] :
      (lang === 'fr' ? ['Continuer', 'Retour'] : ['Proceed Anyway', 'Go Back']);

    const certificateDialogOptions = {
      type: 'warning',
      buttons: buttons,
      defaultId: 1,
      cancelId: 1,
      title: title,
      message: message,
      detail: detail
    };
    const certificateDialog = win && !win.isDestroyed()
      ? dialog.showMessageBox(win, certificateDialogOptions)
      : dialog.showMessageBox(certificateDialogOptions);
    certificateDialog.then(({ response }) => {
      if (response === 0) {
        const current = certificateExceptionsStore.get('exceptions') || {};
        current[host] = {
          host,
          error,
          url,
          addedAt: Date.now()
        };
        certificateExceptionsStore.set('exceptions', current);
        callback(true);
      } else {
        callback(false);
      }
    });
  });

  // Sync adblocker state
  adblock.setAdBlockEnabled(settingsStore.get('adblockEnabled'));
  adblock.setHttpsOnlyEnabled(settingsStore.get('httpsOnlyEnabled') || false);
  syncNetworkPrivacyOptions();

  // Sync adblocker callback
  adblock.setOnBlockCallback((url) => {
    const current = settingsStore.get('blockedCount') || 0;
    settingsStore.set('blockedCount', current + 1);
    windows.forEach(win => {
      sendToUI(win, 'ad-blocked', { url, total: current + 1 });
    });
  });

  // Create incognito session
  incognitoSession = session.fromPartition('incognito');

  configureProfileSession(session.defaultSession, 'default', false);
  configureProfileSession(incognitoSession, 'incognito', true);

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let isCleaningOnQuit = false;
app.on('before-quit', async (event) => {
  if (isCleaningOnQuit) return;

  const shouldClean =
    settingsStore.get('clearHistoryOnExit') ||
    settingsStore.get('clearCookiesOnExit') ||
    settingsStore.get('clearCacheOnExit') ||
    settingsStore.get('clearDownloadsOnExit') ||
    settingsStore.get('clearLocalStorageOnExit');

  if (!shouldClean) return;

  event.preventDefault();
  isCleaningOnQuit = true;

  try {
    if (settingsStore.get('clearHistoryOnExit')) {
      historyStore.set('history', []);
    }
    if (settingsStore.get('clearDownloadsOnExit')) {
      downloadsStore.set('downloads', []);
    }
    const managedSessions = getManagedSessions(false);
    if (settingsStore.get('clearCacheOnExit')) {
      await Promise.all(managedSessions.map(profileSession => profileSession.clearCache()));
    }
    const storages = [];
    if (settingsStore.get('clearCookiesOnExit')) storages.push('cookies');
    if (settingsStore.get('clearLocalStorageOnExit')) {
      storages.push('localstorage', 'indexdb', 'websql', 'filesystem', 'serviceworkers', 'cachestorage');
    }
    if (storages.length > 0) {
      await Promise.all(managedSessions.map(profileSession => profileSession.clearStorageData({ storages })));
    }
  } catch (error) {
    console.error('Failed to clear data on exit:', error);
  } finally {
    app.quit();
  }
});

// Bookmarks Export Netscape HTML
ipcMain.handle('bookmarks-export', async (event) => {
  const win = assertMainUiSender(event);
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Yer İmlerini Dışa Aktar',
    defaultPath: 'bookmarks.html',
    filters: [{ name: 'HTML Files', extensions: ['html'] }]
  });

  if (!filePath) return null;

  const bookmarks = bookmarksStore.get('bookmarks') || [];
  const fs = require('fs');

  const totalLinks = bookmarks.filter(b => !b.isFolder).length;
  const totalFolders = bookmarks.filter(b => b.isFolder).length;

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and written by XML-based bookmark parsers. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

  function writeFolder(folderId, indent) {
    const items = bookmarks.filter(b => {
      const bFolderId = b.folderId === undefined ? null : b.folderId;
      return bFolderId === folderId;
    });

    items.forEach(b => {
      const spaceStr = ' '.repeat(indent);
      if (b.isFolder) {
        html += `${spaceStr}<DT><H3 ADD_DATE="0" LAST_MODIFIED="0">${escapeHtmlText(b.title)}</H3>\n`;
        html += `${spaceStr}<DL><p>\n`;
        writeFolder(b.id, indent + 4);
        html += `${spaceStr}</DL><p>\n`;
      } else {
        const faviconAttr = b.favicon ? ` ICON="${escapeHtmlText(b.favicon)}"` : '';
        html += `${spaceStr}<DT><A HREF="${escapeHtmlText(b.url)}" ADD_DATE="0"${faviconAttr}>${escapeHtmlText(b.title)}</A>\n`;
      }
    });
  }

  writeFolder(null, 4);
  html += `</DL><p>\n`;

  fs.writeFileSync(filePath, html, 'utf-8');
  return {
    totalLinks,
    totalFolders
  };
});

// Bookmarks Import Netscape HTML Parser
ipcMain.handle('bookmarks-import', async (event) => {
  const win = assertMainUiSender(event);
  const { filePaths } = await dialog.showOpenDialog(win, {
    title: 'Yer İmlerini İçe Aktar',
    properties: ['openFile'],
    filters: [{ name: 'HTML Files', extensions: ['html'] }]
  });

  if (!filePaths || filePaths.length === 0) return null;

  const fs = require('fs');
  const html = fs.readFileSync(filePaths[0], 'utf-8');
  const lines = html.split('\n');
  const bookmarks = bookmarksStore.get('bookmarks') || [];
  const generateId = () => 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const getAttribute = (input, name) => {
    const match = input.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
    return match ? match[1] : '';
  };
  const isUsableFavicon = (value) => {
    return /^data:image\//i.test(value) || /^https?:\/\//i.test(value);
  };

  let folderStack = [null];
  let currentParentId = null;
  let linksAdded = 0;
  let foldersAdded = 0;

  lines.forEach(line => {
    line = line.trim();

    const h3Match = line.match(/<H3[^>]*>([^<]+)<\/H3>/i);
    if (h3Match) {
      const title = h3Match[1];
      const folderId = generateId();
      bookmarks.push({
        id: folderId,
        isFolder: true,
        title: title,
        folderId: currentParentId
      });
      currentParentId = folderId;
      foldersAdded++;
      return;
    }

    if (line.toUpperCase().startsWith('<DL')) {
      folderStack.push(currentParentId);
      return;
    }

    if (line.toUpperCase().startsWith('</DL')) {
      folderStack.pop();
      currentParentId = folderStack[folderStack.length - 1];
      return;
    }

    const aMatch = line.match(/<A\b([^>]*)>([^<]*)<\/A>/i);
    if (aMatch) {
      const attrs = aMatch[1] || '';
      const url = getAttribute(attrs, 'HREF');
      const title = aMatch[2] || url;
      const importedFavicon = getAttribute(attrs, 'ICON');
      const cachedFavicon = getCachedFaviconForUrl(url);
      const favicon = isUsableFavicon(importedFavicon) ? importedFavicon : cachedFavicon;

      if (url && !bookmarks.some(b => b.url === url && b.folderId === currentParentId)) {
        bookmarks.push({
          id: generateId(),
          title: title,
          url: url,
          folderId: currentParentId,
          favicon: favicon || ''
        });
        linksAdded++;
      }
    }
  });

  bookmarksStore.set('bookmarks', bookmarks);
  return {
    bookmarks,
    linksAdded,
    foldersAdded
  };
});

// Tab mute IPC
ipcMain.on('tab-mute', (event, { tabId, mute }) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-mute')) return;
  const tab = tabs[tabId];
  if (tab && tab.view) {
    tab.view.webContents.setAudioMuted(mute);
    tab.isMuted = mute;
    const win = BrowserWindow.fromWebContents(event.sender);
    sendToUI(win, 'ui-tab-updated', { id: tabId, isMuted: mute });
    saveSession();
  }
});

// Permission response
ipcMain.on('permission-response', (event, { id, decision }) => {
  if (ignoreUntrustedMainUiSender(event, 'permission-response')) return;
  const req = pendingPermissionRequests[id];
  if (req) {
    req.callback(decision);

    const saved = permissionsStore.get('permissions') || {};
    saved[`${req.domain}:${req.permission}`] = decision;
    permissionsStore.set('permissions', saved);

    delete pendingPermissionRequests[id];
  }
});

ipcMain.handle('session-get', (event) => {
  assertMainUiSender(event);
  if (!settingsStore.get('sessionRestoreEnabled')) {
    return { tabs: [], tabOrders: {} };
  }
  return {
    tabs: sessionStore.get('tabs') || [],
    tabOrders: sessionStore.get('tabOrders') || {}
  };
});

ipcMain.on('tab-set-pinned', (event, { tabId, isPinned }) => {
  if (ignoreUntrustedMainUiSender(event, 'tab-set-pinned')) return;
  const tab = tabs[tabId];
  if (tab) {
    tab.isPinned = isPinned;
    saveSession();
  }
});
