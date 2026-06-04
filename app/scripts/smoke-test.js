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
  expect('autocomplete: settings overlays stay above active address chrome', style.includes('z-index: 16000') && style.includes('z-index: 14000'), 'settings overlay z-index guard missing');
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
