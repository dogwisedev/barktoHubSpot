/**
 * BARK BUSTER — LEAD SCORE ENGINE (pure, no DOM)
 *
 *   Fit            25  distance ÷ nearest trainer's range
 *   Cost           20  credits (cheap → pricey), zero if over breakeven CPL
 *   Competition    15  pros already bought + lead age
 *   Intent         20  Bark "hiring decision" answer + Urgent badge
 *   Note           10  length of "Additional details"
 *   Contactable    10  Verified phone badge, junk name
 *   ± Adjustments      board & train ticked, group-only, multi-dog, ZIP income
 *
 * Unknown field = half points + a flag, so missing data never swings the score.
 */
(function (root) {
  const DEFAULT_CONFIG = {
    creditPriceUsd: 1.2,
    cheapAtCredits: 4,      // ≤ this = full cost points
    priceyAtCredits: 20,    // ≥ this = minimum cost points
    avgDealValue: 3500,
    leadToCloseRate: 0.08,
    maxCacShare: 0.30,
    useIncome: true,
    buyAt: 70,
    considerAt: 50
  };

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const lerp = (x, x0, x1, y0, y1) => y0 + clamp((x - x0) / (x1 - x0), 0, 1) * (y1 - y0);

  function scoreLead(lead, enrich = {}, cfg = {}) {
    const c = { ...DEFAULT_CONFIG, ...cfg };
    const pros = [], cons = [], flags = [], breakdown = {};
    const qa = lead.qa || {};
    const ans = (re) => { const k = Object.keys(qa).find(q => re.test(q)); return k ? String(qa[k]).toLowerCase().trim() : null; };
    const put = (k, pts, max) => { breakdown[k] = { pts: Math.round(pts), max }; return pts; };
    let score = 0;

    // 1. FIT (25)
    const t = enrich.trainer;
    if (!t) { score += put('fit', 12.5, 25); flags.push('Location not resolved'); }
    else {
      const r = t.ratio;
      score += put('fit', r <= 0.5 ? 25 : r <= 1 ? lerp(r, 0.5, 1, 25, 15) : r <= 1.2 ? 6 : 0, 25);
      const tag = `${t.distance} mi to ${t.name.split(' ')[0]} (covers ${t.range})`;
      if (r <= 1) pros.push(tag); else cons.push(`Out of range: ${tag}`);
      if (r <= 1 && t.available === false) { score -= 6; cons.push(`${t.name.split(' ')[0]} has no free slots in the next 8 weeks`); }
      if ((enrich.inRangeCount || 0) >= 2) pros.push(`${enrich.inRangeCount} trainers cover this area`);
    }

    // 2. COST (20)
    const maxCpl = c.avgDealValue * c.leadToCloseRate * c.maxCacShare;
    if (lead.credits == null) { score += put('cost', 10, 20); flags.push('Lead cost not read'); }
    else {
      const usd = lead.credits * c.creditPriceUsd;
      const tag = `${lead.credits} credits ($${usd.toFixed(0)})`;
      if (usd > maxCpl) { score += put('cost', 0, 20); cons.push(`Over breakeven: ${tag}`); }
      else {
        score += put('cost', lerp(lead.credits, c.cheapAtCredits, c.priceyAtCredits, 20, 5), 20);
        if (lead.credits <= c.cheapAtCredits + 2) pros.push(`Cheap: ${tag}`);
        else if (lead.credits >= 15) cons.push(`Pricey: ${tag}`);
      }
    }

    // 3. COMPETITION + FRESHNESS (15)
    let comp = 0;
    if (lead.responses == null) { comp += 5; flags.push('Responses not read'); }
    else {
      const n = lead.responses;
      comp += [10, 7, 4, 2, 0][clamp(n, 0, 4)];
      if (n === 0) pros.push('Nobody has bought it yet');
      else cons.push(`${n} pro${n > 1 ? 's' : ''} already bought it`);
    }
    if (lead.ageMinutes == null) comp += 2.5;
    else {
      const m = lead.ageMinutes;
      comp += m <= 60 ? 5 : m <= 360 ? 3.5 : m <= 1440 ? 2 : 0;
      if (m <= 60) pros.push('Fresh: under an hour old');
      else if (m > 1440) cons.push(`Stale: ${Math.round(m / 1440)}d old`);
    }
    score += put('competition', comp, 15);

    // 4. INTENT (20)
    let intent = 8;
    const hire = ans(/hiring decision|likely .* hire/i);
    if (hire) {
      // Bark's fixed answers, strongest first
      if (/ready to hire/.test(hire))            { intent = 18; pros.push('Ready to hire now'); }
      else if (/definitely/.test(hire))          { intent = 15; pros.push('Definitely hiring'); }
      else if (/likely/.test(hire))              { intent = 11; }
      else if (/possibly/.test(hire))            { intent = 6;  cons.push('Only possibly hiring'); }
      else if (/plan|research/.test(hire))       { intent = 2;  cons.push('Just planning / researching'); }
    }
    const details = lead.details || '';
    if (/\b(asap|urgent|immediately|right away|this week)\b/i.test(details)) { intent += 2; pros.push('Note says ASAP'); }
    if (lead.badges?.urgent) { intent += 3; pros.push('Bark: urgent'); }
    if (lead.badges?.topOpportunity) { intent += 2; pros.push('Bark: top opportunity'); }
    score += put('intent', clamp(intent, 0, 20), 20);

    // 5. NOTE (10)
    const len = details.trim().length;
    if (lead.details == null) score += put('note', 5, 10);
    else if (len === 0) { score += put('note', 0, 10); cons.push('No note left'); }
    else {
      score += put('note', lerp(len, 15, 200, 3, 10), 10);
      pros.push(len >= 120 ? 'Wrote a detailed note' : 'Left a short note');
    }

    // 6. CONTACTABLE (10)
    let contact = 5;
    if (lead.badges?.verifiedPhone === true) { contact = 10; pros.push('Verified phone'); }
    else if (lead.badges?.verifiedPhone === false) { contact = 3; cons.push('Phone not verified'); }
    if (lead.firstName && /^(.|test|asdf|na|none|n\/a)$/i.test(lead.firstName.trim())) { contact -= 3; cons.push('Junk-looking name'); }
    score += put('contact', clamp(contact, 0, 10), 10);

    // ± ADJUSTMENTS
    let adj = 0;
    const types = ans(/type\(s\) of training|training would you consider/i);
    if (types) {
      if (/board|residential|stay|live.?in|send.?away/.test(types)) { adj += 6; pros.push('Open to board & train'); }
      else if (/group/.test(types) && !/private/.test(types)) { adj -= 6; cons.push('Group classes only'); }
      else { adj -= 4; cons.push('Board & train not ticked'); }
    }
    if (lead.badges?.shortlisted) { adj += 8; pros.push('Asked for you to contact them'); }
    if (lead.callsAllowed === false) flags.push('No calls: message or email first');
    const dogs = ans(/how many dogs/i);
    const dogCount = dogs ? parseInt(dogs, 10) || (/two/.test(dogs) ? 2 : /three/.test(dogs) ? 3 : 1) : null;
    if (dogCount >= 2) { adj += 3; pros.push(`${dogCount} dogs (bigger ticket)`); }

    const bitten = ans(/bitten/i);
    if (bitten && /^yes/.test(bitten)) flags.push(`Bite history: ${qa[Object.keys(qa).find(q => /bitten/i.test(q))]}`);
    const need = ans(/type of dog training do you need/i);
    if (need && /behavio|aggress|reactiv/.test(need)) flags.push('Behavioural case — check trainer takes it');
    const age = ans(/age/i);
    if (age && /month|puppy|under/.test(age)) flags.push('Puppy');
    if (lead.badges?.frequentUser) flags.push('Bark: frequent user');

    if (c.useIncome && enrich.medianIncome) {
      const inc = enrich.medianIncome, k = `$${Math.round(inc / 1000)}k`;
      if (inc >= 100000) { adj += 4; pros.push(`Affluent ZIP (${k} median)`); }
      else if (inc >= 75000) adj += 2;
      else if (inc < 50000) { adj -= 3; cons.push(`Lower-income ZIP (${k} median)`); }
    }
    breakdown.adjust = { pts: adj, max: 0 };
    score += adj;

    // GATES + VERDICT
    if (t && t.ratio > 1.2) score = Math.min(score, 20);
    score = Math.round(clamp(score, 1, 100));

    let verdict = score >= c.buyAt ? 'BUY' : score >= c.considerAt ? 'CONSIDER' : 'SKIP';
    if ([!t, lead.credits == null, lead.responses == null].filter(Boolean).length >= 2) verdict = 'CHECK';
    if (enrich.duplicate?.found) verdict = 'BUST';

    if (enrich.local && (enrich.local.hour < 8 || enrich.local.hour >= 21)) flags.push(`${enrich.local.label} there: outside 8am–9pm call window`);

    return { score, verdict, pros, cons, flags, breakdown, maxCpl: Math.round(maxCpl) };
  }

  const SCORE_VERSION = "2.3"; // bump whenever weights change, so deals can be compared like-for-like
  root.BB_SCORE = { scoreLead, DEFAULT_CONFIG, SCORE_VERSION };
})(typeof globalThis !== 'undefined' ? globalThis : window);
