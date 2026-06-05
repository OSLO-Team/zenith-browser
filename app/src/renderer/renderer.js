// OSLO Browser - Renderer Process (ES Module Entry Point)
import { state } from './js/state.js';
import { applyLanguage, translations } from './js/i18n.js';
import { renderTabs, updateBookmarkIcon } from './js/tabs.js';
import { initPanels, renderBookmarks, renderBookmarksBar, renderHistory, renderDownloads } from './js/panels.js';
import { initSettings, syncContentAreaSurface, applySettingChange } from './js/settings.js';
import { installNativeAlertBridge, showOsloConfirm } from './js/modal-dialogs.js';

installNativeAlertBridge('OSLO Browser');

// Detect Windows OS to apply workaround for backdrop-filter rendering bugs
if (navigator.userAgent.includes('Windows') || navigator.userAgent.includes('win32') || navigator.platform.toLowerCase().includes('win')) {
  document.body.classList.add('os-windows');
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

function parseMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  const lines = html.split('\n');
  let inList = false;
  const processedLines = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      if (!inList) {
        processedLines.push('<ul class="update-notes-list">');
        inList = true;
      }
      processedLines.push(`<li>${trimmed.substring(2)}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      if (trimmed) {
        if (trimmed.startsWith('<h')) {
          processedLines.push(trimmed);
        } else {
          processedLines.push(`<p>${trimmed}</p>`);
        }
      }
    }
  }
  if (inList) {
    processedLines.push('</ul>');
  }

  return processedLines.join('\n');
}

// DOM Elements for Navigation & Panel Toggles
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const newTabBtn = document.getElementById('new-tab-btn');
const incognitoBtn = document.getElementById('incognito-btn');

const historyBtn = document.getElementById('history-btn');
const downloadsBtn = document.getElementById('downloads-btn');
const settingsBtn = document.getElementById('settings-btn');
const profileSelectorBtn = document.getElementById('profile-selector-btn');
const profileSelectorAvatar = document.getElementById('profile-selector-avatar');
const profileSelectorName = document.getElementById('profile-selector-name');
const profileMenu = document.getElementById('profile-menu');
const profileSwitcher = document.querySelector('.profile-switcher');
const profileManagerModal = document.getElementById('profile-manager-modal');
const closeProfileManagerModal = document.getElementById('close-profile-manager-modal');
const profileManagerList = document.getElementById('profile-manager-list');
const profileEditId = document.getElementById('profile-edit-id');
const profileNameInput = document.getElementById('profile-name-input');
const profileAvatarInput = document.getElementById('profile-avatar-input');
const profileColorInput = document.getElementById('profile-color-input');
const profileNewBtn = document.getElementById('profile-new-btn');
const profileSaveBtn = document.getElementById('profile-save-btn');
const profileDeleteBtn = document.getElementById('profile-delete-btn');
const profileStatusText = document.getElementById('profile-status-text');

const bookmarksPanel = document.getElementById('bookmarks-panel');
const historyPanel = document.getElementById('history-panel');
const downloadsOverlay = document.getElementById('downloads-overlay');
const settingsOverlay = document.getElementById('settings-overlay');

const navBack = document.getElementById('nav-back');
const navForward = document.getElementById('nav-forward');
const navReload = document.getElementById('nav-reload');
const addressInput = document.getElementById('address-input');
const readerModeBtn = createReaderModeButton();

const clearHistoryModal = document.getElementById('clear-history-modal');
const bookmarkEditModal = document.getElementById('bookmark-edit-modal');
const bookmarkEditName = document.getElementById('bookmark-edit-name');
const bookmarkEditUrl = document.getElementById('bookmark-edit-url');
const tabContextMenu = document.getElementById('tab-context-menu');
let contentPreviewClearTimer = null;
let selectedProfileIdForEdit = 'default';
let profileFormMode = 'edit';
let suppressNextProfileSwitchedEvent = false;
let profileStatusTimer = null;
const profileColorChoices = ['#00ddff', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

function getUiText(key, fallback) {
  return translations[state.currentLang]?.[key] || translations.tr?.[key] || fallback;
}

function normalizeProfilePayload(payload = {}) {
  const previousSelection = selectedProfileIdForEdit;
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
  state.profiles = profiles.map(profile => ({
    id: String(profile.id || ''),
    name: String(profile.name || getUiText('profile', 'Profil')),
    avatar: String(profile.avatar || profile.name?.charAt(0) || 'P').slice(0, 2).toUpperCase(),
    color: /^#[0-9a-f]{6}$/i.test(String(profile.color || '')) ? profile.color : '#00ddff',
    isDefault: !!profile.isDefault,
    isGuest: !!profile.isGuest,
    createdAt: Number(profile.createdAt) || 0,
    updatedAt: Number(profile.updatedAt) || 0
  })).filter(profile => profile.id);
  state.activeProfileId = payload.activeProfileId || 'default';
  state.activeProfile = state.profiles.find(profile => profile.id === state.activeProfileId) || state.profiles[0] || null;
  if (profileFormMode === 'create') {
    selectedProfileIdForEdit = '';
    return;
  }

  const stillManaged = state.profiles.some(profile => profile.id === previousSelection);
  selectedProfileIdForEdit = stillManaged
    ? previousSelection
    : (state.activeProfile?.id || 'default');
}

function getProfileDescription(profile) {
  if (!profile) return '';
  if (profile.isGuest) return getUiText('profile-guest-desc', 'Temporary browsing');
  if (profile.isDefault) return getUiText('profile-default-desc', 'Default profile');
  return getUiText('profile-profile-desc', 'Separate data space');
}

function getManagedProfiles() {
  return [...(state.profiles || [])].sort((a, b) => {
    const rankA = a.isDefault ? 0 : (a.isGuest ? 1 : 2);
    const rankB = b.isDefault ? 0 : (b.isGuest ? 1 : 2);
    if (rankA !== rankB) return rankA - rankB;

    if (rankA === 2) {
      const createdA = Number(a.createdAt) || 0;
      const createdB = Number(b.createdAt) || 0;
      if (createdA !== createdB) return createdA - createdB;
    }

    return String(a.name || '').localeCompare(String(b.name || ''), state.currentLang || 'tr');
  });
}

function getSelectedManagedProfile() {
  return getManagedProfiles().find(profile => profile.id === selectedProfileIdForEdit) || null;
}

function isProfileLocked(profile) {
  return !!profile && (profile.isDefault || profile.isGuest);
}

function getProfileLockMessage(profile) {
  if (profile?.isGuest) {
    return getUiText('profile-guest-locked', 'Guest profile is temporary and cannot be edited.');
  }
  if (profile?.isDefault) {
    return getUiText('profile-default-locked', 'Default personal profile is protected and cannot be edited.');
  }
  return '';
}

function getProfileAvatarFromName(name) {
  return (String(name || '').trim().charAt(0) || 'P').slice(0, 2).toUpperCase();
}

function getNextProfileName() {
  const baseName = getUiText('profile-default-new-name', 'Yeni Profil');
  const usedNames = new Set(getManagedProfiles().map(profile => String(profile.name || '').trim().toLocaleLowerCase()));
  for (let index = 1; index < 1000; index += 1) {
    const candidate = index === 1 ? baseName : `${baseName} ${index}`;
    if (!usedNames.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${baseName} ${Date.now().toString(36).slice(-4)}`;
}

function setProfileFormDisabled(disabled) {
  [profileNameInput, profileAvatarInput, profileColorInput].forEach(input => {
    if (input) input.disabled = disabled;
  });
}

function showProfileStatus(message = '', tone = 'info', options = {}) {
  if (!profileStatusText) return;
  if (profileStatusTimer) {
    clearTimeout(profileStatusTimer);
    profileStatusTimer = null;
  }

  profileStatusText.textContent = message;
  profileStatusText.className = `profile-status-text ${message ? tone : ''}`.trim();
  profileStatusText.dataset.persistent = options.persist ? 'true' : 'false';

  if (message && !options.persist) {
    profileStatusTimer = setTimeout(() => {
      profileStatusText.textContent = '';
      profileStatusText.className = 'profile-status-text';
      profileStatusText.dataset.persistent = 'false';
      profileStatusTimer = null;
    }, 2600);
  }
}

function showProfileToast(message) {
  if (!message) return;
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-message profile-toast-message';

  const dot = document.createElement('span');
  dot.style.width = '8px';
  dot.style.height = '8px';
  dot.style.borderRadius = '999px';
  dot.style.background = 'var(--accent-color)';
  dot.style.boxShadow = '0 0 12px rgba(0, 221, 255, 0.45)';
  dot.style.flexShrink = '0';

  const messageEl = document.createElement('span');
  messageEl.textContent = message;

  toast.appendChild(dot);
  toast.appendChild(messageEl);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 2600);
}

function updateProfileFormMode() {
  const creating = profileFormMode === 'create';
  const selectedProfile = creating ? null : getSelectedManagedProfile();
  const locked = !creating && isProfileLocked(selectedProfile);

  setProfileFormDisabled(locked);
  if (profileSaveBtn) {
    profileSaveBtn.disabled = locked;
    profileSaveBtn.textContent = getUiText(creating ? 'profile-create' : 'modal-save', creating ? 'Oluştur' : 'Kaydet');
  }
  if (profileDeleteBtn) {
    profileDeleteBtn.disabled = creating || !selectedProfile || selectedProfile.isDefault || selectedProfile.isGuest;
  }

  if (locked) {
    showProfileStatus(getProfileLockMessage(selectedProfile), 'info', { persist: true });
  } else if (profileStatusText?.dataset.persistent === 'true') {
    showProfileStatus('');
  }
}

function renderProfileSelector() {
  if (!profileSelectorBtn || !profileSelectorAvatar || !profileSelectorName) return;
  const profile = state.activeProfile || state.profiles[0] || { name: getUiText('profile', 'Profil'), avatar: 'P', color: '#00ddff' };
  profileSelectorAvatar.textContent = profile.avatar || (profile.name || 'P').charAt(0).toUpperCase();
  profileSelectorAvatar.style.setProperty('--profile-color', profile.color || '#00ddff');
  profileSelectorName.textContent = profile.name || getUiText('profile', 'Profil');
  profileSelectorBtn.title = `${getUiText('profile', 'Profil')}: ${profile.name || ''}`;
}

function renderProfileMenu() {
  if (!profileMenu) return;
  const profileRows = getManagedProfiles().map(profile => {
    const isActive = profile.id === state.activeProfileId;
    return `
      <button class="profile-menu-item ${isActive ? 'active' : ''}" data-profile-switch="${escapeHtml(profile.id)}">
        <span class="profile-avatar" style="--profile-color: ${escapeHtml(profile.color || '#00ddff')}">${escapeHtml(profile.avatar || 'P')}</span>
        <span class="profile-menu-meta">
          <span class="profile-menu-name">${escapeHtml(profile.name)}</span>
          <span class="profile-menu-desc">${escapeHtml(getProfileDescription(profile))}</span>
        </span>
        <span class="profile-menu-check">${isActive ? '✓' : ''}</span>
      </button>
    `;
  }).join('');

  profileMenu.innerHTML = `
    ${profileRows}
    <div class="profile-menu-divider"></div>
    <button class="profile-menu-action" id="profile-menu-manage">
      <span class="profile-avatar" style="--profile-color: var(--accent-color)">+</span>
      <span class="profile-menu-meta">
        <span class="profile-menu-name">${escapeHtml(getUiText('profile-manage', 'Manage profiles'))}</span>
        <span class="profile-menu-desc">${escapeHtml(getUiText('profile-manage-desc', 'Create, edit, or delete'))}</span>
      </span>
    </button>
  `;

  profileMenu.querySelectorAll('[data-profile-switch]').forEach(button => {
    button.addEventListener('click', () => {
      profileSwitcher?.classList.remove('open');
      clearProfileMenuOverlap();
      switchProfile(button.getAttribute('data-profile-switch'));
    });
  });
  profileMenu.querySelector('#profile-menu-manage')?.addEventListener('click', () => {
    profileSwitcher?.classList.remove('open');
    clearProfileMenuOverlap({ clearPreview: false });
    openProfileManager();
  });
}

function updateProfileMenuOverlapState() {
  if (!profileMenu) return false;
  if (!profileSwitcher?.classList.contains('open')) {
    clearProfileMenuOverlap({ clearPreview: !profileManagerModal?.classList.contains('open') });
    return false;
  }

  const contentArea = document.getElementById('content-area');
  if (!contentArea) return false;

  const menuRect = profileMenu.getBoundingClientRect();
  const contentRect = contentArea.getBoundingClientRect();
  const overlaps = menuRect.right > contentRect.left
    && menuRect.left < contentRect.right
    && menuRect.bottom > contentRect.top
    && menuRect.top < contentRect.bottom;

  profileMenu.dataset.overlapsContent = overlaps ? 'true' : 'false';
  return overlaps;
}

function clearProfileMenuOverlap({ clearPreview = true } = {}) {
  if (profileMenu) delete profileMenu.dataset.overlapsContent;
  sendBounds();
  if (clearPreview) {
    clearContentPreviewSoon();
  } else {
    cancelContentPreviewClearTimer();
  }
}

function renderProfiles() {
  renderProfileSelector();
  renderProfileMenu();
  renderProfileManager();
}

window.renderProfiles = renderProfiles;

function selectProfileForEditing(profileId) {
  const managedProfiles = getManagedProfiles();
  const profile = managedProfiles.find(item => item.id === profileId) || managedProfiles[0] || null;
  profileFormMode = 'edit';
  selectedProfileIdForEdit = profile?.id || '';
  if (profileEditId) profileEditId.value = selectedProfileIdForEdit;
  if (profileNameInput) profileNameInput.value = profile?.name || '';
  if (profileAvatarInput) profileAvatarInput.value = profile?.avatar || '';
  if (profileColorInput) profileColorInput.value = profile?.color || '#00ddff';
  renderProfileManager();
  updateProfileFormMode();
}

function renderProfileManager() {
  if (!profileManagerList) return;
  const rows = getManagedProfiles().map(profile => {
    const locked = isProfileLocked(profile);
    return `
    <button class="profile-manager-row ${profile.id === selectedProfileIdForEdit ? 'active' : ''} ${locked ? 'locked' : ''}" data-profile-edit="${escapeHtml(profile.id)}">
      <span class="profile-avatar" style="--profile-color: ${escapeHtml(profile.color || '#00ddff')}">${escapeHtml(profile.avatar || 'P')}</span>
      <span class="profile-menu-meta">
        <span class="profile-manager-name">${escapeHtml(profile.name)}</span>
        <span class="profile-menu-desc">${escapeHtml(getProfileDescription(profile))}</span>
      </span>
      <span class="profile-manager-badge">${locked ? escapeHtml(getUiText('profile-locked', 'Locked')) : (profile.id === state.activeProfileId ? escapeHtml(getUiText('profile-current', 'Current')) : '')}</span>
    </button>
  `;
  }).join('');

  profileManagerList.innerHTML = rows;
  profileManagerList.querySelectorAll('[data-profile-edit]').forEach(button => {
    button.addEventListener('click', () => selectProfileForEditing(button.getAttribute('data-profile-edit')));
  });
  updateProfileFormMode();
}

async function openProfileManager() {
  if (!profileManagerModal) return;
  selectProfileForEditing(selectedProfileIdForEdit || state.activeProfileId || 'default');
  await openModalWithContentPreview(profileManagerModal);
}

function closeProfileManager() {
  if (profileFormMode === 'create') {
    profileFormMode = 'edit';
    selectedProfileIdForEdit = state.activeProfile?.id || 'default';
  }
  showProfileStatus('');
  closeModalWithContentPreview(profileManagerModal);
}

function prepareNewProfileForm() {
  const suggestedName = getNextProfileName();
  selectedProfileIdForEdit = '';
  profileFormMode = 'create';
  if (profileEditId) profileEditId.value = '';
  if (profileNameInput) profileNameInput.value = suggestedName;
  if (profileAvatarInput) profileAvatarInput.value = getProfileAvatarFromName(suggestedName);
  if (profileColorInput) profileColorInput.value = profileColorChoices[getManagedProfiles().length % profileColorChoices.length];
  updateProfileFormMode();
  showProfileStatus(getUiText('profile-new-ready', 'Yeni profil bilgilerini girin.'), 'info');
  profileNameInput?.focus();
  profileNameInput?.select();
  renderProfileManager();
}

function normalizeBookmarksForState(bookmarks = []) {
  let modified = false;
  const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const normalized = (bookmarks || []).map(bookmark => {
    const next = { ...bookmark };
    if (!next.id) {
      next.id = generateId();
      modified = true;
    }
    if (next.folderId === undefined) {
      next.folderId = null;
      modified = true;
    }
    return next;
  });
  return { normalized, modified };
}

async function loadBookmarksForActiveProfile() {
  const bookmarks = await window.oslo.getBookmarks();
  const { normalized, modified } = normalizeBookmarksForState(bookmarks || []);
  state.bookmarks = normalized;
  if (modified) {
    state.bookmarks = await window.oslo.setBookmarks(state.bookmarks);
  }
  updateBookmarkIcon();
  renderBookmarksBar();
  if (bookmarksPanel?.classList.contains('open')) renderBookmarks();
}

function normalizeSpacesForState(spaces) {
  return (spaces || [{ name: 'Genel', emoji: '🌐', color: '#000000' }]).map(space => {
    if (typeof space === 'object' && space.name === 'Genel') {
      return { ...space, color: '#000000' };
    }
    return space;
  });
}

async function loadSpacesForActiveProfile() {
  state.spaces = normalizeSpacesForState(await window.oslo.getSpaces());
  if (!state.spaces.some(space => (typeof space === 'string' ? space : space.name) === state.activeSpace)) {
    state.activeSpace = 'Genel';
  }
  renderSpaces();
}

async function loadDownloadsForActiveProfile() {
  state.downloads = {};
  const downloads = await window.oslo.getDownloads();
  (downloads || []).forEach(download => {
    state.downloads[download.id] = download;
  });
  renderDownloads();
}

async function restoreTabsForActiveProfile(settings = null) {
  const activeSettings = settings || await window.oslo.getAllSettings();
  if (activeSettings && typeof activeSettings === 'object') {
    Object.keys(activeSettings).forEach(key => applySettingChange(key, activeSettings[key]));
  }

  state.tabs = {};
  state.tabOrder = [];
  state.activeTabId = null;

  if (!activeSettings?.sessionRestoreEnabled) {
    window.oslo.createTab({ space: state.activeSpace });
    renderTabs();
    return;
  }

  const sessionData = await window.oslo.getSession();
  const savedTabs = sessionData.tabs || [];
  if (!savedTabs.length) {
    window.oslo.createTab({ space: state.activeSpace });
    renderTabs();
    return;
  }

  let lastActiveTabId = savedTabs[0].id;
  let latestActiveTime = 0;
  savedTabs.forEach(tab => {
    state.tabs[tab.id] = {
      id: tab.id,
      url: tab.url,
      profileId: tab.profileId || state.activeProfileId,
      space: tab.space,
      isPinned: !!tab.isPinned,
      title: tab.title,
      zoomFactor: tab.zoomFactor || 1.0,
      lastActive: tab.lastActive
    };
    state.tabOrder.push(tab.id);
    window.oslo.createTab({
      id: tab.id,
      url: tab.url,
      space: tab.space,
      isPinned: !!tab.isPinned,
      zoomFactor: tab.zoomFactor || 1.0
    });
    if ((tab.lastActive || 0) > latestActiveTime) {
      latestActiveTime = tab.lastActive || 0;
      lastActiveTabId = tab.id;
    }
  });

  setTimeout(() => {
    window.oslo.selectTab(lastActiveTabId);
  }, 200);
}

async function loadProfileScopedData({ restoreTabs = true, settings = null } = {}) {
  state.activeSpace = 'Genel';
  await Promise.all([
    loadBookmarksForActiveProfile(),
    loadSpacesForActiveProfile(),
    loadDownloadsForActiveProfile()
  ]);

  if (restoreTabs) {
    await restoreTabsForActiveProfile(settings);
  }

  closeAutocompleteDropdown();
  if (addressInput) addressInput.value = '';
  renderTabs();
  renderSpaces();
  renderProfiles();
  updateBookmarkIcon();
  updateSecurityIndicator();
  updateNavButtonsState();
  updateReaderModeButton();
  syncContentAreaSurface();
  setTimeout(sendBounds, 120);
}

async function loadProfiles() {
  if (typeof window.oslo.getProfiles !== 'function') return;
  const payload = await window.oslo.getProfiles();
  normalizeProfilePayload(payload || {});
  renderProfiles();
}

async function applyProfilePayload(payload, { restoreTabs = true } = {}) {
  normalizeProfilePayload(payload || {});
  if (payload?.settings && typeof payload.settings === 'object') {
    Object.keys(payload.settings).forEach(key => applySettingChange(key, payload.settings[key]));
  }
  await loadProfileScopedData({ restoreTabs, settings: payload?.settings || null });
}

function showProfileError(message) {
  console.warn(message);
  showProfileStatus(message, 'error');
  if (!profileSelectorBtn) return;
  const previousTitle = profileSelectorBtn.title;
  profileSelectorBtn.title = message;
  profileSelectorBtn.classList.add('profile-error');
  setTimeout(() => {
    profileSelectorBtn.title = previousTitle;
    profileSelectorBtn.classList.remove('profile-error');
  }, 1800);
}

async function switchProfile(profileId) {
  if (!profileId || profileId === state.activeProfileId || typeof window.oslo.switchProfile !== 'function') return;
  try {
    suppressNextProfileSwitchedEvent = true;
    const payload = await window.oslo.switchProfile(profileId);
    await applyProfilePayload(payload, { restoreTabs: true });
    setTimeout(() => { suppressNextProfileSwitchedEvent = false; }, 0);
  } catch (error) {
    suppressNextProfileSwitchedEvent = false;
    console.error('Failed to switch profile:', error);
    showProfileError(getUiText('profile-switch-failed', 'Profile could not be switched.'));
  }
}

function hasActiveContentPreview() {
  const contentArea = document.getElementById('content-area');
  const preview = document.getElementById('content-area-preview');
  return !!(contentArea?.classList.contains('content-preview-active') && preview?.getAttribute('src'));
}

function cancelContentPreviewClearTimer() {
  if (contentPreviewClearTimer) {
    clearTimeout(contentPreviewClearTimer);
    contentPreviewClearTimer = null;
  }
}

function clearContentPreviewNow() {
  cancelContentPreviewClearTimer();

  const contentArea = document.getElementById('content-area');
  document.getElementById('content-area-preview')?.remove();
  contentArea?.classList.remove('content-preview-active');
}

async function captureContentPreview() {
  const contentArea = document.getElementById('content-area');
  if (!contentArea || typeof window.oslo.captureActiveTabPreview !== 'function') return false;

  clearContentPreviewNow();
  sendBounds();
  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const dataUrl = await window.oslo.captureActiveTabPreview();
    if (!dataUrl) return false;

    let preview = document.getElementById('content-area-preview');
    if (!preview) {
      preview = document.createElement('img');
      preview.id = 'content-area-preview';
      preview.className = 'content-area-preview';
      preview.alt = '';
      contentArea.appendChild(preview);
    }

    preview.src = dataUrl;
    if (typeof preview.decode === 'function') {
      await preview.decode().catch(() => {});
    } else if (!preview.complete) {
      await new Promise((resolve) => {
        preview.addEventListener('load', resolve, { once: true });
        preview.addEventListener('error', resolve, { once: true });
      });
    }
    contentArea.classList.add('content-preview-active');
    return true;
  } catch (err) {
    console.error('Failed to capture content preview:', err);
    return false;
  }
}

async function openModalWithContentPreview(modal) {
  if (!modal) return;
  await captureContentPreview();
  modal.classList.add('open');
  sendBounds();
}

function closeModalWithContentPreview(modal) {
  modal?.classList.remove('open');
  sendBounds();
  clearContentPreviewSoon();
}

function clearContentPreviewSoon() {
  if (contentPreviewClearTimer) clearTimeout(contentPreviewClearTimer);
  contentPreviewClearTimer = setTimeout(() => {
    clearContentPreviewNow();
  }, 120);
}

window.osloContentPreview = {
  show: captureContentPreview,
  openModal: openModalWithContentPreview,
  closeModal: closeModalWithContentPreview,
  clearSoon: clearContentPreviewSoon,
  refreshBounds: sendBounds
};

function createReaderModeButton() {
  const actions = document.querySelector('.address-bar-actions');
  if (!actions) return null;

  const existing = document.getElementById('reader-mode-btn');
  if (existing) return existing;

  const button = document.createElement('button');
  button.id = 'reader-mode-btn';
  button.className = 'address-action-btn reader-mode-btn';
  button.type = 'button';
  button.title = `${getUiText('reader-mode-title', 'Okuma Modu')} (Ctrl+Shift+R)`;
  button.disabled = true;
  button.style.visibility = 'hidden';
  button.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M5 4.5C5 3.67 5.67 3 6.5 3H20v16.5c0 .28-.22.5-.5.5H6.75C5.23 20 4 18.77 4 17.25V5.5c0-.55.45-1 1-1zm1.5.5a.5.5 0 0 0-.5.5v10.94c.28-.12.58-.19.9-.19H18V5H6.5zM6.9 18.5H18v-1H6.9a.5.5 0 0 0 0 1zM8 7h8v1.5H8V7zm0 3h8v1.5H8V10zm0 3h5v1.5H8V13z" fill="currentColor"/>
    </svg>
  `;

  const bookmarkButton = document.getElementById('add-bookmark-btn');
  actions.insertBefore(button, bookmarkButton || null);
  return button;
}

function isReaderPageUrl(url) {
  return /\/reader\/reader\.html(?:\?|$)/i.test(String(url || '').replace(/\\/g, '/'));
}

function canUseReaderMode(tab) {
  if (!tab || !tab.url || isReaderPageUrl(tab.url)) return false;
  try {
    const parsed = new URL(tab.url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

function updateReaderModeButton() {
  if (!readerModeBtn) return;
  const activeTab = state.tabs[state.activeTabId];
  const isReader = !!activeTab && isReaderPageUrl(activeTab.url);
  const enabled = canUseReaderMode(activeTab);

  if (!enabled) {
    readerModeBtn.style.visibility = 'hidden';
    readerModeBtn.disabled = true;
    readerModeBtn.classList.remove('active');
    readerModeBtn.title = isReader
      ? getUiText('reader-mode-active', 'Okuma Modu Açık')
      : getUiText('reader-mode-unavailable', 'Okuma Modu bu sayfada kullanılamaz');
    return;
  }

  readerModeBtn.style.visibility = 'visible';
  readerModeBtn.disabled = !enabled;
  readerModeBtn.classList.toggle('active', isReader);
  readerModeBtn.title = isReader
    ? getUiText('reader-mode-active', 'Okuma Modu Açık')
    : (enabled
      ? `${getUiText('reader-mode-title', 'Okuma Modu')} (Ctrl+Shift+R)`
      : getUiText('reader-mode-unavailable', 'Okuma Modu bu sayfada kullanılamaz'));
}

async function openReaderModeFromActiveTab() {
  const activeTab = state.tabs[state.activeTabId];
  if (!activeTab || !canUseReaderMode(activeTab) || !readerModeBtn) return;

  readerModeBtn.classList.add('busy');
  readerModeBtn.disabled = true;
  try {
    await window.oslo.openReaderMode(activeTab.id);
    window.oslo.logTelemetryEvent('reader-mode-open', { url: activeTab.url });
  } catch (error) {
    console.error('Reader mode failed:', error);
    readerModeBtn.title = getUiText('reader-mode-error', 'Okuma modu açılamadı');
  } finally {
    readerModeBtn.classList.remove('busy');
    updateReaderModeButton();
  }
}

readerModeBtn?.addEventListener('click', openReaderModeFromActiveTab);
window.addEventListener('language-changed', updateReaderModeButton);

// --- Window Resizing and Bounds Coordination ---
export function sendBounds() {
  const contentArea = document.getElementById('content-area');
  if (!contentArea) return;

  // Hide or clip native web view when modals, dropdowns, or context menus are active.
  const isClearHistoryOpen = clearHistoryModal?.classList.contains('open');
  const isClearBrowserDataOpen = document.getElementById('clear-browser-data-modal')?.classList.contains('open');
  const isBookmarkEditOpen = bookmarkEditModal?.classList.contains('open');
  const isFolderCreateOpen = document.getElementById('folder-create-modal')?.classList.contains('open');
  const isUpdateOpen = document.getElementById('update-modal')?.classList.contains('open');
  const isTelemetryOpen = document.getElementById('telemetry-log-modal')?.classList.contains('open');
  const isPermissionsOpen = document.getElementById('permissions-manager-modal')?.classList.contains('open');
  const isPasswordAuditOpen = document.getElementById('password-audit-modal')?.classList.contains('open');
  const isSecurityInfoOpen = document.getElementById('security-info-modal')?.classList.contains('open');
  const isProfileManagerOpen = profileManagerModal?.classList.contains('open') && hasActiveContentPreview();
  const isSpaceOpen = document.getElementById('space-modal')?.classList.contains('open');
  const isSpaceDeleteOpen = document.getElementById('space-delete-modal')?.classList.contains('open');
  const isPermissionBarOpen = document.getElementById('permission-bar')?.style.display === 'flex';
  const isPasswordSaveBarOpen = document.getElementById('password-save-bar')?.style.display === 'flex';

  const tabContextMenu = document.getElementById('tab-context-menu');
  const isTabContextMenuOverContent = tabContextMenu?.style.display === 'block'
    && tabContextMenu.dataset.overlapsContent === 'true';
  const isProfileMenuOverContent = profileSwitcher?.classList.contains('open')
    && profileMenu?.dataset.overlapsContent === 'true';
  const isDropdownOpen = !!document.querySelector('.bookmarks-bar-dropdown');

  const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
  const isAutocompleteOverPreview = autocompleteDropdown?.style.display === 'block'
    && autocompleteDropdown.dataset.overlapsContent === 'true'
    && hasActiveContentPreview();
  const isHistoryOpen = document.getElementById('history-panel')?.classList.contains('open');
  const isSettingsOpen = document.getElementById('settings-overlay')?.classList.contains('open');
  const isDownloadsOpen = document.getElementById('downloads-overlay')?.classList.contains('open');
  const isBookmarksSuccessModalOpen = !!document.querySelector('.bookmarks-success-modal-overlay.open');
  if (
    isClearHistoryOpen ||
    isClearBrowserDataOpen ||
    isBookmarkEditOpen ||
    isFolderCreateOpen ||
    isUpdateOpen ||
    isTelemetryOpen ||
    isPermissionsOpen ||
    isPasswordAuditOpen ||
    isSecurityInfoOpen ||
    isProfileManagerOpen ||
    isSpaceOpen ||
    isSpaceDeleteOpen ||
    isTabContextMenuOverContent ||
    isProfileMenuOverContent ||
    isDropdownOpen ||
    isAutocompleteOverPreview ||
    isHistoryOpen ||
    isSettingsOpen ||
    isDownloadsOpen ||
    isBookmarksSuccessModalOpen
  ) {
    window.oslo.updateBounds({ x: 0, y: 0, width: 0, height: 0 });
    return;
  }

  const rect = contentArea.getBoundingClientRect();
  window.oslo.updateBounds({
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  });
}

// Watch #content-area size changes
const contentArea = document.getElementById('content-area');
if (contentArea) {
  const resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(sendBounds);
  });
  resizeObserver.observe(contentArea);
}

window.addEventListener('resize', () => {
  requestAnimationFrame(() => {
    positionAutocompleteDropdown();
    sendNewtabTopbarAutocomplete();
    updateProfileMenuOverlapState();
    sendBounds();
  });
});

// --- Window Controls ---
document.getElementById('win-min')?.addEventListener('click', () => window.oslo.minimizeWindow());
document.getElementById('win-max')?.addEventListener('click', () => window.oslo.maximizeWindow());
document.getElementById('win-close')?.addEventListener('click', () => window.oslo.closeWindow());

// --- Sidebar Collapse/Expand Toggle ---
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    if (sidebar) {
      sidebar.classList.toggle('expanded');
      sidebar.classList.toggle('collapsed');
      window.oslo.setSetting('sidebarIconOnly', sidebar.classList.contains('collapsed'));
    }
    if (typeof renderSpaces === 'function') {
      renderSpaces();
    }
    setTimeout(() => {
      updateProfileMenuOverlapState();
      sendBounds();
    }, 350);
  });
}

// --- Tab Management Toggles ---
if (newTabBtn) {
  newTabBtn.addEventListener('click', () => {
    window.oslo.createTab({ space: state.activeSpace });
  });
}

if (incognitoBtn) {
  incognitoBtn.addEventListener('click', () => {
    window.oslo.createTab({ isIncognito: true, space: state.activeSpace });
  });
}

profileSelectorBtn?.addEventListener('click', async (event) => {
  event.stopPropagation();
  const willOpen = !profileSwitcher?.classList.contains('open');
  if (willOpen && sidebar?.classList.contains('collapsed')) {
    await captureContentPreview();
  }
  profileSwitcher?.classList.toggle('open', willOpen);
  renderProfileMenu();
  requestAnimationFrame(() => {
    updateProfileMenuOverlapState();
    sendBounds();
  });
});

closeProfileManagerModal?.addEventListener('click', closeProfileManager);
profileManagerModal?.addEventListener('click', (event) => {
  if (event.target === profileManagerModal) closeProfileManager();
});

profileNewBtn?.addEventListener('click', prepareNewProfileForm);

profileSaveBtn?.addEventListener('click', async () => {
  const id = profileFormMode === 'edit' ? (profileEditId?.value || '') : '';
  const selectedProfile = id ? getSelectedManagedProfile() : null;
  if (id && isProfileLocked(selectedProfile)) {
    showProfileStatus(getProfileLockMessage(selectedProfile), 'info', { persist: true });
    return;
  }

  const name = profileNameInput?.value.trim() || '';
  if (!name) {
    profileNameInput?.focus();
    showProfileStatus(getUiText('profile-name-required', 'Profil adı gerekli.'), 'error');
    return;
  }

  const avatar = (profileAvatarInput?.value.trim() || name.charAt(0) || 'P').slice(0, 2).toUpperCase();
  const color = profileColorInput?.value || '#00ddff';

  try {
    if (!id) suppressNextProfileSwitchedEvent = true;
    const payload = id
      ? await window.oslo.updateProfile({ id, name, avatar, color })
      : await window.oslo.createProfile({ name, avatar, color });
    await applyProfilePayload(payload, { restoreTabs: !id });
    if (!id) setTimeout(() => { suppressNextProfileSwitchedEvent = false; }, 0);
    let successMessage = '';
    if (id) {
      selectProfileForEditing(id);
      successMessage = getUiText('profile-updated', 'Profil güncellendi.');
    } else {
      const createdId = payload?.activeProfileId || state.activeProfileId;
      profileFormMode = 'edit';
      selectProfileForEditing(createdId);
      successMessage = getUiText('profile-created', 'Profil oluşturuldu.');
    }
    closeProfileManager();
    showProfileToast(successMessage);
  } catch (error) {
    suppressNextProfileSwitchedEvent = false;
    console.error('Failed to save profile:', error);
    showProfileError(getUiText('profile-save-failed', 'Profile could not be saved.'));
  }
});

profileDeleteBtn?.addEventListener('click', async () => {
  const id = profileEditId?.value || '';
  const profile = getManagedProfiles().find(item => item.id === id);
  if (!profile || isProfileLocked(profile)) {
    showProfileStatus(getProfileLockMessage(profile), 'info', { persist: true });
    return;
  }

  const confirmText = (getUiText('profile-delete-confirm', 'Delete profile "{name}"? This cannot be undone.')).replace('{name}', profile.name);
  const confirmed = await showOsloConfirm(getUiText('profile-manager-title', 'Manage Profiles'), confirmText, { danger: true });
  if (!confirmed) return;

  try {
    const wasActive = id === state.activeProfileId;
    if (wasActive) suppressNextProfileSwitchedEvent = true;
    const payload = await window.oslo.deleteProfile(id);
    await applyProfilePayload(payload, { restoreTabs: wasActive });
    if (wasActive) setTimeout(() => { suppressNextProfileSwitchedEvent = false; }, 0);
    selectProfileForEditing(payload?.activeProfileId || 'default');
    const successMessage = getUiText('profile-deleted', 'Profil silindi.');
    closeProfileManager();
    showProfileToast(successMessage);
  } catch (error) {
    suppressNextProfileSwitchedEvent = false;
    console.error('Failed to delete profile:', error);
    showProfileError(getUiText('profile-delete-failed', 'Profile could not be deleted.'));
  }
});

document.addEventListener('click', (event) => {
  if (profileSwitcher && !profileSwitcher.contains(event.target)) {
    if (profileSwitcher.classList.contains('open')) {
      profileSwitcher.classList.remove('open');
      clearProfileMenuOverlap();
    }
  }
});

// --- Navigation Controls ---
if (navBack) {
  navBack.addEventListener('click', () => {
    if (state.activeTabId) window.oslo.goBack(state.activeTabId);
  });
}

if (navForward) {
  navForward.addEventListener('click', () => {
    if (state.activeTabId) window.oslo.goForward(state.activeTabId);
  });
}

if (navReload) {
  navReload.addEventListener('click', () => {
    if (state.activeTabId) window.oslo.reload(state.activeTabId);
  });
}

const navSplit = document.getElementById('nav-split');
if (navSplit) {
  navSplit.addEventListener('click', () => {
    if (state.activeTabId) window.oslo.toggleSplitScreen(state.activeTabId);
  });
}

// --- Address Input & Navigation ---
if (addressInput) {
  addressInput.addEventListener('input', (e) => {
    setAddressBarInteractionActive(true);
    showAutocompleteSuggestions(addressInput.value);
  });

  addressInput.addEventListener('keydown', (e) => {
    const dropdown = document.getElementById('autocomplete-dropdown');
    const isOpen = dropdown && dropdown.style.display === 'block';

    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && selectedSuggestionIndex >= 0 && selectedSuggestionIndex < currentSuggestions.length) {
        const suggestion = currentSuggestions[selectedSuggestionIndex];
        activateSuggestion(suggestion);
      } else {
        const val = addressInput.value.trim();
        if (val && state.activeTabId) {
          window.oslo.navigate(state.activeTabId, val);
        }
      }
      closeAutocompleteDropdown();
      addressInput.blur();
    } else if (e.key === 'ArrowDown' && isOpen) {
      e.preventDefault();
      selectedSuggestionIndex = (selectedSuggestionIndex + 1) % currentSuggestions.length;
      renderAutocompleteDropdown();
    } else if (e.key === 'ArrowUp' && isOpen) {
      e.preventDefault();
      selectedSuggestionIndex = (selectedSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
      renderAutocompleteDropdown();
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        closeAutocompleteDropdown();
      }
    }
  });

  addressInput.addEventListener('focus', () => {
    setAddressBarInteractionActive(true);
    addressInput.select();
    if (addressInput.value.trim()) {
      showAutocompleteSuggestions(addressInput.value);
    }
  });

  addressInput.addEventListener('blur', () => {
    setTimeout(() => {
      const dropdown = document.getElementById('autocomplete-dropdown');
      if (dropdown && dropdown.style.display === 'block') return;
      setAddressBarInteractionActive(false);
    }, 80);
  });
}

// --- Bookmarks Logic ---
function isLocalNewTabUrl(url) {
  const normalized = String(url || '').replace(/\\/g, '/');
  return !normalized ||
    normalized === 'oslo://newtab' ||
    normalized.includes('/newtab/newtab.html') ||
    normalized.includes('/incognito-newtab/incognito-newtab.html') ||
    normalized.endsWith('newtab.html') ||
    normalized.endsWith('incognito-newtab.html');
}

const addBookmarkBtn = document.getElementById('add-bookmark-btn');
if (addBookmarkBtn) {
  addBookmarkBtn.addEventListener('click', () => {
    const activeTab = state.tabs[state.activeTabId];
    if (!activeTab || isLocalNewTabUrl(activeTab.url)) return;

    const isBookmarked = state.bookmarks.some(b => b.url === activeTab.url);
    if (isBookmarked) {
      const remaining = state.bookmarks.filter(b => b.url !== activeTab.url);
      window.oslo.setBookmarks(remaining).then(updated => {
        state.bookmarks = updated;
        updateBookmarkIcon();
        renderBookmarks();
        renderBookmarksBar();
      });
    } else {
      const generateId = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
        }
        return 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      };
      const newBookmark = {
        id: generateId(),
        title: activeTab.title || activeTab.url,
        url: activeTab.url,
        folderId: null,
        favicon: activeTab.favicon || ''
      };
      const newBookmarksList = [...state.bookmarks, newBookmark];
      window.oslo.setBookmarks(newBookmarksList).then(updated => {
        state.bookmarks = updated;
        updateBookmarkIcon();
        renderBookmarks();
        renderBookmarksBar();
        window.oslo.logTelemetryEvent('bookmark-add', { title: newBookmark.title, url: newBookmark.url });
      });
    }
  });
}



function dismissAddressAutocompleteForOverlay() {
  closeAutocompleteDropdown();
  addressInput?.blur();
  setAutocompleteVisibility(false);
  setAddressBarInteractionActive(false);
}

if (historyBtn) {
  historyBtn.addEventListener('click', () => {
    dismissAddressAutocompleteForOverlay();
    historyPanel?.classList.toggle('open');
    bookmarksPanel?.classList.remove('open');
    settingsOverlay?.classList.remove('open');
    downloadsOverlay?.classList.remove('open');
    if (historyPanel?.classList.contains('open')) {
      renderHistory();
    }
    sendBounds();
  });
}

if (downloadsBtn) {
  downloadsBtn.addEventListener('click', () => {
    dismissAddressAutocompleteForOverlay();
    downloadsOverlay?.classList.toggle('open');
    bookmarksPanel?.classList.remove('open');
    historyPanel?.classList.remove('open');
    settingsOverlay?.classList.remove('open');
    if (downloadsOverlay?.classList.contains('open')) {
      renderDownloads();
    }
    sendBounds();
  });
}

if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    dismissAddressAutocompleteForOverlay();
    settingsOverlay?.classList.toggle('open');
    bookmarksPanel?.classList.remove('open');
    historyPanel?.classList.remove('open');
    downloadsOverlay?.classList.remove('open');
    sendBounds();
  });
}

// --- Clear Browsing History Modal logic ---
document.getElementById('clear-history-btn')?.addEventListener('click', () => {
  clearHistoryModal?.classList.add('open');
  sendBounds();
});

document.getElementById('settings-clear-history')?.addEventListener('click', () => {
  clearHistoryModal?.classList.add('open');
  sendBounds();
});

document.getElementById('close-clear-history-modal')?.addEventListener('click', () => {
  clearHistoryModal?.classList.remove('open');
  sendBounds();
});

document.getElementById('btn-cancel-clear-history')?.addEventListener('click', () => {
  clearHistoryModal?.classList.remove('open');
  sendBounds();
});

if (clearHistoryModal) {
  clearHistoryModal.addEventListener('click', (e) => {
    if (e.target === clearHistoryModal) {
      clearHistoryModal.classList.remove('open');
      sendBounds();
    }
  });
}

const clearBrowserDataModal = document.getElementById('clear-browser-data-modal');
if (clearBrowserDataModal) {
  clearBrowserDataModal.addEventListener('click', (e) => {
    if (e.target === clearBrowserDataModal) {
      clearBrowserDataModal.classList.remove('open');
      sendBounds();
    }
  });
}

document.getElementById('btn-confirm-clear-history')?.addEventListener('click', () => {
  const range = document.getElementById('clear-history-range')?.value || 'all';
  window.oslo.clearHistory(range).then(() => {
    renderHistory();
    clearHistoryModal?.classList.remove('open');
    sendBounds();
  });
});

// --- Bookmark Edit Modal logic ---
const closeBookmarkEditModalFunc = () => {
  closeModalWithContentPreview(bookmarkEditModal);
};

document.getElementById('btn-cancel-bookmark-edit')?.addEventListener('click', closeBookmarkEditModalFunc);
document.getElementById('close-bookmark-edit-modal')?.addEventListener('click', closeBookmarkEditModalFunc);
bookmarkEditModal?.addEventListener('click', (e) => {
  if (e.target === bookmarkEditModal) {
    closeBookmarkEditModalFunc();
  }
});

document.getElementById('btn-save-bookmark-edit')?.addEventListener('click', () => {
  const newTitle = bookmarkEditName?.value.trim();
  if (!newTitle) return;

  const itemIndex = state.bookmarks.findIndex(b => b.id === state.editingBookmarkId);
  if (itemIndex !== -1) {
    const item = state.bookmarks[itemIndex];
    item.title = newTitle;
    if (!item.isFolder) {
      const newUrl = bookmarkEditUrl?.value.trim();
      if (!newUrl) return;
      item.url = newUrl;
    }

    window.oslo.setBookmarks(state.bookmarks).then(updated => {
      state.bookmarks = updated;
      updateBookmarkIcon();
      renderBookmarks();
      renderBookmarksBar();
      closeBookmarkEditModalFunc();
    });
  }
});

// Dismiss context menu on click
document.addEventListener('click', (event) => {
  let changed = false;
  let shouldClearPreview = false;
  if (tabContextMenu && tabContextMenu.style.display === 'block') {
    shouldClearPreview = tabContextMenu.dataset.overlapsContent === 'true';
    tabContextMenu.style.display = 'none';
    tabContextMenu.style.visibility = '';
    tabContextMenu.style.width = '';
    tabContextMenu.style.maxWidth = '';
    tabContextMenu.classList.remove('constrained-to-sidebar');
    delete tabContextMenu.dataset.overlapsContent;
    changed = true;
  }
  const bookmarksBarContextMenu = document.getElementById('bookmarks-bar-context-menu');
  if (bookmarksBarContextMenu && bookmarksBarContextMenu.style.display === 'block') {
    bookmarksBarContextMenu.style.display = 'none';
    changed = true;
  }
  const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
  const clickedAutocompleteSurface = event.target.closest?.('.address-bar-container, .autocomplete-dropdown');
  if (autocompleteDropdown && autocompleteDropdown.style.display === 'block' && !clickedAutocompleteSurface) {
    closeAutocompleteDropdown();
    changed = true;
  }
  if (changed) {
    sendBounds();
    if (shouldClearPreview) {
      clearContentPreviewSoon();
    }
  }
});

// Tab context menu controls
document.getElementById('ctx-new-tab')?.addEventListener('click', () => {
  window.oslo.createTab({ space: state.activeSpace });
});

document.getElementById('ctx-reload-tab')?.addEventListener('click', () => {
  if (state.activeContextTabId) {
    window.oslo.reload(state.activeContextTabId);
  }
});

document.getElementById('ctx-sleep-tab')?.addEventListener('click', () => {
  if (state.activeContextTabId) {
    window.oslo.sleepTab(state.activeContextTabId);
  }
});

document.getElementById('ctx-close-tab')?.addEventListener('click', () => {
  if (state.activeContextTabId) {
    window.oslo.closeTab(state.activeContextTabId);
  }
});

document.getElementById('ctx-close-others')?.addEventListener('click', () => {
  if (state.activeContextTabId) {
    const visibleTabIds = state.tabOrder.filter(id => state.tabs[id] && state.tabs[id].space === state.activeSpace && !state.tabs[id].isPinned);
    visibleTabIds.forEach(id => {
      if (id !== state.activeContextTabId) {
        window.oslo.closeTab(id);
      }
    });
  }
});

window.oslo.onNewtabTopbarAutocompleteActivate?.(({ index }) => {
  const suggestion = currentSuggestions[index];
  if (!suggestion) return;
  activateSuggestion(suggestion);
  closeAutocompleteDropdown();
  addressInput?.blur();
});

window.oslo.onNewtabTopbarAutocompleteClose?.(() => {
  closeAutocompleteDropdown();
});

// --- Listen to Events from Main Process ---
window.oslo.onProfileSwitched?.((payload) => {
  if (suppressNextProfileSwitchedEvent) return;
  applyProfilePayload(payload, { restoreTabs: true }).catch(error => {
    console.error('Failed to apply switched profile:', error);
  });
});

window.oslo.onProfilesUpdated?.((payload) => {
  normalizeProfilePayload(payload || {});
  renderProfiles();
});

window.oslo.onTabCreated((tab) => {
  if (tab.profileId && tab.profileId !== state.activeProfileId) return;
  state.tabs[tab.id] = tab;
  if (!state.tabOrder.includes(tab.id)) {
    state.tabOrder.push(tab.id);
  }
  state.activeTabId = tab.id;
  state.activeSpace = tab.space || 'Genel';
  syncContentAreaSurface();

  renderTabs();
  updateBookmarkIcon();
  updateReaderModeButton();
  setTimeout(sendBounds, 100);
  window.oslo.logTelemetryEvent('tab-create', { isIncognito: tab.isIncognito, space: tab.space });
});

window.oslo.onTabUpdated((tabUpdate) => {
  if (state.tabs[tabUpdate.id]) {
    const oldUrl = state.tabs[tabUpdate.id].url;
    state.tabs[tabUpdate.id] = { ...state.tabs[tabUpdate.id], ...tabUpdate };
    syncContentAreaSurface();

    if (tabUpdate.id === state.activeTabId) {
      if (tabUpdate.url !== undefined) {
        if (addressInput) {
          if (isLocalNewTabUrl(tabUpdate.url)) {
            addressInput.value = '';
          } else {
            addressInput.value = tabUpdate.url;
          }
        }
        updateBookmarkIcon();
        updateSecurityIndicator();
        updateReaderModeButton();

        // Auto-dismiss permission bar on navigation
        const permBar = document.getElementById('permission-bar');
        if (permBar && permBar.style.display === 'flex') {
          permBar.style.display = 'none';
        }
      }
      if (tabUpdate.zoomFactor !== undefined) {
        updateZoomUI();
      }
      updateNavButtonsState();
      updateSplitUI();
      updateReaderModeButton();
    }

    renderTabs();

    if (tabUpdate.url !== undefined && tabUpdate.url !== oldUrl && !isLocalNewTabUrl(tabUpdate.url) && !tabUpdate.url.startsWith('file://')) {
      window.oslo.logTelemetryEvent('page-navigate', { url: tabUpdate.url });
    }
  }
});

window.oslo.onBookmarksUpdated((bookmarks) => {
  state.bookmarks = bookmarks || [];
  updateBookmarkIcon();
  renderBookmarksBar();
  if (bookmarksPanel?.classList.contains('open')) {
    renderBookmarks();
  }
});

window.oslo.onTabClosed((tabId) => {
  delete state.tabs[tabId];
  const idx = state.tabOrder.indexOf(tabId);
  if (idx !== -1) {
    state.tabOrder.splice(idx, 1);
  }
  renderTabs();
  setTimeout(sendBounds, 50);
});

window.oslo.onTabSelected((tabId) => {
  const previousActiveTabId = state.activeTabId;
  if (previousActiveTabId && previousActiveTabId !== tabId && typeof window.oslo.hideNewtabTopbarAutocomplete === 'function') {
    window.oslo.hideNewtabTopbarAutocomplete(previousActiveTabId);
  }

  state.activeTabId = tabId;
  closeAutocompleteDropdown();
  const activeTab = state.tabs[tabId];
  syncContentAreaSurface();

  if (activeTab) {
    state.activeSpace = activeTab.space || 'Genel';
    if (addressInput) {
      if (isLocalNewTabUrl(activeTab.url)) {
        addressInput.value = '';
      } else {
        addressInput.value = activeTab.url;
      }
    }
    updateBookmarkIcon();
    updateSecurityIndicator();
    updateNavButtonsState();
    updateZoomUI();
    updateSplitUI();
    updateReaderModeButton();
    renderSpaces();

    // Auto-dismiss permission bar when switching tabs
    const permBar = document.getElementById('permission-bar');
    if (permBar && permBar.style.display === 'flex') {
      permBar.style.display = 'none';
    }
  }

  renderTabs();
  sendBounds();
});

// Handle Zoom Changed Event
window.oslo.onZoomChanged(({ tabId, zoom }) => {
  if (state.tabs[tabId]) {
    state.tabs[tabId].zoomFactor = zoom;
    if (tabId === state.activeTabId) {
      updateZoomUI();
    }
  }
});

// Handle Split Side Focused Event
window.oslo.onSplitSideFocused(({ tabId, side }) => {
  if (state.tabs[tabId]) {
    state.tabs[tabId].activeSplitSide = side;
    if (tabId === state.activeTabId) {
      updateSplitUI();
    }
  }
});

function updateSplitUI() {
  const activeTab = state.tabs[state.activeTabId];
  const navSplit = document.getElementById('nav-split');
  const indicatorBar = document.getElementById('split-indicator-bar');
  const leftHalf = document.getElementById('split-indicator-left');
  const rightHalf = document.getElementById('split-indicator-right');

  if (activeTab && activeTab.hasSplit) {
    navSplit?.classList.add('active');
    indicatorBar?.classList.add('active');
    if (leftHalf && rightHalf) {
      if (activeTab.activeSplitSide === 'split') {
        leftHalf.classList.remove('focused');
        rightHalf.classList.add('focused');
      } else {
        leftHalf.classList.add('focused');
        rightHalf.classList.remove('focused');
      }
    }
  } else {
    navSplit?.classList.remove('active');
    indicatorBar?.classList.remove('active');
    leftHalf?.classList.remove('focused');
    rightHalf?.classList.remove('focused');
  }
}

// Update Zoom level UI badge
function updateZoomUI() {
  const activeTab = state.tabs[state.activeTabId];
  const zoomIndicator = document.getElementById('zoom-indicator-btn');
  const zoomText = document.getElementById('zoom-value-text');
  if (!zoomIndicator || !zoomText) return;

  if (activeTab && activeTab.zoomFactor !== undefined && activeTab.zoomFactor !== 1.0) {
    const pct = Math.round(activeTab.zoomFactor * 100);
    zoomText.textContent = `${pct}%`;
    zoomIndicator.style.display = 'flex';
  } else {
    zoomIndicator.style.display = 'none';
  }
  sendBounds();
}

// Reset zoom when indicator is clicked
document.getElementById('zoom-indicator-btn')?.addEventListener('click', () => {
  if (state.activeTabId) {
    window.oslo.setTabZoom(state.activeTabId, 1.0);
  }
});

// Download progresses from Main Process
window.oslo.onDownloadProgress((data) => {
  state.downloads[data.id] = data;

  // Auto open downloads overlay when a download starts
  if (data.status === 'progressing' && downloadsOverlay && !downloadsOverlay.classList.contains('open')) {
    dismissAddressAutocompleteForOverlay();
    downloadsOverlay.classList.add('open');
    bookmarksPanel?.classList.remove('open');
    historyPanel?.classList.remove('open');
    settingsOverlay?.classList.remove('open');
    sendBounds();
  }

  renderDownloads();
});

// Global Hotkeys Receiver from Main
window.oslo.onHotkey((hotkeyType) => {
  switch (hotkeyType) {
    case 'newtab':
      window.oslo.createTab({ space: state.activeSpace });
      break;
    case 'closetab':
      if (state.activeTabId) window.oslo.closeTab(state.activeTabId);
      break;
    case 'incognitotab':
      window.oslo.createTab({ isIncognito: true, space: state.activeSpace });
      break;
    case 'nexttab': {
      const spaceTabs = state.tabOrder.filter(id => state.tabs[id] && state.tabs[id].space === state.activeSpace);
      if (spaceTabs.length > 1) {
        const currentIdx = spaceTabs.indexOf(state.activeTabId);
        const nextIdx = (currentIdx + 1) % spaceTabs.length;
        window.oslo.selectTab(spaceTabs[nextIdx]);
      }
      break;
    }
    case 'prevtab': {
      const spaceTabs = state.tabOrder.filter(id => state.tabs[id] && state.tabs[id].space === state.activeSpace);
      if (spaceTabs.length > 1) {
        const currentIdx = spaceTabs.indexOf(state.activeTabId);
        const prevIdx = (currentIdx - 1 + spaceTabs.length) % spaceTabs.length;
        window.oslo.selectTab(spaceTabs[prevIdx]);
      }
      break;
    }
    case 'togglebookmarks':
      if (bookmarksPanel) {
        dismissAddressAutocompleteForOverlay();
        bookmarksPanel.classList.toggle('open');
        historyPanel?.classList.remove('open');
        settingsOverlay?.classList.remove('open');
        downloadsOverlay?.classList.remove('open');
        if (bookmarksPanel.classList.contains('open')) {
          renderBookmarks();
        }
        sendBounds();
      }
      break;
    case 'togglehistory':
      const histBtn = document.getElementById('history-btn');
      if (histBtn) histBtn.click();
      break;
    case 'findinpage':
      showFindBar();
      break;
    case 'reader':
      openReaderModeFromActiveTab();
      break;
  }
});

// Helper: Navigation Buttons State
function updateNavButtonsState() {
  const activeTab = state.tabs[state.activeTabId];
  if (activeTab) {
    navBack.disabled = !activeTab.canGoBack;
    navForward.disabled = !activeTab.canGoForward;
    navBack.style.opacity = activeTab.canGoBack ? '1' : '0.4';
    navForward.style.opacity = activeTab.canGoForward ? '1' : '0.4';
    navBack.style.pointerEvents = activeTab.canGoBack ? 'auto' : 'none';
    navForward.style.pointerEvents = activeTab.canGoForward ? 'auto' : 'none';
  } else {
    navBack.disabled = true;
    navForward.disabled = true;
    navBack.style.opacity = '0.4';
    navForward.style.opacity = '0.4';
    navBack.style.pointerEvents = 'none';
    navForward.style.pointerEvents = 'none';
  }
}

// Helper: HTTPS Security Lock
function updateSecurityIndicator() {
  const indicator = document.getElementById('security-indicator');
  if (!indicator) return;

  const activeTab = state.tabs[state.activeTabId];
  if (!activeTab || !activeTab.url || isLocalNewTabUrl(activeTab.url)) {
    indicator.className = 'security-indicator local';
    indicator.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
      </svg>
    `;
    indicator.title = translations[state.currentLang]['connection-local'] || 'Yerel Sayfa';
    return;
  }

  try {
    const url = new URL(activeTab.url);
    if (url.protocol === 'https:') {
      indicator.className = 'security-indicator secure';
      indicator.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
        </svg>
      `;
      indicator.title = translations[state.currentLang]['connection-secure'] || 'Güvenli Bağlantı (HTTPS)';
    } else if (url.protocol === 'http:') {
      indicator.className = 'security-indicator insecure';
      indicator.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      `;
      indicator.title = translations[state.currentLang]['connection-insecure'] || 'Güvenli Olmayan Bağlantı (HTTP)';
    } else {
      indicator.className = 'security-indicator local';
      indicator.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
      `;
      indicator.title = translations[state.currentLang]['connection-local'] || 'Yerel Sayfa';
    }
  } catch (e) {
    indicator.className = 'security-indicator local';
    indicator.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
      </svg>
    `;
    indicator.title = translations[state.currentLang]['connection-local'] || 'Yerel Sayfa';
  }
}

// Helpers: Autocomplete Suggestions
let selectedSuggestionIndex = -1;
let currentSuggestions = [];
let autocompleteRequestToken = 0;
let autocompleteRenderToken = 0;

function setAddressBarInteractionActive(active) {
  const topBar = document.getElementById('top-bar');
  document.body.classList.toggle('address-bar-active', !!active);
  topBar?.classList.toggle('address-bar-active', !!active);
}

function setAutocompleteVisibility(active) {
  const topBar = document.getElementById('top-bar');
  const dropdown = document.getElementById('autocomplete-dropdown');
  document.body.classList.toggle('autocomplete-active', !!active);
  topBar?.classList.toggle('autocomplete-active', !!active);
  dropdown?.classList.toggle('is-visible', !!active);
}

function isActiveTabNewTab() {
  const activeTab = state.tabs[state.activeTabId];
  const url = String(activeTab?.url || '');
  return !activeTab || isLocalNewTabUrl(url);
}

function getNewtabTopbarAutocompletePosition() {
  const addressRect = document.querySelector('.address-bar-container')?.getBoundingClientRect();
  const contentRect = document.getElementById('content-area')?.getBoundingClientRect();
  if (!addressRect || !contentRect) {
    return { left: 8, top: 0, width: Math.max(180, window.innerWidth - 16), maxHeight: 300 };
  }

  return {
    left: Math.max(8, Math.round(addressRect.left - contentRect.left)),
    top: Math.max(0, Math.round(addressRect.bottom + 8 - contentRect.top)),
    width: Math.max(180, Math.round(Math.min(addressRect.width, contentRect.width - 16))),
    maxHeight: Math.max(120, Math.round(Math.min(320, contentRect.height - 12)))
  };
}

function sendNewtabTopbarAutocomplete() {
  if (!state.activeTabId || !isActiveTabNewTab() || currentSuggestions.length === 0) return;
  if (typeof window.oslo.showNewtabTopbarAutocomplete !== 'function') return;

  window.oslo.showNewtabTopbarAutocomplete({
    tabId: state.activeTabId,
    suggestions: currentSuggestions.map(suggestion => ({
      type: suggestion.type,
      title: suggestion.title,
      url: suggestion.url,
      icon: suggestion.icon
    })),
    selectedIndex: selectedSuggestionIndex,
    position: getNewtabTopbarAutocompletePosition()
  });
}

function hideNewtabTopbarAutocomplete() {
  if (!state.activeTabId || typeof window.oslo.hideNewtabTopbarAutocomplete !== 'function') return;
  window.oslo.hideNewtabTopbarAutocomplete(state.activeTabId);
}

function positionAutocompleteDropdown() {
  const dropdown = document.getElementById('autocomplete-dropdown');
  if (!dropdown) return;

  const gap = 8;
  setAddressBarInteractionActive(true);
  const topBar = document.getElementById('top-bar');
  if (topBar) void topBar.offsetHeight;

  dropdown.style.top = '';
  dropdown.style.left = '';
  dropdown.style.right = '';
  dropdown.style.width = '';

  const rect = dropdown.getBoundingClientRect();
  const top = Math.max(gap, Math.round(rect.top || 0));
  const availableHeight = Math.max(96, window.innerHeight - top - gap);
  const maxHeight = Math.min(360, availableHeight);

  dropdown.style.maxHeight = `${Math.round(maxHeight)}px`;

  const contentTop = document.getElementById('content-area')?.getBoundingClientRect().top ?? window.innerHeight;
  const dropdownHeight = Math.min(dropdown.scrollHeight || dropdown.offsetHeight || 0, maxHeight);
  dropdown.dataset.overlapsContent = top + dropdownHeight > contentTop ? 'true' : 'false';
}

function scheduleAutocompleteReposition(token = autocompleteRenderToken) {
  let frame = 0;
  const tick = () => {
    const dropdown = document.getElementById('autocomplete-dropdown');
    if (token !== autocompleteRenderToken || !dropdown || dropdown.style.display !== 'block') return;
    positionAutocompleteDropdown();
    if (dropdown.style.visibility !== 'hidden') {
      sendBounds();
    }
    frame += 1;
    if (frame < 6) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
  setTimeout(() => {
    if (token === autocompleteRenderToken) {
      const dropdown = document.getElementById('autocomplete-dropdown');
      positionAutocompleteDropdown();
      if (dropdown && dropdown.style.display === 'block' && dropdown.style.visibility !== 'hidden') {
        sendBounds();
      }
    }
  }, 260);
}

function closeAutocompleteDropdown({ clearPreview = true } = {}) {
  const dropdown = document.getElementById('autocomplete-dropdown');
  autocompleteRequestToken++;
  autocompleteRenderToken++;
  if (dropdown) {
    dropdown.style.display = 'none';
    dropdown.style.visibility = '';
    delete dropdown.dataset.overlapsContent;
  }
  hideNewtabTopbarAutocomplete();
  setAutocompleteVisibility(false);
  if (document.activeElement !== addressInput) {
    setAddressBarInteractionActive(false);
  }
  currentSuggestions = [];
  selectedSuggestionIndex = -1;
  if (clearPreview) clearContentPreviewSoon();
  sendBounds();
}

function getSmartCommands() {
  const t = translations[state.currentLang] || {};
  return [
    {
      id: 'settings',
      title: t['cmd-open-settings'] || 'Ayarları aç',
      url: t['cmd-open-settings-desc'] || 'OSLO ayarları',
      keywords: ['ayar', 'settings', 'preferences', 'options'],
      run: () => settingsBtn?.click()
    },
    {
      id: 'history',
      title: t['cmd-open-history'] || 'Geçmişi aç',
      url: t['cmd-open-history-desc'] || 'Tarama geçmişi',
      keywords: ['geçmiş', 'gecmis', 'history'],
      run: () => historyBtn?.click()
    },
    {
      id: 'downloads',
      title: t['cmd-open-downloads'] || 'İndirmeleri aç',
      url: t['cmd-open-downloads-desc'] || 'İndirme listesi',
      keywords: ['indir', 'indirme', 'download', 'downloads'],
      run: () => downloadsBtn?.click()
    },
    {
      id: 'new-tab',
      title: t['cmd-new-tab'] || 'Yeni sekme aç',
      url: 'Ctrl+T',
      keywords: ['yeni sekme', 'new tab', 'tab'],
      run: () => window.oslo.createTab({ space: state.activeSpace })
    },
    {
      id: 'incognito',
      title: t['cmd-new-incognito'] || 'Gizli sekme aç',
      url: 'Ctrl+Shift+P',
      keywords: ['gizli', 'incognito', 'private'],
      run: () => window.oslo.createTab({ isIncognito: true, space: state.activeSpace })
    },
    {
      id: 'reader-mode',
      title: t['cmd-reader-mode'] || 'Okuma modunu aç',
      url: 'Ctrl+Shift+R',
      keywords: ['okuma', 'reader', 'read', 'article', 'makale'],
      run: openReaderModeFromActiveTab
    }
  ];
}

function commandIcon() {
  return `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M4 17h4v-2H4v2zm0-4h10v-2H4v2zm0-6v2h16V7H4zm13 10 5-5-5-5v3h-5v4h5v3z"/>
    </svg>
  `;
}

function tabIcon() {
  return `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
    </svg>
  `;
}

function activateSuggestion(suggestion) {
  if (!suggestion) return;
  if (suggestion.type === 'tab' && suggestion.tabId) {
    window.oslo.selectTab(suggestion.tabId);
  } else if (suggestion.type === 'command' && typeof suggestion.run === 'function') {
    suggestion.run();
  } else if (state.activeTabId && suggestion.url) {
    window.oslo.navigate(state.activeTabId, suggestion.url);
  }
}

function showAutocompleteSuggestions(text) {
  const dropdown = document.getElementById('autocomplete-dropdown');
  if (!dropdown) return;

  const cleanText = text.trim().toLowerCase();
  if (!cleanText) {
    closeAutocompleteDropdown();
    return;
  }

  const requestToken = ++autocompleteRequestToken;
  const renderForHistory = (historyItems = []) => {
    if (requestToken !== autocompleteRequestToken || addressInput.value.trim().toLowerCase() !== cleanText) return;

    const searchEngine = document.getElementById('settings-search-engine')?.value || 'duckduckgo';
    const engineNames = { google: 'Google', duckduckgo: 'DuckDuckGo', bing: 'Bing', yahoo: 'Yahoo', yandex: 'Yandex', brave: 'Brave', ecosia: 'Ecosia', startpage: 'Startpage' };
    const searchEngineName = engineNames[searchEngine] || 'DuckDuckGo';

    const suggestions = [];
    const commandMatches = getSmartCommands().filter(command => {
      return command.title.toLowerCase().includes(cleanText) ||
        command.url.toLowerCase().includes(cleanText) ||
        command.keywords.some(keyword => keyword.toLowerCase().includes(cleanText));
    }).slice(0, 4);

    commandMatches.forEach(command => {
      suggestions.push({
        type: 'command',
        title: command.title,
        url: command.url,
        icon: commandIcon(),
        run: command.run
      });
    });

    const matchedTabs = state.tabOrder
      .map(id => state.tabs[id])
      .filter(tab => tab && !tab.isSleeping && (
        (tab.title || '').toLowerCase().includes(cleanText) ||
        (tab.url || '').toLowerCase().includes(cleanText) ||
        (tab.space || '').toLowerCase().includes(cleanText)
      ))
      .slice(0, 5);

    matchedTabs.forEach(tab => {
      suggestions.push({
        type: 'tab',
        tabId: tab.id,
        title: `${tab.title || tab.url} · ${tab.space || 'Genel'}`,
        url: tab.url || (translations[state.currentLang]['new-tab'] || 'Yeni Sekme'),
        icon: tabIcon()
      });
    });

    // 1. Search Engine Suggestion
    const suffix = translations[state.currentLang]['search-suggestion'] || 'ile ara';
    suggestions.push({
      type: 'search',
      title: `"${text}" ${suffix} ${searchEngineName}`,
      url: text,
      icon: `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
      `
    });

    // 2. Bookmarks Suggestion (up to 5)
    const matchedBookmarks = state.bookmarks.filter(b => {
      return !b.isFolder && (
        (b.title || '').toLowerCase().includes(cleanText) ||
        (b.url || '').toLowerCase().includes(cleanText)
      );
    }).slice(0, 5);

    matchedBookmarks.forEach(b => {
      suggestions.push({
        type: 'bookmark',
        title: b.title,
        url: b.url,
        icon: `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
        `
      });
    });

    // 3. History Suggestion (up to 5)
    const matchedHistory = (historyItems || []).filter(h => {
      return (
        (h.title || '').toLowerCase().includes(cleanText) ||
        (h.url || '').toLowerCase().includes(cleanText)
      );
    }).slice(0, 5);

    matchedHistory.forEach(h => {
      if (!suggestions.some(s => s.url === h.url)) {
        suggestions.push({
          type: 'history',
          title: h.title,
          url: h.url,
          icon: `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
            </svg>
          `
        });
      }
    });

    currentSuggestions = suggestions;
    selectedSuggestionIndex = -1;
    renderAutocompleteDropdown();
  };

  renderForHistory([]);
  window.oslo.getHistory()
    .then(renderForHistory)
    .catch(() => {
      if (requestToken === autocompleteRequestToken) {
        renderForHistory([]);
      }
    });
}

function renderAutocompleteDropdown() {
  const dropdown = document.getElementById('autocomplete-dropdown');
  if (!dropdown) return;

  if (currentSuggestions.length === 0) {
    closeAutocompleteDropdown();
    return;
  }

  if (isActiveTabNewTab()) {
    const token = ++autocompleteRenderToken;
    dropdown.style.display = 'none';
    dropdown.style.visibility = '';
    delete dropdown.dataset.overlapsContent;
    setAddressBarInteractionActive(true);
    setAutocompleteVisibility(false);
    clearContentPreviewSoon();
    sendNewtabTopbarAutocomplete();
    if (token === autocompleteRenderToken) {
      sendBounds();
    }
    return;
  }

  const token = ++autocompleteRenderToken;
  dropdown.innerHTML = '';
  currentSuggestions.forEach((s, idx) => {
    const item = document.createElement('div');
    item.className = `autocomplete-item ${idx === selectedSuggestionIndex ? 'selected' : ''}`;
    item.innerHTML = `
      <div class="autocomplete-item-icon">${s.icon}</div>
      <div class="autocomplete-item-info">
        <div class="autocomplete-item-title">${escapeHtml(s.title)}</div>
        <div class="autocomplete-item-url">${escapeHtml(s.url)}</div>
      </div>
    `;

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      activateSuggestion(s);
      closeAutocompleteDropdown();
      addressInput.blur();
    });

    dropdown.appendChild(item);
  });

  dropdown.style.visibility = 'hidden';
  dropdown.style.display = 'block';
  setAddressBarInteractionActive(true);
  setAutocompleteVisibility(true);
  positionAutocompleteDropdown();
  scheduleAutocompleteReposition(token);

  const revealDropdown = () => {
    if (token !== autocompleteRenderToken) {
      clearContentPreviewSoon();
      return;
    }

    positionAutocompleteDropdown();
    dropdown.style.visibility = '';
    sendBounds();
  };

  if (dropdown.dataset.overlapsContent === 'true') {
    captureContentPreview().then((captured) => {
      if (!captured && token === autocompleteRenderToken) {
        dropdown.dataset.overlapsContent = 'false';
      }
      revealDropdown();
    }).catch(() => {
      if (token === autocompleteRenderToken) {
        dropdown.dataset.overlapsContent = 'false';
      }
      revealDropdown();
    });
  } else {
    clearContentPreviewSoon();
    revealDropdown();
  }
}

// Helpers: Find In Page
function showFindBar() {
  const findBar = document.getElementById('find-bar');
  if (!findBar) return;
  findBar.style.display = 'flex';
  const findInput = document.getElementById('find-input');
  if (findInput) {
    findInput.focus();
    findInput.select();
  }
  sendBounds();
}

function hideFindBar() {
  const findBar = document.getElementById('find-bar');
  if (!findBar) return;
  findBar.style.display = 'none';
  window.oslo.stopFindInPage('clearSelection');
  const countEl = document.getElementById('find-results-count');
  if (countEl) countEl.textContent = '0/0';
  sendBounds();
}

// Bind Find Bar controls
document.getElementById('find-input')?.addEventListener('input', (e) => {
  const text = e.target.value;
  if (text) {
    window.oslo.findInPage(text, { findNext: false });
  } else {
    window.oslo.stopFindInPage('clearSelection');
    const countEl = document.getElementById('find-results-count');
    if (countEl) countEl.textContent = '0/0';
  }
});

document.getElementById('find-prev')?.addEventListener('click', () => {
  const text = document.getElementById('find-input')?.value;
  if (text) {
    window.oslo.findInPage(text, { findNext: true, forward: false });
  }
});

document.getElementById('find-next')?.addEventListener('click', () => {
  const text = document.getElementById('find-input')?.value;
  if (text) {
    window.oslo.findInPage(text, { findNext: true, forward: true });
  }
});

document.getElementById('find-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const text = e.target.value;
    if (text) {
      window.oslo.findInPage(text, { findNext: true, forward: !e.shiftKey });
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    hideFindBar();
  }
});

document.getElementById('find-close')?.addEventListener('click', () => {
  hideFindBar();
});

window.oslo.onFindResult((result) => {
  const countEl = document.getElementById('find-results-count');
  if (countEl && result.activeMatchOrdinal !== undefined && result.matches !== undefined) {
    countEl.textContent = `${result.activeMatchOrdinal}/${result.matches}`;
  }
});

// Helpers: Spaces UI Switcher
const presetEmojis = ['🌐', '🏠', '💼', '🎓', '✈️', '🎨', '🎮', '💬', '🛍️', '🔧', '🍿', '🚀', '💡', '📝'];
const presetColors = [
  { hex: '#000000', text: '#ffffff' }, // Black
  { hex: '#3b82f6', text: '#ffffff' }, // Blue
  { hex: '#10b981', text: '#ffffff' }, // Emerald
  { hex: '#ef4444', text: '#ffffff' }, // Crimson
  { hex: '#f59e0b', text: '#000000' }, // Amber
  { hex: '#8b5cf6', text: '#ffffff' }, // Purple
  { hex: '#ec4899', text: '#ffffff' }, // Pink
  { hex: '#06b6d4', text: '#ffffff' }, // Cyan
  { hex: '#f97316', text: '#ffffff' }, // Orange
  { hex: '#6366f1', text: '#ffffff' }, // Indigo
  { hex: '#f43f5e', text: '#ffffff' }, // Rose
  { hex: '#14b8a6', text: '#ffffff' }, // Teal
  { hex: '#84cc16', text: '#000000' }, // Lime
  { hex: '#64748b', text: '#ffffff' }, // Slate
  { hex: '#dc2626', text: '#ffffff' }  // Red
];

let selectedAddEmoji = '🌐';
let selectedAddColor = presetColors[0];
let selectedEditEmoji = '🌐';
let selectedEditColor = presetColors[0];

function initWorkspaceCustomizationGrids() {
  const addEmojiGrid = document.getElementById('space-add-emoji-grid');
  const addColorGrid = document.getElementById('space-add-color-grid');
  const editEmojiGrid = document.getElementById('space-options-emoji-grid');
  const editColorGrid = document.getElementById('space-options-color-grid');

  if (addEmojiGrid) {
    addEmojiGrid.innerHTML = '';
    presetEmojis.forEach(emoji => {
      const item = document.createElement('div');
      item.className = `emoji-item ${emoji === selectedAddEmoji ? 'active' : ''}`;
      item.textContent = emoji;
      item.addEventListener('click', () => {
        selectedAddEmoji = emoji;
        addEmojiGrid.querySelectorAll('.emoji-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      });
      addEmojiGrid.appendChild(item);
    });
  }

  if (addColorGrid) {
    addColorGrid.innerHTML = '';
    presetColors.forEach(color => {
      const item = document.createElement('div');
      item.className = `color-item ${color.hex === selectedAddColor.hex ? 'active' : ''}`;
      item.style.backgroundColor = color.hex;
      item.addEventListener('click', () => {
        selectedAddColor = color;
        addColorGrid.querySelectorAll('.color-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      });
      addColorGrid.appendChild(item);
    });
  }

  if (editEmojiGrid) {
    editEmojiGrid.innerHTML = '';
    presetEmojis.forEach(emoji => {
      const item = document.createElement('div');
      item.className = `emoji-item ${emoji === selectedEditEmoji ? 'active' : ''}`;
      item.textContent = emoji;
      item.addEventListener('click', () => {
        selectedEditEmoji = emoji;
        editEmojiGrid.querySelectorAll('.emoji-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      });
      editEmojiGrid.appendChild(item);
    });
  }

  if (editColorGrid) {
    editColorGrid.innerHTML = '';
    presetColors.forEach(color => {
      const item = document.createElement('div');
      item.className = `color-item ${color.hex === selectedEditColor.hex ? 'active' : ''}`;
      item.style.backgroundColor = color.hex;
      item.addEventListener('click', () => {
        selectedEditColor = color;
        editColorGrid.querySelectorAll('.color-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      });
      editColorGrid.appendChild(item);
    });
  }
}

export function renderSpaces() {
  const spacesList = document.getElementById('spaces-list');
  if (!spacesList) return;

  spacesList.innerHTML = '';

  state.spaces.forEach(space => {
    const spaceName = typeof space === 'string' ? space : space.name;
    const spaceEmoji = typeof space === 'object' && space.emoji ? space.emoji : '🌐';
    let spaceColor = typeof space === 'object' && space.color ? space.color : '#10b981';
    if (spaceName === 'Genel') {
      spaceColor = '#000000';
    }
    const matchingColor = presetColors.find(c => c.hex === spaceColor);
    const spaceTextColor = matchingColor ? matchingColor.text : '#ffffff';

    const pill = document.createElement('div');
    pill.className = `space-pill ${spaceName === state.activeSpace ? 'active' : ''}`;

    pill.style.setProperty('--space-color', spaceColor);
    pill.style.setProperty('--space-text-color', spaceTextColor);

    const displayName = spaceName === 'Genel' ? (translations[state.currentLang]['general'] || 'Genel') : spaceName;
    pill.title = displayName;

    const isCollapsed = sidebar?.classList.contains('collapsed');
    if (isCollapsed) {
      pill.textContent = spaceEmoji;
    } else {
      pill.innerHTML = `<span style="margin-right: 6px;">${escapeHtml(spaceEmoji)}</span><span>${escapeHtml(displayName)}</span>`;
    }

    pill.addEventListener('click', () => {
      state.activeSpace = spaceName;
      renderSpaces();
      renderTabs();
      window.oslo.logTelemetryEvent('space-switch', { space: spaceName });

      const spaceTabs = state.tabOrder.filter(id => state.tabs[id] && state.tabs[id].space === spaceName);
      if (spaceTabs.length > 0) {
        spaceTabs.sort((a, b) => state.tabs[b].lastActive - state.tabs[a].lastActive);
        window.oslo.selectTab(spaceTabs[0]);
      } else {
        window.oslo.createTab({ space: spaceName });
      }
    });

    pill.addEventListener('dblclick', () => {
      if (spaceName === 'Genel') return;

      const confirmText = translations[state.currentLang]['delete-space-confirm'] || 'Bu çalışma alanını silmek istediğinize emin misiniz? (Sekmeler Genel alanına taşınacaktır)';
      showSpaceDeleteModal(
        spaceName,
        confirmText,
        // delete callback
        () => {
          state.tabOrder.forEach(tabId => {
            if (state.tabs[tabId] && state.tabs[tabId].space === spaceName) {
              window.oslo.updateTabSpace(tabId, 'Genel');
            }
          });
          window.oslo.deleteSpace(spaceName).then(updated => {
            state.spaces = updated;
            if (state.activeSpace === spaceName) {
              state.activeSpace = 'Genel';
            }
            renderSpaces();
            renderTabs();

            const spaceTabs = state.tabOrder.filter(id => state.tabs[id] && state.tabs[id].space === 'Genel');
            if (spaceTabs.length > 0) {
              spaceTabs.sort((a, b) => state.tabs[b].lastActive - state.tabs[a].lastActive);
              window.oslo.selectTab(spaceTabs[0]);
            }
          });
        },
        // rename/update callback
        (newSpaceObj) => {
          if (newSpaceObj && newSpaceObj.name) {
            const cleanName = newSpaceObj.name.trim();
            state.tabOrder.forEach(tabId => {
              if (state.tabs[tabId] && state.tabs[tabId].space === spaceName) {
                window.oslo.updateTabSpace(tabId, cleanName);
              }
            });
            window.oslo.updateSpace(spaceName, newSpaceObj).then(updated => {
              state.spaces = updated;
              if (state.activeSpace === spaceName) {
                state.activeSpace = cleanName;
              }
              renderSpaces();
              renderTabs();
            });
          }
        }
      );
    });

    pill.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (spaceName === 'Genel') return;

      const confirmText = translations[state.currentLang]['delete-space-confirm'] || 'Bu çalışma alanını silmek istediğinize emin misiniz? (Sekmeler Genel alanına taşınacaktır)';
      showSpaceDeleteModal(
        spaceName,
        confirmText,
        // delete callback
        () => {
          state.tabOrder.forEach(tabId => {
            if (state.tabs[tabId] && state.tabs[tabId].space === spaceName) {
              window.oslo.updateTabSpace(tabId, 'Genel');
            }
          });
          window.oslo.deleteSpace(spaceName).then(updated => {
            state.spaces = updated;
            if (state.activeSpace === spaceName) {
              state.activeSpace = 'Genel';
            }
            renderSpaces();
            renderTabs();

            const spaceTabs = state.tabOrder.filter(id => state.tabs[id] && state.tabs[id].space === 'Genel');
            if (spaceTabs.length > 0) {
              spaceTabs.sort((a, b) => state.tabs[b].lastActive - state.tabs[a].lastActive);
              window.oslo.selectTab(spaceTabs[0]);
            }
          });
        },
        // rename/update callback
        (newSpaceObj) => {
          if (newSpaceObj && newSpaceObj.name) {
            const cleanName = newSpaceObj.name.trim();
            state.tabOrder.forEach(tabId => {
              if (state.tabs[tabId] && state.tabs[tabId].space === spaceName) {
                window.oslo.updateTabSpace(tabId, cleanName);
              }
            });
            window.oslo.updateSpace(spaceName, newSpaceObj).then(updated => {
              state.spaces = updated;
              if (state.activeSpace === spaceName) {
                state.activeSpace = cleanName;
              }
              renderSpaces();
              renderTabs();
            });
          }
        }
      );
    });

    spacesList.appendChild(pill);
  });
}
window.renderSpaces = renderSpaces;

document.getElementById('add-space-btn')?.addEventListener('click', () => {
  const title = translations[state.currentLang]['spaces-title'] || 'Çalışma Alanları';
  const label = translations[state.currentLang]['new-space-prompt'] || 'Yeni çalışma alanı adı:';
  showSpaceModal(title, label, '', (newSpaceObj) => {
    if (newSpaceObj && newSpaceObj.name && newSpaceObj.name.trim()) {
      const cleanName = newSpaceObj.name.trim();
      window.oslo.addSpace(newSpaceObj).then(updated => {
        state.spaces = updated;
        state.activeSpace = cleanName;
        renderSpaces();
        renderTabs();
        window.oslo.createTab({ space: cleanName });
        window.oslo.logTelemetryEvent('space-create', { space: cleanName });
      });
    }
  });
});

// --- Initialize Settings and Load First Tab ---
function init() {
  // Initialize panels input and close handlers
  initPanels();

  // Initialize settings options and load settings store
  initSettings();

  loadProfiles()
    .then(() => loadProfileScopedData({ restoreTabs: true }))
    .catch(error => {
      console.error('Failed to initialize profile data:', error);
      window.oslo.createTab({ space: state.activeSpace });
    });

  // Setup initial states
  updateNavButtonsState();
  updateSecurityIndicator();
}

document.addEventListener('DOMContentLoaded', init);

// --- Multi-window global shortcut and panel/modal closer listener ---
window.addEventListener('keydown', (e) => {
  const isControl = navigator.platform.indexOf('Mac') > -1 ? e.metaKey : e.ctrlKey;
  if (isControl && e.key.toLowerCase() === 'n' && !e.shiftKey) {
    e.preventDefault();
    window.oslo.newWindow();
  }

  if (e.key === 'Escape') {
    let closedAny = false;

    // Close panels
    const panels = [
      document.getElementById('bookmarks-panel'),
      document.getElementById('history-panel'),
      document.getElementById('downloads-overlay'),
      document.getElementById('settings-overlay')
    ];
    panels.forEach(p => {
      if (p && p.classList.contains('open')) {
        p.classList.remove('open');
        closedAny = true;
      }
    });

    // Close modals
    const modals = [
      document.getElementById('clear-history-modal'),
      document.getElementById('bookmark-edit-modal'),
      document.getElementById('profile-manager-modal'),
      document.getElementById('folder-create-modal'),
      document.getElementById('update-modal'),
      document.getElementById('telemetry-log-modal'),
      document.getElementById('permissions-manager-modal'),
      document.getElementById('site-data-modal'),
      document.getElementById('certificate-exceptions-modal'),
      document.getElementById('security-info-modal'),
      document.getElementById('space-modal'),
      document.getElementById('space-delete-modal')
    ];
    modals.forEach(m => {
      if (m && m.classList.contains('open')) {
        m.classList.remove('open');
        closedAny = true;
      }
    });

    // Close find bar
    const findBar = document.getElementById('find-bar');
    if (findBar && findBar.style.display === 'flex') {
      hideFindBar();
      closedAny = true;
    }

    if (closedAny) {
      e.preventDefault();
      sendBounds();
      clearContentPreviewSoon();
    }
  }
});

// --- Tab Context Menu Mute/Unmute Action Listeners ---
document.getElementById('ctx-mute-tab')?.addEventListener('click', () => {
  if (state.activeContextTabId) {
    window.oslo.muteTab(state.activeContextTabId, true);
  }
});

document.getElementById('ctx-unmute-tab')?.addEventListener('click', () => {
  if (state.activeContextTabId) {
    window.oslo.muteTab(state.activeContextTabId, false);
  }
});

// --- Tab Context Menu Pin/Unpin Action Listeners ---
document.getElementById('ctx-pin-tab')?.addEventListener('click', () => {
  const tabId = state.activeContextTabId;
  if (tabId && state.tabs[tabId]) {
    state.tabs[tabId].isPinned = true;
    window.oslo.setTabPinned(tabId, true);
    const pinned = state.tabOrder.filter(id => state.tabs[id] && state.tabs[id].isPinned);
    const unpinned = state.tabOrder.filter(id => state.tabs[id] && !state.tabs[id].isPinned);
    state.tabOrder = [...pinned, ...unpinned];
    window.oslo.reorderTabs(state.tabOrder);
    renderTabs();
  }
});

document.getElementById('ctx-unpin-tab')?.addEventListener('click', () => {
  const tabId = state.activeContextTabId;
  if (tabId && state.tabs[tabId]) {
    state.tabs[tabId].isPinned = false;
    window.oslo.setTabPinned(tabId, false);
    const pinned = state.tabOrder.filter(id => state.tabs[id] && state.tabs[id].isPinned);
    const unpinned = state.tabOrder.filter(id => state.tabs[id] && !state.tabs[id].isPinned);
    state.tabOrder = [...pinned, ...unpinned];
    window.oslo.reorderTabs(state.tabOrder);
    renderTabs();
  }
});

// --- Notification Permission Request UI Handler ---
window.oslo.onPermissionRequest((req) => {
  const permBar = document.getElementById('permission-bar');
  const permDomain = document.getElementById('permission-domain');
  const permMsg = permBar?.querySelector('[data-i18n="permission-msg"]');
  const allowBtn = document.getElementById('permission-allow-btn');
  const blockBtn = document.getElementById('permission-block-btn');

  if (permBar && permDomain) {
    const permissionLabel = translations[state.currentLang][`permission-${req.permission}`] || req.permission;
    const template = translations[state.currentLang]['permission-request-template'] || '{domain} {permission} izni istiyor.';
    permDomain.textContent = req.domain;
    if (permMsg) {
      permMsg.textContent = template
        .replace('{domain}', '')
        .replace('{permission}', permissionLabel)
        .replace(/\s+/g, ' ')
        .trim();
    }
    permBar.style.display = 'flex';
    sendBounds();

    // Clone buttons to clear existing event listeners
    const newAllowBtn = allowBtn.cloneNode(true);
    const newBlockBtn = blockBtn.cloneNode(true);
    allowBtn.parentNode.replaceChild(newAllowBtn, allowBtn);
    blockBtn.parentNode.replaceChild(newBlockBtn, blockBtn);

    newAllowBtn.addEventListener('click', () => {
      window.oslo.respondToPermission(req.id, true);
      permBar.style.display = 'none';
      sendBounds();
    });

    newBlockBtn.addEventListener('click', () => {
      window.oslo.respondToPermission(req.id, false);
      permBar.style.display = 'none';
      sendBounds();
    });
  }
});

// --- Password Save Request UI Handler ---
window.oslo.onPasswordSavePrompt((data) => {
  const saveBar = document.getElementById('password-save-bar');
  const saveMessage = document.getElementById('password-save-message');
  const saveBtn = document.getElementById('password-save-btn');
  const cancelBtn = document.getElementById('password-cancel-btn');

  if (saveBar && saveMessage && saveBtn && cancelBtn) {
    const domain = data.origin.replace(/^https?:\/\//, '');
    const username = data.username;

    let msgTemplate = translations[state.currentLang]['password-save-prompt'] || 'Save password for {domain}? ({username})';
    saveMessage.textContent = msgTemplate.replace('{domain}', domain).replace('{username}', username);

    saveBar.style.display = 'flex';
    sendBounds();

    // Clone buttons to clear existing event listeners
    const newSaveBtn = saveBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newSaveBtn.addEventListener('click', () => {
      window.oslo.saveCredential({
        origin: data.origin,
        username: data.username,
        password: data.password
      }).then(() => {
        saveBar.style.display = 'none';
        sendBounds();
      });
    });

    newCancelBtn.addEventListener('click', () => {
      saveBar.style.display = 'none';
      sendBounds();
    });
  }
});

// --- Global Uncaught Exceptions Listener (Telemetry) ---
window.addEventListener('error', (event) => {
  window.oslo.logTelemetryCrash({
    message: event.message,
    stack: event.error ? event.error.stack : ''
  });
});

window.addEventListener('unhandledrejection', (event) => {
  window.oslo.logTelemetryCrash({
    message: String(event.reason),
    stack: event.reason ? event.reason.stack : ''
  });
});

// --- Update Modal & Check updates logic ---
const OFFICIAL_DOWNLOAD_URL = 'https://www.browser.osloteam.net/download';
const updateModal = document.getElementById('update-modal');
const telemetryLogModal = document.getElementById('telemetry-log-modal');
const getUpdateText = (key, fallback) => translations[state.currentLang]?.[key] || fallback;

function setUpdateStatusMessage(message, { autoHide = false } = {}) {
  const statusMsg = document.getElementById('update-status-message');
  if (!statusMsg) return;
  statusMsg.textContent = message;
  statusMsg.style.display = 'block';
  if (autoHide) {
    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 3000);
  }
}

function hideUpdateStatusMessage() {
  const statusMsg = document.getElementById('update-status-message');
  if (statusMsg) statusMsg.style.display = 'none';
}

function isUpdateNetworkError(infoOrError) {
  const code = String(infoOrError?.errorCode || infoOrError?.code || '').toLowerCase();
  const message = String(infoOrError?.error || infoOrError?.message || '').toLowerCase();
  return infoOrError?.offline === true ||
    code === 'network_offline' ||
    message.includes('err_internet_disconnected') ||
    message.includes('err_name_not_resolved') ||
    message.includes('err_network_changed') ||
    message.includes('err_timed_out') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('internet') ||
    message.includes('dns');
}

function getUpdateCheckErrorText(infoOrError) {
  return isUpdateNetworkError(infoOrError)
    ? getUpdateText('update-network-error', 'Internet connection could not be established. Please check your connection and try again.')
    : getUpdateText('update-check-error', 'Update information could not be loaded.');
}

function hasUpdateCheckError(info) {
  return !!(info?.offline || info?.errorCode || info?.error);
}

function resetUpdateModalUi() {
  const footer = updateModal?.querySelector('.modal-footer');
  const confirmBtn = document.getElementById('btn-confirm-update');
  const cancelBtn = document.getElementById('btn-cancel-update');
  const closeBtn = document.getElementById('close-update-modal');
  const progressContainer = document.getElementById('update-progress-container');
  const installWarning = document.getElementById('update-install-warning');
  const progressBar = document.getElementById('update-progress-bar');
  const progressPercent = document.getElementById('update-progress-percent');
  const currentVersionLabel = document.querySelector('.version-chip.current .version-label');
  const latestVersionLabel = document.querySelector('.version-chip.latest .version-label');
  const latestVersionChip = document.querySelector('.version-chip.latest');
  const versionArrow = document.querySelector('.version-arrow');

  if (footer) footer.style.display = 'flex';
  updateModal?.classList.remove('release-notes-only');
  if (confirmBtn) confirmBtn.style.display = '';
  if (cancelBtn) {
    cancelBtn.style.width = '';
    cancelBtn.textContent = getUpdateText('modal-cancel', 'İptal');
  }
  if (closeBtn) closeBtn.style.display = 'block';
  if (progressContainer) progressContainer.style.display = 'none';
  if (installWarning) installWarning.style.display = 'none';
  if (progressBar) progressBar.style.width = '0%';
  if (progressPercent) progressPercent.textContent = '0%';
  if (currentVersionLabel) currentVersionLabel.textContent = getUpdateText('current-version-label', 'Mevcut');
  if (latestVersionLabel) latestVersionLabel.textContent = getUpdateText('latest-version-label', 'Yeni');
  if (latestVersionChip) latestVersionChip.style.display = '';
  if (versionArrow) versionArrow.style.display = '';
}

function showUpdateModal(info, { notesOnly = false } = {}) {
  const currentVersion = document.getElementById('update-current-version');
  const modalVersion = document.getElementById('update-modal-version');
  const modalNotes = document.getElementById('update-modal-notes');
  const modalTitle = document.getElementById('update-modal-title');
  const confirmBtn = document.getElementById('btn-confirm-update');
  const cancelBtn = document.getElementById('btn-cancel-update');
  const latestVersionChip = document.querySelector('.version-chip.latest');
  const versionArrow = document.querySelector('.version-arrow');
  const releaseNotes = (info.releaseNotes || '').trim();

  resetUpdateModalUi();
  updateModal?.classList.toggle('release-notes-only', !!notesOnly);
  if (latestVersionChip) latestVersionChip.style.display = notesOnly ? 'none' : '';
  if (versionArrow) versionArrow.style.display = notesOnly ? 'none' : '';

  if (currentVersion) currentVersion.textContent = `v${info.currentVersion || '1.0.0-beta.4'}`;
  if (modalVersion) modalVersion.textContent = `v${info.latestVersion || info.currentVersion || '1.0.0-beta.4'}`;
  if (modalNotes) {
    modalNotes.innerHTML = releaseNotes
      ? parseMarkdown(releaseNotes)
      : `<p>${escapeHtml(getUpdateText('release-notes-empty', 'Bu sürüm için güncelleme notu bulunmuyor.'))}</p>`;
  }

  if (modalTitle) {
    modalTitle.textContent = notesOnly
      ? getUpdateText('release-notes-title', 'Güncelleme Notları')
      : getUpdateText('update-available-title', 'Yeni Sürüm Mevcut!');
  }

  if (confirmBtn) confirmBtn.style.display = notesOnly ? 'none' : '';
  if (cancelBtn) {
    cancelBtn.style.width = notesOnly ? '100%' : '';
    cancelBtn.textContent = notesOnly ? getUpdateText('modal-close', 'Kapat') : getUpdateText('modal-cancel', 'İptal');
  }

  updateModal?.classList.add('open');
  sendBounds();

  if (updateModal) {
    updateModal.dataset.downloadUrl = notesOnly ? '' : (info.downloadUrl || '');
    updateModal.dataset.checksum = notesOnly ? '' : (info.checksum || info.sha256 || info.expectedSha256 || '');
    updateModal.dataset.checksumAlgorithm = notesOnly ? '' : (info.checksumAlgorithm || ((info.sha256 || info.expectedSha256) ? 'sha256' : ''));
    updateModal.dataset.sha256 = notesOnly ? '' : (info.sha256 || '');
  }
}

document.getElementById('btn-check-updates')?.addEventListener('click', () => {
  setUpdateStatusMessage(getUpdateText('update-checking', 'Checking for updates...'));

  window.oslo.checkForUpdates().then(info => {
    if (hasUpdateCheckError(info)) {
      setUpdateStatusMessage(getUpdateCheckErrorText(info), { autoHide: true });
      return;
    }

    if (info.updateAvailable) {
      hideUpdateStatusMessage();
      const currentVersion = document.getElementById('update-current-version');
      const modalVersion = document.getElementById('update-modal-version');
      const modalNotes = document.getElementById('update-modal-notes');

      if (currentVersion) currentVersion.textContent = `v${info.currentVersion || '1.0.0-beta.4'}`;
      if (modalVersion) modalVersion.textContent = `v${info.latestVersion}`;
      if (modalNotes) modalNotes.innerHTML = parseMarkdown(info.releaseNotes);

      resetUpdateModalUi();
      const modalTitle = document.getElementById('update-modal-title');
      if (modalTitle) modalTitle.textContent = getUpdateText('update-available-title', 'Yeni Sürüm Mevcut!');

      updateModal?.classList.add('open');
      sendBounds();

      // Store download URL in a data attribute
      updateModal.dataset.downloadUrl = info.downloadUrl;
      updateModal.dataset.checksum = info.checksum || info.sha256 || info.expectedSha256 || '';
      updateModal.dataset.checksumAlgorithm = info.checksumAlgorithm || ((info.sha256 || info.expectedSha256) ? 'sha256' : '');
      updateModal.dataset.sha256 = info.sha256 || '';
    } else {
      setUpdateStatusMessage(getUpdateText('update-current-status', 'Your browser is up to date.'), { autoHide: true });
    }
  }).catch(err => {
    console.error('Update check failed:', err);
    setUpdateStatusMessage(getUpdateCheckErrorText(err), { autoHide: true });
  });
});

document.getElementById('btn-read-release-notes')?.addEventListener('click', () => {
  setUpdateStatusMessage(getUpdateText('release-notes-loading', 'Güncelleme notları alınıyor...'));

  const loadReleaseNotes = typeof window.oslo.getReleaseNotes === 'function'
    ? window.oslo.getReleaseNotes()
    : window.oslo.checkForUpdates();

  loadReleaseNotes.then(info => {
    hideUpdateStatusMessage();
    if (hasUpdateCheckError(info)) {
      setUpdateStatusMessage(getUpdateCheckErrorText(info), { autoHide: true });
      return;
    }
    showUpdateModal(info, { notesOnly: true });
  }).catch(err => {
    console.error('Release notes fetch failed:', err);
    setUpdateStatusMessage(getUpdateCheckErrorText(err), { autoHide: true });
  });
});

// Close update modal
const closeUpdateModalFunc = () => {
  updateModal?.classList.remove('open');
  sendBounds();
};
document.getElementById('close-update-modal')?.addEventListener('click', closeUpdateModalFunc);
document.getElementById('btn-cancel-update')?.addEventListener('click', closeUpdateModalFunc);

document.getElementById('btn-confirm-update')?.addEventListener('click', () => {
  const url = updateModal?.dataset.downloadUrl;
  const checksum = updateModal?.dataset.checksum || updateModal?.dataset.sha256 || '';
  const checksumAlgorithm = updateModal?.dataset.checksumAlgorithm || (checksum.length === 128 ? 'sha512' : 'sha256');
  const version = (document.getElementById('update-modal-version')?.textContent || '1.0.0-beta.4').replace(/^v/, '');

  if (!url) {
    window.oslo.openExternalLink(OFFICIAL_DOWNLOAD_URL);
    closeUpdateModalFunc();
    return;
  }

  if (!checksum) {
    const statusMsg = document.getElementById('update-status-message');
    if (statusMsg) {
      statusMsg.textContent = state.currentLang === 'tr'
        ? 'Güncelleme doğrulama bilgisi eksik. Otomatik kurulum durduruldu.'
        : (state.currentLang === 'fr'
          ? 'Les informations de vérification sont manquantes. Installation automatique arrêtée.'
          : 'Update verification data is missing. Automatic installation stopped.');
      statusMsg.style.display = 'block';
    }
    closeUpdateModalFunc();
    return;
  }

  // Hide footer buttons & close button to prevent closing during download
  const footer = updateModal.querySelector('.modal-footer');
  if (footer) footer.style.display = 'none';
  const closeBtn = document.getElementById('close-update-modal');
  if (closeBtn) closeBtn.style.display = 'none';

  // Reset and show progress bar
  const progressContainer = document.getElementById('update-progress-container');
  const progressBar = document.getElementById('update-progress-bar');
  const progressPercent = document.getElementById('update-progress-percent');
  const progressStatus = document.getElementById('update-progress-status');
  const installWarning = document.getElementById('update-install-warning');

  if (progressBar) progressBar.style.width = '0%';
  if (progressPercent) progressPercent.textContent = '0%';
  if (progressStatus) {
    progressStatus.textContent = getUpdateText('update-downloading', 'Güncelleme indiriliyor...');
  }
  if (installWarning) installWarning.style.display = 'block';
  if (progressContainer) progressContainer.style.display = 'flex';

  // Listen to progress
  const removeListener = window.oslo.onUpdateDownloadProgress((data) => {
    if (progressBar) progressBar.style.width = `${data.progress}%`;
    if (progressPercent) progressPercent.textContent = `${data.progress}%`;
  });

  // Start download
  window.oslo.downloadUpdate(url, version, checksum, checksumAlgorithm).then(() => {
    removeListener();

    if (progressBar) progressBar.style.width = '100%';
    if (progressPercent) progressPercent.textContent = '100%';
    if (progressStatus) {
      progressStatus.textContent = getUpdateText('update-starting-install', 'Kurulum başlatılıyor...');
    }
  }).catch(err => {
    console.error('Download failed:', err);
    removeListener();

    // Show error status
    if (progressStatus) {
      const baseMessage = state.currentLang === 'tr' ? 'İndirme hatası!' :
        (state.currentLang === 'fr' ? 'Erreur de téléchargement!' : 'Download failed!');
      progressStatus.textContent = err?.message ? `${baseMessage} ${err.message}` : baseMessage;
    }

    // Restore footer buttons & close button so they can retry or cancel
    setTimeout(() => {
      if (footer) footer.style.display = 'flex';
      if (closeBtn) closeBtn.style.display = 'block';
      if (progressContainer) progressContainer.style.display = 'none';
      if (installWarning) installWarning.style.display = 'none';
    }, 3000);
  });
});

// Auto check for updates on startup
function autoCheckForUpdates() {
  window.oslo.checkForUpdates().then(info => {
    if (info && info.updateAvailable) {
      const currentVersion = document.getElementById('update-current-version');
      const modalVersion = document.getElementById('update-modal-version');
      const modalNotes = document.getElementById('update-modal-notes');

      if (currentVersion) currentVersion.textContent = `v${info.currentVersion || '1.0.0-beta.4'}`;
      if (modalVersion) modalVersion.textContent = `v${info.latestVersion}`;
      if (modalNotes) modalNotes.innerHTML = parseMarkdown(info.releaseNotes);

      resetUpdateModalUi();
      const modalTitle = document.getElementById('update-modal-title');
      if (modalTitle) modalTitle.textContent = getUpdateText('update-available-title', 'Yeni Sürüm Mevcut!');

      updateModal?.classList.add('open');
      sendBounds();

      // Store download URL in a data attribute
      if (updateModal) {
        updateModal.dataset.downloadUrl = info.downloadUrl;
        updateModal.dataset.checksum = info.checksum || info.sha256 || info.expectedSha256 || '';
        updateModal.dataset.checksumAlgorithm = info.checksumAlgorithm || ((info.sha256 || info.expectedSha256) ? 'sha256' : '');
        updateModal.dataset.sha256 = info.sha256 || '';
      }
    }
  }).catch(err => {
    console.error('Auto update check failed:', err);
  });
}

// Check on startup after a delay to ensure smooth initial page load
setTimeout(autoCheckForUpdates, 1500);

// --- Telemetry Diagnostics Modal ---
const TELEMETRY_REPORT_ISSUE_URL = 'https://github.com/OSLO-Team/oslo-browser/issues/new';
const TELEMETRY_REPORT_URL_LIMIT = 3900;
const TELEMETRY_REPORT_CLIPBOARD_LIMIT = 30000;

function getTelemetryArray(logs, key) {
  return Array.isArray(logs?.[key]) ? logs[key] : [];
}

function truncateTelemetryText(text, maxLength) {
  const value = String(text || '');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 120))}\n\n[Report truncated. Full local log can be copied again from OSLO telemetry diagnostics.]`;
}

function buildTelemetryReport(logs, systemInfo = {}, options = {}) {
  const maxEvents = Number.isFinite(options.maxEvents) ? options.maxEvents : 100;
  const maxCrashes = Number.isFinite(options.maxCrashes) ? options.maxCrashes : 50;
  const detailLimit = Number.isFinite(options.detailLimit) ? options.detailLimit : TELEMETRY_REPORT_CLIPBOARD_LIMIT;
  const allEvents = getTelemetryArray(logs, 'events');
  const allCrashes = getTelemetryArray(logs, 'crashes');
  const payload = {
    generatedAt: new Date().toISOString(),
    appVersion: systemInfo?.appVersion || '1.0.0-beta.4',
    electron: systemInfo?.electron || '',
    chrome: systemInfo?.chrome || '',
    platform: navigator.platform || '',
    language: state.currentLang || '',
    eventCount: allEvents.length,
    crashCount: allCrashes.length,
    performanceSnapshot: logs?.performanceSnapshot || systemInfo?.performanceSnapshot || null,
    events: allEvents.slice(-maxEvents),
    crashes: allCrashes.slice(-maxCrashes)
  };

  return truncateTelemetryText(JSON.stringify(payload, null, 2), detailLimit);
}

function buildTelemetryIssueBody(logs, systemInfo = {}, copiedToClipboard = false) {
  const allEvents = getTelemetryArray(logs, 'events');
  const allCrashes = getTelemetryArray(logs, 'crashes');
  const compactReport = buildTelemetryReport(logs, systemInfo, {
    maxEvents: 8,
    maxCrashes: 3,
    detailLimit: 1800
  });

  return [
    '## OSLO Browser Telemetry Report',
    '',
    `Version: ${systemInfo?.appVersion || '1.0.0-beta.4'}`,
    `Generated at: ${new Date().toISOString()}`,
    `Events: ${allEvents.length}`,
    `Crashes/errors: ${allCrashes.length}`,
    '',
    copiedToClipboard
      ? 'A full sanitized telemetry report was copied to the clipboard before this issue opened.'
      : 'Clipboard copy was unavailable, so only this compact sanitized report is attached.',
    '',
    '```json',
    compactReport,
    '```'
  ].join('\n');
}

function createTelemetryIssueUrl(title, body) {
  try {
    const url = new URL(TELEMETRY_REPORT_ISSUE_URL);
    let issueBody = body;

    while (issueBody.length > 700) {
      url.searchParams.set('title', title);
      url.searchParams.set('body', issueBody);
      const candidate = url.toString();
      if (candidate.length <= TELEMETRY_REPORT_URL_LIMIT) return candidate;
      issueBody = `${issueBody.slice(0, Math.max(700, issueBody.length - 500))}\n\n[Report body shortened to fit the GitHub issue URL. Full report may be on the clipboard.]`;
    }

    url.searchParams.set('title', title);
    url.searchParams.set('body', issueBody);
    return url.toString();
  } catch (error) {
    console.error('Failed to build telemetry issue URL:', error);
    return TELEMETRY_REPORT_ISSUE_URL;
  }
}

function renderTelemetryLogs() {
  window.oslo.getTelemetryLogs().then(logs => {
    const eventsList = document.getElementById('telemetry-events-list');
    const crashesList = document.getElementById('telemetry-crashes-list');

    const formatTime = (ts) => {
      const d = new Date(ts);
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const normalizeTelemetryEvent = (ev) => {
      const action = String(ev?.action || ev?.event || 'unknown-event');
      const data = ev?.data !== undefined ? ev.data : (ev?.details !== undefined ? ev.details : {});
      const timestamp = Number.isFinite(Number(ev?.timestamp)) ? Number(ev.timestamp) : Date.now();
      return { action, data, timestamp };
    };

    // Render Events List
    if (eventsList) {
      eventsList.innerHTML = '';
      if (logs.events && logs.events.length > 0) {
        const recentEvents = [...logs.events].reverse();
        recentEvents.forEach(rawEvent => {
          const ev = normalizeTelemetryEvent(rawEvent);
          const item = document.createElement('div');
          item.className = 'telemetry-item';

          // Select SVG category icon
          let svgContent = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
          if (ev.action.includes('bookmark')) {
            svgContent = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
          } else if (ev.action.includes('tab')) {
            svgContent = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>`;
          } else if (ev.action.includes('navigate') || ev.action.includes('page')) {
            svgContent = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
          } else if (ev.action.includes('space')) {
            svgContent = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>`;
          }

          item.innerHTML = `
            <div class="telemetry-item-header">
              <div class="telemetry-icon-wrapper">${svgContent}</div>
              <div class="telemetry-info">
                <span class="telemetry-action">${escapeHtml(ev.action)}</span>
                <span class="telemetry-timestamp">${escapeHtml(formatTime(ev.timestamp))}</span>
              </div>
              <div class="telemetry-chevron">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <div class="telemetry-details">
              <pre class="telemetry-details-content">${escapeHtml(JSON.stringify(ev.data, null, 2))}</pre>
            </div>
          `;

          item.addEventListener('click', (e) => {
            if (window.getSelection().toString() && e.target.closest('pre')) return;
            item.classList.toggle('open');
          });

          eventsList.appendChild(item);
        });
      } else {
        const noEventsMsg = translations[state.currentLang]['telemetry-no-events'] || 'Olay kaydı yok.';
        const eventsDesc = translations[state.currentLang]['telemetry-events-desc'] || 'Tarayıcıda gerçekleştirdiğiniz işlemlerin yerel günlüğü.';
        eventsList.innerHTML = `
          <div class="telemetry-empty-state">
            <svg class="telemetry-empty-icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            <div class="telemetry-empty-title">${noEventsMsg}</div>
            <div class="telemetry-empty-desc">${eventsDesc}</div>
          </div>
        `;
      }
    }

    // Render Crashes List
    if (crashesList) {
      crashesList.innerHTML = '';
      if (logs.crashes && logs.crashes.length > 0) {
        const recentCrashes = [...logs.crashes].reverse();
        recentCrashes.forEach(cr => {
          const item = document.createElement('div');
          item.className = 'telemetry-item crash-log';

          const warningSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;

          item.innerHTML = `
            <div class="telemetry-item-header">
              <div class="telemetry-icon-wrapper">${warningSvg}</div>
              <div class="telemetry-info">
                <span class="telemetry-action">${escapeHtml(cr.message)}</span>
                <span class="telemetry-timestamp">${escapeHtml(formatTime(cr.timestamp))}</span>
              </div>
              <span class="telemetry-badge">${escapeHtml(String(cr.process || '').toUpperCase())} PROC</span>
              <div class="telemetry-chevron">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <div class="telemetry-details">
              <pre class="telemetry-details-content">${escapeHtml(cr.stack || 'No stack trace available.')}</pre>
            </div>
          `;

          item.addEventListener('click', (e) => {
            if (window.getSelection().toString() && e.target.closest('pre')) return;
            item.classList.toggle('open');
          });

          crashesList.appendChild(item);
        });
      } else {
        const noCrashesMsg = translations[state.currentLang]['telemetry-no-crashes'] || 'Kilitlenme veya hata kaydı yok.';
        const crashesDesc = translations[state.currentLang]['telemetry-crashes-desc'] || 'Tarayıcıda oluşan kilitlenmeler ve çalışma zamanı hataları.';
        crashesList.innerHTML = `
          <div class="telemetry-empty-state">
            <svg class="telemetry-empty-icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <div class="telemetry-empty-title">${noCrashesMsg}</div>
            <div class="telemetry-empty-desc">${crashesDesc}</div>
          </div>
        `;
      }
    }
  });
}

document.getElementById('btn-show-telemetry')?.addEventListener('click', () => {
  renderTelemetryLogs();

  // Reset active tab to Events pane on show
  document.querySelectorAll('.telemetry-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('telemetry-tab-events')?.classList.add('active');
  document.querySelectorAll('.telemetry-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('telemetry-events-container')?.classList.add('active');

  telemetryLogModal?.classList.add('open');
  sendBounds();
});

const closeTelemetryModalFunc = () => {
  telemetryLogModal?.classList.remove('open');
  sendBounds();
};
document.getElementById('close-telemetry-modal')?.addEventListener('click', closeTelemetryModalFunc);
document.getElementById('btn-close-telemetry-diag')?.addEventListener('click', closeTelemetryModalFunc);

// Wire Telemetry Tab Switchers
document.querySelectorAll('.telemetry-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.telemetry-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tabName = btn.dataset.tab;
    document.querySelectorAll('.telemetry-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(`telemetry-${tabName}-container`)?.classList.add('active');
  });
});

// Wire Telemetry Copy Actions
document.getElementById('btn-copy-telemetry')?.addEventListener('click', () => {
  window.oslo.getTelemetryLogs().then(logs => {
    const formattedText = JSON.stringify(logs, null, 2);
    navigator.clipboard.writeText(formattedText).then(() => {
      const copyBtn = document.getElementById('btn-copy-telemetry');
      const copySpan = copyBtn?.querySelector('span');
      const originalText = translations[state.currentLang]['telemetry-copy'] || 'Kopyala';
      const copiedText = translations[state.currentLang]['telemetry-copied'] || 'Kopyalandı!';

      if (copySpan) {
        copySpan.textContent = copiedText;
        setTimeout(() => {
          copySpan.textContent = originalText;
        }, 1500);
      }
    });
  });
});

document.getElementById('btn-report-telemetry')?.addEventListener('click', async () => {
  const reportBtn = document.getElementById('btn-report-telemetry');
  const reportSpan = reportBtn?.querySelector('span');
  const originalText = translations[state.currentLang]['telemetry-report-github'] || 'GitHub\'a Bildir';
  const readyText = translations[state.currentLang]['telemetry-report-ready'] || 'Rapor Hazır';
  const failedText = translations[state.currentLang]['telemetry-report-failed'] || 'Açılamadı';

  if (reportBtn) reportBtn.disabled = true;

  try {
    const [logs, systemInfo] = await Promise.all([
      window.oslo.getTelemetryLogs(),
      typeof window.oslo.getSystemInfo === 'function' ? window.oslo.getSystemInfo() : Promise.resolve({})
    ]);

    let copiedToClipboard = false;
    const fullReport = buildTelemetryReport(logs, systemInfo, {
      maxEvents: 100,
      maxCrashes: 50,
      detailLimit: TELEMETRY_REPORT_CLIPBOARD_LIMIT
    });

    try {
      await navigator.clipboard.writeText(fullReport);
      copiedToClipboard = true;
    } catch (clipboardError) {
      console.warn('Telemetry report clipboard copy failed:', clipboardError);
    }

    const title = `[Telemetry] OSLO Browser report - ${new Date().toISOString().slice(0, 10)}`;
    const body = buildTelemetryIssueBody(logs, systemInfo, copiedToClipboard);
    window.oslo.openExternalLink(createTelemetryIssueUrl(title, body));
    window.oslo.logTelemetryEvent?.('telemetry_report_github_opened', { copiedToClipboard });

    if (reportSpan) {
      reportSpan.textContent = readyText;
      setTimeout(() => {
        reportSpan.textContent = originalText;
      }, 1500);
    }
  } catch (error) {
    console.error('Telemetry report action failed:', error);
    if (reportSpan) {
      reportSpan.textContent = failedText;
      setTimeout(() => {
        reportSpan.textContent = originalText;
      }, 1500);
    }
  } finally {
    if (reportBtn) {
      setTimeout(() => {
        reportBtn.disabled = false;
      }, 300);
    }
  }
});

// Wire Telemetry Clear Actions
document.getElementById('btn-clear-telemetry')?.addEventListener('click', () => {
  window.oslo.clearTelemetryLogs().then(() => {
    renderTelemetryLogs();

    const clearBtn = document.getElementById('btn-clear-telemetry');
    const clearSpan = clearBtn?.querySelector('span');
    const originalText = translations[state.currentLang]['telemetry-clear'] || 'Temizle';
    const clearedText = translations[state.currentLang]['telemetry-cleared'] || 'Temizlendi!';

    if (clearSpan) {
      clearSpan.textContent = clearedText;
      setTimeout(() => {
        clearSpan.textContent = originalText;
      }, 1500);
    }
  });
});

// --- Permissions Manager Modal Logic ---
const permissionsManagerModal = document.getElementById('permissions-manager-modal');
const permissionsList = document.getElementById('permissions-list');

function getPermissionIcon(permission) {
  switch (permission) {
    case 'notifications':
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5 6.7-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`;
    case 'camera':
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="3.2"/><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>`;
    case 'microphone':
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`;
    case 'location':
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
    case 'clipboard':
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>`;
    case 'autoplay':
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }
}

function renderPermissionsList() {
  if (!permissionsList) return;
  permissionsList.innerHTML = '';

  window.oslo.getPermissions().then(perms => {
    const keys = Object.keys(perms);
    if (keys.length === 0) {
      const emptyMsg = translations[state.currentLang]['no-permissions'] || 'Kayıtlı izin kararı bulunmuyor.';
      permissionsList.innerHTML = `<div class="permissions-empty">${emptyMsg}</div>`;
      return;
    }

    keys.forEach(key => {
      // key format is usually domain:permission (e.g. "google.com:notifications")
      const [domain, permission] = key.split(':');
      const decision = perms[key];

      const row = document.createElement('div');
      row.className = 'permission-row';

      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'permission-icon-wrapper';
      iconWrapper.innerHTML = getPermissionIcon(permission);

      const info = document.createElement('div');
      info.className = 'permission-info-container';

      const permTitle = document.createElement('div');
      permTitle.className = 'permission-name';
      permTitle.textContent = translations[state.currentLang][`permission-${permission}`] || (permission.charAt(0).toUpperCase() + permission.slice(1));

      const domainName = document.createElement('div');
      domainName.className = 'permission-domain-name';
      domainName.textContent = domain;
      domainName.title = domain;

      info.appendChild(permTitle);
      info.appendChild(domainName);

      const rightSide = document.createElement('div');
      rightSide.className = 'permission-right-side';

      const badge = document.createElement('span');
      badge.className = `permission-status-badge ${decision ? 'allowed' : 'blocked'}`;
      badge.textContent = decision
        ? (translations[state.currentLang]['permission-allowed'] || 'İzin Verildi')
        : (translations[state.currentLang]['permission-blocked'] || 'Engellendi');

      const resetBtn = document.createElement('button');
      resetBtn.className = 'permission-reset-btn';
      resetBtn.title = translations[state.currentLang]['reset-permission'] || 'Sıfırla';
      resetBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      `;
      resetBtn.addEventListener('click', () => {
        window.oslo.deletePermission(key).then(() => {
          renderPermissionsList();
        });
      });

      rightSide.appendChild(badge);
      rightSide.appendChild(resetBtn);

      row.appendChild(iconWrapper);
      row.appendChild(info);
      row.appendChild(rightSide);

      permissionsList.appendChild(row);
    });
  });
}

document.getElementById('settings-manage-permissions')?.addEventListener('click', () => {
  renderPermissionsList();
  openModalWithContentPreview(permissionsManagerModal);
});

const closePermissionsModalFunc = () => {
  closeModalWithContentPreview(permissionsManagerModal);
};

document.getElementById('close-permissions-modal')?.addEventListener('click', closePermissionsModalFunc);
document.getElementById('btn-close-permissions-modal')?.addEventListener('click', closePermissionsModalFunc);

if (permissionsManagerModal) {
  permissionsManagerModal.addEventListener('click', (e) => {
    if (e.target === permissionsManagerModal) {
      closePermissionsModalFunc();
    }
  });
}

// --- Site Security Info Modal (Chrome-like) Logic ---
const securityInfoModal = document.getElementById('security-info-modal');
const securityIndicator = document.getElementById('security-indicator');
const securityInfoDomain = document.getElementById('security-info-domain');
const securityInfoConnIcon = document.getElementById('security-info-conn-icon');
const securityInfoConnTitle = document.getElementById('security-info-conn-title');
const securityInfoConnDesc = document.getElementById('security-info-conn-desc');
const securityInfoPermissionsSection = document.getElementById('security-info-permissions-section');
const securityInfoOrigin = document.getElementById('security-info-origin');
const securityInfoBlockedCount = document.getElementById('security-info-blocked-count');
const securityInfoCookieCount = document.getElementById('security-info-cookie-count');
const securityInfoPermissionCount = document.getElementById('security-info-permission-count');
const securityInfoHttpsStatus = document.getElementById('security-info-https-status');
const securityInfoCertificateStatus = document.getElementById('security-info-certificate-status');
const securityInfoCookieSummary = document.getElementById('security-info-cookie-summary');
const securityInfoCookiePolicy = document.getElementById('security-info-cookie-policy');
const securityInfoPermissionControls = document.getElementById('security-info-permission-controls');

const SITE_SECURITY_PERMISSION_TYPES = ['notifications', 'camera', 'microphone', 'location', 'clipboard'];

function getPermissionDecisionText(value) {
  if (value === 'allow') return getUiText('permission-allow-default', 'İzin ver');
  if (value === 'block') return getUiText('permission-block-default', 'Engelle');
  return getUiText('permission-default', 'Varsayılan (Sor)');
}

function getCookiePolicyText(value) {
  if (value === 'allow') return getUiText('cookie-policy-allow', 'Tüm çerezlere izin ver');
  if (value === 'block-all') return getUiText('cookie-policy-block-all', 'Tüm çerezleri engelle');
  return getUiText('cookie-policy-third-party', 'Üçüncü taraf çerezleri engelle');
}

function getCertificateStatusText(status) {
  if (status === 'valid') return getUiText('site-security-certificate-valid', 'Geçerli');
  if (status === 'exception') return getUiText('site-security-certificate-exception', 'İstisna ile güvenildi');
  if (status === 'not-secure') return getUiText('site-security-certificate-none', 'Güvenli sertifika yok');
  return getUiText('site-security-local-page', 'Yerel sayfa');
}

function renderSiteSecurityIcon(summary) {
  if (!securityInfoConnIcon) return;
  const fill = summary.isSecure ? '#10b981' : (summary.isWeb ? '#ef4444' : 'var(--text-muted)');
  const path = summary.isSecure
    ? 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'
    : 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z';
  securityInfoConnIcon.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="${fill}"><path d="${path}"/></svg>`;
}

function renderSitePermissionControls(hostname, permissions = {}, isWeb = false) {
  if (!securityInfoPermissionControls) return;
  if (!isWeb) {
    securityInfoPermissionControls.innerHTML = `<div class="site-security-empty">${escapeHtml(getUiText('site-security-no-site-permissions', 'Yerel sayfalar için site izni yok.'))}</div>`;
    return;
  }

  securityInfoPermissionControls.innerHTML = SITE_SECURITY_PERMISSION_TYPES.map(permission => {
    const label = getUiText(`permission-${permission}`, permission);
    const value = permissions[permission] || 'default';
    return `
      <label class="site-security-permission-row">
        <span>${escapeHtml(label)}</span>
        <select data-site-permission="${escapeHtml(permission)}">
          <option value="default" ${value === 'default' ? 'selected' : ''}>${escapeHtml(getPermissionDecisionText('default'))}</option>
          <option value="allow" ${value === 'allow' ? 'selected' : ''}>${escapeHtml(getPermissionDecisionText('allow'))}</option>
          <option value="block" ${value === 'block' ? 'selected' : ''}>${escapeHtml(getPermissionDecisionText('block'))}</option>
        </select>
      </label>
    `;
  }).join('');

  securityInfoPermissionControls.querySelectorAll('select[data-site-permission]').forEach(select => {
    select.addEventListener('change', async () => {
      const permission = select.getAttribute('data-site-permission');
      const key = `${hostname}:${permission}`;
      if (select.value === 'default') {
        await window.oslo.deletePermission(key);
      } else {
        await window.oslo.setPermission(key, select.value === 'allow');
      }
      if (permissionsManagerModal?.classList.contains('open')) {
        renderPermissionsList();
      }
      showSecurityInfoModal();
    });
  });
}

async function showSecurityInfoModal() {
  if (!securityInfoModal) return;

  const activeTab = state.tabs[state.activeTabId];
  if (!activeTab || !activeTab.url) return;

  let summary = null;
  try {
    summary = await window.oslo.getSiteSecuritySummary(activeTab.id, activeTab.url);
  } catch (error) {
    console.error('Failed to load site security summary:', error);
  }
  if (!summary) return;

  const hostname = summary.hostname || '';
  const displayName = summary.isWeb ? hostname : getUiText('connection-local', 'Yerel Sayfa');
  if (securityInfoDomain) securityInfoDomain.textContent = displayName;
  if (securityInfoOrigin) securityInfoOrigin.textContent = summary.url || '';
  if (securityInfoPermissionsSection) securityInfoPermissionsSection.style.display = summary.isWeb ? 'flex' : 'flex';
  if (securityInfoBlockedCount) securityInfoBlockedCount.textContent = String(summary.protection?.blockedCount || 0);
  if (securityInfoCookieCount) securityInfoCookieCount.textContent = String(summary.cookies?.total || 0);
  const customPermissionCount = Object.values(summary.permissions || {}).filter(value => value !== 'default').length;
  if (securityInfoPermissionCount) securityInfoPermissionCount.textContent = String(customPermissionCount);
  if (securityInfoHttpsStatus) {
    securityInfoHttpsStatus.textContent = summary.isSecure
      ? getUiText('site-security-https-enabled', 'Etkin')
      : (summary.isWeb ? getUiText('site-security-https-disabled', 'Etkin değil') : getUiText('site-security-local-page', 'Yerel sayfa'));
    securityInfoHttpsStatus.className = summary.isSecure ? 'ok' : (summary.isWeb ? 'danger' : '');
  }
  if (securityInfoCertificateStatus) {
    securityInfoCertificateStatus.textContent = getCertificateStatusText(summary.certificate?.status);
    securityInfoCertificateStatus.className = summary.certificate?.status === 'valid' ? 'ok' : (summary.certificate?.status === 'not-secure' ? 'danger' : 'warn');
  }
  if (securityInfoCookieSummary) {
    const template = getUiText('site-security-cookie-summary-template', '{total} toplam, {secure} güvenli, {session} oturum');
    securityInfoCookieSummary.textContent = template
      .replace('{total}', summary.cookies?.total || 0)
      .replace('{secure}', summary.cookies?.secure || 0)
      .replace('{session}', summary.cookies?.session || 0);
  }
  if (securityInfoCookiePolicy) securityInfoCookiePolicy.textContent = getCookiePolicyText(summary.protection?.cookiePolicy);

  renderSiteSecurityIcon(summary);
  if (securityInfoConnTitle) {
    securityInfoConnTitle.textContent = summary.isSecure
      ? getUiText('connection-secure', 'Güvenli Bağlantı (HTTPS)')
      : (summary.isWeb ? getUiText('connection-insecure', 'Güvenli Olmayan Bağlantı (HTTP)') : getUiText('connection-local', 'Yerel Sayfa'));
  }
  if (securityInfoConnDesc) {
    securityInfoConnDesc.textContent = summary.isSecure
      ? getUiText('security-info-secure-desc', '')
      : (summary.isWeb ? getUiText('security-info-insecure-desc', '') : getUiText('security-info-local-desc', ''));
  }

  renderSitePermissionControls(hostname, summary.permissions || {}, summary.isWeb);

  openModalWithContentPreview(securityInfoModal);
}

const closeSecurityInfoModalFunc = () => {
  closeModalWithContentPreview(securityInfoModal);
};

// Bind security indicator click
securityIndicator?.addEventListener('click', showSecurityInfoModal);

// Bind close button event listeners
document.getElementById('close-security-info-modal')?.addEventListener('click', closeSecurityInfoModalFunc);
document.getElementById('btn-close-security-info-modal')?.addEventListener('click', closeSecurityInfoModalFunc);

// Close on outside click
if (securityInfoModal) {
  securityInfoModal.addEventListener('click', (e) => {
    if (e.target === securityInfoModal) {
      closeSecurityInfoModalFunc();
    }
  });
}

// Bind manage permissions shortcut button
document.getElementById('btn-manage-permissions-shortcut')?.addEventListener('click', () => {
  closeSecurityInfoModalFunc();
  // Open permissions manager modal
  renderPermissionsList();
  openModalWithContentPreview(permissionsManagerModal);
});

// --- Space Modal Prompt Implementation ---
let spaceModalCallback = null;

function showSpaceModal(title, label, defaultValue, callback) {
  const modal = document.getElementById('space-modal');
  const titleEl = document.getElementById('space-modal-title');
  const labelEl = document.getElementById('space-modal-label');
  const inputEl = document.getElementById('space-modal-input');

  if (modal && titleEl && labelEl && inputEl) {
    titleEl.textContent = title;
    labelEl.textContent = label;
    inputEl.value = defaultValue || '';
    spaceModalCallback = callback;

    // Reset selections on show
    selectedAddEmoji = '🌐';
    selectedAddColor = presetColors[0];
    initWorkspaceCustomizationGrids();

    openModalWithContentPreview(modal).then(() => setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 100));
  }
}

const spaceModal = document.getElementById('space-modal');
const spaceInput = document.getElementById('space-modal-input');

const closeSpaceModalFunc = () => {
  spaceModalCallback = null;
  closeModalWithContentPreview(spaceModal);
};

document.getElementById('close-space-modal')?.addEventListener('click', closeSpaceModalFunc);
document.getElementById('btn-cancel-space-modal')?.addEventListener('click', closeSpaceModalFunc);

const confirmSpaceModalFunc = () => {
  const val = spaceInput?.value.trim();
  if (spaceModalCallback) {
    spaceModalCallback({
      name: val,
      emoji: selectedAddEmoji,
      color: selectedAddColor.hex
    });
  }
  closeSpaceModalFunc();
};

document.getElementById('btn-confirm-space-modal')?.addEventListener('click', confirmSpaceModalFunc);

spaceInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    confirmSpaceModalFunc();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeSpaceModalFunc();
  }
});

if (spaceModal) {
  spaceModal.addEventListener('click', (e) => {
    if (e.target === spaceModal) {
      closeSpaceModalFunc();
    }
  });
}

// --- Space Options Modal Prompt Implementation ---
let spaceDeleteCallback = null;
let spaceRenameCallback = null;

function showSpaceDeleteModal(currentName, confirmText, deleteCallback, renameCallback) {
  const modal = document.getElementById('space-delete-modal');
  const confirmTextEl = document.getElementById('space-delete-confirm-text');
  const titleEl = document.getElementById('space-delete-modal-title');
  const renameInput = document.getElementById('space-delete-rename-input');

  if (modal && confirmTextEl) {
    if (titleEl) {
      titleEl.textContent = translations[state.currentLang]['space-options-title'] || 'Çalışma Alanı Seçenekleri';
    }
    confirmTextEl.textContent = confirmText;
    if (renameInput) {
      renameInput.value = currentName || '';
    }

    // Find space object to populate selections
    const spaceObj = state.spaces.find(s => (typeof s === 'string' ? s : s.name) === currentName);
    selectedEditEmoji = spaceObj && spaceObj.emoji ? spaceObj.emoji : '🌐';
    const currentHex = spaceObj && spaceObj.color ? (currentName === 'Genel' ? '#000000' : spaceObj.color) : (currentName === 'Genel' ? '#000000' : '#10b981');
    selectedEditColor = presetColors.find(c => c.hex === currentHex) || presetColors[0];

    initWorkspaceCustomizationGrids();

    spaceDeleteCallback = deleteCallback;
    spaceRenameCallback = renameCallback;
    openModalWithContentPreview(modal).then(() => setTimeout(() => {
      if (renameInput) {
        renameInput.focus();
        renameInput.select();
      }
    }, 100));
  }
}

const spaceDeleteModal = document.getElementById('space-delete-modal');
const spaceDeleteRenameInput = document.getElementById('space-delete-rename-input');

const closeSpaceDeleteModalFunc = () => {
  spaceDeleteCallback = null;
  spaceRenameCallback = null;
  closeModalWithContentPreview(spaceDeleteModal);
};

document.getElementById('close-space-delete-modal')?.addEventListener('click', closeSpaceDeleteModalFunc);
document.getElementById('btn-cancel-space-delete')?.addEventListener('click', closeSpaceDeleteModalFunc);

document.getElementById('btn-confirm-space-delete')?.addEventListener('click', () => {
  if (spaceDeleteCallback) {
    spaceDeleteCallback();
  }
  closeSpaceDeleteModalFunc();
});

const confirmRenameOptionsFunc = () => {
  const val = spaceDeleteRenameInput?.value.trim();
  if (spaceRenameCallback && val) {
    spaceRenameCallback({
      name: val,
      emoji: selectedEditEmoji,
      color: selectedEditColor.hex
    });
  }
  closeSpaceDeleteModalFunc();
};

document.getElementById('btn-save-space-options')?.addEventListener('click', confirmRenameOptionsFunc);

spaceDeleteRenameInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    confirmRenameOptionsFunc();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeSpaceDeleteModalFunc();
  }
});

if (spaceDeleteModal) {
  spaceDeleteModal.addEventListener('click', (e) => {
    if (e.target === spaceDeleteModal) {
      closeSpaceDeleteModalFunc();
    }
  });
}

// Global shortcut for Split Screen (Ctrl + \)
window.addEventListener('keydown', (e) => {
  const isControl = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
  if (isControl && e.shiftKey && e.key.toLowerCase() === 'r') {
    e.preventDefault();
    openReaderModeFromActiveTab();
    return;
  }
  if (isControl && e.key === '\\') {
    e.preventDefault();
    if (state.activeTabId) {
      window.oslo.toggleSplitScreen(state.activeTabId);
    }
  }
});
