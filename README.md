# Compit Nano One – karta rekuperacji dla Home Assistant

Karta Lovelace dla rekuperacji sterowanej przez **Compit Nano One** (RS485, protokół C14), czytanej przez ESP z ESPHome.
Jeden plik JS, bez zależności (nie wymaga button-card, card-mod ani apexcharts).

![podgląd](docs/podglad.png)

Podgląd jest zrobiony na przykładowych wartościach.

## Co jest w karcie

**Zakładka Rekuperator**
- schemat centrali: czerpnia, nawiew, wywiew, wyrzutnia, kręcące się wentylatory z % wysterowania, stan bypassu
- sprawność odzysku (z encji `sprawnosc_odzysku`, a jak jej nie ma, liczona z temperatur)
- bieg, tryb, bieg zadany, harmonogram, temp. pokojowa i zadana, wilgotność, CO₂, przepływ, obroty, nagrzewnica, GWC, kominek, filtry, alarm, ostrzeżenie, godziny pracy, wersja Nano One
- **Pozostałe z ESP**: każda inna encja z tym samym prefiksem, której karta nie zna z nazwy, pokazuje się sama jako kafel. Jak dodasz coś w YAML-u, pojawi się w karcie bez aktualizacji karty.

**Zakładka Diagnostyka**
- **Cały log do skopiowania**: zakres 1 h / 6 h / 1 d / 3 d / 7 d, przycisk *Kopiuj cały log* i *Pobierz .txt*. Bierze całą historię HA wszystkich encji `<prefix>_*` (diagnostyka ESP, surowe ramki C14, temperatury, alarmy…) plus stan bieżący, posortowane po czasie. Działa też, gdy HA jest po `http://` (wtedy kopiuje starym sposobem, a jak przeglądarka nie pozwoli, pokazuje log w polu do zaznaczenia).
- ESP: online/offline, sygnał WiFi z oceną, czas pracy, IP, SSID, wersja ESPHome
- magistrala RS485/C14: stan (ramki płyną / cisza / brak), ramki poprawne i błędne z % błędów, ramki na minutę, czas ostatniej ramki, wykryte adresy z nazwami (41 = NANO 1, 99 = AERO, 112 = iNext…)
- ostatnie ramki C14 (historia + na żywo) z dekoderem: bajty w HEX, adres docelowy, nadawca, komenda, suma, znacznik końca `#`, pary H/L przeliczone na temperatury
- log zdarzeń ESP (encja `diagnostyka_esp` + zmiany alarmu, trybu, biegu, bypassu, filtrów, statusu)
- lista wszystkich encji z prefiksem i lista encji, których karta szuka, a ich nie ma

Kliknięcie w wartość otwiera standardowe okno encji HA. Karta tylko czyta, niczego nie zmienia w centrali.

## Instalacja przez HACS

1. HACS → ⋮ → **Custom repositories** → `https://github.com/voltronicpl/compit-nano-one-ha`, typ **Dashboard** → Dodaj → Pobierz. Przeładuj przeglądarkę.
2. Dodaj kartę:
   ```yaml
   type: custom:compit-nano-one-card
   # opcjonalnie:
   # prefix: nano_one          # początek ID encji z ESPHome (domyślnie nano_one)
   # title: Rekuperacja
   # tab: diagnostyka          # zakładka startowa
   # history_hours: 6          # ile godzin wstecz pokazuje ramki i log w Diagnostyce
   # entities:                 # gdy jakaś encja ma inne ID
   #   t_nawiew: sensor.moja_temperatura_nawiewu
   ```

## Encje

Karta szuka encji `<domena>.<prefix>_<końcówka>`. Jeśli nie ma jej w podanej domenie, szuka tej samej końcówki w innych (sensor, binary_sensor, select, number, switch…). Każdą można nadpisać w `entities:`.

Surowa ramka (`ostatnia_ramka`) to tekst HEX, np. `A9 10 35 63 … 23`. Może być ze spacjami lub bez, kilka ramek można rozdzielić `|` albo nową linią.

| klucz | domyślna encja | co to |
|---|---|---|
| `t_czerpnia` | `sensor.<prefix>_temperatura_czerpni` | Czerpnia (zewn.) |
| `t_nawiew` | `sensor.<prefix>_temperatura_nawiewu` | Nawiew |
| `t_wywiew` | `sensor.<prefix>_temperatura_wywiewu` | Wywiew |
| `t_wyrzutnia` | `sensor.<prefix>_temperatura_wyrzutni` | Wyrzutnia |
| `t_pokoj` | `sensor.<prefix>_temperatura_pokojowa` | Temp. w pokoju |
| `t_zadana` | `sensor.<prefix>_temperatura_zadana` | Temp. zadana |
| `wilgotnosc` | `sensor.<prefix>_wilgotnosc` | Wilgotność |
| `co2` | `sensor.<prefix>_co2` | CO₂ |
| `bieg` | `sensor.<prefix>_bieg` | Bieg |
| `went_nawiew` | `sensor.<prefix>_wentylator_nawiewu` | Went. nawiewu |
| `went_wywiew` | `sensor.<prefix>_wentylator_wywiewu` | Went. wywiewu |
| `tryb` | `sensor.<prefix>_tryb` | Tryb |
| `bypass` | `binary_sensor.<prefix>_bypass` | Bypass |
| `nagrzewnica` | `binary_sensor.<prefix>_nagrzewnica` | Nagrzewnica |
| `rozmrazanie` | `binary_sensor.<prefix>_rozmrazanie` | Rozmrażanie |
| `filtr` | `sensor.<prefix>_filtr` | Filtry |
| `filtr_dni` | `sensor.<prefix>_filtr_dni_do_wymiany` | Filtry: dni do wymiany |
| `alarm` | `sensor.<prefix>_alarm` | Alarm |
| `ostrzezenie` | `sensor.<prefix>_ostrzezenie` | Ostrzeżenie |
| `obroty_nawiew` | `sensor.<prefix>_obroty_nawiewu` | Obroty nawiewu |
| `obroty_wywiew` | `sensor.<prefix>_obroty_wywiewu` | Obroty wywiewu |
| `przeplyw` | `sensor.<prefix>_przeplyw` | Przepływ |
| `t_nagrzewnica` | `sensor.<prefix>_temperatura_nagrzewnicy` | Temp. nagrzewnicy |
| `t_gwc` | `sensor.<prefix>_temperatura_gwc` | Temp. GWC |
| `gwc` | `sensor.<prefix>_gwc` | GWC |
| `kominek` | `sensor.<prefix>_kominek` | Kominek |
| `harmonogram` | `sensor.<prefix>_harmonogram` | Harmonogram |
| `bieg_zadany` | `sensor.<prefix>_bieg_zadany` | Bieg zadany |
| `sprawnosc` | `sensor.<prefix>_sprawnosc_odzysku` | Sprawność odzysku |
| `godziny_pracy` | `sensor.<prefix>_godziny_pracy` | Godziny pracy |
| `wersja_nano` | `sensor.<prefix>_wersja_nano_one` | Wersja Nano One |
| `status` | `binary_sensor.<prefix>_status` | ESP online |
| `wifi` | `sensor.<prefix>_wifi_sygnal` | WiFi sygnał |
| `uptime` | `sensor.<prefix>_czas_pracy` | Czas pracy ESP |
| `ip` | `sensor.<prefix>_ip` | Adres IP |
| `ssid` | `sensor.<prefix>_ssid` | SSID |
| `wersja` | `sensor.<prefix>_wersja_esphome` | Wersja ESPHome |
| `diag` | `sensor.<prefix>_diagnostyka_esp` | Diagnostyka ESP |
| `ramka` | `sensor.<prefix>_ostatnia_ramka` | Ostatnia ramka C14 |
| `ramki_ok` | `sensor.<prefix>_ramki_ok` | Ramki poprawne |
| `ramki_bledne` | `sensor.<prefix>_ramki_bledne` | Ramki błędne |
| `ramki_min` | `sensor.<prefix>_ramki_na_minute` | Ramki / min |
| `ramka_wiek` | `sensor.<prefix>_wiek_ostatniej_ramki` | Od ostatniej ramki |
| `adresy` | `sensor.<prefix>_wykryte_adresy` | Wykryte adresy C14 |
| `magistrala` | `binary_sensor.<prefix>_magistrala_c14` | Magistrala C14 |

Kafle encji, których nie ma w HA (np. filtry, alarm, CO₂ w YAML v1.0), są ukryte i pojawią się same, jak dojdą do YAML-a. Tekstowe encje (np. `gwc`, `kominek`) pokazują się jako plakietki ze stanem.

## Wersje

- **v1.0** – pierwsza wersja: zakładki Rekuperator i Diagnostyka, kopiowanie i pobieranie całego logu, dekoder ramek C14, automatyczne kafle dla nieznanych encji.

Kod ESPHome (YAML) nie jest w tym repo.
