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
  expect('incognito newtab: session restore skips private tabs', main.includes('Object.values(tabs).filter(tab => !tab.isIncognito).map'), 'incognito tabs are not excluded from session restore');
  expect('incognito newtab: content explains privacy boundaries', html.includes('notSavedTitle') && html.includes('visibleTitle') && html.includes('tipsTitle'), 'incognito privacy content missing');
  expect('incognito newtab: dark private theme exists', css.includes('--page-bg') && css.includes('.privacy-badge') && css.includes('.info-card'), 'incognito newtab theme missing');
  expect('incognito newtab: tr/en/fr translations exist', js.includes('tr:') && js.includes('en:') && js.includes('fr:'), 'incognito newtab translations missing');
  expect('incognito newtab: search box is functional', html.includes('incognito-search-form') && css.includes('.incognito-search') && js.includes('formatSearch') && js.includes('activeSearchEngine'), 'incognito newtab search box missing');
  expect('incognito newtab: topbar icons do not print raw SVG text', js.includes('topbarIconFor') && js.includes('${topbarIconFor(item.type)}') && !js.includes('item.icon || iconFor'), 'incognito autocomplete icon rendering can leak raw SVG text');
  expect('incognito newtab: topbar autocomplete is supported', js.includes('onTopbarAutocompleteShow') && js.includes('activateTopbarAutocomplete') && css.includes('.incognito-topbar-autocomplete'), 'incognito topbar autocomplete missing');
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
  checkAdvancedDownloads();
  checkTaskManagerFlow();
  checkSiteSecurityPanel();
  checkPasswordHealthPanel();
  checkAutocompleteTopbarEdgeCase();
  checkModalLayeringFlow();
  checkTransparentNewtabWidgets();
  checkIncognitoNewTabFlow();
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
