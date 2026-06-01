// OSLO Browser - Tab Management Module
import { state } from './state.js';
import { translations } from './i18n.js';
import { renderBookmarks, renderBookmarksBar } from './panels.js';

let draggedTabId = null;

export function renderTabs() {
  const tabsList = document.getElementById('tabs-list');
  if (!tabsList) return;
  tabsList.innerHTML = '';
  
  // Filter tabs that belong to the active workspace
  const visibleTabIds = state.tabOrder.filter(id => state.tabs[id] && state.tabs[id].space === state.activeSpace);
  
  const pinnedTabIds = visibleTabIds.filter(id => state.tabs[id].isPinned);
  const unpinnedTabIds = visibleTabIds.filter(id => !state.tabs[id].isPinned);

  // If there are pinned tabs, create a container for them
  if (pinnedTabIds.length > 0) {
    const pinnedContainer = document.createElement('div');
    pinnedContainer.className = 'pinned-tabs-container';
    
    pinnedTabIds.forEach(tabId => {
      const tab = state.tabs[tabId];
      if (!tab) return;
      
      const tabEl = createTabElement(tab, true);
      pinnedContainer.appendChild(tabEl);
    });
    
    tabsList.appendChild(pinnedContainer);
  }

  // Render unpinned tabs
  unpinnedTabIds.forEach(tabId => {
    const tab = state.tabs[tabId];
    if (!tab) return;
    
    const tabEl = createTabElement(tab, false);
    tabsList.appendChild(tabEl);
  });
}

function createTabElement(tab, isPinned) {
  const tabEl = document.createElement('div');
  tabEl.className = `tab-item ${isPinned ? 'pinned' : ''} ${tab.id === state.activeTabId ? 'active' : ''} ${tab.isIncognito ? 'incognito' : ''} ${tab.isSleeping ? 'sleeping' : ''} ${tab.isPlayingAudio ? 'playing-audio' : ''} ${tab.isMuted ? 'muted' : ''}`;
  let tooltipTitle = tab.title;
  if (!tooltipTitle || tooltipTitle === 'Yeni Sekme' || tooltipTitle === 'New Tab' || tooltipTitle === 'Nouvel Onglet') {
    tooltipTitle = tab.isSleeping ? (translations[state.currentLang]['new-tab-sleeping'] || 'Yeni Sekme (Uykuda)') : (translations[state.currentLang]['new-tab'] || 'Yeni Sekme');
  }
  tabEl.title = tooltipTitle;
  tabEl.dataset.id = tab.id;

  // Drag and Drop (Sürükle Bırak)
  tabEl.setAttribute('draggable', 'true');
  tabEl.addEventListener('dragstart', (e) => {
    draggedTabId = tab.id;
    tabEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  tabEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    tabEl.classList.add('drag-over');
  });
  tabEl.addEventListener('dragleave', () => {
    tabEl.classList.remove('drag-over');
  });
  tabEl.addEventListener('dragend', () => {
    tabEl.classList.remove('dragging');
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('drag-over'));
  });
  tabEl.addEventListener('drop', (e) => {
    e.preventDefault();
    tabEl.classList.remove('drag-over');
    if (draggedTabId && draggedTabId !== tab.id) {
      const sourceTab = state.tabs[draggedTabId];
      if (sourceTab) {
        if (!!sourceTab.isPinned !== !!tab.isPinned) {
          const errMsg = translations[state.currentLang]['drag-pin-error'] || 
                         'Sabitlenmiş ve normal sekmeler arasında sıralama yapılamaz!';
          showToast(errMsg);
        } else {
          const fromIndex = state.tabOrder.indexOf(draggedTabId);
          const toIndex = state.tabOrder.indexOf(tab.id);
          if (fromIndex !== -1 && toIndex !== -1) {
            state.tabOrder.splice(fromIndex, 1);
            state.tabOrder.splice(toIndex, 0, draggedTabId);
            window.oslo.reorderTabs(state.tabOrder);
            renderTabs();
          }
        }
      }
    }
  });

  // Favicon & Loading state
  const favEl = document.createElement('div');
  favEl.className = 'tab-favicon';
  
  if (tab.isLoading) {
    favEl.innerHTML = '<div class="tab-loading-spinner"></div>';
  } else if (tab.favicon) {
    const img = document.createElement('img');
    img.src = tab.favicon;
    img.onerror = () => {
      img.style.display = 'none';
      favEl.innerHTML = getFallbackFavicon(tab.isIncognito);
    };
    favEl.appendChild(img);
  } else {
    favEl.innerHTML = getFallbackFavicon(tab.isIncognito);
  }
  tabEl.appendChild(favEl);

  // If not pinned, render title, close button, and audio controls
  if (!isPinned) {
    // Title
    const titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    let tabTitle = tab.title;
    if (!tabTitle || tabTitle === 'Yeni Sekme' || tabTitle === 'New Tab' || tabTitle === 'Nouvel Onglet') {
      tabTitle = tab.isIncognito ? (translations[state.currentLang]['incognito-tab'] || 'Gizli Sekme') : (translations[state.currentLang]['new-tab'] || 'Yeni Sekme');
    }
    titleEl.textContent = tabTitle;
    tabEl.appendChild(titleEl);

    // Audio/Mute indicator
    if (tab.isPlayingAudio || tab.isMuted) {
      const audioIndicator = document.createElement('button');
      audioIndicator.className = 'tab-audio-btn';
      audioIndicator.innerHTML = tab.isMuted ? '🔇' : '🔊';
      audioIndicator.title = tab.isMuted ? (translations[state.currentLang]['ctx-unmute-tab'] || 'Sesi Aç') : (translations[state.currentLang]['ctx-mute-tab'] || 'Sesi Kapat');
      audioIndicator.addEventListener('click', (e) => {
        e.stopPropagation();
        window.oslo.muteTab(tab.id, !tab.isMuted);
      });
      tabEl.appendChild(audioIndicator);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.oslo.closeTab(tab.id);
    });
    tabEl.appendChild(closeBtn);
  }

  tabEl.addEventListener('click', () => {
    window.oslo.selectTab(tab.id);
  });

  tabEl.addEventListener('auxclick', (e) => {
    if (e.button === 1) {
      e.stopPropagation();
      e.preventDefault();
      window.oslo.closeTab(tab.id);
    }
  });

  tabEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.activeContextTabId = tab.id;

    // Hide bookmarks bar context menu
    const bookmarksBarContextMenu = document.getElementById('bookmarks-bar-context-menu');
    if (bookmarksBarContextMenu) bookmarksBarContextMenu.style.display = 'none';

    // Grey out 'Sleep Tab' if it's the active tab or already sleeping
    const sleepBtn = document.getElementById('ctx-sleep-tab');
    if (sleepBtn) {
      if (tab.id === state.activeTabId || tab.isSleeping) {
        sleepBtn.style.opacity = '0.5';
        sleepBtn.style.pointerEvents = 'none';
      } else {
        sleepBtn.style.opacity = '1';
        sleepBtn.style.pointerEvents = 'auto';
      }
    }

    // Update mute/unmute menu items
    const muteBtn = document.getElementById('ctx-mute-tab');
    const unmuteBtn = document.getElementById('ctx-unmute-tab');
    if (muteBtn && unmuteBtn) {
      if (tab.isMuted) {
        muteBtn.style.display = 'none';
        unmuteBtn.style.display = 'flex';
      } else {
        muteBtn.style.display = 'flex';
        unmuteBtn.style.display = 'none';
      }
    }

    // Update pin/unpin menu items
    const pinBtn = document.getElementById('ctx-pin-tab');
    const unpinBtn = document.getElementById('ctx-unpin-tab');
    if (pinBtn && unpinBtn) {
      if (tab.isPinned) {
        pinBtn.style.display = 'none';
        unpinBtn.style.display = 'flex';
      } else {
        pinBtn.style.display = 'flex';
        unpinBtn.style.display = 'none';
      }
    }

    // Display context menu
    const tabContextMenu = document.getElementById('tab-context-menu');
    if (tabContextMenu) {
      tabContextMenu.style.display = 'block';
      tabContextMenu.style.visibility = 'hidden';
      tabContextMenu.style.width = '';
      tabContextMenu.style.maxWidth = '';
      tabContextMenu.classList.remove('constrained-to-sidebar');
      tabContextMenu.dataset.overlapsContent = 'false';

      // Keep the menu in chrome/sidebar space whenever possible. Native page
      // views sit above DOM when overlapped, so crossing into content needs a
      // preview-backed fallback.
      let x = e.clientX;
      let y = e.clientY;
      let menuWidth = tabContextMenu.offsetWidth || 180;
      const menuHeight = tabContextMenu.offsetHeight || 150;
      const gap = 8;
      const sidebarRect = document.getElementById('sidebar')?.getBoundingClientRect();
      const contentRect = document.getElementById('content-area')?.getBoundingClientRect();
      const sidebarLeft = sidebarRect?.left ?? 0;
      const chromeRight = contentRect?.left ?? window.innerWidth;
      const availableChromeWidth = Math.floor(chromeRight - sidebarLeft - (gap * 2));
      let overlapsContent = false;

      if (contentRect && availableChromeWidth >= menuWidth) {
        x = Math.min(Math.max(x, sidebarLeft + gap), chromeRight - menuWidth - gap);
      } else if (contentRect && availableChromeWidth >= 150) {
        menuWidth = availableChromeWidth;
        tabContextMenu.style.width = `${availableChromeWidth}px`;
        tabContextMenu.style.maxWidth = `${availableChromeWidth}px`;
        tabContextMenu.classList.add('constrained-to-sidebar');
        x = sidebarLeft + gap;
      } else {
        overlapsContent = !!contentRect;
        if (x + menuWidth > window.innerWidth) {
          x = window.innerWidth - menuWidth - gap;
        }
        x = Math.max(gap, x);
      }

      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - gap;
      }
      y = Math.max(gap, y);

      tabContextMenu.style.left = `${x}px`;
      tabContextMenu.style.top = `${y}px`;
      tabContextMenu.dataset.overlapsContent = overlapsContent ? 'true' : 'false';

      const revealMenu = () => {
        tabContextMenu.style.visibility = '';
        window.dispatchEvent(new Event('resize'));
      };

      if (overlapsContent && window.osloContentPreview?.show) {
        Promise.resolve(window.osloContentPreview.show()).finally(revealMenu);
      } else {
        revealMenu();
      }
    }
  });

  return tabEl;
}

export function getFallbackFavicon(isIncognito) {
  if (isIncognito) {
    return `
      <svg class="tab-favicon-fallback" viewBox="0 0 24 24" width="16" height="16" style="color: #a855f7;">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/>
      </svg>
    `;
  }
  return `
    <svg class="tab-favicon-fallback" viewBox="0 0 24 24" width="16" height="16">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 0 1 5.08 16zm2.95-8H5.08a7.987 7.987 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a7.987 7.987 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z" fill="currentColor"/>
    </svg>
  `;
}

export function updateBookmarkIcon() {
  const addBookmarkBtn = document.getElementById('add-bookmark-btn');
  if (!addBookmarkBtn) return;
  const activeTab = state.tabs[state.activeTabId];
  if (!activeTab || activeTab.url.includes('newtab.html')) {
    addBookmarkBtn.style.visibility = 'hidden';
    return;
  }
  addBookmarkBtn.style.visibility = 'visible';
  const isBookmarked = state.bookmarks.some(b => b.url === activeTab.url);
  if (isBookmarked) {
    addBookmarkBtn.classList.add('active');
    addBookmarkBtn.title = translations[state.currentLang]['remove-bookmark-title'] || 'Yer imini kaldır';
    addBookmarkBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="currentColor"/></svg>
    `;
  } else {
    addBookmarkBtn.classList.remove('active');
    addBookmarkBtn.title = translations[state.currentLang]['add-bookmark-title'] || 'Bu sayfayı yer imlerine ekle';
    addBookmarkBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z" fill="currentColor"/></svg>
    `;
  }
}

function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  
  toast.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="#ef4444">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </svg>
  `;
  const messageEl = document.createElement('span');
  messageEl.textContent = message;
  toast.appendChild(messageEl);
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}
