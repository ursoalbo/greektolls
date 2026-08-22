'use strict';
/* GreekTolls — route toll calculator for Greek motorways.
   Data: tolls.json (curated). Routing: OSRM public demo server. */

let LANG = localStorage.getItem('gtLang') || 'el';
let VEHICLE = localStorage.getItem('gtVehicle') || 'moto';
let ROUND_TRIP = false;
let FUEL_ON = false;
let CITIES = [];
let LAST_RESULT = null;

const OSRM = 'https://router.project-osrm.org/route/v1/driving/';

const I18N = {
    el: {
        tagline: 'Υπολόγισε το κόστος διόδιας για το ταξίδι σου',
        from: 'Αφετηρία', to: 'Προορισμός', vehicle: 'Όχημα',
        round_trip: '↔ Μετ\' επιστροφής', fuel_toggle: '⛽ Υπολογ. καυσίμων',
        consumption: 'Κατανάλωση (L/100km)', fuel_price: 'Τιμή καυσίμου (€/L)',
        calculate: 'Υπολογισμός', total_tolls: 'Συνολικά δίodia',
        stations_on_route: 'Σταθμοί στη διαδρομή', share: 'Μοιράσου',
        report_price: 'Λάθος τιμή;', disclaimer: 'Ενδεικτικές τιμές μετρητά, τελευταία ενημέρωση Αύγουστος 2026. Οι τιμές μπορεί να έχουν αλλάξει — αναφέρετε ασυμφωνίες.',
        err_route: 'Δεν βρέθηκε διαδρομή μεταξύ αυτών των σημείων.',
        err_generic: 'Σφάλμα. Δοκίμασε ξανά.',
        tolls: 'Δίodia', distance: 'Απόσταση', duration: 'Χρόνος', fuel_cost: 'Καύσιμα (εκτ.)',
        roundtrip_note: '(μετ\' επιστροφής)',
        via: 'μέσω'
    },
    en: {
        tagline: 'Calculate toll costs for your trip in Greece',
        from: 'From', to: 'To', vehicle: 'Vehicle',
        round_trip: '↔ Round trip', fuel_toggle: '⛽ Fuel estimate',
        consumption: 'Consumption (L/100km)', fuel_price: 'Fuel price (€/L)',
        calculate: 'Calculate', total_tolls: 'Total tolls',
        stations_on_route: 'Stations on route', share: 'Share',
        report_price: 'Wrong price?', disclaimer: 'Indicative cash prices, last updated August 2026. Prices may have changed — report discrepancies.',
        err_route: 'No route found between these points.',
        err_generic: 'Error. Try again.',
        tolls: 'Tolls', distance: 'Distance', duration: 'Time', fuel_cost: 'Fuel (est.)',
        roundtrip_note: '(round trip)',
        via: 'via'
    }
};

// Vehicle classes: all 4 Greek toll categories
const VEHICLES = [
    { id: 'moto', cat: 0, label: { el: 'Μοτοσυκλέτα', en: 'Motorcycle' }, icon: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-1 1h-3l-2 5 3 3h2m-5-3-2 5.5M12 12l4.5 4L18 17.5"/></svg>' },
    { id: 'car', cat: 1, label: { el: 'Αυτοκίνητο', en: 'Car' }, icon: '<svg viewBox="0 0 24 24"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14a1 1 0 0 1 1 1v4h-2m-12 0H4v-4a1 1 0 0 1 1-1zm2 5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zm8 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z"/></svg>' },
    { id: 'van', cat: 2, label: { el: 'Βαν / 3άξονο', en: 'Van / 3-axle' }, icon: '<svg viewBox="0 0 24 24"><rect x="1" y="6" width="14" height="10" rx="1"/><path d="M15 9h4l3 4v3h-2m-13 0h8"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>' },
    { id: 'truck', cat: 3, label: { el: 'Φορτηγό', en: 'Truck' }, icon: '<svg viewBox="0 0 24 24"><rect x="1" y="5" width="13" height="11" rx="1"/><path d="M14 8h4.5L22 12v4h-3m-14 0h7"/><circle cx="5.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/></svg>' }
];

// Major cities/waypoints for the dropdowns (lat, lon)
const CITY_LIST = [
    { name: { el: 'Αθήνα', en: 'Athens' }, lat: 37.9838, lon: 23.7275 },
    { name: { el: 'Θεσσαλονίκη', en: 'Thessaloniki' }, lat: 40.6401, lon: 22.9444 },
    { name: { el: 'Πάτρα', en: 'Patras' }, lat: 38.2466, lon: 21.7346 },
    { name: { el: 'Ηράκλειο', en: 'Heraklion' }, lat: 35.3387, lon: 25.1442 },
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
    { name: { el: 'Ρόδος', en: 'Rhodes' }, lat: 36.4456, lon: 28.2229 },
    { name: { el: 'Κέρκυρα', en: 'Corfu' }, lat: 39.6243, lon: 19.9217 },
    { name: { el: 'Χανιά', en: 'Chania' }, lat: 35.5118, lon: 24.0180 }
];

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toFixed(2) + ' €';
const t = (key) => (I18N[LANG] && I18N[LANG][key]) || I18N.el[key] || key;

async function main() {
    const res = await fetch('tolls.json');
    const data = await res.json();
    CITIES = data; // keep stations accessible
    window.TOLL_DATA = data;

    populateSelects();
    renderVehicleButtons();
    applyLang();
    $('langBtn').addEventListener('click', () => {
        LANG = LANG === 'el' ? 'en' : 'el';
        localStorage.setItem('gtLang', LANG);
        populateSelects();
        applyLang();
        renderVehicleButtons();
    });
}

function populateSelects() {
    const fromSel = $('fromSel');
    const toSel = $('toSel');
    fromSel.innerHTML = '';
    toSel.innerHTML = '';
    CITY_LIST.forEach((c, i) => {
        fromSel.add(new Option(c.name[LANG], i));
        toSel.add(new Option(c.name[LANG], i));
    });
    fromSel.value = '0';  // Athens
    toSel.value = '1';    // Thessaloniki
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
}

function swapCities() {
    const f = $('fromSel'), to = $('toSel');
    const tmp = f.value;
    f.value = to.value;
    to.value = tmp;
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

async function calculate() {
    const from = CITY_LIST[parseInt($('fromSel').value, 10)];
    const to = CITY_LIST[parseInt($('toSel').value, 10)];
    if (!from || !to || from === to) return;

    const btn = $('calcBtn');
    btn.disabled = true;
    $('loader').style.display = 'block';
    $('results').style.display = 'none';

    try {
        const url = `${OSRM}${from.lon},${from.lat};${to.lon},${to.lat}?overview=false&alternatives=false&steps=false`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
            throw new Error(t('err_route'));
        }
        const route = data.routes[0];
        const distKm = route.distance / 1000;
        const durMin = Math.round(route.duration / 60);
        // Decode OSRM polyline (precision 5) to sample route points
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

        renderResult({ from, to, distKm, durMin, matched, oneWay, total, fuelCost });
        LAST_RESULT = { from, to, distKm, durMin, matched, total, fuelCost };
    } catch (e) {
        console.error(e);
        showError(e.message === t('err_route') ? t('err_route') : t('err_generic'));
    } finally {
        btn.disabled = false;
        $('loader').style.display = 'none';
    }
}

// Find tolls within ~2.5km of any route point (sampled)
function matchTolls(routePts, vehicleCat) {
    const matched = [];
    const seen = new Set();
    // sample every ~5th point for speed
    for (let i = 0; i < routePts.length; i += 5) {
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
    // sort by road then name for stable listing
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
        { v: fmt(ROUND_TRIP ? total : total), k: t('tolls') },
        { v: Math.round(ROUND_TRIP ? distKm * 2 : distKm) + ' km', k: t('distance') },
        { v: matched.length + (ROUND_TRIP ? ' ×2' : ''), k: LANG === 'el' ? 'Σταθμοί' : 'Stations' }
    ];
    if (fuelCost !== null) {
        stats.push({ v: fmt(fuelCost), k: t('fuel_cost') });
        stats.push({ v: fmt(total + fuelCost), k: LANG === 'el' ? 'Σύνολο ταξιδιού' : 'Trip total' });
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
    ).join('') || `<li class="station-item" style="color:var(--text-dim)">${LANG === 'el' ? 'Κανένας σταθμός διοδίων στη διαδρομή 🎉' : 'No toll stations on this route 🎉'}</li>`;

    // Report link: prefilled mailto
    const subject = encodeURIComponent('GreekTolls: Λάθος τιμή διόδιας');
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
        ? `${r.from.name.el} → ${r.to.name.el}: ${fmt(r.total)} δίodia, ${Math.round(r.distKm)} km${ROUND_TRIP ? ' (μετ\' επιστροφής)' : ''} — GreekTolls`
        : `${r.from.name.en} → ${r.to.name.en}: ${fmt(r.total)} in tolls, ${Math.round(r.distKm)} km${ROUND_TRIP ? ' (round trip)' : ''} — GreekTolls`;
    if (navigator.share) {
        try { await navigator.share({ text }); } catch (e) { /* cancelled */ }
    } else {
        navigator.clipboard.writeText(text);
        alert(LANG === 'el' ? 'Αντιγράφηκε!' : 'Copied!');
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
