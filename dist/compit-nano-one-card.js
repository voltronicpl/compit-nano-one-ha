/*
 * compit-nano-one-card  v1.1
 * Karta Home Assistant dla rekuperacji sterowanej przez Compit Nano One (RS485, protokol C14),
 * czytanej przez ESP z ESPHome. Jeden plik, bez zaleznosci.
 *
 *   type: custom:compit-nano-one-card
 *   prefix: nano_one          # opcjonalnie, poczatek ID encji z ESPHome (domyslnie nano_one)
 *   title: Rekuperacja        # opcjonalnie
 *   tab: rekuperator          # opcjonalnie, zakladka startowa: rekuperator | diagnostyka
 *   history_hours: 6          # opcjonalnie, ile godzin wstecz czytac log i ramki w Diagnostyce
 *   entities:                 # opcjonalnie, nadpisanie pojedynczych encji
 *     t_nawiew: sensor.moja_temperatura_nawiewu
 *
 * Kazdy klucz z DEFAULT_E szukany jest jako <domena>.<prefix>_<koncowka>.
 * Jesli encji nie ma w podanej domenie, karta szuka tej samej koncowki w innych domenach.
 */
(() => {
const VERSION = 'v1.1';

// klucz: [domena, koncowka, opis, jednostka zapasowa]
const DEFAULT_E = {
  // --- rekuperator ---
  t_czerpnia:   ['sensor', 'temperatura_czerpni',        'Czerpnia (zewn.)', '°C'],
  t_nawiew:     ['sensor', 'temperatura_nawiewu',        'Nawiew',           '°C'],
  t_wywiew:     ['sensor', 'temperatura_wywiewu',        'Wywiew',           '°C'],
  t_wyrzutnia:  ['sensor', 'temperatura_wyrzutni',       'Wyrzutnia',        '°C'],
  t_pokoj:      ['sensor', 'temperatura_pokojowa',       'Temp. w pokoju',   '°C'],
  t_zadana:     ['sensor', 'temperatura_zadana',         'Temp. zadana',     '°C'],
  wilgotnosc:   ['sensor', 'wilgotnosc',                 'Wilgotność',       '%'],
  co2:          ['sensor', 'co2',                        'CO₂',              'ppm'],
  bieg:         ['sensor', 'bieg',                       'Bieg',             ''],
  went_nawiew:  ['sensor', 'wentylator_nawiewu',         'Went. nawiewu',    '%'],
  went_wywiew:  ['sensor', 'wentylator_wywiewu',         'Went. wywiewu',    '%'],
  tryb:         ['sensor', 'tryb',                       'Tryb',             ''],
  bypass:       ['binary_sensor', 'bypass',              'Bypass',           ''],
  nagrzewnica:  ['binary_sensor', 'nagrzewnica',         'Nagrzewnica',      ''],
  rozmrazanie:  ['binary_sensor', 'rozmrazanie',         'Rozmrażanie',      ''],
  filtr:        ['sensor', 'filtr',                      'Filtry',           ''],
  filtr_dni:    ['sensor', 'filtr_dni_do_wymiany',       'Filtry: dni do wymiany', 'd'],
  alarm:        ['sensor', 'alarm',                      'Alarm',            ''],
  ostrzezenie:  ['sensor', 'ostrzezenie',                'Ostrzeżenie',      ''],
  obroty_nawiew:['sensor', 'obroty_nawiewu',             'Obroty nawiewu',   'rpm'],
  obroty_wywiew:['sensor', 'obroty_wywiewu',             'Obroty wywiewu',   'rpm'],
  przeplyw:     ['sensor', 'przeplyw',                   'Przepływ',         'm³/h'],
  t_nagrzewnica:['sensor', 'temperatura_nagrzewnicy',    'Temp. nagrzewnicy','°C'],
  t_gwc:        ['sensor', 'temperatura_gwc',            'Temp. GWC',        '°C'],
  gwc:          ['sensor', 'gwc',                 'GWC',              ''],
  kominek:      ['sensor', 'kominek',             'Kominek',          ''],
  harmonogram:  ['sensor', 'harmonogram',                'Harmonogram',      ''],
  bieg_zadany:  ['sensor', 'bieg_zadany',                'Bieg zadany',      ''],
  sprawnosc:    ['sensor', 'sprawnosc_odzysku',          'Sprawność odzysku','%'],
  godziny_pracy:['sensor', 'godziny_pracy',              'Godziny pracy',    'h'],
  wersja_nano:  ['sensor', 'wersja_nano_one',            'Wersja Nano One',  ''],
  // v1.1: stany i tryby z YAML v1.3
  sezon:        ['sensor', 'sezon',                      'Sezon',            ''],
  sezon_rej:    ['sensor', 'sezon_rejestr',              'Sezon (rejestr)',  ''],
  bypass_tryb:  ['sensor', 'bypass_tryb',                'Bypass tryb',      ''],
  bypass_rej:   ['sensor', 'bypass_rejestr',             'Bypass (rejestr)', ''],
  wietrzenie:   ['sensor', 'wietrzenie',                 'Wietrzenie',       ''],
  urlop:        ['sensor', 'urlop',                      'Urlop',            ''],
  poza_domem:   ['sensor', 'poza_domem',                 'Poza domem',       ''],
  tryb_term:    ['sensor', 'tryb_termostatu_rejestr',    'Tryb termostatu',  ''],
  went_aktywna: ['binary_sensor', 'wentylacja_aktywna',  'Wentylacja',       ''],
  chlodzenie:   ['binary_sensor', 'zapotrzebowanie_na_chlodzenie', 'Chłodzenie', ''],
  // v1.1: nastawy
  n_komfort:    ['sensor', 'nastawa_komfort',            'Komfort',          '°C'],
  n_eko:        ['sensor', 'nastawa_eko',                'Eko',              '°C'],
  n_chlodzenie: ['sensor', 'nastawa_chlodzenie',         'Chłodzenie',       '°C'],
  n_reczna:     ['sensor', 'nastawa_reczna',             'Ręczna',           '°C'],
  n_poza:       ['sensor', 'nastawa_poza_domem',         'Poza domem',       '°C'],
  aero_moc:     ['sensor', 'aero_moc_centrali',          'Moc centrali AERO','%'],
  zad_nawiew:   ['sensor', 'wentylacja_nawiew_zadany',   'Nawiew zadany',    '%'],
  zad_wywiew:   ['sensor', 'wentylacja_wywiew_zadany',   'Wywiew zadany',    '%'],
  // --- diagnostyka ESP ---
  status:       ['binary_sensor', 'status',              'ESP online',       ''],
  wifi:         ['sensor', 'wifi_sygnal',                'WiFi sygnał',      'dBm'],
  uptime:       ['sensor', 'czas_pracy',                 'Czas pracy ESP',   's'],
  ip:           ['sensor', 'ip',                         'Adres IP',         ''],
  ssid:         ['sensor', 'ssid',                       'SSID',             ''],
  wersja:       ['sensor', 'wersja_esphome',             'Wersja ESPHome',   ''],
  diag:         ['sensor', 'diagnostyka_esp',            'Diagnostyka ESP',  ''],
  // --- diagnostyka magistrali C14 ---
  ramka:        ['sensor', 'ostatnia_ramka',             'Ostatnia ramka C14', ''],
  ramki_ok:     ['sensor', 'ramki_ok',                   'Ramki poprawne',   ''],
  ramki_bledne: ['sensor', 'ramki_bledne',               'Ramki błędne',     ''],
  ramki_min:    ['sensor', 'ramki_na_minute',            'Ramki / min',      '/min'],
  ramka_wiek:   ['sensor', 'wiek_ostatniej_ramki',       'Od ostatniej ramki', 's'],
  adresy:       ['sensor', 'wykryte_adresy',             'Wykryte adresy C14', ''],
  magistrala:   ['binary_sensor', 'magistrala_c14',      'Magistrala C14',   ''],
  // v1.1: liczniki i stan magistrali
  bajty:        ['sensor', 'bajty_rs485',                'Bajty RS485',      ''],
  bajty_b7:     ['sensor', 'bajty_z_bitem_7',            'Bajty z bitem 7',  ''],
  ramki_suma:   ['sensor', 'ramki_zla_suma',             'Ramki: zła suma',  ''],
  ramki_urwane: ['sensor', 'ramki_urwane',               'Ramki urwane',     ''],
  nano_nadaje:  ['binary_sensor', 'nano_nadaje',         'Nano nadaje',      ''],
  aero_odp:     ['binary_sensor', 'aero_odpowiada',      'AERO odpowiada',   ''],
  typy:         ['sensor', 'c14_typy_ramek',             'Typy ramek C14',   ''],
  zegar:        ['sensor', 'zegar_nano',                 'Zegar Nano',       ''],
  rejestry:     ['sensor', 'c14_rejestry_nano',          'Rejestry Nano',    ''],
  // v1.1: surowe ramki (kazda ma swoja zakladke w Diagnostyce)
  r_nano_st:    ['sensor', 'c14_ramka_nano_status',      'Nano status',      ''],
  r_nano_nast:  ['sensor', 'c14_ramka_nano_nastawy',     'Nano nastawy',     ''],
  r_e3_3a:      ['sensor', 'c14_ramka_e3_strona_3a',     'E3 3A',            ''],
  r_e3_3b:      ['sensor', 'c14_ramka_e3_strona_3b',     'E3 3B',            ''],
  r_aero:       ['sensor', 'c14_ramka_aero',             'AERO',             ''],
  r_bajty:      ['sensor', 'surowe_bajty',               'Surowe bajty',     ''],
};

// zrodla ramek w Diagnostyce (klucz 'ramka' = ostatnia dowolna)
const FRAME_KEYS = ['ramka', 'r_nano_st', 'r_nano_nast', 'r_e3_3a', 'r_e3_3b', 'r_aero', 'r_bajty'];
// encje, ktorych zmiany ida do logu zdarzen
const LOG_KEYS = ['diag', 'alarm', 'status', 'magistrala', 'tryb', 'bieg', 'bypass', 'filtr', 'sezon', 'bypass_tryb',
  'wietrzenie', 'urlop', 'poza_domem', 'went_aktywna', 'chlodzenie', 'nano_nadaje', 'aero_odp', 'kominek', 'gwc'];

const REKU_KEYS = ['t_czerpnia','t_nawiew','t_wywiew','t_wyrzutnia','t_pokoj','t_zadana','wilgotnosc','co2',
  'bieg','went_nawiew','went_wywiew','tryb','bypass','nagrzewnica','rozmrazanie','filtr','filtr_dni','alarm',
  'ostrzezenie','obroty_nawiew','obroty_wywiew','przeplyw','t_nagrzewnica','t_gwc','gwc','kominek','harmonogram',
  'bieg_zadany','sprawnosc','godziny_pracy','wersja_nano'];
const ESP_KEYS = ['status','wifi','uptime','ip','ssid','wersja'];
const BUS_KEYS = ['magistrala','ramki_ok','ramki_bledne','ramki_min','ramka_wiek','adresy'];

// adresy C14 (z odwroconego protokolu)
const C14_ADDR = (a) => {
  if (a === 41) return 'NANO 1';
  if (a >= 42 && a <= 60) return 'NANO ' + (a - 40);
  if (a === 99) return 'AERO';
  if (a === 100 || a === 101) return 'broadcast';
  if (a === 112) return 'iNext';
  return '?';
};

const BAD = ['unavailable', 'unknown', '', undefined, null];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = (s) => { const v = parseFloat(s && s.state !== undefined ? s.state : s); return isNaN(v) ? null : v; };
const pad2 = (n) => String(n).padStart(2, '0');
const hhmmss = (d) => pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());

function fmtUptime(sec) {
  sec = Math.floor(sec);
  const d = Math.floor(sec / 86400); sec -= d * 86400;
  const h = Math.floor(sec / 3600); sec -= h * 3600;
  const m = Math.floor(sec / 60);
  return (d ? d + ' d ' : '') + h + ' h ' + pad2(m) + ' min';
}

function wifiQuality(dbm) {
  if (dbm === null) return ['—', 'mute'];
  if (dbm >= -55) return ['bardzo dobry', 'ok'];
  if (dbm >= -67) return ['dobry', 'ok'];
  if (dbm >= -75) return ['słaby', 'warn'];
  return ['bardzo słaby', 'err'];
}

// "80 29 0A ..." / "80290A..." / kilka ramek po | lub nowej linii -> tablica ramek (tablic bajtow)
function parseFrames(txt) {
  if (!txt) return [];
  const out = [];
  String(txt).split(/[|\n;]+/).forEach((part) => {
    const hex = part.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
    if (hex.length < 8) return;
    const bytes = [];
    for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
    // dziel na ramki 30 B, jesli wklejono kilka naraz
    if (bytes.length > 30 && bytes.length % 30 === 0) {
      for (let i = 0; i < bytes.length; i += 30) out.push(bytes.slice(i, i + 30));
    } else out.push(bytes);
  });
  return out;
}

function decodeFrame(b) {
  const r = { len: b.length, ok: true, notes: [] };
  if (b.length !== 30) { r.ok = false; r.notes.push('długość ' + b.length + ' B (oczekiwane 30)'); }
  if (b.length) {
    r.dst = b[0] >= 0x80 ? b[0] - 0x80 : null;
    if (b[0] < 0x80) { r.ok = false; r.notes.push('bajt 0 < 0x80 (brak bitu startu)'); }
  }
  if (b.length > 1) r.cmd = b[1];
  if (b.length > 2) r.chk = b[2];
  if (b.length > 3) r.src = b[3];
  if (b.length === 30 && b[29] !== 0x23) { r.ok = false; r.notes.push('brak znacznika końca 0x23 (#)'); }
  // pary 7-bitowe H/L od bajtu 4: raw = H*128+L, temp = (raw-2000)/10
  r.pairs = [];
  for (let i = 4; i + 1 < Math.min(b.length, 29); i += 2) {
    const raw = b[i] * 128 + b[i + 1];
    const t = (raw - 2000) / 10;
    r.pairs.push({ i, raw, t: (b[i] < 128 && b[i + 1] < 128 && t > -50 && t < 100) ? t : null });
  }
  return r;
}

class CompitNanoOneCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._tab = 'rekuperator';
    this._log = [];        // [{t: Date, e: key, s: state}]
    this._frames = [];     // [{t: Date, s: raw}]
    this._last = {};
    this._histLoaded = false;
    this._renderPending = false;
    this._selFrame = 0;
  }

  static getStubConfig() { return { prefix: 'nano_one' }; }
  getCardSize() { return 8; }

  setConfig(config) {
    this._config = Object.assign({ prefix: 'nano_one', title: 'Rekuperacja', history_hours: 6 }, config || {});
    this._prefix = String(this._config.prefix).replace(/\.$/, '').replace(/^[a-z_]+\./, '');
    if (this._config.tab) this._tab = this._config.tab;
    this._resolved = {};
    this._histLoaded = false;
    this._schedule();
  }

  // ID encji dla klucza (z nadpisaniem i szukaniem w innych domenach)
  _id(key) {
    const ov = this._config.entities && this._config.entities[key];
    if (ov) return ov;
    if (this._resolved[key] && this._hass && this._hass.states[this._resolved[key]]) return this._resolved[key];
    const [dom, suf] = DEFAULT_E[key];
    const obj = this._prefix + '_' + suf;
    let id = dom + '.' + obj;
    if (this._hass && !this._hass.states[id]) {
      for (const d of ['sensor', 'binary_sensor', 'text_sensor', 'select', 'number', 'switch', 'fan', 'climate']) {
        if (this._hass.states[d + '.' + obj]) { id = d + '.' + obj; break; }
      }
    }
    this._resolved[key] = id;
    return id;
  }
  _st(key) { return this._hass ? this._hass.states[this._id(key)] : undefined; }
  // "?" w nazwie encji z ESPHome = mapowanie niepewne
  _unsure(id) { const s = this._hass && this._hass.states[id]; return !!(s && /\?/.test(s.attributes.friendly_name || '')); }
  _q(id) { return this._unsure(id) ? '<sup class="q" title="mapowanie niepewne (? w YAML)">?</sup>' : ''; }
  // encja diagnostyczna / konfiguracyjna (entity_category z rejestru HA, a bez niego po nazwie)
  _isDiag(id) {
    if (/^(select|switch|number|text|button)\./.test(id)) return true;
    const reg = this._hass.entities && this._hass.entities[id];
    if (reg && reg.entity_category) return true;
    if (reg) return false;
    return /_(c14_|aero_t\d|bieg_\d_|nawiew_bieg|wywiew_bieg|nawiew_wietrzenie|wywiew_wietrzenie|prog_|histereza|blokada|min_temp|metoda_)/.test(id) || /\(serwis\)/.test((this._hass.states[id].attributes.friendly_name || ''));
  }
  _prefIds() {
    const pre = this._prefix + '_';
    return Object.keys(this._hass.states).filter((id) => { const o = id.split('.')[1]; return o && o.startsWith(pre); }).sort();
  }
  _shortName(id) {
    const s = this._hass.states[id];
    return (s.attributes.friendly_name || id).replace(new RegExp('^' + this._prefix.replace(/_/g, '[ _]') + '\\s*', 'i'), '');
  }
  _has(key) { const s = this._st(key); return !!s && !BAD.includes(s.state); }

  _val(key, digits) {
    const s = this._st(key);
    if (!s) return '<span class="mute">brak encji</span>';
    if (BAD.includes(s.state)) return '<span class="mute">' + (s.state === 'unavailable' ? 'niedostępne' : '—') + '</span>';
    const unit = s.attributes.unit_of_measurement !== undefined ? s.attributes.unit_of_measurement : DEFAULT_E[key][3];
    const v = num(s);
    if (s.entity_id.startsWith('binary_sensor.')) return s.state === 'on' ? 'TAK' : 'NIE';
    if (v !== null && String(s.state).trim() !== '' && isFinite(Number(s.state))) {
      return esc(digits !== undefined ? v.toFixed(digits) : String(v)) + (unit ? '<small> ' + esc(unit) + '</small>' : '');
    }
    return esc(s.state);
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    // log zdarzen i ramek zbierany na zywo, gdy karta jest otwarta
    const now = new Date();
    for (const key of LOG_KEYS.concat(FRAME_KEYS)) {
      const s = hass.states[this._id(key)];
      const st = s ? s.state : undefined;
      if (this._last[key] !== undefined && st !== this._last[key] && st !== undefined) {
        const t = s.last_changed ? new Date(s.last_changed) : now;
        if (FRAME_KEYS.includes(key)) this._pushFrame({ t, s: st, k: key });
        else this._pushLog({ t, e: key, s: st });
      }
      this._last[key] = st;
    }
    if (first || this._tab === 'diagnostyka') this._loadHistory();
    this._schedule();
  }

  _pushLog(x) { this._log.push(x); this._log.sort((a, b) => a.t - b.t); if (this._log.length > 300) this._log.splice(0, this._log.length - 300); }
  _pushFrame(x) {
    if (BAD.includes(x.s)) return;
    if (this._frames.some((f) => f.k === x.k && f.s === x.s && Math.abs(f.t - x.t) < 500)) return;
    this._frames.push(x); this._frames.sort((a, b) => a.t - b.t);
    if (this._frames.length > 600) this._frames.splice(0, this._frames.length - 600);
  }

  async _loadHistory() {
    if (this._histLoaded || !this._hass || !this._hass.callApi) return;
    this._histLoaded = true;
    const keys = LOG_KEYS.concat(FRAME_KEYS);
    const ids = keys.map((k) => this._id(k)).filter((id) => this._hass.states[id]);
    if (!ids.length) return;
    const start = new Date(Date.now() - (Number(this._config.history_hours) || 6) * 3600e3).toISOString();
    try {
      const res = await this._hass.callApi('GET', 'history/period/' + start + '?filter_entity_id=' + ids.join(',') + '&minimal_response&no_attributes');
      (res || []).forEach((arr) => {
        if (!arr || !arr.length) return;
        const eid = arr[0].entity_id;
        const key = keys.find((k) => this._id(k) === eid);
        arr.forEach((h, i) => {
          if (i === 0) return; // pierwszy wpis = stan na poczatku okna, nie zmiana
          const t = new Date(h.last_changed || h.lu * 1000);
          if (FRAME_KEYS.includes(key)) this._pushFrame({ t, s: h.state || h.s, k: key });
          else this._pushLog({ t, e: key, s: h.state || h.s });
        });
      });
      // usun duplikaty
      const seen = new Set();
      this._log = this._log.filter((x) => { const k = +x.t + x.e + x.s; if (seen.has(k)) return false; seen.add(k); return true; });
    } catch (e) {
      this._pushLog({ t: new Date(), e: 'karta', s: 'Nie udało się pobrać historii: ' + (e && e.message ? e.message : e) });
    }
    this._schedule();
  }

  _schedule() {
    if (this._renderPending) return;
    this._renderPending = true;
    requestAnimationFrame(() => { this._renderPending = false; this._render(); });
  }

  _more(eid) {
    if (!eid) return;
    const ev = new Event('hass-more-info', { bubbles: true, composed: true });
    ev.detail = { entityId: eid };
    this.dispatchEvent(ev);
  }

  _render() {
    if (!this._config || !this._hass) return;
    const keepScroll = this.shadowRoot.querySelector('.body');
    const sc = keepScroll ? keepScroll.scrollTop : 0;
    const espOn = this._st('status');
    const online = espOn ? espOn.state === 'on' : null;
    const alarm = this._st('alarm');
    const alarmOn = alarm && !BAD.includes(alarm.state) && !/^(brak|ok|0|off|none|-)$/i.test(alarm.state);

    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <ha-card>
        <div class="head">
          <div class="title">${esc(this._config.title)}</div>
          <div class="badges">
            ${alarmOn ? `<span class="badge err" data-e="${esc(this._id('alarm'))}">⚠ ${esc(alarm.state)}</span>` : ''}
            <span class="badge ${online === null ? 'mute' : online ? 'ok' : 'err'}" data-e="${esc(this._id('status'))}">ESP ${online === null ? '?' : online ? 'online' : 'offline'}</span>
          </div>
        </div>
        <div class="tabs">
          <button class="tab ${this._tab === 'rekuperator' ? 'on' : ''}" data-tab="rekuperator">Rekuperator</button>
          <button class="tab ${this._tab === 'diagnostyka' ? 'on' : ''}" data-tab="diagnostyka">Diagnostyka</button>
        </div>
        <div class="body">${this._tab === 'diagnostyka' ? this._renderDiag() : this._renderReku()}</div>
        <div class="foot">compit-nano-one-card ${VERSION} · prefiks <code>${esc(this._prefix)}</code></div>
      </ha-card>`;

    this.shadowRoot.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      this._tab = b.dataset.tab;
      if (this._tab === 'diagnostyka') this._loadHistory();
      this._render();
    }));
    this.shadowRoot.querySelectorAll('[data-e]').forEach((el) => el.addEventListener('click', (ev) => { ev.stopPropagation(); this._more(el.dataset.e); }));
    this.shadowRoot.querySelectorAll('[data-fr]').forEach((el) => el.addEventListener('click', () => { this._selFrame = Number(el.dataset.fr); this._render(); }));
    this.shadowRoot.querySelectorAll('[data-fsrc]').forEach((el) => el.addEventListener('click', () => { this._fsrc = el.dataset.fsrc; this._selFrame = 0; this._render(); }));
    const cp = this.shadowRoot.querySelector('[data-copy]');
    if (cp) cp.addEventListener('click', () => this._copyFrames());
    this.shadowRoot.querySelectorAll('[data-rng]').forEach((b) => b.addEventListener('click', () => { this._logRange = Number(b.dataset.rng); this._fullText = ''; this._fullStat = ''; this._render(); }));
    this.shadowRoot.querySelectorAll('[data-full]').forEach((b) => b.addEventListener('click', () => this._fullLog(b.dataset.full)));
    const body = this.shadowRoot.querySelector('.body');
    if (body) body.scrollTop = sc;
  }

  // ---------------- zakladka Rekuperator ----------------
  _renderReku() {
    const tc = num(this._st('t_czerpnia')), tn = num(this._st('t_nawiew')), tw = num(this._st('t_wywiew')), tr = num(this._st('t_wyrzutnia'));
    let eff = num(this._st('sprawnosc'));
    if (eff === null && tc !== null && tn !== null && tw !== null && Math.abs(tw - tc) >= 3) eff = Math.max(0, Math.min(100, (tn - tc) / (tw - tc) * 100));
    const bypassOn = this._st('bypass') && this._st('bypass').state === 'on';
    const fN = num(this._st('went_nawiew')), fW = num(this._st('went_wywiew'));
    const spin = (v) => v === null ? 0 : v <= 0 ? 0 : Math.max(0.4, 3 - v / 50);
    const tLbl = (key, x, y, anchor) => {
      const id = this._id(key);
      const v = num(this._st(key));
      return `<g class="lnk" data-e="${esc(id)}"><text x="${x}" y="${y}" text-anchor="${anchor}" class="tl">${esc(DEFAULT_E[key][2])}${this._unsure(id) ? ' (?)' : ''}</text>
        <text x="${x}" y="${y + 24}" text-anchor="${anchor}" class="tv">${v === null ? '—' : v.toFixed(1) + '°'}</text></g>`;
    };
    const fan = (cx, cy, v, key) => {
      const s = spin(v);
      return `<g class="lnk" data-e="${esc(this._id(key))}" transform="translate(${cx} ${cy})">
        <circle r="17" class="fanring"/>
        <g class="${s ? 'spin' : ''}" style="animation-duration:${s}s">
          <path d="M0 -13 C6 -12 6 -3 0 0 C-6 -3 -6 -12 0 -13Z M13 0 C12 6 3 6 0 0 C3 -6 12 -6 13 0Z M0 13 C-6 12 -6 3 0 0 C6 3 6 12 0 13Z M-13 0 C-12 -6 -3 -6 0 0 C-3 6 -12 6 -13 0Z" class="blade"/>
        </g>
        <text y="33" text-anchor="middle" class="fv">${v === null ? '—' : Math.round(v) + '%'}</text></g>`;
    };

    const svg = `
      <svg viewBox="0 0 420 230" class="schema" role="img" aria-label="Schemat rekuperatora">
        <defs>
          <marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker>
        </defs>
        <rect x="110" y="40" width="200" height="150" rx="14" class="unit"/>
        <!-- wymiennik -->
        <polygon points="210,60 265,115 210,170 155,115" class="hx ${bypassOn ? 'byp' : ''}"/>
        <!-- swieze: czerpnia (L-gora) -> nawiew (P-dol) -->
        <path d="M20 70 H120 L155 105 ${bypassOn ? 'L265 105' : 'L265 125'} L300 160 H400" class="air cold" marker-end="url(#ah)"/>
        <!-- zuzyte: wywiew (P-gora) -> wyrzutnia (L-dol) -->
        <path d="M400 70 H300 L265 105 L155 125 L120 160 H20" class="air warm" marker-end="url(#ah)"/>
        ${tLbl('t_czerpnia', 12, 32, 'start')}
        ${tLbl('t_wyrzutnia', 12, 188, 'start')}
        ${tLbl('t_wywiew', 408, 32, 'end')}
        ${tLbl('t_nawiew', 408, 188, 'end')}
        ${fan(340, 160, fN, 'went_nawiew')}
        ${fan(80, 160, fW, 'went_wywiew')}
        <text x="210" y="208" text-anchor="middle" class="tl">${bypassOn ? 'BYPASS otwarty' : 'odzysk ciepła'}</text>
        <text x="210" y="92" text-anchor="middle" class="eff">${eff === null ? '' : Math.round(eff) + '%'}</text>
        <text x="20" y="228" class="lg cold">● powietrze świeże</text>
        <text x="400" y="228" text-anchor="end" class="lg warm">● powietrze zużyte</text>
      </svg>`;

    const tile = (key, digits, big) => {
      const id = this._id(key);
      return `<div class="tile ${big ? 'big' : ''} ${this._has(key) ? '' : 'dim'}" data-e="${esc(id)}">
        <div class="tl2">${esc(DEFAULT_E[key][2])}${this._q(id)}</div><div class="tv2">${this._val(key, digits)}</div></div>`;
    };
    const flag = (key) => {
      const s = this._st(key);
      const bin = s && /^(on|off)$/.test(s.state);
      const on = s && (s.state === 'on' || (!bin && !BAD.includes(s.state) && !/^(off|wył|wyl|nie|brak|0|nieaktywn)/i.test(s.state)));
      const txt = s && !BAD.includes(s.state) ? (bin ? (on ? ' ✓' : '') : ': ' + esc(s.state)) : '';
      return `<span class="flag ${!s || BAD.includes(s.state) ? 'mute' : on ? 'on' : ''}" data-e="${esc(this._id(key))}">${esc(DEFAULT_E[key][2])}${this._q(this._id(key))}${txt}</span>`;
    };
    const filtr = this._st('filtr');
    const filtrWarn = filtr && !BAD.includes(filtr.state) && /(wymie|brud|zabr|alarm|on|1)/i.test(filtr.state);

    const missing = REKU_KEYS.filter((k) => !this._st(k)).length;
    const opt = (key, digits) => this._st(key) ? tile(key, digits) : '';
    const optFlag = (key) => this._st(key) ? flag(key) : '';
    // wszystko inne, co ESP wystawia z tym prefiksem, a karta nie zna z nazwy
    const known = new Set(Object.keys(DEFAULT_E).map((k) => this._id(k)));
    const rest = this._prefIds().filter((id) => !known.has(id) && !/^(button|update)\./.test(id) && !this._isDiag(id));
    const restTiles = rest.map((id) => this._genTile(id)).join('');
    const nast = ['n_komfort', 'n_eko', 'n_chlodzenie', 'n_reczna', 'n_poza'].map((k) => opt(k, 1)).join('')
      + ['zad_nawiew', 'zad_wywiew', 'aero_moc'].map((k) => opt(k, 0)).join('');
    return `
      ${svg}
      <div class="flags">${optFlag('went_aktywna')}${flag('bypass')}${optFlag('bypass_tryb')}${optFlag('sezon')}${optFlag('chlodzenie')}${optFlag('wietrzenie')}${optFlag('urlop')}${optFlag('poza_domem')}${optFlag('nagrzewnica')}${optFlag('rozmrazanie')}${optFlag('gwc')}${optFlag('kominek')}${optFlag('magistrala')}
        ${filtr ? `<span class="flag ${filtrWarn ? 'err' : ''}" data-e="${esc(this._id('filtr'))}">Filtry: ${!BAD.includes(filtr.state) ? esc(filtr.state) : '—'}</span>` : ''}</div>
      <div class="grid">
        ${tile('bieg', undefined, true)}${tile('tryb', undefined, true)}
        ${opt('bieg_zadany')}${opt('harmonogram')}${opt('tryb_term')}
        ${tile('t_pokoj', 1)}${tile('t_zadana', 1)}
        ${opt('wilgotnosc', 0)}${opt('co2', 0)}
        ${opt('przeplyw', 0)}${opt('obroty_nawiew', 0)}${opt('obroty_wywiew', 0)}
        ${opt('t_nagrzewnica', 1)}${opt('t_gwc', 1)}${opt('sprawnosc', 0)}
        ${opt('filtr_dni', 0)}${opt('alarm')}${opt('ostrzezenie')}
        ${opt('godziny_pracy', 0)}${opt('wersja_nano')}
      </div>
      ${nast ? `<h3 class="rest">Nastawy</h3><div class="grid">${nast}</div>` : ''}
      ${restTiles ? `<h3 class="rest">Pozostałe z ESP (${rest.length})</h3><div class="grid">${restTiles}</div>` : ''}
      <div class="effnote">Sprawność odzysku = (nawiew − czerpnia) / (wywiew − czerpnia)${eff === null ? ': za mała różnica temperatur albo brak danych' : ': <b>' + Math.round(eff) + '%</b>'}</div>
      ${missing === REKU_KEYS.length ? `<div class="warnbox">Nie widzę żadnej encji z prefiksem <code>${esc(this._prefix)}</code>. Sprawdź <code>prefix:</code> w karcie albo listę encji w zakładce Diagnostyka.</div>` : ''}`;
  }

  // ---------------- zakladka Diagnostyka ----------------
  _renderDiag() {
    const row = (key, extra) => {
      const id = this._id(key);
      const s = this._st(key);
      return `<tr data-e="${esc(id)}" class="${s ? '' : 'dim'}"><td>${esc(DEFAULT_E[key][2])}</td><td>${extra !== undefined ? extra : this._val(key)}</td></tr>`;
    };
    const opt = (key, extra) => this._st(key) ? row(key, extra) : '';
    // ESP
    const wifi = num(this._st('wifi'));
    const [wq, wc] = wifiQuality(wifi);
    const up = num(this._st('uptime'));
    const espTbl = `
      <table class="kv">
        ${row('status', (() => { const s = this._st('status'); if (!s) return '<span class="mute">brak encji</span>'; return s.state === 'on' ? '<span class="ok">● online</span>' : '<span class="err">● offline</span>'; })())}
        ${row('wifi', wifi === null ? undefined : `${wifi} dBm <span class="${wc}">(${wq})</span> ${this._bars(wifi)}`)}
        ${row('uptime', up === null ? undefined : fmtUptime(up))}
        ${row('ip')}${row('ssid')}${row('wersja')}
      </table>`;

    // magistrala
    const ok = num(this._st('ramki_ok')), bad = num(this._st('ramki_bledne'));
    const errPct = ok !== null && bad !== null && ok + bad > 0 ? bad / (ok + bad) * 100 : null;
    const age = num(this._st('ramka_wiek'));
    let lastFrameT = this._frames.length ? this._frames[this._frames.length - 1].t : null;
    const rs = this._st('ramka');
    if (rs && rs.last_changed && !BAD.includes(rs.state)) { const t = new Date(rs.last_changed); if (!lastFrameT || t > lastFrameT) lastFrameT = t; }
    const ageSec = age !== null ? age : lastFrameT ? (Date.now() - lastFrameT) / 1000 : null;
    const busState = ageSec === null ? ['brak danych', 'mute'] : ageSec < 30 ? ['ramki płyną', 'ok'] : ageSec < 300 ? ['cisza ' + Math.round(ageSec) + ' s', 'warn'] : ['brak ramek od ' + Math.round(ageSec / 60) + ' min', 'err'];
    const busTbl = `
      <table class="kv">
        <tr><td>Stan magistrali</td><td><span class="${busState[1]}">● ${esc(busState[0])}</span></td></tr>
        ${this._st('magistrala') ? row('magistrala') : ''}
        ${row('ramki_ok', ok === null ? undefined : String(ok))}
        ${row('ramki_bledne', bad === null ? undefined : `${bad}${errPct === null ? '' : ` <span class="${errPct < 1 ? 'ok' : errPct < 5 ? 'warn' : 'err'}">(${errPct.toFixed(1)}%)</span>`}`)}
        ${opt('ramki_suma')}${opt('ramki_urwane')}
        ${row('ramki_min')}
        ${opt('bajty')}${opt('bajty_b7')}${opt('nano_nadaje')}${opt('aero_odp')}
        ${opt('typy')}${opt('zegar')}
        ${lastFrameT ? `<tr><td>Ostatnia ramka</td><td>${hhmmss(lastFrameT)}</td></tr>` : ''}
        ${row('adresy', this._fmtAddrs())}
      </table>`;

    // ramki
    const srcs = FRAME_KEYS.filter((k) => this._st(k) || this._frames.some((f) => f.k === k));
    const fsrc = this._fsrc && (this._fsrc === 'all' || srcs.includes(this._fsrc)) ? this._fsrc : 'all';
    const frames = this._frames.filter((f) => fsrc === 'all' || f.k === fsrc).reverse();
    // brak historii: pokaz chociaz biezace wartosci
    if (!frames.length) {
      (fsrc === 'all' ? srcs : [fsrc]).forEach((k) => { const s = this._st(k); if (s && !BAD.includes(s.state)) frames.push({ t: s.last_changed ? new Date(s.last_changed) : new Date(), s: s.state, k }); });
    }
    const srcTabs = srcs.length > 1 ? `<div class="row">${['all'].concat(srcs).map((k) => `<button class="mini ${k === fsrc ? 'on' : ''}" data-fsrc="${k}">${k === 'all' ? 'wszystkie' : k === 'ramka' ? 'ostatnia' : esc(DEFAULT_E[k][2])}</button>`).join('')}</div>` : '';
    if (this._selFrame >= frames.length) this._selFrame = 0;
    const list = frames.slice(0, 40).map((f, i) => {
      const fr = parseFrames(f.s)[0] || [];
      const d = decodeFrame(fr);
      return `<div class="fr ${i === this._selFrame ? 'sel' : ''}" data-fr="${i}">
        <span class="ft">${hhmmss(f.t)}</span>
        <span class="${d.ok ? 'ok' : 'err'}">${d.ok ? '✓' : '✗'}</span>
        <span class="fk">${esc(f.k && f.k !== 'ramka' ? DEFAULT_E[f.k][2] : '')}</span>
        <span class="fa">${d.src !== undefined ? d.src + '→' + (d.dst === null ? '?' : d.dst) : ''}</span>
        <code>${esc(String(f.s).slice(0, 60))}${String(f.s).length > 60 ? '…' : ''}</code></div>`;
    }).join('');
    const detail = frames.length ? this._frameDetail(frames[this._selFrame]) : '';

    // log
    const log = this._log.slice().reverse().slice(0, 80).map((x) => `
      <div class="lg-row ${x.e === 'alarm' ? 'err' : ''}"><span class="ft">${x.t.toLocaleDateString() === new Date().toLocaleDateString() ? hhmmss(x.t) : x.t.toLocaleString()}</span>
      <span class="le">${esc(DEFAULT_E[x.e] ? DEFAULT_E[x.e][2] : x.e)}</span><span>${esc(x.s)}</span></div>`).join('');

    // wszystkie encje z prefiksem
    const pre = this._prefix + '_';
    const all = Object.keys(this._hass.states).filter((id) => id.split('.')[1] && id.split('.')[1].startsWith(pre)).sort();
    const known = new Set(Object.keys(DEFAULT_E).map((k) => this._id(k)));
    const allTbl = all.map((id) => {
      const s = this._hass.states[id];
      const u = s.attributes.unit_of_measurement || '';
      return `<tr data-e="${esc(id)}"><td><code>${esc(id)}</code>${known.has(id) ? '' : ' <span class="mute">(karta nie używa)</span>'}</td><td>${esc(String(s.state).slice(0, 80))} ${esc(u)}</td></tr>`;
    }).join('');
    const missing = Object.keys(DEFAULT_E).filter((k) => !this._st(k)).map((k) => `<code>${esc(this._id(k))}</code>`);

    const known2 = new Set(Object.keys(DEFAULT_E).map((k) => this._id(k)));
    const diagIds = this._prefIds().filter((id) => !known2.has(id) && this._isDiag(id) && !/^(button|update)\./.test(id));
    const cfgIds = diagIds.filter((id) => /^(select|switch|number|text)\./.test(id));
    const rawIds = diagIds.filter((id) => /_c14_|_aero_t\d/.test(id) && !cfgIds.includes(id));
    const srvIds = diagIds.filter((id) => !rawIds.includes(id) && !cfgIds.includes(id));
    const kvRows = (ids) => ids.map((id) => {
      const s = this._hass.states[id];
      const u = s.attributes.unit_of_measurement || '';
      return `<tr data-e="${esc(id)}"><td>${esc(this._shortName(id))}${this._q(id)}</td><td>${BAD.includes(s.state) ? '<span class="mute">—</span>' : esc(String(s.state).slice(0, 80)) + (u ? ' ' + esc(u) : '')}</td></tr>`;
    }).join('');
    const reg = this._st('rejestry');
    const extraSecs = `
      ${rawIds.length ? `<div class="sec"><h3>Surowe pola C14 (${rawIds.length})</h3><table class="kv">${kvRows(rawIds)}</table></div>` : ''}
      ${reg && !BAD.includes(reg.state) ? `<div class="sec"><h3>Rejestry Nano</h3><pre class="pre" data-e="${esc(reg.entity_id)}">${esc(reg.state)}</pre></div>` : ''}
      ${srvIds.length ? `<div class="sec"><h3>Parametry serwisowe (${srvIds.length})</h3><table class="kv">${kvRows(srvIds)}</table></div>` : ''}
      ${cfgIds.length ? `<div class="sec"><h3>Ustawienia ESP (${cfgIds.length})</h3><table class="kv">${kvRows(cfgIds)}</table></div>` : ''}`;
    const rng = this._logRange || 24;
    return `
      <div class="sec fullog">
        <h3>Cały log do skopiowania</h3>
        <div class="row">
          <span class="mute">zakres:</span>
          ${[1, 6, 24, 72, 168].map((h) => `<button class="mini ${h === rng ? 'on' : ''}" data-rng="${h}">${h < 24 ? h + ' h' : (h / 24) + ' d'}</button>`).join('')}
        </div>
        <div class="row">
          <button class="act" data-full="copy">📋 Kopiuj cały log</button>
          <button class="act" data-full="dl">⬇ Pobierz .txt</button>
          <span class="mute fstat">${esc(this._fullStat || '')}</span>
        </div>
        <div class="mute small">Wszystkie zmiany wszystkich encji <code>${esc(pre)}*</code> z historii HA (diagnostyka ESP, surowe ramki C14, temperatury, alarmy…) + stan bieżący, posortowane po czasie.</div>
        ${this._fullText ? `<textarea readonly class="fulltxt">${esc(this._fullText)}</textarea>` : ''}
      </div>
      <div class="sec"><h3>ESP</h3>${espTbl}</div>
      <div class="sec"><h3>Magistrala RS485 / C14</h3>${busTbl}</div>
      <div class="sec">
        <h3>Ostatnie ramki C14 <button class="mini" data-copy>kopiuj</button></h3>
        ${srcTabs}
        ${frames.length ? `<div class="frames">${list}</div>${detail}` : `<div class="mute">Brak ramek. Karta czyta je z <code>${esc(this._id('ramka'))}</code> i encji <code>${esc(this._prefix)}_c14_ramka_*</code> (historia ${esc(this._config.history_hours)} h + na żywo).</div>`}
      </div>
      ${extraSecs}
      <div class="sec"><h3>Log zdarzeń ESP</h3>
        ${log ? `<div class="log">${log}</div>` : `<div class="mute">Brak zdarzeń w ostatnich ${esc(this._config.history_hours)} h. Źródło: <code>${esc(this._id('diag'))}</code> + zmiany alarmu, trybu, biegu, bypassu, filtrów i statusu.</div>`}
      </div>
      <div class="sec"><h3>Encje <code>${esc(pre)}*</code> (${all.length})</h3>
        ${all.length ? `<table class="kv all">${allTbl}</table>` : '<div class="mute">Brak encji z tym prefiksem.</div>'}
        ${missing.length ? `<details><summary>Karta szuka, a nie ma (${missing.length})</summary><div class="miss">${missing.join(' ')}</div><div class="mute">Możesz je podpiąć w <code>entities:</code> w konfiguracji karty.</div></details>` : ''}
      </div>`;
  }

  _genTile(id) {
    const s = this._hass.states[id];
    const u = s.attributes.unit_of_measurement || '';
    const v = BAD.includes(s.state) ? '<span class="mute">—</span>' : id.startsWith('binary_sensor.') ? (s.state === 'on' ? 'TAK' : 'NIE') : esc(String(s.state).slice(0, 60)) + (u ? '<small> ' + esc(u) + '</small>' : '');
    return `<div class="tile" data-e="${esc(id)}"><div class="tl2">${esc(this._shortName(id))}</div><div class="tv2">${v}</div></div>`;
  }

  _fmtAddrs() {
    const s = this._st('adresy');
    if (!s || BAD.includes(s.state)) return undefined;
    const nums = String(s.state).match(/\d+/g);
    if (!nums) return esc(s.state);
    return nums.map((n) => `${n} <span class="mute">${esc(C14_ADDR(Number(n)))}</span>`).join(', ');
  }

  _bars(dbm) {
    const n = dbm >= -55 ? 4 : dbm >= -67 ? 3 : dbm >= -75 ? 2 : dbm >= -85 ? 1 : 0;
    return `<span class="bars">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? 'f' : ''}" style="height:${i * 3 + 2}px"></i>`).join('')}</span>`;
  }

  _frameDetail(f) {
    const frs = parseFrames(f.s);
    if (!frs.length) return `<div class="mute">Nie umiem odczytać ramki jako HEX: <code>${esc(f.s)}</code></div>`;
    return frs.map((b) => {
      const d = decodeFrame(b);
      const cells = b.map((x, i) => {
        const cls = i === 0 ? 'b-dst' : i === 1 ? 'b-cmd' : i === 2 ? 'b-chk' : i === 3 ? 'b-src' : (i === 29 && x === 0x23) ? 'b-end' : '';
        return `<span class="byte ${cls}" title="bajt ${i}: 0x${x.toString(16).padStart(2, '0')} = ${x}"><small>${i}</small>${x.toString(16).toUpperCase().padStart(2, '0')}</span>`;
      }).join('');
      const pairs = d.pairs.filter((p) => p.t !== null).map((p) => `<span class="pair">b${p.i}-${p.i + 1}: ${p.t.toFixed(1)}°</span>`).join('');
      return `<div class="detail">
        <div class="bytes">${cells}</div>
        <div class="dec">
          <span>do: <b>${d.dst === null || d.dst === undefined ? '?' : d.dst}</b> <span class="mute">${d.dst != null ? esc(C14_ADDR(d.dst)) : ''}</span></span>
          <span>od: <b>${d.src === undefined ? '?' : d.src}</b> <span class="mute">${d.src !== undefined ? esc(C14_ADDR(d.src)) : ''}</span></span>
          <span>komenda: <b>${d.cmd === undefined ? '?' : '0x' + d.cmd.toString(16).toUpperCase().padStart(2, '0')}</b></span>
          <span>suma: <b>${d.chk === undefined ? '?' : d.chk}</b></span>
          <span>${d.len} B</span>
          ${d.notes.map((n) => `<span class="err">${esc(n)}</span>`).join('')}
        </div>
        ${pairs ? `<div class="pairs"><span class="mute">Pary H/L jako temperatura (raw−2000)/10, tylko wiarygodne:</span> ${pairs}</div>` : ''}
      </div>`;
    }).join('');
  }

  async _copyText(txt) {
    // navigator.clipboard dziala tylko po https / localhost; HA po http -> textarea + execCommand
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); return true; }
    } catch (e) { /* dalej fallback */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  async _copyFrames() {
    const txt = this._frames.map((f) => f.t.toISOString() + ' ' + (f.k ? '[' + (f.k === 'ramka' ? 'ostatnia' : DEFAULT_E[f.k][2]) + '] ' : '') + f.s).join('\n');
    const ok = await this._copyText(txt);
    const b = this.shadowRoot.querySelector('[data-copy]');
    if (b) b.textContent = ok ? 'skopiowane (' + this._frames.length + ')' : 'nie da się skopiować';
  }

  // pelny log: cala historia wszystkich encji z prefiksem
  async _fullLog(mode) {
    const hours = this._logRange || 24;
    this._fullStat = 'pobieram ' + hours + ' h historii…';
    this._render();
    const pre = this._prefix + '_';
    const ids = Object.keys(this._hass.states).filter((id) => id.split('.')[1] && id.split('.')[1].startsWith(pre)).sort();
    const name = (id) => { const k = Object.keys(DEFAULT_E).find((x) => this._id(x) === id); return k ? DEFAULT_E[k][2] : (this._hass.states[id].attributes.friendly_name || id); };
    const now = new Date();
    const head = [
      '# compit-nano-one-card ' + VERSION + ' — pełny log',
      '# wygenerowano: ' + now.toISOString() + ' (' + now.toLocaleString() + ')',
      '# prefiks: ' + this._prefix + ', zakres: ' + hours + ' h, encji: ' + ids.length,
      '',
      '## Stan bieżący',
    ];
    ids.forEach((id) => {
      const s = this._hass.states[id];
      head.push(id + ' = ' + s.state + (s.attributes.unit_of_measurement ? ' ' + s.attributes.unit_of_measurement : '') + '   (zmiana ' + s.last_changed + ')');
    });
    const lines = [];
    let err = '';
    if (ids.length) {
      const start = new Date(Date.now() - hours * 3600e3).toISOString();
      try {
        // po kilka encji na zapytanie, zeby URL nie byl za dlugi
        for (let i = 0; i < ids.length; i += 25) {
          const chunk = ids.slice(i, i + 25);
          const res = await this._hass.callApi('GET', 'history/period/' + start + '?end_time=' + encodeURIComponent(now.toISOString()) + '&filter_entity_id=' + chunk.join(',') + '&minimal_response&no_attributes');
          (res || []).forEach((arr) => {
            if (!arr || !arr.length) return;
            const eid = arr[0].entity_id;
            arr.forEach((h) => {
              const t = new Date(h.last_changed || (h.lu ? h.lu * 1000 : 0));
              lines.push({ t, l: t.toISOString() + ' | ' + eid + ' | ' + name(eid) + ' | ' + (h.state !== undefined ? h.state : h.s) });
            });
          });
        }
      } catch (e) { err = 'błąd pobierania historii: ' + (e && e.message ? e.message : e); }
    }
    lines.sort((a, b) => a.t - b.t);
    const txt = head.join('\n') + '\n\n## Historia (' + lines.length + ' wpisów)\n' + (err ? '# ' + err + '\n' : '') + lines.map((x) => x.l).join('\n') + '\n';
    if (mode === 'dl') {
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
        a.download = 'nano_one_log_' + now.toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.txt';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        this._fullStat = 'pobrano (' + lines.length + ' wpisów)' + (err ? ', ' + err : '');
      } catch (e) { this._fullText = txt; this._fullStat = 'nie da się pobrać, log poniżej'; }
    } else {
      const ok = await this._copyText(txt);
      this._fullStat = ok ? 'skopiowano ' + lines.length + ' wpisów (' + Math.round(txt.length / 1024) + ' kB)' + (err ? ', ' + err : '') : 'przeglądarka nie dała skopiować, zaznacz log poniżej';
      if (!ok) this._fullText = txt;
    }
    this._render();
    const ta = this.shadowRoot.querySelector('.fulltxt');
    if (ta) { ta.focus(); ta.select(); }
  }
}

const CSS = `
  :host { display:block; }
  ha-card { overflow:hidden; }
  .head { display:flex; align-items:center; justify-content:space-between; padding:14px 16px 6px; gap:8px; flex-wrap:wrap; }
  .title { font-size:1.25em; font-weight:500; color:var(--primary-text-color); }
  .badges { display:flex; gap:6px; flex-wrap:wrap; }
  .badge { font-size:.8em; padding:3px 9px; border-radius:12px; cursor:pointer; background:var(--secondary-background-color); }
  .badge.ok { background:rgba(67,160,71,.18); color:var(--success-color,#43a047); }
  .badge.err { background:rgba(219,68,55,.18); color:var(--error-color,#db4437); }
  .tabs { display:flex; gap:4px; padding:0 12px; border-bottom:1px solid var(--divider-color); }
  .tab { background:none; border:none; padding:10px 14px; cursor:pointer; color:var(--secondary-text-color); font:inherit; border-bottom:2px solid transparent; }
  .tab.on { color:var(--primary-color); border-bottom-color:var(--primary-color); font-weight:500; }
  .body { padding:12px 16px; }
  .foot { padding:4px 16px 10px; font-size:.72em; color:var(--secondary-text-color); }
  code { font-family:var(--code-font-family,monospace); font-size:.9em; }
  .mute { color:var(--secondary-text-color); }
  .ok { color:var(--success-color,#43a047); }
  .warn { color:var(--warning-color,#ffa600); }
  .err { color:var(--error-color,#db4437); }
  .dim { opacity:.5; }
  [data-e] { cursor:pointer; }

  .schema { width:100%; max-height:300px; display:block; color:var(--secondary-text-color); }
  .unit { fill:var(--secondary-background-color); stroke:var(--divider-color); stroke-width:2; }
  .hx { fill:none; stroke:var(--secondary-text-color); stroke-width:1.5; stroke-dasharray:4 3; }
  .hx.byp { opacity:.35; }
  .air { fill:none; stroke-width:5; stroke-linecap:round; stroke-linejoin:round; opacity:.85; }
  .air.cold { stroke:#2f8fd8; color:#2f8fd8; }
  .air.warm { stroke:#e07a2f; color:#e07a2f; }
  .tl { font-size:12px; fill:var(--secondary-text-color); }
  .tv { font-size:21px; font-weight:600; fill:var(--primary-text-color); }
  .eff { font-size:15px; font-weight:600; fill:var(--primary-text-color); }
  .lg { font-size:10px; }
  .lg.cold { fill:#2f8fd8; } .lg.warm { fill:#e07a2f; }
  .fanring { fill:var(--card-background-color,#fff); stroke:var(--divider-color); stroke-width:2; }
  .blade { fill:var(--primary-color); }
  .fv { font-size:11px; fill:var(--primary-text-color); }
  .spin { animation:spin linear infinite; transform-origin:0 0; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation:none; } }

  .flags { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 12px; }
  .flag { font-size:.82em; padding:4px 10px; border-radius:14px; border:1px solid var(--divider-color); }
  .flag.on { border-color:var(--primary-color); color:var(--primary-color); }
  .flag.err { border-color:var(--error-color,#db4437); color:var(--error-color,#db4437); }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:8px; }
  .tile { background:var(--secondary-background-color); border-radius:10px; padding:8px 10px; }
  .tl2 { font-size:.78em; color:var(--secondary-text-color); }
  .tv2 { font-size:1.15em; font-weight:500; margin-top:2px; word-break:break-word; }
  .tile.big .tv2 { font-size:1.4em; }
  .effnote { font-size:.78em; color:var(--secondary-text-color); margin-top:10px; }
  .warnbox { margin-top:10px; padding:8px 10px; border-radius:8px; background:rgba(255,166,0,.15); font-size:.88em; }

  .sec { margin-bottom:16px; }
  h3 { font-size:.95em; font-weight:600; margin:0 0 6px; display:flex; align-items:center; gap:8px; }
  .kv { width:100%; border-collapse:collapse; font-size:.9em; }
  .kv td { padding:4px 4px; border-bottom:1px solid var(--divider-color); vertical-align:top; }
  .kv td:first-child { color:var(--secondary-text-color); width:45%; }
  .kv.all td:first-child { width:60%; word-break:break-all; }
  .bars { display:inline-flex; align-items:flex-end; gap:2px; margin-left:4px; }
  .bars i { width:4px; background:var(--divider-color); border-radius:1px; }
  .bars i.f { background:var(--primary-color); }
  .mini { font:inherit; font-size:.75em; font-weight:400; padding:2px 8px; border-radius:10px; border:1px solid var(--divider-color); background:none; color:var(--primary-text-color); cursor:pointer; }
  .frames { max-height:190px; overflow:auto; border:1px solid var(--divider-color); border-radius:8px; }
  .fr { display:flex; gap:8px; align-items:baseline; padding:3px 8px; font-size:.82em; cursor:pointer; white-space:nowrap; }
  .fr.sel { background:var(--secondary-background-color); }
  .fr code { overflow:hidden; text-overflow:ellipsis; }
  .ft { color:var(--secondary-text-color); font-variant-numeric:tabular-nums; }
  .fa { min-width:52px; }
  .detail { margin-top:8px; }
  .bytes { display:flex; flex-wrap:wrap; gap:3px; }
  .byte { display:flex; flex-direction:column; align-items:center; font-family:var(--code-font-family,monospace); font-size:.82em; padding:2px 4px; border-radius:4px; background:var(--secondary-background-color); min-width:22px; }
  .byte small { font-size:.7em; color:var(--secondary-text-color); }
  .b-dst { background:rgba(47,143,216,.25); } .b-src { background:rgba(224,122,47,.25); }
  .b-cmd { background:rgba(142,68,173,.25); } .b-chk { background:rgba(127,127,127,.3); } .b-end { background:rgba(67,160,71,.25); }
  .dec { display:flex; flex-wrap:wrap; gap:4px 14px; font-size:.85em; margin-top:6px; }
  .pairs { font-size:.8em; margin-top:4px; display:flex; flex-wrap:wrap; gap:4px 10px; }
  .log { max-height:240px; overflow:auto; border:1px solid var(--divider-color); border-radius:8px; }
  .lg-row { display:flex; gap:8px; padding:3px 8px; font-size:.82em; border-bottom:1px solid var(--divider-color); }
  .lg-row .le { color:var(--secondary-text-color); min-width:90px; }
  details { margin-top:8px; font-size:.85em; }
  .rest { margin-top:14px; }
  .q { color:var(--warning-color,#ffa600); font-weight:700; margin-left:2px; }
  .fk { color:var(--secondary-text-color); min-width:70px; }
  .pre { white-space:pre-wrap; word-break:break-all; font-family:var(--code-font-family,monospace); font-size:.78em; background:var(--secondary-background-color); border-radius:8px; padding:8px; margin:0; max-height:200px; overflow:auto; }
  .fullog { background:var(--secondary-background-color); border-radius:10px; padding:10px 12px; }
  .row { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:6px; }
  .mini.on { border-color:var(--primary-color); color:var(--primary-color); }
  .act { font:inherit; font-size:.9em; padding:6px 12px; border-radius:8px; border:none; cursor:pointer; background:var(--primary-color); color:var(--text-primary-color,#fff); }
  .small { font-size:.78em; }
  .fulltxt { width:100%; box-sizing:border-box; height:180px; margin-top:6px; font-family:var(--code-font-family,monospace); font-size:.75em; }
  .miss { display:flex; flex-wrap:wrap; gap:4px 10px; margin:6px 0; }
`;

if (!customElements.get('compit-nano-one-card')) customElements.define('compit-nano-one-card', CompitNanoOneCard);
window.customCards = window.customCards || [];
if (!window.customCards.find((c) => c.type === 'compit-nano-one-card')) {
  window.customCards.push({
    type: 'compit-nano-one-card',
    name: 'Compit Nano One – rekuperacja',
    description: 'Rekuperator (temperatury, wentylatory, bypass, filtry, tryby, alarmy) + Diagnostyka ESP i magistrali C14',
    preview: false,
  });
}
console.info('%c COMPIT-NANO-ONE-CARD %c ' + VERSION + ' ', 'background:#2f8fd8;color:#fff', 'background:#444;color:#fff');
})();
