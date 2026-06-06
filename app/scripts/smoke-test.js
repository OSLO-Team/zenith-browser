const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const checks = [];

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function pass(name) {
  checks.push({ name, ok: true });
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
}

function expect(name, condition, detail) {
  if (condition) pass(name);
  else fail(name, detail);
}

function extractTranslations(source) {
  const marker = 'export const translations =';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('translations export not found');
  const objectStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return vm.runInNewContext(`(${source.slice(objectStart, index + 1)})`);
    }
  }
  throw new Error('translations object could not be parsed');
}

function checkStartupFiles() {
  const indexHtml = read('src/renderer/index.html');
  expect('startup: renderer shell exists', exists('src/renderer/index.html'), 'renderer index is missing');
  expect('startup: newtab page exists', exists('src/newtab/newtab.html'), 'newtab html is missing');
  expect('startup: incognito newtab page exists', exists('src/incognito-newtab/incognito-newtab.html') && exists('src/incognito-newtab/incognito-newtab.css') && exists('src/incognito-newtab/incognito-newtab.js'), 'incognito newtab files are missing');
  expect('startup: renderer module is loaded', /<script\s+type="module"\s+src="renderer\.js"/.test(indexHtml), 'renderer.js module script missing');
}

function checkTabCreateFlow() {
  const main = read('src/main/main.js');
  const preload = read('src/preload.js');
  const renderer = read('src/renderer/renderer.js');
  expect('tabs: main create handler exists', main.includes("ipcMain.on('tab-create'"), 'main tab-create handler missing');
  expect('tabs: preload exposes createTab', /createTab:\s*\(/.test(preload), 'preload createTab bridge missing');
  expect('tabs: renderer calls createTab', renderer.includes('window.oslo.createTab'), 'renderer createTab call missing');
}

function checkSettingsSaveFlow() {
  const main = read('src/main/main.js');
  const preload = read('src/preload.js');
  const settings = read('src/renderer/js/settings.js');
  expect('settings: main set handler exists', main.includes("ipcMain.handle('settings-set'"), 'settings-set handler missing');
  expect('settings: preload exposes setSetting', /setSetting:\s*\(/.test(preload), 'preload setSetting bridge missing');
  expect('settings: renderer saves settings', settings.includes('window.oslo.setSetting'), 'settings renderer setSetting calls missing');
}

function checkAboutWebsiteLink() {
  const settings = read('src/renderer/js/settings.js');
  expect('about: visit website opens current OSLO site',
    settings.includes("window.oslo.createTab({ url: 'https://www.browser.osloteam.net' })"),
    'about website link does not point to www.browser.osloteam.net');
}

function checkAdvancedDownloads() {
  const main = read('src/main/main.js');
  const preload = read('src/preload.js');
  const panels = read('src/renderer/js/panels.js');
  expect('downloads: runtime speed tracking exists', main.includes('getDownloadRuntimeStats'), 'download runtime stats helper missing');
  expect('downloads: hash verification handler exists', main.includes("ipcMain.handle('download-verify-hash'"), 'download hash verification handler missing');
  expect('downloads: retry handler exists', main.includes("ipcMain.on('download-retry'"), 'download retry handler missing');
  expect('downloads: preload exposes retry and hash verification', preload.includes('retryDownload') && preload.includes('verifyDownloadHash'), 'download retry/hash preload bridge missing');
  expect('downloads: renderer shows security and hash controls', panels.includes('download-security-report') && panels.includes('download-hash-row'), 'download security/hash UI missing');
}

function checkTaskManagerFlow() {
  const main = read('src/main/main.js');
  const preload = read('src/preload.js');
  const indexHtml = read('src/renderer/index.html');
  const settings = read('src/renderer/js/settings.js');
  expect('task manager: main tab metrics handler exists', main.includes("ipcMain.handle('task-manager-tabs-get'"), 'task manager IPC handler missing');
  expect('task manager: preload exposes tab metrics', preload.includes('getTaskManagerTabs'), 'task manager preload bridge missing');
  expect('task manager: resource monitor tab exists', indexHtml.includes('settings-tab-ram') && indexHtml.includes('task-manager-list'), 'resource monitor settings tab missing');
  expect('task manager: live refresh status exists', indexHtml.includes('task-manager-refresh-state') && !indexHtml.includes('task-manager-countdown'), 'task manager live refresh status missing');
  expect('task manager: renderer refreshes metrics continuously when active', settings.includes('renderTaskManagerSection') && settings.includes('ensureTaskManagerLiveRefresh') && settings.includes('TASK_MANAGER_REALTIME_REFRESH_MS'), 'task manager live refresh renderer flow missing');
  expect('task manager: background refresh is throttled', settings.includes('TASK_MANAGER_BACKGROUND_REFRESH_MS') && settings.includes('visibilitychange'), 'task manager background throttle missing');
}

function checkSiteSecurityPanel() {
  const main = read('src/main/main.js');
  const preload = read('src/preload.js');
  const indexHtml = read('src/renderer/index.html');
  const renderer = read('src/renderer/renderer.js');
  expect('site security: summary handler exists', main.includes("ipcMain.handle('site-security-summary-get'"), 'site security summary handler missing');
  expect('site security: preload exposes summary API', preload.includes('getSiteSecuritySummary'), 'site security preload bridge missing');
  expect('site security: advanced panel fields exist', indexHtml.includes('security-info-blocked-count') && indexHtml.includes('security-info-permission-controls'), 'advanced site security panel fields missing');
  expect('site security: renderer manages quick permissions', renderer.includes('SITE_SECURITY_PERMISSION_TYPES') && renderer.includes('renderSitePermissionControls'), 'site quick permission renderer flow missing');
}

function checkPasswordHealthPanel() {
  const main = read('src/main/main.js');
  const indexHtml = read('src/renderer/index.html');
  const settings = read('src/renderer/js/settings.js');
  expect('password health: settings panel exists', indexHtml.includes('password-health-panel') && indexHtml.includes('password-health-score-value'), 'password health panel missing');
  expect('password health: audit returns score and recommendations', main.includes('securityScore') && main.includes('recommendations'), 'password audit health fields missing');
  expect('password health: renderer refreshes panel', settings.includes('refreshPasswordHealthPanel') && settings.includes('renderPasswordHealthPanel'), 'password health renderer flow missing');
  expect('password health: scan button is bound robustly', indexHtml.includes('settings-refresh-password-health') && settings.includes('bindPasswordHealthScanControls') && settings.includes('passwordHealthScanControlsBound'), 'password health scan binding missing');
  expect('password health: copy buttons show feedback', settings.includes('showPasswordCopyFeedback') && settings.includes('copyPasswordFieldValue'), 'saved password copy feedback missing');
}

function checkAutocompleteTopbarEdgeCase() {
  const main = read('src/main/main.js');
  const preload = read('src/preload.js');
  const renderer = read('src/renderer/renderer.js');
  const style = read('src/renderer/style.css');
  const newtab = read('src/newtab/newtab.js');
  const newtabCss = read('src/newtab/newtab.css');
  expect('autocomplete: address interaction state is managed', renderer.includes('setAddressBarInteractionActive') && renderer.includes('setAutocompleteVisibility'), 'autocomplete active state helpers missing');
  expect('autocomplete: suggestions render before history resolves', renderer.includes('renderForHistory([])') && renderer.includes('.catch(() =>'), 'autocomplete immediate fallback missing');
  expect('autocomplete: dropdown is remeasured through top bar transitions', renderer.includes('scheduleAutocompleteReposition') && renderer.includes('positionAutocompleteDropdown'), 'autocomplete transition-safe positioning missing');
  expect('autocomplete: dropdown is anchored to the address bar container', style.includes('.autocomplete-dropdown') && style.includes('position: absolute') && style.includes('top: calc(100% + 8px)') && style.includes('min-width: 100%'), 'autocomplete address-bar anchoring missing');
  expect('autocomplete: newtab uses in-page topbar suggestions', renderer.includes('sendNewtabTopbarAutocomplete') && renderer.includes('isActiveTabNewTab()') && newtab.includes('renderTopbarAutocomplete'), 'newtab topbar autocomplete path missing');
  expect('autocomplete: newtab autocomplete IPC bridge exists', main.includes('newtab-topbar-autocomplete-show') && preload.includes('showNewtabTopbarAutocomplete') && preload.includes('onTopbarAutocompleteShow'), 'newtab autocomplete IPC bridge missing');
  expect('autocomplete: newtab topbar suggestions are styled in-page', newtabCss.includes('.newtab-topbar-autocomplete-dropdown') && newtabCss.includes('position: fixed'), 'newtab topbar autocomplete CSS missing');
  expect('autocomplete: preview is reset before capture', renderer.includes('clearContentPreviewNow') && renderer.includes('await new Promise(resolve => setTimeout(resolve, 50))'), 'autocomplete preview reset before capture missing');
  expect('autocomplete: webview is hidden only with ready preview', renderer.includes('isAutocompleteOverPreview') && renderer.includes('hasActiveContentPreview()'), 'autocomplete preview-ready guard missing');
  expect('autocomplete: overlay navigation clears address suggestions', renderer.includes('dismissAddressAutocompleteForOverlay') && renderer.includes('setAddressBarInteractionActive(false)'), 'overlay autocomplete dismissal missing');
  expect('autocomplete: autohide top bar stays visible while active', style.includes('body.topbar-auto-hide.address-bar-active #top-bar') && style.includes('body.topbar-auto-hide.autocomplete-active #top-bar'), 'top bar autohide active override missing');
  expect('autocomplete: suggestions are promoted above hidden chrome', style.includes('body.autocomplete-active .autocomplete-dropdown') && style.includes('.autocomplete-dropdown.is-visible'), 'autocomplete z-index visibility override missing');
  expect('autocomplete: settings overlays stay above active address chrome', style.includes('--z-settings-overlay: 16000') && style.includes('z-index: 14000'), 'settings overlay z-index guard missing');
}

function checkModalLayeringFlow() {
  const style = read('src/renderer/style.css');
  const renderer = read('src/renderer/renderer.js');
  const settingsZ = Number(style.match(/--z-settings-overlay:\s*(\d+)/)?.[1] || 0);
  const modalZ = Number(style.match(/--z-modal-overlay:\s*(\d+)/)?.[1] || 0);
  const toastZ = Number(style.match(/--z-toast-overlay:\s*(\d+)/)?.[1] || 0);

  expect('modals: modal layer is above settings overlay',
    settingsZ > 0 && modalZ > settingsZ && (!toastZ || toastZ > modalZ),
    `settings=${settingsZ}, modal=${modalZ}, toast=${toastZ}`);
  expect('modals: update notes can open without closing settings',
    renderer.includes('showUpdateModal(info, { notesOnly: true })') &&
      renderer.includes('updateModal?.classList.add') &&
      style.includes('z-index: var(--z-modal-overlay)'),
    'update notes modal can still render behind settings');
  expect('modals: custom success modal shares modal layer',
    style.includes('.bookmarks-success-modal-overlay') && style.includes('z-index: var(--z-modal-overlay)'),
    'custom bookmark success modal is not on modal layer');
  expect('modals: release notes scrollbar is themed',
    style.includes('.update-notes-container::-webkit-scrollbar-thumb') &&
      style.includes('.update-notes-container::-webkit-scrollbar-button') &&
      style.includes('scrollbar-color: rgba(0, 221, 255'),
    'release notes scrollbar still uses the default platform style');
}

function checkTransparentNewtabWidgets() {
  const main = read('src/main/main.js');
  const preload = read('src/preload.js');
  const indexHtml = read('src/renderer/index.html');
  const settings = read('src/renderer/js/settings.js');
  const newtab = read('src/newtab/newtab.js');
  const newtabCss = read('src/newtab/newtab.css');
  const i18n = read('src/renderer/js/i18n.js');
  expect('newtab widgets: default setting exists', main.includes('newtabTransparentWidgets: false'), 'transparent widget default missing');
  expect('newtab widgets: preload allows setting', preload.includes("'newtabTransparentWidgets'"), 'transparent widget setting not allowed through preload');
  expect('newtab widgets: appearance toggle exists', indexHtml.includes('settings-newtab-transparent-widgets') && indexHtml.includes('newtab-transparent-widgets'), 'transparent widget toggle missing');
  expect('newtab widgets: settings renderer binds toggle', settings.includes('newtabTransparentWidgets: false') && settings.includes("bindAppearanceCheckbox('settings-newtab-transparent-widgets', 'newtabTransparentWidgets')"), 'transparent widget settings binding missing');
  expect('newtab widgets: newtab applies transparent class', newtab.includes('newtabTransparentWidgets: false') && newtab.includes('transparent-widgets') && newtab.includes("'newtabTransparentWidgets'"), 'newtab transparent widget runtime missing');
  expect('newtab widgets: transparent styles cover widgets', newtabCss.includes('body.transparent-widgets') && newtabCss.includes('.search-input-wrapper') && newtabCss.includes('.weather-card') && newtabCss.includes('.shortcut-card'), 'transparent widget CSS missing');
  expect('newtab widgets: translations exist', i18n.includes("'newtab-transparent-widgets'"), 'transparent widget translations missing');
}

function checkIncognitoNewTabFlow() {
  const main = read('src/main/main.js');
  const preload = read('src/preload.js');
  const renderer = read('src/renderer/renderer.js');
  const settings = read('src/renderer/js/settings.js');
  const tabs = read('src/renderer/js/tabs.js');
  const html = read('src/incognito-newtab/incognito-newtab.html');
  const css = read('src/incognito-newtab/incognito-newtab.css');
  const js = read('src/incognito-newtab/incognito-newtab.js');
  expect('incognito newtab: main routes blank incognito tabs to private page', main.includes('INCOGNITO_NEWTAB_PAGE_PATH') && main.includes('getNewTabPagePath(!!tab?.isIncognito)') && main.includes('/incognito-newtab/incognito-newtab.html'), 'main incognito newtab route missing');
  expect('incognito newtab: local newtab detection includes private page', main.includes('isLocalNewTabUrl') && renderer.includes('isLocalNewTabUrl') && settings.includes('/incognito-newtab/incognito-newtab.html') && tabs.includes('/incognito-newtab/incognito-newtab.html'), 'incognito newtab local-page detection missing');
  expect('incognito newtab: preload exposes newtab APIs to private page', preload.includes('/incognito-newtab/incognito-newtab.html') && preload.includes("return 'newtab'"), 'incognito newtab preload page kind missing');
  expect('incognito newtab: session restore skips private tabs', main.includes('.filter(tab => !tab.isIncognito'), 'incognito tabs are not excluded from session restore');
  expect('incognito newtab: content explains privacy boundaries', html.includes('notSavedTitle') && html.includes('visibleTitle') && html.includes('tipsTitle'), 'incognito privacy content missing');
  expect('incognito newtab: dark private theme exists', css.includes('--page-bg') && css.includes('.privacy-badge') && css.includes('.info-card'), 'incognito newtab theme missing');
  expect('incognito newtab: compact layout exists', css.includes('grid-template-columns: minmax(0, 0.95fr) minmax(320px, 1.05fr)') && css.includes('grid-row: 1 / span 3') && css.includes('font-size: clamp(28px, 3.2vw, 44px)'), 'incognito compact layout missing');
  expect('incognito newtab: scrollbar is themed', css.includes('scrollbar-color') && css.includes('html::-webkit-scrollbar-thumb') && css.includes('.incognito-topbar-autocomplete::-webkit-scrollbar-thumb'), 'incognito scrollbar theme missing');
  expect('incognito newtab: tr/en/fr translations exist', js.includes('tr:') && js.includes('en:') && js.includes('fr:'), 'incognito newtab translations missing');
  expect('incognito newtab: search box is functional', html.includes('incognito-search-form') && css.includes('.incognito-search') && js.includes('formatSearch') && js.includes('activeSearchEngine'), 'incognito newtab search box missing');
  expect('incognito newtab: topbar icons do not print raw SVG text', js.includes('topbarIconFor') && js.includes('${topbarIconFor(item.type)}') && !js.includes('item.icon || iconFor'), 'incognito autocomplete icon rendering can leak raw SVG text');
  expect('incognito newtab: topbar autocomplete is supported', js.includes('onTopbarAutocompleteShow') && js.includes('activateTopbarAutocomplete') && css.includes('.incognito-topbar-autocomplete'), 'incognito topbar autocomplete missing');
}

function checkProfileFlow() {
  const main = read('src/main/main.js');
  const preload = read('src/preload.js');
  const renderer = read('src/renderer/renderer.js');
  const indexHtml = read('src/renderer/index.html');
  const state = read('src/renderer/js/state.js');
  const style = read('src/renderer/style.css');
  const settings = read('src/renderer/js/settings.js');
  const i18n = read('src/renderer/js/i18n.js');
  const modalDialogs = read('src/renderer/js/modal-dialogs.js');

  expect('profiles: profile store defaults exist',
    main.includes('PROFILE_STORE_DEFAULTS') &&
      main.includes("bookmarks: () => ({ bookmarks: [] })") &&
      main.includes("session: () => ({ tabs: [], tabOrders: {} })") &&
      main.includes("passwords: () => ({ passwords: [] })"),
    'profile-scoped store defaults missing');
  expect('profiles: main IPC handlers exist',
    ['profiles-get', 'profiles-create', 'profiles-update', 'profiles-delete', 'profiles-switch'].every(channel => main.includes(`'${channel}'`)),
    'profile IPC handlers missing');
  expect('profiles: session partitions are profile-aware',
    main.includes('getProfilePartitionBase') &&
      main.includes('GUEST_PROFILE_ID') &&
      main.includes('getSessionForSpace(spaceName, isIncognito = false, profileId = activeProfileId)'),
    'profile-aware session partitions missing');
  expect('profiles: tabs carry profile id and session restore filters it',
    main.includes('profileId,') &&
      main.includes('(tab.profileId || DEFAULT_PROFILE_ID) === activeProfileId') &&
      main.includes('filteredTabOrders'),
    'tab profile id or filtered restore data missing');
  expect('profiles: preload exposes profile APIs',
    ['getProfiles', 'createProfile', 'updateProfile', 'deleteProfile', 'switchProfile', 'getProfileHealth', 'clearProfileData', 'setProfilePin', 'clearProfilePin', 'onProfileSwitched', 'onProfilesUpdated'].every(name => preload.includes(name)),
    'profile preload bridge missing');
  expect('profiles: renderer profile selector and manager exist',
    indexHtml.includes('profile-selector-btn') &&
      indexHtml.includes('profile-manager-modal') &&
      indexHtml.includes('profile-status-text') &&
      renderer.includes('renderProfileSelector') &&
      renderer.includes('applyProfilePayload') &&
      renderer.includes('loadProfileScopedData'),
    'profile UI flow missing');
  expect('profiles: default and guest profiles are locked from editing',
    main.includes("id === DEFAULT_PROFILE_ID || id === GUEST_PROFILE_ID") &&
      renderer.includes('isProfileLocked') &&
      renderer.includes('profile-default-locked') &&
      renderer.includes('profile-guest-locked'),
    'default or guest profile editing lock missing');
  expect('profiles: create/edit form modes are separated',
    renderer.includes("profileFormMode = 'create'") &&
      renderer.includes("profileFormMode === 'edit'") &&
      renderer.includes('profile-created') &&
      renderer.includes('profile-updated'),
    'profile create/edit mode separation missing');
  expect('profiles: settings section exists',
    indexHtml.includes('settings-tab-profiles') &&
      indexHtml.includes('settings-profile-list') &&
      indexHtml.includes('profile-health-grid') &&
      settings.includes('refreshProfileHealthPanel') &&
      settings.includes('clearActiveProfileDataFromSettings'),
    'profiles settings section missing');
  expect('profiles: data cleanup and health IPC exist',
    main.includes("ipcMain.handle('profiles-health-get'") &&
      main.includes("ipcMain.handle('profiles-clear-data'") &&
      main.includes('clearProfileData') &&
      main.includes('getProfileHealth'),
    'profile health or cleanup IPC missing');
  expect('profiles: PIN lock flow exists',
    main.includes("ipcMain.handle('profiles-pin-set'") &&
      main.includes("ipcMain.handle('profiles-pin-clear'") &&
      main.includes('pbkdf2Sync') &&
      renderer.includes('showOsloPrompt') &&
      renderer.includes('showOsloAlert') &&
      renderer.includes('profile-pin-unlock-title') &&
      renderer.includes('profile-pin-wrong') &&
      renderer.includes('isPinError') &&
      renderer.includes('isRuntimeDialogOpen'),
    'profile PIN lock flow missing');
  expect('profiles: PIN and manager modals stay above settings/native content',
    settings.includes("window.openProfileManager({ fromSettings: true })") &&
      renderer.includes('openModalAboveSettings') &&
      renderer.includes("modal.dataset.directOverlay = 'true'") &&
      renderer.includes('clearProfileMenuOverlap({ clearPreview: !needsPin })') &&
      modalDialogs.includes('await window.osloContentPreview.show()') &&
      modalDialogs.includes('window.osloContentPreview?.refreshBounds?.()') &&
      style.includes('#profile-manager-modal.open') &&
      style.includes('.modal-overlay.oslo-runtime-dialog'),
    'profile manager or PIN prompt can still be hidden behind settings/native content');
  expect('profiles: templates are supported',
    main.includes('PROFILE_TEMPLATES') &&
      indexHtml.includes('profile-template-input') &&
      renderer.includes('profileTemplateDefaults') &&
      renderer.includes('template })') &&
      renderer.includes('applyProfileTemplateSuggestion(profileTemplateInput.value') &&
      renderer.includes("profileFormMode === 'edit'") &&
      main.includes('applyProfileTemplateSettings') &&
      main.includes('templateChanged'),
    'profile templates missing');
  expect('profiles: locked system profile names are localized',
    renderer.includes('getProfileDisplayName') &&
      renderer.includes("profile.isGuest) return getUiText('profile-template-guest'") &&
      renderer.includes("profile.isDefault) return getProfileTemplateName('personal'") &&
      settings.includes('getProfileDisplayNameForSettings') &&
      settings.includes("profile.isGuest) return getText('profile-template-guest'") &&
      settings.includes("profile.isDefault) return getText('profile-template-personal'"),
    'default and guest profile names are still rendered from stored Turkish labels');
  expect('profiles: generated template profile names are localized after language changes',
    renderer.includes('getTemplateGeneratedNameSuffix') &&
      renderer.includes('getTemplateNameVariants') &&
      renderer.includes('Object.values(translations)') &&
      renderer.includes('return generatedSuffix ? `${templateName} ${generatedSuffix}` : templateName') &&
      settings.includes('getTemplateGeneratedNameSuffixForSettings') &&
      settings.includes('getTemplateNameVariantsForSettings'),
    'created template profile names remain stuck in the language used at creation');
  expect('profiles: profile theme line exists',
    renderer.includes('--active-profile-color') &&
      style.includes('#top-bar::after') &&
      style.includes('var(--active-profile-color'),
    'profile color line missing');
  expect('profiles: locked profiles are sorted before custom profiles',
    renderer.includes('a.isDefault ? 0') &&
      renderer.includes('a.isGuest ? 1 : 2') &&
      renderer.includes('createdAt'),
    'locked profile sorting is missing');
  expect('profiles: profile menu uses sorted list and fits sidebar width',
    renderer.includes('const profileRows = getManagedProfiles().map') &&
      style.includes('.profile-menu') &&
      style.includes('width: 100%') &&
      style.includes('overflow-x: hidden'),
    'profile menu sorting or fit styles missing');
  expect('profiles: manager list scrollbar is themed',
    style.includes('.profile-manager-list::-webkit-scrollbar-thumb') &&
      style.includes('.profile-manager-list::-webkit-scrollbar-button') &&
      style.includes('scrollbar-color: rgba(0, 221, 255, 0.58)'),
    'profile manager scrollbar still uses the default platform style');
  expect('profiles: collapsed profile menu avoids native view overlap',
    renderer.includes('updateProfileMenuOverlapState') &&
      renderer.includes('isProfileMenuOverContent') &&
      renderer.includes("profileMenu?.dataset.overlapsContent === 'true'") &&
      renderer.includes('await captureContentPreview()'),
    'collapsed profile menu overlap guard missing');
  expect('profiles: manager transition preserves content preview',
    renderer.includes('cancelContentPreviewClearTimer') &&
      renderer.includes('clearProfileMenuOverlap({ clearPreview: false })') &&
      renderer.includes("clearPreview: !profileManagerModal?.classList.contains('open')"),
    'profile manager transition can clear the content preview');
  expect('profiles: successful save closes manager overlay',
    renderer.includes('showProfileToast') &&
      renderer.includes('closeProfileManager();') &&
      renderer.includes("successMessage = getUiText('profile-created'") &&
      renderer.includes("successMessage = getUiText('profile-updated'"),
    'profile save success can leave manager overlay open');
  expect('profiles: renderer state tracks active profile',
    state.includes('profiles: []') && state.includes("activeProfileId: 'default'") && state.includes('activeProfile: null'),
    'profile state fields missing');
  expect('profiles: profile menu can escape sidebar clipping',
    style.includes('.profile-menu') && style.includes('z-index: var(--z-menu)') && style.includes('overflow: visible'),
    'profile menu layering styles missing');
  expect('profiles: translations exist for tr/en/fr',
    i18n.includes("'profile-manager-title'") && i18n.includes("'profile-guest-desc'") && i18n.includes("'profile-delete-confirm'") && i18n.includes("'profile-create'") && i18n.includes("'profile-default-locked'") && i18n.includes("'profiles-settings'") && i18n.includes("'profile-pin-title'") && i18n.includes("'profile-template-work'"),
    'profile translations missing');
}

function checkVideoFullscreenFlow() {
  const main = read('src/main/main.js');
  expect('fullscreen: html fullscreen state is tracked per window', main.includes('htmlFullscreenByWindow') && main.includes('enterHtmlFullscreenForView') && main.includes('leaveHtmlFullscreenForWindow'), 'html fullscreen state helpers missing');
  expect('fullscreen: webcontents html fullscreen events are handled', main.includes("wc.on('enter-html-full-screen'") && main.includes("wc.on('leave-html-full-screen'"), 'html fullscreen webContents events missing');
  expect('fullscreen: fullscreen view expands to window content bounds', main.includes('getFullscreenContentBounds') && main.includes('win.setFullScreen(true)') && main.includes('fullscreenState.view.setBounds'), 'fullscreen bounds expansion missing');
  expect('fullscreen: renderer bounds cannot shrink active fullscreen view', main.includes("ipcMain.on('tab-bounds'") && main.includes('applyHtmlFullscreenBounds(win, fullscreenState)') && main.includes('return;'), 'fullscreen tab-bounds guard missing');
  expect('fullscreen: fullscreen permission is allowed', main.includes("permission === 'fullscreen'") && main.includes('callback(true)'), 'fullscreen permission allow missing');
}

function checkUpdateConnectivityFlow() {
  const main = read('src/main/main.js');
  const preload = read('src/preload.js');
  const renderer = read('src/renderer/renderer.js');
  const i18n = read('src/renderer/js/i18n.js');
  const handlerStart = main.indexOf("ipcMain.handle('check-for-updates'");
  const updateHandler = handlerStart >= 0 ? main.slice(handlerStart) : '';

  expect('updates: connectivity is checked before release lookup',
    updateHandler.includes('hasUpdateNetworkConnectivity') &&
      updateHandler.includes('fetchLatestGithubRelease') &&
      updateHandler.indexOf('hasUpdateNetworkConnectivity') < updateHandler.indexOf('fetchLatestGithubRelease') &&
      main.includes('releases/latest'),
    'update checker can still report current version after a network failure');
  expect('updates: offline result uses explicit error code',
    main.includes("errorCode: 'network_offline'") && main.includes('offline: true') && main.includes("latestVersion: ''"),
    'offline update result is not distinguishable from up-to-date state');
  expect('updates: renderer shows network-specific message',
    renderer.includes('getUpdateCheckErrorText') && renderer.includes('hasUpdateCheckError') && renderer.includes('update-network-error'),
    'update UI does not handle offline update checks explicitly');
  expect('updates: network error translations exist',
    i18n.includes("'update-network-error'"),
    'network update error translation missing');
  expect('updates: release notes have a dedicated IPC flow',
    main.includes("ipcMain.handle('release-notes-get'") &&
      preload.includes('getReleaseNotes') &&
      renderer.includes('window.oslo.getReleaseNotes') &&
      renderer.includes('showUpdateModal(info, { notesOnly: true })'),
    'release notes button still depends only on the update availability flow');
  const oldOsloDomain = ['oslo', 'browser.com'].join('');
  expect('updates: official download fallback uses current OSLO site',
    main.includes("const OFFICIAL_DOWNLOAD_URL = `${OFFICIAL_WEBSITE_URL}/download`;") &&
      renderer.includes("const OFFICIAL_DOWNLOAD_URL = 'https://www.browser.osloteam.net/download';") &&
      !main.includes(oldOsloDomain) &&
      !renderer.includes(oldOsloDomain),
    'update/download flow still references the old OSLO domain');
}

function checkBuildConfig() {
  const pkg = JSON.parse(read('package.json'));
  const targets = JSON.stringify(pkg.build?.win?.target || []);
  expect('build: production build script exists', typeof pkg.scripts?.build === 'string' && pkg.scripts.build.includes('electron-builder'), 'build script missing electron-builder');
  expect('build: Windows setup target exists', targets.includes('nsis'), 'nsis setup target missing');
  expect('build: artifact name includes version', String(pkg.build?.nsis?.artifactName || '').includes('${version}'), 'installer artifact version placeholder missing');
}

function checkI18n() {
  const translations = extractTranslations(read('src/renderer/js/i18n.js'));
  const languages = Object.keys(translations);
  expect('i18n: tr/en/fr dictionaries exist', ['tr', 'en', 'fr'].every(lang => languages.includes(lang)), 'expected tr, en, fr dictionaries');
  const baseKeys = Object.keys(translations.tr || {});
  const missing = languages.flatMap(lang => baseKeys
    .filter(key => !Object.prototype.hasOwnProperty.call(translations[lang] || {}, key))
    .map(key => `${lang}.${key}`));
  expect('i18n: language dictionaries have matching keys', missing.length === 0, missing.slice(0, 20).join(', '));
}

function checkNativeAlerts() {
  const files = [
    'src/renderer/renderer.js',
    'src/renderer/js/settings.js',
    'src/newtab/newtab.js'
  ];
  const offenders = files.filter(file => /\balert\s*\(/.test(read(file)));
  expect('ui: native alert calls are removed', offenders.length === 0, offenders.join(', '));
}

function run() {
  checkStartupFiles();
  checkTabCreateFlow();
  checkSettingsSaveFlow();
  checkAboutWebsiteLink();
  checkAdvancedDownloads();
  checkTaskManagerFlow();
  checkSiteSecurityPanel();
  checkPasswordHealthPanel();
  checkAutocompleteTopbarEdgeCase();
  checkModalLayeringFlow();
  checkTransparentNewtabWidgets();
  checkIncognitoNewTabFlow();
  checkProfileFlow();
  checkVideoFullscreenFlow();
  checkUpdateConnectivityFlow();
  checkBuildConfig();
  checkI18n();
  checkNativeAlerts();

  const failed = checks.filter(check => !check.ok);
  checks.forEach(check => {
    const prefix = check.ok ? 'PASS' : 'FAIL';
    console.log(`${prefix} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
  });

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run();
