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
  expect('task manager: auto refresh replaces manual refresh', indexHtml.includes('task-manager-countdown') && !indexHtml.includes('id="task-manager-refresh"'), 'task manager auto refresh UI missing');
  expect('task manager: renderer refreshes metrics automatically', settings.includes('renderTaskManagerSection') && settings.includes('ensureTaskManagerAutoRefresh'), 'task manager auto refresh renderer flow missing');
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
