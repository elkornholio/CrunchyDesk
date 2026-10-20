const { ipcRenderer } = require('electron');

let currentTheme = 'dark';
let autoSkipEnabled = localStorage.getItem('cr_auto_skip') !== 'false';
let autoNextEnabled = true;
let isAppBarCollapsed = false;
let currentShader = localStorage.getItem('cr_anime_shader') || 'default';
let navState = { canGoBack: false, canGoForward: false };

function setAutoSkipEnabled(enabled) {
  autoSkipEnabled = Boolean(enabled);
  try {
    localStorage.setItem('cr_auto_skip', String(autoSkipEnabled));
  } catch (_) {}
  const autoSkipBtn = document.getElementById('cr-auto-skip-btn');
  if (autoSkipBtn) {
    autoSkipBtn.classList.toggle('active', autoSkipEnabled);
    const labelSpan = autoSkipBtn.querySelector('span:last-child');
    if (labelSpan) labelSpan.textContent = autoSkipEnabled ? 'Skip: ON' : 'Skip: OFF';
  }
  showToast(`Auto-Skip: ${autoSkipEnabled ? 'ON' : 'OFF'}`);
  if (autoSkipEnabled) {
    checkAndAutoSkip();
  }
}

// Local persistent watched cache (syncs alongside Crunchyroll's server playheads API)
function getLocalWatchedMap() {
  try {
    return JSON.parse(localStorage.getItem('cr_watched_episodes') || '{}');
  } catch (_) {
    return {};
  }
}

function setLocalWatchedStatus(episodeIds, isWatched) {
  try {
    const map = getLocalWatchedMap();
    episodeIds.forEach((id) => {
      if (!id) return;
      map[id] = isWatched;
    });
    localStorage.setItem('cr_watched_episodes', JSON.stringify(map));
  } catch (_) {}
}

// SVG Icon Pack (Minimalist, crisp vector icons)
const ICONS = {
  back: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`,
  forward: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
  reload: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>`,
  home: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  search: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  explore: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  simulcast: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  watchlist: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`,
  zap: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  speed: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  pip: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="10" width="8" height="6" rx="1"/></svg>`,
  palette: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
  moon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  sun: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
  settings: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  chevronUp: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
  chevronDown: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  checkCircle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  eyeOff: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  eye: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
};

// Shaders mapping
const SHADERS = {
  default: { name: 'Natural', filter: 'none' },
  vibrant: { name: 'Vibrant Anime', filter: 'saturate(1.35) contrast(1.1) brightness(1.02)' },
  crisp: { name: 'Crisp Detail', filter: 'contrast(1.2) saturate(1.12) brightness(0.98)' },
  oled: { name: 'Cinematic OLED', filter: 'contrast(1.25) brightness(0.94) saturate(1.1)' },
  retro: { name: 'Warm Retro', filter: 'sepia(0.2) saturate(1.2) contrast(1.08)' }
};

// ============================================================================
// IMPROVE-CRUNCHYROLL INSPIRED API & WATCHED / UNWATCHED ENGINE
// Based on https://github.com/ThomasTavernier/Improve-Crunchyroll
// ============================================================================

const LOCALES_MAP = {
  ar: 'ar-SA',
  de: 'de-DE',
  es: 'es-419',
  'es-es': 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-PT',
  ru: 'ru-RU',
  hi: 'hi-IN'
};

function getCurrentLocale() {
  const seg = (window.location.pathname.split('/')[1] || '').toLowerCase();
  return LOCALES_MAP[seg] || 'en-US';
}

const I18N_LABELS = {
  markAsWatched: 'Mark as watched',
  markAsNotWatched: 'Mark as not watched',
  markOnlyThisOne: 'Mark only this one',
  markAllPrevious: 'Mark all previous',
  markAllNext: 'Mark all next',
  markSeasonWatched: 'Mark season watched',
  markSeasonUnwatched: 'Mark season not watched'
};

// Minimal DOM builder matching Improve-Crunchyroll's Renderer + ActionMenuRenderer
class Renderer {
  constructor(tag) {
    this.el = document.createElement(tag);
  }
  static translate(key) {
    return I18N_LABELS[key] || key;
  }
  addClass(...classes) {
    this.el.classList.add(...classes);
    return this;
  }
  setText(text) {
    this.el.textContent = text;
    return this;
  }
  setStyle(prop, val) {
    this.el.style[prop] = val;
    return this;
  }
  setAttribute(attr, val) {
    this.el.setAttribute(attr, val);
    return this;
  }
  addEventListener(type, fn) {
    this.el.addEventListener(type, fn);
    return this;
  }
  appendChildren(...children) {
    children.forEach((child) => {
      if (!child) return;
      this.el.appendChild(child instanceof Renderer ? child.getElement() : child);
    });
    return this;
  }
  getElement() {
    return this.el;
  }
  remove() {
    this.el.remove();
  }
}

class MenuRenderer {
  constructor(entry) {
    this.name = entry.name;
    this.subMenu = entry.subMenu;
  }
  render() {
    const actionMenuEntry = new Renderer('div');
    actionMenuEntry
      .setText(Renderer.translate(this.name))
      .addClass('ic_action_menu_parent')
      .addEventListener('click', (event) => {
        if (event.target === actionMenuEntry.getElement()) {
          event.stopPropagation();
        }
      })
      .appendChildren(this.subMenu.render());
    return actionMenuEntry;
  }
}

class ActionRenderer {
  constructor(entry) {
    this.name = entry.name;
    this.action = entry.action;
  }
  render() {
    return new Renderer('div')
      .addClass('ic_action_menu_action')
      .setText(Renderer.translate(this.name))
      .addEventListener('click', (event) => {
        event.stopPropagation();
        document.documentElement.classList.add('ic_loading');
        Promise.resolve(this.action())
          .then(() => {
            document.documentElement.classList.remove('ic_loading');
            document.querySelectorAll('.ic_action_menu').forEach((m) => m.remove());
          })
          .catch(() => {
            document.documentElement.classList.remove('ic_loading');
          });
      });
  }
}

class ActionMenuRenderer {
  constructor(entries) {
    this.entries = entries
      .map((entry) => {
        if (entry && (typeof entry.if !== 'function' || entry.if())) {
          if (entry.type === 'menu') {
            entry.subMenu = new ActionMenuRenderer(entry.subMenus);
            if (entry.subMenu.entries.length === 1) {
              const child = entry.subMenu.entries[0];
              child.name = entry.name;
              return child;
            }
            return new MenuRenderer(entry);
          } else if (entry.type === 'action') {
            if (typeof entry.action === 'function') {
              return new ActionRenderer(entry);
            }
          }
        }
        return null;
      })
      .filter(Boolean);
    this.length = this.entries.length;
  }
  render() {
    return new Renderer('div')
      .addClass('ic_action_menu')
      .appendChildren(...this.entries.map((entry) => entry.render()));
  }
}

// Crunchyroll API Client (modeled on Improve-Crunchyroll's API class)
const CR_API = new (class {
  #tokenPromise = null;
  #profilePromise = null;

  async #getAppConfig() {
    const apiDomain = window.location.origin;
    // 1. Check live window.__APP_CONFIG__
    if (window.__APP_CONFIG__?.cxApiParams?.accountAuthClientId) {
      return {
        apiDomain,
        accountAuthClientId: window.__APP_CONFIG__.cxApiParams.accountAuthClientId
      };
    }
    // 2. Check inline script tags
    try {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const s of scripts) {
        const text = s.textContent || '';
        const match = text.match(/window\.__APP_CONFIG__\s*=\s*(\{.*?\})(?:;|<|$)/s);
        if (match) {
          const parsed = JSON.parse(match[1]);
          if (parsed?.cxApiParams?.accountAuthClientId) {
            return {
              apiDomain,
              accountAuthClientId: parsed.cxApiParams.accountAuthClientId
            };
          }
        }
      }
    } catch (_) {}

    // 3. Fetch current page HTML as Improve-Crunchyroll does
    try {
      const html = await fetch(window.location.href).then((r) => r.text());
      const match = html.match(/(?<=window\.__APP_CONFIG__ = )\{.*?\}(?=<)/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed?.cxApiParams?.accountAuthClientId) {
          return {
            apiDomain,
            accountAuthClientId: parsed.cxApiParams.accountAuthClientId
          };
        }
      }
    } catch (_) {}

    // 4. Fallback to Crunchyroll's standard web client ID
    return {
      apiDomain,
      accountAuthClientId: 'noaihdevm_6iyg0a8l0q'
    };
  }

  get TOKEN() {
    if (this.#tokenPromise) return this.#tokenPromise;

    this.#tokenPromise = this.#getAppConfig().then(async ({ apiDomain, accountAuthClientId }) => {
      let browser = 'Chrome';
      if (/Firefox/.test(navigator.userAgent)) browser = 'Firefox';
      else if (/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) browser = 'Safari';
      else if (/Edge/.test(navigator.userAgent)) browser = 'Edge';

      let osName = 'Windows';
      if (/Linux/.test(navigator.userAgent)) osName = 'Linux';
      else if (/Mac/.test(navigator.userAgent)) osName = 'Mac';

      const cookieMatch = /(?<=(?:^| )device_id=)[^;]+/.exec(document.cookie);
      const deviceId = cookieMatch
        ? cookieMatch[0]
        : localStorage.getItem('cr_fallback_device_id') ||
          (() => {
            const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
            });
            localStorage.setItem('cr_fallback_device_id', id);
            return id;
          })();

      const fetchToken = (grant_type) =>
        fetch(`${apiDomain}/auth/v1/token`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${window.btoa(`${accountAuthClientId}:`)}`
          },
          body: new URLSearchParams({
            device_id: deviceId,
            device_type: `${browser} on ${osName}`,
            grant_type
          })
        });

      let response = await fetchToken('etp_rt_cookie');
      if (!response.ok) {
        response = await fetchToken('client_id');
      }
      if (!response.ok) {
        this.#tokenPromise = null;
        throw new Error(`Auth token failed (${response.status})`);
      }

      const { token_type, access_token, expires_in, account_id } = await response.json();
      setTimeout(() => {
        this.#tokenPromise = null;
      }, Math.max(10, (expires_in || 300) - 15) * 1000);

      return {
        Authorization: `${token_type} ${access_token}`,
        apiDomain,
        account_id
      };
    }).catch((err) => {
      this.#tokenPromise = null;
      throw err;
    });

    return this.#tokenPromise;
  }

  get PROFILE() {
    if (this.#profilePromise) return this.#profilePromise;
    this.#profilePromise = this.TOKEN.then(({ account_id }) => {
      if (account_id) {
        return this.#getResponse('/accounts/v1/me/multiprofile')
          .then(({ profiles }) => {
            const selectedProfile = (profiles || []).find((p) => p.is_selected);
            if (selectedProfile) {
              return {
                preferred_content_audio_language: selectedProfile.preferred_content_audio_language
              };
            }
            return {};
          })
          .catch(() => ({}));
      }
      return {};
    });
    return this.#profilePromise;
  }

  objects(objectId) {
    return this.#get(`/content/v2/cms/objects/${objectId}`);
  }

  seasons(series_id) {
    return this.PROFILE.then(({ preferred_content_audio_language }) => {
      return this.#get(
        `/content/v2/cms/series/${series_id}/seasons`,
        preferred_content_audio_language
          ? { preferred_audio_language: preferred_content_audio_language }
          : {}
      );
    });
  }

  episodes(season_id) {
    return this.#get(`/content/v2/cms/seasons/${season_id}/episodes`);
  }

  up_next_series(series_id) {
    return this.#get(`/content/v2/discover/up_next/${series_id}`).then(
      ([
        {
          panel: {
            episode_metadata: { season_id }
          }
        }
      ]) => ({ season_id })
    );
  }

  getPlayheads(contentIds = []) {
    if (!contentIds || contentIds.length === 0) return Promise.resolve([]);
    return this.TOKEN.then(({ account_id }) => {
      if (!account_id) return [];
      return this.#get(`/content/v2/${account_id}/playheads`, {
        content_ids: contentIds.join(',')
      }).catch(() => []);
    });
  }

  playheads(...data) {
    const dateWatched = new Date().toISOString();
    // Always update local state immediately for instant UI responsiveness
    data.forEach(({ id, playheadMs }) => {
      setLocalWatchedStatus([id], playheadMs > 0);
    });

    return this.TOKEN.then(({ account_id }) => {
      if (!account_id) {
        throw new Error('Please log in to Crunchyroll to sync watched status to your account.');
      }
      return this.#post(
        `/content/v2/${account_id}/playheads/batch`,
        JSON.stringify({
          batch: data.reduce((acc, { id, playheadMs }) => {
            acc[id] = {
              playhead: ~~(playheadMs / 1000),
              date_watched: dateWatched
            };
            return acc;
          }, {})
        })
      );
    });
  }

  #fetch(href, searchParams = {}, requestInit = {}) {
    const locale = getCurrentLocale();
    return this.TOKEN.then(({ Authorization, apiDomain }) =>
      fetch(`${apiDomain}${href}?${new URLSearchParams({ locale, ...searchParams })}`, {
        headers: {
          Authorization,
          'Content-Type': 'application/json'
        },
        ...requestInit
      }).then((res) => {
        if (!res.ok) {
          throw new Error(`Crunchyroll API error: HTTP ${res.status}`);
        }
        return res;
      })
    );
  }

  #getResponse(href, searchParams) {
    return this.#fetch(href, searchParams, { method: 'GET' }).then((r) => r.json());
  }

  #get(href, searchParams) {
    return this.#getResponse(href, searchParams).then(({ data }) => data || []);
  }

  #post(href, body) {
    return this.#fetch(href, {}, { method: 'POST', body });
  }
})();

// ============================================================================
// SERIES & EPISODE CARD WATCHED / UNWATCHED CONTROLLER
// ============================================================================

class MarkAsWatchedNotWatchedController {
  static REFRESH_TIMEOUT = 2200;

  seriesId = null;
  seasonsPromise = null;
  episodesCache = {};
  playheadsCache = {};
  refreshTimeout = null;
  activePath = null;

  initForCurrentPage() {
    const pathname = window.location.pathname;
    const match = pathname.match(/(?<=\/series\/)[^\/]+/);
    const newSeriesId = match ? match[0] : null;

    if (newSeriesId && newSeriesId !== this.seriesId) {
      this.seriesId = newSeriesId;
      this.seasonsPromise = CR_API.seasons(this.seriesId).catch(() => []);
      this.episodesCache = {};
      this.playheadsCache = {};
    } else if (!newSeriesId) {
      this.seriesId = null;
    }

    if (this.seriesId || pathname.includes('/watch/')) {
      this.scanEpisodeCards();
    }
    if (this.seriesId) {
      this.injectSeasonToolbar();
    }
  }

  getEpisodesForSeason(seasonId) {
    if (!seasonId) return Promise.resolve([]);
    if (!this.episodesCache[seasonId]) {
      this.episodesCache[seasonId] = CR_API.episodes(seasonId).catch(() => []);
    }
    return this.episodesCache[seasonId];
  }

  async getCurrentSeasonEpisodes() {
    if (!this.seriesId) return [];
    try {
      const currentSeasonTitleEl = document.querySelector(
        '.seasons-select h4, .seasons-select span[class^="select-trigger__title"], [data-t="season-title"]'
      );
      if (currentSeasonTitleEl && this.seasonsPromise) {
        const seasons = await this.seasonsPromise;
        const rawTitle = (currentSeasonTitleEl.innerText || '').trim();
        const found =
          seasons.find(({ title }) => rawTitle.endsWith(title)) ||
          seasons
            .filter(({ title }) => rawTitle.includes(title))
            .sort((a, b) => b.title.length - a.title.length)[0] ||
          seasons[0];
        if (found) {
          return await this.getEpisodesForSeason(found.id);
        }
      }
      const { season_id } = await CR_API.up_next_series(this.seriesId);
      if (season_id) {
        return await this.getEpisodesForSeason(season_id);
      }
    } catch (_) {}

    // Fallback: inspect first visible episode card link and query its season_id via objects()
    try {
      const firstWatchLink = document.querySelector('.erc-season-episode-list a[href*="/watch/"], .card a[href*="/watch/"]');
      if (firstWatchLink) {
        const epIdMatch = firstWatchLink.getAttribute('href').match(/\/watch\/([A-Z0-9]+)/i);
        if (epIdMatch) {
          const objs = await CR_API.objects(epIdMatch[1]);
          const seasonId = objs?.[0]?.episode_metadata?.season_id;
          if (seasonId) {
            return await this.getEpisodesForSeason(seasonId);
          }
        }
      }
    } catch (_) {}

    return [];
  }

  async resolveEpisodeFromCard(card, seasonEpisodes) {
    const a = card.querySelector('a[href*="/watch/"]') || card.querySelector('a');
    if (!a || !a.href) return null;

    if (seasonEpisodes && seasonEpisodes.length > 0) {
      const matched = seasonEpisodes.find(({ id, versions }) => {
        return a.href.includes(id) || (versions && versions.some(({ guid }) => a.href.includes(guid)));
      });
      if (matched) return { episode: matched, episodes: seasonEpisodes };
    }

    // Direct fallback by extracting the episode ID from /watch/<ID>
    const epMatch = a.href.match(/\/watch\/([A-Z0-9]+)/i);
    if (!epMatch) return null;
    const epId = epMatch[1];

    try {
      const objs = await CR_API.objects(epId);
      const obj = objs?.[0];
      if (obj) {
        const epData = {
          id: obj.id || epId,
          title: obj.title || '',
          sequence_number: obj.episode_metadata?.sequence_number ?? 1,
          duration_ms: obj.episode_metadata?.duration_ms || 1440000,
          availability_starts: obj.availability_starts,
          season_id: obj.episode_metadata?.season_id
        };
        let allSeasonEps = seasonEpisodes;
        if ((!allSeasonEps || allSeasonEps.length === 0) && epData.season_id) {
          allSeasonEps = await this.getEpisodesForSeason(epData.season_id);
        }
        return {
          episode: epData,
          episodes: allSeasonEps && allSeasonEps.length > 0 ? allSeasonEps : [epData]
        };
      }
    } catch (_) {}

    return {
      episode: {
        id: epId,
        sequence_number: 1,
        duration_ms: 1440000
      },
      episodes: seasonEpisodes || []
    };
  }

  createMarkAsWatchedNotWatchedEntries(episode, episodes, cardElement) {
    const { id, sequence_number: episode_sequence_number, duration_ms = 1440000 } = episode;
    const hasSeasonList = Array.isArray(episodes) && episodes.length > 1;
    const firstSeq = hasSeasonList ? episodes[0].sequence_number : episode_sequence_number;
    const lastSeq = hasSeasonList ? episodes[episodes.length - 1].sequence_number : episode_sequence_number;

    return [
      {
        name: 'markAsWatched',
        type: 'menu',
        subMenus: [
          {
            name: 'markOnlyThisOne',
            type: 'action',
            action: () =>
              this.executePlayheadUpdate(
                [{ id, playheadMs: duration_ms || 1440000 }],
                true,
                [cardElement],
                'Marked episode as Watched'
              )
          },
          {
            name: 'markAllPrevious',
            if: () => hasSeasonList && episode_sequence_number > firstSeq,
            type: 'action',
            action: () => {
              const targetEps = episodes.filter(
                ({ sequence_number }) => sequence_number <= episode_sequence_number
              );
              return this.executePlayheadUpdate(
                targetEps.map(({ id: epId, duration_ms: dMs }) => ({
                  id: epId,
                  playheadMs: dMs || 1440000
                })),
                true,
                null,
                `Marked ${targetEps.length} episodes as Watched`
              );
            }
          }
        ]
      },
      {
        name: 'markAsNotWatched',
        type: 'menu',
        subMenus: [
          {
            name: 'markOnlyThisOne',
            type: 'action',
            action: () =>
              this.executePlayheadUpdate(
                [{ id, playheadMs: 0 }],
                false,
                [cardElement],
                'Marked episode as Unwatched'
              )
          },
          {
            name: 'markAllNext',
            if: () => hasSeasonList && lastSeq !== episode_sequence_number,
            type: 'action',
            action: () => {
              const targetEps = episodes.filter(
                ({ sequence_number }) => sequence_number >= episode_sequence_number
              );
              return this.executePlayheadUpdate(
                targetEps.map(({ id: epId }) => ({
                  id: epId,
                  playheadMs: 0
                })),
                false,
                null,
                `Marked ${targetEps.length} episodes as Unwatched`
              );
            }
          }
        ]
      }
    ];
  }

  async executePlayheadUpdate(items, isWatched, specificCards, toastMessage) {
    if (!items || items.length === 0) return;

    // 1. Immediately update local visual state on matching cards
    const idsSet = new Set(items.map((i) => i.id));
    setLocalWatchedStatus(Array.from(idsSet), isWatched);
    items.forEach(({ id }) => {
      this.playheadsCache[id] = isWatched;
    });

    if (specificCards && specificCards.filter(Boolean).length > 0) {
      specificCards.filter(Boolean).forEach((card) => this.applyCardWatchedState(card, isWatched));
    } else {
      document.querySelectorAll('.card, [class*="playable-card"]').forEach((card) => {
        const epId = card.dataset.crEpisodeId;
        if (epId && idsSet.has(epId)) {
          this.applyCardWatchedState(card, isWatched);
        }
      });
    }

    // 2. Sync to Crunchyroll API playheads endpoint
    try {
      await CR_API.playheads(...items);
      showToast(`${isWatched ? '✓' : '✕'} ${toastMessage}`);
      this.refresh();
    } catch (err) {
      showToast(`${isWatched ? '✓' : '✕'} Saved locally (Log in to sync with Crunchyroll)`);
    }
  }

  applyCardWatchedState(card, isWatched) {
    if (!card) return;
    card.classList.toggle('cr-card-is-watched', isWatched);
    card.classList.toggle('cr-card-is-unwatched', !isWatched);

    const toggleBtn = card.querySelector('.cr-card-watch-toggle');
    if (toggleBtn) {
      toggleBtn.classList.toggle('watched', isWatched);
      toggleBtn.innerHTML = isWatched
        ? `${ICONS.checkCircle} <span>Watched</span>`
        : `${ICONS.eye} <span>Mark Watched</span>`;
      toggleBtn.title = isWatched
        ? 'Click to mark as Unwatched (Right-click for more options)'
        : 'Click to mark as Watched (Right-click for more options)';
    }
  }

  isCardCurrentlyWatched(card, episodeId) {
    // 1. Check server playhead state or explicit session update first
    if (episodeId && typeof this.playheadsCache[episodeId] === 'boolean') {
      return this.playheadsCache[episodeId];
    }

    // 2. Check Crunchyroll native DOM indicators for watched state
    const textWithoutOurBtn = Array.from(card.querySelectorAll(':not(.cr-card-watch-toggle)'))
      .map((el) => el.textContent || '')
      .join(' ');
    if (
      /\bwatched\b/i.test(textWithoutOurBtn) &&
      !/\b(unwatched|not watched|mark watched)\b/i.test(textWithoutOurBtn)
    ) {
      return true;
    }

    const progressEl = card.querySelector('[class*="progress"], [data-t*="progress"]');
    if (progressEl && progressEl.style && progressEl.style.width) {
      const widthPct = parseFloat(progressEl.style.width);
      if (widthPct >= 90) return true;
    }

    // 3. Offline / fallback local storage cache
    const localMap = getLocalWatchedMap();
    if (episodeId && typeof localMap[episodeId] === 'boolean') {
      return localMap[episodeId];
    }
    return false;
  }

  async scanEpisodeCards() {
    const cards = Array.from(
      document.querySelectorAll('.erc-season-episode-list .card, .erc-playable-collection .card, div.card')
    ).filter((card) => card.querySelector('a[href*="/watch/"]'));

    if (cards.length === 0) return;

    const uninitializedCards = cards.filter((c) => !c.dataset.crWatchInitialized);
    if (uninitializedCards.length === 0) return;

    // Mark cards as initialized immediately before awaiting async API calls to prevent duplicate listeners
    for (const card of uninitializedCards) {
      card.dataset.crWatchInitialized = 'true';
    }

    const seasonEpisodes = await this.getCurrentSeasonEpisodes();

    if (seasonEpisodes && seasonEpisodes.length > 0) {
      const uncachedIds = seasonEpisodes
        .map((ep) => ep.id)
        .filter((id) => id && typeof this.playheadsCache[id] === 'undefined');
      if (uncachedIds.length > 0) {
        try {
          const playheadsData = await CR_API.getPlayheads(uncachedIds);
          if (Array.isArray(playheadsData)) {
            playheadsData.forEach((entry) => {
              const cId = entry?.content_id;
              if (cId) {
                this.playheadsCache[cId] = Boolean(entry.fully_watched || (entry.playhead && entry.playhead > 60));
              }
            });
          }
        } catch (_) {}
      }
    }

    for (const card of uninitializedCards) {
      this.enhanceEpisodeCard(card, seasonEpisodes);
    }
  }

  async enhanceEpisodeCard(card, seasonEpisodes) {
    const resolved = await this.resolveEpisodeFromCard(card, seasonEpisodes);
    if (!resolved || !resolved.episode) return;

    const { episode, episodes } = resolved;
    card.dataset.crEpisodeId = episode.id;

    // Add release time on hover if availability_starts is present (Improve-Crunchyroll feature)
    const release = card.querySelector(`[class^="playable-card-hover__release"] span`);
    if (release && episode.availability_starts && !release.dataset.crTimeAdded) {
      release.dataset.crTimeAdded = 'true';
      try {
        release.textContent += ` - ${new Date(episode.availability_starts).toLocaleTimeString()}`;
      } catch (_) {}
    }

    const isWatched = this.isCardCurrentlyWatched(card, episode.id);
    this.applyCardWatchedState(card, isWatched);

    // 1. Inject Quick Watched/Unwatched Toggle Pill on the Card
    const thumbnailWrapper =
      card.querySelector('[class^="playable-card__thumbnail-wrapper"]') ||
      card.querySelector('[class*="thumbnail"]') ||
      card;

    if (thumbnailWrapper && !card.querySelector('.cr-card-watch-toggle')) {
      const quickBtn = document.createElement('button');
      quickBtn.type = 'button';
      quickBtn.className = `cr-card-watch-toggle ${isWatched ? 'watched' : ''}`;
      quickBtn.innerHTML = isWatched
        ? `${ICONS.checkCircle} <span>Watched</span>`
        : `${ICONS.eye} <span>Mark Watched</span>`;
      quickBtn.title = isWatched
        ? 'Click to mark as Unwatched (Right-click for batch options)'
        : 'Click to mark as Watched (Right-click for batch options)';

      quickBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nowWatched = !card.classList.contains('cr-card-is-watched');
        this.executePlayheadUpdate(
          [{ id: episode.id, playheadMs: nowWatched ? episode.duration_ms || 1440000 : 0 }],
          nowWatched,
          [card],
          nowWatched ? 'Marked episode as Watched' : 'Marked episode as Unwatched'
        );
      });

      quickBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openCardActionMenu(quickBtn, episode, episodes, card);
      });

      thumbnailWrapper.style.position = 'relative';
      thumbnailWrapper.appendChild(quickBtn);
    }

    // 2. Hijack 3-dots Options Button (Improve-Crunchyroll ActionMenu style)
    const footer = card.querySelector('[class^="playable-card__footer"]');
    if (footer && !footer.classList.contains('ic_action')) {
      const optionsButton =
        footer.querySelector('[class^="dropdown-trigger"]') ||
        footer.querySelector('button');
      if (optionsButton) {
        footer.classList.add('ic_action');
        optionsButton.addEventListener('click', (e) => {
          e.stopPropagation();
          setTimeout(() => {
            this.openCardActionMenu(optionsButton, episode, episodes, card);
          });
        });
      }
    }
  }

  openCardActionMenu(anchorEl, episode, episodes, card) {
    document.querySelectorAll('.ic_action_menu').forEach((m) => m.remove());

    const actionMenuRenderer = new ActionMenuRenderer(
      this.createMarkAsWatchedNotWatchedEntries(episode, episodes, card)
    );
    if (actionMenuRenderer.length === 0) return;

    const actionMenu = actionMenuRenderer.render();
    actionMenu.setStyle('margin-top', '24px');
    actionMenu.setStyle('right', '0');

    if (window.innerWidth - anchorEl.getBoundingClientRect().right < 300) {
      actionMenu.addClass('left');
    }

    const parent = anchorEl.parentElement || card;
    parent.style.position = 'relative';
    parent.appendChild(actionMenu.getElement());

    setTimeout(() => {
      document.documentElement.addEventListener('click', function closeHandler() {
        document.documentElement.removeEventListener('click', closeHandler);
        actionMenu.remove();
      });
    }, 10);
  }

  injectSeasonToolbar() {
    const seasonsSelect = document.querySelector('.seasons-select, .erc-seasons-select');
    if (!seasonsSelect || document.getElementById('cr-season-watch-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'cr-season-watch-toolbar';
    toolbar.className = 'cr-season-watch-toolbar';
    toolbar.innerHTML = `
      <button type="button" class="cr-season-btn watched" id="cr-mark-season-watched" title="Mark all episodes in this season as Watched">
        ${ICONS.checkCircle} <span>Mark Season Watched</span>
      </button>
      <button type="button" class="cr-season-btn unwatched" id="cr-mark-season-unwatched" title="Mark all episodes in this season as Unwatched">
        ${ICONS.eyeOff} <span>Mark Season Unwatched</span>
      </button>
    `;

    seasonsSelect.appendChild(toolbar);

    document.getElementById('cr-mark-season-watched').addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.markEntireCurrentSeason(true);
    });

    document.getElementById('cr-mark-season-unwatched').addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.markEntireCurrentSeason(false);
    });
  }

  async markEntireCurrentSeason(isWatched) {
    let episodes = await this.getCurrentSeasonEpisodes();
    if (!episodes || episodes.length === 0) {
      // Fallback: collect all episode IDs from visible cards on the page
      const cardIds = Array.from(document.querySelectorAll('[data-cr-episode-id]'))
        .map((c) => c.dataset.crEpisodeId)
        .filter(Boolean);
      if (cardIds.length === 0) {
        showToast('No episodes found on this page');
        return;
      }
      episodes = cardIds.map((id) => ({ id, duration_ms: 1440000 }));
    }

    const items = episodes.map(({ id, duration_ms }) => ({
      id,
      playheadMs: isWatched ? duration_ms || 1440000 : 0
    }));

    await this.executePlayheadUpdate(
      items,
      isWatched,
      null,
      `Marked entire season (${items.length} episodes) as ${isWatched ? 'Watched' : 'Unwatched'}`
    );
  }

  async markCurrentPlayingEpisode(isWatched, mode = 'single') {
    const watchMatch = window.location.pathname.match(/\/watch\/([A-Z0-9]+)/i);
    if (!watchMatch) {
      if (this.seriesId) {
        return this.markEntireCurrentSeason(isWatched);
      }
      showToast('Open an episode or series page to mark as Watched/Unwatched');
      return;
    }

    const currentEpId = watchMatch[1];
    const videos = getActiveVideos();
    const videoDurationMs =
      videos[0] && videos[0].duration && isFinite(videos[0].duration)
        ? Math.round(videos[0].duration * 1000)
        : 1440000;

    try {
      if (mode === 'single') {
        let durationMs = videoDurationMs;
        try {
          const objs = await CR_API.objects(currentEpId);
          if (objs?.[0]?.episode_metadata?.duration_ms) {
            durationMs = objs[0].episode_metadata.duration_ms;
          }
        } catch (_) {}

        await this.executePlayheadUpdate(
          [{ id: currentEpId, playheadMs: isWatched ? durationMs : 0 }],
          isWatched,
          null,
          `Current episode marked as ${isWatched ? 'Watched' : 'Unwatched'}`
        );
        updateWatchBarButtonState(currentEpId);
        return;
      }

      // Mode === 'previous' or 'next'
      const objs = await CR_API.objects(currentEpId);
      const epMeta = objs?.[0]?.episode_metadata;
      if (!epMeta?.season_id) {
        throw new Error('Could not resolve season for current episode');
      }
      const seasonEps = await this.getEpisodesForSeason(epMeta.season_id);
      const currentSeq = epMeta.sequence_number;

      const filtered =
        mode === 'previous'
          ? seasonEps.filter(({ sequence_number }) => sequence_number <= currentSeq)
          : seasonEps.filter(({ sequence_number }) => sequence_number >= currentSeq);

      const items = filtered.map(({ id, duration_ms }) => ({
        id,
        playheadMs: isWatched ? duration_ms || videoDurationMs : 0
      }));

      await this.executePlayheadUpdate(
        items,
        isWatched,
        null,
        `Marked ${items.length} episodes as ${isWatched ? 'Watched' : 'Unwatched'}`
      );
      updateWatchBarButtonState(currentEpId);
    } catch (err) {
      await this.executePlayheadUpdate(
        [{ id: currentEpId, playheadMs: isWatched ? videoDurationMs : 0 }],
        isWatched,
        null,
        `Current episode marked as ${isWatched ? 'Watched' : 'Unwatched'}`
      );
      updateWatchBarButtonState(currentEpId);
    }
  }

  // Improve-Crunchyroll SPA refresh method
  refresh() {
    clearTimeout(this.refreshTimeout);
    this.refreshTimeout = setTimeout(() => {
      if (!window.location.pathname.includes('/series/')) return;
      const searchA = document.querySelector('a[href$="/search"]');
      if (searchA) {
        searchA.click();
        history.back();
      } else {
        location.reload();
      }
    }, MarkAsWatchedNotWatchedController.REFRESH_TIMEOUT);
  }
}

const watchController = new MarkAsWatchedNotWatchedController();

// Custom CSS Injection for modern desktop experience + Improve-Crunchyroll Action Menu
const customStyles = `
  :root {
    --cr-bg: rgba(15, 16, 21, 0.88);
    --cr-bg-card: #191a22;
    --cr-bg-hover: rgba(255, 255, 255, 0.08);
    --cr-bg-active: rgba(255, 100, 0, 0.16);
    --cr-text: #f0f1f5;
    --cr-text-dim: #9094a6;
    --cr-border: rgba(255, 255, 255, 0.09);
    --cr-border-hover: rgba(255, 255, 255, 0.2);
    --cr-accent: #ff6400;
    --cr-accent-hover: #ff7c24;
    --cr-accent-glow: rgba(255, 100, 0, 0.35);
    --cr-green: #00e676;
    --cr-font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  }

  [data-theme="light"] {
    --cr-bg: rgba(248, 249, 252, 0.9);
    --cr-bg-card: #ffffff;
    --cr-bg-hover: rgba(0, 0, 0, 0.06);
    --cr-bg-active: rgba(255, 100, 0, 0.12);
    --cr-text: #14151a;
    --cr-text-dim: #64687a;
    --cr-border: rgba(0, 0, 0, 0.1);
    --cr-border-hover: rgba(0, 0, 0, 0.2);
    --cr-accent: #ff6400;
    --cr-accent-hover: #e55a00;
    --cr-accent-glow: rgba(255, 100, 0, 0.2);
  }

  html.ic_loading, html.ic_loading * {
    cursor: progress !important;
  }

  /* Page Layout Offset to seamlessly integrate App Bar */
  body {
    padding-top: 34px !important;
  }

  .erc-large-header > .header-content,
  .erc-large-header-shell > .header-content,
  .erc-header > .header-content,
  .erc-sticky-header-landing > .header-content {
    top: 34px !important;
    transition: top 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
  }

  body:has(#cr-app-bar.collapsed) {
    padding-top: 0 !important;
  }

  body:has(#cr-app-bar.collapsed) .erc-large-header > .header-content,
  body:has(#cr-app-bar.collapsed) .erc-large-header-shell > .header-content,
  body:has(#cr-app-bar.collapsed) .erc-header > .header-content,
  body:has(#cr-app-bar.collapsed) .erc-sticky-header-landing > .header-content,
  :fullscreen .erc-large-header > .header-content,
  :fullscreen .erc-large-header-shell > .header-content,
  :fullscreen .erc-header > .header-content,
  :fullscreen .erc-sticky-header-landing > .header-content {
    top: 0 !important;
  }

  /* Sleek Scrollbars */
  ::-webkit-scrollbar {
    width: 6px !important;
    height: 6px !important;
    background: transparent !important;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2) !important;
    border-radius: 10px !important;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 100, 0, 0.6) !important;
  }

  /* Top App Bar Glass Container - Ultra Slim & Integrated */
  #cr-app-bar {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 34px !important;
    background: var(--cr-bg) !important;
    color: var(--cr-text) !important;
    border-bottom: 1px solid var(--cr-border) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 0 12px !important;
    box-sizing: border-box !important;
    z-index: 2147483647 !important;
    font-family: var(--cr-font) !important;
    font-size: 12px !important;
    user-select: none !important;
    backdrop-filter: blur(24px) saturate(180%) !important;
    -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2) !important;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease !important;
    opacity: 1 !important;
    visibility: visible !important;
  }

  #cr-app-bar.collapsed {
    transform: translateY(-32px) !important;
  }

  /* Fullscreen View: Hide App Bar entirely */
  :fullscreen #cr-app-bar,
  :-webkit-full-screen #cr-app-bar {
    display: none !important;
  }
  :fullscreen body,
  :-webkit-full-screen body {
    padding-top: 0 !important;
  }

  /* Bar Sections */
  .cr-section {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
  }

  /* Segmented Nav Capsule (Back / Forward) */
  .cr-nav-group {
    display: inline-flex !important;
    align-items: center !important;
    background: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid var(--cr-border) !important;
    border-radius: 6px !important;
    padding: 1px !important;
    gap: 1px !important;
  }

  .cr-nav-group-btn {
    background: transparent !important;
    border: none !important;
    color: var(--cr-text) !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 3px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    transition: all 0.15s ease !important;
  }

  .cr-nav-group-btn:hover:not(:disabled) {
    background: var(--cr-bg-hover) !important;
    color: var(--cr-accent) !important;
  }

  .cr-nav-group-btn:active:not(:disabled) {
    transform: scale(0.95) !important;
  }

  .cr-nav-group-btn:disabled {
    opacity: 0.25 !important;
    cursor: not-allowed !important;
  }

  .cr-nav-divider {
    width: 1px !important;
    height: 12px !important;
    background: var(--cr-border) !important;
    margin: 0 1px !important;
  }

  /* Single Action Buttons */
  .cr-icon-btn {
    background: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid var(--cr-border) !important;
    color: var(--cr-text) !important;
    padding: 3px 7px !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 4px !important;
    font-size: 11.5px !important;
    font-weight: 500 !important;
    transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
  }

  .cr-icon-btn:hover {
    background: var(--cr-bg-hover) !important;
    border-color: var(--cr-border-hover) !important;
    color: #ffffff !important;
    transform: translateY(-1px) !important;
  }

  .cr-icon-btn:active {
    transform: scale(0.96) !important;
  }

  /* Discovery Quick Pills */
  .cr-tab-link {
    background: transparent !important;
    border: 1px solid transparent !important;
    color: var(--cr-text-dim) !important;
    padding: 3px 8px !important;
    border-radius: 14px !important;
    font-size: 11.5px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    transition: all 0.15s ease !important;
  }

  .cr-tab-link:hover {
    color: var(--cr-text) !important;
    background: rgba(255, 255, 255, 0.06) !important;
  }

  /* Status Badges */
  .cr-badge-btn {
    background: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid var(--cr-border) !important;
    color: var(--cr-text) !important;
    padding: 3px 8px !important;
    border-radius: 14px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    transition: all 0.18s ease !important;
  }

  .cr-badge-btn:hover {
    border-color: var(--cr-border-hover) !important;
    background: var(--cr-bg-hover) !important;
  }

  .cr-badge-btn.active {
    background: var(--cr-bg-active) !important;
    border-color: rgba(255, 100, 0, 0.4) !important;
    color: var(--cr-accent) !important;
  }

  .cr-badge-btn.watched-active {
    background: rgba(0, 230, 118, 0.14) !important;
    border-color: rgba(0, 230, 118, 0.45) !important;
    color: #00e676 !important;
  }

  .cr-dot {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    background: var(--cr-text-dim) !important;
    transition: background 0.2s ease, box-shadow 0.2s ease !important;
  }

  .cr-badge-btn.active .cr-dot {
    background: #00e676 !important;
    box-shadow: 0 0 8px #00e676 !important;
  }

  /* Collapse Handle */
  .cr-collapse-handle {
    position: absolute !important;
    bottom: -16px !important;
    right: 32px !important;
    background: var(--cr-bg) !important;
    border: 1px solid var(--cr-border) !important;
    border-top: none !important;
    border-radius: 0 0 8px 8px !important;
    padding: 1px 10px !important;
    cursor: pointer !important;
    color: var(--cr-text-dim) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    backdrop-filter: blur(20px) !important;
    transition: color 0.15s ease, background 0.15s ease !important;
    z-index: 2147483647 !important;
  }

  .cr-collapse-handle:hover {
    color: var(--cr-accent) !important;
    background: var(--cr-bg-card) !important;
  }

  /* Improve-Crunchyroll Action Menu Styles */
  div[class^='playable-card__footer'].ic_action div[class^='dropdown-content'] {
    display: none !important;
  }

  .ic_action_menu {
    --background: #191a22;
    --hover-background: rgba(255, 100, 0, 0.16);
    --primary-font: #f0f1f5;
    --secondary-font: #ff6400;
    position: absolute;
    z-index: 99999;
    padding: 0.5rem 0;
    background-color: var(--background);
    color: var(--primary-font);
    display: flex;
    flex-direction: column;
    top: 0;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.5rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    min-width: 185px;
    font-family: var(--cr-font);
  }

  .ic_action_menu > div:not(:hover) > .ic_action_menu {
    display: none;
  }

  .ic_action_menu > div > .ic_action_menu {
    position: absolute;
    display: flex;
    flex-direction: column;
    top: -0.5rem;
    left: 100%;
    width: max-content;
  }

  .ic_action_menu.left .ic_action_menu {
    right: 100%;
    left: unset;
  }

  .ic_action_menu > div {
    position: relative;
    align-items: center;
    padding: 0.6rem 1.25rem;
    display: flex;
    cursor: pointer;
    transition: color 0.15s ease, background-color 0.15s ease;
    white-space: nowrap;
  }

  .ic_action_menu > div:hover {
    background-color: var(--hover-background);
    color: var(--secondary-font);
  }

  .ic_action_menu:not(.left) .ic_action_menu_parent::after,
  .ic_action_menu.left .ic_action_menu_parent::before {
    content: '';
    height: 24px;
    width: 16px;
    position: absolute;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 226 226' fill='%23AAAAAA'%3E%3Cpath d='M75.33333,37.66667v150.66667l75.33333,-75.33333z'%3E%3C/path%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
  }

  .ic_action_menu:not(.left) .ic_action_menu_parent::after {
    right: 6px;
  }

  .ic_action_menu.left .ic_action_menu_parent::before {
    left: 6px;
    transform: scaleX(-1);
  }

  /* Quick Watched/Unwatched Toggle Pill on Episode Cards */
  .cr-card-watch-toggle {
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;
    z-index: 25 !important;
    background: rgba(15, 16, 21, 0.86) !important;
    color: #e4e6ef !important;
    border: 1px solid rgba(255, 255, 255, 0.18) !important;
    border-radius: 14px !important;
    padding: 3px 9px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    font-family: var(--cr-font) !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    cursor: pointer !important;
    backdrop-filter: blur(10px) !important;
    transition: all 0.18s ease !important;
    opacity: 0.92 !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5) !important;
  }

  .cr-card-watch-toggle:hover {
    opacity: 1 !important;
    transform: scale(1.04) !important;
    border-color: var(--cr-accent) !important;
    background: rgba(25, 26, 34, 0.96) !important;
  }

  .cr-card-watch-toggle.watched {
    background: rgba(0, 200, 95, 0.22) !important;
    border-color: rgba(0, 230, 118, 0.65) !important;
    color: #00e676 !important;
  }

  .cr-card-is-watched [class^="playable-card__thumbnail-wrapper"] img {
    opacity: 0.68 !important;
    transition: opacity 0.2s ease !important;
  }

  /* Season-level Watched/Unwatched Toolbar */
  .cr-season-watch-toolbar {
    display: inline-flex !important;
    align-items: center !important;
    gap: 8px !important;
    margin-left: 12px !important;
    vertical-align: middle !important;
  }

  .cr-season-btn {
    background: rgba(25, 26, 34, 0.85) !important;
    color: var(--cr-text) !important;
    border: 1px solid var(--cr-border-hover) !important;
    border-radius: 8px !important;
    padding: 6px 12px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    font-family: var(--cr-font) !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    cursor: pointer !important;
    transition: all 0.18s ease !important;
  }

  .cr-season-btn.watched:hover {
    background: rgba(0, 230, 118, 0.15) !important;
    border-color: #00e676 !important;
    color: #00e676 !important;
  }

  .cr-season-btn.unwatched:hover {
    background: rgba(255, 100, 0, 0.15) !important;
    border-color: var(--cr-accent) !important;
    color: var(--cr-accent) !important;
  }

  /* Top Bar Watch Status Dropdown Popover */
  #cr-watch-popover {
    position: fixed !important;
    top: 38px !important;
    right: 140px !important;
    background: var(--cr-bg-card) !important;
    color: var(--cr-text) !important;
    border: 1px solid var(--cr-border-hover) !important;
    border-radius: 12px !important;
    padding: 6px !important;
    min-width: 250px !important;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8) !important;
    z-index: 2147483647 !important;
    font-family: var(--cr-font) !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 2px !important;
  }

  .cr-popover-item {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 10px !important;
    padding: 8px 12px !important;
    border-radius: 8px !important;
    font-size: 12.5px !important;
    font-weight: 500 !important;
    color: var(--cr-text) !important;
    background: transparent !important;
    border: none !important;
    cursor: pointer !important;
    text-align: left !important;
    width: 100% !important;
    transition: background 0.15s ease, color 0.15s ease !important;
  }

  .cr-popover-item:hover {
    background: var(--cr-bg-hover) !important;
    color: var(--cr-accent) !important;
  }

  .cr-popover-divider {
    height: 1px !important;
    background: var(--cr-border) !important;
    margin: 4px 6px !important;
  }

  /* Command Palette Modal */
  #cr-command-palette {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: rgba(0, 0, 0, 0.75) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: flex-start !important;
    justify-content: center !important;
    padding-top: 14vh !important;
    font-family: var(--cr-font) !important;
  }

  .cr-palette-card {
    background: var(--cr-bg-card) !important;
    color: var(--cr-text) !important;
    border: 1px solid var(--cr-border) !important;
    border-radius: 16px !important;
    width: 90% !important;
    max-width: 580px !important;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
    overflow: hidden !important;
  }

  .cr-palette-input-box {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    padding: 16px 20px !important;
    border-bottom: 1px solid var(--cr-border) !important;
  }

  .cr-palette-input {
    flex: 1 !important;
    background: transparent !important;
    border: none !important;
    outline: none !important;
    font-size: 16px !important;
    font-weight: 500 !important;
    color: #ffffff !important;
    font-family: var(--cr-font) !important;
  }

  .cr-palette-list {
    max-height: 360px !important;
    overflow-y: auto !important;
    padding: 8px !important;
  }

  .cr-palette-item {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 10px 14px !important;
    border-radius: 10px !important;
    cursor: pointer !important;
    font-size: 13.5px !important;
    color: var(--cr-text) !important;
    transition: all 0.12s ease !important;
  }

  .cr-palette-item:hover, .cr-palette-item.selected {
    background: var(--cr-bg-hover) !important;
    color: var(--cr-accent) !important;
  }

  .cr-shortcut-tag {
    background: rgba(255, 255, 255, 0.08) !important;
    padding: 2px 7px !important;
    border-radius: 6px !important;
    border: 1px solid var(--cr-border) !important;
    font-family: monospace !important;
    font-size: 11px !important;
    color: var(--cr-accent) !important;
    font-weight: 600 !important;
  }
`;

// Initialize Theme
function applyTheme(isDark) {
  currentTheme = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  const themeBtn = document.getElementById('cr-theme-btn');
  if (themeBtn) {
    themeBtn.innerHTML = `${isDark ? ICONS.moon : ICONS.sun}`;
  }
}

// IPC theme info
ipcRenderer
  .invoke('get-theme-info')
  .then((info) => {
    if (info) applyTheme(info.shouldUseDarkColors);
  })
  .catch(() => {});

ipcRenderer.on('theme-changed', (event, info) => {
  if (info) applyTheme(info.shouldUseDarkColors);
});

ipcRenderer.on('open-preferences', () => {
  openCommandPalette();
});

ipcRenderer.on('mark-current-watched', () => {
  watchController.markCurrentPlayingEpisode(true, 'single');
});

ipcRenderer.on('mark-current-unwatched', () => {
  watchController.markCurrentPlayingEpisode(false, 'single');
});

// Update navigation buttons status
function updateNavButtons(state) {
  if (!state) return;
  navState = state;
  const backBtn = document.getElementById('cr-nav-back');
  const forwardBtn = document.getElementById('cr-nav-forward');
  if (backBtn && typeof state.canGoBack === 'boolean') {
    backBtn.disabled = !state.canGoBack;
  }
  if (forwardBtn && typeof state.canGoForward === 'boolean') {
    forwardBtn.disabled = !state.canGoForward;
  }
}

ipcRenderer.on('nav-state-changed', (event, state) => {
  if (state) updateNavButtons(state);
});

// Apply Shader to Video
function applyShader(shaderKey) {
  const shader = SHADERS[shaderKey] || SHADERS.default;
  currentShader = shaderKey;
  localStorage.setItem('cr_anime_shader', shaderKey);

  const videos = getActiveVideos();
  videos.forEach((v) => {
    v.style.filter = shader.filter;
  });

  const shaderText = document.getElementById('cr-shader-text');
  if (shaderText) shaderText.textContent = shader.name;
  showToast(`Shader: ${shader.name}`);
}

// Inject styles
function injectStyles() {
  if (document.getElementById('cr-custom-styles')) return;
  const styleEl = document.createElement('style');
  styleEl.id = 'cr-custom-styles';
  styleEl.textContent = customStyles;
  const target = document.head || document.documentElement;
  if (target) target.appendChild(styleEl);
}

// Update Watch Status Button in Top Bar
function updateWatchBarButtonState(explicitEpId) {
  const btn = document.getElementById('cr-watch-status-btn');
  if (!btn) return;
  const match = window.location.pathname.match(/\/watch\/([A-Z0-9]+)/i);
  const epId = explicitEpId || (match ? match[1] : null);
  const map = getLocalWatchedMap();
  const isWatched = epId && map[epId] === true;

  btn.classList.toggle('watched-active', Boolean(isWatched));
  const label = btn.querySelector('#cr-watch-status-text');
  if (label) {
    label.textContent = isWatched ? 'Watched ✓' : 'Watch Status';
  }
}

// Toggle Top Bar Watch Status Popover Menu
function toggleWatchStatusPopover() {
  const existing = document.getElementById('cr-watch-popover');
  if (existing) {
    existing.remove();
    return;
  }

  const popover = document.createElement('div');
  popover.id = 'cr-watch-popover';
  popover.innerHTML = `
    <button type="button" class="cr-popover-item" data-watch-action="mark-watched">
      <span>✓ Mark Episode as Watched</span>
      <span class="cr-shortcut-tag">W</span>
    </button>
    <button type="button" class="cr-popover-item" data-watch-action="mark-unwatched">
      <span>✕ Mark Episode as Unwatched</span>
      <span class="cr-shortcut-tag">Shift+W</span>
    </button>
    <div class="cr-popover-divider"></div>
    <button type="button" class="cr-popover-item" data-watch-action="mark-prev-watched">
      <span>✓✓ Mark This & All Previous Watched</span>
    </button>
    <button type="button" class="cr-popover-item" data-watch-action="mark-next-unwatched">
      <span>✕✕ Mark This & All Next Unwatched</span>
    </button>
    <div class="cr-popover-divider"></div>
    <button type="button" class="cr-popover-item" data-watch-action="mark-season-watched">
      <span>📺 Mark Entire Season Watched</span>
    </button>
    <button type="button" class="cr-popover-item" data-watch-action="mark-season-unwatched">
      <span>📺 Mark Entire Season Unwatched</span>
    </button>
  `;

  document.body.appendChild(popover);

  popover.querySelectorAll('.cr-popover-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const act = item.dataset.watchAction;
      popover.remove();
      if (act === 'mark-watched') watchController.markCurrentPlayingEpisode(true, 'single');
      if (act === 'mark-unwatched') watchController.markCurrentPlayingEpisode(false, 'single');
      if (act === 'mark-prev-watched') watchController.markCurrentPlayingEpisode(true, 'previous');
      if (act === 'mark-next-unwatched') watchController.markCurrentPlayingEpisode(false, 'next');
      if (act === 'mark-season-watched') watchController.markEntireCurrentSeason(true);
      if (act === 'mark-season-unwatched') watchController.markEntireCurrentSeason(false);
    });
  });

  setTimeout(() => {
    document.addEventListener(
      'click',
      function onDocClick(ev) {
        if (!popover.contains(ev.target)) {
          popover.remove();
          document.removeEventListener('click', onDocClick);
        }
      },
      { once: true }
    );
  }, 10);
}

// Open Spotlight Command Palette (Ctrl+K)
function openCommandPalette() {
  if (document.getElementById('cr-command-palette')) return;

  const palette = document.createElement('div');
  palette.id = 'cr-command-palette';
  palette.innerHTML = `
    <div class="cr-palette-card">
      <div class="cr-palette-input-box">
        ${ICONS.search}
        <input type="text" class="cr-palette-input" id="cr-search-input" placeholder="Search anime, episodes, or quick actions..." autofocus autocomplete="off" />
        <span class="cr-shortcut-tag">ESC</span>
      </div>
      <div class="cr-palette-list" id="cr-palette-results">
        <div class="cr-palette-item" data-action="mark-watched">
          <span>✅ Mark Current Episode as Watched</span>
          <span class="cr-shortcut-tag">W</span>
        </div>
        <div class="cr-palette-item" data-action="mark-unwatched">
          <span>👁️‍🗨️ Mark Current Episode as Unwatched</span>
          <span class="cr-shortcut-tag">Shift+W</span>
        </div>
        <div class="cr-palette-item" data-action="mark-prev-watched">
          <span>✅ Mark Current & All Previous Episodes as Watched</span>
          <span class="cr-shortcut-tag">Batch</span>
        </div>
        <div class="cr-palette-item" data-action="mark-next-unwatched">
          <span>🔄 Mark Current & All Next Episodes as Unwatched</span>
          <span class="cr-shortcut-tag">Batch</span>
        </div>
        <div class="cr-palette-item" data-action="explore">
          <span>🍿 Explore Popular Anime</span>
          <span class="cr-shortcut-tag">Jump</span>
        </div>
        <div class="cr-palette-item" data-action="simulcasts">
          <span>📅 Seasonal Simulcasts</span>
          <span class="cr-shortcut-tag">Jump</span>
        </div>
        <div class="cr-palette-item" data-action="watchlist">
          <span>🔖 My Watchlist</span>
          <span class="cr-shortcut-tag">Jump</span>
        </div>
        <div class="cr-palette-item" data-action="pip">
          <span>📺 Toggle Picture-in-Picture</span>
          <span class="cr-shortcut-tag">P</span>
        </div>
        <div class="cr-palette-item" data-action="shader">
          <span>🎨 Cycle Anime Shader Preset</span>
          <span class="cr-shortcut-tag">Shader</span>
        </div>
        <div class="cr-palette-item" data-action="skip">
          <span>⚡ Toggle Auto-Skip Intro & Recap</span>
          <span class="cr-shortcut-tag">${autoSkipEnabled ? 'ON' : 'OFF'}</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(palette);
  const input = document.getElementById('cr-search-input');
  input.focus();

  const closePalette = () => palette.remove();

  palette.addEventListener('click', (e) => {
    if (e.target === palette) closePalette();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePalette();
    } else if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) {
        closePalette();
        ipcRenderer.send('nav-url', `https://www.crunchyroll.com/search?q=${encodeURIComponent(q)}`);
      }
    }
  });

  // Action clicks
  palette.querySelectorAll('.cr-palette-item').forEach((item) => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      closePalette();
      if (action === 'mark-watched') watchController.markCurrentPlayingEpisode(true, 'single');
      if (action === 'mark-unwatched') watchController.markCurrentPlayingEpisode(false, 'single');
      if (action === 'mark-prev-watched') watchController.markCurrentPlayingEpisode(true, 'previous');
      if (action === 'mark-next-unwatched') watchController.markCurrentPlayingEpisode(false, 'next');
      if (action === 'explore') ipcRenderer.send('nav-url', 'https://www.crunchyroll.com/videos/popular');
      if (action === 'simulcasts') ipcRenderer.send('nav-url', 'https://www.crunchyroll.com/simulcasts');
      if (action === 'watchlist') ipcRenderer.send('nav-url', 'https://www.crunchyroll.com/watchlist');
      if (action === 'pip') triggerPictureInPicture();
      if (action === 'shader') cycleShader();
      if (action === 'skip') {
        setAutoSkipEnabled(!autoSkipEnabled);
      }
    });
  });
}

function cycleShader() {
  const keys = Object.keys(SHADERS);
  let idx = keys.indexOf(currentShader) + 1;
  if (idx >= keys.length) idx = 0;
  applyShader(keys[idx]);
}

// Create and Inject the App Bar
function createAppBar() {
  if (!document.body) return;

  let bar = document.getElementById('cr-app-bar');
  if (bar) {
    if (bar.parentElement !== document.body) {
      document.body.appendChild(bar);
    }
    return;
  }

  bar = document.createElement('div');
  bar.id = 'cr-app-bar';
  bar.innerHTML = `
    <!-- Left Navigation: Segmented Back/Forward, Reload, Home -->
    <div class="cr-section">
      <div class="cr-nav-group">
        <button class="cr-nav-group-btn" id="cr-nav-back" title="Back (Alt+Left)">
          ${ICONS.back} <span>Back</span>
        </button>
        <div class="cr-nav-divider"></div>
        <button class="cr-nav-group-btn" id="cr-nav-forward" title="Forward (Alt+Right)">
          <span>Forward</span> ${ICONS.forward}
        </button>
      </div>

      <button class="cr-icon-btn" id="cr-nav-reload" title="Refresh (Ctrl+R)">
        ${ICONS.reload}
      </button>

      <button class="cr-icon-btn" id="cr-nav-home" title="Crunchyroll Home">
        ${ICONS.home}
      </button>

      <button class="cr-icon-btn" id="cr-spotlight-btn" title="Command Palette & Search (Ctrl+K)">
        ${ICONS.search} <span style="font-size:11px;opacity:0.8;">Ctrl+K</span>
      </button>
    </div>

    <!-- Center Quick Navigation Tabs -->
    <div class="cr-section">
      <button class="cr-tab-link" id="cr-quick-browse">
        ${ICONS.explore} <span>Explore</span>
      </button>
      <button class="cr-tab-link" id="cr-quick-simulcasts">
        ${ICONS.simulcast} <span>Simulcasts</span>
      </button>
      <button class="cr-tab-link" id="cr-quick-watchlist">
        ${ICONS.watchlist} <span>Watchlist</span>
      </button>
    </div>

    <!-- Right Controls: Watched/Unwatched, Auto-Skip, Shaders, Speed, PiP, Theme -->
    <div class="cr-section">
      <button class="cr-badge-btn" id="cr-watch-status-btn" title="Mark Episode/Season Watched or Unwatched (W / Shift+W)">
        ${ICONS.checkCircle}
        <span id="cr-watch-status-text">Watch Status</span>
      </button>

      <button class="cr-badge-btn ${autoSkipEnabled ? 'active' : ''}" id="cr-auto-skip-btn" title="Toggle Auto-Skip Intro/Recap">
        <span class="cr-dot"></span>
        <span>${autoSkipEnabled ? 'Skip: ON' : 'Skip: OFF'}</span>
      </button>

      <button class="cr-icon-btn" id="cr-shader-btn" title="Anime Video Shaders">
        ${ICONS.palette} <span id="cr-shader-text">${SHADERS[currentShader] ? SHADERS[currentShader].name : 'Shaders'}</span>
      </button>

      <button class="cr-icon-btn" id="cr-speed-btn" title="Cycle Playback Speed">
        ${ICONS.speed} <span id="cr-speed-text">1.0x</span>
      </button>

      <button class="cr-icon-btn" id="cr-pip-btn" title="Picture-in-Picture (P)">
        ${ICONS.pip}
      </button>

      <button class="cr-icon-btn" id="cr-theme-btn" title="Toggle Theme">
        ${currentTheme === 'dark' ? ICONS.moon : ICONS.sun}
      </button>
    </div>

    <!-- Collapse / Expand Pill -->
    <div class="cr-collapse-handle" id="cr-collapse-btn" title="Toggle Toolbar">
      ${ICONS.chevronUp}
    </div>
  `;

  document.body.appendChild(bar);

  // Initial nav check
  ipcRenderer
    .invoke('get-nav-state')
    .then((state) => {
      if (state) updateNavButtons(state);
    })
    .catch(() => {});

  // Hook Spotlight Button
  document.getElementById('cr-spotlight-btn').addEventListener('click', openCommandPalette);

  // Hook Navigation
  document.getElementById('cr-nav-back').addEventListener('click', () => ipcRenderer.send('nav-back'));
  document.getElementById('cr-nav-forward').addEventListener('click', () => ipcRenderer.send('nav-forward'));
  document.getElementById('cr-nav-reload').addEventListener('click', () => ipcRenderer.send('nav-reload'));
  document.getElementById('cr-nav-home').addEventListener('click', () => ipcRenderer.send('nav-home'));

  // Hook Quick Tabs
  document.getElementById('cr-quick-browse').addEventListener('click', () => {
    ipcRenderer.send('nav-url', 'https://www.crunchyroll.com/videos/popular');
  });
  document.getElementById('cr-quick-simulcasts').addEventListener('click', () => {
    ipcRenderer.send('nav-url', 'https://www.crunchyroll.com/simulcasts');
  });
  document.getElementById('cr-quick-watchlist').addEventListener('click', () => {
    ipcRenderer.send('nav-url', 'https://www.crunchyroll.com/watchlist');
  });

  // Hook Watch Status Popover Button
  document.getElementById('cr-watch-status-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleWatchStatusPopover();
  });

  // Hook Auto-Skip
  const autoSkipBtn = document.getElementById('cr-auto-skip-btn');
  autoSkipBtn.addEventListener('click', () => {
    setAutoSkipEnabled(!autoSkipEnabled);
  });

  // Hook Shader Cycle
  document.getElementById('cr-shader-btn').addEventListener('click', cycleShader);

  // Hook Speed
  const speedBtn = document.getElementById('cr-speed-btn');
  speedBtn.addEventListener('click', () => {
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    const current = window.__crPlaybackRate || 1.0;
    let nextIdx = speeds.indexOf(current) + 1;
    if (nextIdx >= speeds.length || nextIdx === 0) nextIdx = 0;
    const nextRate = speeds[nextIdx];
    window.__crPlaybackRate = nextRate;
    getActiveVideos().forEach((v) => {
      v.playbackRate = nextRate;
      v.defaultPlaybackRate = nextRate;
    });
    document.getElementById('cr-speed-text').textContent = `${nextRate}x`;
    showToast(`Speed: ${nextRate}x`);
  });

  // Hook PiP
  document.getElementById('cr-pip-btn').addEventListener('click', triggerPictureInPicture);

  // Hook Theme Toggle
  document.getElementById('cr-theme-btn').addEventListener('click', () => {
    applyTheme(currentTheme !== 'dark');
  });

  // Toggle Collapse
  const collapseBtn = document.getElementById('cr-collapse-btn');
  collapseBtn.addEventListener('click', () => {
    isAppBarCollapsed = !isAppBarCollapsed;
    bar.classList.toggle('collapsed', isAppBarCollapsed);
    collapseBtn.innerHTML = isAppBarCollapsed ? ICONS.chevronDown : ICONS.chevronUp;
  });

  updateNavButtons(navState);
  updateWatchBarButtonState();
}

// Continuous DOM Guardian (Top-frame only)
const isTopFrame = window === window.top;

function ensureAppBar() {
  if (!isTopFrame) return;
  injectStyles();
  if (!document.body) return;

  let bar = document.getElementById('cr-app-bar');
  if (!bar) {
    createAppBar();
  } else if (bar.parentElement !== document.body) {
    document.body.appendChild(bar);
  }
}

// Sleek Toast Indicator
function showToast(text) {
  let toast = document.getElementById('cr-toast-indicator');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cr-toast-indicator';
    toast.style.cssText = `
      position: fixed !important;
      top: 54px !important;
      right: 24px !important;
      background: rgba(20, 22, 28, 0.94) !important;
      color: #ffffff !important;
      padding: 8px 16px !important;
      border-radius: 10px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      border: 1px solid rgba(255, 100, 0, 0.5) !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 12px rgba(255, 100, 0, 0.2) !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      transition: opacity 0.25s ease, transform 0.25s ease !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      backdrop-filter: blur(16px) !important;
    `;
    if (document.body) document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(window.__crToastTimeout);
  window.__crToastTimeout = setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-4px)';
    }
  }, 1600);
}

// Video elements query (Optimized, non-blocking)
function getActiveVideos() {
  try {
    const directVideos = Array.from(document.querySelectorAll('video'));
    if (directVideos.length > 0) {
      directVideos.forEach((v) => {
        try {
          v.disablePictureInPicture = false;
          v.removeAttribute('disablepictureinpicture');
          if (SHADERS[currentShader]) v.style.filter = SHADERS[currentShader].filter;
        } catch (e) {}
      });
      directVideos.sort((a, b) => (!b.paused ? 1 : 0) - (!a.paused ? 1 : 0));
      return directVideos;
    }

    // Check shadow DOM on common player containers only
    const playerContainers = document.querySelectorAll(
      '[class*="video-player"], [class*="player"], [id*="player"]'
    );
    for (let i = 0; i < playerContainers.length; i++) {
      const el = playerContainers[i];
      if (el.shadowRoot) {
        const shadowVideos = Array.from(el.shadowRoot.querySelectorAll('video'));
        if (shadowVideos.length > 0) {
          shadowVideos.forEach((v) => {
            try {
              v.disablePictureInPicture = false;
              v.removeAttribute('disablepictureinpicture');
              if (SHADERS[currentShader]) v.style.filter = SHADERS[currentShader].filter;
            } catch (e) {}
          });
          return shadowVideos;
        }
      }
    }
  } catch (e) {}
  return [];
}

// Attach playback rate and state listeners to video
function attachVideoListeners(video) {
  if (!video || video.__crAttached) return;
  video.__crAttached = true;

  if (window.__crPlaybackRate) {
    video.playbackRate = window.__crPlaybackRate;
    video.defaultPlaybackRate = window.__crPlaybackRate;
  }
  if (SHADERS[currentShader]) {
    video.style.filter = SHADERS[currentShader].filter;
  }

  const notifyState = () => {
    const isPlaying = !video.paused && !video.ended;
    if (video.__lastPlayingState !== isPlaying) {
      video.__lastPlayingState = isPlaying;
      try {
        ipcRenderer.send('playback-state-change', isPlaying);
      } catch (e) {}
    }

    // Discord RPC & Media Session Sync
    syncMediaSessionAndRPC(video);
  };

  video.addEventListener('play', notifyState);
  video.addEventListener('playing', notifyState);
  video.addEventListener('pause', notifyState);
  video.addEventListener('ended', notifyState);
  video.addEventListener('timeupdate', () => {
    notifyState();
    checkAndAutoSkip();
  });

  notifyState();
}

// Extract Anime Info & Sync with Discord RPC & Media Session
let lastRpcUpdate = 0;
function syncMediaSessionAndRPC(video) {
  const now = Date.now();
  if (now - lastRpcUpdate < 4000) return; // Throttle updates
  lastRpcUpdate = now;

  let title = '';
  let show = '';

  const titleEl = document.querySelector('[data-t="episode-title"], .episode-title, h1[class*="title"]');
  const showEl = document.querySelector('[data-t="show-title"], .show-title, a[class*="show-title"]');

  if (titleEl) title = (titleEl.innerText || '').trim();
  if (showEl) show = (showEl.innerText || '').trim();

  if (!title) {
    const docTitle = document.title || '';
    title = docTitle
      .replace(' - Watch on Crunchyroll', '')
      .replace('Watch on Crunchyroll', '')
      .trim();
  }

  const isPlaying = video ? !video.paused && !video.ended : false;
  const currentTime = video ? video.currentTime : 0;
  const duration = video ? video.duration : 0;

  // Sync with OS MediaSession (KDE Plasma / GNOME / Windows / macOS media widget)
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || 'Crunchyroll Anime',
      artist: show || 'Crunchyroll',
      album: show || 'Crunchyroll Anime',
      artwork: [
        {
          src: 'https://www.crunchyroll.com/build/assets/img/favicons/favicon-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => {
      if (video) video.play();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (video) video.pause();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (video && details.seekTime) video.currentTime = details.seekTime;
    });
  }

  // Send update to Discord RPC in main process
  ipcRenderer.send('update-discord-rpc', {
    details: show ? `${show}` : 'Watching Anime',
    state: title ? `${title}` : 'Crunchyroll Desktop',
    isPlaying,
    currentTime,
    duration,
    watchUrl: window.location.href
  });
}

// Cache of skip-events intervals per episode ID from https://static.crunchyroll.com/skip-events/production/<ID>.json
const skipEventsCache = {};
let lastAutoSkipTime = 0;

function ensureEpisodeSkipEvents(epId) {
  if (!epId) return Promise.resolve([]);
  if (skipEventsCache[epId]) return skipEventsCache[epId];

  skipEventsCache[epId] = fetch(`https://static.crunchyroll.com/skip-events/production/${epId}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || typeof data !== 'object') return [];
      const segments = [];
      for (const [key, val] of Object.entries(data)) {
        if (
          val &&
          typeof val === 'object' &&
          typeof val.start === 'number' &&
          typeof val.end === 'number' &&
          val.end > val.start
        ) {
          segments.push({
            type: val.type || key,
            start: val.start,
            end: val.end
          });
        }
      }
      return segments.sort((a, b) => a.start - b.start);
    })
    .catch(() => []);

  return skipEventsCache[epId];
}

function findNextEpisodeButton() {
  const katamariIcon = document.querySelector('[data-testid="next-episode-icon"]');
  if (katamariIcon) {
    const btn = katamariIcon.closest('button, a, [role="button"]');
    if (btn) return btn;
  }
  return document.querySelector(
    'button[aria-label="Next Episode"], [data-t="next-episode-btn"], [data-t="play-next-btn"], .next-episode-btn, button[class*="next-episode"]'
  );
}

// Auto-Skip Intro, Recap, & Auto-Next Episode (Katamari DOM Button + Direct Skip-Events Timestamp Seek)
function checkAndAutoSkip() {
  try {
    const now = Date.now();
    const videos = getActiveVideos();
    const video = videos[0];

    // 1. Skip Intro / Recap / Promo / Bumper / Credits
    if (autoSkipEnabled && now - lastAutoSkipTime > 2500) {
      // A) Check Crunchyroll Katamari player skip button ([data-testid="skip-intro-icon"] inside button)
      const katamariSkipIcon = document.querySelector('[data-testid="skip-intro-icon"]');
      const katamariSkipBtn = katamariSkipIcon ? katamariSkipIcon.closest('button') : null;
      if (
        katamariSkipBtn &&
        !katamariSkipBtn.disabled &&
        katamariSkipBtn.getAttribute('aria-hidden') !== 'true' &&
        !katamariSkipBtn.className.includes('opacity-0')
      ) {
        const label =
          katamariSkipBtn.getAttribute('aria-label') ||
          (katamariSkipBtn.innerText || '').trim() ||
          'Intro';
        lastAutoSkipTime = now;
        katamariSkipBtn.click();
        showToast(`⚡ Auto-Skipped: ${label}`);
        return;
      }

      // B) Check legacy Vilos / testid skip buttons
      const legacySkipBtn = document.querySelector(
        '[data-t="skip-intro-btn"], [data-t="skip-recap-btn"], [data-t="skip-button"], ' +
          '[data-testid="skipButton"], [data-testid="skip-intro-button"], ' +
          '.vjs-skip-intro, .vjs-skip-recap'
      );
      if (
        legacySkipBtn &&
        legacySkipBtn.offsetParent !== null &&
        !legacySkipBtn.disabled &&
        legacySkipBtn.getAttribute('aria-hidden') !== 'true'
      ) {
        lastAutoSkipTime = now;
        legacySkipBtn.click();
        showToast('⚡ Auto-Skipped Intro/Recap');
        return;
      }

      // C) Direct timestamp skip via Crunchyroll's skip-events API (works even when player UI is auto-hidden)
      const match = window.location.pathname.match(/\/watch\/([A-Z0-9]+)/i);
      const epId = match ? match[1] : null;
      if (epId && video && !video.paused && video.currentTime > 0) {
        ensureEpisodeSkipEvents(epId).then((segments) => {
          if (!autoSkipEnabled || !segments || segments.length === 0) return;
          if (Date.now() - lastAutoSkipTime <= 2500) return;
          const ct = video.currentTime;
          const activeSeg = segments.find(
            (s) => ct >= s.start && ct < s.end - 1.5
          );
          if (activeSeg) {
            lastAutoSkipTime = Date.now();
            video.currentTime = activeSeg.end;
            const segLabel =
              activeSeg.type.charAt(0).toUpperCase() + activeSeg.type.slice(1);
            showToast(`⚡ Auto-Skipped ${segLabel}`);
          }
        });
      }
    }

    // 2. Smart Auto-Next Episode (only when active video has ended or is within the last 5 seconds)
    if (autoNextEnabled && video) {
      const isAtEndOfEpisode =
        video.ended || (video.duration > 60 && video.currentTime >= video.duration - 5);

      if (isAtEndOfEpisode && now - lastAutoSkipTime > 4000) {
        const nextBtn = findNextEpisodeButton();
        if (nextBtn && nextBtn.offsetParent !== null && !nextBtn.disabled) {
          lastAutoSkipTime = now;
          nextBtn.click();
          showToast('Auto-Playing Next Episode...');
          return;
        }
      }
    }
  } catch (e) {}
}

// Robust Picture-in-Picture trigger (Native PiP + Floating Mini-Player Fallback)
async function triggerPictureInPicture() {
  const videos = getActiveVideos();
  const video = videos.find((v) => !v.paused) || videos[0];

  if (document.pictureInPictureElement) {
    try {
      await document.exitPictureInPicture();
      showToast('PiP: Off');
      return;
    } catch (e) {}
  }

  if (video) {
    try {
      video.disablePictureInPicture = false;
      video.removeAttribute('disablepictureinpicture');
      if (typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture();
        showToast('Picture-in-Picture: ON');
        return;
      }
    } catch (err) {
      console.warn('Native HTML5 PiP fallback to Floating Mini-Player:', err);
    }
  }

  if (isTopFrame) {
    try {
      const isMini = await ipcRenderer.invoke('toggle-pip-window');
      showToast(isMini ? 'Floating Mini-Player: ON' : 'Mini-Player: OFF');
    } catch (e) {
      showToast('No active video found');
    }
  }
}

// Global Media Key IPC Handlers from Main process
ipcRenderer.on('media-play-pause', () => {
  const video = getActiveVideos()[0];
  if (video) {
    if (video.paused) video.play();
    else video.pause();
    showToast(video.paused ? '⏸ Paused' : '▶ Playing');
  }
});

ipcRenderer.on('media-next', () => {
  const nextBtn = findNextEpisodeButton();
  if (nextBtn) {
    nextBtn.click();
    showToast('Next Episode');
  } else {
    const video = getActiveVideos()[0];
    if (video) {
      video.currentTime += 10;
      showToast('+10s');
    }
  }
});

ipcRenderer.on('media-prev', () => {
  const video = getActiveVideos()[0];
  if (video) {
    video.currentTime = Math.max(0, video.currentTime - 10);
    showToast('-10s');
  }
});

ipcRenderer.on('media-mute', () => {
  const video = getActiveVideos()[0];
  if (video) {
    video.muted = !video.muted;
    showToast(video.muted ? '🔇 Muted' : '🔊 Unmuted');
  }
});

// Keyboard navigation and shortcuts
function handleGlobalKeyDown(e) {
  const activeEl = document.activeElement;
  const isInput =
    activeEl &&
    (activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable ||
      activeEl.getAttribute('role') === 'textbox');

  // Command Palette: Ctrl+K / Cmd+K
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    if (isTopFrame) {
      e.preventDefault();
      openCommandPalette();
    }
    return;
  }

  // Back / Forward Keyboard Shortcuts
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    ipcRenderer.send('nav-back');
    return;
  }
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    ipcRenderer.send('nav-forward');
    return;
  }

  if (isInput) return;

  // Mark as Watched / Unwatched Shortcuts: 'w' (Watched) and 'Shift+W' (Unwatched)
  if ((e.key === 'w' || e.key === 'W') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (isTopFrame) {
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.shiftKey) {
        watchController.markCurrentPlayingEpisode(false, 'single');
      } else {
        watchController.markCurrentPlayingEpisode(true, 'single');
      }
    }
    return;
  }

  const videos = getActiveVideos();
  const video = videos.length > 0 ? videos[0] : null;

  // Decrease speed: '['
  if (e.key === '[' || e.code === 'BracketLeft') {
    if (!video && !isTopFrame) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const current = window.__crPlaybackRate || (video ? video.playbackRate : 1.0);
    const newRate = Math.max(0.25, parseFloat((current - 0.25).toFixed(2)));
    window.__crPlaybackRate = newRate;
    videos.forEach((v) => {
      v.playbackRate = newRate;
      v.defaultPlaybackRate = newRate;
    });
    const speedText = document.getElementById('cr-speed-text');
    if (speedText) speedText.textContent = `${newRate}x`;
    showToast(`Speed: ${newRate}x`);
    return;
  }

  // Increase speed: ']'
  if (e.key === ']' || e.code === 'BracketRight') {
    if (!video && !isTopFrame) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const current = window.__crPlaybackRate || (video ? video.playbackRate : 1.0);
    const newRate = Math.min(3.0, parseFloat((current + 0.25).toFixed(2)));
    window.__crPlaybackRate = newRate;
    videos.forEach((v) => {
      v.playbackRate = newRate;
      v.defaultPlaybackRate = newRate;
    });
    const speedText = document.getElementById('cr-speed-text');
    if (speedText) speedText.textContent = `${newRate}x`;
    showToast(`Speed: ${newRate}x`);
    return;
  }

  // Picture-in-Picture: 'P' or 'p'
  if ((e.key === 'p' || e.key === 'P' || e.code === 'KeyP') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (!video && !isTopFrame) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    triggerPictureInPicture();
    return;
  }
}

// Global event listeners
window.addEventListener('keydown', handleGlobalKeyDown, true);
document.addEventListener('keydown', handleGlobalKeyDown, true);

// Initial DOM Setup
ensureAppBar();

window.addEventListener('DOMContentLoaded', () => {
  ensureAppBar();
  const videos = getActiveVideos();
  videos.forEach(attachVideoListeners);
  if (isTopFrame) {
    watchController.initForCurrentPage();
  }
});

window.addEventListener('load', () => {
  ensureAppBar();
  if (isTopFrame) {
    watchController.initForCurrentPage();
  }
});

// Periodic observer loop (every 1000ms) for AppBar, Video Listeners, Auto-Skip, and Watched/Unwatched Cards
setInterval(() => {
  ensureAppBar();
  if (isTopFrame) {
    updateWatchBarButtonState();
    watchController.initForCurrentPage();
  }
  const videos = getActiveVideos();
  videos.forEach(attachVideoListeners);
  checkAndAutoSkip();
}, 1000);
