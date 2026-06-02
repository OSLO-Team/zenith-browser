// OSLO Browser - Panels Management Module
import { state } from './state.js';
import { translations } from './i18n.js';
import { updateBookmarkIcon } from './tabs.js';

let bookmarksDropdownPreviewToken = 0;

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

function openOverlayWithContentPreview(modal, onReady) {
  if (!modal) return;

  const preview = window.osloContentPreview;
  const finish = () => {
    if (typeof onReady === 'function') onReady();
  };

  if (preview && typeof preview.openModal === 'function') {
    preview.openModal(modal).then(finish).catch(() => {
      modal.classList.add('open');
      window.dispatchEvent(new Event('resize'));
      finish();
    });
    return;
  }

  modal.classList.add('open');
  window.dispatchEvent(new Event('resize'));
  finish();
}

function closeOverlayWithContentPreview(modal) {
  const preview = window.osloContentPreview;
  if (preview && typeof preview.closeModal === 'function') {
    preview.closeModal(modal);
    return;
  }

  modal?.classList.remove('open');
  window.dispatchEvent(new Event('resize'));
}

function showContentPreview() {
  const preview = window.osloContentPreview;
  if (preview && typeof preview.show === 'function') {
    return Promise.resolve(preview.show());
  }
  return Promise.resolve(false);
}

function clearContentPreviewSoon() {
  const preview = window.osloContentPreview;
  if (preview && typeof preview.clearSoon === 'function') {
    preview.clearSoon();
  }
}

function positionBookmarksDropdown(dropdown, anchorRect, { submenu = false } = {}) {
  if (!dropdown || !anchorRect) return;

  const gap = 8;
  const offset = 4;
  const menuWidth = dropdown.offsetWidth || 220;
  const menuHeight = dropdown.offsetHeight || 180;
  const maxX = Math.max(gap, window.innerWidth - menuWidth - gap);
  const maxY = Math.max(gap, window.innerHeight - menuHeight - gap);
  let x = submenu ? anchorRect.right + offset : anchorRect.left;
  let y = submenu ? anchorRect.top : anchorRect.bottom + offset;

  if (submenu && x + menuWidth > window.innerWidth - gap) {
    x = anchorRect.left - menuWidth - offset;
  }
  if (!submenu && y + menuHeight > window.innerHeight - gap) {
    y = anchorRect.top - menuHeight - offset;
  }

  x = Math.min(Math.max(gap, x), maxX);
  y = Math.min(Math.max(gap, y), maxY);
  dropdown.style.left = `${Math.round(x)}px`;
  dropdown.style.top = `${Math.round(y)}px`;
}

function getBookmarkFaviconUrl(bookmark) {
  if (bookmark?.favicon) return bookmark.favicon;

  let domain = '';
  try {
    domain = new URL(bookmark.url).hostname;
  } catch (e) {
    domain = bookmark.url || '';
  }
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
}

export function initPanels() {
  const bookmarksSearchInput = document.getElementById('bookmarks-search-input');
  if (bookmarksSearchInput) {
    bookmarksSearchInput.addEventListener('input', () => {
      renderBookmarks();
    });
  }

  const addFolderBtn = document.getElementById('add-folder-btn');
  if (addFolderBtn) {
    addFolderBtn.addEventListener('click', () => {
      addFolder(null);
    });
  }

  const bookmarksBar = document.getElementById('bookmarks-bar');
  const bookmarksBarContextMenu = document.getElementById('bookmarks-bar-context-menu');
  if (bookmarksBar && bookmarksBarContextMenu) {
    bookmarksBar.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      // Hide tab context menu
      const tabContextMenu = document.getElementById('tab-context-menu');
      if (tabContextMenu) tabContextMenu.style.display = 'none';

      // Keep the menu in chrome space so the page view does not need to be hidden.
      let x = e.clientX;
      let y = e.clientY;

      bookmarksBarContextMenu.style.display = 'block';
      bookmarksBarContextMenu.style.visibility = 'hidden';

      const menuWidth = bookmarksBarContextMenu.offsetWidth || 180;
      const menuHeight = bookmarksBarContextMenu.offsetHeight || 50;
      const contentTop = document.getElementById('content-area')?.getBoundingClientRect().top ?? window.innerHeight;

      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
      }
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
      }
      if (y + menuHeight > contentTop && contentTop - menuHeight - 4 >= 8) {
        y = contentTop - menuHeight - 4;
      }

      x = Math.max(8, x);
      y = Math.max(8, y);

      bookmarksBarContextMenu.style.left = `${x}px`;
      bookmarksBarContextMenu.style.top = `${y}px`;
      bookmarksBarContextMenu.style.visibility = '';
      window.dispatchEvent(new Event('resize'));
    });
  }

  const bookmarksBarList = document.getElementById('bookmarks-bar-list');
  if (bookmarksBarList) {
    bookmarksBarList.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (state.draggedBookmarkId) {
        bookmarksBarList.classList.add('drag-over');
      }
    });

    bookmarksBarList.addEventListener('dragleave', () => {
      bookmarksBarList.classList.remove('drag-over');
    });

    bookmarksBarList.addEventListener('drop', (e) => {
      e.preventDefault();
      bookmarksBarList.classList.remove('drag-over');

      const draggedId = e.dataTransfer.getData('text/plain') || state.draggedBookmarkId;
      if (draggedId) {
        moveBookmark(draggedId, null);
      }
    });
  }

  const ctxAddFolder = document.getElementById('ctx-add-folder');
  if (ctxAddFolder) {
    ctxAddFolder.addEventListener('click', () => {
      addFolder(null);
    });
  }

  // --- Folder Creation Modal Bindings ---
  const folderCreateModal = document.getElementById('folder-create-modal');
  const folderCreateNameInput = document.getElementById('folder-create-name');
  const closeFolderCreateModal = () => {
    closeOverlayWithContentPreview(folderCreateModal);
  };

  document.getElementById('close-folder-create-modal')?.addEventListener('click', closeFolderCreateModal);
  document.getElementById('btn-cancel-folder-create')?.addEventListener('click', closeFolderCreateModal);

  // Click overlay to close
  if (folderCreateModal) {
    folderCreateModal.addEventListener('click', (e) => {
      if (e.target === folderCreateModal) closeFolderCreateModal();
    });
  }

  document.getElementById('btn-confirm-folder-create')?.addEventListener('click', () => {
    confirmFolderCreate();
  });

  // Enter key to confirm
  if (folderCreateNameInput) {
    folderCreateNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmFolderCreate();
      }
    });
  }

  const historySearchInput = document.getElementById('history-search-input');
  if (historySearchInput) {
    historySearchInput.addEventListener('input', () => {
      renderHistory();
    });
  }

  const historyFilterItems = document.querySelectorAll('[data-history-filter]');
  historyFilterItems.forEach(item => {
    item.addEventListener('click', () => {
      historyFilterItems.forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      state.historyFilter = item.getAttribute('data-history-filter') || 'all';
      renderHistory();
    });
  });

  // Panel Close buttons
  const closeBookmarks = document.getElementById('close-bookmarks');
  if (closeBookmarks) {
    closeBookmarks.addEventListener('click', () => {
      document.getElementById('bookmarks-panel')?.classList.remove('open');
    });
  }

  const closeHistory = document.getElementById('close-history');
  if (closeHistory) {
    closeHistory.addEventListener('click', () => {
      document.getElementById('history-panel')?.classList.remove('open');
      window.dispatchEvent(new Event('resize'));
    });
  }

  const closeDownloads = document.getElementById('close-downloads');
  if (closeDownloads) {
    closeDownloads.addEventListener('click', () => {
      document.getElementById('downloads-overlay')?.classList.remove('open');
      window.dispatchEvent(new Event('resize'));
    });
  }

  const clearDownloadsBtn = document.getElementById('clear-downloads-btn');
  if (clearDownloadsBtn) {
    clearDownloadsBtn.addEventListener('click', () => {
      window.oslo.clearDownloads().then(() => {
        state.downloads = {};
        renderDownloads();
      });
    });
  }

  // Bind Downloads Category Filters (All, Completed, Progressing)
  const dlFilterItems = document.querySelectorAll('[data-downloads-filter]');
  dlFilterItems.forEach(item => {
    item.addEventListener('click', () => {
      dlFilterItems.forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      state.downloadsFilter = item.getAttribute('data-downloads-filter');

      const titleEl = document.getElementById('downloads-header-title');
      if (titleEl) {
        if (state.downloadsFilter === 'all') titleEl.textContent = translations[state.currentLang]['downloads-all'] || 'Tüm İndirmeler';
        else if (state.downloadsFilter === 'progressing') titleEl.textContent = translations[state.currentLang]['downloads-progressing'] || 'Devam Edenler';
        else if (state.downloadsFilter === 'completed') titleEl.textContent = translations[state.currentLang]['downloads-completed'] || 'Tamamlananlar';
      }
      renderDownloads();
    });
  });

  // Bind Downloads Search Input
  const dlSearch = document.getElementById('downloads-search-input');
  if (dlSearch) {
    dlSearch.addEventListener('input', () => {
      renderDownloads();
    });
  }

  const deleteBookmarkEditBtn = document.getElementById('btn-delete-bookmark-edit');
  if (deleteBookmarkEditBtn) {
    deleteBookmarkEditBtn.addEventListener('click', () => {
      const editId = state.editingBookmarkId;
      if (!editId) return;

      const item = state.bookmarks.find(b => b.id === editId);
      if (item) {
        if (item.isFolder) {
          deleteFolderAndContents(item.id);
        } else {
          deleteBookmarkItem(item.id);
        }
      }

      const modal = document.getElementById('bookmark-edit-modal');
      closeOverlayWithContentPreview(modal);
    });
  }
}

// Opens the folder creation modal instead of prompt()
export function addFolder(parentFolderId = null) {
  closeAllBookmarksDropdowns();
  state._pendingFolderParentId = parentFolderId;
  const folderCreateModal = document.getElementById('folder-create-modal');
  const folderCreateNameInput = document.getElementById('folder-create-name');
  const defaultName = (translations[state.currentLang] && translations[state.currentLang]['new-folder-default-name']) || 'Yeni Klasör';

  if (folderCreateNameInput) {
    folderCreateNameInput.value = defaultName;
  }
  if (folderCreateModal) {
    openOverlayWithContentPreview(folderCreateModal, () => {
      if (folderCreateNameInput) {
        setTimeout(() => {
          folderCreateNameInput.focus();
          folderCreateNameInput.select();
        }, 100);
      }
    });
  }
}

// Called when user confirms folder creation from the modal
function confirmFolderCreate() {
  const folderCreateModal = document.getElementById('folder-create-modal');
  const folderCreateNameInput = document.getElementById('folder-create-name');
  const defaultName = (translations[state.currentLang] && translations[state.currentLang]['new-folder-default-name']) || 'Yeni Klasör';

  const name = (folderCreateNameInput?.value || '').trim() || defaultName;
  const parentFolderId = state._pendingFolderParentId || null;

  const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const newFolder = {
    id: generateId(),
    isFolder: true,
    title: name,
    folderId: parentFolderId
  };

  const newBookmarksList = [...state.bookmarks, newFolder];
  window.oslo.setBookmarks(newBookmarksList).then(updated => {
    state.bookmarks = updated;
    renderBookmarks();
    renderBookmarksBar();
  });

  closeOverlayWithContentPreview(folderCreateModal);
  state._pendingFolderParentId = null;
}

// Helper to check descendant relation (avoid circular nesting)
function isDescendant(parentFolderId, folderId) {
  if (!parentFolderId || !folderId) return false;
  let current = state.bookmarks.find(b => b.id === folderId);
  while (current && current.folderId) {
    if (current.folderId === parentFolderId) return true;
    current = state.bookmarks.find(b => b.id === current.folderId);
  }
  return false;
}

// Move bookmark or folder to target folder
function moveBookmark(id, targetFolderId) {
  const index = state.bookmarks.findIndex(b => b.id === id);
  if (index !== -1) {
    state.bookmarks[index].folderId = targetFolderId;
    window.oslo.setBookmarks(state.bookmarks).then(updated => {
      state.bookmarks = updated;
      renderBookmarks();
      renderBookmarksBar();
    });
  }
}

// Move bookmark or folder to target folder and reorder it next to the target item
function moveBookmarkAndReorder(id, targetItem) {
  const draggedIndex = state.bookmarks.findIndex(b => b.id === id);
  const targetIndex = state.bookmarks.findIndex(b => b.id === targetItem.id);
  if (draggedIndex === -1 || targetIndex === -1) return;

  const dragged = state.bookmarks[draggedIndex];

  // Set the folderId of the dragged item to target folderId
  dragged.folderId = targetItem.folderId === undefined ? null : targetItem.folderId;

  // Remove dragged item from its old position
  state.bookmarks.splice(draggedIndex, 1);

  // Find target index again because array length changed
  const newTargetIndex = state.bookmarks.findIndex(b => b.id === targetItem.id);

  // Insert at target index
  state.bookmarks.splice(newTargetIndex, 0, dragged);

  window.oslo.setBookmarks(state.bookmarks).then(updated => {
    state.bookmarks = updated;
    renderBookmarks();
    renderBookmarksBar();
  });
}

// Delete folder and all its contents recursively
function deleteFolderAndContents(folderId) {
  const idsToDelete = new Set([folderId]);
  let foundNew = true;
  while (foundNew) {
    foundNew = false;
    state.bookmarks.forEach(b => {
      if (b.folderId && idsToDelete.has(b.folderId) && !idsToDelete.has(b.id)) {
        idsToDelete.add(b.id);
        foundNew = true;
      }
    });
  }

  const remaining = state.bookmarks.filter(b => !idsToDelete.has(b.id));
  window.oslo.setBookmarks(remaining).then(updated => {
    state.bookmarks = updated;
    updateBookmarkIcon();
    renderBookmarks();
    renderBookmarksBar();
  });
}

// Delete single bookmark item
function deleteBookmarkItem(id) {
  const remaining = state.bookmarks.filter(b => b.id !== id);
  window.oslo.setBookmarks(remaining).then(updated => {
    state.bookmarks = updated;
    updateBookmarkIcon();
    renderBookmarks();
    renderBookmarksBar();
  });
}

function setupDragDropListeners(el, item) {
  el.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    state.draggedBookmarkId = item.id;
    el.classList.add('dragging');
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
  });

  el.addEventListener('dragend', (e) => {
    e.stopPropagation();
    el.classList.remove('dragging');
    state.draggedBookmarkId = null;
    document.querySelectorAll('.panel-folder-header, .panel-item, .panel-content, .bookmarks-bar-item, .bookmarks-bar-list, .panel-folder-children, .bookmarks-bar-dropdown-item').forEach(el => {
      el.classList.remove('drag-over');
    });
    if (typeof closeAllBookmarksDropdowns === 'function') {
      closeAllBookmarksDropdowns();
    }
  });

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (state.draggedBookmarkId) {
      if (state.draggedBookmarkId === item.id) return;
      if (item.isFolder && isDescendant(state.draggedBookmarkId, item.id)) return;
    }

    el.classList.add('drag-over');
  });

  el.addEventListener('dragleave', (e) => {
    e.stopPropagation();
    el.classList.remove('drag-over');
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drag-over');

    const draggedId = e.dataTransfer.getData('text/plain') || state.draggedBookmarkId;
    if (!draggedId || draggedId === item.id) return;

    if (!item.isFolder) {
      // Dropped on a bookmark, move to same folder as the bookmark and reorder!
      moveBookmarkAndReorder(draggedId, item);
    } else {
      // Dropped on a folder, move inside
      if (isDescendant(draggedId, item.id)) return;
      moveBookmark(draggedId, item.id);
    }
  });
}

function renderTree(parentId, containerEl, depth) {
  const children = state.bookmarks.filter(b => {
    const bFolderId = b.folderId === undefined ? null : b.folderId;
    return bFolderId === parentId;
  });

  if (children.length === 0 && parentId !== null) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.padding = '6px 12px';
    emptyMsg.style.fontSize = '11px';
    emptyMsg.style.color = 'var(--text-muted)';
    emptyMsg.style.fontStyle = 'italic';
    emptyMsg.textContent = translations[state.currentLang]['empty-folder'] || '(Klasör boş)';
    containerEl.appendChild(emptyMsg);
    return;
  }

  children.forEach(b => {
    if (b.isFolder) {
      const folderEl = document.createElement('div');
      folderEl.className = 'panel-folder-item';

      const isExpanded = state.expandedFolders && state.expandedFolders.includes(b.id);

      const headerEl = document.createElement('div');
      headerEl.className = 'panel-folder-header';
      headerEl.setAttribute('draggable', 'true');
      headerEl.innerHTML = `
        <span class="folder-caret ${isExpanded ? 'expanded' : ''}">
          <svg viewBox="0 0 24 24" width="12" height="12"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="currentColor"/></svg>
        </span>
        <span class="folder-icon" style="color: var(--accent-color); margin-right: 6px; display: flex; align-items: center;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        </span>
        <span class="folder-title" style="flex: 1; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(b.title)}</span>
        <div class="panel-item-actions">
          <button class="panel-item-btn edit-btn" title="${translations[state.currentLang]['edit-folder-title'] || 'Klasörü Düzenle'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
          <button class="panel-item-btn delete-btn" title="${translations[state.currentLang]['delete-folder-title'] || 'Klasörü Sil'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      `;

      const caret = headerEl.querySelector('.folder-caret');
      const titleSpan = headerEl.querySelector('.folder-title');
      const toggleExpand = (e) => {
        e.stopPropagation();
        if (!state.expandedFolders) state.expandedFolders = [];
        const index = state.expandedFolders.indexOf(b.id);
        if (index === -1) {
          state.expandedFolders.push(b.id);
        } else {
          state.expandedFolders.splice(index, 1);
        }
        renderBookmarks();
      };

      caret.addEventListener('click', toggleExpand);
      titleSpan.addEventListener('click', toggleExpand);

      const editBtn = headerEl.querySelector('.edit-btn');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openBookmarkEditModal(b);
      });

      const deleteBtn = headerEl.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFolderAndContents(b.id);
      });

      setupDragDropListeners(headerEl, b);

      folderEl.appendChild(headerEl);

      const childrenContainer = document.createElement('div');
      childrenContainer.className = `panel-folder-children ${isExpanded ? 'open' : ''}`;
      childrenContainer.style.paddingLeft = '12px';
      childrenContainer.style.display = isExpanded ? 'block' : 'none';
      childrenContainer.style.borderLeft = '1px dashed var(--border-color)';
      childrenContainer.style.marginLeft = '12px';
      childrenContainer.style.marginTop = '4px';
      childrenContainer.style.marginBottom = '4px';

      childrenContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (state.draggedBookmarkId) {
          if (state.draggedBookmarkId === b.id) return;
          if (isDescendant(state.draggedBookmarkId, b.id)) return;
          childrenContainer.classList.add('drag-over');
        }
      });

      childrenContainer.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        childrenContainer.classList.remove('drag-over');
      });

      childrenContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        childrenContainer.classList.remove('drag-over');

        const draggedId = e.dataTransfer.getData('text/plain') || state.draggedBookmarkId;
        if (!draggedId || draggedId === b.id) return;
        if (isDescendant(draggedId, b.id)) return;

        moveBookmark(draggedId, b.id);
      });

      renderTree(b.id, childrenContainer, depth + 1);
      folderEl.appendChild(childrenContainer);

      containerEl.appendChild(folderEl);
    } else {
      const item = document.createElement('div');
      item.className = 'panel-item';
      item.setAttribute('draggable', 'true');

      const faviconUrl = getBookmarkFaviconUrl(b);

      item.innerHTML = `
        <img class="panel-item-favicon" src="${escapeAttribute(faviconUrl)}" onerror="this.src='../../assets/logo.svg'">
        <div class="panel-item-info">
          <div class="panel-item-title">${escapeHtml(b.title)}</div>
          <div class="panel-item-url">${escapeHtml(b.url)}</div>
        </div>
        <div class="panel-item-actions">
          <button class="panel-item-btn edit-btn" title="${translations[state.currentLang]['edit-bookmark-title'] || 'Yer İmini Düzenle'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
          <button class="panel-item-btn delete-btn" title="${translations[state.currentLang]['remove-bookmark-title'] || 'Yer imini kaldır'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.panel-item-actions')) return;
        if (state.activeTabId) {
          window.oslo.navigate(state.activeTabId, b.url);
          document.getElementById('bookmarks-panel')?.classList.remove('open');
        }
      });

      const editBtn = item.querySelector('.edit-btn');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openBookmarkEditModal(b);
      });

      const deleteBtn = item.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteBookmarkItem(b.id);
      });

      setupDragDropListeners(item, b);

      containerEl.appendChild(item);
    }
  });
}

function showBookmarksDropdown(folderId, triggerEl, isSubmenu = false) {
  const previewReady = triggerEl.dataset.bookmarksPreviewReady === 'true';
  if (!isSubmenu && !previewReady) {
    const wasActive = triggerEl.classList.contains('dropdown-active');
    closeAllBookmarksDropdowns();
    if (wasActive) {
      clearContentPreviewSoon();
      return null;
    }

    const token = ++bookmarksDropdownPreviewToken;
    const openDropdown = () => {
      if (token !== bookmarksDropdownPreviewToken) return;
      triggerEl.dataset.bookmarksPreviewReady = 'true';
      showBookmarksDropdown(folderId, triggerEl, false);
      delete triggerEl.dataset.bookmarksPreviewReady;
    };

    showContentPreview().then(openDropdown).catch(openDropdown);
    return null;
  }

  if (!isSubmenu) {
    const wasActive = triggerEl.classList.contains('dropdown-active');
    if (!previewReady) {
      closeAllBookmarksDropdowns();
    }
    if (wasActive) {
      return null;
    }
    triggerEl.classList.add('dropdown-active');
  }

  const dropdown = document.createElement('div');
  dropdown.className = 'bookmarks-bar-dropdown';
  if (isSubmenu) {
    dropdown.classList.add('submenu');
  }

  const items = state.bookmarks.filter(b => {
    const bFolderId = b.folderId === undefined ? null : b.folderId;
    return bFolderId === folderId;
  });

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.style.padding = '8px 12px';
    empty.style.fontSize = '12px';
    empty.style.color = 'var(--text-muted)';
    empty.style.fontStyle = 'italic';
    empty.textContent = translations[state.currentLang]['empty-folder'] || '(Klasör boş)';
    dropdown.appendChild(empty);
  }

  items.forEach(b => {
    const itemEl = document.createElement('div');
    itemEl.className = 'bookmarks-bar-dropdown-item';
    itemEl.setAttribute('draggable', 'true');

    if (b.isFolder) {
      itemEl.innerHTML = `
        <span style="color: var(--accent-color); display: flex; align-items: center; margin-right: 4px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        </span>
        <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">${escapeHtml(b.title)}</span>
        <span style="font-size: 8px; color: var(--text-muted); margin-left: 8px;">▶</span>
      `;

      let subMenuTimeout = null;
      let subMenuEl = null;

      const openSubMenu = () => {
        if (subMenuEl) return;
        if (dropdown.activeSubmenu) {
          dropdown.activeSubmenu.remove();
          dropdown.activeSubmenu = null;
        }
        const rect = itemEl.getBoundingClientRect();
        subMenuEl = showBookmarksDropdown(b.id, itemEl, true);
        positionBookmarksDropdown(subMenuEl, rect, { submenu: true });
        dropdown.activeSubmenu = subMenuEl;

        subMenuEl.addEventListener('mouseleave', (e) => {
          subMenuTimeout = setTimeout(() => {
            if (e.relatedTarget !== itemEl && !itemEl.contains(e.relatedTarget)) {
              closeSubMenu();
              if (dropdown.activeSubmenu === subMenuEl) {
                dropdown.activeSubmenu = null;
              }
            }
          }, 150);
        });
      };

      const closeSubMenu = () => {
        if (subMenuEl) {
          subMenuEl.remove();
          subMenuEl = null;
          window.dispatchEvent(new Event('resize'));
        }
      };

      itemEl.addEventListener('mouseenter', () => {
        clearTimeout(subMenuTimeout);
        openSubMenu();
      });

      itemEl.addEventListener('mouseleave', (e) => {
        subMenuTimeout = setTimeout(() => {
          if (subMenuEl && !subMenuEl.contains(e.relatedTarget) && e.relatedTarget !== subMenuEl) {
            closeSubMenu();
            if (dropdown.activeSubmenu === subMenuEl) {
              dropdown.activeSubmenu = null;
            }
          }
        }, 150);
      });
    } else {
      const faviconUrl = getBookmarkFaviconUrl(b);

      itemEl.innerHTML = `
        <img class="bookmarks-bar-favicon" src="${escapeAttribute(faviconUrl)}" onerror="this.src='../../assets/logo.svg'" style="margin-right: 4px;">
        <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(b.title)}</span>
      `;

      itemEl.addEventListener('mouseenter', () => {
        if (dropdown.activeSubmenu) {
          dropdown.activeSubmenu.remove();
          dropdown.activeSubmenu = null;
          window.dispatchEvent(new Event('resize'));
        }
      });

      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.activeTabId) {
          window.oslo.navigate(state.activeTabId, b.url);
        }
        closeAllBookmarksDropdowns();
      });
    }

    itemEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openBookmarkEditModal(b);
    });

    setupDragDropListeners(itemEl, b);
    dropdown.appendChild(itemEl);
  });

  document.body.appendChild(dropdown);

  if (!isSubmenu) {
    const rect = triggerEl.getBoundingClientRect();
    positionBookmarksDropdown(dropdown, rect);
  }

  window.dispatchEvent(new Event('resize'));
  return dropdown;
}

export function closeAllBookmarksDropdowns() {
  bookmarksDropdownPreviewToken++;
  const dropdowns = document.querySelectorAll('.bookmarks-bar-dropdown');
  if (dropdowns.length > 0) {
    dropdowns.forEach(el => el.remove());
    clearContentPreviewSoon();
  }
  document.querySelectorAll('.bookmarks-bar-item.folder').forEach(el => {
    el.classList.remove('dropdown-active');
  });
  window.dispatchEvent(new Event('resize'));
}

// Close bookmarks bar dropdowns on click outside
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.bookmarks-bar-dropdown') && !e.target.closest('.bookmarks-bar-item')) {
    closeAllBookmarksDropdowns();
  }
});

export function renderBookmarks() {
  closeAllBookmarksDropdowns();
  const bookmarksList = document.getElementById('bookmarks-list');
  if (!bookmarksList) return;

  bookmarksList.innerHTML = '';
  const searchInput = document.getElementById('bookmarks-search-input');
  const query = (searchInput?.value || '').toLowerCase().trim();

  // Make sure state.expandedFolders is initialized
  if (!state.expandedFolders) state.expandedFolders = [];

  if (query) {
    // Search mode - render flat list of bookmarks (ignoring folders in search for cleanliness)
    const filteredBookmarks = state.bookmarks.filter(b => {
      return !b.isFolder && ((b.title || '').toLowerCase().includes(query) || (b.url || '').toLowerCase().includes(query));
    });

    if (filteredBookmarks.length === 0) {
      const noBkMsg = translations[state.currentLang]['no-bookmarks'] || 'Kayıtlı yer imi yok.';
      bookmarksList.innerHTML = `<div style="color: var(--text-muted); font-size:13px; text-align:center; padding: 20px;">${noBkMsg}</div>`;
      return;
    }

    filteredBookmarks.forEach(b => {
      const item = document.createElement('div');
      item.className = 'panel-item';

      const faviconUrl = getBookmarkFaviconUrl(b);

      item.innerHTML = `
        <img class="panel-item-favicon" src="${escapeAttribute(faviconUrl)}" onerror="this.src='../../assets/logo.svg'">
        <div class="panel-item-info">
          <div class="panel-item-title">${escapeHtml(b.title)}</div>
          <div class="panel-item-url">${escapeHtml(b.url)}</div>
        </div>
        <div class="panel-item-actions">
          <button class="panel-item-btn edit-btn" title="${translations[state.currentLang]['edit-bookmark-title'] || 'Yer İmini Düzenle'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
          <button class="panel-item-btn delete-btn" title="${translations[state.currentLang]['remove-bookmark-title'] || 'Yer imini kaldır'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.panel-item-actions')) return;
        if (state.activeTabId) {
          window.oslo.navigate(state.activeTabId, b.url);
          document.getElementById('bookmarks-panel')?.classList.remove('open');
        }
      });

      const editBtn = item.querySelector('.edit-btn');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openBookmarkEditModal(b);
      });

      const deleteBtn = item.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteBookmarkItem(b.id);
      });

      bookmarksList.appendChild(item);
    });
  } else {
    // Hierarchical Tree mode
    renderTree(null, bookmarksList, 0);

    // Root list level drop listener
    bookmarksList.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (state.draggedBookmarkId) {
        bookmarksList.classList.add('drag-over');
      }
    });

    bookmarksList.addEventListener('dragleave', () => {
      bookmarksList.classList.remove('drag-over');
    });

    bookmarksList.addEventListener('drop', (e) => {
      e.preventDefault();
      bookmarksList.classList.remove('drag-over');

      const draggedId = e.dataTransfer.getData('text/plain') || state.draggedBookmarkId;
      if (draggedId) {
        moveBookmark(draggedId, null);
      }
    });

    if (state.bookmarks.length === 0) {
      const noBkMsg = translations[state.currentLang]['no-bookmarks'] || 'Kayıtlı yer imi yok.';
      bookmarksList.innerHTML = `<div style="color: var(--text-muted); font-size:13px; text-align:center; padding: 20px;">${noBkMsg}</div>`;
    }
  }
}

export function renderBookmarksBar() {
  const bookmarksBarList = document.getElementById('bookmarks-bar-list');
  if (!bookmarksBarList) return;
  bookmarksBarList.innerHTML = '';

  // Only render items at root level
  const rootItems = state.bookmarks.filter(b => {
    const bFolderId = b.folderId === undefined ? null : b.folderId;
    return bFolderId === null;
  });

  rootItems.forEach(b => {
    const item = document.createElement('div');
    item.setAttribute('draggable', 'true');

    if (b.isFolder) {
      item.className = 'bookmarks-bar-item folder';
      item.innerHTML = `
        <span class="bookmarks-bar-favicon" style="color: var(--accent-color); display: flex; align-items: center;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        </span>
        <span class="bookmarks-bar-title">${escapeHtml(b.title)}</span>
        <span style="font-size: 8px; color: var(--text-muted); margin-left: 2px;">▼</span>
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        showBookmarksDropdown(b.id, item);
      });
    } else {
      item.className = 'bookmarks-bar-item';

      const faviconUrl = getBookmarkFaviconUrl(b);

      item.innerHTML = `
        <img class="bookmarks-bar-favicon" src="${escapeAttribute(faviconUrl)}" onerror="this.src='../../assets/logo.svg'">
        <span class="bookmarks-bar-title">${escapeHtml(b.title)}</span>
      `;

      item.addEventListener('click', () => {
        if (state.activeTabId) {
          window.oslo.navigate(state.activeTabId, b.url);
        }
      });
    }

    setupDragDropListeners(item, b);

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openBookmarkEditModal(b);
    });

    bookmarksBarList.appendChild(item);
  });
}

export function openBookmarkEditModal(bookmark) {
  closeAllBookmarksDropdowns();
  state.editingBookmarkId = bookmark.id; // Store editing ID instead of URL!

  const nameInput = document.getElementById('bookmark-edit-name');
  const urlInput = document.getElementById('bookmark-edit-url');
  const urlContainer = urlInput?.closest('.settings-item');
  const modalTitle = document.getElementById('bookmark-modal-title');
  const deleteBtn = document.getElementById('btn-delete-bookmark-edit');

  if (nameInput) nameInput.value = bookmark.title;

  if (bookmark.isFolder) {
    if (urlContainer) urlContainer.style.display = 'none';
    if (modalTitle) modalTitle.textContent = translations[state.currentLang]['edit-folder-title'] || 'Klasörü Düzenle';
  } else {
    if (urlContainer) urlContainer.style.display = '';
    if (urlInput) urlInput.value = bookmark.url;
    if (modalTitle) modalTitle.textContent = translations[state.currentLang]['edit-bookmark-title'] || 'Yer İmini Düzenle';
  }

  if (deleteBtn) {
    deleteBtn.style.display = 'block';
  }

  const modal = document.getElementById('bookmark-edit-modal');
  openOverlayWithContentPreview(modal, () => {
    setTimeout(() => {
      nameInput?.focus();
      nameInput?.select();
    }, 100);
  });
}

function getLocale() {
  if (state.currentLang === 'tr') return 'tr-TR';
  if (state.currentLang === 'fr') return 'fr-FR';
  return 'en-US';
}

export function renderHistory() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;

  window.oslo.getHistory().then(historyItems => {
    historyList.innerHTML = '';
    const searchInput = document.getElementById('history-search-input');
    const query = (searchInput?.value || '').toLowerCase().trim();

    state.historyFilter = state.historyFilter || 'all';
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    let filteredHistory = (historyItems || []).filter(h => {
      return (h.title || '').toLowerCase().includes(query) || (h.url || '').toLowerCase().includes(query);
    });

    if (state.historyFilter === 'today') {
      filteredHistory = filteredHistory.filter(h => h.timestamp >= startOfToday.getTime());
    } else if (state.historyFilter === 'week') {
      filteredHistory = filteredHistory.filter(h => h.timestamp >= weekAgo);
    }

    if (filteredHistory.length === 0) {
      const noHistMsg = translations[state.currentLang]['no-history'] || 'Geçmiş kaydı yok.';
      historyList.innerHTML = `<div class="history-empty-state">${noHistMsg}</div>`;
      return;
    }

    const reversedHistory = [...filteredHistory].reverse();
    const locale = getLocale();
    const formatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const dayFormatter = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    let currentDay = '';
    reversedHistory.forEach(h => {
      const itemDate = new Date(h.timestamp);
      const dayKey = itemDate.toDateString();
      if (dayKey !== currentDay) {
        currentDay = dayKey;
        const groupTitle = document.createElement('div');
        groupTitle.className = 'history-day-heading';
        groupTitle.textContent = dayFormatter.format(itemDate);
        historyList.appendChild(groupTitle);
      }

      const item = document.createElement('div');
      item.className = 'history-item-card';
      const timeStr = formatter.format(itemDate);
      let host = h.url || '';
      try {
        host = new URL(h.url).hostname;
      } catch (e) { }
      let displayTitle = h.title || h.url;
      if (displayTitle === 'Yeni Sekme' || displayTitle === 'New Tab' || displayTitle === 'Nouvel Onglet') {
        displayTitle = translations[state.currentLang]['new-tab'] || 'Yeni Sekme';
      }

      item.innerHTML = `
        <div class="history-item-favicon">${escapeHtml((host || '?').charAt(0).toUpperCase())}</div>
        <div class="history-item-main">
          <div class="history-item-title">${escapeHtml(displayTitle)}</div>
          <div class="history-item-url">${escapeHtml(h.url)}</div>
        </div>
        <div class="history-item-meta">
          <span>${escapeHtml(timeStr)}</span>
          <span class="history-new-tab-label">${translations[state.currentLang]['new-tab'] || 'Yeni sekme'}</span>
        </div>
      `;
      item.addEventListener('click', () => {
        window.oslo.createTab({ url: h.url, space: state.activeSpace });
        document.getElementById('history-panel')?.classList.remove('open');
        window.dispatchEvent(new Event('resize'));
      });
      historyList.appendChild(item);
    });
  });
}

export function renderDownloads() {
  const downloadsList = document.getElementById('downloads-list');
  if (!downloadsList) return;

  downloadsList.closest('.settings-tab-content')?.classList.add('active');
  downloadsList.innerHTML = '';

  // Set default filter if not set
  state.downloadsFilter = state.downloadsFilter || 'all';

  const searchInput = document.getElementById('downloads-search-input');
  const query = (searchInput?.value || '').toLowerCase().trim();

  let downloadItems = Object.values(state.downloads);

  // Filter by query
  if (query) {
    downloadItems = downloadItems.filter(d => (d.name || '').toLowerCase().includes(query));
  }

  // Filter by status category
  if (state.downloadsFilter !== 'all') {
    downloadItems = downloadItems.filter(d => d.status === state.downloadsFilter);
  }

  if (downloadItems.length === 0) {
    const noDlMsg = translations[state.currentLang]['no-downloads'] || 'İndirme bulunamadı.';
    downloadsList.innerHTML = `<div style="color: var(--text-muted); font-size:13px; text-align:center; padding: 40px; background: rgba(255,255,255,0.01); border-radius: 16px; border: 1px dashed var(--border-color);">${noDlMsg}</div>`;
    return;
  }

  // Sort newest first
  downloadItems.sort((a, b) => b.id - a.id);

  const locale = getLocale();

  downloadItems.forEach(d => {
    const card = document.createElement('div');
    card.className = 'download-item-card';

    // Extract extension for badge/icon class
    let ext = 'default';
    if (d.name && d.name.includes('.')) {
      ext = d.name.split('.').pop().toLowerCase();
    }

    // Choose specific classes for file icons
    const safeExtensions = ['pdf', 'zip', 'rar', 'tar', 'gz', 'png', 'jpg', 'jpeg', 'svg', 'gif', 'mp4', 'mkv', 'avi', 'mov', 'mp3', 'wav', 'flac', 'exe', 'msi'];
    const iconClass = safeExtensions.includes(ext) ? ext : 'default';

    const openBtnText = translations[state.currentLang]['open-file'] || 'Dosyayı Aç';

    let actionButtonsHtml = '';
    if (d.status === 'progressing') {
      actionButtonsHtml = `
        <button class="download-card-control-btn pause-btn" title="Duraklat">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
        <button class="download-card-control-btn cancel-btn" title="İptal Et">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      `;
    } else if (d.status === 'paused') {
      actionButtonsHtml = `
        <button class="download-card-control-btn resume-btn" title="Devam Et">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <button class="download-card-control-btn cancel-btn" title="İptal Et">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      `;
    }

    const percentage = d.progress !== undefined ? d.progress : 0;

    card.innerHTML = `
      <div class="download-file-type-icon ${iconClass}">
        ${escapeHtml(ext)}
      </div>
      <div class="download-item-details">
        <div class="download-item-card-header">
          <div class="download-card-title" title="${escapeAttribute(d.name)}">${escapeHtml(d.name)}</div>
          <span class="download-card-status ${escapeAttribute(d.status)}">${escapeHtml(getDownloadStatusText(d.status))}</span>
        </div>
        
        <div class="download-card-progress-wrapper">
          <div class="download-card-progress-container">
          <div class="download-card-progress-bar ${escapeAttribute(d.status)}" style="width: ${percentage}%"></div>
          </div>
          <div class="download-card-pct">%${percentage}</div>
        </div>
        
        <div class="download-card-meta-row">
          <div class="download-card-size">
            ${d.received !== undefined && d.total !== undefined
        ? `<span>${formatBytes(d.received)} / ${formatBytes(d.total)}</span>`
        : (d.total !== undefined ? `<span>${formatBytes(d.total)}</span>` : '')
      }
            ${d.status === 'completed' && d.timestamp
        ? `<span style="color: var(--text-muted); font-size: 11px;">• ${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d.timestamp))}</span>`
        : ''
      }
          </div>
          
          <div class="download-card-actions">
            ${d.status === 'completed'
        ? `<button class="download-card-btn accent download-open-btn">${openBtnText}</button>`
        : actionButtonsHtml
      }
          </div>
        </div>
      </div>
    `;

    if (d.status === 'completed') {
      const openBtn = card.querySelector('.download-open-btn');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          window.oslo.openDownloadedFile(d.path);
        });
      }
    } else {
      const pauseBtn = card.querySelector('.pause-btn');
      if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
          window.oslo.pauseDownload(d.id);
        });
      }
      const resumeBtn = card.querySelector('.resume-btn');
      if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
          window.oslo.resumeDownload(d.id);
        });
      }
      const cancelBtn = card.querySelector('.cancel-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          window.oslo.cancelDownload(d.id);
        });
      }
    }

    downloadsList.appendChild(card);
  });
}

export function getDownloadStatusText(status) {
  const key = 'download-' + status;
  return (translations[state.currentLang] && translations[state.currentLang][key]) || status;
}

export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
