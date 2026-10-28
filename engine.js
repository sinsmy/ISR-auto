/* ISR-auto — moteur de calcul (aucune dépendance, testable sous Node) */
(function (root) {
  'use strict';

  var INF = Infinity;

  /* Barèmes annuels en gourdes : lo exclu, hi inclus */
  var BAREMES = {
    nouveau: {
      label: 'Nouveau barème (depuis le 1er octobre 2026)',
      tranches: [
        { lo: 0,       hi: 360000,  rate: 0 },
        { lo: 360000,  hi: 540000,  rate: 0.12 },
        { lo: 540000,  hi: 1080000, rate: 0.18 },
        { lo: 1080000, hi: 2160000, rate: 0.25 },
        { lo: 2160000, hi: INF,     rate: 0.30 }
      ]
    },
    ancien: {
      label: 'Ancien barème (décret du 29 septembre 2005)',
      tranches: [
        { lo: 0,       hi: 60000,   rate: 0 },
        { lo: 60000,   hi: 240000,  rate: 0.10 },
        { lo: 240000,  hi: 480000,  rate: 0.15 },
        { lo: 480000,  hi: 1000000, rate: 0.25 },
        { lo: 1000000, hi: INF,     rate: 0.30 }
      ]
    }
  };

  /* Lignes de l'annexe 1 (détails 1 : traitements, salaires…) */
  var SAL_LINES = [
    { id: 'reg',     n: '1',   label: 'Salaires réguliers', mensuel: true },
    { id: 'supp',    n: '2',   label: 'Salaires supplémentaires', grp: 'a' },
    { id: 'prime',   n: '3',   label: 'Prime de rendement', grp: 'p' },
    { id: 'alloc',   n: '4',   label: 'Allocations forfaitaires (ex. 14e mois)', grp: 'p' },
    { id: 'conseil', n: '5',   label: 'Allocations membres Conseil de surveillance' },
    { id: 'tant',    n: '6',   label: 'Tantièmes, jetons de présence' },
    { id: 'trait',   n: '7',   label: 'Traitements' },
    { id: 'indem',   n: '8',   label: 'Indemnités', grp: 'p' },
    { id: 'emol',    n: '9',   label: 'Émoluments', grp: 'a' },
    { id: 'preavis', n: '10',  label: 'Préavis ou délais-congé encaissé',
      hint: "Les indemnités de préavis prévues par le Code du travail sont exonérées (art. 15 du décret) : laissez vide si c'est votre cas." },
    { id: 'conges',  n: '11',  label: 'Congés payés' },
    { id: 'boni',    n: '12',  label: 'Boni, étrennes', grp: 'p' },
    { id: 'comm',    n: '13',  label: 'Commissions, courtages' },
    { id: 'autres',  n: '14',  label: 'Rémunérations généralement quelconques' },
    { id: 'an_log',  n: '15a', label: 'Avantage en nature : logement (loyers résidentiels)' },
    { id: 'an_loc',  n: '15b', label: 'Avantage en nature : locomotion (véhicules)' },
    { id: 'an_carb', n: '15c', label: 'Avantage en nature : frais de carburant' },
    { id: 'an_nour', n: '15d', label: 'Avantage en nature : nourriture', grp: 'a' },
    { id: 'an_aut',  n: '15e', label: 'Avantage en nature : autres (à spécifier et à évaluer)' }
  ];

  /* Taux de retenue automatique par défaut : 15 % primes/indemnités/allocations/boni/émoluments, 10 % heures sup. et nourriture */
  SAL_LINES.forEach(function (d) { if (d.grp) d.rate = d.grp === 'p' ? 0.15 : 0.10; });
  SAL_LINES.forEach(function (d) { if (d.id === 'emol') { d.grp = 'p'; d.rate = 0.15; } });

  /* Rubrique XVII a) à m) : retenues liées à l'annexe 1 */
  var RET_LIGNES = [
    ['a', 'Sur salaires', 'reg'],
    ['b', 'Sur salaires supplémentaires', 'supp'],
    ['c', 'Sur prime de rendement', 'prime'],
    ['d', 'Sur allocations forfaitaires', 'alloc'],
    ['e', 'Sur allocations membres Conseil de surveillance', 'conseil'],
    ['f', 'Sur tantièmes, jetons de présence', 'tant'],
    ['g', 'Sur traitements', 'trait'],
    ['h', 'Sur indemnités (boni)', 'indem'],
    ['i', 'Sur émoluments', 'emol'],
    ['j', 'Sur préavis ou délais-congé encaissé', 'preavis'],
    ['k', 'Sur congés payés', 'conges'],
    ['l', 'Sur boni, étrennes', 'boni'],
    ['m', 'Sur commissions, courtages', 'comm']
  ];
  var AUTRES_IDS = ['autres', 'an_log', 'an_loc', 'an_carb', 'an_nour', 'an_aut'];

  /* Rubrique XVII n) à s) : saisie manuelle */
  var RET_MANUELLES = [
    ['n', 'Sur intérêts et arrérages', 'r_n'],
    ['o', 'Sur plus-values mobilières et immobilières', 'r_o'],
    ['p', 'Sur revenu commercial et industriel', 'r_p'],
    ['q', 'Sur professions non commerciales', 'r_q'],
    ['r', 'Sur tous autres revenus (à préciser)', 'r_r'],
    ['s', 'Acompte provisionnel', 'r_s']
  ];

  function toNum(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  /* Montant d'un champ : valeur x nombre de mois (clé + '_mois'), 1 si le nombre de mois est vide */
  function amt(o, k, dflt) {
    o = o || {};
    var m = o[k + '_mois'];
    var f = isBlankM(m) ? (dflt === undefined ? 1 : dflt) : toNum(m);
    return toNum(o[k]) * f;
  }
  function isBlankM(v) { return v === undefined || v === null || String(v).trim() === ''; }
  function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
  function pos(x) { return x > 0 ? x : 0; }
  function isBlank(v) { return v === undefined || v === null || String(v).trim() === ''; }

  /* Impôt progressif par tranches */
  function impotBareme(revenu, tranches) {
    var rows = [], total = 0, R = pos(revenu);
    tranches.forEach(function (t) {
      var base = pos(Math.min(R, t.hi) - t.lo);
      var impot = r2(base * t.rate);
      rows.push({ lo: t.lo, hi: t.hi, rate: t.rate, base: base, impot: impot });
      total += impot;
    });
    return { rows: rows, total: r2(total) };
  }

  /* Annexe 1 : montants et retenues ligne par ligne */
  function computeSalaires(sal, rates) {
    sal = sal || {}; rates = rates || {};
    var lines = sal.lines || {};
    var out = {}, totalMontant = 0, totalRet = 0;
    SAL_LINES.forEach(function (d) {
      var L = lines[d.id] || {};
      var montant = d.mensuel ? toNum(L.m) * (isBlank(L.mois) ? 12 : toNum(L.mois)) : toNum(L.m);
      var rate = isBlank(rates[d.id]) ? (d.rate || 0) : toNum(rates[d.id]) / 100;
      var ret;
      if (!isBlank(L.r)) ret = toNum(L.r);
      else ret = r2(montant * rate);
      out[d.id] = { montant: montant, retenue: ret, rate: rate, auto: isBlank(L.r) && !!rate };
      totalMontant += montant; totalRet += ret;
    });
    var extra = (sal.extra || []).map(function (E) {
      var m = toNum(E.m), r = toNum(E.r);
      totalMontant += m; totalRet += r;
      return { montant: m, retenue: r };
    });
    return { lines: out, extra: extra, totalMontant: r2(totalMontant), totalRetenues: r2(totalRet) };
  }

  /* Calcul complet. opts : { bareme:'nouveau'|'ancien', plafondDons:'decret'|'formulaire'|'aucun' } */
  function compute(S, opts) {
    opts = opts || {};
    var bar = BAREMES[opts.bareme || 'nouveau'];
    var plafond = opts.plafondDons || 'decret';
    var rev = S.rev || {}, ded = S.ded || {}, ret = S.ret || {};
    var tp = opts.tauxPrimes, ta = opts.tauxAutres;
    var taux = { p: (isBlank(tp) ? 15 : toNum(tp)) / 100, a: (isBlank(ta) ? 10 : toNum(ta)) / 100 };

    var sal = computeSalaires(S.sal, S.rates);

    /* I à VII */
    var sec = {};
    sec.I   = sal.totalMontant + amt(rev, 'epoux') + amt(rev, 'enfants');
    sec.II  = amt(rev, 'cap_a') + amt(rev, 'cap_b') + amt(rev, 'cap_c');
    sec.III = amt(rev, 'pv_a') + amt(rev, 'pv_b') + amt(rev, 'pv_c') + amt(rev, 'pv_d') - amt(rev, 'pv_e');
    sec.IV  = amt(rev, 'fon_rec') - amt(rev, 'fon_dep');
    sec.V   = amt(rev, 'bic_a') + amt(rev, 'bic_b');
    sec.VI  = amt(rev, 'bnc_rec') - amt(rev, 'bnc_dep');
    sec.VII = amt(rev, 'aut_rev') - amt(rev, 'aut_dep');
    var totalRevenus = sec.I + sec.II + sec.III + sec.IV + sec.V + sec.VI + sec.VII;

    /* IX à XII */
    var loyersAnnuels = amt(ded, 'loyer');
    var loyerDeduit = r2(loyersAnnuels * 0.20);           // art. 128 b : 20 % des loyers
    var dIX = amt(ded, 'def') + loyerDeduit;
    var dX = amt(ded, 'cfpb') + amt(ded, 'hyp') + amt(ded, 'fdu') + amt(ded, 'autre3') + amt(ded, 'autre4');
    var dXI = amt(ded, 'ret') + amt(ded, 'logement') + amt(ded, 'assur') + amt(ded, 'medic') + amt(ded, 'cotis');

    var donsSaisis = amt(ded, 'dons'), plafondMontant = null, donsRetenus = donsSaisis;
    if (plafond === 'decret') {
      plafondMontant = r2(0.2 * pos(totalRevenus - dIX - dX - dXI));
    } else if (plafond === 'formulaire') {
      plafondMontant = r2(0.2 * pos(totalRevenus - amt(ded, 'def') - amt(ded, 'cotis')));
    }
    if (plafondMontant !== null) donsRetenus = Math.min(donsSaisis, plafondMontant);
    var dXII = donsRetenus;
    var totalDed = r2(dIX + dX + dXI + dXII);

    var revenuGlobal = r2(pos(totalRevenus - totalDed));

    /* Barème */
    var b = impotBareme(revenuGlobal, bar.tranches);
    var autre = impotBareme(revenuGlobal, BAREMES[(opts.bareme || 'nouveau') === 'nouveau' ? 'ancien' : 'nouveau'].tranches);

    /* Retenues à la source */
    var retRows = [], retTotal = 0;
    RET_LIGNES.forEach(function (d) {
      var v = sal.lines[d[2]].retenue; retRows.push({ k: d[0], label: d[1], v: v }); retTotal += v;
    });
    var vAutres = 0;
    AUTRES_IDS.forEach(function (id) { vAutres += sal.lines[id].retenue; });
    sal.extra.forEach(function (e) { vAutres += e.retenue; });
    retRows.push({ k: 'm+', label: 'Sur autres rémunérations, avantages en nature et lignes libres', v: r2(vAutres), added: true });
    retTotal += vAutres;
    RET_MANUELLES.forEach(function (d) {
      var v = amt(ret, d[2]); retRows.push({ k: d[0], label: d[1], v: v }); retTotal += v;
    });
    var credits = amt(ret, 'credits');
    var totalRetCred = r2(retTotal + credits);

    /* Résultat */
    var impotAnnuel = b.total;
    var impotAPayer = r2(pos(impotAnnuel - totalRetCred));
    var remboursement = r2(pos(totalRetCred - impotAnnuel));
    var dsav = impotAPayer > 0 ? r2(Math.max(2, impotAPayer * 0.002)) : 0;
    var totalAPayer = r2(impotAPayer + dsav);

    /* Vérification IRI/Salaires : impôt théorique sur le salaire régulier annuel */
    var salReg = sal.lines.reg.montant;
    var verif = impotBareme(salReg, bar.tranches).total;

    var marginal = 0;
    b.rows.forEach(function (r) { if (r.base > 0) marginal = r.rate; });

    return {
      bareme: opts.bareme || 'nouveau', baremeLabel: bar.label,
      sal: sal, sec: sec, totalRevenus: r2(totalRevenus),
      ded: { loyersAnnuels: loyersAnnuels, loyerDeduit: loyerDeduit, IX: r2(dIX), X: r2(dX), XI: r2(dXI),
             donsSaisis: donsSaisis, donsRetenus: r2(donsRetenus), plafondDons: plafondMontant, XII: r2(dXII), total: totalDed },
      revenuGlobal: revenuGlobal,
      tranches: b.rows, impotAnnuel: impotAnnuel,
      retRows: retRows, retTotal: r2(retTotal), credits: credits, totalRetCred: totalRetCred,
      impotAPayer: impotAPayer, dsav: dsav, totalAPayer: totalAPayer, remboursement: remboursement,
      autreBareme: { label: BAREMES[(opts.bareme || 'nouveau') === 'nouveau' ? 'ancien' : 'nouveau'].label, impot: autre.total },
      verifIRI: { salaireAnnuel: salReg, impotTheorique: verif, retenuesSalaire: sal.lines.reg.retenue,
                  ecart: r2(sal.lines.reg.retenue - verif) },
      tauxMoyen: totalRevenus > 0 ? impotAnnuel / totalRevenus : 0,
      tauxMarginal: marginal, taux: taux
    };
  }

  var api = { amt: amt, BAREMES: BAREMES, SAL_LINES: SAL_LINES, RET_LIGNES: RET_LIGNES, RET_MANUELLES: RET_MANUELLES,
              toNum: toNum, r2: r2, impotBareme: impotBareme, computeSalaires: computeSalaires, compute: compute };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ISR = api;
})(typeof window !== 'undefined' ? window : globalThis);
