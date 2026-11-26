/*
 * compit-nano-one-card  v2.12
 * Karta Home Assistant dla rekuperacji sterowanej przez Compit Nano One (RS485, protokol C14),
 * czytanej przez ESP z ESPHome. Jeden plik, bez zaleznosci.
 *
 *   type: custom:compit-nano-one-card
 *   prefix: nano_one          # opcjonalnie, poczatek ID encji z ESPHome (domyslnie nano_one)
 *   title: Rekuperacja        # opcjonalnie
 *   tab: rekuperator          # opcjonalnie, zakladka startowa: rekuperator | harmonogram | strefy | diagnostyka
 *   sidebar: false            # opcjonalnie, nie tworz panelu "Rekuperacja" w lewym pasku i nie pokazuj paska z przyciskiem
 *   theme: dark               # opcjonalnie: dark (domyslnie, wg wzoru) | light (kolory motywu HA)
 *   niepewne: [t_czerpnia]    # opcjonalnie, klucze oznaczane "?" (niepewne mapowanie); domyslnie zadne
 *   map: osm               # v2.6: osm (domyslnie, bez klucza API) | ha (mapa HA, ha-map)
 *   map_tiles: https://tile.openstreetmap.org/{z}/{x}/{y}.png   # opcjonalnie wlasny podklad
 *   history_hours: 6          # opcjonalnie, ile godzin wstecz czytac log i ramki w Diagnostyce
 *   zewn: sensor.hydrolution_temperatura_zewnetrzna_bt1   # v1.8: temp. zewnetrzna z pompy ciepla (BT1); zewn: false = bez kafla
 *   entities:                 # opcjonalnie, nadpisanie pojedynczych encji
 *     t_nawiew: sensor.moja_temperatura_nawiewu
 *
 * Kazdy klucz z DEFAULT_E szukany jest jako <domena>.<prefix>_<koncowka>.
 * Jesli encji nie ma w podanej domenie, karta szuka tej samej koncowki w innych domenach.
 */
(() => {
const VERSION = 'v2.12';
// v2.4: Leaflet z unpkg jako zapas, gdy mapa HA (ha-map) nie wstanie
// v2.6: kilka CDN po kolei, podklad OpenStreetMap bez klucza API
const LEAFLET_CDN = ['https://unpkg.com/leaflet@1.9.4/dist/', 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/'];
let LEAFLET_URL = LEAFLET_CDN[0];
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
let LEAFLET_P = null;
// v1.9: automatyki i strefy tworzone przez karte, panel w pasku bocznym
const AUTO_IDS = ['compit_rekuperacja_sterownik'];
const OLD_IDS = ['compit_rekuperacja_harmonogram', 'compit_rekuperacja_strefa_1', 'compit_rekuperacja_strefa_2']; // v1.9-v2.2, kasowane przy zapisie
const WIET_BOOL = 'input_boolean.rekuperacja_wietrzenie';
const TIMER = 'script.wietrzenie_timer'; // v2.12: jedna encja do wlasnej karty - skrypt chodzi X min = wietrzenie trwa
const WIET_BTN = 'input_button.rekuperacja_wietrzenie_teraz';       // v2.9-v2.11, kasowane przy zapisie
const BTN_BOOL = 'input_boolean.rekuperacja_wietrzenie_przycisk';   // v2.10-v2.11, kasowane przy zapisie
// v2.5: wietrzenie po wyjezdzie ze strefy 1 (osobny przelacznik, sam gasnie po X min)
const WYJ_BOOL = 'input_boolean.rekuperacja_wietrzenie_wyjazd';
// v2.8: sezon lato/zima (ON = lato), przelaczany przez sterownik wg temp. zewnetrznej
const LATO_BOOL = 'input_boolean.rekuperacja_lato';
const TZK = ['t_reczna', 't_dzien', 't_noc', 't_poza'];
const TRG = [['l', 'Tylko światło'], ['w', 'Tylko woda'], ['lw', 'Światło i woda naraz']];
const LS_CFG = 'compit-nano-one-plan';
const SB_URL = 'rekuperacja-nano';
const DAYS = [['mon', 'Pn'], ['tue', 'Wt'], ['wed', 'Śr'], ['thu', 'Cz'], ['fri', 'Pt'], ['sat', 'So'], ['sun', 'Nd']];

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
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone:'<path d="M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2"/>',
  map:  '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
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
// slug jak w HA: bez polskich znakow, male litery, _ zamiast reszty
const slugPl = (t) => String(t).replace(/[łŁ]/g, 'l').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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
    if (this._hass) this._animStart();
    if (this._hookedPtr) return;
    this._hookedPtr = true;
    this.shadowRoot.addEventListener('pointerdown', () => { this._holding = true; });
    const up = () => { if (!this._holding) return; this._holding = false; if (this._dirty) { this._dirty = false; setTimeout(() => this._schedule(), 0); } };
    this.shadowRoot.addEventListener('pointerup', up);
    this.shadowRoot.addEventListener('pointercancel', up);
    this.shadowRoot.addEventListener('pointerleave', up, true);
    // v1.9: po wyjsciu z pola formularza dorysuj zalegle zmiany
    this.shadowRoot.addEventListener('focusout', () => setTimeout(() => { if (this._dirty && !this._formFocused() && !this._holding && !this._edit) { this._dirty = false; this._schedule(); } }, 80));
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
      const byPre = Object.keys(st).filter((id) => { const o = id.split('.')[1]; return o && o.startsWith(pre); });
      // v1.6: dobierz tez encje TEGO SAMEGO URZADZENIA (rejestr HA), nawet gdy maja inne entity_id
      const ents = this._hass.entities || {};
      const devs = new Set(byPre.map((id) => ents[id] && ents[id].device_id).filter(Boolean));
      if (this._config.device_id) devs.add(this._config.device_id);
      const byDev = devs.size ? Object.keys(ents).filter((id) => devs.has(ents[id].device_id) && st[id] && !byPre.includes(id)) : [];
      this._idxList = byPre.concat(byDev);
      // wirtualne object_id: <prefix>_<slug(nazwy bez nazwy urzadzenia)> - do dopasowania koncowek
      this._vobj = {};
      const devName = (this._config.device_name || this._prefix.replace(/_/g, ' ')).toLowerCase();
      byDev.forEach((id) => {
        let n = String(st[id].attributes.friendly_name || '').trim();
        if (n.toLowerCase().startsWith(devName)) n = n.slice(devName.length);
        this._vobj[id] = id.split('.')[0] + '.' + pre + slugPl(n);
      });
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
        const m = id.match(re) || (this._vobj[id] && this._vobj[id].match(re));
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
  // v1.8: temperatura zewnetrzna z pompy ciepla (karta ha-karta-pompa-ciepla, czujnik BT1) - pewniejsza niz czerpnia (GWC, nagrzewnica)
  _zewnId() { const z = this._config && this._config.zewn; return z === false ? null : (z || 'sensor.hydrolution_temperatura_zewnetrzna_bt1'); }
  _zewnTile() {
    const id = this._zewnId(), s = id && this._hass ? this._hass.states[id] : undefined;
    if (!s) return '';
    const v = num(s), cz = num(this._st('t_czerpnia'));
    const unit = s.attributes.unit_of_measurement || '°C';
    const val = BAD.includes(s.state) || v === null ? '<span class="mute">' + (s.state === 'unavailable' ? 'niedostępne' : '—') + '</span>' : esc(v.toFixed(1)) + '<small> ' + esc(unit) + '</small>';
    const d = v !== null && cz !== null ? cz - v : null;
    const sub = d === null ? '' : `<div class="tl2" style="margin-top:2px">czerpnia ${d >= 0 ? '+' : '−'}${esc(Math.abs(d).toFixed(1))} °C${Math.abs(d) >= 2 ? ' (GWC / nagrzewnica?)' : ''}</div>`;
    return `<div class="tile" data-e="${esc(id)}"><div class="tl2">Na zewnątrz (pompa BT1)</div><div class="tv2">${val}</div>${sub}</div>`;
  }
  // "?" w nazwie encji z ESPHome = mapowanie niepewne
  _unsure(id) {
    const s = this._hass && this._hass.states[id];
    if (!s) return false;
    if (/\?/.test(s.attributes.friendly_name || '')) return true;
    // v1.2: czerpnia i wywiew z rejestrow Nano - do potwierdzenia (wylacz: niepewne: [])
    const list = Array.isArray(this._config.niepewne) ? this._config.niepewne : [];
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
  // encje urzadzenia, ktore sa w rejestrze HA, ale nie maja stanu (np. wylaczone)
  _regNoState() {
    const ents = this._hass.entities || {}, st = this._hass.states;
    const devs = new Set(this._idx().map((id) => ents[id] && ents[id].device_id).filter(Boolean));
    return Object.keys(ents).filter((id) => devs.has(ents[id].device_id) && !st[id]).sort();
  }
  _prefIds() {
    return this._idx().slice().sort();
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
    if (first) setTimeout(() => this._checkSidebar(true), 1500);
    // v2.3: zmiana tego, co steruje (wg lustra logiki sterownika) do logu
    const autos = this._autoEnts();
    if (this._draft) {
      const nc = this._nowCtl(), src = nc ? nc.src : '';
      if (this._lastSrc !== undefined && src !== this._lastSrc) this._pushLog({ t: new Date(), e: 'sterownik', s: 'teraz steruje: ' + src + (nc && nc.tryb ? ' → ' + nc.tryb : '') });
      this._lastSrc = src;
    } else if (autos.length && !this._cfgLoaded) this._loadCfg();
    // v1.4: HA podaje nowe hass przy KAZDEJ zmianie dowolnej encji w domu. Przerysowuj tylko,
    // gdy zmienila sie ktoras encja z prefiksem - inaczej animacje skacza, a klik potrafi przepasc.
    const zid = this._zewnId();   // v1.8: zmiana BT1 z pompy tez przerysowuje
    const ids = this._idx().concat(zid ? [zid] : [], autos, [WIET_BOOL, WYJ_BOOL, LATO_BOOL, TIMER], (this._tab === 'strefy' || this._tab === 'harmonogram') && this._draft ? this._draft.phones.concat(this._draft.trg.le, this._draft.trg.we) : []);
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
    if (this._holding || this._edit || this._formFocused()) { this._dirty = true; return; }
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
          <button class="tab ${this._tab === 'harmonogram' ? 'on' : ''}" data-tab="harmonogram">Harmonogram</button>
          <button class="tab ${this._tab === 'strefy' ? 'on' : ''}" data-tab="strefy">Strefy</button>
          <button class="tab ${this._tab === 'diagnostyka' ? 'on' : ''}" data-tab="diagnostyka">Diagnostyka</button>
        </div>
        <div class="body">${this._tab === 'diagnostyka' ? this._renderDiag() : this._tab === 'harmonogram' ? this._renderHarm() : this._tab === 'strefy' ? this._renderZones() : this._renderReku()}</div>
        <div class="foot">compit-nano-one-card ${VERSION} · prefiks <code>${esc(this._prefix)}</code></div>
      </ha-card>`;

    this.shadowRoot.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      this._tab = b.dataset.tab;
      if (this._tab === 'diagnostyka') this._loadHistory();
      if (this._tab === 'harmonogram' || this._tab === 'strefy') this._loadCfg();
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
    this.shadowRoot.querySelectorAll('[data-strefa]').forEach((el) => el.addEventListener('click', () => this._strefaOn()));
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
    if (this._tab === 'harmonogram' || this._tab === 'strefy') { this._loadCfg(); this._wirePlan(); }
    this.shadowRoot.querySelectorAll('[data-wnow]').forEach((b) => b.addEventListener('click', () => {
      if (this._hass.states[TIMER]) this._hass.callService('script', 'turn_on', { entity_id: TIMER });
      this._flashMsg(true, '✓ Wietrzenie teraz');
    }));
    this.shadowRoot.querySelectorAll('[data-wstop]').forEach((b) => b.addEventListener('click', () => {
      this._hass.callService('script', 'turn_off', { entity_id: TIMER });
    }));
    this.shadowRoot.querySelectorAll('[data-sidebar]').forEach((b) => b.addEventListener('click', () => this._checkSidebar(true)));
    this._animStart();
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

  // v2.1: % wentylatora (0-100) dla animacji; bez % a wentylatory pracuja = 50
  _animTarget(k) {
    if (!this._hass) return 0;
    const v = num(this._st(k === 'w' ? 'went_wywiew' : 'went_nawiew'));
    if (v === null) return this._running() ? 50 : 0;
    return Math.max(0, Math.min(100, v));
  }

  // v2.1: jedna petla animacji niezalezna od przerysowan - zmiana % plynnie przyspiesza / zwalnia
  _animStart() {
    if (this._raf) return;
    const a = this._anim || (this._anim = { n: { s: 0, ang: 0, off: 0 }, w: { s: 0, ang: 0, off: 0 } });
    let last = performance.now();
    const step = (t) => {
      this._raf = null;
      if (!this.isConnected) return;
      const dt = Math.min(0.1, Math.max(0, (t - last) / 1000)); last = t;
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      for (const k of ['n', 'w']) {
        const o = a[k], tg = reduce ? 0 : this._animTarget(k);
        o.s += (tg - o.s) * Math.min(1, dt * 1.5);
        if (Math.abs(tg - o.s) < 0.2) o.s = tg;
        o.ang = (o.ang + o.s / 100 * 430 * dt) % 360;      // 100 % = ok. 1,2 obrotu/s
        o.off = (o.off - o.s / 100 * 40 * dt) % 18;        // 100 % = 40 px/s
      }
      const R = this.shadowRoot;
      R.querySelectorAll('[data-fan]').forEach((el) => el.setAttribute('transform', 'rotate(' + a[el.dataset.fan].ang.toFixed(1) + ')'));
      R.querySelectorAll('[data-flow]').forEach((el) => { const o = a[el.dataset.flow]; el.style.strokeDashoffset = o.off.toFixed(1); el.style.opacity = o.s > 0.5 ? '.45' : '0'; });
      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
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
      <details><summary>Czego brakuje (${miss.length})</summary><div class="miss">${miss.map((x) => `<code>${esc(x)}</code>`).join(' ')}</div></details>
      ${(() => { const d = this._regNoState(); return d.length ? `<div class="small"><b>W rejestrze HA, ale wyłączone / bez stanu (${d.length}):</b> ${d.map((x) => `<code>${esc(x)}</code>`).join(' ')} – włącz je w Ustawienia → Encje.</div>` : ''; })()}</div>`;
  }

  async _selectOpt(key, opt) {
    const id = this._id(key);
    this._pop = null;
    // v2.4: reczny wybor trybu wylacza sterownik (opcja Strefa), inaczej nadpisalby go po minucie
    const ctl = this._ctlEnt();
    if (ctl && ctl.state === 'on' && /^set_(tryb|program|bieg)$/.test(key)) {
      try {
        await this._hass.callService('automation', 'turn_off', { entity_id: ctl.entity_id, stop_actions: true });
        this._pushLog({ t: new Date(), e: 'karta', s: 'Strefa → WYŁ. (ręczny wybór: ' + opt + ')' });
      } catch (e) { this._flashMsg(false, '✗ nie wyłączyłem sterownika: ' + (e && e.message ? e.message : e)); }
    }
    this._call('select', 'select_option', { entity_id: id, option: opt }, DEFAULT_E[key][2] + ' → ' + opt);
  }

  // v2.4: sterownik (automatyka karty) jako encja; ON = tryb Strefa
  _ctlEnt() {
    const id = this._autoEnts().find((x) => this._hass.states[x] && this._hass.states[x].attributes.id === AUTO_IDS[0]);
    return id ? this._hass.states[id] : null;
  }

  async _strefaOn() {
    this._pop = null;
    const ctl = this._ctlEnt();
    if (!ctl) { this._flashMsg(false, 'Najpierw ustaw strefy w zakładce Strefy i kliknij Zapisz w HA – dopiero wtedy jest co włączyć.'); this._render(); return; }
    try {
      if (ctl.state !== 'on') await this._hass.callService('automation', 'turn_on', { entity_id: ctl.entity_id });
      await this._hass.callService('automation', 'trigger', { entity_id: ctl.entity_id, skip_condition: true });
      this._pushLog({ t: new Date(), e: 'karta', s: 'Strefa → WŁ. (sterownik ustawia tryb wg stref)' });
      this._flashMsg(true, '✓ Strefa: tryb i % ustawia teraz sterownik wg stref (wyjazd / strefa 2 / harmonogram w domu)');
    } catch (e) { this._flashMsg(false, '✗ Strefa: ' + (e && e.message ? e.message : e)); }
    this._render();
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
        <text x="${x + 70}" y="${y + 61}" class="hval ${s && BAD.includes(s.state) ? 'nos' : ''}">${s && !BAD.includes(s.state) ? fmtT(v) : s ? 'brak czujnika' : '—'}</text></g>`;
    };
    // osmiokat wymiennika
    const cx = 320, cy = 150, R = 74;
    const oct = Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return (cx + R * Math.cos(a)).toFixed(1) + ',' + (cy + R * Math.sin(a)).toFixed(1); }).join(' ');
    const cold = bypassOn
      ? 'M182 74 H214 C236 74 236 30 262 30 H378 C404 30 404 74 426 74 H458'
      : 'M182 74 H214 C258 74 262 168 320 168 C378 168 382 74 426 74 H458';
    const warm = 'M182 226 H214 C258 226 262 132 320 132 C378 132 382 226 426 226 H458';
    // v2.1: predkosc wiatraczkow i przeplywu liczy _animStart() z % wentylatorow (n = nawiew, w = wywiew)
    const fan = (x, y, k) => `<g transform="translate(${x} ${y})"><circle r="25" class="hfan"/>
      <g data-fan="${k}" transform="rotate(${this._anim ? this._anim[k].ang.toFixed(1) : 0})"><path d="M0 -17 C8 -15 7 -4 0 0 C-7 -4 -8 -15 0 -17Z M14.7 8.5 C10.5 15.5 1 11 0 0 C10 -1 17 3 14.7 8.5Z M-14.7 8.5 C-17 3 -10 -1 0 0 C-1 11 -10.5 15.5 -14.7 8.5Z" class="hblade"/></g><circle r="4" class="hhub"/></g>`;
    const arrows = (x, y, cls) => `<text x="${x}" y="${y + 6}" text-anchor="middle" class="harr ${cls} ${run ? 'blink' : ''}">›››</text>`;
    return `
      <svg viewBox="0 0 640 300" class="hero" role="img" aria-label="Schemat rekuperatora">
        <defs>
          <filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="9" class="hhatch"/></pattern>
        </defs>
        <rect x="212" y="12" width="216" height="270" rx="18" class="hunit"/>
        <rect x="290" y="12" width="60" height="26" rx="4" class="hcap"/>
        ${fan(262, 58, 'w')}${fan(378, 58, 'n')}
        <polygon points="${oct}" class="hoct ${bypassOn ? 'byp' : ''}"/>
        <polygon points="${oct}" fill="url(#hatch)" class="${bypassOn ? 'byp' : ''}"/>
        <path d="${warm}" class="hs warm" filter="url(#glow)"/>
        <path d="${cold}" class="hs cold" filter="url(#glow)"/>
        <path d="${warm}" class="hflow" data-flow="w" style="opacity:0"/><path d="${cold}" class="hflow" data-flow="n" style="opacity:0"/>
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
        <g transform="translate(50 50)"><g data-fan="n" transform="rotate(${this._anim ? this._anim.n.ang.toFixed(1) : 0})"><path d="M0 -16 C7 -14 6 -4 0 0 C-6 -4 -7 -14 0 -16Z M13.9 8 C10 14.5 1 10.5 0 0 C9.5 -1 16 3 13.9 8Z M-13.9 8 C-16 3 -9.5 -1 0 0 C-1 10.5 -10 14.5 -13.9 8Z" class="rblade"/></g></g></svg>
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
      ${cell(this._st('set_tryb') ? 'tryb' : 'program', 'tryb', 'sync', 'PROGRAM', (() => { const ct = this._ctlEnt(); const z = ct && ct.state === 'on'; return prog ? (z ? 'STREFA · ' : '') + prog.toUpperCase() : (z ? 'STREFA' : null); })(), '', true)}
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
    const ctl = /^set_(tryb|program|bieg)$/.test(key) ? this._ctlEnt() : null;
    const zOn = !!(ctl && ctl.state === 'on');
    const zBtn = /^set_(tryb|program|bieg)$/.test(key) ? `<button class="opt ${zOn ? 'on' : ''}" data-strefa title="${ctl ? '' : 'najpierw zapisz Strefy w HA'}">${ico('map')} Strefa</button>` : '';
    return `<div class="pop">
      <div class="poph">${esc(DEFAULT_E[key][2])}: wybierz${can ? '' : ' <span class="warn">(zapis wyłączony, włącz „Sterowanie z HA”)</span>'}<button class="mini x" data-popclose>✕</button></div>
      ${this._flashBox()}
      <div class="row">${opts.map((o) => `<button class="opt ${o === s.state && !zOn ? 'on' : ''}" data-opt="${esc(o)}" data-optkey="${key}" ${can ? '' : 'disabled'}>${esc(o)}</button>`).join('')}${zBtn}</div>
      ${zBtn ? `<div class="small mute">${zOn ? 'Strefa WŁ.: sterownik sam wybiera tryb wg stref. Wybór innego trybu wyłącza Strefę.' : 'Strefa: tryb i % ustawia sterownik wg ustawień z zakładki Strefy (wyjazd, strefa 2, w domu harmonogram).'}</div>` : ''}
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
      ${this._autoLine()}
      ${this._flashBox()}
      ${this._offlineBox()}
      ${this._missingBox()}
      ${lock}
      ${wiet && wiet.entity_id.startsWith('switch.') ? `<div class="row"><button class="opt ${wiet.state === 'on' ? 'on' : ''}" data-wiet ${can ? '' : 'disabled'}>${ico('wind')} Wietrzenie: ${wiet.state === 'on' ? 'WŁ.' : 'WYŁ.'}</button></div>` : ''}
      ${this._wietRow()}
      ${temps ? `<div class="sublbl">Temperatury zadane</div><div class="nwrap">${temps}</div>` : ''}
      ${pcts ? `<div class="sublbl">Biegi % (nawiew / wywiew)</div><table class="ptab"><tr><th></th><th>Nawiew</th><th>Wywiew</th></tr>${pcts}</table>` : ''}
    </div>`;
  }

  // v2.9: "Wietrzenie teraz" (przycisk HA) + stan przelacznika z licznikiem minut
  _wietRow() {
    const bb = this._hass.states[TIMER];
    if (!bb) return '';
    const on = bb.state === 'on';
    const min = this._draft ? Number(this._draft.btn.min) || 0 : 0;
    const left = on && min ? Math.max(0, Math.ceil(min - (Date.now() - new Date(bb.attributes.last_triggered || bb.last_changed)) / 60000)) : null;
    if (on && left !== null && !this._wietTick) this._wietTick = setTimeout(() => { this._wietTick = null; this._schedule(); }, 30000);
    const end = on && min ? new Date(new Date(bb.attributes.last_triggered || bb.last_changed).getTime() + min * 60000) : null;
    return `<div class="row"><button class="opt ${on ? 'on' : ''}" data-wnow>${ico('wind')} Wietrzenie teraz${on ? ` – trwa${left !== null ? ', zostało ' + left + ' min (do ' + pad2(end.getHours()) + ':' + pad2(end.getMinutes()) + ')' : ''}` : ''}</button>
      ${on ? '<button class="mini" data-wstop>przerwij</button>' : ''}</div>`;
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

  // ================= v2.3: sterownik w HA (harmonogram w strefie, noc, reguly, cykle, wietrzenie) =================
  // Karta tylko ustawia. Robote robi jedna automatyka HA "Rekuperacja – sterownik" (compit_rekuperacja_sterownik),
  // strefy zone.rekuperacja_1/_2 i przelacznik input_boolean.rekuperacja_wietrzenie - dzialaja bez otwartej karty.
  // Co minute (i przy kazdej zmianie warunku) sterownik liczy, co ma byc teraz, i zapisuje tylko roznice:
  //   nikt w strefie 1 -> tryb wyjazdu (albo tryb strefy 2) > wietrzenie > regula > cykl > harmonogram
  _isAdmin() { return !!(this._hass && this._hass.user && this._hass.user.is_admin); }

  _defCfg() {
    const h = (this._hass && this._hass.config) || {};
    const z = (on, r) => ({ on, lat: h.latitude || 52.2297, lon: h.longitude || 21.0122, r, wiet: true, ltryb: '', lpn: '', lpw: '' });
    const base = {};
    ['n1', 'w1', 'n2', 'w2', 'n3', 'w3'].forEach((k) => { const v = num(this._st('p_' + k)); base[k] = v === null ? '' : Math.round(v); });
    return {
      v: 2, phones: [], stale: 30,
      sched: { on: true, slots: [] },
      night: { from: '22:00', to: '06:00' },
      base, boost: '3',
      wiet: { min: 15, pn: 80, pw: 80 },
      cyc: { day: { on: false, every: 3, dur: 20, pn: 80, pw: 80 }, night: { on: false, every: 2, dur: 15, pn: 60, pw: 60 } },
      rules: [],
      z: [z(true, 300), z(false, 2000)],
      wyj: { on: false, min: 10, pn: 80, pw: 80 },
      btn: { min: 30, pn: 90, pw: 90 },
      sez: { on: false, src: '', zima: 12, lato: 16, hold: 6, esp: false, ez: '', el: '' },
      tz: { zima: { t_reczna: '', t_dzien: '', t_noc: '', t_poza: '' }, lato: { t_reczna: '', t_dzien: '', t_noc: '', t_poza: '' } },
      trg: { le: [], we: [], wv: 0, l: { on: false, pn: 70, pw: 70, hold: 5 }, w: { on: false, pn: 80, pw: 80, hold: 5 }, lw: { on: false, pn: 95, pw: 95, hold: 10 } },
    };
  }

  _mergeCfg(c) {
    const d = this._defCfg();
    if (!c || typeof c !== 'object') return d;
    const out = Object.assign({}, d, c);
    out.phones = Array.isArray(c.phones) ? c.phones.slice() : [];
    out.sched = Object.assign({}, d.sched, c.sched || {});
    out.sched.slots = (out.sched.slots || []).map((s) => Object.assign({ d: [], t: '06:00', tryb: '', temp: '', pn: '', pw: '' }, s, { d: (s.d || []).slice() }));
    out.night = Object.assign({}, d.night, c.night || {});
    out.base = Object.assign({}, d.base, c.base || {});
    out.wiet = Object.assign({}, d.wiet, c.wiet || {});
    out.btn = Object.assign({}, d.btn, c.btn || {});
    out.cyc = { day: Object.assign({}, d.cyc.day, (c.cyc || {}).day || {}), night: Object.assign({}, d.cyc.night, (c.cyc || {}).night || {}) };
    out.rules = (c.rules || []).map((r) => Object.assign({ name: 'Reguła', on: true, conds: [], dpn: 80, dpw: 80, npn: 60, npw: 60, hold: 10 }, r,
      { conds: (r.conds || []).map((x) => Object.assign({ e: '', op: 'on', v: '' }, x)) }));
    out.z = [0, 1].map((i) => Object.assign({}, d.z[i], (c.z || [])[i] || {}));
    out.wyj = Object.assign({}, d.wyj, c.wyj || {});
    out.sez = Object.assign({}, d.sez, c.sez || {});
    out.tz = { zima: Object.assign({}, d.tz.zima, (c.tz || {}).zima || {}), lato: Object.assign({}, d.tz.lato, (c.tz || {}).lato || {}) };
    // v2.8: harmonogram "lato" startuje jako kopia obecnego (zima)
    const cs = c.sched || {};
    out.sched.lato = (Array.isArray(cs.lato) ? cs.lato : out.sched.slots).map((x) => Object.assign({ d: [], t: '06:00', tryb: '', temp: '', pn: '', pw: '' }, x, { d: (x.d || []).slice() }));
    const ct = c.trg || {};
    out.trg = { le: Array.isArray(ct.le) ? ct.le.slice() : [], we: Array.isArray(ct.we) ? ct.we.slice() : [], wv: ct.wv !== undefined ? ct.wv : d.trg.wv };
    TRG.forEach(([k]) => { out.trg[k] = Object.assign({}, d.trg[k], ct[k] || {}); });
    // migracja z v1.9-v2.2: wietrzenie i "tryb normalny" byly w strefie 1
    if (!c.v || c.v < 2) {
      const z0 = (c.z || [])[0] || {};
      if (z0.wm !== undefined) out.wiet = { min: Number(z0.wm) || 0, pn: z0.wpn !== undefined ? z0.wpn : 80, pw: z0.wpw !== undefined ? z0.wpw : 80 };
      out.z.forEach((z, i) => { const o = (c.z || [])[i] || {}; z.wiet = o.wm === undefined ? true : Number(o.wm) > 0; });
      if (!out.sched.slots.length && z0.ntryb) out.sched.slots = [{ d: DAYS.map((x) => x[0]), t: '00:00', tryb: z0.ntryb, temp: '', pn: z0.npn || '', pw: z0.npw || '' }];
      if (!Array.isArray(cs.lato)) out.sched.lato = out.sched.slots.map((x) => Object.assign({}, x, { d: x.d.slice() }));
      out.v = 2;
    }
    out.z.forEach((z) => { delete z.wm; delete z.wpn; delete z.wpw; delete z.ntryb; delete z.npn; delete z.npw; });
    return out;
  }

  async _loadCfg(force) {
    if ((this._cfgLoaded && !force) || !this._hass || !this._hass.callApi) return;
    this._cfgLoaded = true;
    let cfg = null;
    this._autoExists = {};
    for (const id of AUTO_IDS.concat(OLD_IDS)) {
      try {
        const a = await this._hass.callApi('GET', 'config/automation/config/' + id);
        this._autoExists[id] = true;
        if (!cfg && a && a.variables && a.variables.compit_cfg) cfg = a.variables.compit_cfg;
      } catch (e) { this._autoExists[id] = false; }
    }
    if (!cfg) { try { cfg = JSON.parse(localStorage.getItem(LS_CFG) || 'null'); } catch (e) { cfg = null; } }
    this._draft = this._mergeCfg(cfg);
    this._schedule();
  }

  // encje, do ktorych sterownik pisze (ustalane w chwili zapisu)
  _wt() {
    const id = (k) => (this._st(k) ? this._id(k) : null);
    const sel = id('set_tryb') || id('set_bieg');
    const opts = sel ? (this._hass.states[sel].attributes.options || []) : [];
    const p = {};
    ['n1', 'w1', 'n2', 'w2', 'n3', 'w3', 'nw', 'ww'].forEach((k) => { p[k] = id('p_' + k); });
    const sw = id('sw_wietrz');
    return { lock: id('nadawanie'), sel, opts, wietOpt: opts.find((o) => /wietrz/i.test(o)) || null,
      wietSw: sw && sw.startsWith('switch.') ? sw : null, temp: id('t_reczna'), p };
  }

  _gearOf(opt) { const m = /bieg\s*(\d)/i.exec(opt || ''); return m ? m[1] : null; }
  _gearOpt(W, g) { return W.opts.find((o) => this._gearOf(o) === String(g)) || null; }
  _n(v) { const x = Number(String(v === undefined || v === null ? '' : v).replace(',', '.')); return v === '' || v === null || v === undefined || isNaN(x) ? null : x; }
  _min(t) { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; }
  _hm(m) { m = ((m % 1440) + 1440) % 1440; return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); }

  // cel: {src, tryb, n, w, pn, pw, tid, temp} - wszystko rozwiazane do ID encji
  _tgt(W, src, tryb, pn, pw, temp) {
    const c = this._draft, g = this._gearOf(tryb);
    const t = { src, tryb: tryb || '', n: null, w: null, pn: null, pw: null, tid: null, temp: null };
    if (g) {
      t.n = W.p['n' + g]; t.w = W.p['w' + g];
      t.pn = this._n(pn) !== null ? this._n(pn) : this._n(c.base['n' + g]);
      t.pw = this._n(pw) !== null ? this._n(pw) : this._n(c.base['w' + g]);
    }
    if (this._n(temp) !== null && W.temp) { t.tid = W.temp; t.temp = this._n(temp); }
    return t;
  }

  _boostTgt(W, src, pn, pw) { return this._tgt(W, src, this._gearOpt(W, this._draft.boost) || '', pn, pw); }

  // v2.10: wietrzenie z przycisku - wlasne %, dziala tez, gdy nikogo nie ma
  _btnTgt(W) {
    const c = this._draft;
    if (W.wietOpt) return { src: 'wietrzenie z przycisku', tryb: W.wietOpt, n: W.p.nw, w: W.p.ww, pn: this._n(c.btn.pn), pw: this._n(c.btn.pw), tid: null, temp: null };
    return this._boostTgt(W, 'wietrzenie z przycisku', c.btn.pn, c.btn.pw);
  }

  _wietTgt(W) {
    const c = this._draft;
    if (W.wietOpt) return { src: 'wietrzenie', tryb: W.wietOpt, n: W.p.nw, w: W.p.ww, pn: this._n(c.wiet.pn), pw: this._n(c.wiet.pw), tid: null, temp: null };
    return this._boostTgt(W, 'wietrzenie', c.wiet.pn, c.wiet.pw);
  }

  // v2.8: sezon
  _sezSrc() {
    const c = this._draft, z = this._zewnId();
    if (c.sez.src) return c.sez.src;
    if (z && this._hass.states[z]) return z;
    return this._st('t_czerpnia') ? this._id('t_czerpnia') : '';
  }
  _isLato() { const b = this._hass.states[LATO_BOOL]; return !!(this._draft.sez.on && b && b.state === 'on'); }
  _sedit() { return this._draft.sez.on && this._sEd === 'lato' ? 'lato' : 'zima'; }
  _sp() { return this._sedit() === 'lato' ? 'sched.lato' : 'sched.slots'; }
  _sl() { return this._sedit() === 'lato' ? this._draft.sched.lato : this._draft.sched.slots; }

  // wpisy harmonogramu jako [minuta tygodnia (Pn 00:00 = 0), cel], posortowane
  _schedEntries(W, sez) {
    const c = this._draft, out = [];
    sez = sez || 'zima';
    const defT = this._n(c.tz[sez].t_reczna);
    const src = c.sez.on ? 'harmonogram ' + sez : 'harmonogram';
    (sez === 'lato' ? c.sched.lato : c.sched.slots).forEach((s) => {
      const temp = this._n(s.temp) !== null ? s.temp : defT;
      if (!s.tryb && this._n(temp) === null) return;
      s.d.forEach((d) => {
        const di = DAYS.findIndex((x) => x[0] === d);
        if (di >= 0) out.push([di * 1440 + this._min(s.t), this._tgt(W, src, s.tryb, s.pn, s.pw, temp)]);
      });
    });
    return out.sort((a, b) => a[0] - b[0]);
  }

  _isNight(mins) {
    const nf = this._min(this._draft.night.from), nt = this._min(this._draft.night.to);
    return nf > nt ? (mins >= nf || mins < nt) : (mins >= nf && mins < nt);
  }

  _cycOn(cy, mins, anchor) {
    const e = Math.round((this._n(cy.every) || 0) * 60), d = this._n(cy.dur) || 0;
    return !!(cy.on && e > 0 && d > 0 && ((((mins - anchor) % 1440) + 1440) % 1440) % e < d);
  }

  // v2.5: czujniki strefy 1 (swiatlo / woda / oba), najsilniejszy wygrywa
  _trgEnts(list) { return (list || []).filter((e) => /^[a-z_]+\.[a-z0-9_]+$/.test(e)); }
  _trgOrder() {
    const t = this._draft.trg;
    return TRG.map(([k]) => k).filter((k) => {
      if (!t[k].on) return false;
      if (k !== 'w' && !this._trgEnts(t.le).length) return false;
      if (k !== 'l' && !this._trgEnts(t.we).length) return false;
      return true;
    }).sort((a, b) => ((this._n(t[b].pn) || 0) + (this._n(t[b].pw) || 0)) - ((this._n(t[a].pn) || 0) + (this._n(t[a].pw) || 0)));
  }
  _actNow(e, th, hold) {
    const s = this._hass.states[e];
    if (!s) return false;
    const v = this._n(s.state);
    return s.state === 'on' || (v !== null && v > th) || (Date.now() - new Date(s.last_changed)) / 60000 < (this._n(hold) || 0);
  }
  _trgNow(k) {
    const t = this._draft.trg, h = t[k].hold, wv = this._n(t.wv) || 0;
    const L = this._trgEnts(t.le).some((e) => this._actNow(e, 0, h)), Wt = this._trgEnts(t.we).some((e) => this._actNow(e, wv, h));
    return k === 'l' ? L : k === 'w' ? Wt : L && Wt;
  }
  _actTpl(list, th, hold) {
    const h = (this._n(hold) || 0) * 60;
    return '(' + list.map((e) => `(is_state('${e}', 'on') or (states('${e}') | float(0)) > ${th}${h > 0 ? ` or (as_timestamp(now()) - as_timestamp(states.${e}.last_changed, 0)) < ${h}` : ''})`).join(' or ') + ')';
  }
  _trgTpl(W) {
    const t = this._draft.trg, wv = this._n(t.wv) || 0, le = this._trgEnts(t.le), we = this._trgEnts(t.we);
    return this._trgOrder().map((k) => {
      const g = t[k];
      const cond = k === 'l' ? this._actTpl(le, 0, g.hold) : k === 'w' ? this._actTpl(we, wv, g.hold) : this._actTpl(le, 0, g.hold) + ' and ' + this._actTpl(we, wv, g.hold);
      const tg = this._boostTgt(W, 'czujnik: ' + TRG.find((x) => x[0] === k)[1].toLowerCase(), g.pn, g.pw);
      return `{% if out.t is none and ${cond} %}{% set out.t = ${this._jl(tg)} %}{% endif %}`;
    }).join('');
  }

  _ruleConds(r) { return r.conds.filter((x) => x.e && /^[a-z_]+\.[a-z0-9_]+$/.test(x.e)); }

  // ---- lustro logiki sterownika w karcie (do "teraz steruje" i podgladu) ----
  _condNow(x, hold) {
    const s = this._hass.states[x.e];
    if (!s) return false;
    const v = this._n(x.v);
    const cur = x.op === 'on' ? s.state === 'on' : x.op === 'off' ? s.state === 'off'
      : x.op === '=' ? s.state === String(x.v) : x.op === '>' ? (this._n(s.state) || 0) > (v || 0) : (this._n(s.state) || 0) < (v || 0);
    return cur || (Date.now() - new Date(s.last_changed)) / 60000 < (this._n(hold) || 0);
  }

  _nowCtl() {
    if (!this._draft || !this._hass) return null;
    const c = this._draft, W = this._wt();
    const cnt = [0, 1].map((i) => c.phones.filter((id) => this._phoneInfo(id).inZ[i]).length);
    const home = !c.z[0].on || !c.phones.length || cnt[0] > 0;
    const d = new Date(), mins = d.getHours() * 60 + d.getMinutes(), night = this._isNight(mins);
    const bb = this._hass.states[TIMER];
    if (bb && bb.state === 'on') return this._btnTgt(W);
    if (!home) {
      const yb = this._hass.states[WYJ_BOOL];
      if (yb && yb.state === 'on' && c.wyj.on) return this._boostTgt(W, 'wietrzenie po wyjeździe', c.wyj.pn, c.wyj.pw);
      if (c.z[1].on && cnt[1] > 0 && c.z[1].ltryb) return this._tgt(W, 'strefa 2', c.z[1].ltryb, c.z[1].lpn, c.z[1].lpw);
      return c.z[0].ltryb ? this._tgt(W, 'wyjazd', c.z[0].ltryb, c.z[0].lpn, c.z[0].lpw) : { src: 'wyjazd (bez zmiany trybu)' };
    }
    const wb = this._hass.states[WIET_BOOL];
    if (wb && wb.state === 'on') return this._wietTgt(W);
    for (const k of this._trgOrder()) {
      if (this._trgNow(k)) { const g = c.trg[k]; return this._boostTgt(W, 'czujnik: ' + TRG.find((x) => x[0] === k)[1].toLowerCase(), g.pn, g.pw); }
    }
    for (const r of c.rules) {
      const cs = this._ruleConds(r);
      if (r.on && cs.length && cs.every((x) => this._condNow(x, r.hold))) return this._boostTgt(W, 'reguła ' + r.name, night ? r.npn : r.dpn, night ? r.npw : r.dpw);
    }
    const nf = this._min(c.night.from), nt = this._min(c.night.to);
    if (night && this._cycOn(c.cyc.night, mins, nf)) return this._boostTgt(W, 'cykl nocny', c.cyc.night.pn, c.cyc.night.pw);
    if (!night && this._cycOn(c.cyc.day, mins, nt)) return this._boostTgt(W, 'cykl dzienny', c.cyc.day.pn, c.cyc.day.pw);
    if (c.sched.on) {
      const E = this._schedEntries(W, this._isLato() ? 'lato' : 'zima');
      if (E.length) {
        const wm = ((d.getDay() + 6) % 7) * 1440 + mins;
        let s = E[E.length - 1];
        E.forEach((e) => { if (e[0] <= wm) s = e; });
        return s[1];
      }
    }
    return { src: 'nic (brak harmonogramu)' };
  }

  _tgtTxt(t) {
    if (!t) return '—';
    const p = t.pn !== null && t.pn !== undefined ? ` · ${t.pn}/${t.pw} %` : '';
    return `<b>${esc(t.src)}</b>${t.tryb ? ' → ' + esc(t.tryb) : ''}${p}${t.temp !== null && t.temp !== undefined ? ' · ' + t.temp + ' °C' : ''}`;
  }

  // ---- generowanie automatyki sterownika ----
  _jl(x) { return JSON.stringify(x).replace(/\bnull\b/g, 'none'); }

  _countTpl(zi) {
    const c = this._draft, z = c.z[zi], st = Math.max(0, Number(c.stale) || 0);
    return `{% set ns = namespace(n=0) %}{% for s in expand(${this._jl(c.phones)}) %}{% set la = s.attributes.latitude %}{% set lo = s.attributes.longitude %}`
      + `{% if la is number and lo is number and (${st} == 0 or (as_timestamp(now()) - as_timestamp(s.last_updated)) < ${st * 60})`
      + ` and distance(la, lo, ${Number(z.lat)}, ${Number(z.lon)}) * 1000 <= ${Number(z.r) || 100} %}{% set ns.n = ns.n + 1 %}{% endif %}{% endfor %}`;
  }

  _condTpl(x, hold) {
    const e = x.e, q = (s) => "'" + String(s).replace(/'/g, '') + "'";
    const v = this._n(x.v) === null ? 0 : this._n(x.v);
    const cur = x.op === 'on' ? `is_state(${q(e)}, 'on')` : x.op === 'off' ? `is_state(${q(e)}, 'off')`
      : x.op === '=' ? `states(${q(e)}) == ${q(x.v)}` : x.op === '>' ? `states(${q(e)}) | float(0) > ${v}` : `states(${q(e)}) | float(0) < ${v}`;
    const h = (this._n(hold) || 0) * 60;
    return h > 0 ? `(${cur} or (as_timestamp(now()) - as_timestamp(states.${e}.last_changed, 0)) < ${h})` : `(${cur})`;
  }

  _ctlTpl(W) {
    const c = this._draft;
    const zl = c.z.map((z) => [!!z.on, Number(z.lat), Number(z.lon), Number(z.r) || 100]);
    const st = Math.max(0, Number(c.stale) || 0);
    const nf = this._min(c.night.from), nt = this._min(c.night.to);
    const away = c.z[0].ltryb ? this._tgt(W, 'wyjazd', c.z[0].ltryb, c.z[0].lpn, c.z[0].lpw) : null;
    const z2 = c.z[1].on && c.z[1].ltryb ? this._tgt(W, 'strefa 2', c.z[1].ltryb, c.z[1].lpn, c.z[1].lpw) : null;
    let t = `{% set Z = ${this._jl(zl)} %}{% set ns = namespace(c0=0, c1=0) %}`
      + `{% for s in expand(${this._jl(c.phones)}) %}{% set la = s.attributes.latitude %}{% set lo = s.attributes.longitude %}`
      + `{% if la is number and lo is number and (${st} == 0 or (as_timestamp(now()) - as_timestamp(s.last_updated)) < ${st * 60}) %}`
      + `{% if Z[0][0] and distance(la, lo, Z[0][1], Z[0][2]) * 1000 <= Z[0][3] %}{% set ns.c0 = ns.c0 + 1 %}{% endif %}`
      + `{% if Z[1][0] and distance(la, lo, Z[1][1], Z[1][2]) * 1000 <= Z[1][3] %}{% set ns.c1 = ns.c1 + 1 %}{% endif %}`
      + `{% endif %}{% endfor %}`
      + `{% set home = (not Z[0][0]) or ${c.phones.length} == 0 or ns.c0 > 0 %}`
      + `{% set mins = now().hour * 60 + now().minute %}`
      + `{% set night = ${nf > nt ? `(mins >= ${nf} or mins < ${nt})` : `(mins >= ${nf} and mins < ${nt})`} %}`
      + `{% set out = namespace(t=none) %}`
      + `{% if is_state('${TIMER}', 'on') %}{% set out.t = ${this._jl(this._btnTgt(W))} %}{% elif not home %}`
      + `{% if ${this._jl(!!c.wyj.on)} and is_state('${WYJ_BOOL}', 'on') %}{% set out.t = ${this._jl(this._boostTgt(W, 'wietrzenie po wyjeździe', c.wyj.pn, c.wyj.pw))} %}{% elif ns.c1 > 0 and ${this._jl(!!z2)} %}{% set out.t = ${this._jl(z2)} %}{% else %}{% set out.t = ${this._jl(away)} %}{% endif %}`
      + `{% elif is_state('${WIET_BOOL}', 'on') %}{% set out.t = ${this._jl(this._wietTgt(W))} %}`
      + `{% else %}` + this._trgTpl(W);
    c.rules.forEach((r) => {
      const cs = this._ruleConds(r);
      if (!r.on || !cs.length) return;
      const d = this._boostTgt(W, 'reguła ' + r.name, r.dpn, r.dpw), n = this._boostTgt(W, 'reguła ' + r.name, r.npn, r.npw);
      t += `{% if out.t is none and ${cs.map((x) => this._condTpl(x, r.hold)).join(' and ')} %}{% set out.t = ${this._jl(n)} if night else ${this._jl(d)} %}{% endif %}`;
    });
    const cyc = (cy, anchor, cond, src) => {
      const e = Math.round((this._n(cy.every) || 0) * 60), d = this._n(cy.dur) || 0;
      if (!cy.on || e <= 0 || d <= 0) return '';
      return `{% if out.t is none and ${cond} and ((mins - ${anchor}) % 1440) % ${e} < ${d} %}{% set out.t = ${this._jl(this._boostTgt(W, src, cy.pn, cy.pw))} %}{% endif %}`;
    };
    t += cyc(c.cyc.night, nf, 'night', 'cykl nocny') + cyc(c.cyc.day, nt, 'not night', 'cykl dzienny');
    const EZ = c.sched.on ? this._schedEntries(W, 'zima') : [];
    const EL = c.sched.on && c.sez.on ? this._schedEntries(W, 'lato') : [];
    if (EZ.length || EL.length) {
      const E = EZ.length ? EZ : EL;
      t += `{% if out.t is none %}{% set E = ${c.sez.on ? `(${this._jl(EL.length ? EL : EZ)} if is_state('${LATO_BOOL}', 'on') else ${this._jl(EZ.length ? EZ : EL)})` : this._jl(E)} %}{% set wm = now().weekday() * 1440 + mins %}{% set sn = namespace(s=E[-1]) %}`
        + `{% for e in E %}{% if e[0] <= wm %}{% set sn.s = e %}{% endif %}{% endfor %}{% set out.t = sn.s[1] %}{% endif %}`;
    }
    return t + `{% endif %}{{ out.t }}`;
  }

  _lockSeq(W) {
    return W.lock ? [{ service: 'switch.turn_on', target: { entity_id: W.lock } },
      { wait_template: `{{ is_state('${W.lock}', 'on') }}`, timeout: '00:00:15', continue_on_timeout: true }] : [];
  }

  _genCtl() {
    const c = this._draft, W = this._wt();
    const ruleEnts = [...new Set(c.rules.filter((r) => r.on).flatMap((r) => this._ruleConds(r).map((x) => x.e)))];
    const trig = [
      { platform: 'time_pattern', minutes: '/1' },
      { platform: 'homeassistant', event: 'start' },
      { platform: 'state', entity_id: WIET_BOOL },
      { platform: 'state', entity_id: TIMER },
    ];
    if (ruleEnts.length) trig.push({ platform: 'state', entity_id: ruleEnts });
    const trgEnts = [...new Set(this._trgEnts(c.trg.le).concat(this._trgEnts(c.trg.we)))];
    if (this._trgOrder().length && trgEnts.length) trig.push({ platform: 'state', entity_id: trgEnts });
    const sezSrc = this._sezSrc();
    const sezOn = !!(c.sez.on && sezSrc);
    if (sezOn) {
      const hold = { hours: Math.max(0, Number(String(c.sez.hold).replace(',', '.')) || 0) };
      trig.push({ platform: 'numeric_state', entity_id: sezSrc, below: Number(String(c.sez.zima).replace(',', '.')), for: hold, id: 'sez_zima' });
      trig.push({ platform: 'numeric_state', entity_id: sezSrc, above: Number(String(c.sez.lato).replace(',', '.')), for: hold, id: 'sez_lato' });
      trig.push({ platform: 'state', entity_id: LATO_BOOL, to: ['on', 'off'], id: 'sez_chg' });
    }
    const wyjOn = !!(c.wyj.on && (Number(c.wyj.min) || 0) > 0);
    if (wyjOn) {
      trig.push({ platform: 'state', entity_id: WYJ_BOOL });
    }
    if (c.phones.length && c.z[0].on) {
      trig.push({ platform: 'template', id: 'wjazd1', value_template: this._countTpl(0) + '{{ ns.n > 0 }}' });
      trig.push({ platform: 'template', id: 'wyjazd', value_template: this._countTpl(0) + '{{ ns.n == 0 }}', for: { minutes: 1 } });
    }
    if (c.phones.length && c.z[1].on) trig.push({ platform: 'template', id: 'wjazd2', value_template: this._countTpl(1) + '{{ ns.n > 0 }}' });
    const bon = { service: 'input_boolean.turn_on', target: { entity_id: WIET_BOOL } };
    const boff = { service: 'input_boolean.turn_off', target: { entity_id: WIET_BOOL } };
    const yon = { service: 'input_boolean.turn_on', target: { entity_id: WYJ_BOOL } };
    const yoff = { service: 'input_boolean.turn_off', target: { entity_id: WYJ_BOOL } };
    const ch = [{ conditions: [{ condition: 'trigger', id: 'wyjazd' }], sequence: wyjOn ? [boff, yon] : [boff] }];
    if (wyjOn) {
      ch.push({ conditions: [{ condition: 'trigger', id: 'wjazd1' }, { condition: 'state', entity_id: WYJ_BOOL, state: 'on' }], sequence: [yoff] });
    }
    if (sezOn) {
      ch.push({ conditions: [{ condition: 'trigger', id: 'sez_zima' }], sequence: [{ service: 'input_boolean.turn_off', target: { entity_id: LATO_BOOL } }] });
      ch.push({ conditions: [{ condition: 'trigger', id: 'sez_lato' }], sequence: [{ service: 'input_boolean.turn_on', target: { entity_id: LATO_BOOL } }] });
      const setSez = (sez) => {
        const seq = [];
        TZK.forEach((k) => { const v = this._n(c.tz[sez][k]); if (v !== null && this._st(k)) seq.push({ service: 'number.set_value', target: { entity_id: this._id(k) }, data: { value: v } }); });
        const opt = sez === 'lato' ? c.sez.el : c.sez.ez;
        if (c.sez.esp && opt && this._st('set_sezon')) seq.push({ service: 'select.select_option', target: { entity_id: this._id('set_sezon') }, data: { option: opt } });
        return seq;
      };
      [['lato', 'on'], ['zima', 'off']].forEach(([sez, st]) => {
        const seq = setSez(sez);
        if (seq.length) ch.push({ conditions: [{ condition: 'trigger', id: 'sez_chg' }, { condition: 'state', entity_id: LATO_BOOL, state: st }], sequence: this._lockSeq(this._wt()).concat(seq) });
      });
    }
    if (c.z[0].wiet && (Number(c.wiet.min) || 0) > 0) ch.push({ conditions: [{ condition: 'trigger', id: 'wjazd1' }], sequence: [bon] });
    if (c.z[1].wiet && (Number(c.wiet.min) || 0) > 0) ch.push({ conditions: [{ condition: 'trigger', id: 'wjazd2' }], sequence: [bon] });
    const ifDo = (cond, seq) => ({ if: [{ condition: 'template', value_template: cond }], then: seq });
    // v2.11: wylaczanie wietrzen po czasie liczone co minute z last_changed przelacznika
    // (licznik "for:" HA gubil przy kazdym przeladowaniu automatyki / restarcie)
    const expire = [[WIET_BOOL, c.wiet.min, 15]].concat(wyjOn ? [[WYJ_BOOL, c.wyj.min, 10]] : [])
      .map(([e, m, d]) => {
        const sec = Math.max(1, Number(String(m).replace(',', '.')) || d) * 60;
        return { if: [{ condition: 'template', value_template: `{{ is_state('${e}', 'on') and (as_timestamp(now()) - as_timestamp(states.${e}.last_changed, 0)) >= ${sec - 5} }}` }],
          then: [{ service: 'input_boolean.turn_off', target: { entity_id: e } }] };
      });
    const action = [
      ...ch.map((x) => ({ if: x.conditions, then: x.sequence })),
      ...expire,
      { variables: { t: this._ctlTpl(W) } },
      { condition: 'template', value_template: '{{ t is mapping }}' },
      { variables: {
        dn: "{{ t.n is string and t.pn is number and ((states(t.n) | float(-999)) - t.pn) | abs > 0.4 }}",
        dw: "{{ t.w is string and t.pw is number and ((states(t.w) | float(-999)) - t.pw) | abs > 0.4 }}",
        dm: W.sel ? `{{ t.tryb is string and t.tryb != '' and states('${W.sel}') != t.tryb }}` : '{{ false }}',
        dt: "{{ t.tid is string and t.temp is number and ((states(t.tid) | float(-999)) - t.temp) | abs > 0.05 }}",
      } },
      { condition: 'template', value_template: '{{ dn or dw or dm or dt }}' },
      ...this._lockSeq(W),
      ifDo('{{ dn }}', [{ service: 'number.set_value', target: { entity_id: '{{ t.n }}' }, data: { value: '{{ t.pn }}' } }]),
      ifDo('{{ dw }}', [{ service: 'number.set_value', target: { entity_id: '{{ t.w }}' }, data: { value: '{{ t.pw }}' } }]),
      ifDo('{{ dt }}', [{ service: 'number.set_value', target: { entity_id: '{{ t.tid }}' }, data: { value: '{{ t.temp }}' } }]),
    ];
    if (W.sel) action.push(ifDo('{{ dm }}', [{ service: 'select.select_option', target: { entity_id: W.sel }, data: { option: '{{ t.tryb }}' } }]));
    if (W.wietSw) {
      action.push(ifDo(`{{ t.src == 'wietrzenie' and not is_state('${W.wietSw}', 'on') }}`, [{ service: 'switch.turn_on', target: { entity_id: W.wietSw } }]));
      action.push(ifDo(`{{ t.src != 'wietrzenie' and is_state('${W.wietSw}', 'on') }}`, [{ service: 'switch.turn_off', target: { entity_id: W.wietSw } }]));
    }
    return {
      id: AUTO_IDS[0], alias: 'Rekuperacja – sterownik',
      description: 'Utworzone przez kartę compit-nano-one-card (Harmonogram + Strefy). Sezon lato/zima wg temp. zewnętrznej (input_boolean.rekuperacja_lato). Co minutę ustala tryb i %: wyjazd (wietrzenie po wyjeździe, potem nikogo) > wietrzenie wjazdu > czujniki (najsilniejszy) > reguły > cykle > harmonogram. Zmieniaj w karcie, nie tutaj.',
      mode: 'queued', max: 10, max_exceeded: 'silent',
      variables: { compit_cfg: c },
      trigger: trig, condition: [], action,
    };
  }

  async _delAuto(id) {
    try { await this._hass.callApi('DELETE', 'config/automation/config/' + id); } catch (e) { /* nie bylo */ }
    if (this._autoExists) this._autoExists[id] = false;
  }

  async _ensureLatoBool() {
    if (this._hass.states[LATO_BOOL]) return;
    let list = [];
    try { list = await this._hass.callWS({ type: 'input_boolean/list' }) || []; } catch (e) { list = []; }
    if (!list.some((x) => x.id === LATO_BOOL.split('.')[1] || x.name === 'Rekuperacja lato')) {
      await this._hass.callWS({ type: 'input_boolean/create', name: 'Rekuperacja lato', icon: 'mdi:weather-sunny' });
      this._pushLog({ t: new Date(), e: 'karta', s: 'Dodano przełącznik ' + LATO_BOOL });
    }
  }

  async _ensureWyjBool() {
    if (this._hass.states[WYJ_BOOL]) return;
    let list = [];
    try { list = await this._hass.callWS({ type: 'input_boolean/list' }) || []; } catch (e) { list = []; }
    if (!list.some((x) => x.id === WYJ_BOOL.split('.')[1] || x.name === 'Rekuperacja wietrzenie wyjazd')) {
      await this._hass.callWS({ type: 'input_boolean/create', name: 'Rekuperacja wietrzenie wyjazd', icon: 'mdi:car-arrow-right' });
      this._pushLog({ t: new Date(), e: 'karta', s: 'Dodano przełącznik ' + WYJ_BOOL });
    }
  }

  // v2.12: skrypt "Wietrzenie timer" - wywolanie = wietrzenie przez X min (z Stref), potem sam sie konczy
  async _ensureTimer(cfg) {
    const min = Math.max(1, Number(String(cfg.btn.min).replace(',', '.')) || 30);
    await this._hass.callApi('POST', 'config/script/config/' + TIMER.split('.')[1], {
      alias: 'Wietrzenie timer', icon: 'mdi:fan', mode: 'restart',
      description: `Utworzone przez kartę compit-nano-one-card. Wywołanie = wietrzenie przez ${min} min z % ze Stref („Wietrzenie z przycisku”), potem samo się kończy. Ponowne wywołanie liczy od nowa. Zmieniaj w karcie.`,
      sequence: [{ delay: { minutes: min } }],
    });
  }

  // v2.12: sprzatanie encji z v2.9-v2.11 i ukrycie wewnetrznych przelacznikow
  async _cleanupOld() {
    try {
      const btn = (await this._hass.callWS({ type: 'input_button/list' }) || []).find((x) => x.id === WIET_BTN.split('.')[1]);
      if (btn) { await this._hass.callWS({ type: 'input_button/delete', input_button_id: btn.id }); this._pushLog({ t: new Date(), e: 'karta', s: 'Usunięto stary ' + WIET_BTN }); }
    } catch (e) { /* brak */ }
    try {
      const b = (await this._hass.callWS({ type: 'input_boolean/list' }) || []).find((x) => x.id === BTN_BOOL.split('.')[1]);
      if (b) { await this._hass.callWS({ type: 'input_boolean/delete', input_boolean_id: b.id }); this._pushLog({ t: new Date(), e: 'karta', s: 'Usunięto stary ' + BTN_BOOL }); }
    } catch (e) { /* brak */ }
    for (const eid of [WIET_BOOL, WYJ_BOOL]) {
      if (!this._hass.entities || !this._hass.entities[eid] || this._hass.entities[eid].hidden) continue;
      try { await this._hass.callWS({ type: 'config/entity_registry/update', entity_id: eid, hidden_by: 'user' }); } catch (e) { /* zostaje widoczny */ }
    }
  }

  async _ensureWietBool() {
    if (this._hass.states[WIET_BOOL]) return;
    let list = [];
    try { list = await this._hass.callWS({ type: 'input_boolean/list' }) || []; } catch (e) { list = []; }
    if (!list.some((x) => x.id === WIET_BOOL.split('.')[1] || x.name === 'Rekuperacja wietrzenie')) {
      await this._hass.callWS({ type: 'input_boolean/create', name: 'Rekuperacja wietrzenie', icon: 'mdi:weather-windy' });
      this._pushLog({ t: new Date(), e: 'karta', s: 'Dodano przełącznik ' + WIET_BOOL });
    }
  }

  async _saveAll() {
    if (!this._isAdmin()) { this._flashMsg(false, 'Zapis wymaga konta administratora HA.'); return; }
    const cfg = this._mergeCfg(this._draft);
    this._draft = cfg;
    try { localStorage.setItem(LS_CFG, JSON.stringify(cfg)); } catch (e) { /* bez localStorage */ }
    this._saving = true; this._schedule();
    const done = [];
    try {
      let zones = [];
      try { zones = await this._hass.callWS({ type: 'zone/list' }) || []; } catch (e) { zones = []; }
      for (const i of [0, 1]) {
        const name = 'Rekuperacja ' + (i + 1), z = cfg.z[i];
        const ex = zones.find((x) => x.name === name);
        if (z.on) {
          const d = { name, icon: 'mdi:air-filter', latitude: Number(z.lat), longitude: Number(z.lon), radius: Number(z.r) || 100, passive: true };
          if (ex) await this._hass.callWS(Object.assign({ type: 'zone/update', zone_id: ex.id }, d));
          else await this._hass.callWS(Object.assign({ type: 'zone/create' }, d));
          done.push('strefa ' + (i + 1));
        } else if (ex) await this._hass.callWS({ type: 'zone/delete', zone_id: ex.id });
      }
      await this._ensureWietBool();
      await this._ensureTimer(cfg);
      done.push('Wietrzenie timer (' + TIMER + ')');
      if (cfg.wyj.on) { await this._ensureWyjBool(); done.push('przełącznik wietrzenia po wyjeździe'); }
      if (cfg.sez.on) {
        const had = !!this._hass.states[LATO_BOOL];
        await this._ensureLatoBool();
        done.push('przełącznik sezonu');
        // stan poczatkowy wg temp. zewnetrznej (wyzwalacz numeric_state lapie dopiero przejscie przez prog)
        const v = this._n((this._hass.states[this._sezSrc()] || {}).state);
        if (!had && v !== null) {
          setTimeout(() => {
            const lato = v > this._n(cfg.sez.lato) ? true : v < this._n(cfg.sez.zima) ? false : null;
            if (lato !== null && this._hass.states[LATO_BOOL]) this._hass.callService('input_boolean', lato ? 'turn_on' : 'turn_off', { entity_id: LATO_BOOL });
          }, 3000);
        }
      }
      const a = this._genCtl();
      await this._hass.callApi('POST', 'config/automation/config/' + a.id, a);
      this._autoExists[a.id] = true;
      await this._cleanupOld();
      done.push('sterownik');
      for (const id of OLD_IDS) if (this._autoExists[id]) await this._delAuto(id);
      this._pushLog({ t: new Date(), e: 'karta', s: 'Zapisano: ' + done.join(', ') });
      this._flashMsg(true, '✓ Zapisane w HA: ' + done.join(', '));
    } catch (e) {
      const m = e && (e.message || e.body && e.body.message) ? (e.message || e.body.message) : JSON.stringify(e);
      this._pushLog({ t: new Date(), e: 'karta', s: 'Błąd zapisu: ' + m });
      this._flashMsg(false, '✗ Błąd zapisu: ' + m);
    }
    this._saving = false; this._autoCache = null; this._schedule();
  }

  async _deleteAll() {
    this._confirmDel = false;
    if (!this._isAdmin()) return;
    for (const id of AUTO_IDS.concat(OLD_IDS)) await this._delAuto(id);
    try {
      const zones = await this._hass.callWS({ type: 'zone/list' }) || [];
      for (const z of zones.filter((x) => /^Rekuperacja [12]$/.test(x.name))) await this._hass.callWS({ type: 'zone/delete', zone_id: z.id });
    } catch (e) { /* brak */ }
    try {
      const bl = await this._hass.callWS({ type: 'input_boolean/list' }) || [];
      for (const eid of [WIET_BOOL, WYJ_BOOL, LATO_BOOL, BTN_BOOL]) {
        const b = bl.find((x) => x.id === eid.split('.')[1]);
        if (b) await this._hass.callWS({ type: 'input_boolean/delete', input_boolean_id: b.id });
      }
    } catch (e) { /* brak */ }
    try {
      const btn = (await this._hass.callWS({ type: 'input_button/list' }) || []).find((x) => x.id === WIET_BTN.split('.')[1]);
      if (btn) await this._hass.callWS({ type: 'input_button/delete', input_button_id: btn.id });
    } catch (e) { /* brak */ }
    try { await this._hass.callApi('DELETE', 'config/script/config/' + TIMER.split('.')[1]); } catch (e) { /* brak */ }
    this._pushLog({ t: new Date(), e: 'karta', s: 'Usunięto sterownik, strefy i przełącznik wietrzenia' });
    this._flashMsg(true, '✓ Usunięte z HA: sterownik, strefy, przełącznik wietrzenia (ustawienia zostały w karcie)');
  }

  // v2.2: panel "Rekuperacja" w lewym pasku HA - sprawdzany przy kazdym otwarciu karty,
  // zakladany sam raz na zaladowanie strony, a jak HA odmowi - pasek z przyciskiem i bledem
  async _checkSidebar(create) {
    if (!this._hass || !this._hass.callWS || this._config.sidebar === false) return;
    if (!this._isAdmin()) { this._sb = { st: 'noadmin' }; this._schedule(); return; }
    if (this._sbBusy) return;
    this._sbBusy = true;
    try {
      const list = await this._hass.callWS({ type: 'lovelace/dashboards/list' }) || [];
      const d = list.find((x) => x.url_path === SB_URL);
      if (d && d.show_in_sidebar === false && create) {
        await this._hass.callWS({ type: 'lovelace/dashboards/update', dashboard_id: d.id, show_in_sidebar: true });
        this._sb = { st: 'ok', fresh: true };
        this._pushLog({ t: new Date(), e: 'karta', s: 'Panel „Rekuperacja” był ukryty – włączony w pasku bocznym' });
      } else if (d) this._sb = { st: d.show_in_sidebar === false ? 'hidden' : 'ok' };
      else if (create) {
        await this._hass.callWS({ type: 'lovelace/dashboards/create', url_path: SB_URL, title: 'Rekuperacja', icon: 'mdi:air-filter', show_in_sidebar: true, require_admin: false, mode: 'storage' });
        await this._hass.callWS({ type: 'lovelace/config/save', url_path: SB_URL, config: this._sbConfig() });
        this._sb = { st: 'ok', fresh: true };
        this._pushLog({ t: new Date(), e: 'karta', s: 'Dodano panel „Rekuperacja” w lewym pasku (/' + SB_URL + ')' });
      } else this._sb = { st: 'missing' };
    } catch (e) {
      const m = e && (e.message || (e.error && e.error.message)) ? (e.message || e.error.message) : (e && e.code ? e.code : JSON.stringify(e));
      this._sb = { st: 'err', err: m };
      this._pushLog({ t: new Date(), e: 'karta', s: 'Panel w lewym pasku – błąd HA: ' + m });
    }
    this._sbBusy = false;
    if (this._sb && this._sb.fresh) setTimeout(() => { if (this._sb) this._sb.fresh = false; this._schedule(); }, 15000);
    this._schedule();
  }

  _sbConfig() {
    return { title: 'Rekuperacja', views: [{ title: 'Rekuperacja', path: 'rekuperacja', type: 'panel', cards: [{ type: 'custom:compit-nano-one-card', prefix: this._prefix }] }] };
  }

  _sbBar() {
    const b = this._sb;
    if (!b || this._config.sidebar === false) return '';
    if (b.st === 'ok') return b.fresh ? `<div class="flash ok">✓ Panel „Rekuperacja” jest w lewym pasku. Jak go nie widzisz, odśwież stronę (F5).</div>` : '';
    if (b.st === 'noadmin') return '';
    const yaml = `views:\n  - title: Rekuperacja\n    path: rekuperacja\n    type: panel\n    cards:\n      - type: custom:compit-nano-one-card\n        prefix: ${this._prefix}`;
    const why = b.st === 'hidden' ? 'Panel „Rekuperacja” istnieje, ale jest ukryty w lewym pasku.'
      : b.st === 'err' ? `HA nie pozwolił dodać panelu: <b>${esc(b.err)}</b>` : 'Nie ma jeszcze panelu „Rekuperacja” w lewym pasku HA.';
    return `<div class="sbbar"><div>${ico('home')} <span>${why}</span> <button class="act" data-sidebar ${this._sbBusy ? 'disabled' : ''}>${b.st === 'hidden' ? 'Pokaż w lewym pasku' : 'Dodaj Rekuperację do lewego paska'}</button></div>
      ${b.st === 'err' ? `<details><summary>Dodaj ręcznie</summary><div class="small">Ustawienia → Pulpity → <b>+ Dodaj pulpit</b> → Nowy pulpit od zera → tytuł <b>Rekuperacja</b>, ikona <code>mdi:air-filter</code>, zaznacz „Pokaż w pasku bocznym” → Utwórz. Otwórz go → ✎ Edytuj → ⋮ → <b>Edytor kodu</b> i wklej:</div><pre class="pre">${esc(yaml)}</pre></details>` : ''}</div>`;
  }


  // automatyka sterownika jako encja HA
  _autoEnts() {
    if (!this._hass) return [];
    if (this._autoCache && this._autoCache.src === this._hass.states) return this._autoCache.list;
    if (!this._autoCache || Date.now() - this._autoCache.t > 20000 || this._autoCache.list.some((id) => !this._hass.states[id])) {
      const all = AUTO_IDS.concat(OLD_IDS);
      const list = Object.keys(this._hass.states).filter((id) => id.startsWith('automation.') && all.includes(this._hass.states[id].attributes.id));
      this._autoCache = { t: Date.now(), list };
    }
    this._autoCache.src = this._hass.states;
    return this._autoCache.list;
  }

  _autoLabel(s) {
    const i = OLD_IDS.indexOf(s.attributes.id);
    return i < 0 ? 'Sterownik' : i === 0 ? 'Harmonogram (stary)' : 'Strefa ' + i + ' (stara)';
  }

  _autoLine() {
    const list = this._autoEnts().map((id) => this._hass.states[id]);
    const wb = this._hass.states[WIET_BOOL];
    if (!list.length && !wb) return '';
    const now = this._draft ? this._nowCtl() : null;
    return `<div class="autol">${ico('clock')}<span>${list.map((s) => `<span class="${s.state === 'on' ? 'aon' : 'mute'}" data-e="${esc(s.entity_id)}">${esc(this._autoLabel(s))} ${s.state === 'on' ? '✓' : '(wył.)'}</span>`).join(' · ')}
      ${now ? ` · teraz steruje: ${this._tgtTxt(now)}` : ''}</span></div>`;
  }

  _formFocused() {
    const ae = this.shadowRoot.activeElement;
    return !!(ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName) && ae.closest('[data-form]'));
  }

  _bindSet(path, v) {
    const parts = path.split('.');
    let o = this._draft;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = v;
  }

  _trybSel(path, val, W, empty) {
    const opts = W.opts.slice();
    if (val && !opts.includes(val)) opts.push(val);
    return `<select data-bind="${path}" data-rr><option value="">${esc(empty)}</option>${opts.map((o) => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}${W.opts.includes(o) ? '' : ' (brak w ESP)'}</option>`).join('')}</select>`;
  }

  _pctIn(path, v, lbl) {
    return `<label class="pin">${lbl} <input class="sm" inputmode="numeric" data-bind="${path}" value="${esc(v)}" placeholder="—">%</label>`;
  }
  _numIn(path, v, lbl, unit, cls) {
    return `<label>${lbl} <input class="${cls || 'sm'}" inputmode="decimal" data-bind="${path}" value="${esc(v)}">${unit ? ' ' + unit : ''}</label>`;
  }

  _planHead() {
    let s = this._flashBox();
    if (!this._isAdmin()) s += '<div class="warnbox">Zapis harmonogramu i stref wymaga konta <b>administratora</b> HA.</div>';
    if (!this._wt().sel) s += `<div class="errbox"><b>Brak encji „Ustaw tryb”</b> (<code>${esc(this._id('set_tryb'))}</code>) – sterownik nie będzie miał czym sterować. Wgraj YAML v1.6+.</div>`;
    const now = this._nowCtl();
    if (now) s += `<div class="nowl">${ico('clock')} Teraz steruje: ${this._tgtTxt(now)} <span class="small mute">(wg ustawień w karcie${this._autoEnts().length ? '' : ' – jeszcze niezapisanych w HA'})</span></div>`;
    return s;
  }

  _saveBar() {
    return `<div class="savebar"><button class="act" data-saveall ${this._saving || !this._isAdmin() ? 'disabled' : ''}>${this._saving ? 'Zapisuję…' : 'Zapisz w HA'}</button>
      <span class="small mute">Zapis tworzy / aktualizuje w HA sterownik, strefy i przełącznik wietrzenia. Po zmianie YAML na ESP kliknij Zapisz jeszcze raz.</span></div>`;
  }

  // ---------------- zakladka Harmonogram ----------------
  _modeColor(tryb) {
    const g = this._gearOf(tryb);
    if (g) return { 1: '#27b4ff', 2: '#3ddc6f', 3: '#ffa43a' }[g] || '#b07cff';
    if (!tryb) return '#5b6878';
    const pal = ['#8d9aab', '#b07cff', '#ff6b8a', '#2ec4b6', '#e2c044'];
    let h = 0; for (const ch of tryb) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return pal[h % pal.length];
  }

  _slotLabel(s) { return (s.tryb || (this._n(s.temp) !== null ? s.temp + ' °C' : '—')).replace(/^Reczny\s+/i, '').replace(/^Ręczny\s+/i, ''); }

  // bloki dnia: [{slot index | -1 (przeniesione z dnia wczesniej), start, end}]
  _dayBlocks(di) {
    const sl = this._sl();
    const ev = [];
    sl.forEach((s, i) => { if (s.d.includes(DAYS[di][0])) ev.push({ i, m: this._min(s.t) }); });
    ev.sort((a, b) => a.m - b.m || a.i - b.i);
    let carry = null;
    for (let k = 1; k <= 7 && !carry; k++) {
      const pd = DAYS[(di - k + 7) % 7][0];
      let best = null;
      sl.forEach((s, i) => { if (s.d.includes(pd) && (!best || this._min(s.t) >= best.m)) best = { i, m: this._min(s.t) }; });
      carry = best;
    }
    const out = [];
    const first = ev.length ? ev[0].m : 1440;
    if (first > 0 && carry) out.push({ i: carry.i, carry: true, a: 0, b: first });
    ev.forEach((e, k) => out.push({ i: e.i, a: e.m, b: k + 1 < ev.length ? ev[k + 1].m : 1440 }));
    return out;
  }

  _cycMarks(cy, anchor, inWin) {
    const e = Math.round((this._n(cy.every) || 0) * 60);
    if (!cy.on || e <= 0) return [];
    const out = [];
    for (let m = anchor; m < anchor + 1440; m += e) { const mm = m % 1440; if (inWin(mm)) out.push(mm); }
    return out;
  }

  _sezChips() {
    const c = this._draft;
    if (!c.sez.on) return '';
    const e = this._sedit(), now = this._isLato() ? 'lato' : 'zima';
    return `<div class="row small"><span class="mute">Edytujesz harmonogram:</span>
      <button class="chip ${e === 'zima' ? 'on' : ''}" data-sed="zima">❄ Zima${now === 'zima' ? ' (teraz)' : ''}</button>
      <button class="chip ${e === 'lato' ? 'on' : ''}" data-sed="lato">☀ Lato${now === 'lato' ? ' (teraz)' : ''}</button>
      <button class="mini" data-sezcopy="${e === 'lato' ? 'zima' : 'lato'}">skopiuj z ${e === 'lato' ? 'zimy' : 'lata'}</button></div>`;
  }

  _renderSez() {
    const c = this._draft, z = c.sez, src = this._sezSrc(), ss = src && this._hass.states[src], b = this._hass.states[LATO_BOOL];
    const tEnts = Object.keys(this._hass.states).filter((id) => id.startsWith('sensor.') && /°C/.test(this._hass.states[id].attributes.unit_of_measurement || '')).sort();
    const sezSel = this._st('set_sezon');
    const sopts = sezSel ? (sezSel.attributes.options || []) : [];
    const osel = (path, val, guess) => { const v = val || ''; return `<select data-bind="${path}" data-rr><option value="">—</option>${sopts.map((o) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; };
    const rows = TZK.filter((k) => this._st(k)).map((k) => `<tr><td>${esc(DEFAULT_E[k][2])}</td>
      <td><input class="sm" inputmode="decimal" data-bind="tz.zima.${k}" value="${esc(c.tz.zima[k])}" placeholder="—"> °C</td>
      <td><input class="sm" inputmode="decimal" data-bind="tz.lato.${k}" value="${esc(c.tz.lato[k])}" placeholder="—"> °C</td></tr>`).join('');
    return `<div class="z1h">
      <div class="zh"><label class="tgl"><input type="checkbox" data-bind="sez.on" data-rr ${z.on ? 'checked' : ''}> <b>${ico('sun')} Sezon lato / zima (sam się przełącza)</b></label>
        ${z.on ? `<span class="zb ${this._isLato() ? 'z2' : 'z1'}">teraz: ${b ? (b.state === 'on' ? '☀ LATO' : '❄ ZIMA') : 'po zapisie'}</span>` : ''}</div>
      ${z.on ? `<div class="srow"><label>Temp. zewnętrzna <select data-bind="sez.src" data-rr><option value="">auto (${esc(src || 'brak')})</option>${tEnts.map((id) => `<option value="${esc(id)}" ${id === z.src ? 'selected' : ''}>${esc(this._hass.states[id].attributes.friendly_name || id)}</option>`).join('')}</select></label>
          <span class="small mute">teraz: ${ss ? esc(ss.state) + ' °C' : '—'}</span></div>
        <div class="srow">${this._numIn('sez.zima', z.zima, '❄ Zima poniżej', '°C')}${this._numIn('sez.lato', z.lato, '☀ Lato powyżej', '°C')}${this._numIn('sez.hold', z.hold, 'przez', 'h')}
          <button class="mini" data-sezset="zima">❄ zima teraz</button><button class="mini" data-sezset="lato">☀ lato teraz</button></div>
        <div class="sublbl">Temperatury zadane w reku (wpisywane przy zmianie sezonu)</div>
        ${rows ? `<table class="ptab"><tr><th></th><th>❄ Zima</th><th>☀ Lato</th></tr>${rows}</table>` : '<div class="small mute">Brak encji temperatur zadanych z ESP.</div>'}
        <div class="small mute">„Ręczna” to też domyślna temperatura wpisu w harmonogramie danego sezonu (gdy wpis nie ma własnej).</div>
        ${sezSel ? `<div class="srow"><label class="tgl"><input type="checkbox" data-bind="sez.esp" data-rr ${z.esp ? 'checked' : ''}> Przestaw też SEZON w ESP</label>
          ${z.esp ? `<label>zima → ${osel('sez.ez', z.ez)}</label><label>lato → ${osel('sez.el', z.el)}</label>` : ''}</div>` : ''}
        <div class="small mute">Przełącza się dopiero, gdy temperatura trzyma się za progiem przez podany czas. Przełącznik <code>${LATO_BOOL}</code> (ON = lato) powstaje przy zapisie.</div>` : '<div class="small mute">Wyłączone: działa jeden harmonogram (zima).</div>'}
    </div>`;
  }

  _renderChart() {
    const c = this._draft, sl = this._sl();
    const d = new Date(), today = (d.getDay() + 6) % 7, nowM = d.getHours() * 60 + d.getMinutes();
    const pc = (m) => (m / 1440 * 100).toFixed(3) + '%';
    const sezHead = this._sezChips();
    const nf = this._min(c.night.from), nt = this._min(c.night.to);
    const nightBands = nf > nt ? [[nf, 1440], [0, nt]] : [[nf, nt]];
    const marks = this._cycMarks(c.cyc.night, nf, (m) => this._isNight(m)).map((m) => [m, 'n'])
      .concat(this._cycMarks(c.cyc.day, nt, (m) => !this._isNight(m)).map((m) => [m, 'd']));
    const head = `<div class="wrow whead"><span></span><div class="wtrack0">${[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => `<span style="left:${pc(h * 60)}">${h}</span>`).join('')}</div></div>`;
    const rows = DAYS.map(([k, l], di) => {
      const blocks = this._dayBlocks(di).map((b) => {
        const s = sl[b.i], col = this._modeColor(s.tryb), sel = this._slotEdit === b.i && !b.carry;
        return `<div class="blk ${b.carry ? 'carry' : ''} ${sel ? 'sel' : ''}" style="left:${pc(b.a)};width:${pc(b.b - b.a)};--bc:${col}" data-blk="${b.i}" data-bday="${di}" title="${esc(this._hm(this._min(s.t)) + ' ' + (s.tryb || ''))}">
          ${b.carry ? '' : `<span class="bh" data-drag="${b.i}" data-dday="${di}"></span>`}<span class="bl">${b.carry ? '' : esc(s.t) + ' '}${esc(this._slotLabel(s))}</span></div>`;
      }).join('');
      return `<div class="wrow"><span class="wday ${di === today ? 'on' : ''}">${l}</span><div class="wtrack" data-track="${di}">
        ${nightBands.map(([a, b]) => `<i class="nband" style="left:${pc(a)};width:${pc(b - a)}"></i>`).join('')}
        ${blocks}
        ${marks.map(([m, t]) => `<i class="cmark ${t}" style="left:${pc(m)}" title="cykl ${t === 'n' ? 'nocny' : 'dzienny'} ${this._hm(m)}"></i>`).join('')}
        ${di === today ? `<i class="nowline" style="left:${pc(nowM)}"></i>` : ''}</div></div>`;
    }).join('');
    const used = [...new Set(sl.map((s) => s.tryb).filter(Boolean))];
    return `${sezHead}<div class="wk">${head}${rows}</div>
      <div class="legend">${used.map((t) => `<span><i style="background:${this._modeColor(t)}"></i>${esc(t)}</span>`).join('')}
        <span><i class="lg-night"></i>noc ${esc(c.night.from)}–${esc(c.night.to)}</span>${marks.length ? '<span><i class="lg-cyc"></i>start cyklu</span>' : ''}<span><i class="lg-now"></i>teraz</span></div>
      <div class="small mute">Klik w blok = edycja, dwuklik = nowy wpis od tej godziny (klik w pusty pasek też dodaje). Przeciągnij lewą krawędź bloku, żeby zmienić godzinę (co 15 min).</div>`;
  }

  _slotEditor(i) {
    const s = this._sl()[i], W = this._wt(), sp = this._sp(), defT = this._draft.tz[this._sedit()].t_reczna;
    if (!s) return '';
    const g = this._gearOf(s.tryb);
    return `<div class="sedit"><div class="zh"><b>Wpis ${esc(s.t)} · ${esc(s.tryb || '—')}</b><button class="mini" data-sclose>✕ zamknij</button></div>
      <div class="days">${DAYS.map(([k, l]) => `<button class="chip ${s.d.includes(k) ? 'on' : ''}" data-day="${i}:${k}">${l}</button>`).join('')}
        <button class="mini" data-dayset="${i}:wd">Pn–Pt</button><button class="mini" data-dayset="${i}:we">Weekend</button><button class="mini" data-dayset="${i}:all">Cały tydzień</button></div>
      <div class="srow"><label>Od <input type="time" step="900" data-bind="${sp}.${i}.t" data-rr value="${esc(s.t)}"></label>
        <label>Tryb ${this._trybSel(sp + '.' + i + '.tryb', s.tryb, W, '— bez zmiany —')}</label>
        ${W.temp ? `<label>Temperatura <input class="sm" inputmode="decimal" data-bind="${sp}.${i}.temp" value="${esc(s.temp)}" placeholder="${esc(defT === '' ? '—' : defT)}"> °C</label>` : ''}
        ${g ? this._pctIn(`${sp}.${i}.pn`, s.pn, 'Nawiew') + this._pctIn(`${sp}.${i}.pw`, s.pw, 'Wywiew') : ''}
        <button class="mini" data-delslot="${i}">🗑 usuń wpis</button></div>
      ${g ? `<div class="small mute">Puste % = domyślne % biegu ${g} (niżej).</div>` : ''}
      ${W.temp ? `<div class="small mute">Pusta temperatura = temp. ${this._sedit()} z sekcji Sezon${defT === '' ? ' (nieustawiona – bez zmiany)' : ' (' + esc(defT) + ' °C)'}.</div>` : ''}</div>`;
  }

  _renderHarm() {
    if (!this._draft) return '<div class="mute">Wczytuję ustawienia z HA…</div>';
    const c = this._draft, W = this._wt();
    const wb = this._hass.states[WIET_BOOL];
    const list = this._sl().map((s, i) => `<div class="lrow"><span class="dot2" style="background:${this._modeColor(s.tryb)}"></span>
      <span>${esc(s.d.map((d) => DAYS.find((x) => x[0] === d)[1]).join(' ') || 'bez dni')}</span><b>${esc(s.t)}</b><span>${esc(s.tryb || '—')}</span>
      <button class="mini" data-sopen="${i}">edytuj</button></div>`).join('');
    const rule = (r, ri) => `<div class="rule"><div class="zh"><label class="tgl"><input type="checkbox" data-bind="rules.${ri}.on" data-rr ${r.on ? 'checked' : ''}>
        <input class="md" data-bind="rules.${ri}.name" value="${esc(r.name)}"></label><button class="mini" data-delrule="${ri}">🗑 usuń regułę</button></div>
      <div class="sublbl">Gdy wszystkie naraz</div>
      ${r.conds.map((x, ci) => `<div class="srow cond"><input class="lg" list="cents" placeholder="encja, np. light.lazienka" data-bind="rules.${ri}.conds.${ci}.e" data-rr value="${esc(x.e)}">
        <select data-bind="rules.${ri}.conds.${ci}.op" data-rr>${[['on', 'włączone'], ['off', 'wyłączone'], ['>', 'większe niż'], ['<', 'mniejsze niż'], ['=', 'równe']].map(([v, l]) => `<option value="${v}" ${x.op === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${/[<>=]/.test(x.op) ? `<input class="sm" data-bind="rules.${ri}.conds.${ci}.v" value="${esc(x.v)}">` : ''}
        <span class="small mute">${(() => { const s = this._hass.states[x.e]; return s ? 'teraz: ' + esc(s.state) + (s.attributes.unit_of_measurement ? ' ' + esc(s.attributes.unit_of_measurement) : '') : x.e ? '<span class="warn">nie ma takiej encji</span>' : ''; })()}</span>
        <button class="mini" data-delcond="${ri}:${ci}">✕</button></div>`).join('')}
      <div class="row"><button class="mini" data-addcond="${ri}">+ warunek</button></div>
      <div class="srow"><span class="mute">Dzień</span>${this._pctIn(`rules.${ri}.dpn`, r.dpn, 'Nawiew')}${this._pctIn(`rules.${ri}.dpw`, r.dpw, 'Wywiew')}
        <span class="mute">Noc</span>${this._pctIn(`rules.${ri}.npn`, r.npn, 'Nawiew')}${this._pctIn(`rules.${ri}.npw`, r.npw, 'Wywiew')}
        ${this._numIn(`rules.${ri}.hold`, r.hold, 'Trzymaj jeszcze', 'min')}</div></div>`;
    const cyc = (k, l) => { const cy = c.cyc[k]; return `<div class="srow"><label class="tgl"><input type="checkbox" data-bind="cyc.${k}.on" data-rr ${cy.on ? 'checked' : ''}> <b>${l}</b></label>
      ${this._numIn(`cyc.${k}.every`, cy.every, 'co', 'h')}${this._numIn(`cyc.${k}.dur`, cy.dur, 'na', 'min')}${this._pctIn(`cyc.${k}.pn`, cy.pn, 'Nawiew')}${this._pctIn(`cyc.${k}.pw`, cy.pw, 'Wywiew')}</div>`; };
    const ents = Object.keys(this._hass.states).filter((id) => /^(light|switch|binary_sensor|sensor|input_boolean|fan|media_player)\./.test(id)).sort();
    return `<div class="plan" data-form>
      ${this._planHead()}
      ${this._renderSez()}
      <div class="zh"><label class="tgl"><input type="checkbox" data-bind="sched.on" data-rr ${c.sched.on ? 'checked' : ''}> <b>Harmonogram tygodniowy</b></label>
        <span class="small mute">działa, gdy ktoś jest w strefie 1${c.z[0].on && c.phones.length ? '' : ' (bez telefonów / strefy: zawsze)'}</span></div>
      ${this._renderChart()}
      <div class="row"><button class="opt" data-addslot>+ Dodaj wpis</button></div>
      ${this._slotEdit !== undefined && this._slotEdit !== null ? this._slotEditor(this._slotEdit) : ''}
      <details class="lst"><summary>Lista wpisów – ${this._sedit()} (${this._sl().length})</summary>${list || '<div class="small mute">Brak wpisów.</div>'}</details>
      <div class="pgrid">
        <div>
          <h3 class="rest">Noc i biegi</h3>
          <div class="srow"><label>Noc od <input type="time" step="900" data-bind="night.from" data-rr value="${esc(c.night.from)}"></label><label>do <input type="time" step="900" data-bind="night.to" data-rr value="${esc(c.night.to)}"></label></div>
          <div class="sublbl">Domyślne % biegów (gdy wpis nie ma własnych)</div>
          <table class="ptab"><tr><th></th><th>Nawiew</th><th>Wywiew</th></tr>${['1', '2', '3'].map((g) => `<tr><td>Bieg ${g}</td><td><input class="sm" inputmode="numeric" data-bind="base.n${g}" value="${esc(c.base['n' + g])}"> %</td><td><input class="sm" inputmode="numeric" data-bind="base.w${g}" value="${esc(c.base['w' + g])}"> %</td></tr>`).join('')}</table>
          <div class="srow"><label>Reguły, cykle i wietrzenie (bez opcji w ESP) jadą na <select data-bind="boost" data-rr>${['1', '2', '3'].map((g) => `<option value="${g}" ${String(c.boost) === g ? 'selected' : ''}>biegu ${g}</option>`).join('')}</select></label>
            ${this._gearOpt(W, c.boost) ? '' : `<span class="small warn">brak trybu z „bieg ${esc(c.boost)}” w „Ustaw tryb”</span>`}</div>
          <h3 class="rest">${ico('sync')} Cykle</h3>
          ${cyc('day', 'Dzień')}${cyc('night', 'Noc')}
          <div class="small mute">Np. w nocy co 2 h na 15 min 60/60 %. Liczone od początku dnia / nocy. Potem wraca tryb z harmonogramu.</div>
          <h3 class="rest">${ico('wind')} Wietrzenie</h3>
          <div class="srow">${this._numIn('wiet.min', c.wiet.min, 'Czas', 'min')}${this._pctIn('wiet.pn', c.wiet.pn, 'Nawiew')}${this._pctIn('wiet.pw', c.wiet.pw, 'Wywiew')}</div>
          <div class="srow">${wb ? `<span>Przełącznik <code data-e="${WIET_BOOL}">${WIET_BOOL}</code>: <b>${wb.state === 'on' ? 'WŁ.' : 'WYŁ.'}</b></span><button class="mini" data-wbool>${wb.state === 'on' ? 'Wyłącz' : 'Włącz teraz'}</button>`
            : `<span class="small mute">Po zapisie powstanie przełącznik <code>${WIET_BOOL}</code> – wstaw go na dowolną swoją kartę.</span>`}</div>
          <div class="small mute">${W.wietOpt ? `Wietrzenie z ESP: „${esc(W.wietOpt)}”.` : W.wietSw ? 'Wietrzenie z ESP: przełącznik ' + esc(W.wietSw) + '.' : `W YAML nie ma jeszcze wietrzenia – do tego czasu wietrzenie = bieg ${esc(c.boost)} z tymi %.`}</div>
        </div>
        <div>
          <h3 class="rest">${ico('filt')} Reguły (${c.rules.length})</h3>
          ${c.rules.map(rule).join('') || '<div class="small mute">Np. „Łazienka”: light.lazienka włączone i przepływ wody &gt; 0 → nawiew/wywiew 90 %, trzymaj 10 min.</div>'}
          <div class="row"><button class="opt" data-addrule>+ Dodaj regułę</button></div>
          <div class="small mute">Kolejność ważności: wyjazd &gt; wietrzenie &gt; reguły (pierwsza pasująca) &gt; cykle &gt; harmonogram.</div>
        </div>
      </div>
      <datalist id="cents">${ents.map((id) => `<option value="${esc(id)}">`).join('')}</datalist>
      ${this._saveBar()}
      ${this._sbBar()}
    </div>`;
  }

  // ---------------- zakladka Strefy ----------------
  _hav(la1, lo1, la2, lo2) {
    const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(a));
  }

  _phoneInfo(id) {
    const c = this._draft, s = this._hass.states[id];
    if (!s) return { miss: true, inZ: [false, false] };
    const la = s.attributes.latitude, lo = s.attributes.longitude;
    const age = (Date.now() - new Date(s.last_updated)) / 60000;
    const st = Number(c.stale) || 0;
    const fresh = !st || age < st;
    const gps = typeof la === 'number' && typeof lo === 'number';
    const dist = c.z.map((z) => (gps ? this._hav(la, lo, Number(z.lat), Number(z.lon)) : null));
    const inZ = c.z.map((z, i) => z.on && gps && fresh && dist[i] <= Number(z.r));
    return { s, la, lo, gps, age, fresh, dist, inZ };
  }

  _fmtDist(m) { return m === null ? '—' : m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km'; }

  _renderZones() {
    if (!this._draft) return '<div class="mute">Wczytuję ustawienia z HA…</div>';
    const c = this._draft, W = this._wt();
    const name = (id) => { const s = this._hass.states[id]; return s && s.attributes.friendly_name || id; };
    const phones = c.phones.map((id, i) => {
      const p = this._phoneInfo(id);
      const info = p.miss ? '<span class="warn">brak encji</span>'
        : !p.gps ? '<span class="warn">brak GPS (potrzebna aplikacja HA na telefonie)</span>'
        : `${p.fresh ? '' : '<span class="warn">nieaktualny – nie liczy się</span> · '}${Math.round(p.age)} min temu · S1 ${this._fmtDist(p.dist[0])}${c.z[1].on ? ' · S2 ' + this._fmtDist(p.dist[1]) : ''}`;
      return `<div class="phone">${ico('phone')}<b data-e="${esc(id)}">${esc(name(id))}</b>
        ${p.inZ[0] ? '<span class="zb z1">w strefie 1</span>' : ''}${p.inZ[1] ? '<span class="zb z2">w strefie 2</span>' : ''}
        <span class="small mute">${info}</span><button class="mini" data-delph="${i}">✕</button></div>`;
    }).join('');
    const cand = Object.keys(this._hass.states).filter((id) => /^(device_tracker|person)\./.test(id) && !c.phones.includes(id))
      .sort((a, b) => String(name(a)).localeCompare(String(name(b))));
    const zone = (i) => {
      const z = c.z[i], p = 'z.' + i + '.';
      const cnt = c.phones.filter((id) => this._phoneInfo(id).inZ[i]).length;
      const gl = this._gearOf(z.ltryb);
      return `<div class="zone zc${i + 1} ${z.on ? '' : 'off'}">
        <div class="zh"><label class="tgl"><input type="checkbox" data-bind="${p}on" data-rr ${z.on ? 'checked' : ''}> <b>Strefa ${i + 1}</b>${i ? ' <span class="small mute">(opcja, np. „blisko domu”)</span>' : ' <span class="small mute">(dom)</span>'}</label>
          ${z.on ? `<span class="zb z${i + 1}">${cnt ? 'teraz w strefie: ' + cnt : 'nikogo w strefie'}</span>` : ''}</div>
        ${z.on ? `<div class="srow"><label>Promień <input class="sm" inputmode="numeric" data-bind="${p}r" data-map value="${esc(z.r)}"> m</label>
          <label>Szer. <input class="md" inputmode="decimal" data-bind="${p}lat" data-map value="${esc(z.lat)}"></label>
          <label>Dł. <input class="md" inputmode="decimal" data-bind="${p}lon" data-map value="${esc(z.lon)}"></label>
          <button class="mini" data-zhome="${i}">środek = dom</button></div>
        ${i ? `<div class="srow"><label class="tgl"><input type="checkbox" data-bind="${p}wiet" ${z.wiet ? 'checked' : ''}> Wjazd (pierwszy telefon) włącza wietrzenie na ${esc(c.wiet.min)} min</label></div>
        <div class="sublbl">Gdy ktoś tu jest, a nikogo w strefie 1</div>
        <div class="srow"><label>Tryb ${this._trybSel(p + 'ltryb', z.ltryb, W, '— jak wyjazd —')}</label>
          ${gl ? this._pctIn(p + 'lpn', z.lpn, 'Nawiew') + this._pctIn(p + 'lpw', z.lpw, 'Wywiew') : ''}</div>`
        : '<div class="small mute">Wjazd, wyjazd, „nikogo nie ma”, czujniki i harmonogram strefy 1 ustawiasz niżej w <b>Harmonogramie strefy 1</b>.</div>'}` : ''}
      </div>`;
    };
    return `<div class="plan" data-form>
      ${this._planHead()}
      <div class="zgrid"><div>
      <h3>${ico('phone')} Telefony (${c.phones.length})</h3>
      ${phones || '<div class="small mute">Dodaj telefony (encje device_tracker z aplikacji Home Assistant albo osoby).</div>'}
      <div class="srow"><select data-addph><option value="">+ dodaj telefon…</option>${cand.map((id) => `<option value="${esc(id)}">${esc(name(id))} (${esc(id)})</option>`).join('')}</select>
        <label>Nieaktualny po <input class="sm" inputmode="numeric" data-bind="stale" value="${esc(c.stale)}"> min</label><span class="small mute">(0 = nie sprawdzaj)</span></div>
      ${zone(0)}${zone(1)}
      </div><div class="mapcol">
      <h3>${ico('map')} Mapa</h3>
      <div class="row small"><span class="mute">Klik w mapę stawia znacznik środka strefy:</span>
        ${[0, 1].map((i) => `<button class="mini ${(this._mapPick || 0) === i ? 'on' : ''}" data-mpick="${i}" ${c.z[i].on ? '' : 'disabled'}>Strefa ${i + 1}</button>`).join('')}
        <button class="mini" data-mfit>pokaż strefy</button></div>
      <div id="mapslot"><slot name="map"></slot></div>
      <div class="small mute">Przeciągnij kropkę w środku, żeby przesunąć strefę, a uchwyt na krawędzi, żeby zmienić promień.</div>
      </div></div>
      ${this._renderZ1()}
      ${this._saveBar()}
      <div class="row">${this._confirmDel ? '<span class="small warn">Na pewno usunąć z HA sterownik, strefy i przełącznik wietrzenia?</span><button class="mini" data-delall="yes">Tak, usuń</button><button class="mini" data-delall="no">Nie</button>'
        : '<button class="mini" data-delall="ask">Usuń wszystko z HA</button>'}</div>
    </div>`;
  }

  // ---------------- v2.5: Harmonogram strefy 1 ----------------
  _renderZ1() {
    const c = this._draft, W = this._wt(), z = c.z[0], t = c.trg;
    const gl = this._gearOf(z.ltryb);
    const wb = this._hass.states[WIET_BOOL], yb = this._hass.states[WYJ_BOOL];
    const name = (id) => { const s = this._hass.states[id]; return s && s.attributes.friendly_name || id; };
    const now = (id) => { const s = this._hass.states[id]; return s ? esc(s.state) + (s.attributes.unit_of_measurement ? ' ' + esc(s.attributes.unit_of_measurement) : '') : '<span class="warn">brak encji</span>'; };
    const chips = (k) => (t[k] || []).map((e, i) => `<span class="echip" data-e="${esc(e)}">${esc(name(e))} <span class="small mute">(${now(e)})</span> <button class="mini" data-deltrg="${k}:${i}">✕</button></span>`).join('')
      || '<span class="small mute">brak – dodaj encję</span>';
    const add = (k, ph, list) => `<div class="srow"><input class="lg" list="${list}" placeholder="${ph}" data-trgin="${k}"><button class="mini" data-addtrg="${k}">+ dodaj</button></div>`;
    const ents = Object.keys(this._hass.states);
    const lEnts = ents.filter((id) => /^(light|switch|input_boolean|binary_sensor)\./.test(id)).sort();
    const wEnts = ents.filter((id) => /^(sensor|binary_sensor|switch|input_boolean)\./.test(id)).sort();
    const trg = (k, l) => { const g = t[k]; return `<div class="srow"><label class="tgl"><input type="checkbox" data-bind="trg.${k}.on" data-rr ${g.on ? 'checked' : ''}> <b>${l}</b></label>
      ${this._pctIn(`trg.${k}.pn`, g.pn, 'Nawiew')}${this._pctIn(`trg.${k}.pw`, g.pw, 'Wywiew')}${this._numIn(`trg.${k}.hold`, g.hold, 'po wyłączeniu jeszcze', 'min')}
      ${g.on && this._draft && this._trgNow(k) ? '<span class="zb z1">teraz aktywny</span>' : ''}</div>`; };
    const cyc = (k, l) => { const cy = c.cyc[k]; return `<div class="srow"><label class="tgl"><input type="checkbox" data-bind="cyc.${k}.on" data-rr ${cy.on ? 'checked' : ''}> <b>${l}</b></label>
      ${this._numIn(`cyc.${k}.every`, cy.every, 'co', 'h')}${this._numIn(`cyc.${k}.dur`, cy.dur, 'na', 'min')}${this._pctIn(`cyc.${k}.pn`, cy.pn, 'Nawiew')}${this._pctIn(`cyc.${k}.pw`, cy.pw, 'Wywiew')}</div>`; };
    return `<div class="z1h">
      <h3>${ico('clock')} Harmonogram strefy 1</h3>
      <div class="small mute">Kolejność: wyjazd → wietrzenie po wyjeździe → „nikogo nie ma”. Wjazd → wietrzenie wjazdu → czujniki (najsilniejszy wygrywa) → cykle → harmonogram tygodniowy.</div>
      <div class="pgrid"><div>
        <div class="sublbl">Wietrzenie z przycisku – encja ${TIMER} („Wietrzenie timer”)</div>
        <div class="srow">${this._numIn('btn.min', c.btn.min, 'Czas', 'min')}${this._pctIn('btn.pn', c.btn.pn, 'Nawiew')}${this._pctIn('btn.pw', c.btn.pw, 'Wywiew')}
          ${this._hass.states[TIMER] ? `<span class="small ${this._hass.states[TIMER].state === 'on' ? 'aon' : 'mute'}">${this._hass.states[TIMER].state === 'on' ? 'teraz WŁ.' : 'wył.'}</span>` : '<span class="small mute">powstanie po „Zapisz w HA”</span>'}</div>
        <div class="small mute">Działa zawsze, też gdy nikogo nie ma, i ma pierwszeństwo przed wszystkim. Ponowne naciśnięcie liczy czas od nowa.</div>
        <div class="sublbl">1. Wjazd do strefy (pierwszy telefon)</div>
        <div class="srow"><label class="tgl"><input type="checkbox" data-bind="z.0.wiet" data-rr ${z.wiet ? 'checked' : ''}> Wietrzenie</label>
          ${this._numIn('wiet.min', c.wiet.min, 'na', 'min')}${this._pctIn('wiet.pn', c.wiet.pn, 'Nawiew')}${this._pctIn('wiet.pw', c.wiet.pw, 'Wywiew')}
          ${wb ? `<span class="small ${wb.state === 'on' ? 'aon' : 'mute'}">${wb.state === 'on' ? 'teraz WŁ.' : 'wył.'}</span>` : ''}</div>
        <div class="sublbl">2. Wyjazd ze strefy (ostatni telefon wyszedł)</div>
        <div class="srow"><label class="tgl"><input type="checkbox" data-bind="wyj.on" data-rr ${c.wyj.on ? 'checked' : ''}> Wietrzenie po wyjeździe</label>
          ${this._numIn('wyj.min', c.wyj.min, 'na', 'min')}${this._pctIn('wyj.pn', c.wyj.pn, 'Nawiew')}${this._pctIn('wyj.pw', c.wyj.pw, 'Wywiew')}
          ${yb ? `<span class="small ${yb.state === 'on' ? 'aon' : 'mute'}">${yb.state === 'on' ? 'teraz WŁ.' : 'wył.'}</span>` : ''}</div>
        <div class="sublbl">3. Nikogo nie ma w strefie (po wietrzeniu)</div>
        <div class="srow"><label>Tryb ${this._trybSel('z.0.ltryb', z.ltryb, W, '— bez zmiany —')}</label>
          ${gl ? this._pctIn('z.0.lpn', z.lpn, 'Nawiew') + this._pctIn('z.0.lpw', z.lpw, 'Wywiew') : '<span class="small mute">% wpiszesz po wyborze trybu z biegiem</span>'}</div>
        <div class="sublbl">4. Wietrzenie co jakiś czas (gdy ktoś jest)</div>
        ${cyc('day', 'Dzień')}${cyc('night', 'Noc')}
        <div class="srow"><label>Noc od <input type="time" step="900" data-bind="night.from" data-rr value="${esc(c.night.from)}"></label><label>do <input type="time" step="900" data-bind="night.to" data-rr value="${esc(c.night.to)}"></label></div>
      </div><div>
        <div class="sublbl">5. Czujniki (gdy ktoś jest)</div>
        <div class="small"><b>Światła</b></div><div class="echips">${chips('le')}</div>${add('le', 'np. light.lazienka', 'z1l')}
        <div class="small"><b>Woda</b> <span class="mute">(przepływ / zawór / czujnik; aktywna gdy „on” albo wartość &gt;</span> <input class="sm" inputmode="decimal" data-bind="trg.wv" value="${esc(t.wv)}"><span class="mute">)</span></div>
        <div class="echips">${chips('we')}</div>${add('we', 'np. sensor.przeplyw_wody', 'z1w')}
        ${TRG.map(([k, l]) => trg(k, l)).join('')}
        <div class="small mute">Każdy ustawiasz osobno. Jak pasuje kilka naraz, wygrywa ten z większym nawiewem + wywiewem. Biegi bez opcji w ESP jadą na biegu ${esc(c.boost)} z tymi %.</div>
      </div></div>
      <div class="sublbl">6. Harmonogram tygodniowy (gdy ktoś jest, po wjeździe)</div>
      <div class="zh"><label class="tgl"><input type="checkbox" data-bind="sched.on" data-rr ${c.sched.on ? 'checked' : ''}> <b>Włączony</b></label>
        <span class="small mute">to samo co w zakładce Harmonogram (tam też reguły i domyślne % biegów)</span></div>
      ${this._renderChart()}
      <div class="row"><button class="opt" data-addslot>+ Dodaj wpis</button></div>
      ${this._slotEdit !== undefined && this._slotEdit !== null ? this._slotEditor(this._slotEdit) : ''}
      <datalist id="z1l">${lEnts.map((id) => `<option value="${esc(id)}">`).join('')}</datalist>
      <datalist id="z1w">${wEnts.map((id) => `<option value="${esc(id)}">`).join('')}</datalist>
    </div>`;
  }

  // ---------------- mapa: wbudowana mapa HA (ha-map) w light DOM karty ----------------
  // v2.3: mapa siedzi poza przerysowywanym shadow DOM (slot), wiec odswiezenie karty jej nie resetuje
  async _haMapReady() {
    if (customElements.get('ha-map')) return;
    if (window.loadCardHelpers) {
      try { const h = await window.loadCardHelpers(); const c = await h.createCardElement({ type: 'map', entities: ['zone.home'] }); if (c) c.hass = this._hass; } catch (e) { /* dalej czekamy */ }
    }
    await Promise.race([customElements.whenDefined('ha-map'), new Promise((_, rej) => setTimeout(() => rej(new Error('HA nie udostępnił mapy (ha-map)')), 5000))]);
  }

  _mountMap() {
    if (!this._mapWrap) {
      this._mapWrap = document.createElement('div');
      this._mapWrap.slot = 'map';
      this._mapWrap.style.cssText = 'display:block;height:360px;border-radius:12px;overflow:hidden;border:1px solid rgba(127,127,127,.35);margin:6px 0 4px;position:relative;';
      this._mapWrap.innerHTML = '<div style="padding:20px;opacity:.7;font-size:.88em">Ładuję mapę…</div>';
      this.appendChild(this._mapWrap);
    }
    if (this._haMap && this._haMap.leafletMap && this._haMap.Leaflet && this._haMap.leafletMap !== this._map) this._bindMap(this._haMap.Leaflet, this._haMap.leafletMap);
    if (this._map) { setTimeout(() => { if (this._map) { this._map.invalidateSize(); this._drawMap(); } }, 0); return; }
    if (this._mapLoading) return;
    this._mapLoading = true;
    (async () => {
      let ok = false, why = '';
      if (this._config.map === 'ha') { try { ok = await this._tryHaMap(); } catch (e) { why = e.message; } }
      if (!ok) {
        // v2.4: mapa HA nie wstala -> wlasny Leaflet z unpkg (jak w v1.9)
        if (this._haMap) { try { this._haMap.remove(); } catch (e) { /* nic */ } this._haMap = null; }
        if (this._config.map === 'ha') this._pushLog({ t: new Date(), e: 'karta', s: 'Mapa HA nie wstała' + (why ? ' (' + why + ')' : '') + ' – ładuję OpenStreetMap' });
        await this._ownMap();
      }
    })().catch((e) => {
      this._mapWrap.innerHTML = `<div style="padding:20px;opacity:.75;font-size:.88em">Mapa niedostępna: ${esc(e.message)}. Środek strefy wpisz ręcznie (szer./dł.) albo kliknij „środek = dom”.</div>`;
      this._pushLog({ t: new Date(), e: 'karta', s: 'Mapa: ' + e.message });
    }).finally(() => { this._mapLoading = false; });
  }

  async _tryHaMap() {
    await this._haMapReady();
    const m = document.createElement('ha-map');
    const dark = this._config.theme !== 'light';
    m.hass = this._hass;
    m.entities = [];
    m.autoFit = false;
    m.zoom = 15;
    m.themeMode = dark ? 'dark' : 'auto';
    m.darkMode = dark;
    m.style.cssText = 'display:block;height:100%;';
    this._mapWrap.innerHTML = '';
    this._mapWrap.appendChild(m);
    this._haMap = m;
    const t0 = Date.now();
    while (!(m.leafletMap && m.Leaflet)) {
      if (Date.now() - t0 > 6000) return false;
      await new Promise((r) => setTimeout(r, 150));
    }
    this._bindMap(m.Leaflet, m.leafletMap);
    return true;
  }

  _loadLeaflet() {
    // v2.7: Leaflet wbudowany w plik karty (bez CDN); CDN tylko jako zapas
    try { const L = LEAFLET_LIB(); if (L && L.map) return Promise.resolve(L); } catch (e) { this._pushLog({ t: new Date(), e: 'karta', s: 'Mapa: wbudowany Leaflet padł (' + e.message + '), próbuję CDN' }); }
    if (window.L && window.L.map && window.L.circle) return Promise.resolve(window.L);
    if (!LEAFLET_P) {
      const one = (base) => new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = base + 'leaflet.js';
        sc.onload = () => (window.L && window.L.map ? res(window.L) : rej(new Error('Leaflet wczytany, ale pusty')));
        sc.onerror = () => { sc.remove(); rej(new Error('nie wczytałem ' + base)); };
        document.head.appendChild(sc);
      });
      LEAFLET_P = (async () => {
        let last;
        for (const base of LEAFLET_CDN) {
          try { const L = await one(base); LEAFLET_URL = base; return L; } catch (e) { last = e; }
        }
        LEAFLET_P = null;
        throw new Error('nie wczytałem biblioteki mapy (unpkg ani jsdelivr) – brak internetu albo blokada w przeglądarce');
      })();
    }
    return LEAFLET_P;
  }

  async _ownMap() {
    const L = await this._loadLeaflet();
    const dark = this._config.theme !== 'light';
    const custom = typeof this._config.map_tiles === 'string' && this._config.map_tiles;
    this._mapWrap.className = 'cnoc-map' + (dark && !custom ? ' cnoc-dark' : '');
    this._mapWrap.innerHTML = `<style>${LEAFLET_LIB.L ? LEAFLET_CSS : ''}</style>${LEAFLET_LIB.L ? '' : `<link rel="stylesheet" href="${LEAFLET_URL}leaflet.css">`}
      <style>.cnoc-dark .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.9) contrast(.9);}.cnoc-map .leaflet-container{background:#1b2430;font:inherit;}</style>`;
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;inset:0;';
    this._mapWrap.appendChild(box);
    const z = this._draft && this._draft.z.find((x) => x.on);
    const h = this._hass.config || {};
    const c = z ? [Number(z.lat), Number(z.lon)] : [h.latitude || 52.2297, h.longitude || 21.0122];
    const map = L.map(box, { zoomControl: true }).setView(c, 15);
    const tl = L.tileLayer(custom || OSM_TILES, { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    let bad = 0, good = 0;
    tl.on('tileload', () => { good++; });
    tl.on('tileerror', () => {
      bad++;
      if (bad === 6 && !good) this._pushLog({ t: new Date(), e: 'karta', s: 'Mapa: podkład się nie ładuje (' + (custom || OSM_TILES) + ')' });
      if (bad >= 6 && !good && !box.querySelector('.cnoc-tilemsg')) {
        const d = document.createElement('div');
        d.className = 'cnoc-tilemsg';
        d.style.cssText = 'position:absolute;left:8px;right:8px;bottom:22px;z-index:500;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.65);color:#fff;font-size:.8em;pointer-events:none';
        d.textContent = 'Podkład mapy się nie ładuje (brak internetu / blokada). Okręgi i znaczniki działają dalej.';
        box.appendChild(d);
      }
    });
    this._bindMap(L, map);
  }

  _bindMap(L, map) {
    this._L = L;
    this._map = map;
    this._mapLayer = this._L.layerGroup().addTo(this._map);
    this._map.on('click', (e) => this._mapClick(e.latlng));
    this._mapFitted = false;
    setTimeout(() => { if (this._map) { this._map.invalidateSize(); this._drawMap(); } }, 50);
  }

  _fitMap() {
    if (!this._map || !this._draft) return;
    const L = this._L, b = [];
    this._draft.z.forEach((z) => { if (z.on) b.push(L.latLng(Number(z.lat), Number(z.lon)).toBounds((Number(z.r) || 100) * 2)); });
    if (!b.length) return;
    let bb = b[0]; b.slice(1).forEach((x) => { bb = bb.extend(x); });
    this._map.fitBounds(bb, { padding: [20, 20], maxZoom: 17 });
    this._mapFitted = true;
  }

  _drawMap() {
    const L = this._L;
    if (!this._map || !L || !this._draft || this._mapDrag) return;
    this._mapLayer.clearLayers();
    const col = ['#27b4ff', '#ffa43a'];
    const dot = (c, sz) => L.divIcon({ className: '', iconSize: [0, 0], html: `<div style="width:${sz}px;height:${sz}px;margin:-${sz / 2 + 2}px 0 0 -${sz / 2 + 2}px;border-radius:50%;background:${c};border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.5);cursor:grab"></div>` });
    this._draft.z.forEach((z, i) => {
      if (!z.on) return;
      const ll = L.latLng(Number(z.lat), Number(z.lon));
      if (isNaN(ll.lat) || isNaN(ll.lng)) return;
      const r = Number(z.r) || 100;
      const circ = L.circle(ll, { radius: r, color: col[i], weight: 2, fillOpacity: 0.12, interactive: false }).addTo(this._mapLayer);
      const edge = (c, rr) => L.latLng(c.lat, c.lng + rr / (111320 * Math.cos(c.lat * Math.PI / 180)));
      const cm = L.marker(ll, { draggable: true, icon: dot(col[i], 16), title: 'Strefa ' + (i + 1) + ' – przeciągnij' }).addTo(this._mapLayer);
      const hm = L.marker(edge(ll, r), { draggable: true, icon: dot('#fff', 12), title: 'promień – przeciągnij' }).addTo(this._mapLayer);
      hm.bindTooltip(Math.round(r) + ' m', { permanent: true, direction: 'right', offset: [8, 0] });
      const sync = () => {
        const R = this.shadowRoot;
        [['lat', z.lat], ['lon', z.lon], ['r', z.r]].forEach(([k, v]) => { const el = R.querySelector(`[data-bind="z.${i}.${k}"]`); if (el && el !== R.activeElement) el.value = v; });
      };
      cm.on('dragstart', () => { this._mapDrag = true; });
      cm.on('drag', (e) => {
        const p = e.target.getLatLng();
        z.lat = Number(p.lat.toFixed(6)); z.lon = Number(p.lng.toFixed(6));
        circ.setLatLng(p); hm.setLatLng(edge(p, Number(z.r) || 100)); sync();
      });
      hm.on('dragstart', () => { this._mapDrag = true; });
      hm.on('drag', (e) => {
        const c = L.latLng(Number(z.lat), Number(z.lon));
        z.r = Math.max(20, Math.round(this._map.distance(c, e.target.getLatLng()) / 5) * 5);
        circ.setRadius(z.r); hm.setTooltipContent(z.r + ' m'); sync();
      });
      const end = () => { this._mapDrag = false; this._render(); };
      cm.on('dragend', end); hm.on('dragend', end);
    });
    this._draft.phones.forEach((id) => {
      const p = this._phoneInfo(id);
      if (!p.gps) return;
      L.circleMarker([p.la, p.lo], { radius: 7, color: '#fff', weight: 2, fillColor: p.fresh ? '#3ddc6f' : '#8d9aab', fillOpacity: 1, interactive: true })
        .bindTooltip((p.s.attributes.friendly_name || id) + (p.fresh ? '' : ' (nieaktualny)')).addTo(this._mapLayer);
    });
    if (!this._mapFitted) this._fitMap();
  }

  _mapClick(ll) {
    const i = this._mapPick || 0, z = this._draft && this._draft.z[i];
    if (!z || !z.on || this._mapDrag) return;
    z.lat = Number(ll.lat.toFixed(6)); z.lon = Number(ll.lng.toFixed(6));
    this._render();
  }

  // ---------------- przeciaganie blokow harmonogramu ----------------
  _wireChart() {
    const R = this.shadowRoot;
    R.querySelectorAll('[data-track]').forEach((tr) => tr.addEventListener('click', (ev) => {
      if (this._dragJust) return;
      const blk = ev.target.closest('[data-blk]');
      const di = Number(tr.dataset.track), rect = tr.getBoundingClientRect();
      const m = Math.max(0, Math.min(1425, Math.round((ev.clientX - rect.left) / rect.width * 1440 / 15) * 15));
      const add = () => {
        const src = blk ? this._sl()[Number(blk.dataset.blk)] : null;
        this._sl().push({ d: [DAYS[di][0]], t: this._hm(m), tryb: src ? src.tryb : '', temp: '', pn: '', pw: '' });
        this._slotEdit = this._sl().length - 1;
        this._render();
      };
      // klik w pusty pasek / blok przeniesiony z dnia wczesniej = nowy wpis; klik w blok = edycja, dwuklik w blok = nowy wpis w tym miejscu
      if (!blk || blk.classList.contains('carry')) { add(); return; }
      const now = Date.now();
      if (this._clk && now - this._clk.t < 350 && this._clk.di === di) { clearTimeout(this._clk.to); this._clk = null; add(); return; }
      const i = Number(blk.dataset.blk);
      this._clk = { t: now, di, to: setTimeout(() => { this._clk = null; this._slotEdit = i; this._render(); }, 350) };
    }));
    R.querySelectorAll('[data-drag]').forEach((h) => h.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation(); ev.preventDefault();
      const i = Number(h.dataset.drag), s = this._sl()[i];
      const tr = h.closest('[data-track]'), rect = tr.getBoundingClientRect();
      const blk = h.closest('.blk'), lab = blk.querySelector('.bl');
      const x0 = ev.clientX;
      let moved = false;
      h.setPointerCapture(ev.pointerId);
      const mv = (e) => {
        if (Math.abs(e.clientX - x0) > 3) moved = true;
        if (!moved) return;
        const m = Math.max(0, Math.min(1425, Math.round((e.clientX - rect.left) / rect.width * 1440 / 15) * 15));
        s.t = this._hm(m);
        blk.style.left = (m / 1440 * 100) + '%';
        lab.textContent = s.t + ' ' + this._slotLabel(s);
        blk.classList.add('drag');
      };
      const up = () => {
        h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
        if (!moved) this._slotEdit = i;
        this._dragJust = true; setTimeout(() => { this._dragJust = false; }, 50);
        setTimeout(() => this._render(), 0);
      };
      h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    }));
  }

  // obsluga zdarzen zakladek Harmonogram / Strefy (wolane z _render)
  _wirePlan() {
    const R = this.shadowRoot;
    R.querySelectorAll('[data-bind]').forEach((el) => {
      const upd = () => this._bindSet(el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value);
      el.addEventListener('input', () => { upd(); if (el.hasAttribute('data-map')) { this._drawMap(); } });
      el.addEventListener('change', () => { upd(); if (/^z\.\d\.on$/.test(el.dataset.bind)) this._mapFitted = false; if (el.hasAttribute('data-rr')) this._render(); });
    });
    R.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
      const [i, k] = b.dataset.day.split(':');
      const d = this._sl()[i].d, j = d.indexOf(k);
      if (j >= 0) d.splice(j, 1); else d.push(k);
      d.sort((a, b2) => DAYS.findIndex((x) => x[0] === a) - DAYS.findIndex((x) => x[0] === b2));
      this._render();
    }));
    R.querySelectorAll('[data-dayset]').forEach((b) => b.addEventListener('click', () => {
      const [i, k] = b.dataset.dayset.split(':');
      const all = DAYS.map((x) => x[0]);
      this._sl()[i].d = k === 'wd' ? all.slice(0, 5) : k === 'we' ? all.slice(5) : all;
      this._render();
    }));
    R.querySelectorAll('[data-addslot]').forEach((b) => b.addEventListener('click', () => {
      this._sl().push({ d: DAYS.map((x) => x[0]).slice(0, 5), t: '06:00', tryb: '', temp: '', pn: '', pw: '' });
      this._slotEdit = this._sl().length - 1;
      this._render();
    }));
    R.querySelectorAll('[data-sopen]').forEach((b) => b.addEventListener('click', () => { this._slotEdit = Number(b.dataset.sopen); this._render(); }));
    R.querySelectorAll('[data-sclose]').forEach((b) => b.addEventListener('click', () => { this._slotEdit = null; this._render(); }));
    R.querySelectorAll('[data-delslot]').forEach((b) => b.addEventListener('click', () => { this._sl().splice(Number(b.dataset.delslot), 1); this._slotEdit = null; this._render(); }));
    R.querySelectorAll('[data-addrule]').forEach((b) => b.addEventListener('click', () => {
      this._draft.rules.push({ name: 'Reguła ' + (this._draft.rules.length + 1), on: true, conds: [{ e: '', op: 'on', v: '' }], dpn: 90, dpw: 90, npn: 70, npw: 70, hold: 10 });
      this._render();
    }));
    R.querySelectorAll('[data-delrule]').forEach((b) => b.addEventListener('click', () => { this._draft.rules.splice(Number(b.dataset.delrule), 1); this._render(); }));
    R.querySelectorAll('[data-addcond]').forEach((b) => b.addEventListener('click', () => { this._draft.rules[Number(b.dataset.addcond)].conds.push({ e: '', op: 'on', v: '' }); this._render(); }));
    R.querySelectorAll('[data-delcond]').forEach((b) => b.addEventListener('click', () => { const [ri, ci] = b.dataset.delcond.split(':').map(Number); this._draft.rules[ri].conds.splice(ci, 1); this._render(); }));
    R.querySelectorAll('[data-wbool]').forEach((b) => b.addEventListener('click', () => {
      const s = this._hass.states[WIET_BOOL]; if (!s) return;
      this._hass.callService('input_boolean', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: WIET_BOOL });
    }));
    R.querySelectorAll('[data-addph]').forEach((el) => el.addEventListener('change', () => { if (el.value) { this._draft.phones.push(el.value); this._render(); } }));
    R.querySelectorAll('[data-delph]').forEach((b) => b.addEventListener('click', () => { this._draft.phones.splice(Number(b.dataset.delph), 1); this._render(); }));
    R.querySelectorAll('[data-mpick]').forEach((b) => b.addEventListener('click', () => { this._mapPick = Number(b.dataset.mpick); this._render(); }));
    R.querySelectorAll('[data-mfit]').forEach((b) => b.addEventListener('click', () => this._fitMap()));
    R.querySelectorAll('[data-zhome]').forEach((b) => b.addEventListener('click', () => {
      const z = this._draft.z[Number(b.dataset.zhome)], h = this._hass.config || {};
      if (h.latitude) { z.lat = h.latitude; z.lon = h.longitude; this._mapFitted = false; this._render(); }
    }));
    R.querySelectorAll('[data-saveall]').forEach((b) => b.addEventListener('click', () => this._saveAll()));
    R.querySelectorAll('[data-delall]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.delall;
      if (v === 'ask') { this._confirmDel = true; this._render(); } else if (v === 'no') { this._confirmDel = false; this._render(); } else this._deleteAll();
    }));
    R.querySelectorAll('[data-addtrg]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.addtrg, inp = R.querySelector(`[data-trgin="${k}"]`), v = inp ? inp.value.trim() : '';
      if (!/^[a-z_]+\.[a-z0-9_]+$/.test(v)) { this._flashMsg(false, 'Wpisz ID encji, np. light.lazienka'); this._render(); return; }
      if (!this._draft.trg[k].includes(v)) this._draft.trg[k].push(v);
      this._render();
    }));
    R.querySelectorAll('[data-deltrg]').forEach((b) => b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const [k, i] = b.dataset.deltrg.split(':');
      this._draft.trg[k].splice(Number(i), 1);
      this._render();
    }));
    R.querySelectorAll('[data-sed]').forEach((b) => b.addEventListener('click', () => { this._sEd = b.dataset.sed; this._slotEdit = null; this._render(); }));
    R.querySelectorAll('[data-sezset]').forEach((b) => b.addEventListener('click', () => {
      if (!this._hass.states[LATO_BOOL]) { this._flashMsg(false, 'Najpierw Zapisz w HA – wtedy powstanie przełącznik sezonu.'); this._render(); return; }
      this._hass.callService('input_boolean', b.dataset.sezset === 'lato' ? 'turn_on' : 'turn_off', { entity_id: LATO_BOOL });
    }));
    R.querySelectorAll('[data-sezcopy]').forEach((b) => b.addEventListener('click', () => {
      const from = b.dataset.sezcopy, c = this._draft, src = from === 'lato' ? c.sched.lato : c.sched.slots;
      const cp = src.map((x) => Object.assign({}, x, { d: x.d.slice() }));
      if (from === 'lato') c.sched.slots = cp; else c.sched.lato = cp;
      this._slotEdit = null; this._render();
    }));
    if ((this._tab === 'harmonogram' || this._tab === 'strefy') && this._draft) this._wireChart();
    if (this._tab === 'strefy' && this._draft) this._mountMap();
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
      ${this._sbBar()}
      <div class="rk"><div class="ca">
      ${this._renderHero(bypassOn)}
      ${this._renderGauge()}
      ${this._renderBar()}
      </div><div class="cc">
      ${this._renderControls()}
      </div><div class="cb">
      <div class="flags">${optFlag('harm_akt')}${optFlag('went_aktywna')}${flag('bypass')}${optFlag('bypass_tryb')}${optFlag('sezon')}${optFlag('chlodzenie')}${optFlag('wietrzenie')}${optFlag('urlop')}${optFlag('poza_domem')}${optFlag('nagrzewnica')}${optFlag('rozmrazanie')}${optFlag('gwc')}${optFlag('kominek')}${optFlag('magistrala')}
        ${filtr ? `<span class="flag ${filtrWarn ? 'err' : ''}" data-e="${esc(this._id('filtr'))}">Filtry: ${!BAD.includes(filtr.state) ? esc(filtr.state) : '—'}</span>` : ''}</div>
      <div class="grid">
        ${tile('bieg', undefined, true)}${tile('tryb', undefined, true)}
        ${opt('bieg_zadany')}${opt('harmonogram')}${opt('tryb_term')}
        ${tile('t_pokoj', 1)}${tile('t_zadana', 1)}${this._zewnTile()}
        ${opt('wilgotnosc', 0)}${opt('co2', 0)}
        ${opt('przeplyw', 0)}${opt('obroty_nawiew', 0)}${opt('obroty_wywiew', 0)}
        ${opt('t_nagrzewnica', 1)}${opt('t_gwc', 1)}${opt('sprawnosc', 0)}
        ${opt('filtr_dni', 0)}${opt('alarm')}${opt('ostrzezenie')}
        ${opt('godziny_pracy', 0)}${opt('wersja_nano')}
      </div>
      ${nast ? `<h3 class="rest">Nastawy</h3><div class="grid">${nast}</div>` : ''}
      ${restTiles ? `<h3 class="rest">Pozostałe z ESP (${rest.length})</h3><div class="grid">${restTiles}</div>` : ''}
      </div></div>
      <div class="effnote">Sprawność odzysku = (nawiew − czerpnia) / (wywiew − czerpnia)${eff === null ? ': ' + (() => { const miss = [['t_czerpnia', 'czerpni'], ['t_nawiew', 'nawiewu'], ['t_wywiew', 'wywiewu']].filter(([k]) => num(this._st(k)) === null).map(([, n]) => n); return miss.length ? 'brak czujnika ' + miss.join(', ') : 'za mała różnica temperatur'; })() : ': <b>' + Math.round(eff) + '%</b>'}</div>
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
    const all = this._prefIds();
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
      ${this._missingBox()}
      ${(() => { const d = this._dupes(); return d.length ? `<div class="warnbox">W HA są zdublowane encje z końcówką _2/_3 (stare zostały w rejestrze po zmianie nazw w YAML): ${d.map((x) => `<code>${esc(x)}</code>`).join(' ')}. Karta bierze tę, która ma dane. Stare, nieaktywne usuniesz w HA: Ustawienia → Urządzenia → Encje.</div>` : ''; })()}
      <div class="dgrid">
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
      </div>
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
    const ids = this._prefIds();
    const name = (id) => { const k = Object.keys(DEFAULT_E).find((x) => this._id(x) === id); return k ? DEFAULT_E[k][2] : (this._hass.states[id].attributes.friendly_name || id); };
    const now = new Date();
    const head = [
      '# compit-nano-one-card ' + VERSION + ' — pełny log',
      '# wygenerowano: ' + now.toISOString() + ' (' + now.toLocaleString() + ')',
      '# prefiks: ' + this._prefix + ', zakres: ' + hours + ' h, encji: ' + ids.length,
      '# brakujace encje sterujace: ' + (this._missingCtl().join(', ') || 'brak'),
      '# encje urzadzenia w rejestrze HA bez stanu: ' + (this._regNoState().join(', ') || 'brak'),
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
  .hval.nos { font-size:15px; font-weight:600; fill:var(--secondary-text-color); }
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
  .hflow { fill:none; stroke:#fff; stroke-width:3; stroke-linecap:round; stroke-dasharray:2 16; opacity:.45; }
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
  /* v1.9 harmonogram / strefy */
  .plan h3 { margin-top:6px; }
  .slot, .zone { border:1px solid var(--divider-color); border-radius:12px; padding:10px 12px; margin:8px 0; background:var(--secondary-background-color); }
  .zone.off { opacity:.75; }
  .zone.zc1 { border-left:4px solid #27b4ff; } .zone.zc2 { border-left:4px solid #ffa43a; }
  .zh { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
  .days { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px; align-items:center; }
  .chip { font:inherit; font-size:.82em; min-width:34px; padding:4px 6px; border-radius:14px; border:1px solid var(--divider-color); background:transparent; color:var(--secondary-text-color); cursor:pointer; }
  .z1h { border:1px solid var(--divider-color); border-radius:12px; padding:10px 12px; margin:12px 0; border-left:4px solid #27b4ff; }
  .echips { display:flex; flex-wrap:wrap; gap:6px; margin:4px 0; }
  .echip { display:inline-flex; align-items:center; gap:4px; padding:2px 4px 2px 10px; border-radius:14px; border:1px solid var(--divider-color); font-size:.85em; cursor:pointer; }
  .chip.on { border-color:var(--primary-color); color:var(--primary-color); background:rgba(39,180,255,.14); font-weight:700; }
  .srow { display:flex; flex-wrap:wrap; gap:8px 14px; align-items:center; margin:6px 0; font-size:.9em; }
  .srow label, .pin { display:inline-flex; align-items:center; gap:6px; color:var(--secondary-text-color); }
  .plan input, .plan select { font:inherit; font-size:.95em; color:var(--primary-text-color); background:var(--card-background-color); border:1px solid var(--divider-color); border-radius:8px; padding:5px 8px; }
  .plan input.sm { width:52px; text-align:center; } .plan input.md { width:96px; }
  .plan select { max-width:220px; }
  .tgl { display:inline-flex; align-items:center; gap:8px; cursor:pointer; margin:4px 0; }
  .tgl input { width:18px; height:18px; accent-color:var(--primary-color); }
  .phone { display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; padding:6px 0; border-bottom:1px solid var(--divider-color); }
  .phone b { cursor:pointer; }
  .zb { font-size:.75em; font-weight:700; padding:2px 8px; border-radius:10px; }
  .zb.z1 { background:rgba(39,180,255,.18); color:#27b4ff; } .zb.z2 { background:rgba(255,164,58,.18); color:#ffa43a; }
  .light .zb.z1 { color:#1677b3; } .light .zb.z2 { color:#b8640e; }
  .mapwrap .map { height:320px; border-radius:12px; overflow:hidden; border:1px solid var(--divider-color); margin:6px 0 4px; z-index:0; }
  .mapErr { padding:20px; font-size:.88em; color:var(--secondary-text-color); }
  .savebar { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin:12px 0 8px; }
  .act[disabled] { opacity:.5; cursor:default; }
  .autol { display:flex; align-items:center; gap:8px; font-size:.82em; color:var(--secondary-text-color); margin:-2px 0 8px; }
  .autol .aon { color:var(--success-color,#2e9e4f); cursor:pointer; } .autol .mute { cursor:pointer; }
  .warn { color:var(--warning-color,#ffa600); }
  .sb { margin-top:10px; }
  .sbbar { padding:10px 12px; border-radius:12px; background:rgba(39,180,255,.12); border:1px solid rgba(39,180,255,.45); margin:0 0 10px; font-size:.9em; }
  .sbbar > div { display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; }
  .mapwrap .map ha-map { display:block; height:100%; }
  .tabs { overflow-x:auto; scrollbar-width:none; } .tab { white-space:nowrap; }
  /* v2.3 uklad na szerokim ekranie (panel w lewym pasku) */
  .body { container-type:inline-size; }
  .hero { max-width:520px; margin-left:auto; margin-right:auto; }
  .rk .ca, .rk .cb, .rk .cc { min-width:0; }
  @container (min-width: 900px) {
    .rk { display:grid; grid-template-columns:minmax(380px, 520px) minmax(0, 1fr); gap:6px 22px; align-items:start; }
    .rk .ca { grid-column:1; grid-row:1 / span 2; }
    .rk .cb { grid-column:2; grid-row:1; }
    .rk .cc { grid-column:2; grid-row:2; }
    .rk .grid { grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); }
    .dgrid { columns:2 440px; column-gap:18px; }
    .dgrid > .sec { break-inside:avoid; }
    .zgrid { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:18px; align-items:start; }
    .zgrid .mapcol { position:sticky; top:8px; }
    .pgrid { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:22px; align-items:start; }
  }
  @container (min-width: 1500px) {
    .rk { grid-template-columns:520px minmax(0, 1fr) minmax(0, 1fr); }
    .rk .ca { grid-row:1; } .rk .cb { grid-column:2; grid-row:1; } .rk .cc { grid-column:3; grid-row:1; }
    .rk .cc .ctl { margin-top:0; }
    .dgrid { columns:3 420px; }
  }
  /* v2.3 wykres harmonogramu */
  .wk { margin:6px 0 4px; user-select:none; }
  .wrow { display:grid; grid-template-columns:30px 1fr; align-items:center; gap:6px; margin:3px 0; }
  .wday { font-size:.8em; font-weight:700; color:var(--secondary-text-color); text-align:center; }
  .wday.on { color:var(--primary-color); }
  .whead .wtrack0 { position:relative; height:14px; font-size:.68em; color:var(--secondary-text-color); }
  .whead .wtrack0 span { position:absolute; transform:translateX(-50%); }
  .whead .wtrack0 span:first-child { transform:none; } .whead .wtrack0 span:last-child { transform:translateX(-100%); }
  .wtrack { position:relative; height:36px; border-radius:8px; cursor:copy; overflow:hidden;
    background:repeating-linear-gradient(90deg, transparent 0, transparent calc(100% / 24 - 1px), var(--divider-color) calc(100% / 24 - 1px), var(--divider-color) calc(100% / 24)), var(--secondary-background-color); }
  .nband { position:absolute; top:0; bottom:0; background:rgba(80,90,160,.22); pointer-events:none; }
  .blk { position:absolute; top:4px; bottom:4px; border-radius:6px; background:color-mix(in srgb, var(--bc) 30%, transparent); border:1px solid var(--bc); color:var(--primary-text-color); cursor:pointer; overflow:hidden; box-sizing:border-box; }
  .blk.carry { opacity:.45; border-style:dashed; cursor:copy; }
  .blk.sel { box-shadow:0 0 0 2px var(--primary-text-color); }
  .blk.drag { box-shadow:0 0 0 2px var(--bc); z-index:3; }
  .blk .bl { position:absolute; left:10px; right:2px; top:50%; transform:translateY(-50%); font-size:.72em; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none; }
  .blk .bh { position:absolute; left:0; top:0; bottom:0; width:8px; background:var(--bc); cursor:ew-resize; touch-action:none; }
  .cmark { position:absolute; top:0; width:2px; height:7px; background:#e2c044; pointer-events:none; z-index:2; }
  .nowline { position:absolute; top:-2px; bottom:-2px; width:2px; background:#ff4d4f; box-shadow:0 0 6px #ff4d4f; pointer-events:none; z-index:4; }
  .legend { display:flex; flex-wrap:wrap; gap:4px 14px; font-size:.78em; color:var(--secondary-text-color); margin:6px 0; }
  .legend i { display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:5px; vertical-align:-2px; }
  .legend .lg-night { background:rgba(80,90,160,.5); } .legend .lg-cyc { background:#e2c044; width:3px; } .legend .lg-now { background:#ff4d4f; width:3px; }
  .sedit, .rule { border:1px solid var(--divider-color); border-radius:12px; padding:10px 12px; margin:8px 0; background:var(--secondary-background-color); }
  .sedit { border-color:var(--primary-color); }
  .lrow { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:4px 0; border-bottom:1px solid var(--divider-color); font-size:.88em; }
  .dot2 { width:10px; height:10px; border-radius:3px; }
  details.lst { margin:6px 0 4px; }
  .plan input.lg { width:230px; }
  .nowl { display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:.88em; padding:7px 12px; border-radius:10px; background:var(--secondary-background-color); margin:0 0 8px; }
  .zgrid h3, .pgrid h3 { margin-top:4px; }
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
// ---------------- v2.7: Leaflet 1.9.4 (licencja BSD-2-Clause, (c) Vladimir Agafonkin, CloudMade) wbudowany ----------------
function LEAFLET_LIB() {
  if (LEAFLET_LIB.L) return LEAFLET_LIB.L;
  const exports = {}, module = { exports };
/* @preserve
 * Leaflet 1.9.4, a JS library for interactive maps. https://leafletjs.com
 * (c) 2010-2023 Vladimir Agafonkin, (c) 2010-2011 CloudMade
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?e(exports):"function"==typeof define&&define.amd?define(["exports"],e):e((t="undefined"!=typeof globalThis?globalThis:t||self).leaflet={})}(this,function(t){"use strict";function l(t){for(var e,i,n=1,o=arguments.length;n<o;n++)for(e in i=arguments[n])t[e]=i[e];return t}var R=Object.create||function(t){return N.prototype=t,new N};function N(){}function a(t,e){var i,n=Array.prototype.slice;return t.bind?t.bind.apply(t,n.call(arguments,1)):(i=n.call(arguments,2),function(){return t.apply(e,i.length?i.concat(n.call(arguments)):arguments)})}var D=0;function h(t){return"_leaflet_id"in t||(t._leaflet_id=++D),t._leaflet_id}function j(t,e,i){var n,o,s=function(){n=!1,o&&(r.apply(i,o),o=!1)},r=function(){n?o=arguments:(t.apply(i,arguments),setTimeout(s,e),n=!0)};return r}function H(t,e,i){var n=e[1],e=e[0],o=n-e;return t===n&&i?t:((t-e)%o+o)%o+e}function u(){return!1}function i(t,e){return!1===e?t:(e=Math.pow(10,void 0===e?6:e),Math.round(t*e)/e)}function W(t){return t.trim?t.trim():t.replace(/^\s+|\s+$/g,"")}function F(t){return W(t).split(/\s+/)}function c(t,e){for(var i in Object.prototype.hasOwnProperty.call(t,"options")||(t.options=t.options?R(t.options):{}),e)t.options[i]=e[i];return t.options}function U(t,e,i){var n,o=[];for(n in t)o.push(encodeURIComponent(i?n.toUpperCase():n)+"="+encodeURIComponent(t[n]));return(e&&-1!==e.indexOf("?")?"&":"?")+o.join("&")}var V=/\{ *([\w_ -]+) *\}/g;function q(t,i){return t.replace(V,function(t,e){e=i[e];if(void 0===e)throw new Error("No value provided for variable "+t);return e="function"==typeof e?e(i):e})}var d=Array.isArray||function(t){return"[object Array]"===Object.prototype.toString.call(t)};function G(t,e){for(var i=0;i<t.length;i++)if(t[i]===e)return i;return-1}var K="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";function Y(t){return window["webkit"+t]||window["moz"+t]||window["ms"+t]}var X=0;function J(t){var e=+new Date,i=Math.max(0,16-(e-X));return X=e+i,window.setTimeout(t,i)}var $=window.requestAnimationFrame||Y("RequestAnimationFrame")||J,Q=window.cancelAnimationFrame||Y("CancelAnimationFrame")||Y("CancelRequestAnimationFrame")||function(t){window.clearTimeout(t)};function x(t,e,i){if(!i||$!==J)return $.call(window,a(t,e));t.call(e)}function r(t){t&&Q.call(window,t)}var tt={__proto__:null,extend:l,create:R,bind:a,get lastId(){return D},stamp:h,throttle:j,wrapNum:H,falseFn:u,formatNum:i,trim:W,splitWords:F,setOptions:c,getParamString:U,template:q,isArray:d,indexOf:G,emptyImageUrl:K,requestFn:$,cancelFn:Q,requestAnimFrame:x,cancelAnimFrame:r};function et(){}et.extend=function(t){function e(){c(this),this.initialize&&this.initialize.apply(this,arguments),this.callInitHooks()}var i,n=e.__super__=this.prototype,o=R(n);for(i in(o.constructor=e).prototype=o,this)Object.prototype.hasOwnProperty.call(this,i)&&"prototype"!==i&&"__super__"!==i&&(e[i]=this[i]);if(t.statics&&l(e,t.statics),t.includes){var s=t.includes;if("undefined"!=typeof L&&L&&L.Mixin){s=d(s)?s:[s];for(var r=0;r<s.length;r++)s[r]===L.Mixin.Events&&console.warn("Deprecated include of L.Mixin.Events: this property will be removed in future releases, please inherit from L.Evented instead.",(new Error).stack)}l.apply(null,[o].concat(t.includes))}return l(o,t),delete o.statics,delete o.includes,o.options&&(o.options=n.options?R(n.options):{},l(o.options,t.options)),o._initHooks=[],o.callInitHooks=function(){if(!this._initHooksCalled){n.callInitHooks&&n.callInitHooks.call(this),this._initHooksCalled=!0;for(var t=0,e=o._initHooks.length;t<e;t++)o._initHooks[t].call(this)}},e},et.include=function(t){var e=this.prototype.options;return l(this.prototype,t),t.options&&(this.prototype.options=e,this.mergeOptions(t.options)),this},et.mergeOptions=function(t){return l(this.prototype.options,t),this},et.addInitHook=function(t){var e=Array.prototype.slice.call(arguments,1),i="function"==typeof t?t:function(){this[t].apply(this,e)};return this.prototype._initHooks=this.prototype._initHooks||[],this.prototype._initHooks.push(i),this};var e={on:function(t,e,i){if("object"==typeof t)for(var n in t)this._on(n,t[n],e);else for(var o=0,s=(t=F(t)).length;o<s;o++)this._on(t[o],e,i);return this},off:function(t,e,i){if(arguments.length)if("object"==typeof t)for(var n in t)this._off(n,t[n],e);else{t=F(t);for(var o=1===arguments.length,s=0,r=t.length;s<r;s++)o?this._off(t[s]):this._off(t[s],e,i)}else delete this._events;return this},_on:function(t,e,i,n){"function"!=typeof e?console.warn("wrong listener type: "+typeof e):!1===this._listens(t,e,i)&&(e={fn:e,ctx:i=i===this?void 0:i},n&&(e.once=!0),this._events=this._events||{},this._events[t]=this._events[t]||[],this._events[t].push(e))},_off:function(t,e,i){var n,o,s;if(this._events&&(n=this._events[t]))if(1===arguments.length){if(this._firingCount)for(o=0,s=n.length;o<s;o++)n[o].fn=u;delete this._events[t]}else"function"!=typeof e?console.warn("wrong listener type: "+typeof e):!1!==(e=this._listens(t,e,i))&&(i=n[e],this._firingCount&&(i.fn=u,this._events[t]=n=n.slice()),n.splice(e,1))},fire:function(t,e,i){if(this.listens(t,i)){var n=l({},e,{type:t,target:this,sourceTarget:e&&e.sourceTarget||this});if(this._events){var o=this._events[t];if(o){this._firingCount=this._firingCount+1||1;for(var s=0,r=o.length;s<r;s++){var a=o[s],h=a.fn;a.once&&this.off(t,h,a.ctx),h.call(a.ctx||this,n)}this._firingCount--}}i&&this._propagateEvent(n)}return this},listens:function(t,e,i,n){"string"!=typeof t&&console.warn('"string" type argument expected');var o=e,s=("function"!=typeof e&&(n=!!e,i=o=void 0),this._events&&this._events[t]);if(s&&s.length&&!1!==this._listens(t,o,i))return!0;if(n)for(var r in this._eventParents)if(this._eventParents[r].listens(t,e,i,n))return!0;return!1},_listens:function(t,e,i){if(this._events){var n=this._events[t]||[];if(!e)return!!n.length;i===this&&(i=void 0);for(var o=0,s=n.length;o<s;o++)if(n[o].fn===e&&n[o].ctx===i)return o}return!1},once:function(t,e,i){if("object"==typeof t)for(var n in t)this._on(n,t[n],e,!0);else for(var o=0,s=(t=F(t)).length;o<s;o++)this._on(t[o],e,i,!0);return this},addEventParent:function(t){return this._eventParents=this._eventParents||{},this._eventParents[h(t)]=t,this},removeEventParent:function(t){return this._eventParents&&delete this._eventParents[h(t)],this},_propagateEvent:function(t){for(var e in this._eventParents)this._eventParents[e].fire(t.type,l({layer:t.target,propagatedFrom:t.target},t),!0)}},it=(e.addEventListener=e.on,e.removeEventListener=e.clearAllEventListeners=e.off,e.addOneTimeEventListener=e.once,e.fireEvent=e.fire,e.hasEventListeners=e.listens,et.extend(e));function p(t,e,i){this.x=i?Math.round(t):t,this.y=i?Math.round(e):e}var nt=Math.trunc||function(t){return 0<t?Math.floor(t):Math.ceil(t)};function m(t,e,i){return t instanceof p?t:d(t)?new p(t[0],t[1]):null==t?t:"object"==typeof t&&"x"in t&&"y"in t?new p(t.x,t.y):new p(t,e,i)}function f(t,e){if(t)for(var i=e?[t,e]:t,n=0,o=i.length;n<o;n++)this.extend(i[n])}function _(t,e){return!t||t instanceof f?t:new f(t,e)}function s(t,e){if(t)for(var i=e?[t,e]:t,n=0,o=i.length;n<o;n++)this.extend(i[n])}function g(t,e){return t instanceof s?t:new s(t,e)}function v(t,e,i){if(isNaN(t)||isNaN(e))throw new Error("Invalid LatLng object: ("+t+", "+e+")");this.lat=+t,this.lng=+e,void 0!==i&&(this.alt=+i)}function w(t,e,i){return t instanceof v?t:d(t)&&"object"!=typeof t[0]?3===t.length?new v(t[0],t[1],t[2]):2===t.length?new v(t[0],t[1]):null:null==t?t:"object"==typeof t&&"lat"in t?new v(t.lat,"lng"in t?t.lng:t.lon,t.alt):void 0===e?null:new v(t,e,i)}p.prototype={clone:function(){return new p(this.x,this.y)},add:function(t){return this.clone()._add(m(t))},_add:function(t){return this.x+=t.x,this.y+=t.y,this},subtract:function(t){return this.clone()._subtract(m(t))},_subtract:function(t){return this.x-=t.x,this.y-=t.y,this},divideBy:function(t){return this.clone()._divideBy(t)},_divideBy:function(t){return this.x/=t,this.y/=t,this},multiplyBy:function(t){return this.clone()._multiplyBy(t)},_multiplyBy:function(t){return this.x*=t,this.y*=t,this},scaleBy:function(t){return new p(this.x*t.x,this.y*t.y)},unscaleBy:function(t){return new p(this.x/t.x,this.y/t.y)},round:function(){return this.clone()._round()},_round:function(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this},floor:function(){return this.clone()._floor()},_floor:function(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this},ceil:function(){return this.clone()._ceil()},_ceil:function(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this},trunc:function(){return this.clone()._trunc()},_trunc:function(){return this.x=nt(this.x),this.y=nt(this.y),this},distanceTo:function(t){var e=(t=m(t)).x-this.x,t=t.y-this.y;return Math.sqrt(e*e+t*t)},equals:function(t){return(t=m(t)).x===this.x&&t.y===this.y},contains:function(t){return t=m(t),Math.abs(t.x)<=Math.abs(this.x)&&Math.abs(t.y)<=Math.abs(this.y)},toString:function(){return"Point("+i(this.x)+", "+i(this.y)+")"}},f.prototype={extend:function(t){var e,i;if(t){if(t instanceof p||"number"==typeof t[0]||"x"in t)e=i=m(t);else if(e=(t=_(t)).min,i=t.max,!e||!i)return this;this.min||this.max?(this.min.x=Math.min(e.x,this.min.x),this.max.x=Math.max(i.x,this.max.x),this.min.y=Math.min(e.y,this.min.y),this.max.y=Math.max(i.y,this.max.y)):(this.min=e.clone(),this.max=i.clone())}return this},getCenter:function(t){return m((this.min.x+this.max.x)/2,(this.min.y+this.max.y)/2,t)},getBottomLeft:function(){return m(this.min.x,this.max.y)},getTopRight:function(){return m(this.max.x,this.min.y)},getTopLeft:function(){return this.min},getBottomRight:function(){return this.max},getSize:function(){return this.max.subtract(this.min)},contains:function(t){var e,i;return(t=("number"==typeof t[0]||t instanceof p?m:_)(t))instanceof f?(e=t.min,i=t.max):e=i=t,e.x>=this.min.x&&i.x<=this.max.x&&e.y>=this.min.y&&i.y<=this.max.y},intersects:function(t){t=_(t);var e=this.min,i=this.max,n=t.min,t=t.max,o=t.x>=e.x&&n.x<=i.x,t=t.y>=e.y&&n.y<=i.y;return o&&t},overlaps:function(t){t=_(t);var e=this.min,i=this.max,n=t.min,t=t.max,o=t.x>e.x&&n.x<i.x,t=t.y>e.y&&n.y<i.y;return o&&t},isValid:function(){return!(!this.min||!this.max)},pad:function(t){var e=this.min,i=this.max,n=Math.abs(e.x-i.x)*t,t=Math.abs(e.y-i.y)*t;return _(m(e.x-n,e.y-t),m(i.x+n,i.y+t))},equals:function(t){return!!t&&(t=_(t),this.min.equals(t.getTopLeft())&&this.max.equals(t.getBottomRight()))}},s.prototype={extend:function(t){var e,i,n=this._southWest,o=this._northEast;if(t instanceof v)i=e=t;else{if(!(t instanceof s))return t?this.extend(w(t)||g(t)):this;if(e=t._southWest,i=t._northEast,!e||!i)return this}return n||o?(n.lat=Math.min(e.lat,n.lat),n.lng=Math.min(e.lng,n.lng),o.lat=Math.max(i.lat,o.lat),o.lng=Math.max(i.lng,o.lng)):(this._southWest=new v(e.lat,e.lng),this._northEast=new v(i.lat,i.lng)),this},pad:function(t){var e=this._southWest,i=this._northEast,n=Math.abs(e.lat-i.lat)*t,t=Math.abs(e.lng-i.lng)*t;return new s(new v(e.lat-n,e.lng-t),new v(i.lat+n,i.lng+t))},getCenter:function(){return new v((this._southWest.lat+this._northEast.lat)/2,(this._southWest.lng+this._northEast.lng)/2)},getSouthWest:function(){return this._southWest},getNorthEast:function(){return this._northEast},getNorthWest:function(){return new v(this.getNorth(),this.getWest())},getSouthEast:function(){return new v(this.getSouth(),this.getEast())},getWest:function(){return this._southWest.lng},getSouth:function(){return this._southWest.lat},getEast:function(){return this._northEast.lng},getNorth:function(){return this._northEast.lat},contains:function(t){t=("number"==typeof t[0]||t instanceof v||"lat"in t?w:g)(t);var e,i,n=this._southWest,o=this._northEast;return t instanceof s?(e=t.getSouthWest(),i=t.getNorthEast()):e=i=t,e.lat>=n.lat&&i.lat<=o.lat&&e.lng>=n.lng&&i.lng<=o.lng},intersects:function(t){t=g(t);var e=this._southWest,i=this._northEast,n=t.getSouthWest(),t=t.getNorthEast(),o=t.lat>=e.lat&&n.lat<=i.lat,t=t.lng>=e.lng&&n.lng<=i.lng;return o&&t},overlaps:function(t){t=g(t);var e=this._southWest,i=this._northEast,n=t.getSouthWest(),t=t.getNorthEast(),o=t.lat>e.lat&&n.lat<i.lat,t=t.lng>e.lng&&n.lng<i.lng;return o&&t},toBBoxString:function(){return[this.getWest(),this.getSouth(),this.getEast(),this.getNorth()].join(",")},equals:function(t,e){return!!t&&(t=g(t),this._southWest.equals(t.getSouthWest(),e)&&this._northEast.equals(t.getNorthEast(),e))},isValid:function(){return!(!this._southWest||!this._northEast)}};var ot={latLngToPoint:function(t,e){t=this.projection.project(t),e=this.scale(e);return this.transformation._transform(t,e)},pointToLatLng:function(t,e){e=this.scale(e),t=this.transformation.untransform(t,e);return this.projection.unproject(t)},project:function(t){return this.projection.project(t)},unproject:function(t){return this.projection.unproject(t)},scale:function(t){return 256*Math.pow(2,t)},zoom:function(t){return Math.log(t/256)/Math.LN2},getProjectedBounds:function(t){var e;return this.infinite?null:(e=this.projection.bounds,t=this.scale(t),new f(this.transformation.transform(e.min,t),this.transformation.transform(e.max,t)))},infinite:!(v.prototype={equals:function(t,e){return!!t&&(t=w(t),Math.max(Math.abs(this.lat-t.lat),Math.abs(this.lng-t.lng))<=(void 0===e?1e-9:e))},toString:function(t){return"LatLng("+i(this.lat,t)+", "+i(this.lng,t)+")"},distanceTo:function(t){return st.distance(this,w(t))},wrap:function(){return st.wrapLatLng(this)},toBounds:function(t){var t=180*t/40075017,e=t/Math.cos(Math.PI/180*this.lat);return g([this.lat-t,this.lng-e],[this.lat+t,this.lng+e])},clone:function(){return new v(this.lat,this.lng,this.alt)}}),wrapLatLng:function(t){var e=this.wrapLng?H(t.lng,this.wrapLng,!0):t.lng;return new v(this.wrapLat?H(t.lat,this.wrapLat,!0):t.lat,e,t.alt)},wrapLatLngBounds:function(t){var e=t.getCenter(),i=this.wrapLatLng(e),n=e.lat-i.lat,e=e.lng-i.lng;return 0==n&&0==e?t:(i=t.getSouthWest(),t=t.getNorthEast(),new s(new v(i.lat-n,i.lng-e),new v(t.lat-n,t.lng-e)))}},st=l({},ot,{wrapLng:[-180,180],R:6371e3,distance:function(t,e){var i=Math.PI/180,n=t.lat*i,o=e.lat*i,s=Math.sin((e.lat-t.lat)*i/2),e=Math.sin((e.lng-t.lng)*i/2),t=s*s+Math.cos(n)*Math.cos(o)*e*e,i=2*Math.atan2(Math.sqrt(t),Math.sqrt(1-t));return this.R*i}}),rt=6378137,rt={R:rt,MAX_LATITUDE:85.0511287798,project:function(t){var e=Math.PI/180,i=this.MAX_LATITUDE,i=Math.max(Math.min(i,t.lat),-i),i=Math.sin(i*e);return new p(this.R*t.lng*e,this.R*Math.log((1+i)/(1-i))/2)},unproject:function(t){var e=180/Math.PI;return new v((2*Math.atan(Math.exp(t.y/this.R))-Math.PI/2)*e,t.x*e/this.R)},bounds:new f([-(rt=rt*Math.PI),-rt],[rt,rt])};function at(t,e,i,n){d(t)?(this._a=t[0],this._b=t[1],this._c=t[2],this._d=t[3]):(this._a=t,this._b=e,this._c=i,this._d=n)}function ht(t,e,i,n){return new at(t,e,i,n)}at.prototype={transform:function(t,e){return this._transform(t.clone(),e)},_transform:function(t,e){return t.x=(e=e||1)*(this._a*t.x+this._b),t.y=e*(this._c*t.y+this._d),t},untransform:function(t,e){return new p((t.x/(e=e||1)-this._b)/this._a,(t.y/e-this._d)/this._c)}};var lt=l({},st,{code:"EPSG:3857",projection:rt,transformation:ht(lt=.5/(Math.PI*rt.R),.5,-lt,.5)}),ut=l({},lt,{code:"EPSG:900913"});function ct(t){return document.createElementNS("http://www.w3.org/2000/svg",t)}function dt(t,e){for(var i,n,o,s,r="",a=0,h=t.length;a<h;a++){for(i=0,n=(o=t[a]).length;i<n;i++)r+=(i?"L":"M")+(s=o[i]).x+" "+s.y;r+=e?b.svg?"z":"x":""}return r||"M0 0"}var _t=document.documentElement.style,pt="ActiveXObject"in window,mt=pt&&!document.addEventListener,n="msLaunchUri"in navigator&&!("documentMode"in document),ft=y("webkit"),gt=y("android"),vt=y("android 2")||y("android 3"),yt=parseInt(/WebKit\/([0-9]+)|$/.exec(navigator.userAgent)[1],10),yt=gt&&y("Google")&&yt<537&&!("AudioNode"in window),xt=!!window.opera,wt=!n&&y("chrome"),bt=y("gecko")&&!ft&&!xt&&!pt,Pt=!wt&&y("safari"),Lt=y("phantom"),o="OTransition"in _t,Tt=0===navigator.platform.indexOf("Win"),Mt=pt&&"transition"in _t,zt="WebKitCSSMatrix"in window&&"m11"in new window.WebKitCSSMatrix&&!vt,_t="MozPerspective"in _t,Ct=!window.L_DISABLE_3D&&(Mt||zt||_t)&&!o&&!Lt,Zt="undefined"!=typeof orientation||y("mobile"),St=Zt&&ft,Et=Zt&&zt,kt=!window.PointerEvent&&window.MSPointerEvent,Ot=!(!window.PointerEvent&&!kt),At="ontouchstart"in window||!!window.TouchEvent,Bt=!window.L_NO_TOUCH&&(At||Ot),It=Zt&&xt,Rt=Zt&&bt,Nt=1<(window.devicePixelRatio||window.screen.deviceXDPI/window.screen.logicalXDPI),Dt=function(){var t=!1;try{var e=Object.defineProperty({},"passive",{get:function(){t=!0}});window.addEventListener("testPassiveEventSupport",u,e),window.removeEventListener("testPassiveEventSupport",u,e)}catch(t){}return t}(),jt=!!document.createElement("canvas").getContext,Ht=!(!document.createElementNS||!ct("svg").createSVGRect),Wt=!!Ht&&((Wt=document.createElement("div")).innerHTML="<svg/>","http://www.w3.org/2000/svg"===(Wt.firstChild&&Wt.firstChild.namespaceURI));function y(t){return 0<=navigator.userAgent.toLowerCase().indexOf(t)}var b={ie:pt,ielt9:mt,edge:n,webkit:ft,android:gt,android23:vt,androidStock:yt,opera:xt,chrome:wt,gecko:bt,safari:Pt,phantom:Lt,opera12:o,win:Tt,ie3d:Mt,webkit3d:zt,gecko3d:_t,any3d:Ct,mobile:Zt,mobileWebkit:St,mobileWebkit3d:Et,msPointer:kt,pointer:Ot,touch:Bt,touchNative:At,mobileOpera:It,mobileGecko:Rt,retina:Nt,passiveEvents:Dt,canvas:jt,svg:Ht,vml:!Ht&&function(){try{var t=document.createElement("div"),e=(t.innerHTML='<v:shape adj="1"/>',t.firstChild);return e.style.behavior="url(#default#VML)",e&&"object"==typeof e.adj}catch(t){return!1}}(),inlineSvg:Wt,mac:0===navigator.platform.indexOf("Mac"),linux:0===navigator.platform.indexOf("Linux")},Ft=b.msPointer?"MSPointerDown":"pointerdown",Ut=b.msPointer?"MSPointerMove":"pointermove",Vt=b.msPointer?"MSPointerUp":"pointerup",qt=b.msPointer?"MSPointerCancel":"pointercancel",Gt={touchstart:Ft,touchmove:Ut,touchend:Vt,touchcancel:qt},Kt={touchstart:function(t,e){e.MSPOINTER_TYPE_TOUCH&&e.pointerType===e.MSPOINTER_TYPE_TOUCH&&O(e);ee(t,e)},touchmove:ee,touchend:ee,touchcancel:ee},Yt={},Xt=!1;function Jt(t,e,i){return"touchstart"!==e||Xt||(document.addEventListener(Ft,$t,!0),document.addEventListener(Ut,Qt,!0),document.addEventListener(Vt,te,!0),document.addEventListener(qt,te,!0),Xt=!0),Kt[e]?(i=Kt[e].bind(this,i),t.addEventListener(Gt[e],i,!1),i):(console.warn("wrong event specified:",e),u)}function $t(t){Yt[t.pointerId]=t}function Qt(t){Yt[t.pointerId]&&(Yt[t.pointerId]=t)}function te(t){delete Yt[t.pointerId]}function ee(t,e){if(e.pointerType!==(e.MSPOINTER_TYPE_MOUSE||"mouse")){for(var i in e.touches=[],Yt)e.touches.push(Yt[i]);e.changedTouches=[e],t(e)}}var ie=200;function ne(t,i){t.addEventListener("dblclick",i);var n,o=0;function e(t){var e;1!==t.detail?n=t.detail:"mouse"===t.pointerType||t.sourceCapabilities&&!t.sourceCapabilities.firesTouchEvents||((e=Ne(t)).some(function(t){return t instanceof HTMLLabelElement&&t.attributes.for})&&!e.some(function(t){return t instanceof HTMLInputElement||t instanceof HTMLSelectElement})||((e=Date.now())-o<=ie?2===++n&&i(function(t){var e,i,n={};for(i in t)e=t[i],n[i]=e&&e.bind?e.bind(t):e;return(t=n).type="dblclick",n.detail=2,n.isTrusted=!1,n._simulated=!0,n}(t)):n=1,o=e))}return t.addEventListener("click",e),{dblclick:i,simDblclick:e}}var oe,se,re,ae,he,le,ue=we(["transform","webkitTransform","OTransform","MozTransform","msTransform"]),ce=we(["webkitTransition","transition","OTransition","MozTransition","msTransition"]),de="webkitTransition"===ce||"OTransition"===ce?ce+"End":"transitionend";function _e(t){return"string"==typeof t?document.getElementById(t):t}function pe(t,e){var i=t.style[e]||t.currentStyle&&t.currentStyle[e];return"auto"===(i=i&&"auto"!==i||!document.defaultView?i:(t=document.defaultView.getComputedStyle(t,null))?t[e]:null)?null:i}function P(t,e,i){t=document.createElement(t);return t.className=e||"",i&&i.appendChild(t),t}function T(t){var e=t.parentNode;e&&e.removeChild(t)}function me(t){for(;t.firstChild;)t.removeChild(t.firstChild)}function fe(t){var e=t.parentNode;e&&e.lastChild!==t&&e.appendChild(t)}function ge(t){var e=t.parentNode;e&&e.firstChild!==t&&e.insertBefore(t,e.firstChild)}function ve(t,e){return void 0!==t.classList?t.classList.contains(e):0<(t=xe(t)).length&&new RegExp("(^|\\s)"+e+"(\\s|$)").test(t)}function M(t,e){var i;if(void 0!==t.classList)for(var n=F(e),o=0,s=n.length;o<s;o++)t.classList.add(n[o]);else ve(t,e)||ye(t,((i=xe(t))?i+" ":"")+e)}function z(t,e){void 0!==t.classList?t.classList.remove(e):ye(t,W((" "+xe(t)+" ").replace(" "+e+" "," ")))}function ye(t,e){void 0===t.className.baseVal?t.className=e:t.className.baseVal=e}function xe(t){return void 0===(t=t.correspondingElement?t.correspondingElement:t).className.baseVal?t.className:t.className.baseVal}function C(t,e){if("opacity"in t.style)t.style.opacity=e;else if("filter"in t.style){var i=!1,n="DXImageTransform.Microsoft.Alpha";try{i=t.filters.item(n)}catch(t){if(1===e)return}e=Math.round(100*e),i?(i.Enabled=100!==e,i.Opacity=e):t.style.filter+=" progid:"+n+"(opacity="+e+")"}}function we(t){for(var e=document.documentElement.style,i=0;i<t.length;i++)if(t[i]in e)return t[i];return!1}function be(t,e,i){e=e||new p(0,0);t.style[ue]=(b.ie3d?"translate("+e.x+"px,"+e.y+"px)":"translate3d("+e.x+"px,"+e.y+"px,0)")+(i?" scale("+i+")":"")}function Z(t,e){t._leaflet_pos=e,b.any3d?be(t,e):(t.style.left=e.x+"px",t.style.top=e.y+"px")}function Pe(t){return t._leaflet_pos||new p(0,0)}function Le(){S(window,"dragstart",O)}function Te(){k(window,"dragstart",O)}function Me(t){for(;-1===t.tabIndex;)t=t.parentNode;t.style&&(ze(),le=(he=t).style.outlineStyle,t.style.outlineStyle="none",S(window,"keydown",ze))}function ze(){he&&(he.style.outlineStyle=le,le=he=void 0,k(window,"keydown",ze))}function Ce(t){for(;!((t=t.parentNode).offsetWidth&&t.offsetHeight||t===document.body););return t}function Ze(t){var e=t.getBoundingClientRect();return{x:e.width/t.offsetWidth||1,y:e.height/t.offsetHeight||1,boundingClientRect:e}}ae="onselectstart"in document?(re=function(){S(window,"selectstart",O)},function(){k(window,"selectstart",O)}):(se=we(["userSelect","WebkitUserSelect","OUserSelect","MozUserSelect","msUserSelect"]),re=function(){var t;se&&(t=document.documentElement.style,oe=t[se],t[se]="none")},function(){se&&(document.documentElement.style[se]=oe,oe=void 0)});pt={__proto__:null,TRANSFORM:ue,TRANSITION:ce,TRANSITION_END:de,get:_e,getStyle:pe,create:P,remove:T,empty:me,toFront:fe,toBack:ge,hasClass:ve,addClass:M,removeClass:z,setClass:ye,getClass:xe,setOpacity:C,testProp:we,setTransform:be,setPosition:Z,getPosition:Pe,get disableTextSelection(){return re},get enableTextSelection(){return ae},disableImageDrag:Le,enableImageDrag:Te,preventOutline:Me,restoreOutline:ze,getSizedParentNode:Ce,getScale:Ze};function S(t,e,i,n){if(e&&"object"==typeof e)for(var o in e)ke(t,o,e[o],i);else for(var s=0,r=(e=F(e)).length;s<r;s++)ke(t,e[s],i,n);return this}var E="_leaflet_events";function k(t,e,i,n){if(1===arguments.length)Se(t),delete t[E];else if(e&&"object"==typeof e)for(var o in e)Oe(t,o,e[o],i);else if(e=F(e),2===arguments.length)Se(t,function(t){return-1!==G(e,t)});else for(var s=0,r=e.length;s<r;s++)Oe(t,e[s],i,n);return this}function Se(t,e){for(var i in t[E]){var n=i.split(/\d/)[0];e&&!e(n)||Oe(t,n,null,null,i)}}var Ee={mouseenter:"mouseover",mouseleave:"mouseout",wheel:!("onwheel"in window)&&"mousewheel"};function ke(e,t,i,n){var o,s,r=t+h(i)+(n?"_"+h(n):"");e[E]&&e[E][r]||(s=o=function(t){return i.call(n||e,t||window.event)},!b.touchNative&&b.pointer&&0===t.indexOf("touch")?o=Jt(e,t,o):b.touch&&"dblclick"===t?o=ne(e,o):"addEventListener"in e?"touchstart"===t||"touchmove"===t||"wheel"===t||"mousewheel"===t?e.addEventListener(Ee[t]||t,o,!!b.passiveEvents&&{passive:!1}):"mouseenter"===t||"mouseleave"===t?e.addEventListener(Ee[t],o=function(t){t=t||window.event,We(e,t)&&s(t)},!1):e.addEventListener(t,s,!1):e.attachEvent("on"+t,o),e[E]=e[E]||{},e[E][r]=o)}function Oe(t,e,i,n,o){o=o||e+h(i)+(n?"_"+h(n):"");var s,r,i=t[E]&&t[E][o];i&&(!b.touchNative&&b.pointer&&0===e.indexOf("touch")?(n=t,r=i,Gt[s=e]?n.removeEventListener(Gt[s],r,!1):console.warn("wrong event specified:",s)):b.touch&&"dblclick"===e?(n=i,(r=t).removeEventListener("dblclick",n.dblclick),r.removeEventListener("click",n.simDblclick)):"removeEventListener"in t?t.removeEventListener(Ee[e]||e,i,!1):t.detachEvent("on"+e,i),t[E][o]=null)}function Ae(t){return t.stopPropagation?t.stopPropagation():t.originalEvent?t.originalEvent._stopped=!0:t.cancelBubble=!0,this}function Be(t){return ke(t,"wheel",Ae),this}function Ie(t){return S(t,"mousedown touchstart dblclick contextmenu",Ae),t._leaflet_disable_click=!0,this}function O(t){return t.preventDefault?t.preventDefault():t.returnValue=!1,this}function Re(t){return O(t),Ae(t),this}function Ne(t){if(t.composedPath)return t.composedPath();for(var e=[],i=t.target;i;)e.push(i),i=i.parentNode;return e}function De(t,e){var i,n;return e?(n=(i=Ze(e)).boundingClientRect,new p((t.clientX-n.left)/i.x-e.clientLeft,(t.clientY-n.top)/i.y-e.clientTop)):new p(t.clientX,t.clientY)}var je=b.linux&&b.chrome?window.devicePixelRatio:b.mac?3*window.devicePixelRatio:0<window.devicePixelRatio?2*window.devicePixelRatio:1;function He(t){return b.edge?t.wheelDeltaY/2:t.deltaY&&0===t.deltaMode?-t.deltaY/je:t.deltaY&&1===t.deltaMode?20*-t.deltaY:t.deltaY&&2===t.deltaMode?60*-t.deltaY:t.deltaX||t.deltaZ?0:t.wheelDelta?(t.wheelDeltaY||t.wheelDelta)/2:t.detail&&Math.abs(t.detail)<32765?20*-t.detail:t.detail?t.detail/-32765*60:0}function We(t,e){var i=e.relatedTarget;if(!i)return!0;try{for(;i&&i!==t;)i=i.parentNode}catch(t){return!1}return i!==t}var mt={__proto__:null,on:S,off:k,stopPropagation:Ae,disableScrollPropagation:Be,disableClickPropagation:Ie,preventDefault:O,stop:Re,getPropagationPath:Ne,getMousePosition:De,getWheelDelta:He,isExternalTarget:We,addListener:S,removeListener:k},Fe=it.extend({run:function(t,e,i,n){this.stop(),this._el=t,this._inProgress=!0,this._duration=i||.25,this._easeOutPower=1/Math.max(n||.5,.2),this._startPos=Pe(t),this._offset=e.subtract(this._startPos),this._startTime=+new Date,this.fire("start"),this._animate()},stop:function(){this._inProgress&&(this._step(!0),this._complete())},_animate:function(){this._animId=x(this._animate,this),this._step()},_step:function(t){var e=+new Date-this._startTime,i=1e3*this._duration;e<i?this._runFrame(this._easeOut(e/i),t):(this._runFrame(1),this._complete())},_runFrame:function(t,e){t=this._startPos.add(this._offset.multiplyBy(t));e&&t._round(),Z(this._el,t),this.fire("step")},_complete:function(){r(this._animId),this._inProgress=!1,this.fire("end")},_easeOut:function(t){return 1-Math.pow(1-t,this._easeOutPower)}}),A=it.extend({options:{crs:lt,center:void 0,zoom:void 0,minZoom:void 0,maxZoom:void 0,layers:[],maxBounds:void 0,renderer:void 0,zoomAnimation:!0,zoomAnimationThreshold:4,fadeAnimation:!0,markerZoomAnimation:!0,transform3DLimit:8388608,zoomSnap:1,zoomDelta:1,trackResize:!0},initialize:function(t,e){e=c(this,e),this._handlers=[],this._layers={},this._zoomBoundLayers={},this._sizeChanged=!0,this._initContainer(t),this._initLayout(),this._onResize=a(this._onResize,this),this._initEvents(),e.maxBounds&&this.setMaxBounds(e.maxBounds),void 0!==e.zoom&&(this._zoom=this._limitZoom(e.zoom)),e.center&&void 0!==e.zoom&&this.setView(w(e.center),e.zoom,{reset:!0}),this.callInitHooks(),this._zoomAnimated=ce&&b.any3d&&!b.mobileOpera&&this.options.zoomAnimation,this._zoomAnimated&&(this._createAnimProxy(),S(this._proxy,de,this._catchTransitionEnd,this)),this._addLayers(this.options.layers)},setView:function(t,e,i){if((e=void 0===e?this._zoom:this._limitZoom(e),t=this._limitCenter(w(t),e,this.options.maxBounds),i=i||{},this._stop(),this._loaded&&!i.reset&&!0!==i)&&(void 0!==i.animate&&(i.zoom=l({animate:i.animate},i.zoom),i.pan=l({animate:i.animate,duration:i.duration},i.pan)),this._zoom!==e?this._tryAnimatedZoom&&this._tryAnimatedZoom(t,e,i.zoom):this._tryAnimatedPan(t,i.pan)))return clearTimeout(this._sizeTimer),this;return this._resetView(t,e,i.pan&&i.pan.noMoveStart),this},setZoom:function(t,e){return this._loaded?this.setView(this.getCenter(),t,{zoom:e}):(this._zoom=t,this)},zoomIn:function(t,e){return t=t||(b.any3d?this.options.zoomDelta:1),this.setZoom(this._zoom+t,e)},zoomOut:function(t,e){return t=t||(b.any3d?this.options.zoomDelta:1),this.setZoom(this._zoom-t,e)},setZoomAround:function(t,e,i){var n=this.getZoomScale(e),o=this.getSize().divideBy(2),t=(t instanceof p?t:this.latLngToContainerPoint(t)).subtract(o).multiplyBy(1-1/n),n=this.containerPointToLatLng(o.add(t));return this.setView(n,e,{zoom:i})},_getBoundsCenterZoom:function(t,e){e=e||{},t=t.getBounds?t.getBounds():g(t);var i=m(e.paddingTopLeft||e.padding||[0,0]),n=m(e.paddingBottomRight||e.padding||[0,0]),o=this.getBoundsZoom(t,!1,i.add(n));return(o="number"==typeof e.maxZoom?Math.min(e.maxZoom,o):o)===1/0?{center:t.getCenter(),zoom:o}:(e=n.subtract(i).divideBy(2),n=this.project(t.getSouthWest(),o),i=this.project(t.getNorthEast(),o),{center:this.unproject(n.add(i).divideBy(2).add(e),o),zoom:o})},fitBounds:function(t,e){if((t=g(t)).isValid())return t=this._getBoundsCenterZoom(t,e),this.setView(t.center,t.zoom,e);throw new Error("Bounds are not valid.")},fitWorld:function(t){return this.fitBounds([[-90,-180],[90,180]],t)},panTo:function(t,e){return this.setView(t,this._zoom,{pan:e})},panBy:function(t,e){var i;return e=e||{},(t=m(t).round()).x||t.y?(!0===e.animate||this.getSize().contains(t)?(this._panAnim||(this._panAnim=new Fe,this._panAnim.on({step:this._onPanTransitionStep,end:this._onPanTransitionEnd},this)),e.noMoveStart||this.fire("movestart"),!1!==e.animate?(M(this._mapPane,"leaflet-pan-anim"),i=this._getMapPanePos().subtract(t).round(),this._panAnim.run(this._mapPane,i,e.duration||.25,e.easeLinearity)):(this._rawPanBy(t),this.fire("move").fire("moveend"))):this._resetView(this.unproject(this.project(this.getCenter()).add(t)),this.getZoom()),this):this.fire("moveend")},flyTo:function(n,o,t){if(!1===(t=t||{}).animate||!b.any3d)return this.setView(n,o,t);this._stop();var s=this.project(this.getCenter()),r=this.project(n),e=this.getSize(),a=this._zoom,h=(n=w(n),o=void 0===o?a:o,Math.max(e.x,e.y)),i=h*this.getZoomScale(a,o),l=r.distanceTo(s)||1,u=1.42,c=u*u;function d(t){t=(i*i-h*h+(t?-1:1)*c*c*l*l)/(2*(t?i:h)*c*l),t=Math.sqrt(t*t+1)-t;return t<1e-9?-18:Math.log(t)}function _(t){return(Math.exp(t)-Math.exp(-t))/2}function p(t){return(Math.exp(t)+Math.exp(-t))/2}var m=d(0);function f(t){return h*(p(m)*(_(t=m+u*t)/p(t))-_(m))/c}var g=Date.now(),v=(d(1)-m)/u,y=t.duration?1e3*t.duration:1e3*v*.8;return this._moveStart(!0,t.noMoveStart),function t(){var e=(Date.now()-g)/y,i=(1-Math.pow(1-e,1.5))*v;e<=1?(this._flyToFrame=x(t,this),this._move(this.unproject(s.add(r.subtract(s).multiplyBy(f(i)/l)),a),this.getScaleZoom(h/(e=i,h*(p(m)/p(m+u*e))),a),{flyTo:!0})):this._move(n,o)._moveEnd(!0)}.call(this),this},flyToBounds:function(t,e){t=this._getBoundsCenterZoom(t,e);return this.flyTo(t.center,t.zoom,e)},setMaxBounds:function(t){return t=g(t),this.listens("moveend",this._panInsideMaxBounds)&&this.off("moveend",this._panInsideMaxBounds),t.isValid()?(this.options.maxBounds=t,this._loaded&&this._panInsideMaxBounds(),this.on("moveend",this._panInsideMaxBounds)):(this.options.maxBounds=null,this)},setMinZoom:function(t){var e=this.options.minZoom;return this.options.minZoom=t,this._loaded&&e!==t&&(this.fire("zoomlevelschange"),this.getZoom()<this.options.minZoom)?this.setZoom(t):this},setMaxZoom:function(t){var e=this.options.maxZoom;return this.options.maxZoom=t,this._loaded&&e!==t&&(this.fire("zoomlevelschange"),this.getZoom()>this.options.maxZoom)?this.setZoom(t):this},panInsideBounds:function(t,e){this._enforcingBounds=!0;var i=this.getCenter(),t=this._limitCenter(i,this._zoom,g(t));return i.equals(t)||this.panTo(t,e),this._enforcingBounds=!1,this},panInside:function(t,e){var i=m((e=e||{}).paddingTopLeft||e.padding||[0,0]),n=m(e.paddingBottomRight||e.padding||[0,0]),o=this.project(this.getCenter()),t=this.project(t),s=this.getPixelBounds(),i=_([s.min.add(i),s.max.subtract(n)]),s=i.getSize();return i.contains(t)||(this._enforcingBounds=!0,n=t.subtract(i.getCenter()),i=i.extend(t).getSize().subtract(s),o.x+=n.x<0?-i.x:i.x,o.y+=n.y<0?-i.y:i.y,this.panTo(this.unproject(o),e),this._enforcingBounds=!1),this},invalidateSize:function(t){if(!this._loaded)return this;t=l({animate:!1,pan:!0},!0===t?{animate:!0}:t);var e=this.getSize(),i=(this._sizeChanged=!0,this._lastCenter=null,this.getSize()),n=e.divideBy(2).round(),o=i.divideBy(2).round(),n=n.subtract(o);return n.x||n.y?(t.animate&&t.pan?this.panBy(n):(t.pan&&this._rawPanBy(n),this.fire("move"),t.debounceMoveend?(clearTimeout(this._sizeTimer),this._sizeTimer=setTimeout(a(this.fire,this,"moveend"),200)):this.fire("moveend")),this.fire("resize",{oldSize:e,newSize:i})):this},stop:function(){return this.setZoom(this._limitZoom(this._zoom)),this.options.zoomSnap||this.fire("viewreset"),this._stop()},locate:function(t){var e,i;return t=this._locateOptions=l({timeout:1e4,watch:!1},t),"geolocation"in navigator?(e=a(this._handleGeolocationResponse,this),i=a(this._handleGeolocationError,this),t.watch?this._locationWatchId=navigator.geolocation.watchPosition(e,i,t):navigator.geolocation.getCurrentPosition(e,i,t)):this._handleGeolocationError({code:0,message:"Geolocation not supported."}),this},stopLocate:function(){return navigator.geolocation&&navigator.geolocation.clearWatch&&navigator.geolocation.clearWatch(this._locationWatchId),this._locateOptions&&(this._locateOptions.setView=!1),this},_handleGeolocationError:function(t){var e;this._container._leaflet_id&&(e=t.code,t=t.message||(1===e?"permission denied":2===e?"position unavailable":"timeout"),this._locateOptions.setView&&!this._loaded&&this.fitWorld(),this.fire("locationerror",{code:e,message:"Geolocation error: "+t+"."}))},_handleGeolocationResponse:function(t){if(this._container._leaflet_id){var e,i,n=new v(t.coords.latitude,t.coords.longitude),o=n.toBounds(2*t.coords.accuracy),s=this._locateOptions,r=(s.setView&&(e=this.getBoundsZoom(o),this.setView(n,s.maxZoom?Math.min(e,s.maxZoom):e)),{latlng:n,bounds:o,timestamp:t.timestamp});for(i in t.coords)"number"==typeof t.coords[i]&&(r[i]=t.coords[i]);this.fire("locationfound",r)}},addHandler:function(t,e){return e&&(e=this[t]=new e(this),this._handlers.push(e),this.options[t]&&e.enable()),this},remove:function(){if(this._initEvents(!0),this.options.maxBounds&&this.off("moveend",this._panInsideMaxBounds),this._containerId!==this._container._leaflet_id)throw new Error("Map container is being reused by another instance");try{delete this._container._leaflet_id,delete this._containerId}catch(t){this._container._leaflet_id=void 0,this._containerId=void 0}for(var t in void 0!==this._locationWatchId&&this.stopLocate(),this._stop(),T(this._mapPane),this._clearControlPos&&this._clearControlPos(),this._resizeRequest&&(r(this._resizeRequest),this._resizeRequest=null),this._clearHandlers(),this._loaded&&this.fire("unload"),this._layers)this._layers[t].remove();for(t in this._panes)T(this._panes[t]);return this._layers=[],this._panes=[],delete this._mapPane,delete this._renderer,this},createPane:function(t,e){e=P("div","leaflet-pane"+(t?" leaflet-"+t.replace("Pane","")+"-pane":""),e||this._mapPane);return t&&(this._panes[t]=e),e},getCenter:function(){return this._checkIfLoaded(),this._lastCenter&&!this._moved()?this._lastCenter.clone():this.layerPointToLatLng(this._getCenterLayerPoint())},getZoom:function(){return this._zoom},getBounds:function(){var t=this.getPixelBounds();return new s(this.unproject(t.getBottomLeft()),this.unproject(t.getTopRight()))},getMinZoom:function(){return void 0===this.options.minZoom?this._layersMinZoom||0:this.options.minZoom},getMaxZoom:function(){return void 0===this.options.maxZoom?void 0===this._layersMaxZoom?1/0:this._layersMaxZoom:this.options.maxZoom},getBoundsZoom:function(t,e,i){t=g(t),i=m(i||[0,0]);var n=this.getZoom()||0,o=this.getMinZoom(),s=this.getMaxZoom(),r=t.getNorthWest(),t=t.getSouthEast(),i=this.getSize().subtract(i),t=_(this.project(t,n),this.project(r,n)).getSize(),r=b.any3d?this.options.zoomSnap:1,a=i.x/t.x,i=i.y/t.y,t=e?Math.max(a,i):Math.min(a,i),n=this.getScaleZoom(t,n);return r&&(n=Math.round(n/(r/100))*(r/100),n=e?Math.ceil(n/r)*r:Math.floor(n/r)*r),Math.max(o,Math.min(s,n))},getSize:function(){return this._size&&!this._sizeChanged||(this._size=new p(this._container.clientWidth||0,this._container.clientHeight||0),this._sizeChanged=!1),this._size.clone()},getPixelBounds:function(t,e){t=this._getTopLeftPoint(t,e);return new f(t,t.add(this.getSize()))},getPixelOrigin:function(){return this._checkIfLoaded(),this._pixelOrigin},getPixelWorldBounds:function(t){return this.options.crs.getProjectedBounds(void 0===t?this.getZoom():t)},getPane:function(t){return"string"==typeof t?this._panes[t]:t},getPanes:function(){return this._panes},getContainer:function(){return this._container},getZoomScale:function(t,e){var i=this.options.crs;return e=void 0===e?this._zoom:e,i.scale(t)/i.scale(e)},getScaleZoom:function(t,e){var i=this.options.crs,t=(e=void 0===e?this._zoom:e,i.zoom(t*i.scale(e)));return isNaN(t)?1/0:t},project:function(t,e){return e=void 0===e?this._zoom:e,this.options.crs.latLngToPoint(w(t),e)},unproject:function(t,e){return e=void 0===e?this._zoom:e,this.options.crs.pointToLatLng(m(t),e)},layerPointToLatLng:function(t){t=m(t).add(this.getPixelOrigin());return this.unproject(t)},latLngToLayerPoint:function(t){return this.project(w(t))._round()._subtract(this.getPixelOrigin())},wrapLatLng:function(t){return this.options.crs.wrapLatLng(w(t))},wrapLatLngBounds:function(t){return this.options.crs.wrapLatLngBounds(g(t))},distance:function(t,e){return this.options.crs.distance(w(t),w(e))},containerPointToLayerPoint:function(t){return m(t).subtract(this._getMapPanePos())},layerPointToContainerPoint:function(t){return m(t).add(this._getMapPanePos())},containerPointToLatLng:function(t){t=this.containerPointToLayerPoint(m(t));return this.layerPointToLatLng(t)},latLngToContainerPoint:function(t){return this.layerPointToContainerPoint(this.latLngToLayerPoint(w(t)))},mouseEventToContainerPoint:function(t){return De(t,this._container)},mouseEventToLayerPoint:function(t){return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(t))},mouseEventToLatLng:function(t){return this.layerPointToLatLng(this.mouseEventToLayerPoint(t))},_initContainer:function(t){t=this._container=_e(t);if(!t)throw new Error("Map container not found.");if(t._leaflet_id)throw new Error("Map container is already initialized.");S(t,"scroll",this._onScroll,this),this._containerId=h(t)},_initLayout:function(){var t=this._container,e=(this._fadeAnimated=this.options.fadeAnimation&&b.any3d,M(t,"leaflet-container"+(b.touch?" leaflet-touch":"")+(b.retina?" leaflet-retina":"")+(b.ielt9?" leaflet-oldie":"")+(b.safari?" leaflet-safari":"")+(this._fadeAnimated?" leaflet-fade-anim":"")),pe(t,"position"));"absolute"!==e&&"relative"!==e&&"fixed"!==e&&"sticky"!==e&&(t.style.position="relative"),this._initPanes(),this._initControlPos&&this._initControlPos()},_initPanes:function(){var t=this._panes={};this._paneRenderers={},this._mapPane=this.createPane("mapPane",this._container),Z(this._mapPane,new p(0,0)),this.createPane("tilePane"),this.createPane("overlayPane"),this.createPane("shadowPane"),this.createPane("markerPane"),this.createPane("tooltipPane"),this.createPane("popupPane"),this.options.markerZoomAnimation||(M(t.markerPane,"leaflet-zoom-hide"),M(t.shadowPane,"leaflet-zoom-hide"))},_resetView:function(t,e,i){Z(this._mapPane,new p(0,0));var n=!this._loaded,o=(this._loaded=!0,e=this._limitZoom(e),this.fire("viewprereset"),this._zoom!==e);this._moveStart(o,i)._move(t,e)._moveEnd(o),this.fire("viewreset"),n&&this.fire("load")},_moveStart:function(t,e){return t&&this.fire("zoomstart"),e||this.fire("movestart"),this},_move:function(t,e,i,n){void 0===e&&(e=this._zoom);var o=this._zoom!==e;return this._zoom=e,this._lastCenter=t,this._pixelOrigin=this._getNewPixelOrigin(t),n?i&&i.pinch&&this.fire("zoom",i):((o||i&&i.pinch)&&this.fire("zoom",i),this.fire("move",i)),this},_moveEnd:function(t){return t&&this.fire("zoomend"),this.fire("moveend")},_stop:function(){return r(this._flyToFrame),this._panAnim&&this._panAnim.stop(),this},_rawPanBy:function(t){Z(this._mapPane,this._getMapPanePos().subtract(t))},_getZoomSpan:function(){return this.getMaxZoom()-this.getMinZoom()},_panInsideMaxBounds:function(){this._enforcingBounds||this.panInsideBounds(this.options.maxBounds)},_checkIfLoaded:function(){if(!this._loaded)throw new Error("Set map center and zoom first.")},_initEvents:function(t){this._targets={};var e=t?k:S;e((this._targets[h(this._container)]=this)._container,"click dblclick mousedown mouseup mouseover mouseout mousemove contextmenu keypress keydown keyup",this._handleDOMEvent,this),this.options.trackResize&&e(window,"resize",this._onResize,this),b.any3d&&this.options.transform3DLimit&&(t?this.off:this.on).call(this,"moveend",this._onMoveEnd)},_onResize:function(){r(this._resizeRequest),this._resizeRequest=x(function(){this.invalidateSize({debounceMoveend:!0})},this)},_onScroll:function(){this._container.scrollTop=0,this._container.scrollLeft=0},_onMoveEnd:function(){var t=this._getMapPanePos();Math.max(Math.abs(t.x),Math.abs(t.y))>=this.options.transform3DLimit&&this._resetView(this.getCenter(),this.getZoom())},_findEventTargets:function(t,e){for(var i,n=[],o="mouseout"===e||"mouseover"===e,s=t.target||t.srcElement,r=!1;s;){if((i=this._targets[h(s)])&&("click"===e||"preclick"===e)&&this._draggableMoved(i)){r=!0;break}if(i&&i.listens(e,!0)){if(o&&!We(s,t))break;if(n.push(i),o)break}if(s===this._container)break;s=s.parentNode}return n=n.length||r||o||!this.listens(e,!0)?n:[this]},_isClickDisabled:function(t){for(;t&&t!==this._container;){if(t._leaflet_disable_click)return!0;t=t.parentNode}},_handleDOMEvent:function(t){var e,i=t.target||t.srcElement;!this._loaded||i._leaflet_disable_events||"click"===t.type&&this._isClickDisabled(i)||("mousedown"===(e=t.type)&&Me(i),this._fireDOMEvent(t,e))},_mouseEvents:["click","dblclick","mouseover","mouseout","contextmenu"],_fireDOMEvent:function(t,e,i){"click"===t.type&&((a=l({},t)).type="preclick",this._fireDOMEvent(a,a.type,i));var n=this._findEventTargets(t,e);if(i){for(var o=[],s=0;s<i.length;s++)i[s].listens(e,!0)&&o.push(i[s]);n=o.concat(n)}if(n.length){"contextmenu"===e&&O(t);var r,a=n[0],h={originalEvent:t};for("keypress"!==t.type&&"keydown"!==t.type&&"keyup"!==t.type&&(r=a.getLatLng&&(!a._radius||a._radius<=10),h.containerPoint=r?this.latLngToContainerPoint(a.getLatLng()):this.mouseEventToContainerPoint(t),h.layerPoint=this.containerPointToLayerPoint(h.containerPoint),h.latlng=r?a.getLatLng():this.layerPointToLatLng(h.layerPoint)),s=0;s<n.length;s++)if(n[s].fire(e,h,!0),h.originalEvent._stopped||!1===n[s].options.bubblingMouseEvents&&-1!==G(this._mouseEvents,e))return}},_draggableMoved:function(t){return(t=t.dragging&&t.dragging.enabled()?t:this).dragging&&t.dragging.moved()||this.boxZoom&&this.boxZoom.moved()},_clearHandlers:function(){for(var t=0,e=this._handlers.length;t<e;t++)this._handlers[t].disable()},whenReady:function(t,e){return this._loaded?t.call(e||this,{target:this}):this.on("load",t,e),this},_getMapPanePos:function(){return Pe(this._mapPane)||new p(0,0)},_moved:function(){var t=this._getMapPanePos();return t&&!t.equals([0,0])},_getTopLeftPoint:function(t,e){return(t&&void 0!==e?this._getNewPixelOrigin(t,e):this.getPixelOrigin()).subtract(this._getMapPanePos())},_getNewPixelOrigin:function(t,e){var i=this.getSize()._divideBy(2);return this.project(t,e)._subtract(i)._add(this._getMapPanePos())._round()},_latLngToNewLayerPoint:function(t,e,i){i=this._getNewPixelOrigin(i,e);return this.project(t,e)._subtract(i)},_latLngBoundsToNewLayerBounds:function(t,e,i){i=this._getNewPixelOrigin(i,e);return _([this.project(t.getSouthWest(),e)._subtract(i),this.project(t.getNorthWest(),e)._subtract(i),this.project(t.getSouthEast(),e)._subtract(i),this.project(t.getNorthEast(),e)._subtract(i)])},_getCenterLayerPoint:function(){return this.containerPointToLayerPoint(this.getSize()._divideBy(2))},_getCenterOffset:function(t){return this.latLngToLayerPoint(t).subtract(this._getCenterLayerPoint())},_limitCenter:function(t,e,i){var n,o;return!i||(n=this.project(t,e),o=this.getSize().divideBy(2),o=new f(n.subtract(o),n.add(o)),o=this._getBoundsOffset(o,i,e),Math.abs(o.x)<=1&&Math.abs(o.y)<=1)?t:this.unproject(n.add(o),e)},_limitOffset:function(t,e){var i;return e?(i=new f((i=this.getPixelBounds()).min.add(t),i.max.add(t)),t.add(this._getBoundsOffset(i,e))):t},_getBoundsOffset:function(t,e,i){e=_(this.project(e.getNorthEast(),i),this.project(e.getSouthWest(),i)),i=e.min.subtract(t.min),e=e.max.subtract(t.max);return new p(this._rebound(i.x,-e.x),this._rebound(i.y,-e.y))},_rebound:function(t,e){return 0<t+e?Math.round(t-e)/2:Math.max(0,Math.ceil(t))-Math.max(0,Math.floor(e))},_limitZoom:function(t){var e=this.getMinZoom(),i=this.getMaxZoom(),n=b.any3d?this.options.zoomSnap:1;return n&&(t=Math.round(t/n)*n),Math.max(e,Math.min(i,t))},_onPanTransitionStep:function(){this.fire("move")},_onPanTransitionEnd:function(){z(this._mapPane,"leaflet-pan-anim"),this.fire("moveend")},_tryAnimatedPan:function(t,e){t=this._getCenterOffset(t)._trunc();return!(!0!==(e&&e.animate)&&!this.getSize().contains(t))&&(this.panBy(t,e),!0)},_createAnimProxy:function(){var t=this._proxy=P("div","leaflet-proxy leaflet-zoom-animated");this._panes.mapPane.appendChild(t),this.on("zoomanim",function(t){var e=ue,i=this._proxy.style[e];be(this._proxy,this.project(t.center,t.zoom),this.getZoomScale(t.zoom,1)),i===this._proxy.style[e]&&this._animatingZoom&&this._onZoomTransitionEnd()},this),this.on("load moveend",this._animMoveEnd,this),this._on("unload",this._destroyAnimProxy,this)},_destroyAnimProxy:function(){T(this._proxy),this.off("load moveend",this._animMoveEnd,this),delete this._proxy},_animMoveEnd:function(){var t=this.getCenter(),e=this.getZoom();be(this._proxy,this.project(t,e),this.getZoomScale(e,1))},_catchTransitionEnd:function(t){this._animatingZoom&&0<=t.propertyName.indexOf("transform")&&this._onZoomTransitionEnd()},_nothingToAnimate:function(){return!this._container.getElementsByClassName("leaflet-zoom-animated").length},_tryAnimatedZoom:function(t,e,i){if(!this._animatingZoom){if(i=i||{},!this._zoomAnimated||!1===i.animate||this._nothingToAnimate()||Math.abs(e-this._zoom)>this.options.zoomAnimationThreshold)return!1;var n=this.getZoomScale(e),n=this._getCenterOffset(t)._divideBy(1-1/n);if(!0!==i.animate&&!this.getSize().contains(n))return!1;x(function(){this._moveStart(!0,i.noMoveStart||!1)._animateZoom(t,e,!0)},this)}return!0},_animateZoom:function(t,e,i,n){this._mapPane&&(i&&(this._animatingZoom=!0,this._animateToCenter=t,this._animateToZoom=e,M(this._mapPane,"leaflet-zoom-anim")),this.fire("zoomanim",{center:t,zoom:e,noUpdate:n}),this._tempFireZoomEvent||(this._tempFireZoomEvent=this._zoom!==this._animateToZoom),this._move(this._animateToCenter,this._animateToZoom,void 0,!0),setTimeout(a(this._onZoomTransitionEnd,this),250))},_onZoomTransitionEnd:function(){this._animatingZoom&&(this._mapPane&&z(this._mapPane,"leaflet-zoom-anim"),this._animatingZoom=!1,this._move(this._animateToCenter,this._animateToZoom,void 0,!0),this._tempFireZoomEvent&&this.fire("zoom"),delete this._tempFireZoomEvent,this.fire("move"),this._moveEnd(!0))}});function Ue(t){return new B(t)}var B=et.extend({options:{position:"topright"},initialize:function(t){c(this,t)},getPosition:function(){return this.options.position},setPosition:function(t){var e=this._map;return e&&e.removeControl(this),this.options.position=t,e&&e.addControl(this),this},getContainer:function(){return this._container},addTo:function(t){this.remove(),this._map=t;var e=this._container=this.onAdd(t),i=this.getPosition(),t=t._controlCorners[i];return M(e,"leaflet-control"),-1!==i.indexOf("bottom")?t.insertBefore(e,t.firstChild):t.appendChild(e),this._map.on("unload",this.remove,this),this},remove:function(){return this._map&&(T(this._container),this.onRemove&&this.onRemove(this._map),this._map.off("unload",this.remove,this),this._map=null),this},_refocusOnMap:function(t){this._map&&t&&0<t.screenX&&0<t.screenY&&this._map.getContainer().focus()}}),Ve=(A.include({addControl:function(t){return t.addTo(this),this},removeControl:function(t){return t.remove(),this},_initControlPos:function(){var i=this._controlCorners={},n="leaflet-",o=this._controlContainer=P("div",n+"control-container",this._container);function t(t,e){i[t+e]=P("div",n+t+" "+n+e,o)}t("top","left"),t("top","right"),t("bottom","left"),t("bottom","right")},_clearControlPos:function(){for(var t in this._controlCorners)T(this._controlCorners[t]);T(this._controlContainer),delete this._controlCorners,delete this._controlContainer}}),B.extend({options:{collapsed:!0,position:"topright",autoZIndex:!0,hideSingleBase:!1,sortLayers:!1,sortFunction:function(t,e,i,n){return i<n?-1:n<i?1:0}},initialize:function(t,e,i){for(var n in c(this,i),this._layerControlInputs=[],this._layers=[],this._lastZIndex=0,this._handlingClick=!1,this._preventClick=!1,t)this._addLayer(t[n],n);for(n in e)this._addLayer(e[n],n,!0)},onAdd:function(t){this._initLayout(),this._update(),(this._map=t).on("zoomend",this._checkDisabledLayers,this);for(var e=0;e<this._layers.length;e++)this._layers[e].layer.on("add remove",this._onLayerChange,this);return this._container},addTo:function(t){return B.prototype.addTo.call(this,t),this._expandIfNotCollapsed()},onRemove:function(){this._map.off("zoomend",this._checkDisabledLayers,this);for(var t=0;t<this._layers.length;t++)this._layers[t].layer.off("add remove",this._onLayerChange,this)},addBaseLayer:function(t,e){return this._addLayer(t,e),this._map?this._update():this},addOverlay:function(t,e){return this._addLayer(t,e,!0),this._map?this._update():this},removeLayer:function(t){t.off("add remove",this._onLayerChange,this);t=this._getLayer(h(t));return t&&this._layers.splice(this._layers.indexOf(t),1),this._map?this._update():this},expand:function(){M(this._container,"leaflet-control-layers-expanded"),this._section.style.height=null;var t=this._map.getSize().y-(this._container.offsetTop+50);return t<this._section.clientHeight?(M(this._section,"leaflet-control-layers-scrollbar"),this._section.style.height=t+"px"):z(this._section,"leaflet-control-layers-scrollbar"),this._checkDisabledLayers(),this},collapse:function(){return z(this._container,"leaflet-control-layers-expanded"),this},_initLayout:function(){var t="leaflet-control-layers",e=this._container=P("div",t),i=this.options.collapsed,n=(e.setAttribute("aria-haspopup",!0),Ie(e),Be(e),this._section=P("section",t+"-list")),o=(i&&(this._map.on("click",this.collapse,this),S(e,{mouseenter:this._expandSafely,mouseleave:this.collapse},this)),this._layersLink=P("a",t+"-toggle",e));o.href="#",o.title="Layers",o.setAttribute("role","button"),S(o,{keydown:function(t){13===t.keyCode&&this._expandSafely()},click:function(t){O(t),this._expandSafely()}},this),i||this.expand(),this._baseLayersList=P("div",t+"-base",n),this._separator=P("div",t+"-separator",n),this._overlaysList=P("div",t+"-overlays",n),e.appendChild(n)},_getLayer:function(t){for(var e=0;e<this._layers.length;e++)if(this._layers[e]&&h(this._layers[e].layer)===t)return this._layers[e]},_addLayer:function(t,e,i){this._map&&t.on("add remove",this._onLayerChange,this),this._layers.push({layer:t,name:e,overlay:i}),this.options.sortLayers&&this._layers.sort(a(function(t,e){return this.options.sortFunction(t.layer,e.layer,t.name,e.name)},this)),this.options.autoZIndex&&t.setZIndex&&(this._lastZIndex++,t.setZIndex(this._lastZIndex)),this._expandIfNotCollapsed()},_update:function(){if(this._container){me(this._baseLayersList),me(this._overlaysList),this._layerControlInputs=[];for(var t,e,i,n=0,o=0;o<this._layers.length;o++)i=this._layers[o],this._addItem(i),e=e||i.overlay,t=t||!i.overlay,n+=i.overlay?0:1;this.options.hideSingleBase&&(this._baseLayersList.style.display=(t=t&&1<n)?"":"none"),this._separator.style.display=e&&t?"":"none"}return this},_onLayerChange:function(t){this._handlingClick||this._update();var e=this._getLayer(h(t.target)),t=e.overlay?"add"===t.type?"overlayadd":"overlayremove":"add"===t.type?"baselayerchange":null;t&&this._map.fire(t,e)},_createRadioElement:function(t,e){t='<input type="radio" class="leaflet-control-layers-selector" name="'+t+'"'+(e?' checked="checked"':"")+"/>",e=document.createElement("div");return e.innerHTML=t,e.firstChild},_addItem:function(t){var e,i=document.createElement("label"),n=this._map.hasLayer(t.layer),n=(t.overlay?((e=document.createElement("input")).type="checkbox",e.className="leaflet-control-layers-selector",e.defaultChecked=n):e=this._createRadioElement("leaflet-base-layers_"+h(this),n),this._layerControlInputs.push(e),e.layerId=h(t.layer),S(e,"click",this._onInputClick,this),document.createElement("span")),o=(n.innerHTML=" "+t.name,document.createElement("span"));return i.appendChild(o),o.appendChild(e),o.appendChild(n),(t.overlay?this._overlaysList:this._baseLayersList).appendChild(i),this._checkDisabledLayers(),i},_onInputClick:function(){if(!this._preventClick){var t,e,i=this._layerControlInputs,n=[],o=[];this._handlingClick=!0;for(var s=i.length-1;0<=s;s--)t=i[s],e=this._getLayer(t.layerId).layer,t.checked?n.push(e):t.checked||o.push(e);for(s=0;s<o.length;s++)this._map.hasLayer(o[s])&&this._map.removeLayer(o[s]);for(s=0;s<n.length;s++)this._map.hasLayer(n[s])||this._map.addLayer(n[s]);this._handlingClick=!1,this._refocusOnMap()}},_checkDisabledLayers:function(){for(var t,e,i=this._layerControlInputs,n=this._map.getZoom(),o=i.length-1;0<=o;o--)t=i[o],e=this._getLayer(t.layerId).layer,t.disabled=void 0!==e.options.minZoom&&n<e.options.minZoom||void 0!==e.options.maxZoom&&n>e.options.maxZoom},_expandIfNotCollapsed:function(){return this._map&&!this.options.collapsed&&this.expand(),this},_expandSafely:function(){var t=this._section,e=(this._preventClick=!0,S(t,"click",O),this.expand(),this);setTimeout(function(){k(t,"click",O),e._preventClick=!1})}})),qe=B.extend({options:{position:"topleft",zoomInText:'<span aria-hidden="true">+</span>',zoomInTitle:"Zoom in",zoomOutText:'<span aria-hidden="true">&#x2212;</span>',zoomOutTitle:"Zoom out"},onAdd:function(t){var e="leaflet-control-zoom",i=P("div",e+" leaflet-bar"),n=this.options;return this._zoomInButton=this._createButton(n.zoomInText,n.zoomInTitle,e+"-in",i,this._zoomIn),this._zoomOutButton=this._createButton(n.zoomOutText,n.zoomOutTitle,e+"-out",i,this._zoomOut),this._updateDisabled(),t.on("zoomend zoomlevelschange",this._updateDisabled,this),i},onRemove:function(t){t.off("zoomend zoomlevelschange",this._updateDisabled,this)},disable:function(){return this._disabled=!0,this._updateDisabled(),this},enable:function(){return this._disabled=!1,this._updateDisabled(),this},_zoomIn:function(t){!this._disabled&&this._map._zoom<this._map.getMaxZoom()&&this._map.zoomIn(this._map.options.zoomDelta*(t.shiftKey?3:1))},_zoomOut:function(t){!this._disabled&&this._map._zoom>this._map.getMinZoom()&&this._map.zoomOut(this._map.options.zoomDelta*(t.shiftKey?3:1))},_createButton:function(t,e,i,n,o){i=P("a",i,n);return i.innerHTML=t,i.href="#",i.title=e,i.setAttribute("role","button"),i.setAttribute("aria-label",e),Ie(i),S(i,"click",Re),S(i,"click",o,this),S(i,"click",this._refocusOnMap,this),i},_updateDisabled:function(){var t=this._map,e="leaflet-disabled";z(this._zoomInButton,e),z(this._zoomOutButton,e),this._zoomInButton.setAttribute("aria-disabled","false"),this._zoomOutButton.setAttribute("aria-disabled","false"),!this._disabled&&t._zoom!==t.getMinZoom()||(M(this._zoomOutButton,e),this._zoomOutButton.setAttribute("aria-disabled","true")),!this._disabled&&t._zoom!==t.getMaxZoom()||(M(this._zoomInButton,e),this._zoomInButton.setAttribute("aria-disabled","true"))}}),Ge=(A.mergeOptions({zoomControl:!0}),A.addInitHook(function(){this.options.zoomControl&&(this.zoomControl=new qe,this.addControl(this.zoomControl))}),B.extend({options:{position:"bottomleft",maxWidth:100,metric:!0,imperial:!0},onAdd:function(t){var e="leaflet-control-scale",i=P("div",e),n=this.options;return this._addScales(n,e+"-line",i),t.on(n.updateWhenIdle?"moveend":"move",this._update,this),t.whenReady(this._update,this),i},onRemove:function(t){t.off(this.options.updateWhenIdle?"moveend":"move",this._update,this)},_addScales:function(t,e,i){t.metric&&(this._mScale=P("div",e,i)),t.imperial&&(this._iScale=P("div",e,i))},_update:function(){var t=this._map,e=t.getSize().y/2,t=t.distance(t.containerPointToLatLng([0,e]),t.containerPointToLatLng([this.options.maxWidth,e]));this._updateScales(t)},_updateScales:function(t){this.options.metric&&t&&this._updateMetric(t),this.options.imperial&&t&&this._updateImperial(t)},_updateMetric:function(t){var e=this._getRoundNum(t);this._updateScale(this._mScale,e<1e3?e+" m":e/1e3+" km",e/t)},_updateImperial:function(t){var e,i,t=3.2808399*t;5280<t?(i=this._getRoundNum(e=t/5280),this._updateScale(this._iScale,i+" mi",i/e)):(i=this._getRoundNum(t),this._updateScale(this._iScale,i+" ft",i/t))},_updateScale:function(t,e,i){t.style.width=Math.round(this.options.maxWidth*i)+"px",t.innerHTML=e},_getRoundNum:function(t){var e=Math.pow(10,(Math.floor(t)+"").length-1),t=t/e;return e*(t=10<=t?10:5<=t?5:3<=t?3:2<=t?2:1)}})),Ke=B.extend({options:{position:"bottomright",prefix:'<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">'+(b.inlineSvg?'<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" class="leaflet-attribution-flag"><path fill="#4C7BE1" d="M0 0h12v4H0z"/><path fill="#FFD500" d="M0 4h12v3H0z"/><path fill="#E0BC00" d="M0 7h12v1H0z"/></svg> ':"")+"Leaflet</a>"},initialize:function(t){c(this,t),this._attributions={}},onAdd:function(t){for(var e in(t.attributionControl=this)._container=P("div","leaflet-control-attribution"),Ie(this._container),t._layers)t._layers[e].getAttribution&&this.addAttribution(t._layers[e].getAttribution());return this._update(),t.on("layeradd",this._addAttribution,this),this._container},onRemove:function(t){t.off("layeradd",this._addAttribution,this)},_addAttribution:function(t){t.layer.getAttribution&&(this.addAttribution(t.layer.getAttribution()),t.layer.once("remove",function(){this.removeAttribution(t.layer.getAttribution())},this))},setPrefix:function(t){return this.options.prefix=t,this._update(),this},addAttribution:function(t){return t&&(this._attributions[t]||(this._attributions[t]=0),this._attributions[t]++,this._update()),this},removeAttribution:function(t){return t&&this._attributions[t]&&(this._attributions[t]--,this._update()),this},_update:function(){if(this._map){var t,e=[];for(t in this._attributions)this._attributions[t]&&e.push(t);var i=[];this.options.prefix&&i.push(this.options.prefix),e.length&&i.push(e.join(", ")),this._container.innerHTML=i.join(' <span aria-hidden="true">|</span> ')}}}),n=(A.mergeOptions({attributionControl:!0}),A.addInitHook(function(){this.options.attributionControl&&(new Ke).addTo(this)}),B.Layers=Ve,B.Zoom=qe,B.Scale=Ge,B.Attribution=Ke,Ue.layers=function(t,e,i){return new Ve(t,e,i)},Ue.zoom=function(t){return new qe(t)},Ue.scale=function(t){return new Ge(t)},Ue.attribution=function(t){return new Ke(t)},et.extend({initialize:function(t){this._map=t},enable:function(){return this._enabled||(this._enabled=!0,this.addHooks()),this},disable:function(){return this._enabled&&(this._enabled=!1,this.removeHooks()),this},enabled:function(){return!!this._enabled}})),ft=(n.addTo=function(t,e){return t.addHandler(e,this),this},{Events:e}),Ye=b.touch?"touchstart mousedown":"mousedown",Xe=it.extend({options:{clickTolerance:3},initialize:function(t,e,i,n){c(this,n),this._element=t,this._dragStartTarget=e||t,this._preventOutline=i},enable:function(){this._enabled||(S(this._dragStartTarget,Ye,this._onDown,this),this._enabled=!0)},disable:function(){this._enabled&&(Xe._dragging===this&&this.finishDrag(!0),k(this._dragStartTarget,Ye,this._onDown,this),this._enabled=!1,this._moved=!1)},_onDown:function(t){var e,i;this._enabled&&(this._moved=!1,ve(this._element,"leaflet-zoom-anim")||(t.touches&&1!==t.touches.length?Xe._dragging===this&&this.finishDrag():Xe._dragging||t.shiftKey||1!==t.which&&1!==t.button&&!t.touches||((Xe._dragging=this)._preventOutline&&Me(this._element),Le(),re(),this._moving||(this.fire("down"),i=t.touches?t.touches[0]:t,e=Ce(this._element),this._startPoint=new p(i.clientX,i.clientY),this._startPos=Pe(this._element),this._parentScale=Ze(e),i="mousedown"===t.type,S(document,i?"mousemove":"touchmove",this._onMove,this),S(document,i?"mouseup":"touchend touchcancel",this._onUp,this)))))},_onMove:function(t){var e;this._enabled&&(t.touches&&1<t.touches.length?this._moved=!0:!(e=new p((e=t.touches&&1===t.touches.length?t.touches[0]:t).clientX,e.clientY)._subtract(this._startPoint)).x&&!e.y||Math.abs(e.x)+Math.abs(e.y)<this.options.clickTolerance||(e.x/=this._parentScale.x,e.y/=this._parentScale.y,O(t),this._moved||(this.fire("dragstart"),this._moved=!0,M(document.body,"leaflet-dragging"),this._lastTarget=t.target||t.srcElement,window.SVGElementInstance&&this._lastTarget instanceof window.SVGElementInstance&&(this._lastTarget=this._lastTarget.correspondingUseElement),M(this._lastTarget,"leaflet-drag-target")),this._newPos=this._startPos.add(e),this._moving=!0,this._lastEvent=t,this._updatePosition()))},_updatePosition:function(){var t={originalEvent:this._lastEvent};this.fire("predrag",t),Z(this._element,this._newPos),this.fire("drag",t)},_onUp:function(){this._enabled&&this.finishDrag()},finishDrag:function(t){z(document.body,"leaflet-dragging"),this._lastTarget&&(z(this._lastTarget,"leaflet-drag-target"),this._lastTarget=null),k(document,"mousemove touchmove",this._onMove,this),k(document,"mouseup touchend touchcancel",this._onUp,this),Te(),ae();var e=this._moved&&this._moving;this._moving=!1,Xe._dragging=!1,e&&this.fire("dragend",{noInertia:t,distance:this._newPos.distanceTo(this._startPos)})}});function Je(t,e,i){for(var n,o,s,r,a,h,l,u=[1,4,2,8],c=0,d=t.length;c<d;c++)t[c]._code=si(t[c],e);for(s=0;s<4;s++){for(h=u[s],n=[],c=0,o=(d=t.length)-1;c<d;o=c++)r=t[c],a=t[o],r._code&h?a._code&h||((l=oi(a,r,h,e,i))._code=si(l,e),n.push(l)):(a._code&h&&((l=oi(a,r,h,e,i))._code=si(l,e),n.push(l)),n.push(r));t=n}return t}function $e(t,e){var i,n,o,s,r,a,h;if(!t||0===t.length)throw new Error("latlngs not passed");I(t)||(console.warn("latlngs are not flat! Only the first ring will be used"),t=t[0]);for(var l=w([0,0]),u=g(t),c=(u.getNorthWest().distanceTo(u.getSouthWest())*u.getNorthEast().distanceTo(u.getNorthWest())<1700&&(l=Qe(t)),t.length),d=[],_=0;_<c;_++){var p=w(t[_]);d.push(e.project(w([p.lat-l.lat,p.lng-l.lng])))}for(_=r=a=h=0,i=c-1;_<c;i=_++)n=d[_],o=d[i],s=n.y*o.x-o.y*n.x,a+=(n.x+o.x)*s,h+=(n.y+o.y)*s,r+=3*s;u=0===r?d[0]:[a/r,h/r],u=e.unproject(m(u));return w([u.lat+l.lat,u.lng+l.lng])}function Qe(t){for(var e=0,i=0,n=0,o=0;o<t.length;o++){var s=w(t[o]);e+=s.lat,i+=s.lng,n++}return w([e/n,i/n])}var ti,gt={__proto__:null,clipPolygon:Je,polygonCenter:$e,centroid:Qe};function ei(t,e){if(e&&t.length){var i=t=function(t,e){for(var i=[t[0]],n=1,o=0,s=t.length;n<s;n++)(function(t,e){var i=e.x-t.x,e=e.y-t.y;return i*i+e*e})(t[n],t[o])>e&&(i.push(t[n]),o=n);o<s-1&&i.push(t[s-1]);return i}(t,e=e*e),n=i.length,o=new(typeof Uint8Array!=void 0+""?Uint8Array:Array)(n);o[0]=o[n-1]=1,function t(e,i,n,o,s){var r,a,h,l=0;for(a=o+1;a<=s-1;a++)h=ri(e[a],e[o],e[s],!0),l<h&&(r=a,l=h);n<l&&(i[r]=1,t(e,i,n,o,r),t(e,i,n,r,s))}(i,o,e,0,n-1);var s,r=[];for(s=0;s<n;s++)o[s]&&r.push(i[s]);return r}return t.slice()}function ii(t,e,i){return Math.sqrt(ri(t,e,i,!0))}function ni(t,e,i,n,o){var s,r,a,h=n?ti:si(t,i),l=si(e,i);for(ti=l;;){if(!(h|l))return[t,e];if(h&l)return!1;a=si(r=oi(t,e,s=h||l,i,o),i),s===h?(t=r,h=a):(e=r,l=a)}}function oi(t,e,i,n,o){var s,r,a=e.x-t.x,e=e.y-t.y,h=n.min,n=n.max;return 8&i?(s=t.x+a*(n.y-t.y)/e,r=n.y):4&i?(s=t.x+a*(h.y-t.y)/e,r=h.y):2&i?(s=n.x,r=t.y+e*(n.x-t.x)/a):1&i&&(s=h.x,r=t.y+e*(h.x-t.x)/a),new p(s,r,o)}function si(t,e){var i=0;return t.x<e.min.x?i|=1:t.x>e.max.x&&(i|=2),t.y<e.min.y?i|=4:t.y>e.max.y&&(i|=8),i}function ri(t,e,i,n){var o=e.x,e=e.y,s=i.x-o,r=i.y-e,a=s*s+r*r;return 0<a&&(1<(a=((t.x-o)*s+(t.y-e)*r)/a)?(o=i.x,e=i.y):0<a&&(o+=s*a,e+=r*a)),s=t.x-o,r=t.y-e,n?s*s+r*r:new p(o,e)}function I(t){return!d(t[0])||"object"!=typeof t[0][0]&&void 0!==t[0][0]}function ai(t){return console.warn("Deprecated use of _flat, please use L.LineUtil.isFlat instead."),I(t)}function hi(t,e){var i,n,o,s,r,a;if(!t||0===t.length)throw new Error("latlngs not passed");I(t)||(console.warn("latlngs are not flat! Only the first ring will be used"),t=t[0]);for(var h=w([0,0]),l=g(t),u=(l.getNorthWest().distanceTo(l.getSouthWest())*l.getNorthEast().distanceTo(l.getNorthWest())<1700&&(h=Qe(t)),t.length),c=[],d=0;d<u;d++){var _=w(t[d]);c.push(e.project(w([_.lat-h.lat,_.lng-h.lng])))}for(i=d=0;d<u-1;d++)i+=c[d].distanceTo(c[d+1])/2;if(0===i)a=c[0];else for(n=d=0;d<u-1;d++)if(o=c[d],s=c[d+1],i<(n+=r=o.distanceTo(s))){a=[s.x-(r=(n-i)/r)*(s.x-o.x),s.y-r*(s.y-o.y)];break}l=e.unproject(m(a));return w([l.lat+h.lat,l.lng+h.lng])}var vt={__proto__:null,simplify:ei,pointToSegmentDistance:ii,closestPointOnSegment:function(t,e,i){return ri(t,e,i)},clipSegment:ni,_getEdgeIntersection:oi,_getBitCode:si,_sqClosestPointOnSegment:ri,isFlat:I,_flat:ai,polylineCenter:hi},yt={project:function(t){return new p(t.lng,t.lat)},unproject:function(t){return new v(t.y,t.x)},bounds:new f([-180,-90],[180,90])},xt={R:6378137,R_MINOR:6356752.314245179,bounds:new f([-20037508.34279,-15496570.73972],[20037508.34279,18764656.23138]),project:function(t){var e=Math.PI/180,i=this.R,n=t.lat*e,o=this.R_MINOR/i,o=Math.sqrt(1-o*o),s=o*Math.sin(n),s=Math.tan(Math.PI/4-n/2)/Math.pow((1-s)/(1+s),o/2),n=-i*Math.log(Math.max(s,1e-10));return new p(t.lng*e*i,n)},unproject:function(t){for(var e,i=180/Math.PI,n=this.R,o=this.R_MINOR/n,s=Math.sqrt(1-o*o),r=Math.exp(-t.y/n),a=Math.PI/2-2*Math.atan(r),h=0,l=.1;h<15&&1e-7<Math.abs(l);h++)e=s*Math.sin(a),e=Math.pow((1-e)/(1+e),s/2),a+=l=Math.PI/2-2*Math.atan(r*e)-a;return new v(a*i,t.x*i/n)}},wt={__proto__:null,LonLat:yt,Mercator:xt,SphericalMercator:rt},Pt=l({},st,{code:"EPSG:3395",projection:xt,transformation:ht(bt=.5/(Math.PI*xt.R),.5,-bt,.5)}),li=l({},st,{code:"EPSG:4326",projection:yt,transformation:ht(1/180,1,-1/180,.5)}),Lt=l({},ot,{projection:yt,transformation:ht(1,0,-1,0),scale:function(t){return Math.pow(2,t)},zoom:function(t){return Math.log(t)/Math.LN2},distance:function(t,e){var i=e.lng-t.lng,e=e.lat-t.lat;return Math.sqrt(i*i+e*e)},infinite:!0}),o=(ot.Earth=st,ot.EPSG3395=Pt,ot.EPSG3857=lt,ot.EPSG900913=ut,ot.EPSG4326=li,ot.Simple=Lt,it.extend({options:{pane:"overlayPane",attribution:null,bubblingMouseEvents:!0},addTo:function(t){return t.addLayer(this),this},remove:function(){return this.removeFrom(this._map||this._mapToAdd)},removeFrom:function(t){return t&&t.removeLayer(this),this},getPane:function(t){return this._map.getPane(t?this.options[t]||t:this.options.pane)},addInteractiveTarget:function(t){return this._map._targets[h(t)]=this},removeInteractiveTarget:function(t){return delete this._map._targets[h(t)],this},getAttribution:function(){return this.options.attribution},_layerAdd:function(t){var e,i=t.target;i.hasLayer(this)&&(this._map=i,this._zoomAnimated=i._zoomAnimated,this.getEvents&&(e=this.getEvents(),i.on(e,this),this.once("remove",function(){i.off(e,this)},this)),this.onAdd(i),this.fire("add"),i.fire("layeradd",{layer:this}))}})),ui=(A.include({addLayer:function(t){var e;if(t._layerAdd)return e=h(t),this._layers[e]||((this._layers[e]=t)._mapToAdd=this,t.beforeAdd&&t.beforeAdd(this),this.whenReady(t._layerAdd,t)),this;throw new Error("The provided object is not a Layer.")},removeLayer:function(t){var e=h(t);return this._layers[e]&&(this._loaded&&t.onRemove(this),delete this._layers[e],this._loaded&&(this.fire("layerremove",{layer:t}),t.fire("remove")),t._map=t._mapToAdd=null),this},hasLayer:function(t){return h(t)in this._layers},eachLayer:function(t,e){for(var i in this._layers)t.call(e,this._layers[i]);return this},_addLayers:function(t){for(var e=0,i=(t=t?d(t)?t:[t]:[]).length;e<i;e++)this.addLayer(t[e])},_addZoomLimit:function(t){isNaN(t.options.maxZoom)&&isNaN(t.options.minZoom)||(this._zoomBoundLayers[h(t)]=t,this._updateZoomLevels())},_removeZoomLimit:function(t){t=h(t);this._zoomBoundLayers[t]&&(delete this._zoomBoundLayers[t],this._updateZoomLevels())},_updateZoomLevels:function(){var t,e=1/0,i=-1/0,n=this._getZoomSpan();for(t in this._zoomBoundLayers)var o=this._zoomBoundLayers[t].options,e=void 0===o.minZoom?e:Math.min(e,o.minZoom),i=void 0===o.maxZoom?i:Math.max(i,o.maxZoom);this._layersMaxZoom=i===-1/0?void 0:i,this._layersMinZoom=e===1/0?void 0:e,n!==this._getZoomSpan()&&this.fire("zoomlevelschange"),void 0===this.options.maxZoom&&this._layersMaxZoom&&this.getZoom()>this._layersMaxZoom&&this.setZoom(this._layersMaxZoom),void 0===this.options.minZoom&&this._layersMinZoom&&this.getZoom()<this._layersMinZoom&&this.setZoom(this._layersMinZoom)}}),o.extend({initialize:function(t,e){var i,n;if(c(this,e),this._layers={},t)for(i=0,n=t.length;i<n;i++)this.addLayer(t[i])},addLayer:function(t){var e=this.getLayerId(t);return this._layers[e]=t,this._map&&this._map.addLayer(t),this},removeLayer:function(t){t=t in this._layers?t:this.getLayerId(t);return this._map&&this._layers[t]&&this._map.removeLayer(this._layers[t]),delete this._layers[t],this},hasLayer:function(t){return("number"==typeof t?t:this.getLayerId(t))in this._layers},clearLayers:function(){return this.eachLayer(this.removeLayer,this)},invoke:function(t){var e,i,n=Array.prototype.slice.call(arguments,1);for(e in this._layers)(i=this._layers[e])[t]&&i[t].apply(i,n);return this},onAdd:function(t){this.eachLayer(t.addLayer,t)},onRemove:function(t){this.eachLayer(t.removeLayer,t)},eachLayer:function(t,e){for(var i in this._layers)t.call(e,this._layers[i]);return this},getLayer:function(t){return this._layers[t]},getLayers:function(){var t=[];return this.eachLayer(t.push,t),t},setZIndex:function(t){return this.invoke("setZIndex",t)},getLayerId:h})),ci=ui.extend({addLayer:function(t){return this.hasLayer(t)?this:(t.addEventParent(this),ui.prototype.addLayer.call(this,t),this.fire("layeradd",{layer:t}))},removeLayer:function(t){return this.hasLayer(t)?((t=t in this._layers?this._layers[t]:t).removeEventParent(this),ui.prototype.removeLayer.call(this,t),this.fire("layerremove",{layer:t})):this},setStyle:function(t){return this.invoke("setStyle",t)},bringToFront:function(){return this.invoke("bringToFront")},bringToBack:function(){return this.invoke("bringToBack")},getBounds:function(){var t,e=new s;for(t in this._layers){var i=this._layers[t];e.extend(i.getBounds?i.getBounds():i.getLatLng())}return e}}),di=et.extend({options:{popupAnchor:[0,0],tooltipAnchor:[0,0],crossOrigin:!1},initialize:function(t){c(this,t)},createIcon:function(t){return this._createIcon("icon",t)},createShadow:function(t){return this._createIcon("shadow",t)},_createIcon:function(t,e){var i=this._getIconUrl(t);if(i)return i=this._createImg(i,e&&"IMG"===e.tagName?e:null),this._setIconStyles(i,t),!this.options.crossOrigin&&""!==this.options.crossOrigin||(i.crossOrigin=!0===this.options.crossOrigin?"":this.options.crossOrigin),i;if("icon"===t)throw new Error("iconUrl not set in Icon options (see the docs).");return null},_setIconStyles:function(t,e){var i=this.options,n=i[e+"Size"],n=m(n="number"==typeof n?[n,n]:n),o=m("shadow"===e&&i.shadowAnchor||i.iconAnchor||n&&n.divideBy(2,!0));t.className="leaflet-marker-"+e+" "+(i.className||""),o&&(t.style.marginLeft=-o.x+"px",t.style.marginTop=-o.y+"px"),n&&(t.style.width=n.x+"px",t.style.height=n.y+"px")},_createImg:function(t,e){return(e=e||document.createElement("img")).src=t,e},_getIconUrl:function(t){return b.retina&&this.options[t+"RetinaUrl"]||this.options[t+"Url"]}});var _i=di.extend({options:{iconUrl:"marker-icon.png",iconRetinaUrl:"marker-icon-2x.png",shadowUrl:"marker-shadow.png",iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],tooltipAnchor:[16,-28],shadowSize:[41,41]},_getIconUrl:function(t){return"string"!=typeof _i.imagePath&&(_i.imagePath=this._detectIconPath()),(this.options.imagePath||_i.imagePath)+di.prototype._getIconUrl.call(this,t)},_stripUrl:function(t){function e(t,e,i){return(e=e.exec(t))&&e[i]}return(t=e(t,/^url\((['"])?(.+)\1\)$/,2))&&e(t,/^(.*)marker-icon\.png$/,1)},_detectIconPath:function(){var t=P("div","leaflet-default-icon-path",document.body),e=pe(t,"background-image")||pe(t,"backgroundImage");return document.body.removeChild(t),(e=this._stripUrl(e))?e:(t=document.querySelector('link[href$="leaflet.css"]'))?t.href.substring(0,t.href.length-"leaflet.css".length-1):""}}),pi=n.extend({initialize:function(t){this._marker=t},addHooks:function(){var t=this._marker._icon;this._draggable||(this._draggable=new Xe(t,t,!0)),this._draggable.on({dragstart:this._onDragStart,predrag:this._onPreDrag,drag:this._onDrag,dragend:this._onDragEnd},this).enable(),M(t,"leaflet-marker-draggable")},removeHooks:function(){this._draggable.off({dragstart:this._onDragStart,predrag:this._onPreDrag,drag:this._onDrag,dragend:this._onDragEnd},this).disable(),this._marker._icon&&z(this._marker._icon,"leaflet-marker-draggable")},moved:function(){return this._draggable&&this._draggable._moved},_adjustPan:function(t){var e=this._marker,i=e._map,n=this._marker.options.autoPanSpeed,o=this._marker.options.autoPanPadding,s=Pe(e._icon),r=i.getPixelBounds(),a=i.getPixelOrigin(),a=_(r.min._subtract(a).add(o),r.max._subtract(a).subtract(o));a.contains(s)||(o=m((Math.max(a.max.x,s.x)-a.max.x)/(r.max.x-a.max.x)-(Math.min(a.min.x,s.x)-a.min.x)/(r.min.x-a.min.x),(Math.max(a.max.y,s.y)-a.max.y)/(r.max.y-a.max.y)-(Math.min(a.min.y,s.y)-a.min.y)/(r.min.y-a.min.y)).multiplyBy(n),i.panBy(o,{animate:!1}),this._draggable._newPos._add(o),this._draggable._startPos._add(o),Z(e._icon,this._draggable._newPos),this._onDrag(t),this._panRequest=x(this._adjustPan.bind(this,t)))},_onDragStart:function(){this._oldLatLng=this._marker.getLatLng(),this._marker.closePopup&&this._marker.closePopup(),this._marker.fire("movestart").fire("dragstart")},_onPreDrag:function(t){this._marker.options.autoPan&&(r(this._panRequest),this._panRequest=x(this._adjustPan.bind(this,t)))},_onDrag:function(t){var e=this._marker,i=e._shadow,n=Pe(e._icon),o=e._map.layerPointToLatLng(n);i&&Z(i,n),e._latlng=o,t.latlng=o,t.oldLatLng=this._oldLatLng,e.fire("move",t).fire("drag",t)},_onDragEnd:function(t){r(this._panRequest),delete this._oldLatLng,this._marker.fire("moveend").fire("dragend",t)}}),mi=o.extend({options:{icon:new _i,interactive:!0,keyboard:!0,title:"",alt:"Marker",zIndexOffset:0,opacity:1,riseOnHover:!1,riseOffset:250,pane:"markerPane",shadowPane:"shadowPane",bubblingMouseEvents:!1,autoPanOnFocus:!0,draggable:!1,autoPan:!1,autoPanPadding:[50,50],autoPanSpeed:10},initialize:function(t,e){c(this,e),this._latlng=w(t)},onAdd:function(t){this._zoomAnimated=this._zoomAnimated&&t.options.markerZoomAnimation,this._zoomAnimated&&t.on("zoomanim",this._animateZoom,this),this._initIcon(),this.update()},onRemove:function(t){this.dragging&&this.dragging.enabled()&&(this.options.draggable=!0,this.dragging.removeHooks()),delete this.dragging,this._zoomAnimated&&t.off("zoomanim",this._animateZoom,this),this._removeIcon(),this._removeShadow()},getEvents:function(){return{zoom:this.update,viewreset:this.update}},getLatLng:function(){return this._latlng},setLatLng:function(t){var e=this._latlng;return this._latlng=w(t),this.update(),this.fire("move",{oldLatLng:e,latlng:this._latlng})},setZIndexOffset:function(t){return this.options.zIndexOffset=t,this.update()},getIcon:function(){return this.options.icon},setIcon:function(t){return this.options.icon=t,this._map&&(this._initIcon(),this.update()),this._popup&&this.bindPopup(this._popup,this._popup.options),this},getElement:function(){return this._icon},update:function(){var t;return this._icon&&this._map&&(t=this._map.latLngToLayerPoint(this._latlng).round(),this._setPos(t)),this},_initIcon:function(){var t=this.options,e="leaflet-zoom-"+(this._zoomAnimated?"animated":"hide"),i=t.icon.createIcon(this._icon),n=!1,i=(i!==this._icon&&(this._icon&&this._removeIcon(),n=!0,t.title&&(i.title=t.title),"IMG"===i.tagName&&(i.alt=t.alt||"")),M(i,e),t.keyboard&&(i.tabIndex="0",i.setAttribute("role","button")),this._icon=i,t.riseOnHover&&this.on({mouseover:this._bringToFront,mouseout:this._resetZIndex}),this.options.autoPanOnFocus&&S(i,"focus",this._panOnFocus,this),t.icon.createShadow(this._shadow)),o=!1;i!==this._shadow&&(this._removeShadow(),o=!0),i&&(M(i,e),i.alt=""),this._shadow=i,t.opacity<1&&this._updateOpacity(),n&&this.getPane().appendChild(this._icon),this._initInteraction(),i&&o&&this.getPane(t.shadowPane).appendChild(this._shadow)},_removeIcon:function(){this.options.riseOnHover&&this.off({mouseover:this._bringToFront,mouseout:this._resetZIndex}),this.options.autoPanOnFocus&&k(this._icon,"focus",this._panOnFocus,this),T(this._icon),this.removeInteractiveTarget(this._icon),this._icon=null},_removeShadow:function(){this._shadow&&T(this._shadow),this._shadow=null},_setPos:function(t){this._icon&&Z(this._icon,t),this._shadow&&Z(this._shadow,t),this._zIndex=t.y+this.options.zIndexOffset,this._resetZIndex()},_updateZIndex:function(t){this._icon&&(this._icon.style.zIndex=this._zIndex+t)},_animateZoom:function(t){t=this._map._latLngToNewLayerPoint(this._latlng,t.zoom,t.center).round();this._setPos(t)},_initInteraction:function(){var t;this.options.interactive&&(M(this._icon,"leaflet-interactive"),this.addInteractiveTarget(this._icon),pi&&(t=this.options.draggable,this.dragging&&(t=this.dragging.enabled(),this.dragging.disable()),this.dragging=new pi(this),t&&this.dragging.enable()))},setOpacity:function(t){return this.options.opacity=t,this._map&&this._updateOpacity(),this},_updateOpacity:function(){var t=this.options.opacity;this._icon&&C(this._icon,t),this._shadow&&C(this._shadow,t)},_bringToFront:function(){this._updateZIndex(this.options.riseOffset)},_resetZIndex:function(){this._updateZIndex(0)},_panOnFocus:function(){var t,e,i=this._map;i&&(t=(e=this.options.icon.options).iconSize?m(e.iconSize):m(0,0),e=e.iconAnchor?m(e.iconAnchor):m(0,0),i.panInside(this._latlng,{paddingTopLeft:e,paddingBottomRight:t.subtract(e)}))},_getPopupAnchor:function(){return this.options.icon.options.popupAnchor},_getTooltipAnchor:function(){return this.options.icon.options.tooltipAnchor}});var fi=o.extend({options:{stroke:!0,color:"#3388ff",weight:3,opacity:1,lineCap:"round",lineJoin:"round",dashArray:null,dashOffset:null,fill:!1,fillColor:null,fillOpacity:.2,fillRule:"evenodd",interactive:!0,bubblingMouseEvents:!0},beforeAdd:function(t){this._renderer=t.getRenderer(this)},onAdd:function(){this._renderer._initPath(this),this._reset(),this._renderer._addPath(this)},onRemove:function(){this._renderer._removePath(this)},redraw:function(){return this._map&&this._renderer._updatePath(this),this},setStyle:function(t){return c(this,t),this._renderer&&(this._renderer._updateStyle(this),this.options.stroke&&t&&Object.prototype.hasOwnProperty.call(t,"weight")&&this._updateBounds()),this},bringToFront:function(){return this._renderer&&this._renderer._bringToFront(this),this},bringToBack:function(){return this._renderer&&this._renderer._bringToBack(this),this},getElement:function(){return this._path},_reset:function(){this._project(),this._update()},_clickTolerance:function(){return(this.options.stroke?this.options.weight/2:0)+(this._renderer.options.tolerance||0)}}),gi=fi.extend({options:{fill:!0,radius:10},initialize:function(t,e){c(this,e),this._latlng=w(t),this._radius=this.options.radius},setLatLng:function(t){var e=this._latlng;return this._latlng=w(t),this.redraw(),this.fire("move",{oldLatLng:e,latlng:this._latlng})},getLatLng:function(){return this._latlng},setRadius:function(t){return this.options.radius=this._radius=t,this.redraw()},getRadius:function(){return this._radius},setStyle:function(t){var e=t&&t.radius||this._radius;return fi.prototype.setStyle.call(this,t),this.setRadius(e),this},_project:function(){this._point=this._map.latLngToLayerPoint(this._latlng),this._updateBounds()},_updateBounds:function(){var t=this._radius,e=this._radiusY||t,i=this._clickTolerance(),t=[t+i,e+i];this._pxBounds=new f(this._point.subtract(t),this._point.add(t))},_update:function(){this._map&&this._updatePath()},_updatePath:function(){this._renderer._updateCircle(this)},_empty:function(){return this._radius&&!this._renderer._bounds.intersects(this._pxBounds)},_containsPoint:function(t){return t.distanceTo(this._point)<=this._radius+this._clickTolerance()}});var vi=gi.extend({initialize:function(t,e,i){if(c(this,e="number"==typeof e?l({},i,{radius:e}):e),this._latlng=w(t),isNaN(this.options.radius))throw new Error("Circle radius cannot be NaN");this._mRadius=this.options.radius},setRadius:function(t){return this._mRadius=t,this.redraw()},getRadius:function(){return this._mRadius},getBounds:function(){var t=[this._radius,this._radiusY||this._radius];return new s(this._map.layerPointToLatLng(this._point.subtract(t)),this._map.layerPointToLatLng(this._point.add(t)))},setStyle:fi.prototype.setStyle,_project:function(){var t,e,i,n,o,s=this._latlng.lng,r=this._latlng.lat,a=this._map,h=a.options.crs;h.distance===st.distance?(n=Math.PI/180,o=this._mRadius/st.R/n,t=a.project([r+o,s]),e=a.project([r-o,s]),e=t.add(e).divideBy(2),i=a.unproject(e).lat,n=Math.acos((Math.cos(o*n)-Math.sin(r*n)*Math.sin(i*n))/(Math.cos(r*n)*Math.cos(i*n)))/n,!isNaN(n)&&0!==n||(n=o/Math.cos(Math.PI/180*r)),this._point=e.subtract(a.getPixelOrigin()),this._radius=isNaN(n)?0:e.x-a.project([i,s-n]).x,this._radiusY=e.y-t.y):(o=h.unproject(h.project(this._latlng).subtract([this._mRadius,0])),this._point=a.latLngToLayerPoint(this._latlng),this._radius=this._point.x-a.latLngToLayerPoint(o).x),this._updateBounds()}});var yi=fi.extend({options:{smoothFactor:1,noClip:!1},initialize:function(t,e){c(this,e),this._setLatLngs(t)},getLatLngs:function(){return this._latlngs},setLatLngs:function(t){return this._setLatLngs(t),this.redraw()},isEmpty:function(){return!this._latlngs.length},closestLayerPoint:function(t){for(var e=1/0,i=null,n=ri,o=0,s=this._parts.length;o<s;o++)for(var r=this._parts[o],a=1,h=r.length;a<h;a++){var l,u,c=n(t,l=r[a-1],u=r[a],!0);c<e&&(e=c,i=n(t,l,u))}return i&&(i.distance=Math.sqrt(e)),i},getCenter:function(){if(this._map)return hi(this._defaultShape(),this._map.options.crs);throw new Error("Must add layer to map before using getCenter()")},getBounds:function(){return this._bounds},addLatLng:function(t,e){return e=e||this._defaultShape(),t=w(t),e.push(t),this._bounds.extend(t),this.redraw()},_setLatLngs:function(t){this._bounds=new s,this._latlngs=this._convertLatLngs(t)},_defaultShape:function(){return I(this._latlngs)?this._latlngs:this._latlngs[0]},_convertLatLngs:function(t){for(var e=[],i=I(t),n=0,o=t.length;n<o;n++)i?(e[n]=w(t[n]),this._bounds.extend(e[n])):e[n]=this._convertLatLngs(t[n]);return e},_project:function(){var t=new f;this._rings=[],this._projectLatlngs(this._latlngs,this._rings,t),this._bounds.isValid()&&t.isValid()&&(this._rawPxBounds=t,this._updateBounds())},_updateBounds:function(){var t=this._clickTolerance(),t=new p(t,t);this._rawPxBounds&&(this._pxBounds=new f([this._rawPxBounds.min.subtract(t),this._rawPxBounds.max.add(t)]))},_projectLatlngs:function(t,e,i){var n,o,s=t[0]instanceof v,r=t.length;if(s){for(o=[],n=0;n<r;n++)o[n]=this._map.latLngToLayerPoint(t[n]),i.extend(o[n]);e.push(o)}else for(n=0;n<r;n++)this._projectLatlngs(t[n],e,i)},_clipPoints:function(){var t=this._renderer._bounds;if(this._parts=[],this._pxBounds&&this._pxBounds.intersects(t))if(this.options.noClip)this._parts=this._rings;else for(var e,i,n,o,s=this._parts,r=0,a=0,h=this._rings.length;r<h;r++)for(e=0,i=(o=this._rings[r]).length;e<i-1;e++)(n=ni(o[e],o[e+1],t,e,!0))&&(s[a]=s[a]||[],s[a].push(n[0]),n[1]===o[e+1]&&e!==i-2||(s[a].push(n[1]),a++))},_simplifyPoints:function(){for(var t=this._parts,e=this.options.smoothFactor,i=0,n=t.length;i<n;i++)t[i]=ei(t[i],e)},_update:function(){this._map&&(this._clipPoints(),this._simplifyPoints(),this._updatePath())},_updatePath:function(){this._renderer._updatePoly(this)},_containsPoint:function(t,e){var i,n,o,s,r,a,h=this._clickTolerance();if(this._pxBounds&&this._pxBounds.contains(t))for(i=0,s=this._parts.length;i<s;i++)for(n=0,o=(r=(a=this._parts[i]).length)-1;n<r;o=n++)if((e||0!==n)&&ii(t,a[o],a[n])<=h)return!0;return!1}});yi._flat=ai;var xi=yi.extend({options:{fill:!0},isEmpty:function(){return!this._latlngs.length||!this._latlngs[0].length},getCenter:function(){if(this._map)return $e(this._defaultShape(),this._map.options.crs);throw new Error("Must add layer to map before using getCenter()")},_convertLatLngs:function(t){var t=yi.prototype._convertLatLngs.call(this,t),e=t.length;return 2<=e&&t[0]instanceof v&&t[0].equals(t[e-1])&&t.pop(),t},_setLatLngs:function(t){yi.prototype._setLatLngs.call(this,t),I(this._latlngs)&&(this._latlngs=[this._latlngs])},_defaultShape:function(){return(I(this._latlngs[0])?this._latlngs:this._latlngs[0])[0]},_clipPoints:function(){var t=this._renderer._bounds,e=this.options.weight,e=new p(e,e),t=new f(t.min.subtract(e),t.max.add(e));if(this._parts=[],this._pxBounds&&this._pxBounds.intersects(t))if(this.options.noClip)this._parts=this._rings;else for(var i,n=0,o=this._rings.length;n<o;n++)(i=Je(this._rings[n],t,!0)).length&&this._parts.push(i)},_updatePath:function(){this._renderer._updatePoly(this,!0)},_containsPoint:function(t){var e,i,n,o,s,r,a,h,l=!1;if(!this._pxBounds||!this._pxBounds.contains(t))return!1;for(o=0,a=this._parts.length;o<a;o++)for(s=0,r=(h=(e=this._parts[o]).length)-1;s<h;r=s++)i=e[s],n=e[r],i.y>t.y!=n.y>t.y&&t.x<(n.x-i.x)*(t.y-i.y)/(n.y-i.y)+i.x&&(l=!l);return l||yi.prototype._containsPoint.call(this,t,!0)}});var wi=ci.extend({initialize:function(t,e){c(this,e),this._layers={},t&&this.addData(t)},addData:function(t){var e,i,n,o=d(t)?t:t.features;if(o){for(e=0,i=o.length;e<i;e++)((n=o[e]).geometries||n.geometry||n.features||n.coordinates)&&this.addData(n);return this}var s,r=this.options;return(!r.filter||r.filter(t))&&(s=bi(t,r))?(s.feature=Zi(t),s.defaultOptions=s.options,this.resetStyle(s),r.onEachFeature&&r.onEachFeature(t,s),this.addLayer(s)):this},resetStyle:function(t){return void 0===t?this.eachLayer(this.resetStyle,this):(t.options=l({},t.defaultOptions),this._setLayerStyle(t,this.options.style),this)},setStyle:function(e){return this.eachLayer(function(t){this._setLayerStyle(t,e)},this)},_setLayerStyle:function(t,e){t.setStyle&&("function"==typeof e&&(e=e(t.feature)),t.setStyle(e))}});function bi(t,e){var i,n,o,s,r="Feature"===t.type?t.geometry:t,a=r?r.coordinates:null,h=[],l=e&&e.pointToLayer,u=e&&e.coordsToLatLng||Li;if(!a&&!r)return null;switch(r.type){case"Point":return Pi(l,t,i=u(a),e);case"MultiPoint":for(o=0,s=a.length;o<s;o++)i=u(a[o]),h.push(Pi(l,t,i,e));return new ci(h);case"LineString":case"MultiLineString":return n=Ti(a,"LineString"===r.type?0:1,u),new yi(n,e);case"Polygon":case"MultiPolygon":return n=Ti(a,"Polygon"===r.type?1:2,u),new xi(n,e);case"GeometryCollection":for(o=0,s=r.geometries.length;o<s;o++){var c=bi({geometry:r.geometries[o],type:"Feature",properties:t.properties},e);c&&h.push(c)}return new ci(h);case"FeatureCollection":for(o=0,s=r.features.length;o<s;o++){var d=bi(r.features[o],e);d&&h.push(d)}return new ci(h);default:throw new Error("Invalid GeoJSON object.")}}function Pi(t,e,i,n){return t?t(e,i):new mi(i,n&&n.markersInheritOptions&&n)}function Li(t){return new v(t[1],t[0],t[2])}function Ti(t,e,i){for(var n,o=[],s=0,r=t.length;s<r;s++)n=e?Ti(t[s],e-1,i):(i||Li)(t[s]),o.push(n);return o}function Mi(t,e){return void 0!==(t=w(t)).alt?[i(t.lng,e),i(t.lat,e),i(t.alt,e)]:[i(t.lng,e),i(t.lat,e)]}function zi(t,e,i,n){for(var o=[],s=0,r=t.length;s<r;s++)o.push(e?zi(t[s],I(t[s])?0:e-1,i,n):Mi(t[s],n));return!e&&i&&0<o.length&&o.push(o[0].slice()),o}function Ci(t,e){return t.feature?l({},t.feature,{geometry:e}):Zi(e)}function Zi(t){return"Feature"===t.type||"FeatureCollection"===t.type?t:{type:"Feature",properties:{},geometry:t}}Tt={toGeoJSON:function(t){return Ci(this,{type:"Point",coordinates:Mi(this.getLatLng(),t)})}};function Si(t,e){return new wi(t,e)}mi.include(Tt),vi.include(Tt),gi.include(Tt),yi.include({toGeoJSON:function(t){var e=!I(this._latlngs);return Ci(this,{type:(e?"Multi":"")+"LineString",coordinates:zi(this._latlngs,e?1:0,!1,t)})}}),xi.include({toGeoJSON:function(t){var e=!I(this._latlngs),i=e&&!I(this._latlngs[0]),t=zi(this._latlngs,i?2:e?1:0,!0,t);return Ci(this,{type:(i?"Multi":"")+"Polygon",coordinates:t=e?t:[t]})}}),ui.include({toMultiPoint:function(e){var i=[];return this.eachLayer(function(t){i.push(t.toGeoJSON(e).geometry.coordinates)}),Ci(this,{type:"MultiPoint",coordinates:i})},toGeoJSON:function(e){var i,n,t=this.feature&&this.feature.geometry&&this.feature.geometry.type;return"MultiPoint"===t?this.toMultiPoint(e):(i="GeometryCollection"===t,n=[],this.eachLayer(function(t){t.toGeoJSON&&(t=t.toGeoJSON(e),i?n.push(t.geometry):"FeatureCollection"===(t=Zi(t)).type?n.push.apply(n,t.features):n.push(t))}),i?Ci(this,{geometries:n,type:"GeometryCollection"}):{type:"FeatureCollection",features:n})}});var Mt=Si,Ei=o.extend({options:{opacity:1,alt:"",interactive:!1,crossOrigin:!1,errorOverlayUrl:"",zIndex:1,className:""},initialize:function(t,e,i){this._url=t,this._bounds=g(e),c(this,i)},onAdd:function(){this._image||(this._initImage(),this.options.opacity<1&&this._updateOpacity()),this.options.interactive&&(M(this._image,"leaflet-interactive"),this.addInteractiveTarget(this._image)),this.getPane().appendChild(this._image),this._reset()},onRemove:function(){T(this._image),this.options.interactive&&this.removeInteractiveTarget(this._image)},setOpacity:function(t){return this.options.opacity=t,this._image&&this._updateOpacity(),this},setStyle:function(t){return t.opacity&&this.setOpacity(t.opacity),this},bringToFront:function(){return this._map&&fe(this._image),this},bringToBack:function(){return this._map&&ge(this._image),this},setUrl:function(t){return this._url=t,this._image&&(this._image.src=t),this},setBounds:function(t){return this._bounds=g(t),this._map&&this._reset(),this},getEvents:function(){var t={zoom:this._reset,viewreset:this._reset};return this._zoomAnimated&&(t.zoomanim=this._animateZoom),t},setZIndex:function(t){return this.options.zIndex=t,this._updateZIndex(),this},getBounds:function(){return this._bounds},getElement:function(){return this._image},_initImage:function(){var t="IMG"===this._url.tagName,e=this._image=t?this._url:P("img");M(e,"leaflet-image-layer"),this._zoomAnimated&&M(e,"leaflet-zoom-animated"),this.options.className&&M(e,this.options.className),e.onselectstart=u,e.onmousemove=u,e.onload=a(this.fire,this,"load"),e.onerror=a(this._overlayOnError,this,"error"),!this.options.crossOrigin&&""!==this.options.crossOrigin||(e.crossOrigin=!0===this.options.crossOrigin?"":this.options.crossOrigin),this.options.zIndex&&this._updateZIndex(),t?this._url=e.src:(e.src=this._url,e.alt=this.options.alt)},_animateZoom:function(t){var e=this._map.getZoomScale(t.zoom),t=this._map._latLngBoundsToNewLayerBounds(this._bounds,t.zoom,t.center).min;be(this._image,t,e)},_reset:function(){var t=this._image,e=new f(this._map.latLngToLayerPoint(this._bounds.getNorthWest()),this._map.latLngToLayerPoint(this._bounds.getSouthEast())),i=e.getSize();Z(t,e.min),t.style.width=i.x+"px",t.style.height=i.y+"px"},_updateOpacity:function(){C(this._image,this.options.opacity)},_updateZIndex:function(){this._image&&void 0!==this.options.zIndex&&null!==this.options.zIndex&&(this._image.style.zIndex=this.options.zIndex)},_overlayOnError:function(){this.fire("error");var t=this.options.errorOverlayUrl;t&&this._url!==t&&(this._url=t,this._image.src=t)},getCenter:function(){return this._bounds.getCenter()}}),ki=Ei.extend({options:{autoplay:!0,loop:!0,keepAspectRatio:!0,muted:!1,playsInline:!0},_initImage:function(){var t="VIDEO"===this._url.tagName,e=this._image=t?this._url:P("video");if(M(e,"leaflet-image-layer"),this._zoomAnimated&&M(e,"leaflet-zoom-animated"),this.options.className&&M(e,this.options.className),e.onselectstart=u,e.onmousemove=u,e.onloadeddata=a(this.fire,this,"load"),t){for(var i=e.getElementsByTagName("source"),n=[],o=0;o<i.length;o++)n.push(i[o].src);this._url=0<i.length?n:[e.src]}else{d(this._url)||(this._url=[this._url]),!this.options.keepAspectRatio&&Object.prototype.hasOwnProperty.call(e.style,"objectFit")&&(e.style.objectFit="fill"),e.autoplay=!!this.options.autoplay,e.loop=!!this.options.loop,e.muted=!!this.options.muted,e.playsInline=!!this.options.playsInline;for(var s=0;s<this._url.length;s++){var r=P("source");r.src=this._url[s],e.appendChild(r)}}}});var Oi=Ei.extend({_initImage:function(){var t=this._image=this._url;M(t,"leaflet-image-layer"),this._zoomAnimated&&M(t,"leaflet-zoom-animated"),this.options.className&&M(t,this.options.className),t.onselectstart=u,t.onmousemove=u}});var Ai=o.extend({options:{interactive:!1,offset:[0,0],className:"",pane:void 0,content:""},initialize:function(t,e){t&&(t instanceof v||d(t))?(this._latlng=w(t),c(this,e)):(c(this,t),this._source=e),this.options.content&&(this._content=this.options.content)},openOn:function(t){return(t=arguments.length?t:this._source._map).hasLayer(this)||t.addLayer(this),this},close:function(){return this._map&&this._map.removeLayer(this),this},toggle:function(t){return this._map?this.close():(arguments.length?this._source=t:t=this._source,this._prepareOpen(),this.openOn(t._map)),this},onAdd:function(t){this._zoomAnimated=t._zoomAnimated,this._container||this._initLayout(),t._fadeAnimated&&C(this._container,0),clearTimeout(this._removeTimeout),this.getPane().appendChild(this._container),this.update(),t._fadeAnimated&&C(this._container,1),this.bringToFront(),this.options.interactive&&(M(this._container,"leaflet-interactive"),this.addInteractiveTarget(this._container))},onRemove:function(t){t._fadeAnimated?(C(this._container,0),this._removeTimeout=setTimeout(a(T,void 0,this._container),200)):T(this._container),this.options.interactive&&(z(this._container,"leaflet-interactive"),this.removeInteractiveTarget(this._container))},getLatLng:function(){return this._latlng},setLatLng:function(t){return this._latlng=w(t),this._map&&(this._updatePosition(),this._adjustPan()),this},getContent:function(){return this._content},setContent:function(t){return this._content=t,this.update(),this},getElement:function(){return this._container},update:function(){this._map&&(this._container.style.visibility="hidden",this._updateContent(),this._updateLayout(),this._updatePosition(),this._container.style.visibility="",this._adjustPan())},getEvents:function(){var t={zoom:this._updatePosition,viewreset:this._updatePosition};return this._zoomAnimated&&(t.zoomanim=this._animateZoom),t},isOpen:function(){return!!this._map&&this._map.hasLayer(this)},bringToFront:function(){return this._map&&fe(this._container),this},bringToBack:function(){return this._map&&ge(this._container),this},_prepareOpen:function(t){if(!(i=this._source)._map)return!1;if(i instanceof ci){var e,i=null,n=this._source._layers;for(e in n)if(n[e]._map){i=n[e];break}if(!i)return!1;this._source=i}if(!t)if(i.getCenter)t=i.getCenter();else if(i.getLatLng)t=i.getLatLng();else{if(!i.getBounds)throw new Error("Unable to get source layer LatLng.");t=i.getBounds().getCenter()}return this.setLatLng(t),this._map&&this.update(),!0},_updateContent:function(){if(this._content){var t=this._contentNode,e="function"==typeof this._content?this._content(this._source||this):this._content;if("string"==typeof e)t.innerHTML=e;else{for(;t.hasChildNodes();)t.removeChild(t.firstChild);t.appendChild(e)}this.fire("contentupdate")}},_updatePosition:function(){var t,e,i;this._map&&(e=this._map.latLngToLayerPoint(this._latlng),t=m(this.options.offset),i=this._getAnchor(),this._zoomAnimated?Z(this._container,e.add(i)):t=t.add(e).add(i),e=this._containerBottom=-t.y,i=this._containerLeft=-Math.round(this._containerWidth/2)+t.x,this._container.style.bottom=e+"px",this._container.style.left=i+"px")},_getAnchor:function(){return[0,0]}}),Bi=(A.include({_initOverlay:function(t,e,i,n){var o=e;return o instanceof t||(o=new t(n).setContent(e)),i&&o.setLatLng(i),o}}),o.include({_initOverlay:function(t,e,i,n){var o=i;return o instanceof t?(c(o,n),o._source=this):(o=e&&!n?e:new t(n,this)).setContent(i),o}}),Ai.extend({options:{pane:"popupPane",offset:[0,7],maxWidth:300,minWidth:50,maxHeight:null,autoPan:!0,autoPanPaddingTopLeft:null,autoPanPaddingBottomRight:null,autoPanPadding:[5,5],keepInView:!1,closeButton:!0,autoClose:!0,closeOnEscapeKey:!0,className:""},openOn:function(t){return!(t=arguments.length?t:this._source._map).hasLayer(this)&&t._popup&&t._popup.options.autoClose&&t.removeLayer(t._popup),t._popup=this,Ai.prototype.openOn.call(this,t)},onAdd:function(t){Ai.prototype.onAdd.call(this,t),t.fire("popupopen",{popup:this}),this._source&&(this._source.fire("popupopen",{popup:this},!0),this._source instanceof fi||this._source.on("preclick",Ae))},onRemove:function(t){Ai.prototype.onRemove.call(this,t),t.fire("popupclose",{popup:this}),this._source&&(this._source.fire("popupclose",{popup:this},!0),this._source instanceof fi||this._source.off("preclick",Ae))},getEvents:function(){var t=Ai.prototype.getEvents.call(this);return(void 0!==this.options.closeOnClick?this.options.closeOnClick:this._map.options.closePopupOnClick)&&(t.preclick=this.close),this.options.keepInView&&(t.moveend=this._adjustPan),t},_initLayout:function(){var t="leaflet-popup",e=this._container=P("div",t+" "+(this.options.className||"")+" leaflet-zoom-animated"),i=this._wrapper=P("div",t+"-content-wrapper",e);this._contentNode=P("div",t+"-content",i),Ie(e),Be(this._contentNode),S(e,"contextmenu",Ae),this._tipContainer=P("div",t+"-tip-container",e),this._tip=P("div",t+"-tip",this._tipContainer),this.options.closeButton&&((i=this._closeButton=P("a",t+"-close-button",e)).setAttribute("role","button"),i.setAttribute("aria-label","Close popup"),i.href="#close",i.innerHTML='<span aria-hidden="true">&#215;</span>',S(i,"click",function(t){O(t),this.close()},this))},_updateLayout:function(){var t=this._contentNode,e=t.style,i=(e.width="",e.whiteSpace="nowrap",t.offsetWidth),i=Math.min(i,this.options.maxWidth),i=(i=Math.max(i,this.options.minWidth),e.width=i+1+"px",e.whiteSpace="",e.height="",t.offsetHeight),n=this.options.maxHeight,o="leaflet-popup-scrolled";(n&&n<i?(e.height=n+"px",M):z)(t,o),this._containerWidth=this._container.offsetWidth},_animateZoom:function(t){var t=this._map._latLngToNewLayerPoint(this._latlng,t.zoom,t.center),e=this._getAnchor();Z(this._container,t.add(e))},_adjustPan:function(){var t,e,i,n,o,s,r,a;this.options.autoPan&&(this._map._panAnim&&this._map._panAnim.stop(),this._autopanning?this._autopanning=!1:(t=this._map,e=parseInt(pe(this._container,"marginBottom"),10)||0,e=this._container.offsetHeight+e,a=this._containerWidth,(i=new p(this._containerLeft,-e-this._containerBottom))._add(Pe(this._container)),i=t.layerPointToContainerPoint(i),o=m(this.options.autoPanPadding),n=m(this.options.autoPanPaddingTopLeft||o),o=m(this.options.autoPanPaddingBottomRight||o),s=t.getSize(),r=0,i.x+a+o.x>s.x&&(r=i.x+a-s.x+o.x),i.x-r-n.x<(a=0)&&(r=i.x-n.x),i.y+e+o.y>s.y&&(a=i.y+e-s.y+o.y),i.y-a-n.y<0&&(a=i.y-n.y),(r||a)&&(this.options.keepInView&&(this._autopanning=!0),t.fire("autopanstart").panBy([r,a]))))},_getAnchor:function(){return m(this._source&&this._source._getPopupAnchor?this._source._getPopupAnchor():[0,0])}})),Ii=(A.mergeOptions({closePopupOnClick:!0}),A.include({openPopup:function(t,e,i){return this._initOverlay(Bi,t,e,i).openOn(this),this},closePopup:function(t){return(t=arguments.length?t:this._popup)&&t.close(),this}}),o.include({bindPopup:function(t,e){return this._popup=this._initOverlay(Bi,this._popup,t,e),this._popupHandlersAdded||(this.on({click:this._openPopup,keypress:this._onKeyPress,remove:this.closePopup,move:this._movePopup}),this._popupHandlersAdded=!0),this},unbindPopup:function(){return this._popup&&(this.off({click:this._openPopup,keypress:this._onKeyPress,remove:this.closePopup,move:this._movePopup}),this._popupHandlersAdded=!1,this._popup=null),this},openPopup:function(t){return this._popup&&(this instanceof ci||(this._popup._source=this),this._popup._prepareOpen(t||this._latlng)&&this._popup.openOn(this._map)),this},closePopup:function(){return this._popup&&this._popup.close(),this},togglePopup:function(){return this._popup&&this._popup.toggle(this),this},isPopupOpen:function(){return!!this._popup&&this._popup.isOpen()},setPopupContent:function(t){return this._popup&&this._popup.setContent(t),this},getPopup:function(){return this._popup},_openPopup:function(t){var e;this._popup&&this._map&&(Re(t),e=t.layer||t.target,this._popup._source!==e||e instanceof fi?(this._popup._source=e,this.openPopup(t.latlng)):this._map.hasLayer(this._popup)?this.closePopup():this.openPopup(t.latlng))},_movePopup:function(t){this._popup.setLatLng(t.latlng)},_onKeyPress:function(t){13===t.originalEvent.keyCode&&this._openPopup(t)}}),Ai.extend({options:{pane:"tooltipPane",offset:[0,0],direction:"auto",permanent:!1,sticky:!1,opacity:.9},onAdd:function(t){Ai.prototype.onAdd.call(this,t),this.setOpacity(this.options.opacity),t.fire("tooltipopen",{tooltip:this}),this._source&&(this.addEventParent(this._source),this._source.fire("tooltipopen",{tooltip:this},!0))},onRemove:function(t){Ai.prototype.onRemove.call(this,t),t.fire("tooltipclose",{tooltip:this}),this._source&&(this.removeEventParent(this._source),this._source.fire("tooltipclose",{tooltip:this},!0))},getEvents:function(){var t=Ai.prototype.getEvents.call(this);return this.options.permanent||(t.preclick=this.close),t},_initLayout:function(){var t="leaflet-tooltip "+(this.options.className||"")+" leaflet-zoom-"+(this._zoomAnimated?"animated":"hide");this._contentNode=this._container=P("div",t),this._container.setAttribute("role","tooltip"),this._container.setAttribute("id","leaflet-tooltip-"+h(this))},_updateLayout:function(){},_adjustPan:function(){},_setPosition:function(t){var e,i=this._map,n=this._container,o=i.latLngToContainerPoint(i.getCenter()),i=i.layerPointToContainerPoint(t),s=this.options.direction,r=n.offsetWidth,a=n.offsetHeight,h=m(this.options.offset),l=this._getAnchor(),i="top"===s?(e=r/2,a):"bottom"===s?(e=r/2,0):(e="center"===s?r/2:"right"===s?0:"left"===s?r:i.x<o.x?(s="right",0):(s="left",r+2*(h.x+l.x)),a/2);t=t.subtract(m(e,i,!0)).add(h).add(l),z(n,"leaflet-tooltip-right"),z(n,"leaflet-tooltip-left"),z(n,"leaflet-tooltip-top"),z(n,"leaflet-tooltip-bottom"),M(n,"leaflet-tooltip-"+s),Z(n,t)},_updatePosition:function(){var t=this._map.latLngToLayerPoint(this._latlng);this._setPosition(t)},setOpacity:function(t){this.options.opacity=t,this._container&&C(this._container,t)},_animateZoom:function(t){t=this._map._latLngToNewLayerPoint(this._latlng,t.zoom,t.center);this._setPosition(t)},_getAnchor:function(){return m(this._source&&this._source._getTooltipAnchor&&!this.options.sticky?this._source._getTooltipAnchor():[0,0])}})),Ri=(A.include({openTooltip:function(t,e,i){return this._initOverlay(Ii,t,e,i).openOn(this),this},closeTooltip:function(t){return t.close(),this}}),o.include({bindTooltip:function(t,e){return this._tooltip&&this.isTooltipOpen()&&this.unbindTooltip(),this._tooltip=this._initOverlay(Ii,this._tooltip,t,e),this._initTooltipInteractions(),this._tooltip.options.permanent&&this._map&&this._map.hasLayer(this)&&this.openTooltip(),this},unbindTooltip:function(){return this._tooltip&&(this._initTooltipInteractions(!0),this.closeTooltip(),this._tooltip=null),this},_initTooltipInteractions:function(t){var e,i;!t&&this._tooltipHandlersAdded||(e=t?"off":"on",i={remove:this.closeTooltip,move:this._moveTooltip},this._tooltip.options.permanent?i.add=this._openTooltip:(i.mouseover=this._openTooltip,i.mouseout=this.closeTooltip,i.click=this._openTooltip,this._map?this._addFocusListeners():i.add=this._addFocusListeners),this._tooltip.options.sticky&&(i.mousemove=this._moveTooltip),this[e](i),this._tooltipHandlersAdded=!t)},openTooltip:function(t){return this._tooltip&&(this instanceof ci||(this._tooltip._source=this),this._tooltip._prepareOpen(t)&&(this._tooltip.openOn(this._map),this.getElement?this._setAriaDescribedByOnLayer(this):this.eachLayer&&this.eachLayer(this._setAriaDescribedByOnLayer,this))),this},closeTooltip:function(){if(this._tooltip)return this._tooltip.close()},toggleTooltip:function(){return this._tooltip&&this._tooltip.toggle(this),this},isTooltipOpen:function(){return this._tooltip.isOpen()},setTooltipContent:function(t){return this._tooltip&&this._tooltip.setContent(t),this},getTooltip:function(){return this._tooltip},_addFocusListeners:function(){this.getElement?this._addFocusListenersOnLayer(this):this.eachLayer&&this.eachLayer(this._addFocusListenersOnLayer,this)},_addFocusListenersOnLayer:function(t){var e="function"==typeof t.getElement&&t.getElement();e&&(S(e,"focus",function(){this._tooltip._source=t,this.openTooltip()},this),S(e,"blur",this.closeTooltip,this))},_setAriaDescribedByOnLayer:function(t){t="function"==typeof t.getElement&&t.getElement();t&&t.setAttribute("aria-describedby",this._tooltip._container.id)},_openTooltip:function(t){var e;this._tooltip&&this._map&&(this._map.dragging&&this._map.dragging.moving()&&!this._openOnceFlag?(this._openOnceFlag=!0,(e=this)._map.once("moveend",function(){e._openOnceFlag=!1,e._openTooltip(t)})):(this._tooltip._source=t.layer||t.target,this.openTooltip(this._tooltip.options.sticky?t.latlng:void 0)))},_moveTooltip:function(t){var e=t.latlng;this._tooltip.options.sticky&&t.originalEvent&&(t=this._map.mouseEventToContainerPoint(t.originalEvent),t=this._map.containerPointToLayerPoint(t),e=this._map.layerPointToLatLng(t)),this._tooltip.setLatLng(e)}}),di.extend({options:{iconSize:[12,12],html:!1,bgPos:null,className:"leaflet-div-icon"},createIcon:function(t){var t=t&&"DIV"===t.tagName?t:document.createElement("div"),e=this.options;return e.html instanceof Element?(me(t),t.appendChild(e.html)):t.innerHTML=!1!==e.html?e.html:"",e.bgPos&&(e=m(e.bgPos),t.style.backgroundPosition=-e.x+"px "+-e.y+"px"),this._setIconStyles(t,"icon"),t},createShadow:function(){return null}}));di.Default=_i;var Ni=o.extend({options:{tileSize:256,opacity:1,updateWhenIdle:b.mobile,updateWhenZooming:!0,updateInterval:200,zIndex:1,bounds:null,minZoom:0,maxZoom:void 0,maxNativeZoom:void 0,minNativeZoom:void 0,noWrap:!1,pane:"tilePane",className:"",keepBuffer:2},initialize:function(t){c(this,t)},onAdd:function(){this._initContainer(),this._levels={},this._tiles={},this._resetView()},beforeAdd:function(t){t._addZoomLimit(this)},onRemove:function(t){this._removeAllTiles(),T(this._container),t._removeZoomLimit(this),this._container=null,this._tileZoom=void 0},bringToFront:function(){return this._map&&(fe(this._container),this._setAutoZIndex(Math.max)),this},bringToBack:function(){return this._map&&(ge(this._container),this._setAutoZIndex(Math.min)),this},getContainer:function(){return this._container},setOpacity:function(t){return this.options.opacity=t,this._updateOpacity(),this},setZIndex:function(t){return this.options.zIndex=t,this._updateZIndex(),this},isLoading:function(){return this._loading},redraw:function(){var t;return this._map&&(this._removeAllTiles(),(t=this._clampZoom(this._map.getZoom()))!==this._tileZoom&&(this._tileZoom=t,this._updateLevels()),this._update()),this},getEvents:function(){var t={viewprereset:this._invalidateAll,viewreset:this._resetView,zoom:this._resetView,moveend:this._onMoveEnd};return this.options.updateWhenIdle||(this._onMove||(this._onMove=j(this._onMoveEnd,this.options.updateInterval,this)),t.move=this._onMove),this._zoomAnimated&&(t.zoomanim=this._animateZoom),t},createTile:function(){return document.createElement("div")},getTileSize:function(){var t=this.options.tileSize;return t instanceof p?t:new p(t,t)},_updateZIndex:function(){this._container&&void 0!==this.options.zIndex&&null!==this.options.zIndex&&(this._container.style.zIndex=this.options.zIndex)},_setAutoZIndex:function(t){for(var e,i=this.getPane().children,n=-t(-1/0,1/0),o=0,s=i.length;o<s;o++)e=i[o].style.zIndex,i[o]!==this._container&&e&&(n=t(n,+e));isFinite(n)&&(this.options.zIndex=n+t(-1,1),this._updateZIndex())},_updateOpacity:function(){if(this._map&&!b.ielt9){C(this._container,this.options.opacity);var t,e=+new Date,i=!1,n=!1;for(t in this._tiles){var o,s=this._tiles[t];s.current&&s.loaded&&(o=Math.min(1,(e-s.loaded)/200),C(s.el,o),o<1?i=!0:(s.active?n=!0:this._onOpaqueTile(s),s.active=!0))}n&&!this._noPrune&&this._pruneTiles(),i&&(r(this._fadeFrame),this._fadeFrame=x(this._updateOpacity,this))}},_onOpaqueTile:u,_initContainer:function(){this._container||(this._container=P("div","leaflet-layer "+(this.options.className||"")),this._updateZIndex(),this.options.opacity<1&&this._updateOpacity(),this.getPane().appendChild(this._container))},_updateLevels:function(){var t=this._tileZoom,e=this.options.maxZoom;if(void 0!==t){for(var i in this._levels)i=Number(i),this._levels[i].el.children.length||i===t?(this._levels[i].el.style.zIndex=e-Math.abs(t-i),this._onUpdateLevel(i)):(T(this._levels[i].el),this._removeTilesAtZoom(i),this._onRemoveLevel(i),delete this._levels[i]);var n=this._levels[t],o=this._map;return n||((n=this._levels[t]={}).el=P("div","leaflet-tile-container leaflet-zoom-animated",this._container),n.el.style.zIndex=e,n.origin=o.project(o.unproject(o.getPixelOrigin()),t).round(),n.zoom=t,this._setZoomTransform(n,o.getCenter(),o.getZoom()),u(n.el.offsetWidth),this._onCreateLevel(n)),this._level=n}},_onUpdateLevel:u,_onRemoveLevel:u,_onCreateLevel:u,_pruneTiles:function(){if(this._map){var t,e,i,n=this._map.getZoom();if(n>this.options.maxZoom||n<this.options.minZoom)this._removeAllTiles();else{for(t in this._tiles)(i=this._tiles[t]).retain=i.current;for(t in this._tiles)(i=this._tiles[t]).current&&!i.active&&(e=i.coords,this._retainParent(e.x,e.y,e.z,e.z-5)||this._retainChildren(e.x,e.y,e.z,e.z+2));for(t in this._tiles)this._tiles[t].retain||this._removeTile(t)}}},_removeTilesAtZoom:function(t){for(var e in this._tiles)this._tiles[e].coords.z===t&&this._removeTile(e)},_removeAllTiles:function(){for(var t in this._tiles)this._removeTile(t)},_invalidateAll:function(){for(var t in this._levels)T(this._levels[t].el),this._onRemoveLevel(Number(t)),delete this._levels[t];this._removeAllTiles(),this._tileZoom=void 0},_retainParent:function(t,e,i,n){var t=Math.floor(t/2),e=Math.floor(e/2),i=i-1,o=new p(+t,+e),o=(o.z=i,this._tileCoordsToKey(o)),o=this._tiles[o];return o&&o.active?o.retain=!0:(o&&o.loaded&&(o.retain=!0),n<i&&this._retainParent(t,e,i,n))},_retainChildren:function(t,e,i,n){for(var o=2*t;o<2*t+2;o++)for(var s=2*e;s<2*e+2;s++){var r=new p(o,s),r=(r.z=i+1,this._tileCoordsToKey(r)),r=this._tiles[r];r&&r.active?r.retain=!0:(r&&r.loaded&&(r.retain=!0),i+1<n&&this._retainChildren(o,s,i+1,n))}},_resetView:function(t){t=t&&(t.pinch||t.flyTo);this._setView(this._map.getCenter(),this._map.getZoom(),t,t)},_animateZoom:function(t){this._setView(t.center,t.zoom,!0,t.noUpdate)},_clampZoom:function(t){var e=this.options;return void 0!==e.minNativeZoom&&t<e.minNativeZoom?e.minNativeZoom:void 0!==e.maxNativeZoom&&e.maxNativeZoom<t?e.maxNativeZoom:t},_setView:function(t,e,i,n){var o=Math.round(e),o=void 0!==this.options.maxZoom&&o>this.options.maxZoom||void 0!==this.options.minZoom&&o<this.options.minZoom?void 0:this._clampZoom(o),s=this.options.updateWhenZooming&&o!==this._tileZoom;n&&!s||(this._tileZoom=o,this._abortLoading&&this._abortLoading(),this._updateLevels(),this._resetGrid(),void 0!==o&&this._update(t),i||this._pruneTiles(),this._noPrune=!!i),this._setZoomTransforms(t,e)},_setZoomTransforms:function(t,e){for(var i in this._levels)this._setZoomTransform(this._levels[i],t,e)},_setZoomTransform:function(t,e,i){var n=this._map.getZoomScale(i,t.zoom),e=t.origin.multiplyBy(n).subtract(this._map._getNewPixelOrigin(e,i)).round();b.any3d?be(t.el,e,n):Z(t.el,e)},_resetGrid:function(){var t=this._map,e=t.options.crs,i=this._tileSize=this.getTileSize(),n=this._tileZoom,o=this._map.getPixelWorldBounds(this._tileZoom);o&&(this._globalTileRange=this._pxBoundsToTileRange(o)),this._wrapX=e.wrapLng&&!this.options.noWrap&&[Math.floor(t.project([0,e.wrapLng[0]],n).x/i.x),Math.ceil(t.project([0,e.wrapLng[1]],n).x/i.y)],this._wrapY=e.wrapLat&&!this.options.noWrap&&[Math.floor(t.project([e.wrapLat[0],0],n).y/i.x),Math.ceil(t.project([e.wrapLat[1],0],n).y/i.y)]},_onMoveEnd:function(){this._map&&!this._map._animatingZoom&&this._update()},_getTiledPixelBounds:function(t){var e=this._map,i=e._animatingZoom?Math.max(e._animateToZoom,e.getZoom()):e.getZoom(),i=e.getZoomScale(i,this._tileZoom),t=e.project(t,this._tileZoom).floor(),e=e.getSize().divideBy(2*i);return new f(t.subtract(e),t.add(e))},_update:function(t){var e=this._map;if(e){var i=this._clampZoom(e.getZoom());if(void 0===t&&(t=e.getCenter()),void 0!==this._tileZoom){var n,e=this._getTiledPixelBounds(t),o=this._pxBoundsToTileRange(e),s=o.getCenter(),r=[],e=this.options.keepBuffer,a=new f(o.getBottomLeft().subtract([e,-e]),o.getTopRight().add([e,-e]));if(!(isFinite(o.min.x)&&isFinite(o.min.y)&&isFinite(o.max.x)&&isFinite(o.max.y)))throw new Error("Attempted to load an infinite number of tiles");for(n in this._tiles){var h=this._tiles[n].coords;h.z===this._tileZoom&&a.contains(new p(h.x,h.y))||(this._tiles[n].current=!1)}if(1<Math.abs(i-this._tileZoom))this._setView(t,i);else{for(var l=o.min.y;l<=o.max.y;l++)for(var u=o.min.x;u<=o.max.x;u++){var c,d=new p(u,l);d.z=this._tileZoom,this._isValidTile(d)&&((c=this._tiles[this._tileCoordsToKey(d)])?c.current=!0:r.push(d))}if(r.sort(function(t,e){return t.distanceTo(s)-e.distanceTo(s)}),0!==r.length){this._loading||(this._loading=!0,this.fire("loading"));for(var _=document.createDocumentFragment(),u=0;u<r.length;u++)this._addTile(r[u],_);this._level.el.appendChild(_)}}}}},_isValidTile:function(t){var e=this._map.options.crs;if(!e.infinite){var i=this._globalTileRange;if(!e.wrapLng&&(t.x<i.min.x||t.x>i.max.x)||!e.wrapLat&&(t.y<i.min.y||t.y>i.max.y))return!1}return!this.options.bounds||(e=this._tileCoordsToBounds(t),g(this.options.bounds).overlaps(e))},_keyToBounds:function(t){return this._tileCoordsToBounds(this._keyToTileCoords(t))},_tileCoordsToNwSe:function(t){var e=this._map,i=this.getTileSize(),n=t.scaleBy(i),i=n.add(i);return[e.unproject(n,t.z),e.unproject(i,t.z)]},_tileCoordsToBounds:function(t){t=this._tileCoordsToNwSe(t),t=new s(t[0],t[1]);return t=this.options.noWrap?t:this._map.wrapLatLngBounds(t)},_tileCoordsToKey:function(t){return t.x+":"+t.y+":"+t.z},_keyToTileCoords:function(t){var t=t.split(":"),e=new p(+t[0],+t[1]);return e.z=+t[2],e},_removeTile:function(t){var e=this._tiles[t];e&&(T(e.el),delete this._tiles[t],this.fire("tileunload",{tile:e.el,coords:this._keyToTileCoords(t)}))},_initTile:function(t){M(t,"leaflet-tile");var e=this.getTileSize();t.style.width=e.x+"px",t.style.height=e.y+"px",t.onselectstart=u,t.onmousemove=u,b.ielt9&&this.options.opacity<1&&C(t,this.options.opacity)},_addTile:function(t,e){var i=this._getTilePos(t),n=this._tileCoordsToKey(t),o=this.createTile(this._wrapCoords(t),a(this._tileReady,this,t));this._initTile(o),this.createTile.length<2&&x(a(this._tileReady,this,t,null,o)),Z(o,i),this._tiles[n]={el:o,coords:t,current:!0},e.appendChild(o),this.fire("tileloadstart",{tile:o,coords:t})},_tileReady:function(t,e,i){e&&this.fire("tileerror",{error:e,tile:i,coords:t});var n=this._tileCoordsToKey(t);(i=this._tiles[n])&&(i.loaded=+new Date,this._map._fadeAnimated?(C(i.el,0),r(this._fadeFrame),this._fadeFrame=x(this._updateOpacity,this)):(i.active=!0,this._pruneTiles()),e||(M(i.el,"leaflet-tile-loaded"),this.fire("tileload",{tile:i.el,coords:t})),this._noTilesToLoad()&&(this._loading=!1,this.fire("load"),b.ielt9||!this._map._fadeAnimated?x(this._pruneTiles,this):setTimeout(a(this._pruneTiles,this),250)))},_getTilePos:function(t){return t.scaleBy(this.getTileSize()).subtract(this._level.origin)},_wrapCoords:function(t){var e=new p(this._wrapX?H(t.x,this._wrapX):t.x,this._wrapY?H(t.y,this._wrapY):t.y);return e.z=t.z,e},_pxBoundsToTileRange:function(t){var e=this.getTileSize();return new f(t.min.unscaleBy(e).floor(),t.max.unscaleBy(e).ceil().subtract([1,1]))},_noTilesToLoad:function(){for(var t in this._tiles)if(!this._tiles[t].loaded)return!1;return!0}});var Di=Ni.extend({options:{minZoom:0,maxZoom:18,subdomains:"abc",errorTileUrl:"",zoomOffset:0,tms:!1,zoomReverse:!1,detectRetina:!1,crossOrigin:!1,referrerPolicy:!1},initialize:function(t,e){this._url=t,(e=c(this,e)).detectRetina&&b.retina&&0<e.maxZoom?(e.tileSize=Math.floor(e.tileSize/2),e.zoomReverse?(e.zoomOffset--,e.minZoom=Math.min(e.maxZoom,e.minZoom+1)):(e.zoomOffset++,e.maxZoom=Math.max(e.minZoom,e.maxZoom-1)),e.minZoom=Math.max(0,e.minZoom)):e.zoomReverse?e.minZoom=Math.min(e.maxZoom,e.minZoom):e.maxZoom=Math.max(e.minZoom,e.maxZoom),"string"==typeof e.subdomains&&(e.subdomains=e.subdomains.split("")),this.on("tileunload",this._onTileRemove)},setUrl:function(t,e){return this._url===t&&void 0===e&&(e=!0),this._url=t,e||this.redraw(),this},createTile:function(t,e){var i=document.createElement("img");return S(i,"load",a(this._tileOnLoad,this,e,i)),S(i,"error",a(this._tileOnError,this,e,i)),!this.options.crossOrigin&&""!==this.options.crossOrigin||(i.crossOrigin=!0===this.options.crossOrigin?"":this.options.crossOrigin),"string"==typeof this.options.referrerPolicy&&(i.referrerPolicy=this.options.referrerPolicy),i.alt="",i.src=this.getTileUrl(t),i},getTileUrl:function(t){var e={r:b.retina?"@2x":"",s:this._getSubdomain(t),x:t.x,y:t.y,z:this._getZoomForUrl()};return this._map&&!this._map.options.crs.infinite&&(t=this._globalTileRange.max.y-t.y,this.options.tms&&(e.y=t),e["-y"]=t),q(this._url,l(e,this.options))},_tileOnLoad:function(t,e){b.ielt9?setTimeout(a(t,this,null,e),0):t(null,e)},_tileOnError:function(t,e,i){var n=this.options.errorTileUrl;n&&e.getAttribute("src")!==n&&(e.src=n),t(i,e)},_onTileRemove:function(t){t.tile.onload=null},_getZoomForUrl:function(){var t=this._tileZoom,e=this.options.maxZoom;return(t=this.options.zoomReverse?e-t:t)+this.options.zoomOffset},_getSubdomain:function(t){t=Math.abs(t.x+t.y)%this.options.subdomains.length;return this.options.subdomains[t]},_abortLoading:function(){var t,e,i;for(t in this._tiles)this._tiles[t].coords.z!==this._tileZoom&&((i=this._tiles[t].el).onload=u,i.onerror=u,i.complete||(i.src=K,e=this._tiles[t].coords,T(i),delete this._tiles[t],this.fire("tileabort",{tile:i,coords:e})))},_removeTile:function(t){var e=this._tiles[t];if(e)return e.el.setAttribute("src",K),Ni.prototype._removeTile.call(this,t)},_tileReady:function(t,e,i){if(this._map&&(!i||i.getAttribute("src")!==K))return Ni.prototype._tileReady.call(this,t,e,i)}});function ji(t,e){return new Di(t,e)}var Hi=Di.extend({defaultWmsParams:{service:"WMS",request:"GetMap",layers:"",styles:"",format:"image/jpeg",transparent:!1,version:"1.1.1"},options:{crs:null,uppercase:!1},initialize:function(t,e){this._url=t;var i,n=l({},this.defaultWmsParams);for(i in e)i in this.options||(n[i]=e[i]);var t=(e=c(this,e)).detectRetina&&b.retina?2:1,o=this.getTileSize();n.width=o.x*t,n.height=o.y*t,this.wmsParams=n},onAdd:function(t){this._crs=this.options.crs||t.options.crs,this._wmsVersion=parseFloat(this.wmsParams.version);var e=1.3<=this._wmsVersion?"crs":"srs";this.wmsParams[e]=this._crs.code,Di.prototype.onAdd.call(this,t)},getTileUrl:function(t){var e=this._tileCoordsToNwSe(t),i=this._crs,i=_(i.project(e[0]),i.project(e[1])),e=i.min,i=i.max,e=(1.3<=this._wmsVersion&&this._crs===li?[e.y,e.x,i.y,i.x]:[e.x,e.y,i.x,i.y]).join(","),i=Di.prototype.getTileUrl.call(this,t);return i+U(this.wmsParams,i,this.options.uppercase)+(this.options.uppercase?"&BBOX=":"&bbox=")+e},setParams:function(t,e){return l(this.wmsParams,t),e||this.redraw(),this}});Di.WMS=Hi,ji.wms=function(t,e){return new Hi(t,e)};var Wi=o.extend({options:{padding:.1},initialize:function(t){c(this,t),h(this),this._layers=this._layers||{}},onAdd:function(){this._container||(this._initContainer(),M(this._container,"leaflet-zoom-animated")),this.getPane().appendChild(this._container),this._update(),this.on("update",this._updatePaths,this)},onRemove:function(){this.off("update",this._updatePaths,this),this._destroyContainer()},getEvents:function(){var t={viewreset:this._reset,zoom:this._onZoom,moveend:this._update,zoomend:this._onZoomEnd};return this._zoomAnimated&&(t.zoomanim=this._onAnimZoom),t},_onAnimZoom:function(t){this._updateTransform(t.center,t.zoom)},_onZoom:function(){this._updateTransform(this._map.getCenter(),this._map.getZoom())},_updateTransform:function(t,e){var i=this._map.getZoomScale(e,this._zoom),n=this._map.getSize().multiplyBy(.5+this.options.padding),o=this._map.project(this._center,e),n=n.multiplyBy(-i).add(o).subtract(this._map._getNewPixelOrigin(t,e));b.any3d?be(this._container,n,i):Z(this._container,n)},_reset:function(){for(var t in this._update(),this._updateTransform(this._center,this._zoom),this._layers)this._layers[t]._reset()},_onZoomEnd:function(){for(var t in this._layers)this._layers[t]._project()},_updatePaths:function(){for(var t in this._layers)this._layers[t]._update()},_update:function(){var t=this.options.padding,e=this._map.getSize(),i=this._map.containerPointToLayerPoint(e.multiplyBy(-t)).round();this._bounds=new f(i,i.add(e.multiplyBy(1+2*t)).round()),this._center=this._map.getCenter(),this._zoom=this._map.getZoom()}}),Fi=Wi.extend({options:{tolerance:0},getEvents:function(){var t=Wi.prototype.getEvents.call(this);return t.viewprereset=this._onViewPreReset,t},_onViewPreReset:function(){this._postponeUpdatePaths=!0},onAdd:function(){Wi.prototype.onAdd.call(this),this._draw()},_initContainer:function(){var t=this._container=document.createElement("canvas");S(t,"mousemove",this._onMouseMove,this),S(t,"click dblclick mousedown mouseup contextmenu",this._onClick,this),S(t,"mouseout",this._handleMouseOut,this),t._leaflet_disable_events=!0,this._ctx=t.getContext("2d")},_destroyContainer:function(){r(this._redrawRequest),delete this._ctx,T(this._container),k(this._container),delete this._container},_updatePaths:function(){if(!this._postponeUpdatePaths){for(var t in this._redrawBounds=null,this._layers)this._layers[t]._update();this._redraw()}},_update:function(){var t,e,i,n;this._map._animatingZoom&&this._bounds||(Wi.prototype._update.call(this),t=this._bounds,e=this._container,i=t.getSize(),n=b.retina?2:1,Z(e,t.min),e.width=n*i.x,e.height=n*i.y,e.style.width=i.x+"px",e.style.height=i.y+"px",b.retina&&this._ctx.scale(2,2),this._ctx.translate(-t.min.x,-t.min.y),this.fire("update"))},_reset:function(){Wi.prototype._reset.call(this),this._postponeUpdatePaths&&(this._postponeUpdatePaths=!1,this._updatePaths())},_initPath:function(t){this._updateDashArray(t);t=(this._layers[h(t)]=t)._order={layer:t,prev:this._drawLast,next:null};this._drawLast&&(this._drawLast.next=t),this._drawLast=t,this._drawFirst=this._drawFirst||this._drawLast},_addPath:function(t){this._requestRedraw(t)},_removePath:function(t){var e=t._order,i=e.next,e=e.prev;i?i.prev=e:this._drawLast=e,e?e.next=i:this._drawFirst=i,delete t._order,delete this._layers[h(t)],this._requestRedraw(t)},_updatePath:function(t){this._extendRedrawBounds(t),t._project(),t._update(),this._requestRedraw(t)},_updateStyle:function(t){this._updateDashArray(t),this._requestRedraw(t)},_updateDashArray:function(t){if("string"==typeof t.options.dashArray){for(var e,i=t.options.dashArray.split(/[, ]+/),n=[],o=0;o<i.length;o++){if(e=Number(i[o]),isNaN(e))return;n.push(e)}t.options._dashArray=n}else t.options._dashArray=t.options.dashArray},_requestRedraw:function(t){this._map&&(this._extendRedrawBounds(t),this._redrawRequest=this._redrawRequest||x(this._redraw,this))},_extendRedrawBounds:function(t){var e;t._pxBounds&&(e=(t.options.weight||0)+1,this._redrawBounds=this._redrawBounds||new f,this._redrawBounds.extend(t._pxBounds.min.subtract([e,e])),this._redrawBounds.extend(t._pxBounds.max.add([e,e])))},_redraw:function(){this._redrawRequest=null,this._redrawBounds&&(this._redrawBounds.min._floor(),this._redrawBounds.max._ceil()),this._clear(),this._draw(),this._redrawBounds=null},_clear:function(){var t,e=this._redrawBounds;e?(t=e.getSize(),this._ctx.clearRect(e.min.x,e.min.y,t.x,t.y)):(this._ctx.save(),this._ctx.setTransform(1,0,0,1,0,0),this._ctx.clearRect(0,0,this._container.width,this._container.height),this._ctx.restore())},_draw:function(){var t,e,i=this._redrawBounds;this._ctx.save(),i&&(e=i.getSize(),this._ctx.beginPath(),this._ctx.rect(i.min.x,i.min.y,e.x,e.y),this._ctx.clip()),this._drawing=!0;for(var n=this._drawFirst;n;n=n.next)t=n.layer,(!i||t._pxBounds&&t._pxBounds.intersects(i))&&t._updatePath();this._drawing=!1,this._ctx.restore()},_updatePoly:function(t,e){if(this._drawing){var i,n,o,s,r=t._parts,a=r.length,h=this._ctx;if(a){for(h.beginPath(),i=0;i<a;i++){for(n=0,o=r[i].length;n<o;n++)s=r[i][n],h[n?"lineTo":"moveTo"](s.x,s.y);e&&h.closePath()}this._fillStroke(h,t)}}},_updateCircle:function(t){var e,i,n,o;this._drawing&&!t._empty()&&(e=t._point,i=this._ctx,n=Math.max(Math.round(t._radius),1),1!=(o=(Math.max(Math.round(t._radiusY),1)||n)/n)&&(i.save(),i.scale(1,o)),i.beginPath(),i.arc(e.x,e.y/o,n,0,2*Math.PI,!1),1!=o&&i.restore(),this._fillStroke(i,t))},_fillStroke:function(t,e){var i=e.options;i.fill&&(t.globalAlpha=i.fillOpacity,t.fillStyle=i.fillColor||i.color,t.fill(i.fillRule||"evenodd")),i.stroke&&0!==i.weight&&(t.setLineDash&&t.setLineDash(e.options&&e.options._dashArray||[]),t.globalAlpha=i.opacity,t.lineWidth=i.weight,t.strokeStyle=i.color,t.lineCap=i.lineCap,t.lineJoin=i.lineJoin,t.stroke())},_onClick:function(t){for(var e,i,n=this._map.mouseEventToLayerPoint(t),o=this._drawFirst;o;o=o.next)(e=o.layer).options.interactive&&e._containsPoint(n)&&(("click"===t.type||"preclick"===t.type)&&this._map._draggableMoved(e)||(i=e));this._fireEvent(!!i&&[i],t)},_onMouseMove:function(t){var e;!this._map||this._map.dragging.moving()||this._map._animatingZoom||(e=this._map.mouseEventToLayerPoint(t),this._handleMouseHover(t,e))},_handleMouseOut:function(t){var e=this._hoveredLayer;e&&(z(this._container,"leaflet-interactive"),this._fireEvent([e],t,"mouseout"),this._hoveredLayer=null,this._mouseHoverThrottled=!1)},_handleMouseHover:function(t,e){if(!this._mouseHoverThrottled){for(var i,n,o=this._drawFirst;o;o=o.next)(i=o.layer).options.interactive&&i._containsPoint(e)&&(n=i);n!==this._hoveredLayer&&(this._handleMouseOut(t),n&&(M(this._container,"leaflet-interactive"),this._fireEvent([n],t,"mouseover"),this._hoveredLayer=n)),this._fireEvent(!!this._hoveredLayer&&[this._hoveredLayer],t),this._mouseHoverThrottled=!0,setTimeout(a(function(){this._mouseHoverThrottled=!1},this),32)}},_fireEvent:function(t,e,i){this._map._fireDOMEvent(e,i||e.type,t)},_bringToFront:function(t){var e,i,n=t._order;n&&(e=n.next,i=n.prev,e&&((e.prev=i)?i.next=e:e&&(this._drawFirst=e),n.prev=this._drawLast,(this._drawLast.next=n).next=null,this._drawLast=n,this._requestRedraw(t)))},_bringToBack:function(t){var e,i,n=t._order;n&&(e=n.next,(i=n.prev)&&((i.next=e)?e.prev=i:i&&(this._drawLast=i),n.prev=null,n.next=this._drawFirst,this._drawFirst.prev=n,this._drawFirst=n,this._requestRedraw(t)))}});function Ui(t){return b.canvas?new Fi(t):null}var Vi=function(){try{return document.namespaces.add("lvml","urn:schemas-microsoft-com:vml"),function(t){return document.createElement("<lvml:"+t+' class="lvml">')}}catch(t){}return function(t){return document.createElement("<"+t+' xmlns="urn:schemas-microsoft.com:vml" class="lvml">')}}(),zt={_initContainer:function(){this._container=P("div","leaflet-vml-container")},_update:function(){this._map._animatingZoom||(Wi.prototype._update.call(this),this.fire("update"))},_initPath:function(t){var e=t._container=Vi("shape");M(e,"leaflet-vml-shape "+(this.options.className||"")),e.coordsize="1 1",t._path=Vi("path"),e.appendChild(t._path),this._updateStyle(t),this._layers[h(t)]=t},_addPath:function(t){var e=t._container;this._container.appendChild(e),t.options.interactive&&t.addInteractiveTarget(e)},_removePath:function(t){var e=t._container;T(e),t.removeInteractiveTarget(e),delete this._layers[h(t)]},_updateStyle:function(t){var e=t._stroke,i=t._fill,n=t.options,o=t._container;o.stroked=!!n.stroke,o.filled=!!n.fill,n.stroke?(e=e||(t._stroke=Vi("stroke")),o.appendChild(e),e.weight=n.weight+"px",e.color=n.color,e.opacity=n.opacity,n.dashArray?e.dashStyle=d(n.dashArray)?n.dashArray.join(" "):n.dashArray.replace(/( *, *)/g," "):e.dashStyle="",e.endcap=n.lineCap.replace("butt","flat"),e.joinstyle=n.lineJoin):e&&(o.removeChild(e),t._stroke=null),n.fill?(i=i||(t._fill=Vi("fill")),o.appendChild(i),i.color=n.fillColor||n.color,i.opacity=n.fillOpacity):i&&(o.removeChild(i),t._fill=null)},_updateCircle:function(t){var e=t._point.round(),i=Math.round(t._radius),n=Math.round(t._radiusY||i);this._setPath(t,t._empty()?"M0 0":"AL "+e.x+","+e.y+" "+i+","+n+" 0,23592600")},_setPath:function(t,e){t._path.v=e},_bringToFront:function(t){fe(t._container)},_bringToBack:function(t){ge(t._container)}},qi=b.vml?Vi:ct,Gi=Wi.extend({_initContainer:function(){this._container=qi("svg"),this._container.setAttribute("pointer-events","none"),this._rootGroup=qi("g"),this._container.appendChild(this._rootGroup)},_destroyContainer:function(){T(this._container),k(this._container),delete this._container,delete this._rootGroup,delete this._svgSize},_update:function(){var t,e,i;this._map._animatingZoom&&this._bounds||(Wi.prototype._update.call(this),e=(t=this._bounds).getSize(),i=this._container,this._svgSize&&this._svgSize.equals(e)||(this._svgSize=e,i.setAttribute("width",e.x),i.setAttribute("height",e.y)),Z(i,t.min),i.setAttribute("viewBox",[t.min.x,t.min.y,e.x,e.y].join(" ")),this.fire("update"))},_initPath:function(t){var e=t._path=qi("path");t.options.className&&M(e,t.options.className),t.options.interactive&&M(e,"leaflet-interactive"),this._updateStyle(t),this._layers[h(t)]=t},_addPath:function(t){this._rootGroup||this._initContainer(),this._rootGroup.appendChild(t._path),t.addInteractiveTarget(t._path)},_removePath:function(t){T(t._path),t.removeInteractiveTarget(t._path),delete this._layers[h(t)]},_updatePath:function(t){t._project(),t._update()},_updateStyle:function(t){var e=t._path,t=t.options;e&&(t.stroke?(e.setAttribute("stroke",t.color),e.setAttribute("stroke-opacity",t.opacity),e.setAttribute("stroke-width",t.weight),e.setAttribute("stroke-linecap",t.lineCap),e.setAttribute("stroke-linejoin",t.lineJoin),t.dashArray?e.setAttribute("stroke-dasharray",t.dashArray):e.removeAttribute("stroke-dasharray"),t.dashOffset?e.setAttribute("stroke-dashoffset",t.dashOffset):e.removeAttribute("stroke-dashoffset")):e.setAttribute("stroke","none"),t.fill?(e.setAttribute("fill",t.fillColor||t.color),e.setAttribute("fill-opacity",t.fillOpacity),e.setAttribute("fill-rule",t.fillRule||"evenodd")):e.setAttribute("fill","none"))},_updatePoly:function(t,e){this._setPath(t,dt(t._parts,e))},_updateCircle:function(t){var e=t._point,i=Math.max(Math.round(t._radius),1),n="a"+i+","+(Math.max(Math.round(t._radiusY),1)||i)+" 0 1,0 ",e=t._empty()?"M0 0":"M"+(e.x-i)+","+e.y+n+2*i+",0 "+n+2*-i+",0 ";this._setPath(t,e)},_setPath:function(t,e){t._path.setAttribute("d",e)},_bringToFront:function(t){fe(t._path)},_bringToBack:function(t){ge(t._path)}});function Ki(t){return b.svg||b.vml?new Gi(t):null}b.vml&&Gi.include(zt),A.include({getRenderer:function(t){t=(t=t.options.renderer||this._getPaneRenderer(t.options.pane)||this.options.renderer||this._renderer)||(this._renderer=this._createRenderer());return this.hasLayer(t)||this.addLayer(t),t},_getPaneRenderer:function(t){var e;return"overlayPane"!==t&&void 0!==t&&(void 0===(e=this._paneRenderers[t])&&(e=this._createRenderer({pane:t}),this._paneRenderers[t]=e),e)},_createRenderer:function(t){return this.options.preferCanvas&&Ui(t)||Ki(t)}});var Yi=xi.extend({initialize:function(t,e){xi.prototype.initialize.call(this,this._boundsToLatLngs(t),e)},setBounds:function(t){return this.setLatLngs(this._boundsToLatLngs(t))},_boundsToLatLngs:function(t){return[(t=g(t)).getSouthWest(),t.getNorthWest(),t.getNorthEast(),t.getSouthEast()]}});Gi.create=qi,Gi.pointsToPath=dt,wi.geometryToLayer=bi,wi.coordsToLatLng=Li,wi.coordsToLatLngs=Ti,wi.latLngToCoords=Mi,wi.latLngsToCoords=zi,wi.getFeature=Ci,wi.asFeature=Zi,A.mergeOptions({boxZoom:!0});var _t=n.extend({initialize:function(t){this._map=t,this._container=t._container,this._pane=t._panes.overlayPane,this._resetStateTimeout=0,t.on("unload",this._destroy,this)},addHooks:function(){S(this._container,"mousedown",this._onMouseDown,this)},removeHooks:function(){k(this._container,"mousedown",this._onMouseDown,this)},moved:function(){return this._moved},_destroy:function(){T(this._pane),delete this._pane},_resetState:function(){this._resetStateTimeout=0,this._moved=!1},_clearDeferredResetState:function(){0!==this._resetStateTimeout&&(clearTimeout(this._resetStateTimeout),this._resetStateTimeout=0)},_onMouseDown:function(t){if(!t.shiftKey||1!==t.which&&1!==t.button)return!1;this._clearDeferredResetState(),this._resetState(),re(),Le(),this._startPoint=this._map.mouseEventToContainerPoint(t),S(document,{contextmenu:Re,mousemove:this._onMouseMove,mouseup:this._onMouseUp,keydown:this._onKeyDown},this)},_onMouseMove:function(t){this._moved||(this._moved=!0,this._box=P("div","leaflet-zoom-box",this._container),M(this._container,"leaflet-crosshair"),this._map.fire("boxzoomstart")),this._point=this._map.mouseEventToContainerPoint(t);var t=new f(this._point,this._startPoint),e=t.getSize();Z(this._box,t.min),this._box.style.width=e.x+"px",this._box.style.height=e.y+"px"},_finish:function(){this._moved&&(T(this._box),z(this._container,"leaflet-crosshair")),ae(),Te(),k(document,{contextmenu:Re,mousemove:this._onMouseMove,mouseup:this._onMouseUp,keydown:this._onKeyDown},this)},_onMouseUp:function(t){1!==t.which&&1!==t.button||(this._finish(),this._moved&&(this._clearDeferredResetState(),this._resetStateTimeout=setTimeout(a(this._resetState,this),0),t=new s(this._map.containerPointToLatLng(this._startPoint),this._map.containerPointToLatLng(this._point)),this._map.fitBounds(t).fire("boxzoomend",{boxZoomBounds:t})))},_onKeyDown:function(t){27===t.keyCode&&(this._finish(),this._clearDeferredResetState(),this._resetState())}}),Ct=(A.addInitHook("addHandler","boxZoom",_t),A.mergeOptions({doubleClickZoom:!0}),n.extend({addHooks:function(){this._map.on("dblclick",this._onDoubleClick,this)},removeHooks:function(){this._map.off("dblclick",this._onDoubleClick,this)},_onDoubleClick:function(t){var e=this._map,i=e.getZoom(),n=e.options.zoomDelta,i=t.originalEvent.shiftKey?i-n:i+n;"center"===e.options.doubleClickZoom?e.setZoom(i):e.setZoomAround(t.containerPoint,i)}})),Zt=(A.addInitHook("addHandler","doubleClickZoom",Ct),A.mergeOptions({dragging:!0,inertia:!0,inertiaDeceleration:3400,inertiaMaxSpeed:1/0,easeLinearity:.2,worldCopyJump:!1,maxBoundsViscosity:0}),n.extend({addHooks:function(){var t;this._draggable||(t=this._map,this._draggable=new Xe(t._mapPane,t._container),this._draggable.on({dragstart:this._onDragStart,drag:this._onDrag,dragend:this._onDragEnd},this),this._draggable.on("predrag",this._onPreDragLimit,this),t.options.worldCopyJump&&(this._draggable.on("predrag",this._onPreDragWrap,this),t.on("zoomend",this._onZoomEnd,this),t.whenReady(this._onZoomEnd,this))),M(this._map._container,"leaflet-grab leaflet-touch-drag"),this._draggable.enable(),this._positions=[],this._times=[]},removeHooks:function(){z(this._map._container,"leaflet-grab"),z(this._map._container,"leaflet-touch-drag"),this._draggable.disable()},moved:function(){return this._draggable&&this._draggable._moved},moving:function(){return this._draggable&&this._draggable._moving},_onDragStart:function(){var t,e=this._map;e._stop(),this._map.options.maxBounds&&this._map.options.maxBoundsViscosity?(t=g(this._map.options.maxBounds),this._offsetLimit=_(this._map.latLngToContainerPoint(t.getNorthWest()).multiplyBy(-1),this._map.latLngToContainerPoint(t.getSouthEast()).multiplyBy(-1).add(this._map.getSize())),this._viscosity=Math.min(1,Math.max(0,this._map.options.maxBoundsViscosity))):this._offsetLimit=null,e.fire("movestart").fire("dragstart"),e.options.inertia&&(this._positions=[],this._times=[])},_onDrag:function(t){var e,i;this._map.options.inertia&&(e=this._lastTime=+new Date,i=this._lastPos=this._draggable._absPos||this._draggable._newPos,this._positions.push(i),this._times.push(e),this._prunePositions(e)),this._map.fire("move",t).fire("drag",t)},_prunePositions:function(t){for(;1<this._positions.length&&50<t-this._times[0];)this._positions.shift(),this._times.shift()},_onZoomEnd:function(){var t=this._map.getSize().divideBy(2),e=this._map.latLngToLayerPoint([0,0]);this._initialWorldOffset=e.subtract(t).x,this._worldWidth=this._map.getPixelWorldBounds().getSize().x},_viscousLimit:function(t,e){return t-(t-e)*this._viscosity},_onPreDragLimit:function(){var t,e;this._viscosity&&this._offsetLimit&&(t=this._draggable._newPos.subtract(this._draggable._startPos),e=this._offsetLimit,t.x<e.min.x&&(t.x=this._viscousLimit(t.x,e.min.x)),t.y<e.min.y&&(t.y=this._viscousLimit(t.y,e.min.y)),t.x>e.max.x&&(t.x=this._viscousLimit(t.x,e.max.x)),t.y>e.max.y&&(t.y=this._viscousLimit(t.y,e.max.y)),this._draggable._newPos=this._draggable._startPos.add(t))},_onPreDragWrap:function(){var t=this._worldWidth,e=Math.round(t/2),i=this._initialWorldOffset,n=this._draggable._newPos.x,o=(n-e+i)%t+e-i,n=(n+e+i)%t-e-i,t=Math.abs(o+i)<Math.abs(n+i)?o:n;this._draggable._absPos=this._draggable._newPos.clone(),this._draggable._newPos.x=t},_onDragEnd:function(t){var e,i,n,o,s=this._map,r=s.options,a=!r.inertia||t.noInertia||this._times.length<2;s.fire("dragend",t),!a&&(this._prunePositions(+new Date),t=this._lastPos.subtract(this._positions[0]),a=(this._lastTime-this._times[0])/1e3,e=r.easeLinearity,a=(t=t.multiplyBy(e/a)).distanceTo([0,0]),i=Math.min(r.inertiaMaxSpeed,a),t=t.multiplyBy(i/a),n=i/(r.inertiaDeceleration*e),(o=t.multiplyBy(-n/2).round()).x||o.y)?(o=s._limitOffset(o,s.options.maxBounds),x(function(){s.panBy(o,{duration:n,easeLinearity:e,noMoveStart:!0,animate:!0})})):s.fire("moveend")}})),St=(A.addInitHook("addHandler","dragging",Zt),A.mergeOptions({keyboard:!0,keyboardPanDelta:80}),n.extend({keyCodes:{left:[37],right:[39],down:[40],up:[38],zoomIn:[187,107,61,171],zoomOut:[189,109,54,173]},initialize:function(t){this._map=t,this._setPanDelta(t.options.keyboardPanDelta),this._setZoomDelta(t.options.zoomDelta)},addHooks:function(){var t=this._map._container;t.tabIndex<=0&&(t.tabIndex="0"),S(t,{focus:this._onFocus,blur:this._onBlur,mousedown:this._onMouseDown},this),this._map.on({focus:this._addHooks,blur:this._removeHooks},this)},removeHooks:function(){this._removeHooks(),k(this._map._container,{focus:this._onFocus,blur:this._onBlur,mousedown:this._onMouseDown},this),this._map.off({focus:this._addHooks,blur:this._removeHooks},this)},_onMouseDown:function(){var t,e,i;this._focused||(i=document.body,t=document.documentElement,e=i.scrollTop||t.scrollTop,i=i.scrollLeft||t.scrollLeft,this._map._container.focus(),window.scrollTo(i,e))},_onFocus:function(){this._focused=!0,this._map.fire("focus")},_onBlur:function(){this._focused=!1,this._map.fire("blur")},_setPanDelta:function(t){for(var e=this._panKeys={},i=this.keyCodes,n=0,o=i.left.length;n<o;n++)e[i.left[n]]=[-1*t,0];for(n=0,o=i.right.length;n<o;n++)e[i.right[n]]=[t,0];for(n=0,o=i.down.length;n<o;n++)e[i.down[n]]=[0,t];for(n=0,o=i.up.length;n<o;n++)e[i.up[n]]=[0,-1*t]},_setZoomDelta:function(t){for(var e=this._zoomKeys={},i=this.keyCodes,n=0,o=i.zoomIn.length;n<o;n++)e[i.zoomIn[n]]=t;for(n=0,o=i.zoomOut.length;n<o;n++)e[i.zoomOut[n]]=-t},_addHooks:function(){S(document,"keydown",this._onKeyDown,this)},_removeHooks:function(){k(document,"keydown",this._onKeyDown,this)},_onKeyDown:function(t){if(!(t.altKey||t.ctrlKey||t.metaKey)){var e,i,n=t.keyCode,o=this._map;if(n in this._panKeys)o._panAnim&&o._panAnim._inProgress||(i=this._panKeys[n],t.shiftKey&&(i=m(i).multiplyBy(3)),o.options.maxBounds&&(i=o._limitOffset(m(i),o.options.maxBounds)),o.options.worldCopyJump?(e=o.wrapLatLng(o.unproject(o.project(o.getCenter()).add(i))),o.panTo(e)):o.panBy(i));else if(n in this._zoomKeys)o.setZoom(o.getZoom()+(t.shiftKey?3:1)*this._zoomKeys[n]);else{if(27!==n||!o._popup||!o._popup.options.closeOnEscapeKey)return;o.closePopup()}Re(t)}}})),Et=(A.addInitHook("addHandler","keyboard",St),A.mergeOptions({scrollWheelZoom:!0,wheelDebounceTime:40,wheelPxPerZoomLevel:60}),n.extend({addHooks:function(){S(this._map._container,"wheel",this._onWheelScroll,this),this._delta=0},removeHooks:function(){k(this._map._container,"wheel",this._onWheelScroll,this)},_onWheelScroll:function(t){var e=He(t),i=this._map.options.wheelDebounceTime,e=(this._delta+=e,this._lastMousePos=this._map.mouseEventToContainerPoint(t),this._startTime||(this._startTime=+new Date),Math.max(i-(+new Date-this._startTime),0));clearTimeout(this._timer),this._timer=setTimeout(a(this._performZoom,this),e),Re(t)},_performZoom:function(){var t=this._map,e=t.getZoom(),i=this._map.options.zoomSnap||0,n=(t._stop(),this._delta/(4*this._map.options.wheelPxPerZoomLevel)),n=4*Math.log(2/(1+Math.exp(-Math.abs(n))))/Math.LN2,i=i?Math.ceil(n/i)*i:n,n=t._limitZoom(e+(0<this._delta?i:-i))-e;this._delta=0,this._startTime=null,n&&("center"===t.options.scrollWheelZoom?t.setZoom(e+n):t.setZoomAround(this._lastMousePos,e+n))}})),kt=(A.addInitHook("addHandler","scrollWheelZoom",Et),A.mergeOptions({tapHold:b.touchNative&&b.safari&&b.mobile,tapTolerance:15}),n.extend({addHooks:function(){S(this._map._container,"touchstart",this._onDown,this)},removeHooks:function(){k(this._map._container,"touchstart",this._onDown,this)},_onDown:function(t){var e;clearTimeout(this._holdTimeout),1===t.touches.length&&(e=t.touches[0],this._startPos=this._newPos=new p(e.clientX,e.clientY),this._holdTimeout=setTimeout(a(function(){this._cancel(),this._isTapValid()&&(S(document,"touchend",O),S(document,"touchend touchcancel",this._cancelClickPrevent),this._simulateEvent("contextmenu",e))},this),600),S(document,"touchend touchcancel contextmenu",this._cancel,this),S(document,"touchmove",this._onMove,this))},_cancelClickPrevent:function t(){k(document,"touchend",O),k(document,"touchend touchcancel",t)},_cancel:function(){clearTimeout(this._holdTimeout),k(document,"touchend touchcancel contextmenu",this._cancel,this),k(document,"touchmove",this._onMove,this)},_onMove:function(t){t=t.touches[0];this._newPos=new p(t.clientX,t.clientY)},_isTapValid:function(){return this._newPos.distanceTo(this._startPos)<=this._map.options.tapTolerance},_simulateEvent:function(t,e){t=new MouseEvent(t,{bubbles:!0,cancelable:!0,view:window,screenX:e.screenX,screenY:e.screenY,clientX:e.clientX,clientY:e.clientY});t._simulated=!0,e.target.dispatchEvent(t)}})),Ot=(A.addInitHook("addHandler","tapHold",kt),A.mergeOptions({touchZoom:b.touch,bounceAtZoomLimits:!0}),n.extend({addHooks:function(){M(this._map._container,"leaflet-touch-zoom"),S(this._map._container,"touchstart",this._onTouchStart,this)},removeHooks:function(){z(this._map._container,"leaflet-touch-zoom"),k(this._map._container,"touchstart",this._onTouchStart,this)},_onTouchStart:function(t){var e,i,n=this._map;!t.touches||2!==t.touches.length||n._animatingZoom||this._zooming||(e=n.mouseEventToContainerPoint(t.touches[0]),i=n.mouseEventToContainerPoint(t.touches[1]),this._centerPoint=n.getSize()._divideBy(2),this._startLatLng=n.containerPointToLatLng(this._centerPoint),"center"!==n.options.touchZoom&&(this._pinchStartLatLng=n.containerPointToLatLng(e.add(i)._divideBy(2))),this._startDist=e.distanceTo(i),this._startZoom=n.getZoom(),this._moved=!1,this._zooming=!0,n._stop(),S(document,"touchmove",this._onTouchMove,this),S(document,"touchend touchcancel",this._onTouchEnd,this),O(t))},_onTouchMove:function(t){if(t.touches&&2===t.touches.length&&this._zooming){var e=this._map,i=e.mouseEventToContainerPoint(t.touches[0]),n=e.mouseEventToContainerPoint(t.touches[1]),o=i.distanceTo(n)/this._startDist;if(this._zoom=e.getScaleZoom(o,this._startZoom),!e.options.bounceAtZoomLimits&&(this._zoom<e.getMinZoom()&&o<1||this._zoom>e.getMaxZoom()&&1<o)&&(this._zoom=e._limitZoom(this._zoom)),"center"===e.options.touchZoom){if(this._center=this._startLatLng,1==o)return}else{i=i._add(n)._divideBy(2)._subtract(this._centerPoint);if(1==o&&0===i.x&&0===i.y)return;this._center=e.unproject(e.project(this._pinchStartLatLng,this._zoom).subtract(i),this._zoom)}this._moved||(e._moveStart(!0,!1),this._moved=!0),r(this._animRequest);n=a(e._move,e,this._center,this._zoom,{pinch:!0,round:!1},void 0);this._animRequest=x(n,this,!0),O(t)}},_onTouchEnd:function(){this._moved&&this._zooming?(this._zooming=!1,r(this._animRequest),k(document,"touchmove",this._onTouchMove,this),k(document,"touchend touchcancel",this._onTouchEnd,this),this._map.options.zoomAnimation?this._map._animateZoom(this._center,this._map._limitZoom(this._zoom),!0,this._map.options.zoomSnap):this._map._resetView(this._center,this._map._limitZoom(this._zoom))):this._zooming=!1}})),Xi=(A.addInitHook("addHandler","touchZoom",Ot),A.BoxZoom=_t,A.DoubleClickZoom=Ct,A.Drag=Zt,A.Keyboard=St,A.ScrollWheelZoom=Et,A.TapHold=kt,A.TouchZoom=Ot,t.Bounds=f,t.Browser=b,t.CRS=ot,t.Canvas=Fi,t.Circle=vi,t.CircleMarker=gi,t.Class=et,t.Control=B,t.DivIcon=Ri,t.DivOverlay=Ai,t.DomEvent=mt,t.DomUtil=pt,t.Draggable=Xe,t.Evented=it,t.FeatureGroup=ci,t.GeoJSON=wi,t.GridLayer=Ni,t.Handler=n,t.Icon=di,t.ImageOverlay=Ei,t.LatLng=v,t.LatLngBounds=s,t.Layer=o,t.LayerGroup=ui,t.LineUtil=vt,t.Map=A,t.Marker=mi,t.Mixin=ft,t.Path=fi,t.Point=p,t.PolyUtil=gt,t.Polygon=xi,t.Polyline=yi,t.Popup=Bi,t.PosAnimation=Fe,t.Projection=wt,t.Rectangle=Yi,t.Renderer=Wi,t.SVG=Gi,t.SVGOverlay=Oi,t.TileLayer=Di,t.Tooltip=Ii,t.Transformation=at,t.Util=tt,t.VideoOverlay=ki,t.bind=a,t.bounds=_,t.canvas=Ui,t.circle=function(t,e,i){return new vi(t,e,i)},t.circleMarker=function(t,e){return new gi(t,e)},t.control=Ue,t.divIcon=function(t){return new Ri(t)},t.extend=l,t.featureGroup=function(t,e){return new ci(t,e)},t.geoJSON=Si,t.geoJson=Mt,t.gridLayer=function(t){return new Ni(t)},t.icon=function(t){return new di(t)},t.imageOverlay=function(t,e,i){return new Ei(t,e,i)},t.latLng=w,t.latLngBounds=g,t.layerGroup=function(t,e){return new ui(t,e)},t.map=function(t,e){return new A(t,e)},t.marker=function(t,e){return new mi(t,e)},t.point=m,t.polygon=function(t,e){return new xi(t,e)},t.polyline=function(t,e){return new yi(t,e)},t.popup=function(t,e){return new Bi(t,e)},t.rectangle=function(t,e){return new Yi(t,e)},t.setOptions=c,t.stamp=h,t.svg=Ki,t.svgOverlay=function(t,e,i){return new Oi(t,e,i)},t.tileLayer=ji,t.tooltip=function(t,e){return new Ii(t,e)},t.transformation=ht,t.version="1.9.4",t.videoOverlay=function(t,e,i){return new ki(t,e,i)},window.L);t.noConflict=function(){return window.L=Xi,this},window.L=t});
  const L = module.exports && module.exports.map ? module.exports : exports;
  try { L.noConflict(); } catch (e) { /* zostaw window.L */ }
  LEAFLET_LIB.L = L;
  return L;
}
const LEAFLET_CSS = "/* required styles */\n\n.leaflet-pane,\n.leaflet-tile,\n.leaflet-marker-icon,\n.leaflet-marker-shadow,\n.leaflet-tile-container,\n.leaflet-pane > svg,\n.leaflet-pane > canvas,\n.leaflet-zoom-box,\n.leaflet-image-layer,\n.leaflet-layer {\n\tposition: absolute;\n\tleft: 0;\n\ttop: 0;\n\t}\n.leaflet-container {\n\toverflow: hidden;\n\t}\n.leaflet-tile,\n.leaflet-marker-icon,\n.leaflet-marker-shadow {\n\t-webkit-user-select: none;\n\t   -moz-user-select: none;\n\t        user-select: none;\n\t  -webkit-user-drag: none;\n\t}\n/* Prevents IE11 from highlighting tiles in blue */\n.leaflet-tile::selection {\n\tbackground: transparent;\n}\n/* Safari renders non-retina tile on retina better with this, but Chrome is worse */\n.leaflet-safari .leaflet-tile {\n\timage-rendering: -webkit-optimize-contrast;\n\t}\n/* hack that prevents hw layers \"stretching\" when loading new tiles */\n.leaflet-safari .leaflet-tile-container {\n\twidth: 1600px;\n\theight: 1600px;\n\t-webkit-transform-origin: 0 0;\n\t}\n.leaflet-marker-icon,\n.leaflet-marker-shadow {\n\tdisplay: block;\n\t}\n/* .leaflet-container svg: reset svg max-width decleration shipped in Joomla! (joomla.org) 3.x */\n/* .leaflet-container img: map is broken in FF if you have max-width: 100% on tiles */\n.leaflet-container .leaflet-overlay-pane svg {\n\tmax-width: none !important;\n\tmax-height: none !important;\n\t}\n.leaflet-container .leaflet-marker-pane img,\n.leaflet-container .leaflet-shadow-pane img,\n.leaflet-container .leaflet-tile-pane img,\n.leaflet-container img.leaflet-image-layer,\n.leaflet-container .leaflet-tile {\n\tmax-width: none !important;\n\tmax-height: none !important;\n\twidth: auto;\n\tpadding: 0;\n\t}\n\n.leaflet-container img.leaflet-tile {\n\t/* See: https://bugs.chromium.org/p/chromium/issues/detail?id=600120 */\n\tmix-blend-mode: plus-lighter;\n}\n\n.leaflet-container.leaflet-touch-zoom {\n\t-ms-touch-action: pan-x pan-y;\n\ttouch-action: pan-x pan-y;\n\t}\n.leaflet-container.leaflet-touch-drag {\n\t-ms-touch-action: pinch-zoom;\n\t/* Fallback for FF which doesn't support pinch-zoom */\n\ttouch-action: none;\n\ttouch-action: pinch-zoom;\n}\n.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom {\n\t-ms-touch-action: none;\n\ttouch-action: none;\n}\n.leaflet-container {\n\t-webkit-tap-highlight-color: transparent;\n}\n.leaflet-container a {\n\t-webkit-tap-highlight-color: rgba(51, 181, 229, 0.4);\n}\n.leaflet-tile {\n\tfilter: inherit;\n\tvisibility: hidden;\n\t}\n.leaflet-tile-loaded {\n\tvisibility: inherit;\n\t}\n.leaflet-zoom-box {\n\twidth: 0;\n\theight: 0;\n\t-moz-box-sizing: border-box;\n\t     box-sizing: border-box;\n\tz-index: 800;\n\t}\n/* workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=888319 */\n.leaflet-overlay-pane svg {\n\t-moz-user-select: none;\n\t}\n\n.leaflet-pane         { z-index: 400; }\n\n.leaflet-tile-pane    { z-index: 200; }\n.leaflet-overlay-pane { z-index: 400; }\n.leaflet-shadow-pane  { z-index: 500; }\n.leaflet-marker-pane  { z-index: 600; }\n.leaflet-tooltip-pane   { z-index: 650; }\n.leaflet-popup-pane   { z-index: 700; }\n\n.leaflet-map-pane canvas { z-index: 100; }\n.leaflet-map-pane svg    { z-index: 200; }\n\n.leaflet-vml-shape {\n\twidth: 1px;\n\theight: 1px;\n\t}\n.lvml {\n\tbehavior: url(#default#VML);\n\tdisplay: inline-block;\n\tposition: absolute;\n\t}\n\n\n/* control positioning */\n\n.leaflet-control {\n\tposition: relative;\n\tz-index: 800;\n\tpointer-events: visiblePainted; /* IE 9-10 doesn't have auto */\n\tpointer-events: auto;\n\t}\n.leaflet-top,\n.leaflet-bottom {\n\tposition: absolute;\n\tz-index: 1000;\n\tpointer-events: none;\n\t}\n.leaflet-top {\n\ttop: 0;\n\t}\n.leaflet-right {\n\tright: 0;\n\t}\n.leaflet-bottom {\n\tbottom: 0;\n\t}\n.leaflet-left {\n\tleft: 0;\n\t}\n.leaflet-control {\n\tfloat: left;\n\tclear: both;\n\t}\n.leaflet-right .leaflet-control {\n\tfloat: right;\n\t}\n.leaflet-top .leaflet-control {\n\tmargin-top: 10px;\n\t}\n.leaflet-bottom .leaflet-control {\n\tmargin-bottom: 10px;\n\t}\n.leaflet-left .leaflet-control {\n\tmargin-left: 10px;\n\t}\n.leaflet-right .leaflet-control {\n\tmargin-right: 10px;\n\t}\n\n\n/* zoom and fade animations */\n\n.leaflet-fade-anim .leaflet-popup {\n\topacity: 0;\n\t-webkit-transition: opacity 0.2s linear;\n\t   -moz-transition: opacity 0.2s linear;\n\t        transition: opacity 0.2s linear;\n\t}\n.leaflet-fade-anim .leaflet-map-pane .leaflet-popup {\n\topacity: 1;\n\t}\n.leaflet-zoom-animated {\n\t-webkit-transform-origin: 0 0;\n\t    -ms-transform-origin: 0 0;\n\t        transform-origin: 0 0;\n\t}\nsvg.leaflet-zoom-animated {\n\twill-change: transform;\n}\n\n.leaflet-zoom-anim .leaflet-zoom-animated {\n\t-webkit-transition: -webkit-transform 0.25s cubic-bezier(0,0,0.25,1);\n\t   -moz-transition:    -moz-transform 0.25s cubic-bezier(0,0,0.25,1);\n\t        transition:         transform 0.25s cubic-bezier(0,0,0.25,1);\n\t}\n.leaflet-zoom-anim .leaflet-tile,\n.leaflet-pan-anim .leaflet-tile {\n\t-webkit-transition: none;\n\t   -moz-transition: none;\n\t        transition: none;\n\t}\n\n.leaflet-zoom-anim .leaflet-zoom-hide {\n\tvisibility: hidden;\n\t}\n\n\n/* cursors */\n\n.leaflet-interactive {\n\tcursor: pointer;\n\t}\n.leaflet-grab {\n\tcursor: -webkit-grab;\n\tcursor:    -moz-grab;\n\tcursor:         grab;\n\t}\n.leaflet-crosshair,\n.leaflet-crosshair .leaflet-interactive {\n\tcursor: crosshair;\n\t}\n.leaflet-popup-pane,\n.leaflet-control {\n\tcursor: auto;\n\t}\n.leaflet-dragging .leaflet-grab,\n.leaflet-dragging .leaflet-grab .leaflet-interactive,\n.leaflet-dragging .leaflet-marker-draggable {\n\tcursor: move;\n\tcursor: -webkit-grabbing;\n\tcursor:    -moz-grabbing;\n\tcursor:         grabbing;\n\t}\n\n/* marker & overlays interactivity */\n.leaflet-marker-icon,\n.leaflet-marker-shadow,\n.leaflet-image-layer,\n.leaflet-pane > svg path,\n.leaflet-tile-container {\n\tpointer-events: none;\n\t}\n\n.leaflet-marker-icon.leaflet-interactive,\n.leaflet-image-layer.leaflet-interactive,\n.leaflet-pane > svg path.leaflet-interactive,\nsvg.leaflet-image-layer.leaflet-interactive path {\n\tpointer-events: visiblePainted; /* IE 9-10 doesn't have auto */\n\tpointer-events: auto;\n\t}\n\n/* visual tweaks */\n\n.leaflet-container {\n\tbackground: #ddd;\n\toutline-offset: 1px;\n\t}\n.leaflet-container a {\n\tcolor: #0078A8;\n\t}\n.leaflet-zoom-box {\n\tborder: 2px dotted #38f;\n\tbackground: rgba(255,255,255,0.5);\n\t}\n\n\n/* general typography */\n.leaflet-container {\n\tfont-family: \"Helvetica Neue\", Arial, Helvetica, sans-serif;\n\tfont-size: 12px;\n\tfont-size: 0.75rem;\n\tline-height: 1.5;\n\t}\n\n\n/* general toolbar styles */\n\n.leaflet-bar {\n\tbox-shadow: 0 1px 5px rgba(0,0,0,0.65);\n\tborder-radius: 4px;\n\t}\n.leaflet-bar a {\n\tbackground-color: #fff;\n\tborder-bottom: 1px solid #ccc;\n\twidth: 26px;\n\theight: 26px;\n\tline-height: 26px;\n\tdisplay: block;\n\ttext-align: center;\n\ttext-decoration: none;\n\tcolor: black;\n\t}\n.leaflet-bar a,\n.leaflet-control-layers-toggle {\n\tbackground-position: 50% 50%;\n\tbackground-repeat: no-repeat;\n\tdisplay: block;\n\t}\n.leaflet-bar a:hover,\n.leaflet-bar a:focus {\n\tbackground-color: #f4f4f4;\n\t}\n.leaflet-bar a:first-child {\n\tborder-top-left-radius: 4px;\n\tborder-top-right-radius: 4px;\n\t}\n.leaflet-bar a:last-child {\n\tborder-bottom-left-radius: 4px;\n\tborder-bottom-right-radius: 4px;\n\tborder-bottom: none;\n\t}\n.leaflet-bar a.leaflet-disabled {\n\tcursor: default;\n\tbackground-color: #f4f4f4;\n\tcolor: #bbb;\n\t}\n\n.leaflet-touch .leaflet-bar a {\n\twidth: 30px;\n\theight: 30px;\n\tline-height: 30px;\n\t}\n.leaflet-touch .leaflet-bar a:first-child {\n\tborder-top-left-radius: 2px;\n\tborder-top-right-radius: 2px;\n\t}\n.leaflet-touch .leaflet-bar a:last-child {\n\tborder-bottom-left-radius: 2px;\n\tborder-bottom-right-radius: 2px;\n\t}\n\n/* zoom control */\n\n.leaflet-control-zoom-in,\n.leaflet-control-zoom-out {\n\tfont: bold 18px 'Lucida Console', Monaco, monospace;\n\ttext-indent: 1px;\n\t}\n\n.leaflet-touch .leaflet-control-zoom-in, .leaflet-touch .leaflet-control-zoom-out  {\n\tfont-size: 22px;\n\t}\n\n\n/* layers control */\n\n.leaflet-control-layers {\n\tbox-shadow: 0 1px 5px rgba(0,0,0,0.4);\n\tbackground: #fff;\n\tborder-radius: 5px;\n\t}\n.leaflet-control-layers-toggle {\n\tbackground-image: url(images/layers.png);\n\twidth: 36px;\n\theight: 36px;\n\t}\n.leaflet-retina .leaflet-control-layers-toggle {\n\tbackground-image: url(images/layers-2x.png);\n\tbackground-size: 26px 26px;\n\t}\n.leaflet-touch .leaflet-control-layers-toggle {\n\twidth: 44px;\n\theight: 44px;\n\t}\n.leaflet-control-layers .leaflet-control-layers-list,\n.leaflet-control-layers-expanded .leaflet-control-layers-toggle {\n\tdisplay: none;\n\t}\n.leaflet-control-layers-expanded .leaflet-control-layers-list {\n\tdisplay: block;\n\tposition: relative;\n\t}\n.leaflet-control-layers-expanded {\n\tpadding: 6px 10px 6px 6px;\n\tcolor: #333;\n\tbackground: #fff;\n\t}\n.leaflet-control-layers-scrollbar {\n\toverflow-y: scroll;\n\toverflow-x: hidden;\n\tpadding-right: 5px;\n\t}\n.leaflet-control-layers-selector {\n\tmargin-top: 2px;\n\tposition: relative;\n\ttop: 1px;\n\t}\n.leaflet-control-layers label {\n\tdisplay: block;\n\tfont-size: 13px;\n\tfont-size: 1.08333em;\n\t}\n.leaflet-control-layers-separator {\n\theight: 0;\n\tborder-top: 1px solid #ddd;\n\tmargin: 5px -10px 5px -6px;\n\t}\n\n/* Default icon URLs */\n.leaflet-default-icon-path { /* used only in path-guessing heuristic, see L.Icon.Default */\n\tbackground-image: url(images/marker-icon.png);\n\t}\n\n\n/* attribution and scale controls */\n\n.leaflet-container .leaflet-control-attribution {\n\tbackground: #fff;\n\tbackground: rgba(255, 255, 255, 0.8);\n\tmargin: 0;\n\t}\n.leaflet-control-attribution,\n.leaflet-control-scale-line {\n\tpadding: 0 5px;\n\tcolor: #333;\n\tline-height: 1.4;\n\t}\n.leaflet-control-attribution a {\n\ttext-decoration: none;\n\t}\n.leaflet-control-attribution a:hover,\n.leaflet-control-attribution a:focus {\n\ttext-decoration: underline;\n\t}\n.leaflet-attribution-flag {\n\tdisplay: inline !important;\n\tvertical-align: baseline !important;\n\twidth: 1em;\n\theight: 0.6669em;\n\t}\n.leaflet-left .leaflet-control-scale {\n\tmargin-left: 5px;\n\t}\n.leaflet-bottom .leaflet-control-scale {\n\tmargin-bottom: 5px;\n\t}\n.leaflet-control-scale-line {\n\tborder: 2px solid #777;\n\tborder-top: none;\n\tline-height: 1.1;\n\tpadding: 2px 5px 1px;\n\twhite-space: nowrap;\n\t-moz-box-sizing: border-box;\n\t     box-sizing: border-box;\n\tbackground: rgba(255, 255, 255, 0.8);\n\ttext-shadow: 1px 1px #fff;\n\t}\n.leaflet-control-scale-line:not(:first-child) {\n\tborder-top: 2px solid #777;\n\tborder-bottom: none;\n\tmargin-top: -2px;\n\t}\n.leaflet-control-scale-line:not(:first-child):not(:last-child) {\n\tborder-bottom: 2px solid #777;\n\t}\n\n.leaflet-touch .leaflet-control-attribution,\n.leaflet-touch .leaflet-control-layers,\n.leaflet-touch .leaflet-bar {\n\tbox-shadow: none;\n\t}\n.leaflet-touch .leaflet-control-layers,\n.leaflet-touch .leaflet-bar {\n\tborder: 2px solid rgba(0,0,0,0.2);\n\tbackground-clip: padding-box;\n\t}\n\n\n/* popup */\n\n.leaflet-popup {\n\tposition: absolute;\n\ttext-align: center;\n\tmargin-bottom: 20px;\n\t}\n.leaflet-popup-content-wrapper {\n\tpadding: 1px;\n\ttext-align: left;\n\tborder-radius: 12px;\n\t}\n.leaflet-popup-content {\n\tmargin: 13px 24px 13px 20px;\n\tline-height: 1.3;\n\tfont-size: 13px;\n\tfont-size: 1.08333em;\n\tmin-height: 1px;\n\t}\n.leaflet-popup-content p {\n\tmargin: 17px 0;\n\tmargin: 1.3em 0;\n\t}\n.leaflet-popup-tip-container {\n\twidth: 40px;\n\theight: 20px;\n\tposition: absolute;\n\tleft: 50%;\n\tmargin-top: -1px;\n\tmargin-left: -20px;\n\toverflow: hidden;\n\tpointer-events: none;\n\t}\n.leaflet-popup-tip {\n\twidth: 17px;\n\theight: 17px;\n\tpadding: 1px;\n\n\tmargin: -10px auto 0;\n\tpointer-events: auto;\n\n\t-webkit-transform: rotate(45deg);\n\t   -moz-transform: rotate(45deg);\n\t    -ms-transform: rotate(45deg);\n\t        transform: rotate(45deg);\n\t}\n.leaflet-popup-content-wrapper,\n.leaflet-popup-tip {\n\tbackground: white;\n\tcolor: #333;\n\tbox-shadow: 0 3px 14px rgba(0,0,0,0.4);\n\t}\n.leaflet-container a.leaflet-popup-close-button {\n\tposition: absolute;\n\ttop: 0;\n\tright: 0;\n\tborder: none;\n\ttext-align: center;\n\twidth: 24px;\n\theight: 24px;\n\tfont: 16px/24px Tahoma, Verdana, sans-serif;\n\tcolor: #757575;\n\ttext-decoration: none;\n\tbackground: transparent;\n\t}\n.leaflet-container a.leaflet-popup-close-button:hover,\n.leaflet-container a.leaflet-popup-close-button:focus {\n\tcolor: #585858;\n\t}\n.leaflet-popup-scrolled {\n\toverflow: auto;\n\t}\n\n.leaflet-oldie .leaflet-popup-content-wrapper {\n\t-ms-zoom: 1;\n\t}\n.leaflet-oldie .leaflet-popup-tip {\n\twidth: 24px;\n\tmargin: 0 auto;\n\n\t-ms-filter: \"progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678)\";\n\tfilter: progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678);\n\t}\n\n.leaflet-oldie .leaflet-control-zoom,\n.leaflet-oldie .leaflet-control-layers,\n.leaflet-oldie .leaflet-popup-content-wrapper,\n.leaflet-oldie .leaflet-popup-tip {\n\tborder: 1px solid #999;\n\t}\n\n\n/* div icon */\n\n.leaflet-div-icon {\n\tbackground: #fff;\n\tborder: 1px solid #666;\n\t}\n\n\n/* Tooltip */\n/* Base styles for the element that has a tooltip */\n.leaflet-tooltip {\n\tposition: absolute;\n\tpadding: 6px;\n\tbackground-color: #fff;\n\tborder: 1px solid #fff;\n\tborder-radius: 3px;\n\tcolor: #222;\n\twhite-space: nowrap;\n\t-webkit-user-select: none;\n\t-moz-user-select: none;\n\t-ms-user-select: none;\n\tuser-select: none;\n\tpointer-events: none;\n\tbox-shadow: 0 1px 3px rgba(0,0,0,0.4);\n\t}\n.leaflet-tooltip.leaflet-interactive {\n\tcursor: pointer;\n\tpointer-events: auto;\n\t}\n.leaflet-tooltip-top:before,\n.leaflet-tooltip-bottom:before,\n.leaflet-tooltip-left:before,\n.leaflet-tooltip-right:before {\n\tposition: absolute;\n\tpointer-events: none;\n\tborder: 6px solid transparent;\n\tbackground: transparent;\n\tcontent: \"\";\n\t}\n\n/* Directions */\n\n.leaflet-tooltip-bottom {\n\tmargin-top: 6px;\n}\n.leaflet-tooltip-top {\n\tmargin-top: -6px;\n}\n.leaflet-tooltip-bottom:before,\n.leaflet-tooltip-top:before {\n\tleft: 50%;\n\tmargin-left: -6px;\n\t}\n.leaflet-tooltip-top:before {\n\tbottom: 0;\n\tmargin-bottom: -12px;\n\tborder-top-color: #fff;\n\t}\n.leaflet-tooltip-bottom:before {\n\ttop: 0;\n\tmargin-top: -12px;\n\tmargin-left: -6px;\n\tborder-bottom-color: #fff;\n\t}\n.leaflet-tooltip-left {\n\tmargin-left: -6px;\n}\n.leaflet-tooltip-right {\n\tmargin-left: 6px;\n}\n.leaflet-tooltip-left:before,\n.leaflet-tooltip-right:before {\n\ttop: 50%;\n\tmargin-top: -6px;\n\t}\n.leaflet-tooltip-left:before {\n\tright: 0;\n\tmargin-right: -12px;\n\tborder-left-color: #fff;\n\t}\n.leaflet-tooltip-right:before {\n\tleft: 0;\n\tmargin-left: -12px;\n\tborder-right-color: #fff;\n\t}\n\n/* Printing */\n\n@media print {\n\t/* Prevent printers from removing background-images of controls. */\n\t.leaflet-control {\n\t\t-webkit-print-color-adjust: exact;\n\t\tprint-color-adjust: exact;\n\t\t}\n\t}\n";
console.info('%c COMPIT-NANO-ONE-CARD %c ' + VERSION + ' ', 'background:#2f8fd8;color:#fff', 'background:#444;color:#fff');
})();
