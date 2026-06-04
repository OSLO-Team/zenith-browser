(function () {
  const translations = {
    tr: {
      pageTitle: 'Gizli Sekme',
      searchPlaceholder: 'Gizli modda ara veya URL gir...',
      badge: 'Gizli Mod',
      title: 'Gizli sekmedesiniz',
      subtitle: 'Bu pencere, bu cihazda gezinme izlerinizi daha sınırlı tutar. Yine de çevrim içi görünürlüğünüz tamamen kaybolmaz.',
      howTitle: 'Gizli mod nasıl çalışır?',
      howBody: 'Gizli sekmeler ayrı bir geçici oturum kullanır. Sekmeyi kapattığınızda bu oturumdaki yerel izlerin büyük bölümü temizlenir.',
      notSavedTitle: 'Bu cihazda kaydedilmez',
      notSavedHistory: 'Gezinme geçmişi',
      notSavedCookies: 'Gizli oturum çerezleri ve site verileri',
      notSavedForms: 'Formlara yazdığınız bilgiler',
      notSavedSearches: 'Adres çubuğu aramaları',
      visibleTitle: 'Hala görünür olabilir',
      visibleSites: 'Ziyaret ettiğiniz siteler',
      visibleProvider: 'İnternet servis sağlayıcınız',
      visibleNetwork: 'İş yeri, okul veya bağlı olduğunuz ağ yöneticisi',
      visibleDownloads: 'İndirdiğiniz dosyalar ve bilerek kaydettiğiniz yer imleri',
      tipsTitle: 'Daha güvenli kullanım için',
      tipOneTitle: 'Hesap oturumları',
      tipOneBody: 'Bir siteye giriş yaparsanız, o site hesabınızla yaptığınız işlemleri görebilir.',
      tipTwoTitle: 'Ağ görünürlüğü',
      tipTwoBody: 'Gizli mod VPN değildir; ağ trafiğinizi servis sağlayıcınızdan veya ağ yöneticinizden saklamaz.',
      tipThreeTitle: 'Paylaşılan cihazlar',
      tipThreeBody: 'İndirme klasörü, ekran görüntüleri ve açık oturumlar gibi cihaz üzerindeki izleri ayrıca kontrol edin.'
    },
    en: {
      pageTitle: 'Incognito Tab',
      searchPlaceholder: 'Search privately or enter URL...',
      badge: 'Incognito Mode',
      title: 'You are in an incognito tab',
      subtitle: 'This window keeps browsing traces more limited on this device. Your online visibility does not fully disappear.',
      howTitle: 'How incognito mode works',
      howBody: 'Incognito tabs use a separate temporary session. When you close the tab, most local traces from that session are cleared.',
      notSavedTitle: 'Not saved on this device',
      notSavedHistory: 'Browsing history',
      notSavedCookies: 'Incognito session cookies and site data',
      notSavedForms: 'Information you enter into forms',
      notSavedSearches: 'Address bar searches',
      visibleTitle: 'May still be visible',
      visibleSites: 'Websites you visit',
      visibleProvider: 'Your internet service provider',
      visibleNetwork: 'Your employer, school, or network administrator',
      visibleDownloads: 'Downloaded files and bookmarks you intentionally save',
      tipsTitle: 'For safer browsing',
      tipOneTitle: 'Signed-in accounts',
      tipOneBody: 'If you sign in to a website, that site can see activity tied to your account.',
      tipTwoTitle: 'Network visibility',
      tipTwoBody: 'Incognito mode is not a VPN; it does not hide network traffic from your provider or network administrator.',
      tipThreeTitle: 'Shared devices',
      tipThreeBody: 'Also check device traces such as the downloads folder, screenshots, and sessions left open.'
    },
    fr: {
      pageTitle: 'Onglet Privé',
      searchPlaceholder: 'Rechercher en privé ou saisir une URL...',
      badge: 'Mode Privé',
      title: 'Vous êtes dans un onglet privé',
      subtitle: 'Cette fenêtre limite davantage les traces de navigation sur cet appareil. Votre visibilité en ligne ne disparaît pas totalement.',
      howTitle: 'Fonctionnement du mode privé',
      howBody: 'Les onglets privés utilisent une session temporaire séparée. Lorsque vous fermez l’onglet, la plupart des traces locales de cette session sont supprimées.',
      notSavedTitle: 'Non enregistré sur cet appareil',
      notSavedHistory: 'Historique de navigation',
      notSavedCookies: 'Cookies et données de sites de la session privée',
      notSavedForms: 'Informations saisies dans les formulaires',
      notSavedSearches: 'Recherches dans la barre d’adresse',
      visibleTitle: 'Peut rester visible',
      visibleSites: 'Sites que vous consultez',
      visibleProvider: 'Votre fournisseur d’accès à Internet',
      visibleNetwork: 'Votre employeur, établissement scolaire ou administrateur réseau',
      visibleDownloads: 'Fichiers téléchargés et favoris enregistrés volontairement',
      tipsTitle: 'Pour une navigation plus sûre',
      tipOneTitle: 'Comptes connectés',
      tipOneBody: 'Si vous vous connectez à un site, ce site peut voir l’activité liée à votre compte.',
      tipTwoTitle: 'Visibilité réseau',
      tipTwoBody: 'Le mode privé n’est pas un VPN; il ne masque pas le trafic réseau à votre fournisseur ou administrateur réseau.',
      tipThreeTitle: 'Appareils partagés',
      tipThreeBody: 'Vérifiez aussi les traces sur l’appareil, comme le dossier de téléchargements, les captures d’écran et les sessions restées ouvertes.'
    }
  };

  let activeLang = 'tr';
  let activeSearchEngine = 'duckduckgo';
  const dropdown = document.getElementById('incognito-topbar-autocomplete');
  const searchForm = document.getElementById('incognito-search-form');
  const searchInput = document.getElementById('incognito-search-input');

  function resolveLanguage(value) {
    return Object.prototype.hasOwnProperty.call(translations, value) ? value : 'tr';
  }

  function applyLanguage(lang) {
    activeLang = resolveLanguage(lang);
    const copy = translations[activeLang];
    document.documentElement.lang = activeLang;
    document.title = copy.pageTitle;
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (copy[key]) node.textContent = copy[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      const key = node.getAttribute('data-i18n-placeholder');
      if (copy[key]) node.setAttribute('placeholder', copy[key]);
    });
  }

  function formatSearch(value, engine = 'duckduckgo') {
    const query = String(value || '').trim();
    if (!query) return '';

    if (/^(https?:\/\/|file:\/\/)/i.test(query)) return query;

    const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/\S*)?$/;
    if (domainPattern.test(query)) {
      return `https://${query}`;
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

  function iconFor(type) {
    if (type === 'search') return '⌕';
    if (type === 'bookmark') return '★';
    if (type === 'history') return '↪';
    if (type === 'command') return '☰';
    return '□';
  }

  function topbarIconFor(type) {
    const icons = {
      command: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M4 17h4v-2H4v2zm0-4h10v-2H4v2zm0-6v2h16V7H4zm13 10 5-5-5-5v3h-5v4h5v3z"/></svg>',
      tab: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>',
      search: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5C16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
      bookmark: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>',
      history: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M13 3c-4.4 0-8 3.6-8 8H2.5l3.3 3.3.1.2L9.5 11H7c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6c-1.7 0-3.2-.7-4.2-1.8l-1.4 1.4C8.8 18.1 10.8 19 13 19c4.4 0 8-3.6 8-8s-3.6-8-8-8zm-1 4v5l4.2 2.5.8-1.3-3.5-2.1V7H12z"/></svg>'
    };
    return icons[type] || icons.search;
  }

  function renderTopbarAutocomplete(payload = {}) {
    if (!dropdown) return;
    const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
    if (suggestions.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    const position = payload.position || {};
    dropdown.style.left = `${Math.max(8, Math.round(position.left || 8))}px`;
    dropdown.style.top = `${Math.max(0, Math.round(position.top || 0))}px`;
    dropdown.style.width = `${Math.max(180, Math.round(position.width || 320))}px`;
    dropdown.style.maxHeight = `${Math.max(120, Math.round(position.maxHeight || 320))}px`;
    dropdown.innerHTML = suggestions.map((item, index) => {
      const selected = index === payload.selectedIndex ? ' selected' : '';
      const title = escapeHtml(item.title || item.url || '');
      const url = escapeHtml(item.url || '');
      return `
        <div class="autocomplete-item${selected}" data-index="${index}">
          <span class="autocomplete-icon">${topbarIconFor(item.type)}</span>
          <span class="autocomplete-text">
            <span class="autocomplete-title">${title}</span>
            <span class="autocomplete-url">${url}</span>
          </span>
        </div>
      `;
    }).join('');
    dropdown.style.display = 'block';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  dropdown?.addEventListener('mousedown', (event) => {
    const item = event.target.closest?.('.autocomplete-item');
    if (!item) return;
    event.preventDefault();
    const index = Number(item.dataset.index);
    if (Number.isInteger(index) && window.oslo?.activateTopbarAutocomplete) {
      window.oslo.activateTopbarAutocomplete(index);
    }
  });

  searchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const target = formatSearch(searchInput?.value, activeSearchEngine);
    if (target) {
      window.location.href = target;
    }
  });

  if (window.oslo?.getAllSettings) {
    window.oslo.getAllSettings().then((settings) => {
      activeSearchEngine = settings?.searchEngine || activeSearchEngine;
      applyLanguage(settings?.language || 'tr');
    }).catch(() => applyLanguage('tr'));
  } else {
    applyLanguage('tr');
  }

  window.oslo?.onSettingsUpdated?.((data) => {
    if (data?.key === 'language') {
      applyLanguage(data.value);
    } else if (data?.key === 'searchEngine') {
      activeSearchEngine = data.value || activeSearchEngine;
    }
  });

  window.oslo?.onSettingBroadcast?.(({ type, value }) => {
    if (type === 'language') {
      applyLanguage(value);
    } else if (type === 'searchEngine') {
      activeSearchEngine = value || activeSearchEngine;
    }
  });

  window.oslo?.onTopbarAutocompleteShow?.(renderTopbarAutocomplete);
  window.oslo?.onTopbarAutocompleteHide?.(() => {
    if (dropdown) dropdown.style.display = 'none';
  });
})();
