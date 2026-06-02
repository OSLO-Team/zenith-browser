const params = new URLSearchParams(window.location.search);
const articleId = params.get('id') || '';
const articleEl = document.getElementById('reader-article');
const originalLink = document.getElementById('reader-original-link');
const backButton = document.getElementById('reader-back');
const themeButton = document.getElementById('reader-theme');
const fontDownButton = document.getElementById('reader-font-down');
const fontUpButton = document.getElementById('reader-font-up');
const brandLabel = document.getElementById('reader-brand-label');
const loadingEl = document.getElementById('reader-loading');

const readerTranslations = {
  tr: {
    title: 'Okuma Modu',
    back: 'Geri',
    fontDown: 'Yazıyı küçült',
    fontUp: 'Yazıyı büyüt',
    theme: 'Tema',
    original: 'Orijinal',
    loading: 'Hazırlanıyor...',
    minuteRead: '{count} dk okuma',
    wordCount: '{count} kelime',
    noData: 'Okuma verisi bulunamadı.',
    unavailable: 'Okuma verisi şu anda kullanılamıyor.',
    error: 'Okuma modu açılamadı.'
  },
  en: {
    title: 'Reader Mode',
    back: 'Back',
    fontDown: 'Decrease text size',
    fontUp: 'Increase text size',
    theme: 'Theme',
    original: 'Original',
    loading: 'Preparing...',
    minuteRead: '{count} min read',
    wordCount: '{count} words',
    noData: 'Reader data was not found.',
    unavailable: 'Reader data is not available right now.',
    error: 'Reader mode could not be opened.'
  },
  fr: {
    title: 'Mode lecture',
    back: 'Retour',
    fontDown: 'Réduire la taille du texte',
    fontUp: 'Augmenter la taille du texte',
    theme: 'Thème',
    original: 'Original',
    loading: 'Préparation...',
    minuteRead: '{count} min de lecture',
    wordCount: '{count} mots',
    noData: 'Les données de lecture sont introuvables.',
    unavailable: 'Les données de lecture ne sont pas disponibles pour le moment.',
    error: 'Impossible d’ouvrir le mode lecture.'
  }
};

let fontSize = 19;
let uiLang = 'tr';
let currentArticleTitle = '';

function normalizeLang(value) {
  const lang = String(value || '').toLowerCase().slice(0, 2);
  return Object.prototype.hasOwnProperty.call(readerTranslations, lang) ? lang : 'tr';
}

function t(key, replacements = {}) {
  const messages = readerTranslations[uiLang] || readerTranslations.tr;
  let text = messages[key] || readerTranslations.tr[key] || key;
  Object.entries(replacements).forEach(([name, value]) => {
    text = text.replace(`{${name}}`, String(value));
  });
  return text;
}

function applyReaderLanguage() {
  const title = currentArticleTitle || t('title');
  document.title = `${title} - OSLO`;

  if (brandLabel) brandLabel.textContent = t('title');
  if (backButton) {
    backButton.title = t('back');
    backButton.setAttribute('aria-label', t('back'));
  }
  if (fontDownButton) {
    fontDownButton.title = t('fontDown');
    fontDownButton.setAttribute('aria-label', t('fontDown'));
  }
  if (fontUpButton) {
    fontUpButton.title = t('fontUp');
    fontUpButton.setAttribute('aria-label', t('fontUp'));
  }
  if (themeButton) {
    themeButton.title = t('theme');
    themeButton.setAttribute('aria-label', t('theme'));
  }
  if (originalLink) originalLink.textContent = t('original');
  if (loadingEl) loadingEl.textContent = t('loading');
}

function setReaderFontSize(nextSize) {
  fontSize = Math.max(16, Math.min(24, nextSize));
  document.documentElement.style.setProperty('--reader-font-size', `${fontSize}px`);
}

function createTextElement(tagName, className, text) {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  el.textContent = text || '';
  return el;
}

function createBlock(block) {
  if (!block || typeof block !== 'object') return null;

  if (block.type === 'heading') {
    const level = Math.max(2, Math.min(4, Number(block.level) || 2));
    return createTextElement(`h${level}`, '', block.text);
  }

  if (block.type === 'paragraph') {
    return createTextElement('p', '', block.text);
  }

  if (block.type === 'quote') {
    return createTextElement('blockquote', '', block.text);
  }

  if (block.type === 'code') {
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = block.text || '';
    pre.appendChild(code);
    return pre;
  }

  if (block.type === 'list' && Array.isArray(block.items)) {
    const list = document.createElement(block.ordered ? 'ol' : 'ul');
    block.items.forEach(item => {
      const li = createTextElement('li', '', item);
      list.appendChild(li);
    });
    return list;
  }

  if (block.type === 'image' && block.src) {
    const figure = document.createElement('figure');
    const img = document.createElement('img');
    img.src = block.src;
    img.alt = block.alt || '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    figure.appendChild(img);
    if (block.caption) {
      figure.appendChild(createTextElement('figcaption', '', block.caption));
    }
    return figure;
  }

  return null;
}

function renderArticle(article) {
  if (!articleEl) return;

  uiLang = normalizeLang(article.uiLanguage || uiLang);
  currentArticleTitle = article.title || t('title');
  applyReaderLanguage();

  articleEl.textContent = '';
  articleEl.dir = article.direction || 'ltr';
  document.documentElement.lang = article.lang || uiLang;

  if (article.siteName) {
    articleEl.appendChild(createTextElement('p', 'reader-kicker', article.siteName));
  }

  articleEl.appendChild(createTextElement('h1', 'reader-title', currentArticleTitle));

  const meta = document.createElement('div');
  meta.className = 'reader-meta';
  const parts = [];
  if (article.byline) parts.push(article.byline);
  if (article.readingMinutes) parts.push(t('minuteRead', { count: article.readingMinutes }));
  if (article.wordCount) parts.push(t('wordCount', { count: article.wordCount }));
  parts.forEach(part => meta.appendChild(createTextElement('span', '', part)));
  articleEl.appendChild(meta);

  if (article.excerpt) {
    articleEl.appendChild(createTextElement('p', 'reader-excerpt', article.excerpt));
  }

  const content = document.createElement('div');
  content.className = 'reader-content';
  (article.blocks || []).forEach(block => {
    const el = createBlock(block);
    if (el) content.appendChild(el);
  });
  articleEl.appendChild(content);

  if (originalLink && article.originalUrl) {
    originalLink.href = article.originalUrl;
  }
}

function renderError(messageKey) {
  if (!articleEl) return;
  articleEl.textContent = '';
  articleEl.appendChild(createTextElement('div', 'reader-error', t(messageKey || 'error')));
}

async function loadLanguagePreference() {
  if (!window.oslo?.getAllSettings) return;
  try {
    const settings = await window.oslo.getAllSettings();
    uiLang = normalizeLang(settings?.language || uiLang);
    document.documentElement.lang = uiLang;
    applyReaderLanguage();
  } catch (error) {
    // Reader mode can still render with the default language.
  }
}

async function loadArticle() {
  await loadLanguagePreference();

  if (!articleId || !window.oslo?.getReaderArticle) {
    renderError('noData');
    return;
  }

  try {
    const article = await window.oslo.getReaderArticle(articleId);
    if (!article) {
      renderError('unavailable');
      return;
    }
    renderArticle(article);
  } catch (error) {
    renderError('error');
  }
}

backButton?.addEventListener('click', () => {
  if (history.length > 1) {
    history.back();
  }
});

themeButton?.addEventListener('click', () => {
  document.body.classList.toggle('light-reader');
});

fontDownButton?.addEventListener('click', () => setReaderFontSize(fontSize - 1));
fontUpButton?.addEventListener('click', () => setReaderFontSize(fontSize + 1));

applyReaderLanguage();
loadArticle();
