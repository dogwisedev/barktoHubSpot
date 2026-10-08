/**
 * BARK BUSTER — TRAINERS + GEO
 * Edit TRAINERS directly. lat/lon = ZIP centroid. range = miles the trainer covers.
 * range marked "// default" was not on file — confirm with ops.
 */
(function (root) {
  // FALLBACK ONLY: snapshot of active trainers from 2026-10-08, used if DogwiseTrainers can't be reached.
  // The live list comes from the app via setTrainers() below.
  // Active = visible block above "FORMER". range = miles (hours converted at 50 mph where the sheet gives hours).
  // soon2 / soon3 = first week (Sunday) with a slot free for 2 / 3 weeks in a row. freeNext4/8 = free slot-weeks.
  const SNAPSHOT = "2026-10-08";
  let TRAINERS = [
    { name: "Alex Santiago", zip: "11729", city: "Deer Park", state: "NY", lat: 40.7591, lon: -73.3257, range: 125, slots: 5, freeNext4: 19, freeNext8: 39, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Matthew Gensinger", zip: "11784", city: "Selden", state: "NY", lat: 40.8699, lon: -73.0448, range: 65, slots: 6, freeNext4: 24, freeNext8: 48, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Amanda Kranz", zip: "12590", city: "Wappingers Falls", state: "NY", lat: 41.5950, lon: -73.8876, range: 100, slots: 2, freeNext4: 6, freeNext8: 12, soon2: "2026-10-11", soon3: "2026-10-11" },
    { name: "Mike Colt", zip: "07832", city: "Columbia", state: "NJ", lat: 40.9388, lon: -75.0550, range: 200, slots: 8, freeNext4: 27, freeNext8: 56, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Nyeem \"Cal\" Calhoun", zip: "08330", city: "Mays Landing", state: "NJ", lat: 39.4320, lon: -74.6962, range: 150, slots: 5, freeNext4: 12, freeNext8: 24, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Eddie Bonilla", zip: "03076", city: "Pelham", state: "NH", lat: 42.7288, lon: -71.3046, range: 100, slots: 3, freeNext4: 7, freeNext8: 12, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Drew Thompson", zip: "06606", city: "Bridgeport", state: "CT", lat: 41.2091, lon: -73.2086, range: 100, slots: 2, freeNext4: 8, freeNext8: 16, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Jessica Rutledge", zip: "06010", city: "Bristol", state: "CT", lat: 41.6823, lon: -72.9302, range: 50, slots: 3, freeNext4: 3, freeNext8: 15, soon2: "2026-11-01", soon3: "2026-11-01" },
    { name: "David Lewis", zip: "20764", city: "Shady Side", state: "MD", lat: 38.8368, lon: -76.5109, range: 120, slots: 5, freeNext4: 20, freeNext8: 40, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Diamond Warren", zip: "21218", city: "Baltimore", state: "MD", lat: 39.3265, lon: -76.6048, range: 150, slots: 5, freeNext4: 7, freeNext8: 21, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "April Crawford", zip: "23320", city: "Chesapeake", state: "VA", lat: 36.7352, lon: -76.2384, range: 100, slots: 3, freeNext4: 12, freeNext8: 24, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Rina Sullivan", zip: "32909", city: "Palm Bay", state: "FL", lat: 27.9694, lon: -80.6473, range: 50, slots: 5, freeNext4: 19, freeNext8: 39, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "James Guillory", zip: "33556", city: "Odessa", state: "FL", lat: 28.1421, lon: -82.5905, range: 200, slots: 4, freeNext4: 15, freeNext8: 29, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Tracie Dulniak", zip: "33315", city: "Fort Lauderdale", state: "FL", lat: 26.0989, lon: -80.1541, range: 50, slots: 5, freeNext4: 4, freeNext8: 20, soon2: "2026-10-25", soon3: "2026-10-25" },
    { name: "Melina Molinare", zip: "33145", city: "Miami", state: "FL", lat: 25.7539, lon: -80.2253, range: 75, slots: 2, freeNext4: 6, freeNext8: 14, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Sarah Dalton", zip: "28034", city: "Dallas", state: "NC", lat: 35.3349, lon: -81.1862, range: 150, slots: 3, freeNext4: 12, freeNext8: 24, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Tressie Courtney", zip: "11779", city: "Ronkonkoma", state: "NY", lat: 40.8083, lon: -73.1305, range: 125, slots: 8, freeNext4: 32, freeNext8: 64, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Jason Lewis", zip: "29130", city: "Ridgeway", state: "SC", lat: 34.3167, lon: -80.9288, range: 250, slots: 4, freeNext4: 13, freeNext8: 29, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Theresa Strickland", zip: "30075", city: "Roswell", state: "GA", lat: 34.0408, lon: -84.3859, range: 40, slots: 4, freeNext4: 11, freeNext8: 26, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Opal O'Brien", zip: "30087", city: "Stone Mountain", state: "GA", lat: 33.8082, lon: -84.1702, range: 75, slots: 6, freeNext4: 24, freeNext8: 48, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Jarret Price", zip: "31047", city: "Kathleen", state: "GA", lat: 32.4672, lon: -83.6128, range: 60, slots: 3, freeNext4: 1, freeNext8: 7, soon2: "2026-11-08", soon3: "2026-11-08" },
    { name: "Bailey Preston", zip: "48328", city: "Waterford", state: "MI", lat: 42.6429, lon: -83.3546, range: 100, slots: 6, freeNext4: 9, freeNext8: 24, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Jordan Williams", zip: "44137", city: "Maple Heights", state: "OH", lat: 41.4105, lon: -81.5603, range: 200, slots: 5, freeNext4: 17, freeNext8: 37, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Nicole Murray", zip: "46208", city: "Indianapolis", state: "IN", lat: 39.8299, lon: -86.1794, range: 150, slots: 6, freeNext4: 14, freeNext8: 38, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Cedric Coleman", zip: "60408", city: "Braidwood", state: "IL", lat: 41.2657, lon: -88.2231, range: 100, slots: 5, freeNext4: 15, freeNext8: 35, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Felicity Houston", zip: "76209", city: "Denton", state: "TX", lat: 33.2346, lon: -97.1131, range: 40, slots: 2, freeNext4: 2, freeNext8: 10, soon2: "2026-11-01", soon3: "2026-11-01" },
    { name: "Florence Montanez", zip: "77493", city: "Katy", state: "TX", lat: 29.8678, lon: -95.8298, range: 100, slots: 3, freeNext4: 8, freeNext8: 13, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Wildon Bloodworth", zip: "76549", city: "Killeen", state: "TX", lat: 31.0065, lon: -97.8410, range: 75, slots: 3, freeNext4: 9, freeNext8: 21, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Cassandra Anderson", zip: "77713", city: "Beaumont", state: "TX", lat: 30.0850, lon: -94.2607, range: 200, slots: 4, freeNext4: 16, freeNext8: 32, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Joi Martin", zip: "77017", city: "Houston", state: "TX", lat: 29.6863, lon: -95.2555, range: 25, slots: 3, freeNext4: 12, freeNext8: 24, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Ashlyn Rechtiene", zip: "80134", city: "Parker", state: "CO", lat: 39.4895, lon: -104.8447, range: 50, slots: 5, freeNext4: 7, freeNext8: 23, soon2: "2026-10-18", soon3: "2026-10-18" },
    { name: "Jerry Self", zip: "85345", city: "Peoria", state: "AZ", lat: 33.5735, lon: -112.2596, range: 200, slots: 6, freeNext4: 12, freeNext8: 33, soon2: "2026-10-11", soon3: "2026-10-11" },
    { name: "Njoud Aghabi", zip: "90803", city: "Long Beach", state: "CA", lat: 33.7619, lon: -118.1341, range: 100, slots: 2, freeNext4: 4, freeNext8: 12, soon2: "2026-10-18", soon3: "2026-10-18" },
    { name: "Ryan Chudacoff", zip: "92371", city: "Phelan", state: "CA", lat: 34.4449, lon: -117.5196, range: 100, slots: 4, freeNext4: 4, freeNext8: 20, soon2: "2026-10-25", soon3: "2026-10-25" },
    { name: "Deanne", zip: "92371", city: "Phelan", state: "CA", lat: 34.4449, lon: -117.5196, range: 100, slots: 4, freeNext4: 7, freeNext8: 23, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Priscilla Rodriguez", zip: "90241", city: "Downey", state: "CA", lat: 33.9416, lon: -118.1306, range: 25, slots: 2, freeNext4: 7, freeNext8: 12, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Jessica Walsh", zip: "93505", city: "California City", state: "CA", lat: 35.1278, lon: -117.9651, range: 400, slots: 3, freeNext4: 3, freeNext8: 13, soon2: "2026-10-25", soon3: "2026-10-25" },
    { name: "Joseph Serrano", zip: "93635", city: "Los Banos", state: "CA", lat: 37.0627, lon: -120.8544, range: 100, slots: 4, freeNext4: 15, freeNext8: 29, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Sterling Chu", zip: "94536", city: "Fremont", state: "CA", lat: 37.5605, lon: -121.9999, range: 50, slots: 3, freeNext4: 9, freeNext8: 21, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Olivia Sheehan", zip: "95376", city: "Tracy", state: "CA", lat: 37.7383, lon: -121.4345, range: 75, slots: 4, freeNext4: 8, freeNext8: 17, soon2: "2026-10-04", soon3: "2026-10-04" },
    { name: "Karen Arguello", zip: "95623", city: "El Dorado", state: "CA", lat: 38.6330, lon: -120.8498, range: 50, slots: 2, freeNext4: 0, freeNext8: 0, soon2: "2026-12-13", soon3: "2026-12-13" },
    { name: "Heather Truax", zip: "98133", city: "Seattle", state: "WA", lat: 47.7377, lon: -122.3431, range: 50, slots: 5, freeNext4: 14, freeNext8: 30, soon2: "2026-10-04", soon3: "2026-10-04" },
  ];

  const STATE_TZ = {
    AL:'America/Chicago', AK:'America/Anchorage', AZ:'America/Phoenix', AR:'America/Chicago',
    CA:'America/Los_Angeles', CO:'America/Denver', CT:'America/New_York', DE:'America/New_York',
    FL:'America/New_York', GA:'America/New_York', HI:'Pacific/Honolulu', ID:'America/Denver',
    IL:'America/Chicago', IN:'America/Indiana/Indianapolis', IA:'America/Chicago', KS:'America/Chicago',
    KY:'America/New_York', LA:'America/Chicago', ME:'America/New_York', MD:'America/New_York',
    MA:'America/New_York', MI:'America/Detroit', MN:'America/Chicago', MS:'America/Chicago',
    MO:'America/Chicago', MT:'America/Denver', NE:'America/Chicago', NV:'America/Los_Angeles',
    NH:'America/New_York', NJ:'America/New_York', NM:'America/Denver', NY:'America/New_York',
    NC:'America/New_York', ND:'America/Chicago', OH:'America/New_York', OK:'America/Chicago',
    OR:'America/Los_Angeles', PA:'America/New_York', RI:'America/New_York', SC:'America/New_York',
    SD:'America/Chicago', TN:'America/Chicago', TX:'America/Chicago', UT:'America/Denver',
    VT:'America/New_York', VA:'America/New_York', WA:'America/Los_Angeles', WV:'America/New_York',
    WI:'America/Chicago', WY:'America/Denver', DC:'America/New_York'
  };

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 3958.8, toR = Math.PI / 180;
    const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Trainers that cover the lead and have free slots first, closest first. */
  function nearestTrainers(lat, lon, limit = 3) {
    return TRAINERS
      .map(t => {
        const distance = Math.round(haversine(lat, lon, t.lat, t.lon));
        return { ...t, distance, ratio: distance / t.range, inRange: distance <= t.range, available: (t.freeNext8 ?? 1) > 0 };
      })
      // In-range trainers first, closest first (shortest drive for sales); then out-of-range by how far over they are
      .sort((a, b) => (b.inRange - a.inRange) || (a.inRange ? (b.available - a.available) || a.distance - b.distance : a.ratio - b.ratio))
      .slice(0, limit);
  }

  function localTime(state, now = new Date()) {
    const tz = STATE_TZ[state];
    if (!tz) return null;
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
    const label = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(now);
    return { hour, label };
  }

  function mapsLink(origin, t) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(`${t.city}, ${t.state} ${t.zip}`)}&travelmode=driving`;
  }

  // ── Live list from DogwiseTrainers (/api/availability). The list above is only the fallback. ──
  let SOURCE = { kind: "snapshot", at: SNAPSHOT };
  /** Replace the trainer list with the app's live one. source: { kind: "live" | "cached", at: ISO time } */
  function setTrainers(list, source) {
    const clean = (list || []).filter(t => t && t.lat != null && t.lon != null && t.range).map(t => ({
      name: t.name, zip: t.zip || "", city: t.city || "", state: t.state || "", lat: +t.lat, lon: +t.lon,
      range: +t.range, slots: t.capacity ?? t.slots, freeNext4: t.freeNext4, freeNext8: t.freeNext8, soon2: t.soon2 || null, soon3: t.soon3 || null
    }));
    if (!clean.length) return false;
    TRAINERS = clean;
    SOURCE = source || { kind: "live", at: new Date().toISOString() };
    return true;
  }

  root.BB_GEO = {
    SNAPSHOT, STATE_TZ, haversine, nearestTrainers, localTime, mapsLink, setTrainers,
    get TRAINERS() { return TRAINERS; },
    get SOURCE() { return SOURCE; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
