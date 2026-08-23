'use strict';
/* GreekTolls — route toll calculator for Greek motorways.
   Data: tolls.json (curated). Routing: OSRM public demo server (with retry). */

let LANG = localStorage.getItem('gtLang') || 'el';
let VEHICLE = localStorage.getItem('gtVehicle') || 'moto';
let ROUND_TRIP = false;
let FUEL_ON = false;
let LAST_RESULT = null;
// Resolved endpoints: {name: {el, en}, lat, lon}
let FROM_POINT = null;
let TO_POINT = null;

const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
const OSRM_RETRIES = 2;
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search?name=';

const I18N = {
    el: {
        tagline: 'Υπολόγισε τα διόδια του ταξιδιού σου',
        from: 'Αφετηρία', to: 'Προορισμός', vehicle: 'Όχημα',
        search_ph_from: 'π.χ. Αθήνα ή όνομα περιοχής…',
        search_ph_to: 'π.χ. Θεσσαλονίκη…',
        use_gps: 'Τοποθεσία μου',
        round_trip: '↔ Μετ\' επιστροφής', fuel_toggle: '⛽ Υπολογ. καυσίμων',
        consumption: 'Κατανάλωση (L/100km)', fuel_price: 'Τιμή καυσίμου (€/L)',
        calculate: 'Υπολογισμός', total_tolls: 'Συνολικά διόδια',
        stations_on_route: 'Σταθμοί στη διαδρομή', share: 'Μοιράσου',
        report_price: 'Λάθος τιμή;', disclaimer: 'Ενδεικτικές τιμές μετρητά, τελευταία ενημέρωση Αύγουστος 2026. Οι τιμές μπορεί να έχουν αλλάξει — αναφέρετε ασυμφωνίες.',
        err_no_location: 'Διάλεξε αφετηρία και προορισμό πρώτα.',
        err_same: 'Αφετηρία και προορισμός είναι ίδιες.',
        err_route: 'Δεν βρέθηκε διαδρομή μεταξύ αυτών των σημείων.',
        err_service: 'Η υπηρεσία διαδρομών δεν αποκρίθηκε — δοκίμασε ξανά σε λίγο.',
        err_geocode: 'Δεν βρέθηκε η τοποθεσία. Δοκίμασε άλλο όνομα.',
        err_gps: 'Δεν δόθηκε πρόσβαση στην τοποθεσία.',
        searching: 'Αναζήτηση…',
        locating: 'Εντοπισμός…',
        tolls: 'Διόδια', distance: 'Απόσταση', duration: 'Χρόνος', fuel_cost: 'Καύσιμα (εκτ.)',
        stations_count: 'Σταθμοί', trip_total: 'Σύνολο ταξιδιού',
        roundtrip_note: '(μετ\' επιστροφής)',
        no_stations: 'Κανένας σταθμός διοδίων στη διαδρομή 🎉',
        copied: 'Αντιγράφηκε!'
    },
    en: {
        tagline: 'Calculate the tolls for your trip',
        from: 'From', to: 'To', vehicle: 'Vehicle',
        search_ph_from: 'e.g. Athens or area name…',
        search_ph_to: 'e.g. Thessaloniki…',
        use_gps: 'My location',
        round_trip: '↔ Round trip', fuel_toggle: '⛽ Fuel estimate',
        consumption: 'Consumption (L/100km)', fuel_price: 'Fuel price (€/L)',
        calculate: 'Calculate', total_tolls: 'Total tolls',
        stations_on_route: 'Stations on route', share: 'Share',
        report_price: 'Wrong price?', disclaimer: 'Indicative cash prices, last updated August 2026. Prices may have changed — report discrepancies.',
        err_no_location: 'Pick a start and destination first.',
        err_same: 'Start and destination are the same.',
        err_route: 'No route found between these points.',
        err_service: 'Routing service didn\'t respond — try again shortly.',
        err_geocode: 'Location not found. Try another name.',
        err_gps: 'Location access denied.',
        searching: 'Searching…',
        locating: 'Locating…',
        tolls: 'Tolls', distance: 'Distance', duration: 'Time', fuel_cost: 'Fuel (est.)',
        stations_count: 'Stations', trip_total: 'Trip total',
        roundtrip_note: '(round trip)',
        no_stations: 'No toll stations on this route 🎉',
        copied: 'Copied!'
    }
};

// Vehicle classes: all 4 Greek toll categories
const VEHICLES = [
    { id: 'moto', cat: 0, label: { el: 'Μοτοσυκλέτα', en: 'Motorcycle' }, icon: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-1 1h-3l-2 5 3 3h2m-5-3-2 5.5M12 12l4.5 4L18 17.5"/></svg>' },
    { id: 'car', cat: 1, label: { el: 'Αυτοκίνητο', en: 'Car' }, icon: '<svg viewBox="0 0 24 24"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14a1 1 0 0 1 1 1v4h-2m-12 0H4v-4a1 1 0 0 1 1-1zm2 5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zm8 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z"/></svg>' },
    { id: 'van', cat: 2, label: { el: 'Βαν / 3άξονο', en: 'Van / 3-axle' }, icon: '<svg viewBox="0 0 24 24"><rect x="1" y="6" width="14" height="10" rx="1"/><path d="M15 9h4l3 4v3h-2m-13 0h8"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>' },
    { id: 'truck', cat: 3, label: { el: 'Φορτηγό', en: 'Truck' }, icon: '<svg viewBox="0 0 24 24"><rect x="1" y="5" width="13" height="11" rx="1"/><path d="M14 8h4.5L22 12v4h-3m-14 0h7"/><circle cx="5.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/></svg>' }
];

// Quick-pick popular land destinations (no islands — land tolls only).
// Users can also free-text-search any location.
const QUICK_PICKS = [
    { name: { el: 'Αθήνα', en: 'Athens' }, lat: 37.9838, lon: 23.7275 },
    { name: { el: 'Θεσσαλονίκη', en: 'Thessaloniki' }, lat: 40.6401, lon: 22.9444 },
    { name: { el: 'Πάτρα', en: 'Patras' }, lat: 38.2466, lon: 21.7346 },
    { name: { el: 'Λάρισα', en: 'Larissa' }, lat: 39.6390, lon: 22.4191 },
    { name: { el: 'Βόλος', en: 'Volos' }, lat: 39.3622, lon: 22.9422 },
    { name: { el: 'Ιωάννινα', en: 'Ioannina' }, lat: 39.6624, lon: 20.8519 },
    { name: { el: 'Τρίκαλα', en: 'Trikala' }, lat: 39.5540, lon: 21.7678 },
    { name: { el: 'Καλαμάτα', en: 'Kalamata' }, lat: 37.0391, lon: 22.1125 },
    { name: { el: 'Κόρινθος', en: 'Corinth' }, lat: 37.9400, lon: 22.9300 },
    { name: { el: 'Χαλκίδα', en: 'Chalkida' }, lat: 38.4636, lon: 23.6021 },
    { name: { el: 'Σπάρτη', en: 'Sparta' }, lat: 37.0755, lon: 22.4296 },
    { name: { el: 'Τρίπολη', en: 'Tripoli' }, lat: 37.5100, lon: 22.3728 },
    { name: { el: 'Πύργος', en: 'Pyrgos' }, lat: 37.6750, lon: 21.4400 },
    { name: { el: 'Καβάλα', en: 'Kavala' }, lat: 40.9392, lon: 24.4064 },
    { name: { el: 'Αλεξανδρούπολη', en: 'Alexandroupoli' }, lat: 40.8516, lon: 25.8772 },
    { name: { el: 'Σέρρες', en: 'Serres' }, lat: 41.0894, lon: 23.5466 },
    { name: { el: 'Κοζάνη', en: 'Kozani' }, lat: 40.3008, lon: 21.7884 },
    { name: { el: 'Ηγουμενίτσα', en: 'Igoumenitsa' }, lat: 39.4667, lon: 20.2667 },
    { name: { el: 'Άρτα', en: 'Arta' }, lat: 39.1582, lon: 20.9852 },
    { name: { el: 'Μεσολόγγι', en: 'Mesolongi' }, lat: 38.3716, lon: 21.4265 },
    { name: { el: 'Λαμία', en: 'Lamia' }, lat: 38.8992, lon: 22.4348 },
    { name: { el: 'Καρδίτσα', en: 'Karditsa' }, lat: 39.3651, lon: 21.9223 },
    { name: { el: 'Κατερίνη', en: 'Katerini' }, lat: 40.2696, lon: 22.5061 },
    { name: { el: 'Βέροια', en: 'Veroia' }, lat: 40.5231, lon: 22.2027 },
    { name: { el: 'Ξάνθη', en: 'Xanthi' }, lat: 41.1350, lon: 24.8882 },
    { name: { el: 'Κομοτηνή', en: 'Komotini' }, lat: 41.1194, lon: 25.4054 },
    { name: { el: 'Φλώρινα', en: 'Florina' }, lat: 40.7835, lon: 21.4086 },
    { name: { el: 'Δράμα', en: 'Drama' }, lat: 41.1518, lon: 24.1477 }
];

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toFixed(2) + ' €';
const t = (key) => (I18N[LANG] && I18N[LANG][key]) || I18N.el[key] || key;

async function main() {
    FROM_POINT = QUICK_PICKS[0]; // Athens
    TO_POINT = QUICK_PICKS[1];   // Thessaloniki

    // Attach all UI wiring FIRST so the page is interactive even if data loading fails
    setupSearch('fromInput', 'fromResults', (p) => { FROM_POINT = p; updateEndpointLabels(); });
    setupSearch('toInput', 'toResults', (p) => { TO_POINT = p; updateEndpointLabels(); });
    $('langBtn').addEventListener('click', () => {
        LANG = LANG === 'el' ? 'en' : 'el';
        localStorage.setItem('gtLang', LANG);
        applyLang();
        renderVehicleButtons();
    });

    buildQuickPicks();
    renderVehicleButtons();
    applyLang();

    // Load toll data last; calculate() guards on it
    try {
        const res = await fetch('tolls.json');
        window.TOLL_DATA = await res.json();
    } catch (e) {
        console.error('tolls.json failed to load', e);
    }
}

function buildQuickPicks() {
    ['fromQuick', 'toQuick'].forEach(containerId => {
        const cont = $(containerId);
        cont.innerHTML = '';
        QUICK_PICKS.slice(0, 8).forEach(city => {
            const chip = document.createElement('button');
            chip.className = 'quick-chip';
            chip.textContent = city.name[LANG];
            chip.onclick = () => {
                if (containerId === 'fromQuick') FROM_POINT = city;
                else TO_POINT = city;
                updateEndpointLabels();
            };
            cont.appendChild(chip);
        });
    });
}

function updateEndpointLabels() {
    const fromInput = $('fromInput'), toInput = $('toInput');
    if (FROM_POINT && fromInput && document.activeElement !== fromInput) {
        fromInput.placeholder = '📍 ' + FROM_POINT.name[LANG];
    }
    if (TO_POINT && toInput && document.activeElement !== toInput) {
        toInput.placeholder = '📍 ' + TO_POINT.name[LANG];
    }
}

// Free-text geocoding search via Open-Meteo
function setupSearch(inputId, resultsId, onPick) {
    const input = $(inputId);
    const resultsBox = $(resultsId);
    let debounceTimer = null;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const q = input.value.trim();
        if (q.length < 2) { resultsBox.innerHTML = ''; return; }
        debounceTimer = setTimeout(async () => {
            try {
                const url = `${GEOCODE}${encodeURIComponent(q)}&count=5&language=${LANG}&format=json`;
                const res = await fetch(url);
                const data = await res.json();
                resultsBox.innerHTML = '';
                if (!data.results || !data.results.length) return;
                data.results.forEach(place => {
                    const div = document.createElement('div');
                    div.className = 'geo-result';
                    const label = [place.name, place.admin1, place.country_code]
                        .filter(Boolean).join(', ');
                    div.textContent = label;
                    div.onclick = () => {
                        onPick({
                            name: { el: place.name, en: place.name },
                            lat: place.latitude,
                            lon: place.longitude
                        });
                        input.value = place.name;
                        resultsBox.innerHTML = '';
                        updateEndpointLabels();
                    };
                    resultsBox.appendChild(div);
                });
            } catch (e) { console.error(e); }
        }, 400);
    });

    // dismiss results when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!resultsBox.contains(e.target) && e.target !== input) resultsBox.innerHTML = '';
    });
}

async function useGpsOrigin() {
    if (!navigator.geolocation) return;
    $('gpsBtn').textContent = t('locating');
    navigator.geolocation.getCurrentPosition((pos) => {
        FROM_POINT = {
            name: { el: 'Η τοποθεσία μου', en: 'My location' },
            lat: pos.coords.latitude,
            lon: pos.coords.longitude
        };
        $('gpsBtn').textContent = '📍 ' + t('use_gps');
        updateEndpointLabels();
    }, () => {
        $('gpsBtn').textContent = '📍 ' + t('use_gps');
        showError(t('err_gps'));
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}

function renderVehicleButtons() {
    const grid = $('vehGrid');
    grid.innerHTML = '';
    VEHICLES.forEach(v => {
        const b = document.createElement('button');
        b.className = 'veh-btn' + (v.id === VEHICLE ? ' active' : '');
        b.innerHTML = v.icon + `<span>${v.label[LANG]}</span>`;
        b.onclick = () => {
            VEHICLE = v.id;
            localStorage.setItem('gtVehicle', VEHICLE);
            renderVehicleButtons();
        };
        grid.appendChild(b);
    });
}

function applyLang() {
    document.documentElement.lang = LANG;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    $('langBtn').textContent = LANG === 'el' ? 'EN' : 'EL';
    document.title = LANG === 'el'
        ? 'GreekTolls — Υπολογισμός Διοδίων Ελλάδας'
        : 'GreekTolls — Greece Toll Calculator';
    // re-translate quick chips
    buildQuickPicks();
    updateEndpointLabels();
}

function swapCities() {
    const tmp = FROM_POINT;
    FROM_POINT = TO_POINT;
    TO_POINT = tmp;
    updateEndpointLabels();
}

function toggleRoundTrip() {
    ROUND_TRIP = !ROUND_TRIP;
    $('roundTripBtn').classList.toggle('active', ROUND_TRIP);
}

function toggleFuel() {
    FUEL_ON = !FUEL_ON;
    $('fuelToggleBtn').classList.toggle('active', FUEL_ON);
    $('fuelBox').style.display = FUEL_ON ? 'block' : 'none';
}

function showError(msg) {
    const box = $('errBox');
    box.textContent = msg;
    box.style.display = 'block';
    setTimeout(() => { box.style.display = 'none'; }, 6000);
}

// Fetch with retries and exponential backoff for flaky public routers
async function fetchRouteWithRetry(url) {
    let lastErr = null;
    for (let attempt = 0; attempt <= OSRM_RETRIES; attempt++) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes.length) return data;
            // "NoRoute" is a definitive answer — don't retry
            if (data.code === 'NoRoute') throw Object.assign(new Error(t('err_route')), { definitive: true });
            lastErr = new Error(data.code || 'route error');
        } catch (e) {
            if (e.definitive) throw e;
            lastErr = e;
        }
        if (attempt < OSRM_RETRIES) {
            await new Promise(r => setTimeout(r, 800 * Math.pow(2, attempt)));
        }
    }
    throw lastErr || new Error('routing failed');
}

async function calculate() {
    if (!window.TOLL_DATA) { showError(t('err_service')); return; }
    if (!FROM_POINT || !TO_POINT) { showError(t('err_no_location')); return; }
    if (FROM_POINT === TO_POINT ||
        (FROM_POINT.lat === TO_POINT.lat && FROM_POINT.lon === TO_POINT.lon)) {
        showError(t('err_same')); return;
    }

    const btn = $('calcBtn');
    btn.disabled = true;
    $('loader').style.display = 'block';
    $('results').style.display = 'none';

    try {
        const url = `${OSRM}${FROM_POINT.lon},${FROM_POINT.lat};${TO_POINT.lon},${TO_POINT.lat}?overview=full&alternatives=false&steps=false`;
        const data = await fetchRouteWithRetry(url);

        const route = data.routes[0];
        const distKm = route.distance / 1000;
        const durMin = Math.round(route.duration / 60);
        const pts = decodePolyline(route.geometry);

        const veh = VEHICLES.find(v => v.id === VEHICLE);
        const matched = matchTolls(pts, veh.cat);
        const oneWay = matched.reduce((s, m) => s + m.price, 0);
        const total = ROUND_TRIP ? oneWay * 2 : oneWay;

        let fuelCost = null;
        if (FUEL_ON) {
            const cons = parseFloat($('consumptionInput').value) || 0;
            const price = parseFloat($('priceInput').value) || 0;
            fuelCost = (distKm / 100) * cons * price * (ROUND_TRIP ? 2 : 1);
        }

        renderResult({ from: FROM_POINT, to: TO_POINT, distKm, durMin, matched, oneWay, total, fuelCost });
        LAST_RESULT = { from: FROM_POINT, to: TO_POINT, distKm, durMin, matched, total, fuelCost };
    } catch (e) {
        console.error(e);
        showError(e.message && e.message !== 'Error' && e.definitive ? t('err_route') : t('err_service'));
    } finally {
        btn.disabled = false;
        $('loader').style.display = 'none';
    }
}

// Find tolls within ~2.5km of any route point (sampled)
function matchTolls(routePts, vehicleCat) {
    const matched = [];
    const seen = new Set();
    for (let i = 0; i < routePts.length; i += 3) {
        const [lon, lat] = routePts[i];
        window.TOLL_DATA.stations.forEach(st => {
            if (seen.has(st.id)) return;
            const d = haversine(lat, lon, st.lat, st.lon);
            if (d < 2.5) {
                seen.add(st.id);
                matched.push({ station: st, price: st.prices[vehicleCat] });
            }
        });
    }
    matched.sort((a, b) => a.station.road.localeCompare(b.station.road) || a.station.name[LANG].localeCompare(b.station.name[LANG]));
    return matched;
}

function renderResult({ from, to, distKm, durMin, matched, total, fuelCost }) {
    $('totalAmount').textContent = fmt(total);
    const hrs = Math.floor(durMin / 60);
    const mins = durMin % 60;
    $('routeMeta').innerHTML =
        `<b>${from.name[LANG]}</b> → <b>${to.name[LANG]}</b><br>` +
        `${Math.round(distKm)} km · ${hrs}h ${mins}m` +
        (ROUND_TRIP ? ` <span style="color:var(--accent)">${t('roundtrip_note')}</span>` : '');

    const stats = [
        { v: fmt(total), k: t('tolls') },
        { v: Math.round(ROUND_TRIP ? distKm * 2 : distKm) + ' km', k: t('distance') },
        { v: matched.length + (ROUND_TRIP ? ' ×2' : ''), k: t('stations_count') }
    ];
    if (fuelCost !== null) {
        stats.push({ v: fmt(fuelCost), k: t('fuel_cost') });
        stats.push({ v: fmt(total + fuelCost), k: t('trip_total') });
    }
    $('subStats').innerHTML = stats.map(s =>
        `<div class="sub-stat"><div class="v">${s.v}</div><div class="k">${s.k}</div></div>`
    ).join('');

    $('stationList').innerHTML = matched.map(m =>
        `<li class="station-item">
            <span class="station-name">${m.station.name[LANG]}
                <span class="station-road">${m.station.road} · ${m.station.op}</span></span>
            <span class="station-price">${fmt(m.price)}</span>
        </li>`
    ).join('') || `<li class="station-item" style="color:var(--text-dim)">${t('no_stations')}</li>`;

    // Report link: prefilled mailto
    const subject = encodeURIComponent('GreekTolls: Λάθος τιμή διοδίων');
    const body = encodeURIComponent(
        `Διαδρομή: ${from.name.el} → ${to.name.el}\n` +
        `Όχημα: ${VEHICLE}\n` +
        `Υπολογισμένο σύνολο: ${total.toFixed(2)} €\n\n` +
        `Σταθμοί:\n` + matched.map(m => `- ${m.station.name.el} (${m.station.road}): ${m.price.toFixed(2)} €`).join('\n') +
        `\n\nΣχόλιο/σωστή τιμή: `
    );
    $('reportLink').href = `mailto:theursoalbo@gmail.com?subject=${subject}&body=${body}`;

    $('results').style.display = 'block';
}

async function shareResult() {
    if (!LAST_RESULT) return;
    const r = LAST_RESULT;
    const text = LANG === 'el'
        ? `${r.from.name.el} → ${r.to.name.el}: Διόδια ${fmt(r.total)}, ${Math.round(r.distKm)} km${ROUND_TRIP ? ' (μετ\' επιστροφής)' : ''} — GreekTolls`
        : `${r.from.name.en} → ${r.to.name.en}: Tolls ${fmt(r.total)}, ${Math.round(r.distKm)} km${ROUND_TRIP ? ' (round trip)' : ''} — GreekTolls`;
    if (navigator.share) {
        try { await navigator.share({ text }); } catch (e) { /* cancelled */ }
    } else {
        navigator.clipboard.writeText(text);
        alert(t('copied'));
    }
}

// OSRM polyline decoder (precision 5)
function decodePolyline(str) {
    let index = 0, lat = 0, lng = 0;
    const coords = [];
    while (index < str.length) {
        let result = 1, shift = 0, b;
        do { b = str.charCodeAt(index++) - 63 - 1; result += b << shift; shift += 5; } while (b >= 0x1f);
        lat += result & 1 ? ~(result >> 1) : (result >> 1);
        result = 1; shift = 0;
        do { b = str.charCodeAt(index++) - 63 - 1; result += b << shift; shift += 5; } while (b >= 0x1f);
        lng += result & 1 ? ~(result >> 1) : (result >> 1);
        coords.push([lng * 1e-5, lat * 1e-5]);
    }
    return coords;
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

main();
