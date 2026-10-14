'use strict';
/* GreekTolls v11 — Dynamic Polyline Toll Matcher with Full Nationwide Coverage */

let LANG = localStorage.getItem('gtLang') || 'el';
let VEHICLE = localStorage.getItem('gtVehicle') || 'moto';
let ROUND_TRIP = false;
let FUEL_ON = localStorage.getItem('gtFuelOn') === '1';
let FERRY_MODE = localStorage.getItem('gtFerry') === '1';
let TOLL_FREE_MODE = false;
let PASSENGERS = 1;
let LAST_RESULT = null;

let FROM_POINT = null;
let TO_POINT = null;
let WAYPOINTS = [];

let map = null;
let mapMarkers = [];

const OSRM_SERVERS = [
    'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
    'https://router.project-osrm.org/route/v1/driving/'
];
const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';
const PHOTON_SEARCH = 'https://photon.komoot.io/api/';
const PHOTON_REVERSE = 'https://photon.komoot.io/reverse';
const GR_BBOX = '19.3,34.8,29.7,41.8';

const DEFAULT_CONSUMPTION = { moto: 4.5, car: 6.8, van: 9.5, truck: 28.0 };

const I18N = {
    el: {
        tagline: 'Υπολόγισε διόδια & οργάνωσε road trip',
        toggle_map: '🗺️ Χάρτης',
        from: 'Αφετηρία', to: 'Προορισμός', stop: 'Στάση', vehicle: 'Όχημα',
        add_stop: '+ Προσθήκη στάσης',
        use_gps: '📍 Τοποθεσία μου',
        round_trip: '↔ Μετ\' επιστροφής',
        ferry_rio: '⛴️ Φεριμπότ Ρίου',
        fuel_toggle: '⛽ Καύσιμα',
        toll_free: '🛣️ Χωρίς διόδια',
        consumption: 'Κατανάλωση (L/100km)', fuel_price: 'Τιμή (€/L)',
        calculate: 'Υπολογισμός Διαδρομής', total_tolls: 'Συνολικά διόδια',
        split_label: 'Κόστος ανά άτομο:',
        stations_on_route: 'Σταθμοί στη διαδρομή (πάτα για εστίαση)',
        open_maps: '🗺️ Google Maps', share: '📤 Μοιράσου',
        report_price: '⚠️ Λάθος τιμή;',
        disclaimer: 'Τιμές 2026. Δυναμικός αλγόριθμος πολυγραμμής.',
        err_no_location: 'Διάλεξε αφετηρία και προορισμό πρώτα.',
        err_same: 'Αφετηρία και προορισμός συμπίπτουν.',
        err_route: 'Δεν βρέθηκε οδική διαδρομή μεταξύ αυτών των σημείων.',
        err_service: 'Η υπηρεσία δρομολόγησης καθυστέρησε — δοκίμασε ξανά.',
        err_gps: 'Δεν δόθηκε πρόσβαση στην τοποθεσία.',
        err_gps_off: 'Το GPS είναι απενεργοποιημένο.',
        err_gps_timeout: 'Εξάντληση χρόνου εύρεσης GPS.',
        locating: 'Εντοπισμός…',
        tolls: 'Διόδια', distance: 'Απόσταση', duration: 'Χρόνος', fuel_cost: 'Καύσιμα',
        stations_count: 'Σταθμοί', trip_total: 'Σύνολο (Διόδια+Καύσιμα)',
        roundtrip_note: '(μετ\' επιστροφής)',
        no_stations: 'Κανένας σταθμός διοδίων στη διαδρομή 🎉',
        copied: 'Το link της διαδρομής αντιγράφηκε!',
        type_main: 'Μετωπικός', type_side: 'Πλευρικός', type_special: 'Ειδικός',
        alt_free_prefix: 'Διαδρομή χωρίς διόδια:',
        alt_saves: 'Εξοικονόμηση'
    },
    en: {
        tagline: 'Calculate tolls & plan your road trip',
        toggle_map: '🗺️ Map',
        from: 'From', to: 'To', stop: 'Stop', vehicle: 'Vehicle',
        add_stop: '+ Add stop',
        use_gps: '📍 My location',
        round_trip: '↔ Round trip',
        ferry_rio: '⛴️ Rio Ferry',
        fuel_toggle: '⛽ Fuel estimate',
        toll_free: '🛣️ Toll-free',
        consumption: 'Consumption (L/100km)', fuel_price: 'Fuel price (€/L)',
        calculate: 'Calculate Route', total_tolls: 'Total tolls',
        split_label: 'Cost per person:',
        stations_on_route: 'Stations on route (tap to focus)',
        open_maps: '🗺️ Google Maps', share: '📤 Share',
        report_price: '⚠️ Wrong price?',
        disclaimer: '2026 tariffs. Dynamic polyline algorithm.',
        err_no_location: 'Pick a start and destination first.',
        err_same: 'Start and destination are identical.',
        err_route: 'No driving route found between these points.',
        err_service: 'Routing service timed out — please retry.',
        err_gps: 'Location permission denied.',
        err_gps_off: 'Device location services are turned off.',
        err_gps_timeout: 'GPS request timed out.',
        locating: 'Locating…',
        tolls: 'Tolls', distance: 'Distance', duration: 'Duration', fuel_cost: 'Fuel',
        stations_count: 'Stations', trip_total: 'Total (Tolls+Fuel)',
        roundtrip_note: '(round trip)',
        no_stations: 'No toll stations on this route 🎉',
        copied: 'Route link copied to clipboard!',
        type_main: 'Frontal', type_side: 'Lateral', type_special: 'Special',
        alt_free_prefix: 'Toll-free route:',
        alt_saves: 'Savings'
    }
};

const VEHICLES = [
    { id: 'moto', cat: 0, label: { el: 'Μηχανή', en: 'Moto' }, icon: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-1 1h-3l-2 5 3 3h2m-5-3-2 5.5M12 12l4.5 4L18 17.5"/></svg>' },
    { id: 'car', cat: 1, label: { el: 'Αυτοκίνητο', en: 'Car' }, icon: '<svg viewBox="0 0 24 24"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14a1 1 0 0 1 1 1v4h-2m-12 0H4v-4a1 1 0 0 1 1-1zm2 5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zm8 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z"/></svg>' },
    { id: 'van', cat: 2, label: { el: 'Βαν', en: 'Van' }, icon: '<svg viewBox="0 0 24 24"><rect x="1" y="6" width="14" height="10" rx="1"/><path d="M15 9h4l3 4v3h-2m-13 0h8"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>' },
    { id: 'truck', cat: 3, label: { el: 'Φορτηγό', en: 'Truck' }, icon: '<svg viewBox="0 0 24 24"><rect x="1" y="5" width="13" height="11" rx="1"/><path d="M14 8h4.5L22 12v4h-3m-14 0h7"/><circle cx="5.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/></svg>' }
];

const QUICK_PICKS = [
    { name: { el: 'Αθήνα', en: 'Athens' }, lat: 37.9838, lon: 23.7275 },
    { name: { el: 'Θεσσαλονίκη', en: 'Thessaloniki' }, lat: 40.6401, lon: 22.9444 },
    { name: { el: 'Πάτρα', en: 'Patras' }, lat: 38.2466, lon: 21.7346 },
    { name: { el: 'Ιωάννινα', en: 'Ioannina' }, lat: 39.6624, lon: 20.8519 },
    { name: { el: 'Λάρισα', en: 'Larissa' }, lat: 39.6390, lon: 22.4191 },
    { name: { el: 'Βόλος', en: 'Volos' }, lat: 39.3622, lon: 22.9422 },
    { name: { el: 'Καλαμάτα', en: 'Kalamata' }, lat: 37.0391, lon: 22.1125 },
    { name: { el: 'Τρίκαλα', en: 'Trikala' }, lat: 39.5540, lon: 21.7678 },
    { name: { el: 'Καβάλα', en: 'Kavala' }, lat: 40.9392, lon: 24.4064 },
    { name: { el: 'Αλεξανδρούπολη', en: 'Alexandroupoli' }, lat: 40.8516, lon: 25.8772 },
    { name: { el: 'Χαλκίδα', en: 'Chalkida' }, lat: 38.4636, lon: 23.6021 },
    { name: { el: 'Ναύπλιο', en: 'Nafplio' }, lat: 37.5673, lon: 22.8016 }
];

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toFixed(2) + ' €';
const t = (key) => (I18N[LANG] && I18N[LANG][key]) || I18N.el[key] || key;

async function main() {
    initMap();
    FROM_POINT = QUICK_PICKS[0];
    TO_POINT = QUICK_PICKS[1];

    setupSearch($('fromInput'),$('fromResults'), (p) => { FROM_POINT = p; updateEndpointLabels(); });
    setupSearch($('toInput'),$('toResults'), (p) => { TO_POINT = p; updateEndpointLabels(); });

    $('langBtn').addEventListener('click', () => {
        LANG = LANG === 'el' ? 'en' : 'el';
        localStorage.setItem('gtLang', LANG);
        applyLang();
        renderVehicleButtons();
    });

    if (FERRY_MODE) $('ferryBtn').classList.add('active');
    if (FUEL_ON) {
        $('fuelToggleBtn').classList.add('active');$('fuelBox').style.display = 'grid';
    }

    loadFuelPrefs();
    renderVehicleButtons();
    applyLang();

    try {
        const res = await fetch('tolls.json');
        window.TOLL_DATA = await res.json();
    } catch (e) {
        console.error('tolls.json failed to load', e);
    }

    if (restoreStateFromUrl()) {
        calculate();
    }
}

function initMap() {
    if (typeof maplibregl === 'undefined') return;
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/dark',
        center: [22.4, 38.8],
        zoom: 5.8,
        attributionControl: false
    });

    map.on('load', () => {
        map.addSource('route', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        map.addLayer({
            id: 'route-glow',
            type: 'line',
            source: 'route',
            paint: { 'line-color': '#ff9f43', 'line-width': 9, 'line-opacity': 0.25, 'line-blur': 4 }
        });
        map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            paint: { 'line-color': '#ff9f43', 'line-width': 4, 'line-opacity': 0.95 }
        });
    });
}

function toggleMapSize() {
    document.body.classList.toggle('map-expanded');
    if (map) setTimeout(() => map.resize(), 260);
}

function buildQuickPicks() {
    const box = $('quickChips');
    if (!box) return;
    box.innerHTML = '';
    QUICK_PICKS.forEach(city => {
        const btn = document.createElement('button');
        btn.className = 'city-chip';
        btn.textContent = city.name[LANG];
        btn.onclick = () => {
            TO_POINT = city;
            $('toInput').value = city.name[LANG];
            updateEndpointLabels();
        };
        box.appendChild(btn);
    });
}

function updateEndpointLabels() {
    const fromInput = $('fromInput'), toInput =$('toInput');
    if (FROM_POINT && fromInput && document.activeElement !== fromInput && !fromInput.value) {
        fromInput.placeholder = '📍 ' + FROM_POINT.name[LANG];
    }
    if (TO_POINT && toInput && document.activeElement !== toInput && !toInput.value) {
        toInput.placeholder = '📍 ' + TO_POINT.name[LANG];
    }
}

function setupSearch(input, resultsBox, onPick) {
    let debounceTimer = null;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const q = input.value.trim();
        if (q.length < 2) { resultsBox.innerHTML = ''; return; }
        debounceTimer = setTimeout(async () => {
            try {
                const langParam = LANG === 'el' ? 'default' : 'en';
                const url = `${PHOTON_SEARCH}?q=${encodeURIComponent(q)}&bbox=${GR_BBOX}&limit=5&lang=${langParam}`;
                const res = await fetch(url);
                const data = await res.json();
                resultsBox.innerHTML = '';
                if (!data.features || !data.features.length) return;

                data.features.forEach(feat => {
                    const [lon, lat] = feat.geometry.coordinates;
                    const p = feat.properties;
                    const name = p.name || p.city || p.town || p.village || q;
                    const sub = [p.city || p.county, p.state].filter(Boolean).join(', ');
                    const label = sub && sub !== name ? `${name} (${sub})` : name;

                    const div = document.createElement('div');
                    div.className = 'geo-result';
                    div.textContent = label;
                    div.onclick = () => {
                        onPick({ name: { el: name, en: name }, lat, lon });
                        input.value = name;
                        resultsBox.innerHTML = '';
                        updateEndpointLabels();
                    };
                    resultsBox.appendChild(div);
                });
            } catch (e) { console.error('Photon search error:', e); }
        }, 300);
    });

    input.addEventListener('focus', () => { if (input.value) input.select(); });
    input.addEventListener('blur', () => { setTimeout(updateEndpointLabels, 150); });

    document.addEventListener('click', (e) => {
        if (!resultsBox.contains(e.target) && e.target !== input) resultsBox.innerHTML = '';
    });
}

function addWaypoint(initialPoint = null) {
    if (WAYPOINTS.length >= 4) return;
    const id = 'wp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    WAYPOINTS.push({ id, point: initialPoint });
    renderWaypoints();
}

function removeWaypoint(id) {
    WAYPOINTS = WAYPOINTS.filter(w => w.id !== id);
    renderWaypoints();
}

function renderWaypoints() {
    const container = $('waypointsContainer');
    container.innerHTML = '';
    WAYPOINTS.forEach((wp, idx) => {
        const row = document.createElement('div');
        row.className = 'endpoint-row';
        row.innerHTML = `
            <div class="endpoint-head">
                <span class="endpoint-label">${t('stop')} ${idx + 1}</span>
            </div>
            <div class="search-wrap">
                <input type="text" id="input_${wp.id}" autocomplete="off" value="${wp.point ? wp.point.name[LANG] : ''}" placeholder="...">
                <button class="remove-stop-btn" onclick="removeWaypoint('${wp.id}')">✕</button>
                <div class="geo-results" id="results_${wp.id}"></div>
            </div>
        `;
        container.appendChild(row);
        setupSearch($(`input_${wp.id}`), $(`results_${wp.id}`), (picked) => { wp.point = picked; });
    });
}

async function useGpsOrigin() {
    if (!navigator.geolocation) { showError(t('err_gps')); return; }
    const btn = $('gpsBtn');
    btn.disabled = true;
    btn.textContent = '⏳ ' + t('locating');

    const restoreBtn = () => {
        btn.disabled = false;
        btn.textContent = t('use_gps');
    };

    navigator.geolocation.getCurrentPosition(async (pos) => {
        restoreBtn();
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        FROM_POINT = {
            name: { el: 'Η τοποθεσία μου', en: 'My location' },
            lat, lon
        };
        try {
            const rev = await fetch(`${PHOTON_REVERSE}?lon=${lon}&lat=${lat}`);
            const rd = await rev.json();
            if (rd.features && rd.features.length) {
                const p = rd.features[0].properties;
                const label = p.name || p.city || p.town || p.village || p.street;
                if (label) FROM_POINT.name = { el: label, en: label };
            }
        } catch (e) {}
        $('fromInput').value = FROM_POINT.name[LANG];
        updateEndpointLabels();
    }, (err) => {
        restoreBtn();
        if (err.code === 1) showError(t('err_gps'));
        else if (err.code === 2) showError(t('err_gps_off'));
        else showError(t('err_gps_timeout'));
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
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
            loadFuelPrefs();
            renderVehicleButtons();
            if (LAST_RESULT) calculate();
        };
        grid.appendChild(b);
    });
}

function loadFuelPrefs() {
    const savedCons = localStorage.getItem(`gtCons_${VEHICLE}`);
    const savedPrice = localStorage.getItem('gtFuelPrice');
    $('consumptionInput').value = savedCons || DEFAULT_CONSUMPTION[VEHICLE] || 6.5;
    if (savedPrice) $('priceInput').value = savedPrice;
}

function saveFuelPrefs() {
    localStorage.setItem(`gtCons_${VEHICLE}`, $('consumptionInput').value);
    localStorage.setItem('gtFuelPrice', $('priceInput').value);
}

function applyLang() {
    document.documentElement.lang = LANG;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    $('langBtn').textContent = LANG === 'el' ? 'EN' : 'EL';
    buildQuickPicks();
    renderWaypoints();
    updateEndpointLabels();
}

function swapCities() {
    [FROM_POINT, TO_POINT] = [TO_POINT, FROM_POINT];
    const fromInput = $('fromInput'), toInput =$('toInput');
    [fromInput.value, toInput.value] = [toInput.value, fromInput.value];
    WAYPOINTS.reverse();
    renderWaypoints();
    updateEndpointLabels();
    if (LAST_RESULT) calculate();
}

function toggleRoundTrip() {
    ROUND_TRIP = !ROUND_TRIP;
    $('roundTripBtn').classList.toggle('active', ROUND_TRIP);
    if (LAST_RESULT) calculate();
}

function toggleFerry() {
    FERRY_MODE = !FERRY_MODE;
    localStorage.setItem('gtFerry', FERRY_MODE ? '1' : '0');
    $('ferryBtn').classList.toggle('active', FERRY_MODE);
    if (LAST_RESULT) calculate();
}

function toggleFuel() {
    FUEL_ON = !FUEL_ON;
    localStorage.setItem('gtFuelOn', FUEL_ON ? '1' : '0');
    $('fuelToggleBtn').classList.toggle('active', FUEL_ON);$('fuelBox').style.display = FUEL_ON ? 'grid' : 'none';
    if (LAST_RESULT) calculate();
}

function toggleTollFree() {
    TOLL_FREE_MODE = !TOLL_FREE_MODE;
    $('tollFreeToggleBtn').classList.toggle('active', TOLL_FREE_MODE);
    if (LAST_RESULT) calculate();
}

function changePassengers(delta) {
    PASSENGERS = Math.max(1, Math.min(9, PASSENGERS + delta));
    $('paxCount').textContent = `${PASSENGERS} 👤`;
    updatePerPersonDisplay();
}

function updatePerPersonDisplay() {
    if (!LAST_RESULT) return;
    const grandTotal = LAST_RESULT.total + (LAST_RESULT.fuelCost || 0);
    $('perPersonAmount').textContent = fmt(grandTotal / PASSENGERS);
}

function showError(msg) {
    const box = $('errBox');
    box.textContent = msg;
    box.style.display = 'block';
    setTimeout(() => { box.style.display = 'none'; }, 5000);
}

async function fetchRouteOSRM(points, avoidTolls = false) {
    const coordString = points.map(p => `${p.lon},${p.lat}`).join(';');
    const query = `${coordString}?overview=full&alternatives=false&steps=false`;

    if (avoidTolls) {
        const valhallaRes = await fetchTollFreeValhalla(points);
        if (valhallaRes && valhallaRes.geometry) {
            return {
                routes: [{
                    distance: valhallaRes.distKm * 1000,
                    duration: valhallaRes.durMin * 60,
                    geometry: valhallaRes.geometry
                }]
            };
        }
    }

    for (const base of OSRM_SERVERS) {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 4500);
            const res = await fetch(base + query, { signal: ctrl.signal });
            clearTimeout(timer);
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes.length) return data;
            if (data.code === 'NoRoute') throw Object.assign(new Error(t('err_route')), { definitive: true });
        } catch (e) {
            if (e.definitive) throw e;
        }
    }
    throw new Error('All routing servers failed');
}

async function fetchTollFreeValhalla(points) {
    try {
        const body = {
            locations: points.map(p => ({ lat: p.lat, lon: p.lon })),
            costing: VEHICLE === 'moto' ? 'motorcycle' : (VEHICLE === 'truck' ? 'truck' : 'auto'),
            costing_options: {
                auto: { use_tolls: 0 },
                motorcycle: { use_tolls: 0 },
                truck: { use_tolls: 0 }
            },
            units: 'kilometers'
        };
        const res = await fetch(VALHALLA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.trip || !data.trip.summary) return null;
        return {
            distKm: data.trip.summary.length,
            durMin: Math.round(data.trip.summary.time / 60),
            geometry: null
        };
    } catch (e) {
        return null;
    }
}

async function calculate() {
    if (!window.TOLL_DATA) { showError(t('err_service')); return; }
    if (!FROM_POINT || !TO_POINT) { showError(t('err_no_location')); return; }
    if (Math.abs(FROM_POINT.lat - TO_POINT.lat) < 0.0005 && Math.abs(FROM_POINT.lon - TO_POINT.lon) < 0.0005) {
        showError(t('err_same')); return;
    }

    const activeWaypoints = WAYPOINTS.map(w => w.point).filter(Boolean);
    const allPoints = [FROM_POINT, ...activeWaypoints, TO_POINT];

    const btn = $('calcBtn');
    btn.disabled = true;
    $('loader').style.display = 'block';

    try {
        const [osrmData, tollFreeSummary] = await Promise.all([
            fetchRouteOSRM(allPoints, TOLL_FREE_MODE),
            TOLL_FREE_MODE ? Promise.resolve(null) : fetchTollFreeValhalla(allPoints)
        ]);

        const route = osrmData.routes[0];
        const distKm = route.distance / 1000;
        const durMin = Math.round(route.duration / 60);
        const pts = route.geometry ? decodePolyline(route.geometry) : [];

        const veh = VEHICLES.find(v => v.id === VEHICLE);
        let matched = TOLL_FREE_MODE ? [] : matchTollsStrictChain(pts, veh.cat);

        if (FERRY_MODE && !TOLL_FREE_MODE) {
            const FERRY_PRICES = [2.00, 7.00, 13.00, 26.00];
            matched = matched.map(m => {
                if (m.station.op === 'Gefyra') {
                    return { ...m, price: FERRY_PRICES[veh.cat], viaFerry: true };
                }
                return m;
            });
        }

        const oneWay = matched.reduce((acc, m) => acc + m.price, 0);
        const total = ROUND_TRIP ? oneWay * 2 : oneWay;

        let fuelCost = null;
        if (FUEL_ON) {
            const cons = parseFloat($('consumptionInput').value) || 0;
            const price = parseFloat($('priceInput').value) || 0;
            fuelCost = (distKm / 100) * cons * price * (ROUND_TRIP ? 2 : 1);
        }

        LAST_RESULT = { points: allPoints, distKm, durMin, matched, total, fuelCost, tollFreeSummary, isTollFree: TOLL_FREE_MODE };
        renderResult(LAST_RESULT);
        if (pts.length > 0) drawRouteOnMap(pts, matched, allPoints);
        syncStateToUrl();
    } catch (e) {
        console.error(e);
        showError(e.definitive ? t('err_route') : t('err_service'));
    } finally {
        btn.disabled = false;
        $('loader').style.display = 'none';
    }
}

// Δυναμική σάρωση πολυγραμμής με ανοχή 4.5km (καλύπτει Α1, Α2, Α8 Ολυμπία Οδό, Α7 Μορέα κλπ.)
function matchTollsStrictChain(routePts, vehicleCat) {
    if (!window.TOLL_DATA || !window.TOLL_DATA.stations) return [];

    const matched = [];
    const seen = new Set();
    let attikiBilled = false;

    for (let i = 0; i < routePts.length; i++) {
        const [lon, lat] = routePts[i];
        
        window.TOLL_DATA.stations.forEach(st => {
            if (seen.has(st.id)) return;

            const d = haversine(lat, lon, st.lat, st.lon);
            if (d < 4.5) {
                if (st.op === 'Attiki Odos') {
                    if (!attikiBilled) {
                        seen.add(st.id);
                        matched.push({ station: st, price: st.prices[vehicleCat], routeIdx: i });
                        attikiBilled = true;
                    }
                    return;
                }

                if (st.type === 'main' || st.type === 'special') {
                    seen.add(st.id);
                    matched.push({ station: st, price: st.prices[vehicleCat], routeIdx: i });
                }
            }
        });
    }

    return matched.sort((a, b) => a.routeIdx - b.routeIdx);
}

function drawRouteOnMap(pts, matched, allPoints) {
    if (!map || !map.getSource('route')) return;

    map.getSource('route').setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: pts }
    });

    mapMarkers.forEach(m => m.remove());
    mapMarkers = [];

    matched.forEach(m => {
        const el = document.createElement('div');
        el.className = 'toll-marker' + (m.station.type === 'side' ? ' side-booth' : '');
        el.textContent = `${m.station.name[LANG]} · ${fmt(m.price)}`;
        el.onclick = () => focusStation(m.station.lat, m.station.lon);

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([m.station.lon, m.station.lat])
            .addTo(map);
        mapMarkers.push(marker);
    });

    const bounds = new maplibregl.LngLatBounds();
    pts.forEach(coord => bounds.extend(coord));
    map.fitBounds(bounds, { padding: { top: 60, bottom: 260, left: 40, right: 40 }, maxZoom: 12 });
}

function focusStation(lat, lon) {
    if (!map) return;
    document.body.classList.add('map-expanded');
    setTimeout(() => {
        map.resize();
        map.flyTo({ center: [lon, lat], zoom: 13.5, essential: true });
    }, 200);
}

function renderResult({ points, distKm, durMin, matched, total, fuelCost, tollFreeSummary, isTollFree }) {
    $('totalAmount').textContent = fmt(total);
    const mult = ROUND_TRIP ? 2 : 1;
    const totalDist = Math.round(distKm * mult);
    const totalDur = durMin * mult;
    const hrs = Math.floor(totalDur / 60);
    const mins = totalDur % 60;

    const namesChain = points.map(p => `<b>${p.name[LANG]}</b>`).join(' → ');
    $('routeMeta').innerHTML =
        `${namesChain}<br>${totalDist} km · ${hrs}h ${mins}m` +
        (isTollFree ? ` <span style="color:var(--accent-green)">(Χωρίς διόδια)</span>` : '') +
        (ROUND_TRIP ? ` <span style="color:var(--accent)">${t('roundtrip_note')}</span>` : '');

    const altBanner = $('altBanner');
    if (tollFreeSummary && !isTollFree && total > 0) {
        const diffMin = Math.max(0, (tollFreeSummary.durMin - durMin) * mult);
        const diffKm = Math.round((tollFreeSummary.distKm - distKm) * mult);
        const signKm = diffKm >= 0 ? `+${diffKm}` : `${diffKm}`;
        altBanner.style.display = 'flex';
        altBanner.innerHTML = `
            <span>🛣️ <b>${t('alt_free_prefix')}</b> +${diffMin} min (${signKm} km)</span>
            <b>${t('alt_saves')} ${fmt(total)}</b>
        `;
    } else {
        altBanner.style.display = 'none';
    }

    updatePerPersonDisplay();

    const stats = [
        { v: fmt(total), k: t('tolls') },
        { v: totalDist + ' km', k: t('distance') },
        { v: matched.length + (ROUND_TRIP ? ' ×2' : ''), k: t('stations_count') }
    ];
    if (fuelCost !== null) {
        stats.push({ v: fmt(fuelCost), k: t('fuel_cost') });
        stats.push({ v: fmt(total + fuelCost), k: t('trip_total') });
    }
    $('subStats').innerHTML = stats.map(s =>
        `<div class="sub-stat"><div class="v">${s.v}</div><div class="k">${s.k}</div></div>`
    ).join('');

    const badgeLabel = (type) => type === 'main' ? t('type_main') : (type === 'side' ? t('type_side') : t('type_special'));

    $('stationList').innerHTML = matched.map(m =>
        `<li class="station-item" onclick="focusStation(${m.station.lat}, ${m.station.lon})">
            <span class="station-name">
                ${m.station.name[LANG]}
                <span class="station-badge">${badgeLabel(m.station.type)}</span>
                <span class="station-road">${m.station.road} · ${m.station.op}</span>
            </span>
            <span class="station-price">${m.viaFerry ? '⛴️ ' : ''}${fmt(m.price)}</span>
        </li>`
    ).join('') || `<li class="station-item" style="color:var(--text-dim)">${isTollFree ? 'Μηδενικά διόδια' : t('no_stations')}</li>`;

    const originParam = `${points[0].lat},${points[0].lon}`;
    const destParam = `${points[points.length - 1].lat},${points[points.length - 1].lon}`;
    const wpParam = points.length > 2
        ? '&waypoints=' + points.slice(1, -1).map(p => `${p.lat},${p.lon}`).join('|')
        : '';
    $('gmapsLink').href = `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}${wpParam}&travelmode=driving`;

    const subject = encodeURIComponent('GreekTolls: Αναφορά τιμής διοδίων');
    const body = encodeURIComponent(
        `Διαδρομή: ${points.map(p => p.name.el).join(' -> ')}\n` +
        `Όχημα: ${VEHICLE}\n` +
        `Υπολογισμένο σύνολο: ${total.toFixed(2)} €\n\n` +
        `Σταθμοί:\n` + matched.map(m => `- ${m.station.name.el} (${m.station.road}): ${m.price.toFixed(2)} €`).join('\n')
    );
    $('reportLink').href = `mailto:theursoalbo@gmail.com?subject=${subject}&body=${body}`;

    $('results').style.display = 'block';
}

function syncStateToUrl() {
    if (!FROM_POINT || !TO_POINT) return;
    const params = new URLSearchParams();
    params.set('from', `${FROM_POINT.lat.toFixed(4)},${FROM_POINT.lon.toFixed(4)},${FROM_POINT.name[LANG]}`);
    params.set('to', `${TO_POINT.lat.toFixed(4)},${TO_POINT.lon.toFixed(4)},${TO_POINT.name[LANG]}`);
    params.set('v', VEHICLE);
    if (ROUND_TRIP) params.set('rt', '1');
    if (TOLL_FREE_MODE) params.set('tf', '1');
    history.replaceState(null, '', '?' + params.toString());
}

function restoreStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('from') || !params.has('to')) return false;
    try {
        const parsePt = (str) => {
            const [lat, lon, ...nameParts] = str.split(',');
            const nm = nameParts.join(',') || 'Point';
            return { lat: parseFloat(lat), lon: parseFloat(lon), name: { el: nm, en: nm } };
        };
        FROM_POINT = parsePt(params.get('from'));
        TO_POINT = parsePt(params.get('to'));
        $('fromInput').value = FROM_POINT.name[LANG];$('toInput').value = TO_POINT.name[LANG];
        if (params.has('v')) VEHICLE = params.get('v');
        if (params.get('rt') === '1') {
            ROUND_TRIP = true;
            $('roundTripBtn').classList.add('active');
        }
        if (params.get('tf') === '1') {
            TOLL_FREE_MODE = true;
            $('tollFreeToggleBtn').classList.add('active');
        }
        renderVehicleButtons();
        return true;
    } catch (e) {
        return false;
    }
}

async function shareResult() {
    if (!LAST_RESULT) return;
    const r = LAST_RESULT;
    const names = r.points.map(p => p.name[LANG]).join(' → ');
    const text = `${names}: ${fmt(r.total)} (${Math.round(r.distKm * (ROUND_TRIP ? 2 : 1))} km) — GreekTolls`;
    const shareUrl = window.location.href;

    if (navigator.share) {
        try { await navigator.share({ title: 'GreekTolls', text, url: shareUrl }); } catch (e) {}
    } else {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        alert(t('copied'));
    }
}

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
