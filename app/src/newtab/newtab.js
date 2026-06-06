// OSLO Browser - New Tab Script

document.addEventListener('DOMContentLoaded', () => {
  // Detect Windows OS to apply workaround for backdrop-filter rendering bugs
  if (navigator.userAgent.includes('Windows') || navigator.userAgent.includes('win32') || navigator.platform.toLowerCase().includes('win')) {
    document.body.classList.add('os-windows');
  }
  // --- Localization for New Tab ---
  const newtabTranslations = {
    tr: {
      'search-placeholder': 'İnternette arama yapın veya URL girin...',
      'quick-links': 'Hızlı Bağlantılar',
      'edit-btn-default': 'Düzenle',
      'edit-btn-active': 'Bitti',
      'add-shortcut': 'Kısayol Ekle',
      'modal-title-add': 'Kısayol Ekle',
      'modal-title-edit': 'Kısayolu Düzenle',
      'modal-name': 'Ad',
      'modal-url': 'URL Adresi',
      'modal-name-placeholder': 'Örn: Google',
      'modal-url-placeholder': 'Örn: https://www.google.com',
      'modal-cancel': 'İptal',
      'modal-save': 'Kaydet',
      'modal-ok': 'Tamam',
      'weather-error': 'Hava durumu alınamadı.',
      'greeting-morning': 'Günaydın',
      'greeting-afternoon': 'Tünaydın',
      'greeting-evening': 'İyi Akşamlar',
      'greeting-night': 'İyi Geceler',
      'greeting-welcome': "OSLO'ya Hoş Geldin",
      'weather-sunny': '☀️ Açık',
      'weather-cloudy': '⛅ Parçalı Bulutlu',
      'weather-foggy': '🌫️ Sisli',
      'weather-drizzle': '🌧️ Çiseleyen Yağmur',
      'weather-rainy': '🌧️ Yağmurlu',
      'weather-snowy': '❄️ Karlı',
      'weather-flurries': '❄️ Kar Atıştırması',
      'weather-showers': '🌦️ Sağanak Yağış',
      'weather-snowshowers': '🌨️ Kar Sağanağı',
      'weather-storm': '⛈️ Gökgürültülü Fırtına',
      'weather-overcast': '☁️ Bulutlu',
      'url-required': 'Lütfen bir URL adresi girin.',
      'url-invalid': 'Lütfen geçerli bir http veya https URL adresi girin.',
      'delete': 'Sil',
      'edit': 'Düzenle',
      'new-tab': 'Yeni Sekme',
      'weather-loading': 'Hava durumu yükleniyor...',
      'edit-btn-title': 'Kısayolları Düzenle'
    },
    en: {
      'search-placeholder': 'Search the web or enter URL...',
      'quick-links': 'Quick Links',
      'edit-btn-default': 'Edit',
      'edit-btn-active': 'Done',
      'add-shortcut': 'Add Shortcut',
      'modal-title-add': 'Add Shortcut',
      'modal-title-edit': 'Edit Shortcut',
      'modal-name': 'Name',
      'modal-url': 'URL Address',
      'modal-name-placeholder': 'E.g. Google',
      'modal-url-placeholder': 'E.g. https://www.google.com',
      'modal-cancel': 'Cancel',
      'modal-save': 'Save',
      'modal-ok': 'OK',
      'weather-error': 'Weather could not be retrieved.',
      'greeting-morning': 'Good Morning',
      'greeting-afternoon': 'Good Afternoon',
      'greeting-evening': 'Good Evening',
      'greeting-night': 'Good Night',
      'greeting-welcome': 'Welcome to OSLO',
      'weather-sunny': '☀️ Clear',
      'weather-cloudy': '⛅ Partly Cloudy',
      'weather-foggy': '🌫️ Foggy',
      'weather-drizzle': '🌧️ Drizzle',
      'weather-rainy': '🌧️ Rainy',
      'weather-snowy': '❄️ Snowy',
      'weather-flurries': '❄️ Snow Flurries',
      'weather-showers': '🌦️ Showers',
      'weather-snowshowers': '🌨️ Snow Showers',
      'weather-storm': '⛈️ Thunderstorm',
      'weather-overcast': '☁️ Cloudy',
      'url-required': 'Please enter a URL address.',
      'url-invalid': 'Please enter a valid http or https URL address.',
      'delete': 'Delete',
      'edit': 'Edit',
      'new-tab': 'New Tab',
      'weather-loading': 'Loading weather...',
      'edit-btn-title': 'Edit Shortcuts'
    },
    fr: {
      'search-placeholder': 'Rechercher sur le web ou saisir une URL...',
      'quick-links': 'Raccourcis',
      'edit-btn-default': 'Modifier',
      'edit-btn-active': 'Terminé',
      'add-shortcut': 'Ajouter',
      'modal-title-add': 'Ajouter un Raccourci',
      'modal-title-edit': 'Modifier le Raccourci',
      'modal-name': 'Nom',
      'modal-url': 'Adresse URL',
      'modal-name-placeholder': 'Ex. : Google',
      'modal-url-placeholder': 'Ex. : https://www.google.com',
      'modal-cancel': 'Annuler',
      'modal-save': 'Enregistrer',
      'modal-ok': 'OK',
      'weather-error': 'Météo indisponible.',
      'greeting-morning': 'Bon matin',
      'greeting-afternoon': 'Bon après-midi',
      'greeting-evening': 'Bonsoir',
      'greeting-night': 'Bonne nuit',
      'greeting-welcome': 'Bienvenue sur OSLO',
      'weather-sunny': '☀️ Ensoleillé',
      'weather-cloudy': '⛅ Partiellement Nuageux',
      'weather-foggy': '🌫️ Brouillard',
      'weather-drizzle': '🌧️ Bruine',
      'weather-rainy': '🌧️ Pluvieux',
      'weather-snowy': '❄️ Neigeux',
      'weather-flurries': '❄️ Averses de neige',
      'weather-showers': '🌦️ Averses',
      'weather-snowshowers': '🌨️ Fortes chutes de neige',
      'weather-storm': '⛈️ Orage',
      'weather-overcast': '☁️ Nuageux',
      'url-required': 'Veuillez saisir une adresse URL.',
      'url-invalid': 'Veuillez saisir une adresse URL http ou https valide.',
      'delete': 'Supprimer',
      'edit': 'Modifier',
      'new-tab': 'Nouvel Onglet',
      'weather-loading': 'Chargement de la météo...',
      'edit-btn-title': 'Modifier les raccourcis'
    }
  };

  let activeSettings = {
    theme: 'dark',
    accentColor: '#00ddff',
    reduceMotion: false,
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
    newtabTransparentWidgets: false
  };
  let activeLang = 'tr';
  let lastWeatherCode = null;
  let rawCityName = 'İstanbul';
  let weatherLoadFailed = false;

  function formatCityName(cityName, lang) {
    if (!cityName) return '';
    const nameStr = String(cityName);
    if (lang === 'en' || lang === 'fr') {
      return nameStr.replace(/İ/g, 'I').replace(/ı/g, 'i');
    }
    return nameStr;
  }


  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  const greetingEl = document.getElementById('greeting');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const autocompleteDropdown = document.getElementById('newtab-autocomplete-dropdown');
  const weatherTemp = document.getElementById('weather-temp');
  const weatherDesc = document.getElementById('weather-desc');
  const weatherCity = document.getElementById('weather-city');

  const presetBackgrounds = {
    aurora: 'radial-gradient(circle at 20% 20%, rgba(0, 221, 255, 0.34), transparent 34%), radial-gradient(circle at 78% 18%, rgba(139, 92, 246, 0.28), transparent 30%), linear-gradient(135deg, #071014 0%, #111827 100%)',
    dawn: 'linear-gradient(135deg, #1f2937 0%, #7c2d12 45%, #f59e0b 100%)',
    forest: 'linear-gradient(135deg, #052e16 0%, #14532d 45%, #0f172a 100%)',
    mono: 'linear-gradient(135deg, #0f172a 0%, #27272a 50%, #111827 100%)'
  };

  let systemThemeQuery = null;

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
    return `#${[r, g, b].map(channel => {
      const value = amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount;
      return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
    }).join('')}`;
  }

  function applyAccentColor() {
    const color = normalizeHexColor(activeSettings.accentColor);
    const darker = shadeHexColor(color, -0.32);
    const root = document.documentElement;
    const body = document.body;
    root.style.setProperty('--accent-cyan', color);
    root.style.setProperty('--accent-blue', darker);
    root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${color} 0%, ${darker} 100%)`);
    root.style.setProperty('--glass-hover-border', `${color}55`);
    body.style.setProperty('--accent-cyan', color);
    body.style.setProperty('--accent-blue', darker);
    body.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${color} 0%, ${darker} 100%)`);
    body.style.setProperty('--glass-hover-border', `${color}55`);
  }

  function resolveThemeMode(mode) {
    if (mode === 'system') {
      if (!systemThemeQuery && window.matchMedia) {
        systemThemeQuery = window.matchMedia('(prefers-color-scheme: light)');
        const handleSystemThemeChange = () => applyTheme();
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

  // --- Theme Syncing (Dark / Light Mode) ---
  function applyTheme() {
    const resolvedTheme = resolveThemeMode(activeSettings.theme || 'dark');
    document.body.classList.toggle('light-mode', resolvedTheme === 'light');
  }

  function applyLayoutPreferences() {
    document.body.classList.toggle('hide-clock', activeSettings.newtabShowClock === false);
    document.body.classList.toggle('hide-date', activeSettings.newtabShowDate === false);
    document.body.classList.toggle('hide-weather', activeSettings.newtabShowWeather === false);
    document.body.classList.toggle('hide-search', activeSettings.newtabShowSearch === false);
    document.body.classList.toggle('hide-shortcuts', activeSettings.newtabShowShortcuts === false);
    document.body.classList.toggle('transparent-widgets', !!activeSettings.newtabTransparentWidgets);
    document.body.classList.toggle('reduce-motion', !!activeSettings.reduceMotion);
  }

  function applyVisualPreferences() {
    applyTheme();
    applyAccentColor();
    applyLayoutPreferences();
  }

  // Load settings from main process
  if (window.oslo && typeof window.oslo.getAllSettings === 'function') {
    window.oslo.getAllSettings().then(settings => {
      activeSettings = { ...activeSettings, ...settings };
      activeLang = activeSettings.language || 'tr';
      applyVisualPreferences();
      applyWallpaper();
      applyLanguage();
    }).catch(err => {
      console.error('Failed to load settings from main process:', err);
      applyVisualPreferences();
      applyWallpaper();
      applyLanguage();
    });
  } else {
    applyVisualPreferences();
    applyWallpaper();
    applyLanguage();
  }

  // --- Live Clock & Time-based Greeting ---
  function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}`;
    if (dateEl) {
      const locale = activeLang === 'tr' ? 'tr-TR' : (activeLang === 'fr' ? 'fr-FR' : 'en-US');
      dateEl.textContent = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    }

    const hrs = now.getHours();
    let greetKey = 'greeting-morning';
    if (hrs >= 5 && hrs < 12) {
      greetKey = 'greeting-morning';
    } else if (hrs >= 12 && hrs < 17) {
      greetKey = 'greeting-afternoon';
    } else if (hrs >= 17 && hrs < 22) {
      greetKey = 'greeting-evening';
    } else {
      greetKey = 'greeting-night';
    }

    // Check if newtabTranslations is already defined (it is defined below in the file scope)
    const translationsReady = typeof newtabTranslations !== 'undefined';
    const greet = translationsReady ? newtabTranslations[activeLang][greetKey] : 'Merhaba';
    const welcome = translationsReady ? newtabTranslations[activeLang]['greeting-welcome'] : "OSLO'ya Hoş Geldin";
    greetingEl.textContent = `${greet}, ${welcome}`;
  }

  updateTime();
  setInterval(updateTime, 1000);

  // --- Custom Wallpaper Loader ---
  function applyWallpaper() {
    const type = activeSettings.newtabBackgroundType || 'default';
    const savedWallpaper = activeSettings.newtabWallpaper;
    const shapes = document.querySelector('.bg-gradient-shapes');

    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = '';
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';

    if ((type === 'url' || type === 'file') && savedWallpaper && savedWallpaper.trim() !== '') {
      document.body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.38), rgba(0, 0, 0, 0.38)), url("${savedWallpaper}")`;
      if (shapes) shapes.style.display = 'none';
    } else if (type === 'color') {
      document.body.style.backgroundColor = normalizeHexColor(activeSettings.newtabBackgroundColor, '#0b0c0e');
      if (shapes) shapes.style.display = 'none';
    } else if (type === 'preset') {
      document.body.style.backgroundImage = presetBackgrounds[activeSettings.newtabPresetWallpaper] || presetBackgrounds.aurora;
      if (shapes) shapes.style.display = 'none';
    } else {
      if (shapes) shapes.style.display = 'block';
    }
  }

  // --- Weather Widget ---
  function fetchWeather(lat, lon, cityName = '') {
    if (cityName) {
      rawCityName = cityName;
      weatherCity.textContent = formatCityName(rawCityName, activeLang);
    } else {
      // Reverse geocode via OpenStreetMap Nominatim
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
        .then(res => res.json())
        .then(data => {
          if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.province || data.address.state || 'İstanbul';
            rawCityName = city;
            weatherCity.textContent = formatCityName(rawCityName, activeLang);
          } else {
            rawCityName = 'İstanbul';
            weatherCity.textContent = formatCityName(rawCityName, activeLang);
          }
        })
        .catch(() => {
          rawCityName = 'İstanbul';
          weatherCity.textContent = formatCityName(rawCityName, activeLang);
        });
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data && data.current_weather) {
          const temp = Math.round(data.current_weather.temperature);
          const code = data.current_weather.weathercode;
          lastWeatherCode = code;
          weatherLoadFailed = false;
          weatherTemp.textContent = `${temp}°C`;
          weatherDesc.textContent = mapWeatherCode(code);
        }
      })
      .catch(() => {
        lastWeatherCode = null;
        weatherLoadFailed = true;
        const translationsReady = typeof newtabTranslations !== 'undefined';
        weatherDesc.textContent = translationsReady ? newtabTranslations[activeLang]['weather-error'] : 'Hava durumu alınamadı.';
      });
  }

  function mapWeatherCode(code) {
    const translationsReady = typeof newtabTranslations !== 'undefined';
    if (!translationsReady) return 'Bulutlu';
    switch (code) {
      case 0: return newtabTranslations[activeLang]['weather-sunny'];
      case 1:
      case 2:
      case 3: return newtabTranslations[activeLang]['weather-cloudy'];
      case 45:
      case 48: return newtabTranslations[activeLang]['weather-foggy'];
      case 51:
      case 53:
      case 55: return newtabTranslations[activeLang]['weather-drizzle'];
      case 61:
      case 63:
      case 65: return newtabTranslations[activeLang]['weather-rainy'];
      case 71:
      case 73:
      case 75: return newtabTranslations[activeLang]['weather-snowy'];
      case 77: return newtabTranslations[activeLang]['weather-flurries'];
      case 80:
      case 81:
      case 82: return newtabTranslations[activeLang]['weather-showers'];
      case 85:
      case 86: return newtabTranslations[activeLang]['weather-snowshowers'];
      case 95:
      case 96:
      case 99: return newtabTranslations[activeLang]['weather-storm'];
      default: return newtabTranslations[activeLang]['weather-overcast'];
    }
  }

  // Try geolocating user
  function loadWeatherAndLocation() {
    fetch('http://ip-api.com/json/')
      .then(res => res.json())
      .then(data => {
        if (data && data.status === 'success') {
          fetchWeather(data.lat, data.lon, data.city);
        } else {
          fallbackGeolocation();
        }
      })
      .catch(() => {
        fallbackGeolocation();
      });
  }

  function fallbackGeolocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchWeather(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          fetchWeather(41.0082, 28.9784, 'İstanbul');
        },
        { timeout: 5000 }
      );
    } else {
      fetchWeather(41.0082, 28.9784, 'İstanbul');
    }
  }

  loadWeatherAndLocation();

  // --- Search Redirection ---
  function formatSearch(val, engine) {
    const query = val.trim();

    if (query.startsWith('http://') || query.startsWith('https://') || query.startsWith('file://')) {
      return query;
    }

    const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/\S*)?$/;
    if (domainPattern.test(query)) {
      return 'https://' + query;
    }

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
    return searchUrl + encodeURIComponent(query);
  }

  function navigateToSearchValue(value) {
    const query = String(value || '').trim();
    if (!query) return;

    closeNewtabAutocomplete();
    if (window.oslo && typeof window.oslo.getSearchEngine === 'function') {
      window.oslo.getSearchEngine().then(engine => {
        window.location.href = formatSearch(query, engine);
      }).catch(() => {
        window.location.href = formatSearch(query, activeSettings.searchEngine || 'google');
      });
    } else {
      window.location.href = formatSearch(query, activeSettings.searchEngine || 'google');
    }
  }

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    navigateToSearchValue(query);
  });

  function applyLanguage() {
    activeLang = activeSettings.language || 'tr';

    document.title = newtabTranslations[activeLang]['new-tab'];

    // Update elements
    const sectionTitle = document.querySelector('.shortcuts-section .section-title');
    if (sectionTitle) sectionTitle.textContent = newtabTranslations[activeLang]['quick-links'];

    if (editShortcutsBtn) {
      editShortcutsBtn.textContent = editModeActive
        ? newtabTranslations[activeLang]['edit-btn-active']
        : newtabTranslations[activeLang]['edit-btn-default'];
      editShortcutsBtn.title = newtabTranslations[activeLang]['edit-btn-title'];
    }

    if (searchInput) {
      searchInput.placeholder = newtabTranslations[activeLang]['search-placeholder'];
    }

    // Modal labels
    const nameLabel = document.querySelector('label[for="modal-name-input"]');
    if (nameLabel) nameLabel.textContent = newtabTranslations[activeLang]['modal-name'];
    const modalNameField = document.getElementById('modal-name-input');
    if (modalNameField) modalNameField.placeholder = newtabTranslations[activeLang]['modal-name-placeholder'];

    const urlLabel = document.querySelector('label[for="modal-url-input"]');
    if (urlLabel) urlLabel.textContent = newtabTranslations[activeLang]['modal-url'];
    const modalUrlField = document.getElementById('modal-url-input');
    if (modalUrlField) modalUrlField.placeholder = newtabTranslations[activeLang]['modal-url-placeholder'];

    if (modalCancelBtn) modalCancelBtn.textContent = newtabTranslations[activeLang]['modal-cancel'];
    if (modalSaveBtn) modalSaveBtn.textContent = newtabTranslations[activeLang]['modal-save'];

    // Update weather widget translations
    if (lastWeatherCode !== null) {
      weatherDesc.textContent = mapWeatherCode(lastWeatherCode);
    } else if (weatherLoadFailed) {
      weatherDesc.textContent = newtabTranslations[activeLang]['weather-error'];
    } else {
      weatherDesc.textContent = newtabTranslations[activeLang]['weather-loading'];
    }
    if (weatherCity) {
      weatherCity.textContent = formatCityName(rawCityName, activeLang);
    }

    // Update greeting
    updateTime();

    // Rerender shortcuts to translate labels & buttons
    renderShortcutsGrid();
  }

  // --- Shortcuts Dynamic Management ---
  const editShortcutsBtn = document.getElementById('edit-shortcuts-btn');
  const shortcutsGrid = document.getElementById('shortcuts-grid');
  const shortcutModal = document.getElementById('shortcut-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalNameInput = document.getElementById('modal-name-input');
  const modalUrlInput = document.getElementById('modal-url-input');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalSaveBtn = document.getElementById('modal-save-btn');

  let defaultShortcuts = [
    { name: 'Google', url: 'https://www.google.com' },
    { name: 'YouTube', url: 'https://www.youtube.com' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Wikipedia', url: 'https://www.wikipedia.org' },
    { name: 'Twitter', url: 'https://x.com' },
    { name: 'Reddit', url: 'https://www.reddit.com' }
  ];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function normalizeShortcutUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return '';

    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch (e) {
      return '';
    }
  }

  function normalizeShortcut(value) {
    if (!value || typeof value !== 'object') return null;
    const url = normalizeShortcutUrl(value.url);
    if (!url) return null;

    let name = String(value.name || '').trim();
    if (!name) {
      try {
        name = new URL(url).hostname || url;
      } catch (e) {
        name = url;
      }
    }
    return { name, url };
  }

  function showNewtabAlert(message) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 420px;">
        <h3>OSLO Browser</h3>
        <div class="modal-body" style="color: var(--text-muted); line-height: 1.55; white-space: pre-wrap;">${escapeHtml(message)}</div>
        <div class="modal-actions">
          <button type="button" class="save-btn alert-ok-btn">${escapeHtml(newtabTranslations[activeLang]['modal-ok'])}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 180);
    };
    overlay.querySelector('.alert-ok-btn')?.addEventListener('click', close);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) close();
    });
  }

  let shortcuts = [];
  try {
    const saved = localStorage.getItem('newtab-shortcuts');
    if (saved) {
      const parsed = JSON.parse(saved);
      shortcuts = Array.isArray(parsed)
        ? parsed.map(normalizeShortcut).filter(Boolean)
        : [...defaultShortcuts];
    } else {
      shortcuts = [...defaultShortcuts];
    }
  } catch (e) {
    shortcuts = [...defaultShortcuts];
  }

  let editModeActive = false;
  let editingIndex = null;
  let selectedNewtabSuggestionIndex = -1;
  let currentNewtabSuggestions = [];
  let newtabAutocompleteToken = 0;
  let topbarAutocompleteDropdown = null;
  let topbarAutocompleteOpen = false;

  function ensureTopbarAutocompleteDropdown() {
    if (topbarAutocompleteDropdown) return topbarAutocompleteDropdown;

    topbarAutocompleteDropdown = document.createElement('div');
    topbarAutocompleteDropdown.id = 'newtab-topbar-autocomplete-dropdown';
    topbarAutocompleteDropdown.className = 'newtab-topbar-autocomplete-dropdown';
    topbarAutocompleteDropdown.style.display = 'none';
    document.body.appendChild(topbarAutocompleteDropdown);
    return topbarAutocompleteDropdown;
  }

  function closeTopbarAutocomplete({ notify = false } = {}) {
    if (topbarAutocompleteDropdown) {
      topbarAutocompleteDropdown.style.display = 'none';
      topbarAutocompleteDropdown.innerHTML = '';
    }
    topbarAutocompleteOpen = false;

    if (notify && window.oslo && typeof window.oslo.closeTopbarAutocomplete === 'function') {
      window.oslo.closeTopbarAutocomplete();
    }
  }

  function renderTopbarAutocomplete(payload) {
    const dropdown = ensureTopbarAutocompleteDropdown();
    const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
    const position = payload?.position || {};
    const selectedIndex = Number.isInteger(payload?.selectedIndex) ? payload.selectedIndex : -1;

    if (suggestions.length === 0) {
      closeTopbarAutocomplete();
      return;
    }

    dropdown.innerHTML = '';
    dropdown.style.left = `${Math.max(0, Number(position.left) || 0)}px`;
    dropdown.style.top = `${Math.max(0, Number(position.top) || 0)}px`;
    dropdown.style.width = `${Math.max(180, Number(position.width) || 180)}px`;
    dropdown.style.maxHeight = `${Math.max(96, Number(position.maxHeight) || 260)}px`;

    suggestions.forEach((suggestion, index) => {
      const item = document.createElement('div');
      item.className = `newtab-autocomplete-item ${index === selectedIndex ? 'selected' : ''}`;
      item.innerHTML = `
        <div class="newtab-autocomplete-icon">${suggestion.icon || linkSuggestionIcon()}</div>
        <div class="newtab-autocomplete-text">
          <div class="newtab-autocomplete-title">${escapeHtml(suggestion.title)}</div>
          <div class="newtab-autocomplete-url">${escapeHtml(suggestion.url)}</div>
        </div>
      `;

      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
      });
      item.addEventListener('click', () => {
        if (window.oslo && typeof window.oslo.activateTopbarAutocomplete === 'function') {
          window.oslo.activateTopbarAutocomplete(index);
        }
      });

      dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
    topbarAutocompleteOpen = true;
  }

  if (window.oslo && typeof window.oslo.onTopbarAutocompleteShow === 'function') {
    window.oslo.onTopbarAutocompleteShow(renderTopbarAutocomplete);
  }

  if (window.oslo && typeof window.oslo.onTopbarAutocompleteHide === 'function') {
    window.oslo.onTopbarAutocompleteHide(() => closeTopbarAutocomplete());
  }

  function searchSuggestionIcon() {
    return `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
    `;
  }

  function linkSuggestionIcon() {
    return `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
      </svg>
    `;
  }

  function bookmarkSuggestionIcon() {
    return `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
      </svg>
    `;
  }

  function historySuggestionIcon() {
    return `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M13 3c-4.4 0-8 3.6-8 8H2.5l3.3 3.3.1.2L9.5 11H7c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6c-1.7 0-3.2-.7-4.2-1.8l-1.4 1.4C8.8 18.1 10.8 19 13 19c4.4 0 8-3.6 8-8s-3.6-8-8-8zm-1 4v5l4.2 2.5.8-1.3-3.5-2.1V7H12z"/>
      </svg>
    `;
  }

  function getSearchEngineName(engine) {
    const names = {
      google: 'Google',
      duckduckgo: 'DuckDuckGo',
      bing: 'Bing',
      yahoo: 'Yahoo',
      yandex: 'Yandex',
      brave: 'Brave',
      ecosia: 'Ecosia',
      startpage: 'Startpage'
    };
    return names[engine] || 'DuckDuckGo';
  }

  function getSearchSuggestionTitle(query, engineName) {
    if (activeLang === 'en') return `Search "${query}" with ${engineName}`;
    if (activeLang === 'fr') return `Rechercher "${query}" avec ${engineName}`;
    return `"${query}" ile ${engineName} ara`;
  }

  function closeNewtabAutocomplete() {
    newtabAutocompleteToken++;
    selectedNewtabSuggestionIndex = -1;
    currentNewtabSuggestions = [];
    if (autocompleteDropdown) {
      autocompleteDropdown.style.display = 'none';
      autocompleteDropdown.innerHTML = '';
    }
  }

  function isNewtabUrl(url) {
    const value = String(url || '');
    return value === 'oslo://newtab' || value.includes('/newtab/newtab.html') || value.includes('\\newtab\\newtab.html');
  }

  function isSafeSuggestionUrl(url) {
    const value = String(url || '').trim();
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'file:';
    } catch (e) {
      return false;
    }
  }

  function suggestionMatches(item, cleanText) {
    return (item.title || '').toLowerCase().includes(cleanText) ||
      (item.url || '').toLowerCase().includes(cleanText) ||
      (item.name || '').toLowerCase().includes(cleanText);
  }

  function addUrlSuggestion(suggestions, seenUrls, suggestion) {
    const url = String(suggestion.url || '').trim();
    if (!url || isNewtabUrl(url) || !isSafeSuggestionUrl(url)) return;

    const key = url.toLowerCase();
    if (seenUrls.has(key)) return;

    seenUrls.add(key);
    suggestions.push(suggestion);
  }

  function buildNewtabSuggestions(text, historyItems, bookmarks, engine) {
    const cleanText = text.trim().toLowerCase();
    const engineName = getSearchEngineName(engine);
    const suggestions = [{
      type: 'search',
      title: getSearchSuggestionTitle(text, engineName),
      url: text,
      query: text,
      icon: searchSuggestionIcon()
    }];
    const seenUrls = new Set();

    shortcuts
      .map(normalizeShortcut)
      .filter(Boolean)
      .filter(item => suggestionMatches(item, cleanText))
      .slice(0, 4)
      .forEach(item => {
        addUrlSuggestion(suggestions, seenUrls, {
          type: 'shortcut',
          title: item.name,
          url: item.url,
          icon: linkSuggestionIcon()
        });
      });

    (bookmarks || [])
      .filter(item => item && !item.isFolder && suggestionMatches(item, cleanText))
      .slice(0, 5)
      .forEach(item => {
        addUrlSuggestion(suggestions, seenUrls, {
          type: 'bookmark',
          title: item.title || item.url,
          url: item.url,
          icon: bookmarkSuggestionIcon()
        });
      });

    (historyItems || [])
      .filter(item => item && suggestionMatches(item, cleanText))
      .slice(0, 5)
      .forEach(item => {
        addUrlSuggestion(suggestions, seenUrls, {
          type: 'history',
          title: item.title || item.url,
          url: item.url,
          icon: historySuggestionIcon()
        });
      });

    return suggestions.slice(0, 8);
  }

  function renderNewtabAutocomplete() {
    if (!autocompleteDropdown) return;

    if (currentNewtabSuggestions.length === 0) {
      closeNewtabAutocomplete();
      return;
    }

    autocompleteDropdown.innerHTML = '';
    currentNewtabSuggestions.forEach((suggestion, index) => {
      const item = document.createElement('div');
      item.className = `newtab-autocomplete-item ${index === selectedNewtabSuggestionIndex ? 'selected' : ''}`;
      item.innerHTML = `
        <div class="newtab-autocomplete-icon">${suggestion.icon}</div>
        <div class="newtab-autocomplete-text">
          <div class="newtab-autocomplete-title">${escapeHtml(suggestion.title)}</div>
          <div class="newtab-autocomplete-url">${escapeHtml(suggestion.url)}</div>
        </div>
      `;

      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
      });
      item.addEventListener('click', () => {
        activateNewtabSuggestion(suggestion);
      });

      autocompleteDropdown.appendChild(item);
    });

    autocompleteDropdown.style.display = 'block';
  }

  function showNewtabAutocomplete(value) {
    const text = String(value || '').trim();
    if (!text) {
      closeNewtabAutocomplete();
      return;
    }

    const token = ++newtabAutocompleteToken;
    const historyPromise = window.oslo && typeof window.oslo.getHistory === 'function'
      ? window.oslo.getHistory().catch(() => [])
      : Promise.resolve([]);
    const bookmarksPromise = window.oslo && typeof window.oslo.getBookmarks === 'function'
      ? window.oslo.getBookmarks().catch(() => [])
      : Promise.resolve([]);
    const enginePromise = window.oslo && typeof window.oslo.getSearchEngine === 'function'
      ? window.oslo.getSearchEngine().catch(() => activeSettings.searchEngine || 'duckduckgo')
      : Promise.resolve(activeSettings.searchEngine || 'duckduckgo');

    Promise.all([historyPromise, bookmarksPromise, enginePromise]).then(([historyItems, bookmarks, engine]) => {
      if (token !== newtabAutocompleteToken || searchInput.value.trim() !== text) return;

      currentNewtabSuggestions = buildNewtabSuggestions(text, historyItems, bookmarks, engine);
      selectedNewtabSuggestionIndex = -1;
      renderNewtabAutocomplete();
    });
  }

  function activateNewtabSuggestion(suggestion) {
    if (!suggestion) return;

    if (suggestion.type === 'search') {
      navigateToSearchValue(suggestion.query || suggestion.url);
      return;
    }

    if (suggestion.url && isSafeSuggestionUrl(suggestion.url)) {
      closeNewtabAutocomplete();
      window.location.href = suggestion.url;
    }
  }

  searchInput.addEventListener('input', () => {
    showNewtabAutocomplete(searchInput.value);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      showNewtabAutocomplete(searchInput.value);
    }
  });

  searchInput.addEventListener('keydown', (event) => {
    const isOpen = autocompleteDropdown && autocompleteDropdown.style.display === 'block';
    if (!isOpen) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedNewtabSuggestionIndex = (selectedNewtabSuggestionIndex + 1) % currentNewtabSuggestions.length;
      renderNewtabAutocomplete();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedNewtabSuggestionIndex = (selectedNewtabSuggestionIndex - 1 + currentNewtabSuggestions.length) % currentNewtabSuggestions.length;
      renderNewtabAutocomplete();
    } else if (event.key === 'Enter' && selectedNewtabSuggestionIndex >= 0) {
      event.preventDefault();
      activateNewtabSuggestion(currentNewtabSuggestions[selectedNewtabSuggestionIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeNewtabAutocomplete();
    }
  });

  document.addEventListener('click', (event) => {
    if (topbarAutocompleteOpen && !event.target.closest('#newtab-topbar-autocomplete-dropdown')) {
      closeTopbarAutocomplete({ notify: true });
    }

    if (!event.target.closest('.search-box')) {
      closeNewtabAutocomplete();
    }
  });

  function saveShortcuts() {
    shortcuts = shortcuts.map(normalizeShortcut).filter(Boolean);
    localStorage.setItem('newtab-shortcuts', JSON.stringify(shortcuts));
    renderShortcutsGrid();
  }

  function renderShortcutsGrid() {
    shortcutsGrid.innerHTML = '';

    shortcuts.forEach((rawItem, index) => {
      const item = normalizeShortcut(rawItem);
      if (!item) return;

      let domain = '';
      try {
        domain = new URL(item.url).hostname;
      } catch (e) {
        domain = '';
      }

      const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
      const delTitle = newtabTranslations[activeLang]['delete'];
      const editTitle = newtabTranslations[activeLang]['edit'];
      const fallbackLetter = item.name.trim().charAt(0).toUpperCase() || '?';

      const card = document.createElement('a');
      card.href = item.url;
      card.className = 'shortcut-card';
      card.dataset.index = index;

      card.innerHTML = `
        <div class="shortcut-icon" style="background-color: rgba(255, 255, 255, 0.05); color: #fff;">
          <img src="${escapeAttribute(faviconUrl)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" style="width: 24px; height: 24px; object-fit: contain;">
          <span class="fallback-letter" style="display: none; font-size: 18px; font-weight: bold; text-transform: uppercase;">${escapeHtml(fallbackLetter)}</span>
        </div>
        <span class="shortcut-name">${escapeHtml(item.name)}</span>
        <button class="card-action-btn delete-btn" title="${escapeAttribute(delTitle)}">&times;</button>
        <button class="card-action-btn edit-btn" title="${escapeAttribute(editTitle)}">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>
      `;

      card.addEventListener('click', (e) => {
        if (editModeActive) {
          e.preventDefault();
        }
      });

      const delBtn = card.querySelector('.delete-btn');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        shortcuts.splice(index, 1);
        saveShortcuts();
      });

      const edBtn = card.querySelector('.edit-btn');
      edBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        openModal(index);
      });

      shortcutsGrid.appendChild(card);
    });

    // Add card at the end
    const addCard = document.createElement('div');
    addCard.className = 'shortcut-card add-card';
    const addText = newtabTranslations[activeLang]['add-shortcut'];
    addCard.innerHTML = `
      <div class="shortcut-icon add-icon">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/>
        </svg>
      </div>
      <span class="shortcut-name">${escapeHtml(addText)}</span>
    `;
    addCard.addEventListener('click', () => {
      openModal(null);
    });
    shortcutsGrid.appendChild(addCard);
  }

  function openModal(index) {
    if (index === null) {
      modalTitle.textContent = newtabTranslations[activeLang]['modal-title-add'];
      modalNameInput.value = '';
      modalUrlInput.value = '';
      editingIndex = null;
    } else {
      modalTitle.textContent = newtabTranslations[activeLang]['modal-title-edit'];
      const shortcut = normalizeShortcut(shortcuts[index]) || { name: '', url: '' };
      modalNameInput.value = shortcut.name;
      modalUrlInput.value = shortcut.url;
      editingIndex = index;
    }
    shortcutModal.classList.add('open');
    modalNameInput.focus();
  }

  function closeModal() {
    shortcutModal.classList.remove('open');
  }

  editShortcutsBtn.addEventListener('click', () => {
    editModeActive = !editModeActive;
    if (editModeActive) {
      editShortcutsBtn.textContent = newtabTranslations[activeLang]['edit-btn-active'];
      editShortcutsBtn.classList.add('active');
      shortcutsGrid.classList.add('edit-active');
    } else {
      editShortcutsBtn.textContent = newtabTranslations[activeLang]['edit-btn-default'];
      editShortcutsBtn.classList.remove('active');
      shortcutsGrid.classList.remove('edit-active');
    }
  });

  modalCancelBtn.addEventListener('click', closeModal);

  shortcutModal.addEventListener('click', (e) => {
    if (e.target === shortcutModal) {
      closeModal();
    }
  });

  modalSaveBtn.addEventListener('click', () => {
    const name = modalNameInput.value.trim();
    let url = modalUrlInput.value.trim();

    if (!url) {
      showNewtabAlert(newtabTranslations[activeLang]['url-required']);
      return;
    }

    url = normalizeShortcutUrl(url);
    if (!url) {
      showNewtabAlert(newtabTranslations[activeLang]['url-invalid']);
      return;
    }

    let finalName = name;
    if (!finalName) {
      try {
        finalName = new URL(url).hostname || url;
      } catch (e) {
        finalName = url;
      }
    }

    if (editingIndex === null) {
      shortcuts.push({ name: finalName, url });
    } else {
      shortcuts[editingIndex] = { name: finalName, url };
    }

    saveShortcuts();
    closeModal();
  });

  const visualSettingKeys = new Set(['theme', 'accentColor', 'reduceMotion', 'newtabShowClock', 'newtabShowDate', 'newtabShowWeather', 'newtabShowSearch', 'newtabShowShortcuts', 'newtabTransparentWidgets']);
  const wallpaperSettingKeys = new Set(['newtabBackgroundType', 'newtabWallpaper', 'newtabBackgroundColor', 'newtabPresetWallpaper']);

  // Listen to settings broadcasts from the main process
  if (window.oslo && typeof window.oslo.onSettingsUpdated === 'function') {
    window.oslo.onSettingsUpdated((data) => {
      activeSettings[data.key] = data.value;
      if (data.key === 'language') {
        applyLanguage();
      }
      if (visualSettingKeys.has(data.key)) {
        applyVisualPreferences();
      }
      if (wallpaperSettingKeys.has(data.key)) {
        applyWallpaper();
      }
    });
  } else if (window.oslo && typeof window.oslo.onSettingBroadcast === 'function') {
    window.oslo.onSettingBroadcast(({ type, value }) => {
      const keyMap = { 'wallpaper': 'newtabWallpaper', 'newtab-wallpaper': 'newtabWallpaper' };
      const key = keyMap[type] || type;
      activeSettings[key] = value;
      if (key === 'language') {
        applyLanguage();
      }
      if (visualSettingKeys.has(key)) {
        applyVisualPreferences();
      }
      if (wallpaperSettingKeys.has(key)) {
        applyWallpaper();
      }
    });
  }

  if (activeSettings.newtabShowSearch !== false) {
    searchInput.focus();
  }
});
