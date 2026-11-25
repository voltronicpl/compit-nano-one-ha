# Compit Nano One – karta rekuperacji dla Home Assistant

Karta Lovelace dla rekuperacji sterowanej przez **Compit Nano One** (RS485, protokół C14), czytanej przez ESP z ESPHome.
Jeden plik JS, bez zależności (nie wymaga button-card, card-mod ani apexcharts).

![podgląd](docs/podglad.png)

![diagnostyka](docs/podglad_diagnostyka.png)

Podgląd jest zrobiony na przykładowych wartościach.

## Co jest w karcie

**Zakładka Rekuperator** (od v1.2 ciemny wygląd wg wzoru, jasny: `theme: light`)
- nagłówek REKUPERACJA / COMPIT · C14 z plakietką PRACA / WYBIEG / STOP / OFFLINE (`status_wentylatorow`, status ESP)
- schemat wymiennika: kafle czerpnia, wywiew, nawiew, wyrzut, świecące strumienie, animacja przepływu, gdy wentylatory pracują, obejście przy otwartym bypassie
- okrągły wskaźnik biegu z % wentylatora nawiewu
- dolny pasek: PROGRAM, BYPASS, SEZON, FILTR
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

## Sterowanie z karty (YAML v1.6, zapis do Nano jako iNext)

Wszystko zmieniasz w karcie, nie w encjach ESP. Przyciski pojawiają się, gdy w HA są encje sterujące z ESPHome:
- klik we wskaźnik biegu albo w PROGRAM: Ręczny Stop / Ręczny bieg 1–3 / Wg zegara / Świąteczny / Poza domem (`select.<prefix>_ustaw_tryb`)
- klik w BYPASS: Zamknięty / Auto / Otwarty (`select.<prefix>_ustaw_bypass`)
- klik w SEZON: Zima / Lato (`select.<prefix>_ustaw_sezon`)
- Temperatury zadane z +/−: ręczna, dzień, noc, poza domem, 5–40 °C co 0,1 (`number.*`)
- Biegi % z +/−: nawiew i wywiew dla biegów 1–3 i wietrzenia, 10–100 % (`number.*`)
- **klik w samą wartość** (podkreśloną) otwiera pole do wpisania liczby z klawiatury (przecinek albo kropka), zapis przyciskiem OK albo Enterem, Esc anuluje
- **klik w kafle** Bieg / Tryb otwiera wybór trybu, Temp. zadana otwiera temperatury zadane, plakietki Bypass / Sezon otwierają swoje listy (kafle z ołówkiem ✎ da się zmieniać)

Ze starszym YAML-em (v1.4) karta dalej działa na `ustaw_bieg`, `ustaw_program`, przełączniku `wietrzenie` i `nadawanie_inext`.

**Blokada:** przełącznik `switch.<prefix>_sterowanie_z_ha_inext` („Sterowanie z HA (iNext)”). Gdy jest WYŁ., wszystkie przyciski są nieaktywne. Włączasz go w karcie z potwierdzeniem „Na pewno?”. Każdy zapis i każdy błąd zapisu trafia do logu zdarzeń w Diagnostyce.

## Instalacja przez HACS

1. HACS → ⋮ → **Custom repositories** → `https://github.com/voltronicpl/compit-nano-one-ha`, typ **Dashboard** → Dodaj → Pobierz. Przeładuj przeglądarkę.
2. Dodaj kartę:
   ```yaml
   type: custom:compit-nano-one-card
   # opcjonalnie:
   # prefix: nano_one          # początek ID encji z ESPHome (domyślnie nano_one)
   # title: Rekuperacja
   # theme: light             # jasny wygląd w kolorach motywu HA (domyślnie ciemny wg wzoru)
   # niepewne: []             # które temperatury oznaczać "?" (domyślnie t_czerpnia, t_wywiew)
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
| `sezon` | `sensor.<prefix>_sezon` | Sezon |
| `sezon_rej` | `sensor.<prefix>_sezon_rejestr` | Sezon (rejestr) |
| `bypass_tryb` | `sensor.<prefix>_bypass_tryb` | Bypass tryb |
| `bypass_rej` | `sensor.<prefix>_bypass_rejestr` | Bypass (rejestr) |
| `wietrzenie` | `sensor.<prefix>_wietrzenie` | Wietrzenie |
| `urlop` | `sensor.<prefix>_urlop` | Urlop |
| `poza_domem` | `sensor.<prefix>_poza_domem` | Poza domem |
| `tryb_term` | `sensor.<prefix>_tryb_termostatu_rejestr` | Tryb termostatu |
| `went_aktywna` | `binary_sensor.<prefix>_wentylacja_aktywna` | Wentylacja |
| `chlodzenie` | `binary_sensor.<prefix>_zapotrzebowanie_na_chlodzenie` | Chłodzenie |
| `n_komfort` | `sensor.<prefix>_nastawa_komfort` | Komfort |
| `n_eko` | `sensor.<prefix>_nastawa_eko` | Eko |
| `n_chlodzenie` | `sensor.<prefix>_nastawa_chlodzenie` | Chłodzenie |
| `n_reczna` | `sensor.<prefix>_nastawa_reczna` | Ręczna |
| `n_poza` | `sensor.<prefix>_nastawa_poza_domem` | Poza domem |
| `aero_moc` | `sensor.<prefix>_aero_moc_centrali` | Moc centrali AERO |
| `zad_nawiew` | `sensor.<prefix>_wentylacja_nawiew_zadany` | Nawiew zadany |
| `zad_wywiew` | `sensor.<prefix>_wentylacja_wywiew_zadany` | Wywiew zadany |
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
| `bajty` | `sensor.<prefix>_bajty_rs485` | Bajty RS485 |
| `bajty_b7` | `sensor.<prefix>_bajty_z_bitem_7` | Bajty z bitem 7 |
| `ramki_suma` | `sensor.<prefix>_ramki_zla_suma` | Ramki: zła suma |
| `ramki_urwane` | `sensor.<prefix>_ramki_urwane` | Ramki urwane |
| `nano_nadaje` | `binary_sensor.<prefix>_nano_nadaje` | Nano nadaje |
| `aero_odp` | `binary_sensor.<prefix>_aero_odpowiada` | AERO odpowiada |
| `typy` | `sensor.<prefix>_c14_typy_ramek` | Typy ramek C14 |
| `zegar` | `sensor.<prefix>_zegar_nano` | Zegar Nano |
| `rejestry` | `sensor.<prefix>_c14_rejestry_nano` | Rejestry Nano |
| `r_nano_st` | `sensor.<prefix>_c14_ramka_nano_status` | Nano status |
| `r_nano_nast` | `sensor.<prefix>_c14_ramka_nano_nastawy` | Nano nastawy |
| `r_e3_3a` | `sensor.<prefix>_c14_ramka_e3_strona_3a` | E3 3A |
| `r_e3_3b` | `sensor.<prefix>_c14_ramka_e3_strona_3b` | E3 3B |
| `r_aero` | `sensor.<prefix>_c14_ramka_aero` | AERO |
| `r_bajty` | `sensor.<prefix>_surowe_bajty` | Surowe bajty |
| `status_went` | `sensor.<prefix>_status_wentylatorow` | Status wentylatorów |
| `bieg_centr` | `sensor.<prefix>_bieg_centrali` | Bieg centrali |
| `harm_akt` | `binary_sensor.<prefix>_harmonogram_aktywny` | Harmonogram |
| `set_tryb` | `select.<prefix>_ustaw_tryb` | Tryb pracy |
| `set_bieg` | `select.<prefix>_ustaw_bieg` | Bieg |
| `set_program` | `select.<prefix>_ustaw_program` | Program |
| `set_sezon` | `select.<prefix>_ustaw_sezon` | Sezon |
| `set_bypass` | `select.<prefix>_ustaw_bypass` | Bypass |
| `sw_wietrz` | `switch.<prefix>_wietrzenie` | Wietrzenie |
| `nadawanie` | `switch.<prefix>_sterowanie_z_ha_inext` lub `_sterowanie_z_ha` lub `_nadawanie_inext` | Sterowanie z HA (iNext) |
| `t_reczna` | `number.<prefix>_temperatura_reczna` | Ręczna |
| `t_dzien` | `number.<prefix>_temperatura_dzien` | Dzień |
| `t_noc` | `number.<prefix>_temperatura_noc` | Noc |
| `t_poza` | `number.<prefix>_temperatura_poza_domem` | Poza domem |
| `p_n1` | `number.<prefix>_nawiew_bieg_1` | Nawiew bieg 1 |
| `p_n2` | `number.<prefix>_nawiew_bieg_2` | Nawiew bieg 2 |
| `p_n3` | `number.<prefix>_nawiew_bieg_3` | Nawiew bieg 3 |
| `p_nw` | `number.<prefix>_nawiew_wietrzenie` | Nawiew wietrzenie |
| `p_w1` | `number.<prefix>_wywiew_bieg_1` | Wywiew bieg 1 |
| `p_w2` | `number.<prefix>_wywiew_bieg_2` | Wywiew bieg 2 |
| `p_w3` | `number.<prefix>_wywiew_bieg_3` | Wywiew bieg 3 |
| `p_ww` | `number.<prefix>_wywiew_wietrzenie` | Wywiew wietrzenie |
| `ramki_tx` | `sensor.<prefix>_ramki_wyslane_inext` | Ramki wysłane iNext |
| `inext` | `sensor.<prefix>_c14_inext` | Ostatnia wymiana iNext |

Kafle encji, których nie ma w HA (np. filtry, alarm, CO₂ w YAML v1.3), są ukryte i pojawią się same, jak dojdą do YAML-a. Tekstowe encje (np. `gwc`, `kominek`, `sezon`) pokazują się jako plakietki ze stanem. Encje z „?” w nazwie w YAML-u (mapowanie niepewne) mają pomarańczowy znak **?** na kaflach i „(?)” na schemacie.

Encje diagnostyczne i konfiguracyjne (`entity_category` w ESPHome) nie trafiają do „Pozostałe z ESP” na Rekuperatorze. Są w Diagnostyce, w sekcjach **Surowe pola C14**, **Rejestry Nano**, **Parametry serwisowe** i **Ustawienia ESP**.

## Wersje

- **v1.4** – każda wartość klikalna i edytowalna w karcie (wpisywanie liczb, kafle Bieg/Tryb/Temp. zadana i plakietki Bypass/Sezon otwierają wybór), karta przerysowuje się tylko przy zmianie encji `nano_one_*` i nigdy w trakcie kliknięcia (koniec skakania i gubienia klików), łapanie zdublowanych encji `_2`/`_3` z ostrzeżeniem w Diagnostyce.
- **v1.3** – sterowanie z karty pod YAML v1.6: jeden wybór trybu (`ustaw_tryb`: ręczny stop/bieg 1–3, wg zegara, świąteczny, poza domem) z wskaźnika biegu i z PROGRAM, blokada „Sterowanie z HA (iNext)”, warianty nazw encji (karta działa ze starym i nowym YAML-em).
- **v1.2** – wygląd wg wzoru (ciemny panel, schemat wymiennika z kaflami, wskaźnik biegu, pasek PROGRAM/BYPASS/SEZON/FILTR, plakietka PRACA), sterowanie pod YAML v1.4 (bieg, program, bypass, sezon, wietrzenie, temperatury zadane, % biegów) z blokadą „Nadawanie iNext”, w Diagnostyce ramki wysłane iNext i ostatnia wymiana iNext, opcje `theme` i `niepewne`.
- **v1.1** – pod YAML v1.3: plakietki (wentylacja, bypass tryb, sezon, chłodzenie, wietrzenie, urlop, poza domem), sekcja Nastawy, znacznik „?” dla niepewnych encji, encje diagnostyczne przeniesione do Diagnostyki (surowe pola C14, rejestry, serwis, ustawienia ESP), wszystkie ramki C14 (Nano status/nastawy, E3 3A/3B, AERO, surowe bajty) z przełącznikiem źródła, więcej liczników magistrali.
- **v1.0** – pierwsza wersja: zakładki Rekuperator i Diagnostyka, kopiowanie i pobieranie całego logu, dekoder ramek C14, automatyczne kafle dla nieznanych encji.

Kod ESPHome (YAML) nie jest w tym repo.
