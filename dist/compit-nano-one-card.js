/*
 * compit-nano-one-card  v1.5
 * Karta Home Assistant dla rekuperacji sterowanej przez Compit Nano One (RS485, protokol C14),
 * czytanej przez ESP z ESPHome. Jeden plik, bez zaleznosci.
 *
 *   type: custom:compit-nano-one-card
 *   prefix: nano_one          # opcjonalnie, poczatek ID encji z ESPHome (domyslnie nano_one)
 *   title: Rekuperacja        # opcjonalnie
 *   tab: rekuperator          # opcjonalnie, zakladka startowa: rekuperator | diagnostyka
 *   theme: dark               # opcjonalnie: dark (domyslnie, wg wzoru) | light (kolory motywu HA)
 *   niepewne: [t_czerpnia, t_wywiew]  # opcjonalnie, klucze oznaczane "?" (niepewne mapowanie); [] = zadne
 *   history_hours: 6          # opcjonalnie, ile godzin wstecz czytac log i ramki w Diagnostyce
 *   entities:                 # opcjonalnie, nadpisanie pojedynczych encji
 *     t_nawiew: sensor.moja_temperatura_nawiewu
 *
 * Kazdy klucz z DEFAULT_E szukany jest jako <domena>.<prefix>_<koncowka>.
 * Jesli encji nie ma w podanej domenie, karta szuka tej samej koncowki w innych domenach.
 */
(() => {
const VERSION = 'v1.5';

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
  // v1.2: YAML v1.4 - stan i sterowanie (zapis jako iNext)
  status_went:  ['sensor', 'status_wentylatorow',        'Status wentylatorów', ''],
  bieg_centr:   ['sensor', 'bieg_centrali',              'Bieg centrali',    ''],
  harm_akt:     ['binary_sensor', 'harmonogram_aktywny', 'Harmonogram',      ''],
  set_tryb:     ['select', 'ustaw_tryb',                 'Tryb pracy',       ''],
  set_bieg:     ['select', 'ustaw_bieg',                 'Bieg',             ''],
  set_program:  ['select', 'ustaw_program',              'Program',          ''],
  set_sezon:    ['select', 'ustaw_sezon',                'Sezon',            ''],
  set_bypass:   ['select', 'ustaw_bypass',               'Bypass',           ''],
  sw_wietrz:    ['switch', 'wietrzenie',                 'Wietrzenie',       ''],
  nadawanie:    ['switch', 'sterowanie_z_ha_inext|sterowanie_z_ha|nadawanie_inext', 'Sterowanie z HA (iNext)', ''],
  t_reczna:     ['number', 'temperatura_reczna',         'Ręczna',           '°C'],
  t_dzien:      ['number', 'temperatura_dzien',          'Dzień',            '°C'],
  t_noc:        ['number', 'temperatura_noc',            'Noc',              '°C'],
  t_poza:       ['number', 'temperatura_poza_domem',     'Poza domem',       '°C'],
  p_n1:         ['number', 'nawiew_bieg_1',              'Nawiew bieg 1',    '%'],
  p_n2:         ['number', 'nawiew_bieg_2',              'Nawiew bieg 2',    '%'],
  p_n3:         ['number', 'nawiew_bieg_3',              'Nawiew bieg 3',    '%'],
  p_nw:         ['number', 'nawiew_wietrzenie',          'Nawiew wietrzenie','%'],
  p_w1:         ['number', 'wywiew_bieg_1',              'Wywiew bieg 1',    '%'],
  p_w2:         ['number', 'wywiew_bieg_2',              'Wywiew bieg 2',    '%'],
  p_w3:         ['number', 'wywiew_bieg_3',              'Wywiew bieg 3',    '%'],
  p_ww:         ['number', 'wywiew_wietrzenie',          'Wywiew wietrzenie','%'],
  ramki_tx:     ['sensor', 'ramki_wyslane_inext',        'Ramki wysłane iNext', ''],
  inext:        ['sensor', 'c14_inext',                  'Ostatnia wymiana iNext', ''],
};

// ikony (viewBox 24x24, stroke)
const ICO = {
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2M4 10.5l3.4-.6-1-3.3M20 13.5l-3.4.6 1 3.3M4 13.5l3.4.6-1 3.3M20 10.5l-3.4-.6 1-3.3"/>',
  home: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>',
  waves:'<path d="M3 8c3-2 6 2 9 0s6-2 9 0M3 12c3-2 6 2 9 0s6-2 9 0M3 16c3-2 6 2 9 0s6-2 9 0"/>',
  exit: '<path d="M14 4H5v16h9M10 12h11M17 8l4 4-4 4"/>',
  sync: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4"/>',
  shuf: '<path d="M3 7h4c4 0 6 10 10 10h4M3 17h4c4 0 6-10 10-10h4M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  filt: '<path d="M4 5h16v14H4zM7 9h10M7 12h10M7 15h10"/>',
  sun:  '<path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>',
  lock: '<path d="M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4"/>',
};
const ico = (k, cls) => `<svg viewBox="0 0 24 24" class="ico ${cls || ''}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;
const fmtT = (v) => v === null ? '—' : v.toFixed(1).replace('.', ',') + '°C';

// zrodla ramek w Diagnostyce (klucz 'ramka' = ostatnia dowolna)
const FRAME_KEYS = ['ramka', 'r_nano_st', 'r_nano_nast', 'r_e3_3a', 'r_e3_3b', 'r_aero', 'r_bajty'];
// encje, ktorych zmiany ida do logu zdarzen
const LOG_KEYS = ['diag', 'alarm', 'status', 'magistrala', 'tryb', 'bieg', 'bypass', 'filtr', 'sezon', 'bypass_tryb',
  'wietrzenie', 'urlop', 'poza_domem', 'went_aktywna', 'chlodzenie', 'nano_nadaje', 'aero_odp', 'kominek', 'gwc',
  'status_went', 'harm_akt', 'nadawanie', 'inext'];

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

  connectedCallback() {
    if (this._hookedPtr) return;
    this._hookedPtr = true;
    this.shadowRoot.addEventListener('pointerdown', () => { this._holding = true; });
    const up = () => { if (!this._holding) return; this._holding = false; if (this._dirty) { this._dirty = false; setTimeout(() => this._schedule(), 0); } };
    this.shadowRoot.addEventListener('pointerup', up);
    this.shadowRoot.addEventListener('pointercancel', up);
    this.shadowRoot.addEventListener('pointerleave', up, true);
  }

  static getStubConfig() { return { prefix: 'nano_one' }; }
  getCardSize() { return 8; }

  setConfig(config) {
    this._config = Object.assign({ prefix: 'nano_one', title: 'Rekuperacja', history_hours: 6 }, config || {});
    this._prefix = String(this._config.prefix).replace(/\.$/, '').replace(/^[a-z_]+\./, '');
    if (this._config.tab) this._tab = this._config.tab;
    this._resolved = {};
    this._idxSrc = null;
    this._histLoaded = false;
    this._schedule();
  }

  // ID encji dla klucza (z nadpisaniem i szukaniem w innych domenach)
  // indeks encji z prefiksem, przebudowywany przy kazdej nowej wersji hass.states
  _idx() {
    const st = this._hass && this._hass.states;
    if (!st) return [];
    if (this._idxSrc !== st) {
      this._idxSrc = st;
      const pre = this._prefix + '_';
      this._idxList = Object.keys(st).filter((id) => { const o = id.split('.')[1]; return o && o.startsWith(pre); });
      this._resolved = {};
    }
    return this._idxList;
  }

  // ID encji dla klucza. v1.4: oprocz dokladnej nazwy lapie tez warianty z koncowka _2, _3...
  // (HA dodaje je, gdy po zmianie nazwy w YAML stara encja zostala w rejestrze) i wybiera ta, ktora ma dane.
  _id(key) {
    const ov = this._config.entities && this._config.entities[key];
    if (ov) return ov;
    const list = this._idx();
    if (this._resolved[key]) return this._resolved[key];
    const [dom, sufs] = DEFAULT_E[key];
    const alts = String(sufs).split('|');
    let best = null, bestScore = -1;
    alts.forEach((suf, ai) => {
      const re = new RegExp('^([a-z_]+)\\.' + this._prefix + '_' + suf + '(_(\\d+))?$');
      list.forEach((id) => {
        const m = id.match(re);
        if (!m) return;
        const s = this._hass.states[id];
        const score = (s && !BAD.includes(s.state) ? 1000 : 0) + (m[1] === dom ? 100 : 0) + (10 - Math.min(ai, 9)) + (m[2] ? 0 : 1);
        if (score > bestScore) { bestScore = score; best = id; }
      });
    });
    const id = best || (dom + '.' + this._prefix + '_' + alts[0]);
    this._resolved[key] = id;
    return id;
  }
  // encje z koncowka _2, _3... (osierocone duplikaty po zmianie nazw w YAML)
  _dupes() {
    const list = this._idx();
    return list.filter((id) => /_\d+$/.test(id) && !/(bieg|rejestr|f\d+|t\d+|wywiew|nawiew)_\d+$/.test(id) && list.includes(id.replace(/_\d+$/, '')));
  }
  _st(key) { return this._hass ? this._hass.states[this._id(key)] : undefined; }
  // "?" w nazwie encji z ESPHome = mapowanie niepewne
  _unsure(id) {
    const s = this._hass && this._hass.states[id];
    if (!s) return false;
    if (/\?/.test(s.attributes.friendly_name || '')) return true;
    // v1.2: czerpnia i wywiew z rejestrow Nano - do potwierdzenia (wylacz: niepewne: [])
    const list = Array.isArray(this._config.niepewne) ? this._config.niepewne : ['t_czerpnia', 't_wywiew'];
    return list.some((k) => DEFAULT_E[k] && this._id(k) === id);
  }
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
    if (s.entity_id.startsWith('switch.')) return s.state === 'on' ? 'WŁ.' : 'WYŁ.';
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
    // v1.4: HA podaje nowe hass przy KAZDEJ zmianie dowolnej encji w domu. Przerysowuj tylko,
    // gdy zmienila sie ktoras encja z prefiksem - inaczej animacje skacza, a klik potrafi przepasc.
    const ids = this._idx();
    const changed = first || !this._seen || ids.length !== this._seen.size || ids.some((id) => this._seen.get(id) !== hass.states[id]);
    if (!changed) return;
    this._seen = new Map(ids.map((id) => [id, hass.states[id]]));
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
    // nie przerysowuj w trakcie klikniecia (miedzy wcisnieciem a puszczeniem)
    if (this._holding || this._edit) { this._dirty = true; return; }
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
      <ha-card class="${this._config.theme === 'light' ? 'light' : 'dark'}">
        <div class="head">
          <div class="brand">${ico('wind', 'big')}<span class="sep"></span>
            <div><div class="title">${esc(String(this._config.title).toUpperCase())}</div><div class="sub">COMPIT · C14</div></div></div>
          <div class="badges">
            ${alarmOn ? `<span class="badge err" data-e="${esc(this._id('alarm'))}">⚠ ${esc(alarm.state)}</span>` : ''}
            ${this._workBadge(online)}
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
    this.shadowRoot.querySelectorAll('[data-pop]').forEach((el) => el.addEventListener('click', () => { this._pop = this._pop === el.dataset.pop ? null : el.dataset.pop; this._render(); }));
    this.shadowRoot.querySelectorAll('[data-popclose]').forEach((el) => el.addEventListener('click', () => { this._pop = null; this._render(); }));
    this.shadowRoot.querySelectorAll('[data-opt]').forEach((el) => el.addEventListener('click', () => this._selectOpt(el.dataset.optkey, el.dataset.opt)));
    this.shadowRoot.querySelectorAll('[data-num]').forEach((el) => el.addEventListener('click', () => this._numStep(el.dataset.num, Number(el.dataset.dir))));
    this.shadowRoot.querySelectorAll('[data-edit]').forEach((el) => el.addEventListener('click', (ev) => { ev.stopPropagation(); this._edit = el.dataset.edit; this._render(); }));
    this.shadowRoot.querySelectorAll('[data-save]').forEach((el) => el.addEventListener('click', () => this._saveEdit(el.dataset.save, el.parentNode.querySelector('[data-inp]'))));
    this.shadowRoot.querySelectorAll('[data-cancel]').forEach((el) => el.addEventListener('click', () => { this._edit = null; this._render(); }));
    this.shadowRoot.querySelectorAll('[data-inp]').forEach((el) => el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') this._saveEdit(el.dataset.inp, el); if (ev.key === 'Escape') { this._edit = null; this._render(); } }));
    const inp = this.shadowRoot.querySelector('[data-inp]');
    if (inp) {
      if (this._focusEdit !== this._edit) { this._focusEdit = this._edit; setTimeout(() => { inp.focus(); inp.select(); }, 0); }
    } else this._focusEdit = null;
    this.shadowRoot.querySelectorAll('[data-wiet]').forEach((el) => el.addEventListener('click', () => {
      const w = this._st('sw_wietrz'); if (!w) return;
      this._call('switch', w.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: w.entity_id }, 'Wietrzenie → ' + (w.state === 'on' ? 'WYŁ.' : 'WŁ.'));
    }));
    this.shadowRoot.querySelectorAll('[data-tx]').forEach((el) => el.addEventListener('click', () => {
      const n = this._st('nadawanie');
      if (n) {
        this._call('switch', n.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: n.entity_id }, 'Sterowanie z HA → ' + (n.state === 'on' ? 'WYŁ.' : 'WŁ.'));
      }
      this._render();
    }));
    const body = this.shadowRoot.querySelector('.body');
    if (body) body.scrollTop = sc;
  }

  // plakietka PRACA / WYBIEG / STOP / OFFLINE
  _workBadge(online) {
    let txt, cls, eid = this._id('status_went');
    const sw = this._st('status_went'), wa = this._st('went_aktywna');
    if (online === false) { txt = 'OFFLINE'; cls = 'err'; eid = this._id('status'); }
    else if (sw && !BAD.includes(sw.state)) {
      const v = sw.state.toLowerCase();
      if (/prac/.test(v)) { txt = 'PRACA'; cls = 'ok'; }
      else if (/wybieg/.test(v)) { txt = 'WYBIEG'; cls = 'warn'; }
      else if (/stop|wył|wyl/.test(v)) { txt = 'STOP'; cls = 'mute'; }
      else { txt = sw.state.toUpperCase(); cls = 'mute'; }
    } else if (wa && !BAD.includes(wa.state)) { txt = wa.state === 'on' ? 'PRACA' : 'STOP'; cls = wa.state === 'on' ? 'ok' : 'mute'; eid = wa.entity_id; }
    else if (online === null) { txt = 'ESP ?'; cls = 'mute'; eid = this._id('status'); }
    else { txt = 'ONLINE'; cls = 'ok'; eid = this._id('status'); }
    return `<span class="badge work ${cls}" data-e="${esc(eid)}"><i class="dot"></i>${esc(txt)}</span>`;
  }

  _running() {
    const sw = this._st('status_went');
    if (sw && !BAD.includes(sw.state)) return /prac|wybieg/i.test(sw.state);
    const wa = this._st('went_aktywna');
    if (wa && !BAD.includes(wa.state)) return wa.state === 'on';
    const f = num(this._st('went_nawiew'));
    return f !== null && f > 0;
  }

  // zapis dozwolony? (gdy jest przelacznik "Nadawanie iNext", musi byc WL)
  // v1.5: przyciski nigdy nie sa zablokowane - karta sama wlacza "Sterowanie z HA" przed zapisem
  _canWrite() { return true; }

  _flashMsg(ok, txt) {
    this._flash = { ok, txt, t: Date.now() };
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => { this._flash = null; this._schedule(); }, 6000);
    this._schedule();
  }

  // czeka, az encja przyjmie stan (HA podaje nowe hass), max ms
  _waitState(eid, state, ms) {
    return new Promise((res) => {
      const t0 = Date.now();
      const tick = () => {
        const s = this._hass && this._hass.states[eid];
        if (s && s.state === state) return res(true);
        if (Date.now() - t0 > ms) return res(false);
        setTimeout(tick, 150);
      };
      tick();
    });
  }

  async _call(domain, service, data, label) {
    const lockId = this._id('nadawanie');
    const isLock = domain === 'switch' && data.entity_id === lockId;
    const st = this._st('status');
    if (st && st.state !== 'on') { this._flashMsg(false, 'ESP offline – zmiana nie poszła: ' + label); return; }
    this._pushLog({ t: new Date(), e: 'karta', s: 'Zapis: ' + label });
    try {
      const lock = this._st('nadawanie');
      if (!isLock && lock && lock.state !== 'on') {
        this._flashMsg(true, 'Włączam „Sterowanie z HA”…');
        await this._hass.callService('switch', 'turn_on', { entity_id: lockId });
        this._pushLog({ t: new Date(), e: 'karta', s: 'Sterowanie z HA → WŁ. (automatycznie)' });
        if (!(await this._waitState(lockId, 'on', 5000))) throw new Error('ESP nie włączył „Sterowanie z HA”');
      }
      await this._hass.callService(domain, service, data);
      this._flashMsg(true, '✓ wysłane: ' + label);
    } catch (e) {
      const m = e && e.message ? e.message : String(e);
      this._pushLog({ t: new Date(), e: 'karta', s: 'Błąd zapisu (' + label + '): ' + m });
      this._flashMsg(false, '✗ błąd: ' + label + ' – ' + m);
    }
  }

  // encje sterujace, ktorych brakuje w HA (YAML v1.6)
  _missingCtl() {
    const need = [['set_tryb', 'set_bieg'], ['set_sezon'], ['set_bypass'], ['nadawanie'], ['t_reczna'], ['t_dzien'], ['t_noc'], ['t_poza'],
      ['p_n1'], ['p_n2'], ['p_n3'], ['p_nw'], ['p_w1'], ['p_w2'], ['p_w3'], ['p_ww']];
    return need.filter((alts) => !alts.some((k) => this._st(k))).map((alts) => this._id(alts[0]));
  }

  _missingBox() {
    const miss = this._missingCtl();
    if (!miss.length) return '';
    const all = miss.length >= 10;
    return `<div class="errbox"><b>${all ? 'Brak encji sterujących w HA – wgraj na ESP YAML v1.6.' : 'Brakuje części encji sterujących (YAML v1.6).'}</b>
      <div class="small">Jak v1.6 już jest wgrany: Ustawienia → Urządzenia i usługi → ESPHome → Nano One → ⋮ → Przeładuj. Sprawdź też, czy encje nie są wyłączone (Ustawienia → Encje → filtr „wyłączone”).</div>
      <details><summary>Czego brakuje (${miss.length})</summary><div class="miss">${miss.map((x) => `<code>${esc(x)}</code>`).join(' ')}</div></details></div>`;
  }

  _selectOpt(key, opt) {
    const id = this._id(key);
    this._pop = null;
    this._call('select', 'select_option', { entity_id: id, option: opt }, DEFAULT_E[key][2] + ' → ' + opt);
  }

  _numStep(key, dir) {
    const s = this._st(key);
    if (!s || BAD.includes(s.state)) return;
    const a = s.attributes, step = Number(a.step) || 1;
    let v = Number(s.state) + dir * step;
    if (a.min !== undefined) v = Math.max(Number(a.min), v);
    if (a.max !== undefined) v = Math.min(Number(a.max), v);
    v = Math.round(v / step) * step;
    v = Number(v.toFixed(3));
    this._call('number', 'set_value', { entity_id: s.entity_id, value: v }, DEFAULT_E[key][2] + ' → ' + v + (a.unit_of_measurement ? ' ' + a.unit_of_measurement : ''));
  }

  // ---------------- schemat wg wzoru ----------------
  _renderHero(bypassOn) {
    const run = this._running();
    const tile = (key, x, y, icon, cls, label) => {
      const id = this._id(key), s = this._st(key);
      const v = num(s);
      const q = this._unsure(id) ? '<tspan class="hq"> ?</tspan>' : '';
      return `<g class="lnk" data-e="${esc(id)}">
        <rect x="${x}" y="${y}" width="172" height="78" rx="14" class="htile"/>
        <g transform="translate(${x + 14} ${y + 23}) scale(1.35)" class="${cls}"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICO[icon]}</g></g>
        <line x1="${x + 58}" y1="${y + 18}" x2="${x + 58}" y2="${y + 60}" class="hsep"/>
        <text x="${x + 70}" y="${y + 31}" class="hlbl">${label}${q}</text>
        <text x="${x + 70}" y="${y + 61}" class="hval">${s && !BAD.includes(s.state) ? fmtT(v) : '—'}</text></g>`;
    };
    // osmiokat wymiennika
    const cx = 320, cy = 150, R = 74;
    const oct = Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return (cx + R * Math.cos(a)).toFixed(1) + ',' + (cy + R * Math.sin(a)).toFixed(1); }).join(' ');
    const cold = bypassOn
      ? 'M182 74 H214 C236 74 236 30 262 30 H378 C404 30 404 74 426 74 H458'
      : 'M182 74 H214 C258 74 262 168 320 168 C378 168 382 74 426 74 H458';
    const warm = 'M182 226 H214 C258 226 262 132 320 132 C378 132 382 226 426 226 H458';
    const fan = (x, y) => `<g transform="translate(${x} ${y})"><circle r="25" class="hfan"/>
      <g class="${run ? 'spin' : ''}" style="animation-duration:1.4s"><path d="M0 -17 C8 -15 7 -4 0 0 C-7 -4 -8 -15 0 -17Z M14.7 8.5 C10.5 15.5 1 11 0 0 C10 -1 17 3 14.7 8.5Z M-14.7 8.5 C-17 3 -10 -1 0 0 C-1 11 -10.5 15.5 -14.7 8.5Z" class="hblade"/></g><circle r="4" class="hhub"/></g>`;
    const arrows = (x, y, cls) => `<text x="${x}" y="${y + 6}" text-anchor="middle" class="harr ${cls} ${run ? 'blink' : ''}">›››</text>`;
    return `
      <svg viewBox="0 0 640 300" class="hero" role="img" aria-label="Schemat rekuperatora">
        <defs>
          <filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="9" class="hhatch"/></pattern>
        </defs>
        <rect x="212" y="12" width="216" height="270" rx="18" class="hunit"/>
        <rect x="290" y="12" width="60" height="26" rx="4" class="hcap"/>
        ${fan(262, 58)}${fan(378, 58)}
        <polygon points="${oct}" class="hoct ${bypassOn ? 'byp' : ''}"/>
        <polygon points="${oct}" fill="url(#hatch)" class="${bypassOn ? 'byp' : ''}"/>
        <path d="${warm}" class="hs warm" filter="url(#glow)"/>
        <path d="${cold}" class="hs cold" filter="url(#glow)"/>
        ${run ? `<path d="${warm}" class="hflow"/><path d="${cold}" class="hflow"/>` : ''}
        ${arrows(198, 74, 'cold')}${arrows(442, 74, 'cold')}${arrows(198, 226, 'warm')}${arrows(442, 226, 'warm')}
        ${bypassOn ? '<text x="320" y="22" text-anchor="middle" class="hbyp">BYPASS</text>' : ''}
        ${tile('t_czerpnia', 8, 35, 'snow', 'cold', 'CZERPNIA')}
        ${tile('t_wywiew', 8, 187, 'home', 'warm', 'WYWIEW')}
        ${tile('t_nawiew', 460, 35, 'waves', 'cold', 'NAWIEW')}
        ${tile('t_wyrzutnia', 460, 187, 'exit', 'warm', 'WYRZUT')}
      </svg>`;
  }

  _renderGauge() {
    const b = this._st('bieg'), bc = this._st('bieg_centr');
    const pct = num(this._st('went_nawiew'));
    let bl = b && !BAD.includes(b.state) ? String(b.state) : '—';
    if (/^\d+$/.test(bl)) bl = 'BIEG ' + bl; else bl = bl.toUpperCase();
    const C = 2 * Math.PI * 38, p = pct === null ? 0 : Math.max(0, Math.min(100, pct));
    const run = this._running();
    const gp = this._st('set_tryb') ? 'tryb' : 'bieg';
    const can = !!this._st('set_' + gp);
    return `<div class="gauge click" data-pop="${can ? gp : 'missing'}">
      <svg viewBox="0 0 100 100" class="ring"><circle cx="50" cy="50" r="38" class="rbg"/>
        <circle cx="50" cy="50" r="38" class="rfg" stroke-dasharray="${(C * p / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/>
        <g transform="translate(50 50)"><g class="${run ? 'spin' : ''}" style="animation-duration:2s"><path d="M0 -16 C7 -14 6 -4 0 0 C-6 -4 -7 -14 0 -16Z M13.9 8 C10 14.5 1 10.5 0 0 C9.5 -1 16 3 13.9 8Z M-13.9 8 C-16 3 -9.5 -1 0 0 C-1 10.5 -10 14.5 -13.9 8Z" class="rblade"/></g></g></svg>
      <span class="gsep"></span>
      <div><div class="glbl">${esc(bl)}</div><div class="gval">${pct === null ? '—' : Math.round(pct) + '%'}</div>
        ${bc && !BAD.includes(bc.state) ? `<div class="gsub">centrala: bieg ${esc(bc.state)}${num(this._st('went_wywiew')) !== null ? ' · wywiew ' + Math.round(num(this._st('went_wywiew'))) + '%' : ''}</div>` : ''}
        ${can ? '<div class="gsub">kliknij, by zmienić</div>' : ''}</div>
    </div>`;
  }

  _renderBar() {
    const st = (k) => { const s = this._st(k); return s && !BAD.includes(s.state) ? s.state : null; };
    const prog = st('tryb'), byp = st('bypass_tryb'), sez = st('sezon'), filtr = st('filtr');
    const bypOpen = this._st('bypass') && this._st('bypass').state === 'on';
    const cell = (pop, key, icon, label, val, cls, pill) => {
      const can = !!this._st(pop ? 'set_' + pop : '');
      const attr = `data-pop="${can ? pop : 'missing'}"`;
      return `<div class="bcell click ${this._pop === pop ? 'open' : ''}" ${attr}>
        ${pill ? `<span class="pill">${ico(icon)}<b>${esc(val || '—')}</b></span>` : `${ico(icon, cls)}<span class="bl">${label}</span> <b class="${cls}">${esc(val || '—')}</b>`}</div>`;
    };
    const filtrOk = filtr === null ? null : !/(wymie|brud|zabr|alarm|on|1)/i.test(filtr);
    return `<div class="bar">
      ${cell(this._st('set_tryb') ? 'tryb' : 'program', 'tryb', 'sync', 'PROGRAM', prog ? prog.toUpperCase() : null, '', true)}
      ${cell('bypass', 'bypass_tryb', 'shuf', 'BYPASS', (byp ? byp.toUpperCase() : (this._st('bypass') ? (bypOpen ? 'OTWARTY' : 'ZAMKNIĘTY') : null)) + (byp && bypOpen ? ' ·  OTW.' : ''), 'acc')}
      ${cell('sezon', 'sezon', 'sun', 'SEZON', sez ? sez.toUpperCase() : null, 'acc')}
      <div class="bcell" data-e="${esc(this._id('filtr'))}">${ico('filt', filtrOk === false ? 'bad' : 'good')}<span class="bl">FILTR</span> <b class="${filtrOk === null ? 'mute' : filtrOk ? 'good' : 'bad'}">${filtr === null ? '—' : filtrOk ? 'OK' : esc(filtr.toUpperCase())}</b></div>
    </div>${this._renderPop()}`;
  }

  _renderPop() {
    if (!this._pop) return '';
    if (this._pop === 'missing') return `<div class="pop"><div class="poph">Nie mogę tego zmienić<button class="mini x" data-popclose>✕</button></div>${this._missingBox()}</div>`;
    if (this._pop === 'temp') {
      const t = ['t_reczna', 't_dzien', 't_noc', 't_poza'].map((k) => this._numCtl(k, 1)).join('');
      if (!t) return '';
      return `<div class="pop"><div class="poph">Temperatury zadane${this._canWrite() ? '' : ' <span class="warn">(zapis wyłączony, włącz „Sterowanie z HA”)</span>'}<button class="mini x" data-popclose>✕</button></div><div class="nwrap">${t}</div></div>`;
    }
    const key = 'set_' + this._pop;
    const s = this._st(key);
    if (!s) return '';
    const opts = s.attributes.options || [];
    const can = this._canWrite();
    return `<div class="pop">
      <div class="poph">${esc(DEFAULT_E[key][2])}: wybierz${can ? '' : ' <span class="warn">(zapis wyłączony, włącz „Sterowanie z HA”)</span>'}<button class="mini x" data-popclose>✕</button></div>
      ${this._flashBox()}
      <div class="row">${opts.map((o) => `<button class="opt ${o === s.state ? 'on' : ''}" data-opt="${esc(o)}" data-optkey="${key}" ${can ? '' : 'disabled'}>${esc(o)}</button>`).join('')}</div>
    </div>`;
  }

  _renderControls() {
    const has = (k) => !!this._st(k);
    const can = this._canWrite();
    const numCtl = (k, digits) => this._numCtl(k, digits);
    const nadaw = this._st('nadawanie');
    const wiet = this._st('sw_wietrz');
    const temps = ['t_reczna', 't_dzien', 't_noc', 't_poza'].map((k) => numCtl(k, 1)).join('');
    const pcts = [['p_n1', 'p_w1', 'Bieg 1'], ['p_n2', 'p_w2', 'Bieg 2'], ['p_n3', 'p_w3', 'Bieg 3'], ['p_nw', 'p_ww', 'Wietrzenie']]
      .filter(([a, b]) => has(a) || has(b))
      .map(([a, b, l]) => `<tr><td>${l}</td><td>${this._pctCell(a, can)}</td><td>${this._pctCell(b, can)}</td></tr>`).join('');
    let lock = '';
    if (nadaw) {
      const on = nadaw.state === 'on';
      lock = `<div class="lock ${on ? 'on' : ''}">${ico('lock')}<span>Sterowanie z HA (iNext): <b>${on ? 'WŁ.' : 'WYŁ. – włączy się samo przy pierwszej zmianie'}</b></span>
        <button class="mini" data-tx="toggle">${on ? 'Wyłącz' : 'Włącz'}</button></div>`;
    }
    return `<div class="ctl">
      <h3 class="rest">Sterowanie</h3>
      ${this._flashBox()}
      ${this._offlineBox()}
      ${this._missingBox()}
      ${lock}
      ${wiet ? `<div class="row"><button class="opt ${wiet.state === 'on' ? 'on' : ''}" data-wiet ${can ? '' : 'disabled'}>${ico('wind')} Wietrzenie: ${wiet.state === 'on' ? 'WŁ.' : 'WYŁ.'}</button></div>` : ''}
      ${temps ? `<div class="sublbl">Temperatury zadane</div><div class="nwrap">${temps}</div>` : ''}
      ${pcts ? `<div class="sublbl">Biegi % (nawiew / wywiew)</div><table class="ptab"><tr><th></th><th>Nawiew</th><th>Wywiew</th></tr>${pcts}</table>` : ''}
    </div>`;
  }

  _flashBox() {
    const f = this._flash;
    return f ? `<div class="flash ${f.ok ? 'ok' : 'bad'}">${esc(f.txt)}</div>` : '';
  }
  _offlineBox() {
    const st = this._st('status');
    return st && st.state !== 'on' ? '<div class="errbox"><b>ESP offline</b> – karta nie może teraz nic zmienić.</div>' : '';
  }

  _pctCell(k, can) {
    const s = this._st(k);
    if (!s) return '<span class="mute">—</span>';
    const v = num(s);
    if (this._edit === k) return this._editor(k);
    return `<span class="pc"><button class="pm" data-num="${k}" data-dir="-1" ${can ? '' : 'disabled'}>−</button><b class="edv" data-edit="${k}" title="kliknij, by wpisać wartość">${v === null ? '—' : Math.round(v) + '%'}</b><button class="pm" data-num="${k}" data-dir="1" ${can ? '' : 'disabled'}>+</button></span>`;
  }

  // v1.4: pole z liczba + przyciski -/+; klik w wartosc = wpisanie liczby z klawiatury
  // ktory wybor otworzyc po kliknieciu w kafel / plakietke (gdy jest encja sterujaca)
  _popFor(key) {
    const tr = this._st('set_tryb') ? 'tryb' : null;
    const map = { tryb: tr || 'program', bieg: tr || 'bieg', bieg_zadany: tr || 'bieg', sezon: 'sezon', sezon_rej: 'sezon', bypass_tryb: 'bypass', bypass: 'bypass', bypass_rej: 'bypass', t_zadana: 'temp' };
    const pp = map[key];
    if (!pp) return null;
    if (pp === 'temp') return ['t_reczna', 't_dzien', 't_noc', 't_poza'].some((k) => this._st(k)) ? 'temp' : 'missing';
    return this._st('set_' + pp) ? pp : 'missing';
  }

  _numCtl(k, digits) {
    const s = this._st(k);
    if (!s) return '';
    const can = this._canWrite();
    const v = num(s), u = s.attributes.unit_of_measurement || DEFAULT_E[k][3];
    return `<div class="nctl"><span class="nl" data-e="${esc(s.entity_id)}">${esc(DEFAULT_E[k][2])}</span>
      ${this._edit === k ? this._editor(k) : `<button class="pm" data-num="${k}" data-dir="-1" ${can ? '' : 'disabled'}>−</button>
      <b class="nv edv" data-edit="${k}" title="kliknij, by wpisać wartość">${v === null ? '—' : v.toFixed(digits).replace('.', ',')}<small> ${esc(u)}</small></b>
      <button class="pm" data-num="${k}" data-dir="1" ${can ? '' : 'disabled'}>+</button>`}</div>`;
  }

  _editor(k) {
    const s = this._st(k), a = s.attributes, can = this._canWrite();
    return `<span class="ned"><input type="text" inputmode="decimal" class="ninp" data-inp="${k}" value="${esc(s.state)}"
      ${a.min !== undefined ? `min="${a.min}"` : ''} ${a.max !== undefined ? `max="${a.max}"` : ''} step="${a.step || 1}">
      <button class="mini ok" data-save="${k}" ${can ? '' : 'disabled'}>OK</button><button class="mini" data-cancel>✕</button>
      ${can ? '' : '<span class="warn small">zapis wyłączony</span>'}</span>`;
  }

  _saveEdit(k, inp) {
    inp = inp || this.shadowRoot.querySelector(`[data-inp="${k}"]`);
    const s = this._st(k);
    if (!inp || !s) return;
    let v = parseFloat(String(inp.value).replace(',', '.'));
    if (isNaN(v)) return;
    const a = s.attributes;
    if (a.min !== undefined) v = Math.max(Number(a.min), v);
    if (a.max !== undefined) v = Math.min(Number(a.max), v);
    const step = Number(a.step) || 1;
    v = Number((Math.round(v / step) * step).toFixed(3));
    this._edit = null; this._dirty = false;
    this._call('number', 'set_value', { entity_id: s.entity_id, value: v }, DEFAULT_E[k][2] + ' → ' + v + (a.unit_of_measurement ? ' ' + a.unit_of_measurement : ''));
    this._render();
  }

  // ---------------- zakladka Rekuperator ----------------
  _renderReku() {
    const tc = num(this._st('t_czerpnia')), tn = num(this._st('t_nawiew')), tw = num(this._st('t_wywiew')), tr = num(this._st('t_wyrzutnia'));
    let eff = num(this._st('sprawnosc'));
    if (eff === null && tc !== null && tn !== null && tw !== null && Math.abs(tw - tc) >= 3) eff = Math.max(0, Math.min(100, (tn - tc) / (tw - tc) * 100));
    const bypassOn = this._st('bypass') && this._st('bypass').state === 'on';
    const fN = num(this._st('went_nawiew')), fW = num(this._st('went_wywiew'));
    const spin = (v) => v === null ? 0 : v <= 0 ? 0 : Math.max(0.4, 3 - v / 50);


    const tile = (key, digits, big) => {
      const id = this._id(key);
      const pp = this._popFor(key);
      return `<div class="tile ${big ? 'big' : ''} ${this._has(key) ? '' : 'dim'} ${pp ? 'click' : ''}" ${pp ? `data-pop="${pp}"` : `data-e="${esc(id)}"`}>
        <div class="tl2">${esc(DEFAULT_E[key][2])}${this._q(id)}</div><div class="tv2">${this._val(key, digits)}</div></div>`;
    };
    const flag = (key) => {
      const s = this._st(key);
      const bin = s && /^(on|off)$/.test(s.state);
      const on = s && (s.state === 'on' || (!bin && !BAD.includes(s.state) && !/^(off|wył|wyl|nie|brak|0|nieaktywn)/i.test(s.state)));
      const txt = s && !BAD.includes(s.state) ? (bin ? (on ? ' ✓' : '') : ': ' + esc(s.state)) : '';
      const pp = this._popFor(key);
      return `<span class="flag ${!s || BAD.includes(s.state) ? 'mute' : on ? 'on' : ''} ${pp ? 'click' : ''}" ${pp ? `data-pop="${pp}"` : `data-e="${esc(this._id(key))}"`}>${esc(DEFAULT_E[key][2])}${this._q(this._id(key))}${txt}</span>`;
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
      ${this._renderHero(bypassOn)}
      ${this._renderGauge()}
      ${this._renderBar()}
      ${this._renderControls()}
      <div class="flags">${optFlag('harm_akt')}${optFlag('went_aktywna')}${flag('bypass')}${optFlag('bypass_tryb')}${optFlag('sezon')}${optFlag('chlodzenie')}${optFlag('wietrzenie')}${optFlag('urlop')}${optFlag('poza_domem')}${optFlag('nagrzewnica')}${optFlag('rozmrazanie')}${optFlag('gwc')}${optFlag('kominek')}${optFlag('magistrala')}
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
        ${opt('typy')}${opt('zegar')}${opt('ramki_tx')}${opt('inext')}${opt('nadawanie')}
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
      ${(() => { const d = this._dupes(); return d.length ? `<div class="warnbox">W HA są zdublowane encje z końcówką _2/_3 (stare zostały w rejestrze po zmianie nazw w YAML): ${d.map((x) => `<code>${esc(x)}</code>`).join(' ')}. Karta bierze tę, która ma dane. Stare, nieaktywne usuniesz w HA: Ustawienia → Urządzenia → Encje.</div>` : ''; })()}
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
  ha-card.dark { --primary-text-color:#e9eef5; --secondary-text-color:#8d9aab; --secondary-background-color:#18202b; --divider-color:#263140;
    --card-background-color:#111821; --primary-color:#27b4ff; --success-color:#3ddc6f; --warning-color:#ffb020; --error-color:#ff5a4f;
    --ha-card-background:#111821; background:linear-gradient(180deg,#141c26,#0d131a); color:var(--primary-text-color); border:1px solid #233040; border-radius:18px; }
  .brand { display:flex; align-items:center; gap:12px; }
  .ico { width:20px; height:20px; vertical-align:middle; flex:none; }
  .ico.big { width:38px; height:38px; color:#27b4ff; }
  .sep { width:1px; height:36px; background:var(--divider-color); }
  .dark .title { font-size:1.45em; font-weight:800; letter-spacing:.5px; }
  .sub { font-size:.85em; color:var(--secondary-text-color); letter-spacing:1px; }
  .badge.work { display:inline-flex; align-items:center; gap:8px; font-weight:800; font-size:.95em; padding:6px 16px; border-radius:20px; border:2px solid currentColor; background:transparent; letter-spacing:.5px; }
  .badge.work.ok { color:var(--success-color,#2e9e4f); background:rgba(61,220,111,.1); box-shadow:0 0 12px rgba(61,220,111,.25); }
  .badge.work.warn { color:var(--warning-color,#ffa600); }
  .badge.work.err { color:var(--error-color,#db4437); }
  .badge.work.mute { color:var(--secondary-text-color); }
  .badge .dot { width:9px; height:9px; border-radius:50%; background:currentColor; }
  .hero { width:100%; display:block; margin-top:4px; }
  .htile { fill:var(--secondary-background-color); stroke:var(--divider-color); stroke-width:1.5; }
  .hsep { stroke:var(--divider-color); stroke-width:1.5; }
  .hlbl { font-size:13px; font-weight:700; letter-spacing:1px; fill:var(--primary-text-color); }
  .hval { font-size:25px; font-weight:800; fill:var(--primary-text-color); }
  .hq { fill:var(--warning-color); }
  g.cold, text.cold { color:#27b4ff; fill:#27b4ff; } g.warm, text.warm { color:#ffa43a; fill:#ffa43a; }
  .hunit { fill:#1a222d; stroke:#2c3848; stroke-width:2; }
  .light .hunit { fill:var(--secondary-background-color); stroke:var(--divider-color); }
  .hcap { fill:#2c3848; }
  .hfan { fill:#121921; stroke:#34414f; stroke-width:3; }
  .light .hfan { fill:var(--card-background-color,#fff); stroke:var(--divider-color); }
  .hblade { fill:#5d6b7b; } .hhub { fill:#8d9aab; }
  .hoct { fill:#3a4553; stroke:#7b8796; stroke-width:3; }
  .hhatch { stroke:#566271; stroke-width:2.2; }
  .hoct.byp, polygon.byp { opacity:.35; }
  .hs { fill:none; stroke-width:16; stroke-linecap:round; stroke-linejoin:round; opacity:.85; }
  .hs.cold { stroke:#1e9bff; } .hs.warm { stroke:#ff9a2a; }
  .hflow { fill:none; stroke:#fff; stroke-width:3; stroke-linecap:round; stroke-dasharray:2 16; opacity:.45; animation:flow 1.2s linear infinite; }
  @keyframes flow { to { stroke-dashoffset:-18; } }
  .harr { font-size:20px; font-weight:900; fill:#fff; opacity:.9; }
  .blink { animation:blink 1.6s ease-in-out infinite; }
  @keyframes blink { 50% { opacity:.35; } }
  .hbyp { font-size:12px; font-weight:800; letter-spacing:1px; fill:#27b4ff; }
  .gauge { display:flex; align-items:center; justify-content:center; gap:16px; margin:2px 0 10px; }
  .gauge.click { cursor:pointer; }
  .ring { width:96px; height:96px; }
  .rbg { fill:none; stroke:#2a3442; stroke-width:9; }
  .light .rbg { stroke:var(--divider-color); }
  .rfg { fill:none; stroke:#27b4ff; stroke-width:9; stroke-linecap:round; filter:drop-shadow(0 0 5px rgba(39,180,255,.6)); transition:stroke-dasharray .6s; }
  .rblade { fill:#9aa7b6; }
  .gsep { width:1px; height:64px; background:var(--divider-color); }
  .glbl { font-size:1.15em; font-weight:700; letter-spacing:1px; color:var(--secondary-text-color); }
  .gval { font-size:2.6em; font-weight:800; line-height:1; }
  .gsub { font-size:.75em; color:var(--secondary-text-color); margin-top:4px; }
  .bar { display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid var(--divider-color); padding-top:10px; margin-top:4px; }
  .bcell { display:flex; align-items:center; justify-content:center; gap:6px; padding:8px 4px; font-size:.95em; border-left:1px solid var(--divider-color); cursor:pointer; flex-wrap:wrap; text-align:center; }
  .bcell:first-child { border-left:none; }
  .bcell.open { background:var(--secondary-background-color); border-radius:10px; }
  .bl { font-weight:600; letter-spacing:.5px; }
  .bcell b.acc { color:#27b4ff; } .good { color:var(--success-color,#2e9e4f); } .bad { color:var(--error-color,#db4437); }
  .pill { display:inline-flex; align-items:center; gap:8px; padding:7px 18px; border-radius:22px; background:linear-gradient(180deg,#1f8fff,#1468d8); color:#fff; box-shadow:0 0 14px rgba(31,143,255,.45); }
  @media (max-width:520px) { .bar { grid-template-columns:repeat(2,1fr); } .bcell:nth-child(3) { border-left:none; } }
  .pop { margin-top:8px; padding:10px 12px; border-radius:12px; background:var(--secondary-background-color); border:1px solid var(--divider-color); }
  .poph { font-size:.85em; margin-bottom:8px; display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
  .poph .x { margin-left:auto; }
  .opt { font:inherit; font-size:.9em; padding:7px 14px; border-radius:18px; border:1px solid var(--divider-color); background:transparent; color:var(--primary-text-color); cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
  .opt.on { border-color:var(--primary-color); color:var(--primary-color); background:rgba(39,180,255,.12); }
  button:disabled { opacity:.4; cursor:not-allowed; }
  .ctl { margin-top:6px; }
  .lock { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:8px 12px; border-radius:10px; background:rgba(255,176,32,.12); font-size:.88em; margin-bottom:8px; }
  .lock.on { background:rgba(61,220,111,.12); }
  .sublbl { font-size:.8em; color:var(--secondary-text-color); margin:10px 0 6px; letter-spacing:.5px; text-transform:uppercase; }
  .nwrap { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:6px; }
  .nctl { display:flex; align-items:center; gap:8px; background:var(--secondary-background-color); border-radius:10px; padding:6px 10px; }
  .nctl .nl { flex:1; font-size:.88em; color:var(--secondary-text-color); cursor:pointer; }
  .nv { min-width:70px; text-align:center; }
  .pm { font:inherit; font-weight:700; width:30px; height:30px; border-radius:50%; border:1px solid var(--divider-color); background:transparent; color:var(--primary-text-color); cursor:pointer; }
  .pm:not(:disabled):hover { border-color:var(--primary-color); color:var(--primary-color); }
  .ptab { width:100%; border-collapse:collapse; font-size:.9em; }
  .ptab th { font-weight:500; color:var(--secondary-text-color); text-align:center; padding:4px; }
  .ptab td { padding:4px; border-top:1px solid var(--divider-color); text-align:center; }
  .ptab td:first-child { text-align:left; color:var(--secondary-text-color); }
  .pc { display:inline-flex; align-items:center; gap:8px; }
  .pc b { min-width:42px; display:inline-block; cursor:pointer; }
  .edv { cursor:text; border-bottom:1px dashed var(--secondary-text-color); padding:0 2px; }
  .edv:hover { color:var(--primary-color); border-bottom-color:var(--primary-color); }
  .ned { display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .ninp { width:76px; font:inherit; font-size:1em; padding:5px 8px; border-radius:8px; border:1px solid var(--primary-color); background:var(--card-background-color,#fff); color:var(--primary-text-color); }
  .mini.ok { border-color:var(--primary-color); color:var(--primary-color); font-weight:700; }
  .tile.click, .flag.click { cursor:pointer; }
  .errbox { padding:10px 12px; border-radius:10px; background:rgba(255,90,79,.14); border:1px solid rgba(255,90,79,.5); margin:6px 0 10px; font-size:.9em; }
  .errbox .small { margin-top:4px; color:var(--secondary-text-color); }
  .flash { padding:7px 12px; border-radius:10px; margin:6px 0; font-size:.88em; font-weight:600; }
  .flash.ok { background:rgba(61,220,111,.14); color:var(--success-color,#2e9e4f); }
  .flash.bad { background:rgba(255,90,79,.14); color:var(--error-color,#db4437); }
  .tile.click:hover { outline:1px solid var(--primary-color); }
  .tile.click .tv2::after { content:' ✎'; font-size:.6em; color:var(--secondary-text-color); }
  @media (max-width:420px) { .pm { width:26px; height:26px; } .pc { gap:4px; } .pc b { min-width:36px; } .ptab td, .ptab th { padding:3px 1px; } .body { padding:10px 10px; } }
  :host { display:block; }
  ha-card { overflow:hidden; display:block; }
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
