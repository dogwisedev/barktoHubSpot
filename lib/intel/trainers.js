/**
 * BARK BUSTER — TRAINERS + GEO
 * Edit TRAINERS directly. lat/lon = ZIP centroid. range = miles the trainer covers.
 * range marked "// default" was not on file — confirm with ops.
 */
(function (root) {
  const TRAINERS = [
    { name: "Tressie Courtney",   zip: "11779", city: "Ronkonkoma",        state: "NY", lat: 40.8083, lon: -73.1305,  range: 100 },
    { name: "Michael Jackson",    zip: "11206", city: "Brooklyn",          state: "NY", lat: 40.7012, lon: -73.9436,  range: 100 }, // default
    { name: "Amanda Kranz",       zip: "12590", city: "Wappingers Falls",  state: "NY", lat: 41.5950, lon: -73.8876,  range: 100 }, // default
    { name: "Mike Colt",          zip: "07832", city: "Columbia",          state: "NJ", lat: 40.9388, lon: -75.0550,  range: 100 }, // default
    { name: "Cal Calhoun",        zip: "08330", city: "Mays Landing",      state: "NJ", lat: 39.4320, lon: -74.6962,  range: 100 }, // default
    { name: "Marquis Tucker",     zip: "07002", city: "Bayonne",           state: "NJ", lat: 40.6664, lon: -74.1192,  range: 100 }, // default
    { name: "Ava Santana",        zip: "01354", city: "New Salem",         state: "MA", lat: 42.6404, lon: -72.4995,  range: 100 },
    { name: "Melissa Tower",      zip: "01524", city: "Leicester",         state: "MA", lat: 42.2370, lon: -71.9188,  range: 100 }, // default
    { name: "Eddie Bonilla",      zip: "03076", city: "Pelham",            state: "NH", lat: 42.7288, lon: -71.3046,  range: 100 },
    { name: "Drew Thompson",      zip: "06606", city: "Bridgeport",        state: "CT", lat: 41.2091, lon: -73.2086,  range: 100 },
    { name: "Jen Hagarman",       zip: "17331", city: "Hanover",           state: "PA", lat: 39.7943, lon: -76.9812,  range: 100 }, // default
    { name: "Diamond Warren",     zip: "21218", city: "Baltimore",         state: "MD", lat: 39.3265, lon: -76.6048,  range: 150 }, // ZIP assumed (city only on file)
    { name: "Kristy Rice",        zip: "20736", city: "Owings",            state: "MD", lat: 38.6955, lon: -76.6061,  range: 100 }, // default
    { name: "Shelby Fleming",     zip: "20776", city: "Harwood",           state: "MD", lat: 38.8582, lon: -76.6145,  range: 75 },
    { name: "April Crawford",     zip: "23320", city: "Chesapeake",        state: "VA", lat: 36.7352, lon: -76.2384,  range: 100 },
    { name: "Jason Lewis",        zip: "29130", city: "Ridgeway",          state: "SC", lat: 34.3167, lon: -80.9288,  range: 250 },
    { name: "Theresa Strickland", zip: "30075", city: "Roswell",           state: "GA", lat: 34.0408, lon: -84.3859,  range: 40 },
    { name: "Opal O'Brien",       zip: "30087", city: "Stone Mountain",    state: "GA", lat: 33.8082, lon: -84.1702,  range: 75 },
    { name: "Jarret Price",       zip: "31047", city: "Kathleen",          state: "GA", lat: 32.4672, lon: -83.6128,  range: 55 },
    { name: "Rina Sullivan",      zip: "32909", city: "Grant-Valkaria",    state: "FL", lat: 27.9694, lon: -80.6473,  range: 50 },
    { name: "James Guillory",     zip: "33556", city: "Odessa",            state: "FL", lat: 28.1421, lon: -82.5905,  range: 200 },
    { name: "Tammy Leatherwood",  zip: "32763", city: "Orange City",       state: "FL", lat: 28.9453, lon: -81.2995,  range: 65 },
    { name: "Tracie Dulniak",     zip: "33315", city: "Fort Lauderdale",   state: "FL", lat: 26.0989, lon: -80.1541,  range: 50 },
    { name: "Melina Molinare",    zip: "33145", city: "Miami",             state: "FL", lat: 25.7539, lon: -80.2253,  range: 75 },
    { name: "Bailey Preston",     zip: "48328", city: "Waterford Twp",     state: "MI", lat: 42.6429, lon: -83.3546,  range: 100 },
    { name: "Nicole Murray",      zip: "46208", city: "Indianapolis",      state: "IN", lat: 39.8299, lon: -86.1794,  range: 150 },
    { name: "Brandon Edmonds",    zip: "60649", city: "Chicago",           state: "IL", lat: 41.7620, lon: -87.5703,  range: 200 },
    { name: "Cedric Coleman",     zip: "60408", city: "Braidwood",         state: "IL", lat: 41.2657, lon: -88.2231,  range: 125 },
    { name: "Cassandra Anderson", zip: "77713", city: "Beaumont",          state: "TX", lat: 30.0850, lon: -94.2607,  range: 200 },
    { name: "Joi Martin",         zip: "77017", city: "Houston",           state: "TX", lat: 29.6863, lon: -95.2555,  range: 25 },  // ZIP from old list — verify
    { name: "Felicity Houston",   zip: "76209", city: "Denton",            state: "TX", lat: 33.2346, lon: -97.1131,  range: 40 },
    { name: "Ashlyn Rechtiene",   zip: "80134", city: "Parker",            state: "CO", lat: 39.4895, lon: -104.8447, range: 50 },
    { name: "Jerry Self",         zip: "85345", city: "Peoria",            state: "AZ", lat: 33.5735, lon: -112.2596, range: 75 },
    { name: "Njoud Aghabi",       zip: "90803", city: "Long Beach",        state: "CA", lat: 33.7619, lon: -118.1341, range: 100 },
    { name: "Ryan Chudacoff",     zip: "92371", city: "Phelan",            state: "CA", lat: 34.4449, lon: -117.5196, range: 100 },
    { name: "Jessica Walsh",      zip: "93505", city: "California City",   state: "CA", lat: 35.1278, lon: -117.9651, range: 400 },
    { name: "Priscilla Rodriguez",zip: "90241", city: "Downey",            state: "CA", lat: 33.9416, lon: -118.1306, range: 25 },
    { name: "Eduardo Bayardo",    zip: "91911", city: "Chula Vista",       state: "CA", lat: 32.6084, lon: -117.0565, range: 100 },
    { name: "Joseph Serrano",     zip: "93635", city: "Los Banos",         state: "CA", lat: 37.0627, lon: -120.8544, range: 125 },
    { name: "Olivia Sheehan",     zip: "95376", city: "Tracy",             state: "CA", lat: 37.7383, lon: -121.4345, range: 75 },
    { name: "Karen Arguello",     zip: "95623", city: "El Dorado",         state: "CA", lat: 38.6330, lon: -120.8498, range: 60 },
    { name: "Marilyn Jaramillo",  zip: "95139", city: "San Jose",          state: "CA", lat: 37.2252, lon: -121.7687, range: 100 },
    { name: "Sterling Chu",       zip: "94536", city: "Fremont",           state: "CA", lat: 37.5605, lon: -121.9999, range: 100 }, // default
    { name: "Heather Truax",      zip: "98133", city: "Shoreline",         state: "WA", lat: 47.7377, lon: -122.3431, range: 50 },
    { name: "Jordan Williams",    zip: "44137", city: "Maple Heights",     state: "OH", lat: 41.4105, lon: -81.5603,  range: 225 }
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

  /** Nearest trainers that cover the lead, closest first. */
  function nearestTrainers(lat, lon, limit = 3) {
    return TRAINERS
      .map(t => {
        const distance = Math.round(haversine(lat, lon, t.lat, t.lon));
        return { ...t, distance, ratio: distance / t.range, inRange: distance <= t.range };
      })
      // In-range trainers first, closest first (shortest drive for sales); then out-of-range by how far over they are
      .sort((a, b) => (b.inRange - a.inRange) || (a.inRange ? a.distance - b.distance : a.ratio - b.ratio))
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

  root.BB_GEO = { TRAINERS, STATE_TZ, haversine, nearestTrainers, localTime, mapsLink };
})(typeof globalThis !== 'undefined' ? globalThis : window);
