const { contextBridge, ipcRenderer, webFrame } = require('electron');

function getPageHostname() {
  try {
    return window.location.hostname.toLowerCase();
  } catch (e) {
    return '';
  }
}

function isGoogleSensitiveHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'google.com' || host.endsWith('.google.com') ||
    /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host) ||
    host === 'gstatic.com' || host.endsWith('.gstatic.com') ||
    host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com') ||
    host === 'googleapis.com' || host.endsWith('.googleapis.com') ||
    host === 'recaptcha.net' || host.endsWith('.recaptcha.net');
}

function isGoogleAuthHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return /^(accounts|myaccount)\.google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host) ||
    host === 'accounts.youtube.com' ||
    host === 'apis.google.com' ||
    host === 'oauth2.googleapis.com' ||
    host === 'oauthaccountmanager.googleapis.com' ||
    host === 'accounts.gstatic.com';
}

function getChromeVersionInfo() {
  const full = (navigator.userAgent.match(/(?:Chrome|Chromium)\/([0-9.]+)/) || ['', '148.0.0.0'])[1];
  const major = full.split('.')[0] || '148';
  return {
    major,
    full: full.includes('.') ? full : `${major}.0.0.0`
  };
}

try {
  const pageHostname = getPageHostname();
  if (!isGoogleSensitiveHost(pageHostname)) {
    const chromeVersion = getChromeVersionInfo();
    const scriptContent = `
      try {
        const ver = '${chromeVersion.major}';
        const fullVer = '${chromeVersion.full}';
        const brands = [
          { brand: "Google Chrome", version: ver },
          { brand: "Chromium", version: ver },
          { brand: "Not-A.Brand", version: "24" }
        ];
        const uaData = {
          brands: brands,
          mobile: false,
          platform: "Windows",
          getHighEntropyValues: function(hints) {
            return Promise.resolve({
              brands: brands,
              mobile: false,
              platform: "Windows",
              platformVersion: "15.0.0",
              architecture: "x86",
              bitness: "64",
              model: "",
              uaFullVersion: fullVer,
              fullVersionList: brands.map(function(b) {
                return {
                  brand: b.brand,
                  version: b.brand === "Not-A.Brand" ? "24.0.0.0" : fullVer
                };
              })
            });
          },
          toJSON: function() {
            return { brands: brands, mobile: false, platform: "Windows" };
          }
        };
        Object.defineProperty(navigator, 'userAgentData', {
          get: function() { return uaData; },
          configurable: true
        });
      } catch (e) {}
    `;

    const script = document.createElement('script');
    script.textContent = scriptContent;
    if (document.documentElement) {
      document.documentElement.appendChild(script);
      script.remove();
    } else {
      webFrame.executeJavaScript(scriptContent);
    }
  }
} catch (e) { }

// ─── COSMETIC FILTER CSS ────────────────────────────────────────────────────────
const cosmeticFilterCSS = `
  [id*="google_ads"],
  [id*="GoogleAds"],
  [class*="GoogleAds"],
  #ad-container, .ad-container,
  [id*="-ad-container"], [class*="-ad-container"],
  [id*="_ad-container"], [class*="_ad-container"],
  [id^="ad-container-"], [class^="ad-container-"],
  [id^="ad_container_"], [class^="ad_container_"],
  #ad_container, .ad_container,
  [id*="-ad_container"], [class*="-ad_container"],
  [id*="_ad_container"], [class*="_ad_container"],
  #adBanner, .adBanner,
  [id*="-adBanner"], [class*="-adBanner"],
  [id*="_adBanner"], [class*="_adBanner"],
  [id^="adBanner-"], [class^="adBanner-"],
  #ad-banner, .ad-banner,
  [id*="-ad-banner"], [class*="-ad-banner"],
  [id*="_ad-banner"], [class*="_ad-banner"],
  [id^="ad-banner-"], [class^="ad-banner-"],
  #ad_banner, .ad_banner,
  [id*="-ad_banner"], [class*="-ad_banner"],
  [id*="_ad_banner"], [class*="_ad_banner"],
  [data-ad],
  [data-ad-slot],
  [data-ad-client],
  [data-ad-manager-id],
  ins.adsbygoogle,
  div[id^="div-gpt-ad"],
  iframe[src*="doubleclick.net"],
  iframe[src*="googlesyndication"],
  iframe[src*="googleadservices.com"],
  iframe[src*="googletagmanager.com"],
  iframe[src*="adnxs.com"],
  iframe[src*="taboola.com"],
  iframe[src*="outbrain.com"],
  iframe[src*="criteo"],
  iframe[src*="amazon-adsystem"],
  iframe[src*="popads.net"],
  iframe[src*="exoclick.com"],
  iframe[src*="buysellads.com"],
  iframe[src*="adsterra.com"],
  iframe[src*="monetag.com"],
  iframe[src*="propellerads.com"],
  iframe[src*="exdynsrv.com"],
  iframe[src*="exosrv.com"],
  iframe[id*="google_ads"],
  iframe[name*="google_ads"],
  .adsbygoogle,
  .ad-slot,
  .sponsored-content,
  .native-ad,
  .promoted-content,
  a[href*="doubleclick.net"],

  /* YouTube */
  .ad-showing .video-ads,
  .ytp-ad-module,
  .ytp-ad-overlay-container,
  .ytp-ad-text-overlay,
  .ytp-ad-overlay-close-button,
  .ytp-ad-overlay-ad-info-button-container,
  .ytp-ad-overlay-slot,
  .ytp-ad-image-overlay,
  .ytp-ad-overlay-image,
  #player-ads,
  #masthead-ad,
  #merch-shelf,
  #offer-module,
  #movie-offer,
  #sparkles-container,
  ytd-ad-slot-renderer,
  ytd-rich-item-renderer:has(.ytd-ad-slot-renderer),
  ytd-in-feed-ad-layout-renderer,
  ytd-banner-promo-renderer,
  ytd-video-masthead-ad-v3-renderer,
  ytd-video-masthead-ad-advertiser-info-renderer,
  ytd-primetime-promo-renderer,
  ytd-display-ad-renderer,
  ytd-statement-banner-renderer,
  ytd-promoted-sparkles-text-search-renderer,
  ytd-promoted-video-renderer,
  ytd-compact-promoted-video-renderer,
  ytd-promoted-sparkles-web-renderer,
  ytd-action-companion-ad-renderer,
  ytd-player-legacy-desktop-watch-ads-renderer,
  ytm-promoted-sparkles-web-renderer,
  ytm-companion-ad-renderer,
  .ytd-mealbar-promo-renderer,
  ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
  #related ytd-promoted-video-renderer,
  tp-yt-paper-dialog:has(#dismiss-button),
  .ytp-suggested-action,
  .iv-branding,
  .annotation,
  .ytp-ce-element,
  ytd-movie-offer-module-renderer
  { display: none !important; }
`;

// ─── ANTI-FINGERPRINTING SHIELD ─────────────────────────────────────────────────
function runAntiFingerprint() {
  'use strict';
  if (window.__osloAntiFingerprintActive) return;
  window.__osloAntiFingerprintActive = true;

  // ── Noise seed (random per page load) ──
  const seed = Math.random() * 10000;
  function noise(x) {
    const n = Math.sin(seed + x) * 10000;
    return n - Math.floor(n);
  }

  // ── Canvas Fingerprint Protection ──
  try {
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (sx, sy, sw, sh) {
      const imageData = origGetImageData.call(this, sx, sy, sw, sh);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (noise(i + seed) > 0.9) {
          data[i] = Math.max(0, Math.min(255, data[i] + (noise(i) > 0.5 ? 1 : -1)));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (noise(i + 1) > 0.5 ? 1 : -1)));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (noise(i + 2) > 0.5 ? 1 : -1)));
        }
      }
      return imageData;
    };

    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (type, quality) {
      const ctx = this.getContext('2d');
      if (ctx) {
        try {
          const w = this.width, h = this.height;
          if (w > 0 && h > 0) {
            const imgData = ctx.getImageData(0, 0, w, h);
            ctx.putImageData(imgData, 0, 0);
          }
        } catch (e) { }
      }
      return origToDataURL.call(this, type, quality);
    };

    const origToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      const ctx = this.getContext('2d');
      if (ctx) {
        try {
          const w = this.width, h = this.height;
          if (w > 0 && h > 0) {
            const imgData = ctx.getImageData(0, 0, w, h);
            ctx.putImageData(imgData, 0, 0);
          }
        } catch (e) { }
      }
      return origToBlob.call(this, callback, type, quality);
    };
  } catch (e) { }

  // ── WebGL Fingerprint Protection ──
  try {
    const origGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (param) {
      // UNMASKED_VENDOR_WEBGL
      if (param === 0x9245) return 'Google Inc. (Intel)';
      // UNMASKED_RENDERER_WEBGL
      if (param === 0x9246) return 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)';
      return origGetParameter.call(this, param);
    };

    const origGetExtension = WebGLRenderingContext.prototype.getExtension;
    WebGLRenderingContext.prototype.getExtension = function (name) {
      if (name === 'WEBGL_debug_renderer_info') {
        return {
          UNMASKED_VENDOR_WEBGL: 0x9245,
          UNMASKED_RENDERER_WEBGL: 0x9246
        };
      }
      return origGetExtension.call(this, name);
    };

    const origReadPixels = WebGLRenderingContext.prototype.readPixels;
    WebGLRenderingContext.prototype.readPixels = function (x, y, width, height, format, type, pixels) {
      origReadPixels.call(this, x, y, width, height, format, type, pixels);
      for (let i = 0; i < pixels.length; i++) {
        if (noise(i + seed) > 0.95) {
          pixels[i] = Math.max(0, Math.min(255, pixels[i] + (noise(i) > 0.5 ? 1 : -1)));
        }
      }
    };

    if (typeof WebGL2RenderingContext !== 'undefined') {
      const origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (param) {
        if (param === 0x9245) return 'Google Inc. (Intel)';
        if (param === 0x9246) return 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)';
        return origGetParameter2.call(this, param);
      };

      const origGetExtension2 = WebGL2RenderingContext.prototype.getExtension;
      WebGL2RenderingContext.prototype.getExtension = function (name) {
        if (name === 'WEBGL_debug_renderer_info') {
          return {
            UNMASKED_VENDOR_WEBGL: 0x9245,
            UNMASKED_RENDERER_WEBGL: 0x9246
          };
        }
        return origGetExtension2.call(this, name);
      };

      const origReadPixels2 = WebGL2RenderingContext.prototype.readPixels;
      WebGL2RenderingContext.prototype.readPixels = function (x, y, width, height, format, type, pixels) {
        origReadPixels2.call(this, x, y, width, height, format, type, pixels);
        for (let i = 0; i < pixels.length; i++) {
          if (noise(i + seed) > 0.95) {
            pixels[i] = Math.max(0, Math.min(255, pixels[i] + (noise(i) > 0.5 ? 1 : -1)));
          }
        }
      };
    }
  } catch (e) { }

  // ── AudioContext Fingerprint Protection ──
  try {
    const AC = typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);
    if (AC) {
      const origCreateAnalyser = AC.prototype.createAnalyser;
      AC.prototype.createAnalyser = function () {
        const analyser = origCreateAnalyser.call(this);
        const origGetFloatFreqData = analyser.getFloatFrequencyData.bind(analyser);
        analyser.getFloatFrequencyData = function (array) {
          origGetFloatFreqData(array);
          for (let i = 0; i < array.length; i++) {
            array[i] += (noise(i + seed) - 0.5) * 0.1;
          }
        };
        return analyser;
      };

      if (typeof OfflineAudioContext !== 'undefined') {
        const origRender = OfflineAudioContext.prototype.startRendering;
        OfflineAudioContext.prototype.startRendering = function () {
          return origRender.call(this).then(buffer => {
            for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
              const data = buffer.getChannelData(ch);
              for (let i = 0; i < data.length; i++) {
                data[i] += (noise(i + ch * 1000 + seed) - 0.5) * 0.0001;
              }
            }
            return buffer;
          });
        };
      }
    }
  } catch (e) { }

  // ── Navigator properties spoofing ──
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  } catch (e) { }
  try {
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  } catch (e) { }
  try {
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const mimes = [
          { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format" }
        ];
        const mockPlugin = {
          name: "Chrome PDF Viewer",
          filename: "internal-pdf-viewer",
          description: "Portable Document Format",
          length: mimes.length,
          item: (index) => mimes[index],
          namedItem: (name) => mimes.find(m => m.type === name)
        };
        return {
          length: 1,
          item: (index) => index === 0 ? mockPlugin : null,
          namedItem: (name) => name === "Chrome PDF Viewer" ? mockPlugin : null,
          refresh: () => { },
          [Symbol.iterator]: function* () { yield mockPlugin; }
        };
      }
    });
  } catch (e) { }
  try {
    Object.defineProperty(navigator, 'mimeTypes', {
      get: () => {
        const mockMime = {
          type: "application/pdf",
          suffixes: "pdf",
          description: "Portable Document Format",
          enabledPlugin: { name: "Chrome PDF Viewer" }
        };
        return {
          length: 1,
          item: (index) => index === 0 ? mockMime : null,
          namedItem: (name) => name === "application/pdf" ? mockMime : null,
          [Symbol.iterator]: function* () { yield mockMime; }
        };
      }
    });
  } catch (e) { }

  // ── Screen resolution spoofing ──
  try {
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
  } catch (e) { }

  // ── Battery API blocking ──
  if (navigator.getBattery) {
    navigator.getBattery = () => Promise.reject(new Error('Battery API is not available'));
  }

  // ── Block sendBeacon to known trackers ──
  try {
    const origSendBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function (url, data) {
      if (typeof url === 'string') {
        const l = url.toLowerCase();
        if (l.includes('google-analytics') || l.includes('doubleclick') ||
          l.includes('googlesyndication') || l.includes('googletagmanager') ||
          l.includes('facebook.net') || l.includes('analytics') ||
          l.includes('/collect') || l.includes('/beacon') ||
          l.includes('scorecardresearch') || l.includes('quantserve') ||
          l.includes('comscore') || l.includes('demdex') ||
          l.includes('bluekai') || l.includes('krxd') ||
          l.includes('moatads') || l.includes('doubleverify')) {
          return true; // Pretend it was sent successfully
        }
      }
      return origSendBeacon.call(navigator, url, data);
    };
  } catch (e) { }

  // ── Prevent WebRTC IP leak (basic) ──
  try {
    if (typeof RTCPeerConnection !== 'undefined') {
      const origRTC = RTCPeerConnection;
      window.RTCPeerConnection = function (config, constraints) {
        const pc = new origRTC(config, constraints);
        return pc;
      };
      window.RTCPeerConnection.prototype = origRTC.prototype;
    }
  } catch (e) { }
}

// ─── GENERIC AD BLOCKER SCRIPT ──────────────────────────────────────────────────
function runGenericAdBlocker() {
  'use strict';
  if (window.__osloGenericAdBlockActive) return;
  window.__osloGenericAdBlockActive = true;

  function cleanAds() {
    try {
      document.querySelectorAll('iframe').forEach(iframe => {
        try {
          const src = (iframe.src || '').toLowerCase();

          // Safeguard: Never delete iframes belonging to popular video hosting/player providers
          const isVideoProvider = src.includes('youtube.com') || src.includes('youtu.be') ||
            src.includes('vimeo.com') || src.includes('dailymotion.com') ||
            src.includes('closeload') || src.includes('vidmoly') ||
            src.includes('mixdrop') || src.includes('upstream') ||
            src.includes('fembed') || src.includes('ok.ru') ||
            src.includes('vk.com') || src.includes('mail.ru');

          if (!isVideoProvider && (
            src.includes('doubleclick.net') || src.includes('googlesyndication.com') ||
            src.includes('googleadservices.com') || src.includes('adnxs.com') ||
            src.includes('taboola.com') || src.includes('outbrain.com') ||
            src.includes('criteo') || src.includes('amazon-adsystem') ||
            src.includes('popads.net') || src.includes('exoclick.com') ||
            src.includes('buysellads.com') || src.includes('/ads/') ||
            src.includes('/pagead/')
          )) {
            iframe.remove();
          }
        } catch (e) { }
      });
      document.querySelectorAll('[data-ad], [data-ad-slot], [data-ad-client]').forEach(el => el.remove());
      document.querySelectorAll('ins.adsbygoogle, .adsbygoogle').forEach(el => el.remove());
      document.querySelectorAll('div[id^="div-gpt-ad"]').forEach(el => el.remove());
    } catch (e) { }
  }

  if (document.body) {
    cleanAds();
  }
  const observer = new MutationObserver(() => cleanAds());
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  setInterval(cleanAds, 2000);
}

// ─── GENERIC VIDEO AD SKIPPER SCRIPT ────────────────────────────────────────────
function runGenericVideoAdSkipper() {
  'use strict';
  if (window.__osloGenericVideoAdSkipperActive) return;
  window.__osloGenericVideoAdSkipperActive = true;

  function checkAndSkipVideoAds() {
    try {
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        // 1. Check if the video URL indicates an ad
        const src = (video.src || '').toLowerCase();
        let isAd = false;

        const adKeywords = ['/ad/', '/ads/', 'preroll', 'pre-roll', 'midroll', 'postroll', 'vast', 'vpaid', 'videoad', 'video_ad', 'advertisement', 'ad_video', 'ad-video'];

        if (adKeywords.some(kw => src.includes(kw))) {
          isAd = true;
        }

        // Check source tags
        if (!isAd) {
          const sources = video.querySelectorAll('source');
          sources.forEach(source => {
            const sourceSrc = (source.src || '').toLowerCase();
            if (adKeywords.some(kw => sourceSrc.includes(kw))) {
              isAd = true;
            }
          });
        }

        // Check if the video is short and there is a visible skip button on the page (indicating it's an ad)
        if (!isAd) {
          const duration = video.duration;
          if (duration && isFinite(duration) && duration > 0 && duration < 60) {
            const hasSkipButton = Array.from(document.querySelectorAll('button, div, span, a')).some(el => {
              const text = (el.innerText || el.textContent || '').toLowerCase().trim();
              return text === 'skip' || text === 'geç' || text === 'gec' || text.includes('skip ad') || text.includes('reklamı geç') || text.includes('reklami gec');
            });
            if (hasSkipButton) {
              isAd = true;
            }
          }
        }

        // 2. Check for common ad player class names or structures on parent elements
        if (!isAd) {
          let parent = video.parentElement;
          let depth = 0;
          while (parent && depth < 5) {
            const className = (parent.className || '');
            const id = (parent.id || '');
            const classAndId = (typeof className === 'string' ? className : '') + ' ' + (typeof id === 'string' ? id : '');
            const lowerClassAndId = classAndId.toLowerCase();

            if (lowerClassAndId.includes('ad-playing') ||
              lowerClassAndId.includes('ad-showing') ||
              lowerClassAndId.includes('vast-ad') ||
              lowerClassAndId.includes('video-ad') ||
              lowerClassAndId.includes('fluid-ad') ||
              lowerClassAndId.includes('jw-ad') ||
              lowerClassAndId.includes('ima-ad')) {
              isAd = true;
              break;
            }
            parent = parent.parentElement;
            depth++;
          }
        }

        // 3. Skip if it is an ad
        if (isAd) {
          const duration = video.duration;
          // Safeguard: Only skip if the video duration is known and is less than 2 minutes (120 seconds).
          // Video ads are short (usually 5-30s), whereas movies/episodes are long (> 10-20 minutes).
          // If duration is not yet loaded, we wait to avoid false-positive skipping of main video streams.
          if (duration && isFinite(duration) && duration > 0 && duration < 120) {
            if (video.currentTime < duration - 0.2) {
              video.muted = true;
              video.currentTime = duration - 0.1;
              video.playbackRate = 16;
              if (video.paused) {
                video.play().catch(() => { });
              }
            }
          }
        }
      });

      // 4. Click generic skip buttons
      const skipButtons = document.querySelectorAll('button, div, span, a');
      const skipTextsExact = ['skip', 'geç', 'gec'];
      const skipTextsSub = ['skip ad', 'reklamı geç', 'reklami gec', 'skip advertisement', 'ad skip', 'reklam geç', 'skip_ad'];
      skipButtons.forEach(btn => {
        try {
          const text = (btn.innerText || btn.textContent || '').toLowerCase().trim();
          const matchesExact = skipTextsExact.includes(text);
          const matchesSub = skipTextsSub.some(st => text.includes(st));
          if (matchesExact || matchesSub) {
            btn.click();
          }
        } catch (e) { }
      });

      // 5. Remove overlay banner ads inside video player containers
      document.querySelectorAll(
        '.video-ad-overlay, .vast-blocker, .ad-overlay, .jw-preview, .jw-ad-ui, .fluid_ad_countdown, .fluid_video_wrapper_ad'
      ).forEach(el => el.remove());

    } catch (e) { }
  }

  // Run periodically
  setInterval(checkAndSkipVideoAds, 500);
}

// ─── YOUTUBE AD SKIPPER SCRIPT ──────────────────────────────────────────────────
function runYouTubeAdSkipper() {
  'use strict';
  if (window.__osloAdBlockerActive) return;
  window.__osloAdBlockerActive = true;

  let savedVolume = null;

  function handleAds() {
    try {
      const player = document.querySelector('.html5-video-player');
      const video = document.querySelector('video');
      if (!player || !video) return;

      const isAdPlaying = player.classList.contains('ad-showing') ||
        player.classList.contains('ad-interrupting') ||
        document.querySelector('.ytp-ad-player-overlay') !== null;

      if (isAdPlaying) {
        const skipSelectors = [
          '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern', '.ytp-skip-ad-button',
          'button.ytp-ad-skip-button', '.ytp-ad-skip-button-slot button',
          '.ytp-ad-skip-button-container button', '[id="skip-button:"] button',
          '.ytp-ad-skip-button-text',
        ];
        for (const sel of skipSelectors) {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return; }
        }

        if (video.duration && isFinite(video.duration) && video.duration > 0) {
          if (savedVolume === null) savedVolume = video.volume;
          video.volume = 0;
          video.currentTime = video.duration - 0.1;
          video.playbackRate = 16;
        }

        document.querySelectorAll(
          '.ytp-ad-overlay-container, .ytp-ad-text-overlay, .ytp-ad-overlay-slot, .ytp-ad-image-overlay'
        ).forEach(el => el.remove());
      } else {
        if (savedVolume !== null) {
          video.volume = savedVolume;
          video.playbackRate = 1;
          savedVolume = null;
        }
      }
    } catch (e) { }
  }

  function removePromotedItems() {
    try {
      document.querySelectorAll(
        'ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-banner-promo-renderer, ' +
        'ytd-promoted-sparkles-text-search-renderer, ytd-promoted-video-renderer, ' +
        'ytd-compact-promoted-video-renderer, ytd-display-ad-renderer, ' +
        'ytd-promoted-sparkles-web-renderer, ytd-statement-banner-renderer, ' +
        'ytd-video-masthead-ad-v3-renderer, ytd-primetime-promo-renderer, ' +
        '#masthead-ad, #player-ads, #merch-shelf, #offer-module'
      ).forEach(el => el.remove());
    } catch (e) { }
  }

  function dismissPopups() {
    try {
      const premiumPopup = document.querySelector('ytd-popup-container tp-yt-paper-dialog');
      if (premiumPopup) {
        const dismissBtn = premiumPopup.querySelector('#dismiss-button, .dismiss-button, yt-button-renderer');
        if (dismissBtn) dismissBtn.click();
      }
      const pausePopup = document.querySelector('.ytp-pause-overlay-container');
      if (pausePopup) { const btn = pausePopup.querySelector('button'); if (btn) btn.click(); }
      const surveyPopup = document.querySelector('ytd-enforcement-message-view-model');
      if (surveyPopup) surveyPopup.remove();
    } catch (e) { }
  }

  // Intercept fetch
  try {
    const origFetch = window.fetch;
    window.fetch = function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      if (typeof url === 'string') {
        const l = url.toLowerCase();
        if (l.includes('/pagead/') || l.includes('/ptracking') || l.includes('/api/stats/ads') ||
          l.includes('/api/stats/atr') || l.includes('/get_midroll_info') ||
          l.includes('/log_interaction') || l.includes('/log_event') ||
          l.includes('/youtubei/v1/player/ad_break') || l.includes('doubleclick.net') ||
          l.includes('googlesyndication.com') || l.includes('/pcs/activeview') ||
          l.includes('imasdk.googleapis.com') || l.includes('s0.2mdn.net')) {
          return new Promise(() => { });
        }
      }
      return origFetch.apply(this, args);
    };
  } catch (e) { }

  // Intercept XHR
  try {
    const origXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      if (typeof url === 'string') {
        const l = url.toLowerCase();
        if (l.includes('/pagead/') || l.includes('/ptracking') || l.includes('/api/stats/ads') ||
          l.includes('/get_midroll_info') || l.includes('doubleclick.net') ||
          l.includes('googlesyndication.com') || l.includes('imasdk.googleapis.com')) {
          return origXHROpen.call(this, method, 'about:blank', ...rest);
        }
      }
      return origXHROpen.call(this, method, url, ...rest);
    };
  } catch (e) { }

  function startObserver() {
    try {
      const observer = new MutationObserver(() => {
        handleAds(); removePromotedItems(); dismissPopups();
      });
      const target = document.getElementById('movie_player') || document.querySelector('.html5-video-player') || document.body;
      if (target) {
        observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'src'] });
      }
      setInterval(() => { handleAds(); removePromotedItems(); dismissPopups(); }, 1000);
    } catch (e) { }
  }

  function init() {
    handleAds();
    removePromotedItems();
    dismissPopups();
    startObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  try {
    const origPush = history.pushState;
    history.pushState = function (...a) {
      origPush.apply(this, a);
      setTimeout(() => { handleAds(); removePromotedItems(); dismissPopups(); }, 500);
    };
    const origReplace = history.replaceState;
    history.replaceState = function (...a) {
      origReplace.apply(this, a);
      setTimeout(() => { handleAds(); removePromotedItems(); dismissPopups(); }, 500);
    };
    window.addEventListener('yt-navigate-finish', () => {
      setTimeout(() => { handleAds(); removePromotedItems(); dismissPopups(); }, 300);
    });
  } catch (e) { }
}

function runPasswordManager() {
  'use strict';

  let lastTypedUsername = '';
  let lastTypedPassword = '';

  function isUsernameInput(el) {
    const type = el.getAttribute('type') || 'text';
    if (type === 'email' || type === 'username') return true;
    if (type !== 'text' && type !== 'hidden') return false;

    const name = (el.getAttribute('name') || '').toLowerCase();
    const id = (el.getAttribute('id') || '').toLowerCase();
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();

    if (autocomplete === 'username' || autocomplete === 'email') return true;
    if (name.includes('user') || name.includes('email') || name.includes('login') || name.includes('ident')) return true;
    if (id.includes('user') || id.includes('email') || id.includes('login') || id.includes('ident')) return true;
    if (placeholder.includes('user') || placeholder.includes('email') || placeholder.includes('eposta') || placeholder.includes('kullanıcı')) return true;

    const excludeNames = ['q', 'search', 'query', 'term', 's', 'keyword'];
    if (excludeNames.some(ex => name.includes(ex) || id.includes(ex))) {
      return false;
    }

    return true;
  }

  // Monitor input fields globally
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.tagName === 'INPUT') {
      const type = el.getAttribute('type') || 'text';
      if (type === 'password') {
        lastTypedPassword = el.value;
      } else if (isUsernameInput(el)) {
        if (el.value.trim().length > 1) {
          lastTypedUsername = el.value.trim();
        }
      }
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.tagName === 'INPUT') {
      const type = el.getAttribute('type') || 'text';
      if (type === 'password') {
        lastTypedPassword = el.value;
      } else if (isUsernameInput(el)) {
        if (el.value.trim().length > 1) {
          lastTypedUsername = el.value.trim();
        }
      }
    }
  });

  function checkAndSendLoginDetails() {
    if (!lastTypedPassword) return;

    let username = '';

    // 1. Try to find a visible or hidden username field in the DOM near the password input
    const passwordInput = document.querySelector('input[type="password"]');
    if (passwordInput) {
      const form = passwordInput.closest('form') || document;
      const allInputs = Array.from(form.querySelectorAll('input'));
      const pwdIdx = allInputs.indexOf(passwordInput);

      // Search backward from password input
      for (let i = pwdIdx - 1; i >= 0; i--) {
        const input = allInputs[i];
        if (isUsernameInput(input)) {
          if (input.value.trim()) {
            username = input.value.trim();
            break;
          }
        }
      }

      // If still not found, search forward or globally in the form
      if (!username) {
        for (const input of allInputs) {
          if (input !== passwordInput && isUsernameInput(input) && input.value.trim()) {
            username = input.value.trim();
            break;
          }
        }
      }
    }

    // 2. Fall back to the last typed username
    if (!username) {
      username = lastTypedUsername;
    }

    if (username && lastTypedPassword) {
      const origin = (window.location.origin === 'null' || !window.location.origin) ? 'file://local-test' : window.location.origin;
      ipcRenderer.send('login-form-submitted', {
        origin: origin,
        username: username,
        password: lastTypedPassword
      });
    }
  }

  // Intercept form submissions
  document.addEventListener('submit', (e) => {
    const passwordInput = e.target.querySelector('input[type="password"]');
    if (passwordInput && passwordInput.value) {
      lastTypedPassword = passwordInput.value;
      checkAndSendLoginDetails();
    }
  });

  // Intercept clicks on submit/login buttons
  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, input[type="submit"], input[type="button"], [role="button"]');
    if (el) {
      const passwordInput = document.querySelector('input[type="password"]');
      if (passwordInput && passwordInput.value) {
        lastTypedPassword = passwordInput.value;
        // Delay slightly to let input/change event handlers execute first
        setTimeout(checkAndSendLoginDetails, 100);
      }
    }
  });

  // Intercept Enter key in password inputs
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const el = e.target;
      if (el.tagName === 'INPUT' && el.getAttribute('type') === 'password') {
        lastTypedPassword = el.value;
        setTimeout(checkAndSendLoginDetails, 100);
      }
    }
  });

  // 2. Autofill logic
  let autofillDone = false;
  function tryAutofill() {
    if (autofillDone) return;
    const passwordInput = document.querySelector('input[type="password"]');
    if (passwordInput) {
      const origin = (window.location.origin === 'null' || !window.location.origin) ? 'file://local-test' : window.location.origin;
      ipcRenderer.invoke('get-saved-credentials', origin).then(creds => {
        if (creds && creds.length > 0) {
          const form = passwordInput.closest('form') || document;
          const allInputs = Array.from(form.querySelectorAll('input'));
          const pwdIdx = allInputs.indexOf(passwordInput);
          let usernameInput = null;
          for (let i = pwdIdx - 1; i >= 0; i--) {
            const input = allInputs[i];
            if (isUsernameInput(input)) {
              usernameInput = input;
              break;
            }
          }

          if (!usernameInput) {
            // Find any username input in the form
            for (const input of allInputs) {
              if (input !== passwordInput && isUsernameInput(input)) {
                usernameInput = input;
                break;
              }
            }
          }

          const cred = creds[0]; // Use first matching credential
          if (usernameInput) {
            usernameInput.value = cred.username;
            usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
            usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          passwordInput.value = cred.password;
          passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
          passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
          autofillDone = true;
        }
      });
    }
  }

  // Run on load and periodically (covers client-side SPA rendering)
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:' || window.location.protocol === 'file:') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryAutofill);
    } else {
      tryAutofill();
    }
    // Periodically try to autofill
    const intervalId = setInterval(() => {
      if (autofillDone) {
        clearInterval(intervalId);
      } else {
        tryAutofill();
      }
    }, 1000);
    // Stop trying after 10 seconds to save CPU
    setTimeout(() => clearInterval(intervalId), 10000);
  }
}

// ─── INITIAL LIFECYCLE EXECUTION ───────────────────────────────────────────────
if (window.location.protocol === 'http:' || window.location.protocol === 'https:' || window.location.protocol === 'file:') {
  if (window === window.top && !isGoogleAuthHost(getPageHostname())) {
    runPasswordManager();
  }

  // Focus tracking for split screen
  window.addEventListener('focus', () => {
    ipcRenderer.send('tab-view-focus');
  });
  window.addEventListener('click', () => {
    ipcRenderer.send('tab-view-focus');
  });
}

let adBlockEnabled = false;
let fingerprintProtectionEnabled = false;
try {
  adBlockEnabled = ipcRenderer.sendSync('adblock-get-sync');
  const shields = ipcRenderer.sendSync('privacy-shields-get-sync');
  fingerprintProtectionEnabled = !!(shields && shields.fingerprintProtection);
} catch (e) {
  console.error('Failed to query ad blocker state:', e);
}

const hostname = getPageHostname();
const bypassFingerprint = isGoogleSensitiveHost(hostname);

if (fingerprintProtectionEnabled && (window.location.protocol === 'http:' || window.location.protocol === 'https:') && !bypassFingerprint) {
  // 1. Anti-fingerprinting shield (runs immediately at document_start in main world)
  webFrame.executeJavaScript(`(${runAntiFingerprint.toString()})();`);
}

if (adBlockEnabled && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
  // 2. Generic ad blocker script (skip on Google domains to avoid breaking AI Mode/SGE)
  const isGoogleDomain = isGoogleSensitiveHost(hostname);
  const isYouTubeDomain = hostname.includes('youtube.com') || hostname.includes('youtu.be');
  if (!isGoogleDomain) {
    webFrame.executeJavaScript(`(${runGenericAdBlocker.toString()})();`);
    if (!isYouTubeDomain) {
      webFrame.executeJavaScript(`(${runGenericVideoAdSkipper.toString()})();`);
    }
    // 4. Cosmetic CSS injection (also skip on Google domains)
    webFrame.insertCSS(cosmeticFilterCSS);
  }

  // 3. YouTube ad skipper (if on YouTube)
  if (window.location.hostname.includes('youtube.com') || window.location.hostname.includes('youtu.be')) {
    webFrame.executeJavaScript(`(${runYouTubeAdSkipper.toString()})();`);
  }
}

// ─── CONTEXT BRIDGE EXPOSURE ───────────────────────────────────────────────────
function getLocalPageKind() {
  try {
    if (window.location.protocol !== 'file:') return 'web';
    const pathname = decodeURIComponent(window.location.pathname).replace(/\\/g, '/').toLowerCase();
    if (pathname.endsWith('/renderer/index.html')) return 'app';
    if (pathname.endsWith('/newtab/newtab.html')) return 'newtab';
    if (pathname.endsWith('/incognito-newtab/incognito-newtab.html')) return 'newtab';
    if (pathname.endsWith('/reader/reader.html')) return 'reader';
  } catch (error) { }
  return 'web';
}

const pageKind = getLocalPageKind();

const allowedSettings = new Set([
  'searchEngine', 'adblockEnabled', 'blockedCount', 'httpsOnlyEnabled', 'httpsOnlyExceptions',
  'customCss', 'customCssEnabled', 'theme', 'accentColor', 'compactMode', 'tabCornerStyle',
  'activeTabStyle', 'tabHeight', 'sidebarAutoHide', 'sidebarIconOnly', 'sidebarWidth',
  'topBarAutoHide', 'uiFontSize', 'defaultPageZoom', 'reduceMotion', 'transparencyEnabled',
  'language', 'newtabBackgroundType', 'newtabWallpaper', 'newtabBackgroundColor',
  'newtabPresetWallpaper', 'newtabShowClock', 'newtabShowDate', 'newtabShowWeather',
  'newtabShowSearch', 'newtabShowShortcuts', 'newtabTransparentWidgets', 'homeButtonEnabled', 'homePageUrl',
  'bookmarksBarEnabled', 'historyLimit', 'telemetryEnabled', 'dnsOverHttpsEnabled',
  'dnsOverHttpsProvider', 'dnsOverHttpsCustomProvider', 'cookiePolicy', 'clearCookiesOnExit',
  'trackingProtectionLevel', 'fingerprintProtection', 'refererPolicy', 'webRtcIpProtection',
  'dangerousDownloadsProtection', 'passwordSecurityWarnings', 'clearHistoryOnExit',
  'clearCacheOnExit', 'clearDownloadsOnExit', 'clearLocalStorageOnExit',
  'incognitoForgetDownloads', 'incognitoBlockThirdPartyCookies', 'permissionNotifications',
  'permissionCamera', 'permissionMicrophone', 'permissionLocation', 'permissionClipboard',
  'permissionAutoplay', 'globalPrivacyControl', 'sessionRestoreEnabled', 'savePasswordsEnabled',
  'autofillEnabled', 'sleepTabsEnabled', 'sleepTabsTimeout', 'performanceMode',
  'backgroundTabThrottling', 'keepPinnedTabsAwake', 'keepAudioTabsAwake',
  'downloadPromptEnabled'
]);

function asString(value, maxLength = 4096) {
  return typeof value === 'string' && value.length <= maxLength ? value : null;
}

function asTabId(value) {
  return asString(value, 128);
}

function isWebUrl(value) {
  const input = asString(value, 4096);
  if (!input) return false;
  try {
    const parsed = new URL(input);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch (error) {
    return false;
  }
}

function isExternalUrl(value) {
  const input = asString(value, 4096);
  if (!input) return false;
  try {
    const parsed = new URL(input);
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol);
  } catch (error) {
    return false;
  }
}

function isVersion(value) {
  return typeof value === 'string' && /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/i.test(value);
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function normalizeChecksumAlgorithm(value, checksum = '') {
  const algorithm = typeof value === 'string' ? value.toLowerCase() : '';
  if (algorithm === 'sha256' || algorithm === 'sha512') return algorithm;
  return typeof checksum === 'string' && checksum.length === 128 ? 'sha512' : 'sha256';
}

function isChecksum(value, algorithm) {
  if (algorithm === 'sha512') {
    return typeof value === 'string' && (/^[a-f0-9]{128}$/i.test(value) || /^[a-z0-9+/=]{88}$/i.test(value));
  }
  return isSha256(value);
}

function isProfileId(value) {
  return !!asString(value, 80) && /^[a-z0-9-]+$/i.test(value);
}

function isProfileInput(value, requireId = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (requireId && !isProfileId(value.id)) return false;
  if (value.id !== undefined && !isProfileId(value.id)) return false;
  if (value.name !== undefined && !asString(value.name, 48)) return false;
  if (value.avatar !== undefined && !asString(value.avatar, 4)) return false;
  if (value.color !== undefined && !/^#[0-9a-f]{6}$/i.test(String(value.color))) return false;
  return true;
}

function safeSend(channel, validator, payload) {
  if (!validator || validator(payload)) {
    ipcRenderer.send(channel, payload);
  }
}

function safeInvoke(channel, validator, payload, fallback = Promise.resolve(null)) {
  if (!validator || validator(payload)) {
    return ipcRenderer.invoke(channel, payload);
  }
  return fallback;
}

const osloApi = {
  // Tabs control
  createTab: (data = {}) => safeSend('tab-create', (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (value.url !== undefined && asString(value.url, 4096) === null) return false;
    if (value.space !== undefined && asString(value.space, 80) === null) return false;
    if (value.isIncognito !== undefined && typeof value.isIncognito !== 'boolean') return false;
    return true;
  }, data),
  closeTab: (tabId) => safeSend('tab-close', asTabId, tabId),
  selectTab: (tabId) => safeSend('tab-select', asTabId, tabId),
  navigate: (tabId, url) => {
    if (asTabId(tabId) && asString(url, 4096)) ipcRenderer.send('tab-navigate', { tabId, url });
  },
  goBack: (tabId) => safeSend('tab-back', asTabId, tabId),
  goForward: (tabId) => safeSend('tab-forward', asTabId, tabId),
  reload: (tabId) => safeSend('tab-reload', asTabId, tabId),
  updateTabSpace: (tabId, space) => {
    if (asTabId(tabId) && asString(space, 80)) ipcRenderer.send('tab-update-space', { tabId, space });
  },
  reorderTabs: (tabIds) => safeSend('tabs-reorder', (value) => Array.isArray(value) && value.every(asTabId), tabIds),
  muteTab: (tabId, mute) => {
    if (asTabId(tabId) && typeof mute === 'boolean') ipcRenderer.send('tab-mute', { tabId, mute });
  },

  // Storage & Features
  getBookmarks: () => ipcRenderer.invoke('bookmarks-get'),
  addBookmark: (bookmark) => ipcRenderer.invoke('bookmarks-add', bookmark),
  removeBookmark: (url) => ipcRenderer.invoke('bookmarks-remove', url),
  updateBookmark: (oldUrl, bookmark) => ipcRenderer.invoke('bookmarks-update', { oldUrl, bookmark }),
  setBookmarks: (bookmarks) => ipcRenderer.invoke('bookmarks-set', bookmarks),
  exportBookmarks: () => ipcRenderer.invoke('bookmarks-export'),
  importBookmarks: () => ipcRenderer.invoke('bookmarks-import'),
  getHistory: () => ipcRenderer.invoke('history-get'),
  clearHistory: (range) => ipcRenderer.invoke('history-clear', range),
  sleepTab: (tabId) => safeSend('tab-sleep', asTabId, tabId),
  openReaderMode: (tabId) => {
    if (asTabId(tabId)) return ipcRenderer.invoke('reader-mode-open', tabId);
    return Promise.reject(new Error('Invalid tab id.'));
  },
  getReaderArticle: (articleId) => safeInvoke('reader-article-get', (value) => !!asString(value, 128), articleId),

  // Profiles
  getProfiles: () => ipcRenderer.invoke('profiles-get'),
  createProfile: (profile) => safeInvoke('profiles-create', (value) => isProfileInput(value), profile),
  updateProfile: (profile) => safeInvoke('profiles-update', (value) => isProfileInput(value, true), profile),
  deleteProfile: (profileId) => safeInvoke('profiles-delete', isProfileId, profileId),
  switchProfile: (profileId) => safeInvoke('profiles-switch', isProfileId, profileId),
  onProfileSwitched: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('ui-profile-switched', listener);
    return () => ipcRenderer.removeListener('ui-profile-switched', listener);
  },
  onProfilesUpdated: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('ui-profiles-updated', listener);
    return () => ipcRenderer.removeListener('ui-profiles-updated', listener);
  },

  // Unified Settings API
  getAllSettings: () => ipcRenderer.invoke('settings-get-all'),
  setSetting: (key, value) => safeInvoke('settings-set', (payload) => payload && allowedSettings.has(payload.key), { key, value }),
  selectNewtabWallpaperFile: () => ipcRenderer.invoke('newtab-wallpaper-select-file'),
  exportSettings: () => ipcRenderer.invoke('settings-export'),
  importSettings: () => ipcRenderer.invoke('settings-import'),
  resetSettings: () => ipcRenderer.invoke('settings-reset'),
  onSettingsUpdated: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('ui-settings-updated', listener);
    return () => ipcRenderer.removeListener('ui-settings-updated', listener);
  },

  // Legacy broadcast compatibility mappings
  broadcastSetting: (type, value) => {
    const keyMap = { 'wallpaper': 'newtabWallpaper', 'newtab-wallpaper': 'newtabWallpaper' };
    const key = keyMap[type] || type;
    return safeInvoke('settings-set', (payload) => payload && allowedSettings.has(payload.key), { key, value });
  },
  onSettingBroadcast: (callback) => {
    const listener = (event, data) => {
      const typeMap = { 'newtabWallpaper': 'wallpaper' };
      callback({ type: typeMap[data.key] || data.key, value: data.value });
    };
    ipcRenderer.on('ui-settings-updated', listener);
    return () => ipcRenderer.removeListener('ui-settings-updated', listener);
  },

  // Settings & AdBlock
  getAdBlockerState: () => ipcRenderer.invoke('adblock-get'),
  setAdBlockerState: (enabled) => ipcRenderer.invoke('adblock-set', enabled),
  getBlockedCount: () => ipcRenderer.invoke('adblock-get-count'),
  getHttpsOnlyState: () => ipcRenderer.invoke('httpsonly-get'),
  setHttpsOnlyState: (enabled) => ipcRenderer.invoke('httpsonly-set', enabled),
  getSearchEngine: () => ipcRenderer.invoke('searchengine-get'),
  setSearchEngine: (engine) => ipcRenderer.invoke('searchengine-set', engine),
  getCustomCss: () => ipcRenderer.invoke('custom-css-get'),
  setCustomCss: (css) => ipcRenderer.invoke('custom-css-set', css),

  // Download controls
  pauseDownload: (id) => safeSend('download-pause', (value) => Number.isFinite(Number(value)), id),
  resumeDownload: (id) => safeSend('download-resume', (value) => Number.isFinite(Number(value)), id),
  cancelDownload: (id) => safeSend('download-cancel', (value) => Number.isFinite(Number(value)), id),
  retryDownload: (id) => safeSend('download-retry', (value) => Number.isFinite(Number(value)), id),
  verifyDownloadHash: (id, expectedHash = '') => safeInvoke('download-verify-hash', (value) => {
    const hashText = String(value?.expectedHash || '').trim();
    return value &&
      Number.isFinite(Number(value.id)) &&
      (hashText === '' || /^(sha-?256[:=\s]+)?[a-f0-9:\s=-]{32,200}$/i.test(hashText));
  }, { id, expectedHash }),
  getDownloads: () => ipcRenderer.invoke('downloads-get'),
  clearDownloads: () => ipcRenderer.invoke('downloads-clear'),
  getTaskManagerTabs: () => ipcRenderer.invoke('task-manager-tabs-get'),
  getTaskManagerTab: (tabId) => safeInvoke('task-manager-tab-get', asTabId, tabId),

  // Spaces control
  getSpaces: () => ipcRenderer.invoke('spaces-get'),
  addSpace: (name) => safeInvoke('spaces-add', (value) => typeof value === 'string' ? !!asString(value, 80) : !!(value && typeof value === 'object' && asString(value.name, 80)), name),
  deleteSpace: (name) => safeInvoke('spaces-delete', (value) => !!asString(value, 80), name),
  updateSpace: (oldName, space) => {
    if (asString(oldName, 80) && space && typeof space === 'object' && asString(space.name, 80)) {
      return ipcRenderer.invoke('spaces-update', { oldName, space });
    }
    return Promise.resolve(null);
  },

  // Find in page
  findInPage: (text, options) => {
    if (asString(text, 512)) ipcRenderer.send('find-in-page', { text, options: options && typeof options === 'object' ? options : {} });
  },
  stopFindInPage: (action) => {
    if (['clearSelection', 'keepSelection', 'activateSelection'].includes(action)) ipcRenderer.send('stop-find-in-page', { action });
  },
  onFindResult: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('find-result', listener);
    return () => ipcRenderer.removeListener('find-result', listener);
  },

  // Window Operations
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  newWindow: () => ipcRenderer.send('window-new'),
  updateBounds: (bounds) => {
    if (bounds && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(Number(bounds[key])))) {
      ipcRenderer.send('tab-bounds', bounds);
    }
  },
  captureActiveTabPreview: () => ipcRenderer.invoke('active-tab-capture-preview'),
  showBookmarksFolderMenu: (folderId, x, y) => {
    if ((folderId === null || asString(folderId, 128)) && Number.isFinite(Number(x)) && Number.isFinite(Number(y))) {
      ipcRenderer.send('show-bookmarks-folder-menu', { folderId, x, y });
    }
  },
  openDownloadedFile: (filePath) => {
    if (asString(filePath, 4096) && !/^[a-z][a-z0-9+.-]*:/i.test(filePath)) ipcRenderer.send('download-open', filePath);
  },
  openExternalLink: (url) => {
    if (isExternalUrl(url)) ipcRenderer.send('open-external', url);
  },

  // Events from Main Process
  onTabCreated: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('ui-tab-created', listener);
    return () => ipcRenderer.removeListener('ui-tab-created', listener);
  },
  onTabUpdated: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('ui-tab-updated', listener);
    return () => ipcRenderer.removeListener('ui-tab-updated', listener);
  },
  onBookmarksUpdated: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('ui-bookmarks-updated', listener);
    return () => ipcRenderer.removeListener('ui-bookmarks-updated', listener);
  },
  onTabClosed: (callback) => {
    const listener = (event, tabId) => callback(tabId);
    ipcRenderer.on('ui-tab-closed', listener);
    return () => ipcRenderer.removeListener('ui-tab-closed', listener);
  },
  onTabSelected: (callback) => {
    const listener = (event, tabId) => callback(tabId);
    ipcRenderer.on('ui-tab-selected', listener);
    return () => ipcRenderer.removeListener('ui-tab-selected', listener);
  },
  onAdBlocked: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('ad-blocked', listener);
    return () => ipcRenderer.removeListener('ad-blocked', listener);
  },
  onDownloadProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('download-progress', listener);
    return () => ipcRenderer.removeListener('download-progress', listener);
  },
  onHotkey: (callback) => {
    ipcRenderer.on('ui-hotkey-newtab', () => callback('newtab'));
    ipcRenderer.on('ui-hotkey-closetab', () => callback('closetab'));
    ipcRenderer.on('ui-hotkey-incognitotab', () => callback('incognitotab'));
    ipcRenderer.on('ui-hotkey-nexttab', () => callback('nexttab'));
    ipcRenderer.on('ui-hotkey-prevtab', () => callback('prevtab'));
    ipcRenderer.on('ui-hotkey-togglebookmarks', () => callback('togglebookmarks'));
    ipcRenderer.on('ui-hotkey-togglehistory', () => callback('togglehistory'));
    ipcRenderer.on('ui-hotkey-findinpage', () => callback('findinpage'));
    ipcRenderer.on('ui-hotkey-reader', () => callback('reader'));
  },

  // Permission APIs
  respondToPermission: (id, decision) => {
    if (Number.isFinite(Number(id)) && typeof decision === 'boolean') ipcRenderer.send('permission-response', { id, decision });
  },
  onPermissionRequest: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('ui-permission-request', listener);
    return () => ipcRenderer.removeListener('ui-permission-request', listener);
  },
  getPermissions: () => ipcRenderer.invoke('permissions-get-all'),
  deletePermission: (key) => safeInvoke('permissions-delete', (value) => !!asString(value, 512), key),
  setPermission: (key, value) => {
    if (asString(key, 512) && typeof value === 'boolean') return ipcRenderer.invoke('permissions-set', key, value);
    return Promise.resolve(null);
  },
  getSiteData: () => ipcRenderer.invoke('site-data-get'),
  clearSiteData: (domain) => safeInvoke('site-data-clear', (value) => !!asString(value, 253), domain),
  getSiteSecuritySummary: (tabId, url) => safeInvoke('site-security-summary-get', (value) => {
    return value && asTabId(value.tabId) && asString(value.url || '', 4096) !== null;
  }, { tabId, url: String(url || '').slice(0, 4096) }),
  getCertificateExceptions: () => ipcRenderer.invoke('certificate-exceptions-get'),
  deleteCertificateException: (host) => safeInvoke('certificate-exceptions-delete', (value) => !!asString(value, 253), host),
  clearCertificateExceptions: () => ipcRenderer.invoke('certificate-exceptions-clear'),

  // Updates & Telemetry APIs
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getReleaseNotes: () => ipcRenderer.invoke('release-notes-get'),
  downloadUpdate: (url, version, checksum = '', checksumAlgorithm = '') => {
    const normalizedVersion = typeof version === 'string' ? version.replace(/^v/i, '') : version;
    const algorithm = normalizeChecksumAlgorithm(checksumAlgorithm, checksum);
    if (isWebUrl(url) && isVersion(version) && isChecksum(checksum, algorithm)) {
      return ipcRenderer.invoke('download-update', {
        url,
        version: normalizedVersion,
        checksum,
        checksumAlgorithm: algorithm,
        sha256: algorithm === 'sha256' ? checksum : ''
      });
    }
    return Promise.reject(new Error('Invalid update package metadata.'));
  },
  onUpdateDownloadProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
  logTelemetryEvent: (action, data) => {
    if (asString(action, 80)) ipcRenderer.send('telemetry-log-event', { action, data });
  },
  logTelemetryCrash: (error) => ipcRenderer.send('telemetry-log-crash', error),
  getTelemetryLogs: () => ipcRenderer.invoke('telemetry-get-logs'),
  clearTelemetryLogs: () => ipcRenderer.invoke('telemetry-clear-logs'),
  getSystemInfo: () => ipcRenderer.invoke('system-info-get'),
  clearBrowserData: () => ipcRenderer.invoke('clear-browser-data'),

  // Password Manager APIs
  getPasswords: () => ipcRenderer.invoke('passwords-get'),
  auditPasswords: () => ipcRenderer.invoke('passwords-audit'),
  saveCredential: (cred) => safeInvoke('passwords-save', (value) => {
    return value && typeof value === 'object' &&
      isWebUrl(value.origin) &&
      !!asString(value.username, 512) &&
      !!asString(value.password, 4096);
  }, cred),
  deleteCredential: (id) => safeInvoke('passwords-delete', (value) => !!asString(value, 128), id),
  importPasswords: () => ipcRenderer.invoke('passwords-import'),
  exportPasswords: () => ipcRenderer.invoke('passwords-export'),
  onPasswordSavePrompt: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('ui-password-save-prompt', listener);
    return () => ipcRenderer.removeListener('ui-password-save-prompt', listener);
  },

  // Session & Zoom APIs
  getSession: () => ipcRenderer.invoke('session-get'),
  setTabPinned: (tabId, isPinned) => {
    if (asTabId(tabId) && typeof isPinned === 'boolean') ipcRenderer.send('tab-set-pinned', { tabId, isPinned });
  },
  setTabZoom: (tabId, zoom) => {
    const numericZoom = Number(zoom);
    if (asTabId(tabId) && Number.isFinite(numericZoom) && numericZoom >= 0.3 && numericZoom <= 3) {
      ipcRenderer.send('tab-set-zoom', { tabId, zoom: numericZoom });
    }
  },
  onZoomChanged: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('ui-zoom-changed', listener);
    return () => ipcRenderer.removeListener('ui-zoom-changed', listener);
  },

  // Split Screen APIs
  toggleSplitScreen: (tabId) => {
    if (asTabId(tabId)) ipcRenderer.send('tab-toggle-split', tabId);
  },
  onSplitSideFocused: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('ui-split-side-focused', listener);
    return () => ipcRenderer.removeListener('ui-split-side-focused', listener);
  },
  showNewtabTopbarAutocomplete: (payload) => {
    if (
      payload &&
      asTabId(payload.tabId) &&
      Array.isArray(payload.suggestions) &&
      payload.position &&
      Number.isFinite(Number(payload.position.left)) &&
      Number.isFinite(Number(payload.position.top)) &&
      Number.isFinite(Number(payload.position.width)) &&
      Number.isFinite(Number(payload.position.maxHeight))
    ) {
      ipcRenderer.send('newtab-topbar-autocomplete-show', payload);
    }
  },
  hideNewtabTopbarAutocomplete: (tabId) => {
    if (asTabId(tabId)) ipcRenderer.send('newtab-topbar-autocomplete-hide', tabId);
  },
  onNewtabTopbarAutocompleteActivate: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('ui-newtab-topbar-autocomplete-activate', listener);
    return () => ipcRenderer.removeListener('ui-newtab-topbar-autocomplete-activate', listener);
  },
  onNewtabTopbarAutocompleteClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('ui-newtab-topbar-autocomplete-close', listener);
    return () => ipcRenderer.removeListener('ui-newtab-topbar-autocomplete-close', listener);
  }
};

if (pageKind === 'app') {
  contextBridge.exposeInMainWorld('oslo', osloApi);
} else if (pageKind === 'newtab') {
  contextBridge.exposeInMainWorld('oslo', {
    getAllSettings: osloApi.getAllSettings,
    getSearchEngine: osloApi.getSearchEngine,
    getBookmarks: osloApi.getBookmarks,
    getHistory: osloApi.getHistory,
    onSettingsUpdated: osloApi.onSettingsUpdated,
    onSettingBroadcast: osloApi.onSettingBroadcast,
    onTopbarAutocompleteShow: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('newtab-topbar-autocomplete-show', listener);
      return () => ipcRenderer.removeListener('newtab-topbar-autocomplete-show', listener);
    },
    onTopbarAutocompleteHide: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('newtab-topbar-autocomplete-hide', listener);
      return () => ipcRenderer.removeListener('newtab-topbar-autocomplete-hide', listener);
    },
    activateTopbarAutocomplete: (index) => {
      if (Number.isInteger(index) && index >= 0) ipcRenderer.send('newtab-topbar-autocomplete-activate', index);
    },
    closeTopbarAutocomplete: () => ipcRenderer.send('newtab-topbar-autocomplete-close')
  });
} else if (pageKind === 'reader') {
  contextBridge.exposeInMainWorld('oslo', {
    getReaderArticle: osloApi.getReaderArticle,
    getAllSettings: osloApi.getAllSettings
  });
}
