// =============================================================================
// Oslo Browser — Ghostery-powered Ad & Tracker Blocker
// =============================================================================

const { app } = require('electron');
const { ElectronBlocker, Request } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');
const path = require('path');
const fs = require('fs');

// ─── BLOCKED DOMAINS FOR VIDEO PROVIDER BYPASS ────────────────────────────────
const blockedDomains = [
  'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 'adservice.google.com',
  'adsterra.com', 'adsterrasrv.com', 'adsterratrack.com', 'adsterracdn.com', 'adsterragate.com',
  'monetag.com', 'monetizedlt.com', 'onclickperformance.com', 'realsrv.com',
  'juicyads.com', 'juicyads.net', 'exdynsrv.com', 'exosrv.com',
  'popads.net', 'onclickads.net', 'exoclick.com', 'trafficjunky.com', 'trafficjunky.net',
  'adcash.com', 'popcash.net', 'popunder.net', 'clickadu.com', 'hilltopads.net', 'richads.com'
];

// ─── TRACKER DOMAINS (for 3rd-party cookie/header stripping only) ──────────────
const trackerDomains = [
  'facebook.com',
  'facebook.net',
  'fbcdn.net',
  'twitter.com',
  'linkedin.com',
  'instagram.com',
  'tiktok.com',
  'pinterest.com',
  'reddit.com',
  'snapchat.com',
  'amazon.com',
  'yahoo.com',
  'bing.com',
  'microsoft.com',
];

// ─── STATE ──────────────────────────────────────────────────────────────────────
let adBlockEnabled = true;
let onBlockCallback = null;
let httpsOnlyEnabled = false;
let privacyOptions = {
  cookiePolicy: 'block-third-party',
  trackingProtectionLevel: 'balanced',
  fingerprintProtection: true,
  refererPolicy: 'cross-origin',
  globalPrivacyControl: true,
  incognitoBlockThirdPartyCookies: true,
  httpsOnlyExceptions: ''
};

// Ghostery Blocker Instance & Initialization State
let blockerInstance = null;
let initializationPromise = null;

function getBlockerCachePath() {
  return path.join(app.getPath('userData'), 'adblock_cache.bin');
}

function initializeBlocker() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      const cachePath = getBlockerCachePath();
      blockerInstance = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
        path: cachePath,
        read: fs.promises.readFile,
        write: fs.promises.writeFile,
      });
    } catch (e) {
      console.error('[Adblock] Failed to initialize Ghostery blocker:', e);
      try {
        blockerInstance = await ElectronBlocker.empty();
      } catch (err) { }
    }
  })();

  return initializationPromise;
}

// ─── DOMAIN MATCHING ────────────────────────────────────────────────────────────
function isBlockedDomain(hostname) {
  const lowerHost = hostname.toLowerCase();
  for (const domain of blockedDomains) {
    if (lowerHost === domain || lowerHost.endsWith('.' + domain)) {
      return true;
    }
  }
  return false;
}

function isTrackerDomain(hostname) {
  const lowerHost = hostname.toLowerCase();
  for (const domain of trackerDomains) {
    if (lowerHost === domain || lowerHost.endsWith('.' + domain)) {
      return true;
    }
  }
  return false;
}

function setPrivacyOptions(options = {}) {
  privacyOptions = { ...privacyOptions, ...options };
}

function getHttpsOnlyExceptions() {
  return String(privacyOptions.httpsOnlyExceptions || '')
    .split(/[\n,;]+/)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function isHttpsOnlyException(hostname) {
  const host = String(hostname || '').toLowerCase();
  return getHttpsOnlyExceptions().some(item => host === item || host.endsWith('.' + item));
}

function getHostnameFromValue(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch (e) {
    return String(value || '').replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
  }
}

function getUrlParts(value) {
  try {
    const parsed = new URL(value);
    return {
      hostname: parsed.hostname.toLowerCase(),
      pathname: parsed.pathname || '',
      href: parsed.href || ''
    };
  } catch (e) {
    return {
      hostname: getHostnameFromValue(value),
      pathname: '',
      href: String(value || '')
    };
  }
}

function isGoogleTldHost(hostname, prefix = '') {
  const host = String(hostname || '').toLowerCase();
  if (!prefix) {
    return /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host);
  }
  const escapedPrefix = prefix.replace(/\./g, '\\.') + '\\.';
  return new RegExp(`^${escapedPrefix}google\\.[a-z]{2,3}(\\.[a-z]{2})?$`).test(host);
}

function isGoogleAuthUrl(value) {
  const { hostname, pathname, href } = getUrlParts(value);
  if (!hostname) return false;

  const authHosts = [
    'accounts.youtube.com',
    'apis.google.com',
    'oauth2.googleapis.com',
    'oauthaccountmanager.googleapis.com',
    'ssl.gstatic.com',
    'www.gstatic.com',
    'accounts.gstatic.com',
    'clients1.google.com',
    'clients2.google.com',
    'clients3.google.com',
    'clients4.google.com',
    'clients5.google.com',
    'clients6.google.com'
  ];

  if (isGoogleTldHost(hostname, 'accounts') || isGoogleTldHost(hostname, 'myaccount') ||
    authHosts.some(host => hostname === host || hostname.endsWith('.' + host)) ||
    hostname === 'googleusercontent.com' || hostname.endsWith('.googleusercontent.com')) {
    return true;
  }

  if (isGoogleTldHost(hostname) || hostname.endsWith('.google.com')) {
    return /\/(?:signin|servicelogin|accountchooser|interactivelogin|o\/oauth2|oauth)/i.test(pathname) ||
      /[?&](?:continue|redirect_uri)=/i.test(href) && /accounts\.google|oauth/i.test(href);
  }

  return false;
}

function getBaseDomain(hostname) {
  const parts = String(hostname || '').split('.');
  if (parts.length <= 2) return hostname;
  const ccSlds = ['com', 'co', 'gov', 'org', 'net', 'edu', 'mil'];
  const sld = parts[parts.length - 2];
  if (ccSlds.includes(sld) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

// Related Website Sets — domains that belong to the same organization and should
// be treated as first-party for cookie and header purposes.
const relatedDomainSets = [
  // Google ecosystem
  new Set([
    'google.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com',
    'googlevideo.com', 'youtube.com', 'ytimg.com', 'youtu.be',
    'google.com.tr', 'google.co.uk', 'google.de', 'google.fr',
    'google.es', 'google.it', 'google.co.jp', 'google.com.br',
    'google.ca', 'google.com.au', 'google.co.in', 'google.ru',
    'google.nl', 'google.pl', 'google.co.kr', 'google.com.mx',
    'google.com.ar', 'google.co.za', 'google.com.eg',
  ]),
  // Microsoft ecosystem
  new Set(['microsoft.com', 'microsoftonline.com', 'live.com', 'bing.com', 'msn.com', 'office.com']),
];

function getRelatedSetId(hostname) {
  const base = getBaseDomain(hostname);
  for (let i = 0; i < relatedDomainSets.length; i++) {
    if (relatedDomainSets[i].has(base)) return i;
  }
  return -1;
}

function getRequestContext(details) {
  let requestHostname = '';
  let initiatorHostname = '';
  try {
    requestHostname = new URL(details.url).hostname.toLowerCase();
  } catch (e) { }
  try {
    const source = details.initiator || details.referrer || '';
    if (source) initiatorHostname = new URL(source).hostname.toLowerCase();
  } catch (e) { }

  const requestBase = getBaseDomain(requestHostname);
  const initiatorBase = initiatorHostname ? getBaseDomain(initiatorHostname) : '';

  let isThirdParty;
  if (!initiatorBase) {
    isThirdParty = details.resourceType !== 'mainFrame';
  } else if (requestBase === initiatorBase) {
    isThirdParty = false;
  } else {
    // Check related domain sets (e.g. google.com <-> googleapis.com)
    const reqSetId = getRelatedSetId(requestHostname);
    const initSetId = getRelatedSetId(initiatorHostname);
    isThirdParty = reqSetId < 0 || reqSetId !== initSetId;
  }

  return { requestHostname, initiatorHostname, isThirdParty };
}

// ─── RESOURCE TYPE CONVERSION ──────────────────────────────────────────────────
function convertResourceType(electronType) {
  switch (electronType) {
    case 'mainFrame': return 'document';
    case 'subFrame': return 'subdocument';
    case 'stylesheet': return 'stylesheet';
    case 'script': return 'script';
    case 'image': return 'image';
    case 'font': return 'font';
    case 'object': return 'object';
    case 'xhr': return 'xmlhttprequest';
    case 'ping': return 'ping';
    case 'media': return 'media';
    case 'websocket': return 'websocket';
    case 'popup': return 'popup';
    default: return 'other';
  }
}

// ─── VIDEO PROVIDER DETECTION ──────────────────────────────────────────────────
function isVideoProvider(host) {
  if (!host) return false;
  const lowerHost = host.toLowerCase();
  return lowerHost.includes('closeload') ||
    lowerHost.includes('vidmoly') ||
    lowerHost.includes('mixdrop') ||
    lowerHost.includes('upstream') ||
    lowerHost.includes('fembed') ||
    lowerHost.includes('ok.ru') ||
    lowerHost.includes('vk.com') ||
    lowerHost.includes('mail.ru') ||
    lowerHost.includes('vimeo.com') ||
    lowerHost.includes('dailymotion.com') ||
    lowerHost.includes('rutube') ||
    lowerHost.includes('rapidvideo') ||
    lowerHost.includes('openload') ||
    lowerHost.includes('streamtape') ||
    lowerHost.includes('doodstream') ||
    lowerHost.includes('dood.') ||
    lowerHost.includes('voe.sx') ||
    lowerHost.includes('voe-player') ||
    lowerHost.includes('waaw') ||
    lowerHost.includes('vidoza') ||
    lowerHost.includes('supervideo') ||
    lowerHost.includes('turbovid');
}

function isGoogleAuth(urlStr, initiatorStr) {
  return isGoogleAuthUrl(urlStr) || isGoogleAuthUrl(initiatorStr);
}

function getHeaderValue(headers, name) {
  const target = String(name || '').toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === target);
  return entry ? String(entry[1] || '') : '';
}

function getChromeVersionsFromHeaders(headers) {
  const ua = getHeaderValue(headers, 'user-agent');
  const secChUa = getHeaderValue(headers, 'sec-ch-ua');
  const secChFullVersionList = getHeaderValue(headers, 'sec-ch-ua-full-version-list');
  const uaVersion = ua.match(/(?:Chrome|Chromium)\/([0-9.]+)/i)?.[1] || '';
  const secMajor = secChUa.match(/"Chromium";v="(\d+)"/i)?.[1] ||
    secChUa.match(/"Google Chrome";v="(\d+)"/i)?.[1] || '';
  const secFull = secChFullVersionList.match(/"Chromium";v="([^"]+)"/i)?.[1] ||
    secChFullVersionList.match(/"Google Chrome";v="([^"]+)"/i)?.[1] || '';
  const full = secFull || uaVersion || '148.0.0.0';
  const major = secMajor || full.split('.')[0] || '148';
  const paddedFull = full.includes('.') ? full : `${major}.0.0.0`;
  return { major, full: paddedFull };
}

function buildChromeClientHintHeaders(headers) {
  const { major, full } = getChromeVersionsFromHeaders(headers);
  return {
    brands: `"Google Chrome";v="${major}", "Chromium";v="${major}", "Not-A.Brand";v="24"`,
    fullVersionList: `"Google Chrome";v="${full}", "Chromium";v="${full}", "Not-A.Brand";v="24.0.0.0"`
  };
}

// ─── MAIN BLOCKING DECISION ─────────────────────────────────────────────────────
function shouldBlock(url, resourceType, initiator, referrer) {
  try {
    const lowerUrl = url.toLowerCase();

    // 0. NEVER block Google Auth requests
    if (isGoogleAuth(url, initiator || referrer)) {
      return false;
    }

    // Bypass local protocols
    if (lowerUrl.startsWith('oslo://') || lowerUrl.startsWith('file://') ||
      lowerUrl.startsWith('chrome://') || lowerUrl.startsWith('devtools://') ||
      lowerUrl.startsWith('chrome-extension://') || lowerUrl.startsWith('about:')) {
      return false;
    }

    // 0. NEVER block top-level document/navigation requests (mainFrame)
    if (resourceType === 'mainFrame') {
      return false;
    }

    if (!adBlockEnabled) {
      return false;
    }

    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const fullUrl = parsed.href.toLowerCase();

    // Video provider checks:
    // 1. If target hostname is a known video provider, allow the request entirely.
    if (isVideoProvider(hostname)) {
      return false;
    }

    // Extract initiator/referrer hostname
    let initiatorHost = '';
    const source = initiator || referrer || '';
    if (source) {
      try {
        initiatorHost = new URL(source).hostname.toLowerCase();
      } catch (e) {
        initiatorHost = String(source).replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
      }
    }

    // 2. If the request was initiated by a video provider, and it's NOT a popup:
    if (resourceType !== 'popup' && isVideoProvider(initiatorHost)) {
      // If the target hostname is in our explicit blocked domains list, block it.
      if (isBlockedDomain(hostname)) {
        return true;
      }
      // Otherwise, allow the request (bypass all subsequent path & keyword checks).
      return false;
    }

    const isGoogle = hostname === 'google.com' || hostname.endsWith('.google.com') || /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(hostname);
    const isYouTube = hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'youtu.be' || hostname.endsWith('.youtu.be');

    // Allow Google ecosystem requests if initiated by Google (fixes Google AI Mode/SGE)
    if (source) {
      const isGoogleInitiated = initiatorHost === 'google.com' ||
        initiatorHost.endsWith('.google.com') ||
        /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(initiatorHost);

      if (isGoogleInitiated) {
        const isTargetGoogle = isGoogle ||
          hostname.endsWith('.googleadservices.com') ||
          hostname.endsWith('.googletagmanager.com') ||
          hostname.endsWith('.google-analytics.com') ||
          hostname.endsWith('.googlesyndication.com') ||
          hostname.endsWith('.doubleclick.net') ||
          /(^|\.)youtube\.[a-z]{2,3}(\.[a-z]{2})?$/.test(hostname) ||
          hostname.endsWith('.googleapis.com') ||
          hostname.endsWith('.gstatic.com') ||
          hostname.endsWith('.ggpht.com') ||
          hostname.endsWith('.googleusercontent.com');

        if (isTargetGoogle) {
          return false;
        }
      }
    }

    // EFF Cover Your Tracks simulator domains:
    // If the hostname belongs to EFF test tracker domains, block them for sub-resources.
    const isEffDomain = hostname === 'trackersimulator.org' || hostname.endsWith('.trackersimulator.org') ||
      hostname === 'eviltracker.net' || hostname.endsWith('.eviltracker.net') ||
      hostname === 'do-not-tracker.org' || hostname.endsWith('.do-not-tracker.org') ||
      hostname === 'firstpartysimulator.org' || hostname.endsWith('.firstpartysimulator.org') ||
      hostname === 'firstpartysimulator.net' || hostname.endsWith('.firstpartysimulator.net');

    if (isEffDomain) {
      return true;
    }

    // 3. Delegate to Ghostery Block Engine (if initialized)
    if (blockerInstance) {
      const request = Request.fromRawDetails({
        url: url,
        type: convertResourceType(resourceType),
        sourceUrl: source || undefined
      });
      const matchResult = blockerInstance.match(request);
      if (matchResult && matchResult.match) {
        return true;
      }
    }

  } catch (e) {
    console.error('[Adblock] Error in shouldBlock:', e);
  }
  return false;
}

// ─── TRACKING HEADER STRIPPING (onBeforeSendHeaders) ────────────────────────────
function setupTrackingHeaderStripping(sessionInstance, sessionKind = 'default') {
  sessionInstance.webRequest.onBeforeSendHeaders(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      try {
        const parsed = new URL(details.url);
        const hostname = parsed.hostname.toLowerCase();
        const { isThirdParty } = getRequestContext(details);
        const newHeaders = {};
        let modified = false;
        const cookiePolicy = privacyOptions.cookiePolicy || 'allow';
        const shouldBlockThirdPartyCookie =
          cookiePolicy === 'block-third-party' ||
          (sessionKind === 'incognito' && privacyOptions.incognitoBlockThirdPartyCookies !== false);
        const isTracker = isTrackerDomain(hostname) || isBlockedDomain(hostname);

        const isAuthGoogle = isGoogleAuth(details.url, details.initiator || details.referrer);
        if (isAuthGoogle) {
          callback({});
          return;
        }

        for (const [key, value] of Object.entries(details.requestHeaders || {})) {
          const lowerKey = key.toLowerCase();

          // Rewrite sec-ch-ua headers to include "Google Chrome" brand.
          // Electron/Chromium omits it, which some sites use to reject sign-in.
          if (lowerKey === 'sec-ch-ua') {
            newHeaders[key] = buildChromeClientHintHeaders(details.requestHeaders).brands;
            modified = true;
            continue;
          }
          if (lowerKey === 'sec-ch-ua-full-version-list') {
            newHeaders[key] = buildChromeClientHintHeaders(details.requestHeaders).fullVersionList;
            modified = true;
            continue;
          }

          if (lowerKey === 'cookie' && (cookiePolicy === 'block-all' || (isThirdParty && shouldBlockThirdPartyCookie))) {
            modified = true;
            continue;
          }

          if (lowerKey === 'referer') {
            if (privacyOptions.refererPolicy === 'strict') {
              modified = true;
              continue;
            }

            if (privacyOptions.refererPolicy === 'cross-origin' && isThirdParty) {
              modified = true;
              continue;
            }

            if (privacyOptions.refererPolicy === 'origin-only') {
              try {
                const origin = new URL(value).origin + '/';
                newHeaders[key] = origin;
                modified = origin !== value;
                continue;
              } catch (e) { }
            }
          }

          if ((privacyOptions.trackingProtectionLevel !== 'off' || adBlockEnabled) &&
            isThirdParty && isTracker &&
            lowerKey === 'x-client-data') {
            modified = true;
            continue;
          }

          newHeaders[key] = value;
        }

        if (privacyOptions.globalPrivacyControl || privacyOptions.fingerprintProtection) {
          newHeaders.DNT = '1';
          newHeaders['Sec-GPC'] = '1';
          modified = true;
        }

        if (modified) {
          callback({ requestHeaders: newHeaders });
          return;
        }
      } catch (e) {
        // On any error, just pass through
      }
      callback({});
    }
  );
}

// ─── RESPONSE HEADER MANIPULATION (onHeadersReceived) ───────────────────────────
function setupResponseHeaderManipulation(sessionInstance, sessionKind = 'default') {
  sessionInstance.webRequest.onHeadersReceived(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      try {
        const parsed = new URL(details.url);
        const hostname = parsed.hostname.toLowerCase();

        if (isGoogleAuth(details.url, details.initiator || details.referrer)) {
          callback({});
          return;
        }

        const isYouTube = hostname.includes('youtube.com') || hostname.includes('youtu.be');
        const { isThirdParty } = getRequestContext(details);
        const isTracker = isTrackerDomain(hostname) || isBlockedDomain(hostname);
        const cookiePolicy = privacyOptions.cookiePolicy || 'allow';
        const shouldBlockThirdPartyCookie =
          cookiePolicy === 'block-third-party' ||
          (sessionKind === 'incognito' && privacyOptions.incognitoBlockThirdPartyCookies !== false);

        const shouldModify = isYouTube ||
          cookiePolicy !== 'allow' ||
          (sessionKind === 'incognito' && privacyOptions.incognitoBlockThirdPartyCookies !== false) ||
          ((privacyOptions.trackingProtectionLevel !== 'off' || adBlockEnabled) && isThirdParty && isTracker);
        if (!shouldModify) {
          callback({});
          return;
        }

        const headers = details.responseHeaders;
        if (!headers) {
          callback({});
          return;
        }

        const newHeaders = {};
        let modified = false;

        for (const [key, value] of Object.entries(headers)) {
          const lowerKey = key.toLowerCase();

          // Remove CSP headers on YouTube to allow preload script main-world insertions
          if (isYouTube && (lowerKey === 'content-security-policy' ||
            lowerKey === 'content-security-policy-report-only' ||
            lowerKey === 'x-content-security-policy')) {
            modified = true;
            continue;
          }

          if (lowerKey === 'set-cookie' && (cookiePolicy === 'block-all' || (isThirdParty && shouldBlockThirdPartyCookie))) {
            modified = true;
            continue;
          }

          // Block Set-Cookie from third-party tracker domains
          if ((privacyOptions.trackingProtectionLevel !== 'off' || adBlockEnabled) && isThirdParty && isTracker && lowerKey === 'set-cookie') {
            modified = true;
            continue;
          }

          // Block ETag-based tracking
          if ((privacyOptions.trackingProtectionLevel !== 'off' || privacyOptions.fingerprintProtection) && isTracker && lowerKey === 'etag') {
            modified = true;
            continue;
          }

          newHeaders[key] = value;
        }

        if (modified) {
          callback({ responseHeaders: newHeaders });
          return;
        }
      } catch (e) {
        // On any error, just pass through
      }
      callback({});
    }
  );
}

// ─── SETUP ──────────────────────────────────────────────────────────────────────
function setupAdBlocker(sessionInstance, sessionKind = 'default') {
  // Trigger blocker initialization
  initializeBlocker();

  // Layer 1: Network-level request blocking
  sessionInstance.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (details, callback) => {
      // 1. HTTPS-Only Redirect
      if (httpsOnlyEnabled && details.url.startsWith('http://')) {
        try {
          const parsedUrl = new URL(details.url);
          if (parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1' && !isHttpsOnlyException(parsedUrl.hostname)) {
            callback({ redirectURL: details.url.replace('http://', 'https://') });
            return;
          }
        } catch (e) { }
      }

      // 2. AdBlocking
      if (shouldBlock(details.url, details.resourceType, details.initiator, details.referrer)) {
        if (onBlockCallback) {
          onBlockCallback(details.url, details);
        }
        callback({ cancel: true });
      } else {
        callback({ cancel: false });
      }
    }
  );

  // Layer 2: Tracking header stripping
  setupTrackingHeaderStripping(sessionInstance, sessionKind);

  // Layer 3: Response header manipulation
  setupResponseHeaderManipulation(sessionInstance, sessionKind);
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────────
function setOnBlockCallback(callback) {
  onBlockCallback = callback;
}

function setHttpsOnlyEnabled(enabled) {
  httpsOnlyEnabled = enabled;
}

function setAdBlockEnabled(enabled) {
  adBlockEnabled = enabled;
}

function isAdBlockEnabled() {
  return adBlockEnabled;
}

module.exports = {
  setupAdBlocker,
  shouldBlock,
  setAdBlockEnabled,
  isAdBlockEnabled,
  setOnBlockCallback,
  setHttpsOnlyEnabled,
  setPrivacyOptions,
  isGoogleAuth
};
