/* ISR-auto — interface */
(function () {
  'use strict';
  var E = window.ISR;
  var KEY = 'isr-auto:v1';
  var VERSION = '1.1';

  /* ---------- utilitaires ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  var fmt = function (n) { return nf.format(n || 0).replace(/[\u202f\u00a0]/g, '\u00a0'); };
  var g = function (n) { return fmt(n) + '\u00a0G'; };
  var pct = function (r) { return nf.format(r * 100) + '\u00a0%'; };
  var strip = function (s) { return String(s).replace(/[\s\u00a0\u202f]/g, ''); };
  var pretty = function (raw) {
    if (raw === undefined || raw === null || String(raw).trim() === '') return '';
    var n = E.toNum(raw);
    return /[0-9]/.test(String(raw)) ? fmt(n) : '';
  };
  function getP(o, p) { return p.split('.').reduce(function (x, k) { return x == null ? undefined : x[k]; }, o); }
  function setP(o, p, v) {
    var ks = p.split('.'), x = o;
    for (var i = 0; i < ks.length - 1; i++) {
      var k = ks[i];
      if (x[k] == null || typeof x[k] !== 'object') x[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      x = x[k];
    }
    x[ks[ks.length - 1]] = v;
  }

  /* ---------- état et sauvegarde locale ---------- */
  function def() {
    return { v: 1, id: {}, sal: { employeur: '', exercice: '', lines: {}, extra: [] }, rev: {}, ded: {}, ret: {}, rates: {}, calc: {},
             opts: { bareme: 'nouveau', plafondDons: 'decret' }, ui: { tab: 'revenus', theme: '' } };
  }
  function merge(a, b) {
    if (!b || typeof b !== 'object') return a;
    Object.keys(b).forEach(function (k) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]);
      else a[k] = b[k];
    });
    return a;
  }
  function load() { try { return merge(def(), JSON.parse(localStorage.getItem(KEY))); } catch (e) { return def(); } }
  var S = load(), V, saveT;
  function flush() { clearTimeout(saveT); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  function save() { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }, 250); }

  /* ---------- briques de formulaire ---------- */
  function money(k, label, o) {
    o = o || {};
    return '<div class="f"><div class="flr"><label class="fl" for="' + idOf(k) + '">' + label + '</label>' +
      (o.nocalc ? '' : '<button type="button" class="calc" data-calc="' + k + '" aria-label="Calculer mensuel \u00d7 nombre de mois" title="Mensuel \u00d7 mois">\u00d7 mois</button>') + '</div>' +
      '<span class="inp"><input id="' + idOf(k) + '" inputmode="decimal" autocomplete="off" data-k="' + k +
      '" data-num' + (o.auto ? ' data-autoret="' + o.auto + '"' : '') + ' placeholder="' + (o.ph || '0') + '"><em>G</em></span>' +
      (o.nocalc ? '' : '<div class="mcalc" data-mc="' + k + '" hidden><label><span>Montant mensuel</span><input inputmode="decimal" autocomplete="off" data-mk="' + k + '" data-part="mm" placeholder="0"></label>' +
        '<i>\u00d7</i><label><span>Nb. de mois</span><input inputmode="numeric" autocomplete="off" data-mk="' + k + '" data-part="n" placeholder="12"></label>' +
        '<b data-mres="' + k + '"></b></div>') +
      (o.hint ? '<small>' + o.hint + '</small>' : '') + '</div>';
  }
  function idOf(k) { return 'f_' + k.replace(/[^a-z0-9]/gi, '_'); }
  function text(k, label, o) {
    o = o || {};
    return '<label class="f"><span class="fl">' + label + '</span><input type="text" autocomplete="off" data-k="' + k + '"' +
      (o.mode ? ' inputmode="' + o.mode + '"' : '') + ' placeholder="' + (o.ph || '') + '"></label>';
  }
  var out = function (k, f) { return '<b data-out="' + k + '" data-f="' + (f || 'g') + '"></b>'; };
  function card(title, sub, body, open) {
    return '<details class="card"' + (open ? ' open' : '') + '><summary><span>' + title + '</span>' + (sub || '') + '</summary><div class="body">' + body + '</div></details>';
  }
  var tot = function (label, k) { return '<div class="tot"><span>' + label + '</span>' + out(k) + '</div>'; };

  /* ---------- onglet Identité ---------- */
  function tabId() {
    var today = new Date().toLocaleDateString('fr-FR');
    return '<h2>Identité</h2><p class="lead">Facultatif. Ces informations servent uniquement au récapitulatif imprimable et restent sur cet appareil.</p>' +
      '<div class="plain">' +
      '<div class="row2">' + text('id.anneeDecl', 'A- Année fiscale de la déclaration', { ph: '2025-2026' }) +
      text('id.anneeCours', 'B- Année fiscale en cours', { ph: '2026-2027' }) + '</div>' +
      '<p class="note">Date du jour : <b>' + today + '</b></p>' +
      '<div class="row2">' + text('id.dep', 'C- Département') + text('id.commune', 'Commune') + '</div>' +
      '<div class="row2">' + text('id.nom', 'D- Nom du contribuable') + text('id.prenoms', 'Prénoms') + '</div>' +
      text('id.nif', 'N° de carte d\u2019identité fiscale', { mode: 'numeric' }) +
      '<div class="row2">' + text('id.epNom', 'E- Nom de l\u2019époux(se)') + text('id.epPrenoms', 'Prénoms') + '</div>' +
      '<div class="row2">' + text('id.enfNom', 'F- Enfants à charge gagnant un revenu') + text('id.enfPrenoms', 'Prénoms') + '</div>' +
      '<div class="row2">' + text('id.adrNo', 'G- Adresse : n°') + text('id.adrRue', 'Rue') + '</div>' +
      text('id.adrVille', 'Ville') +
      text('id.email', 'H- Adresse électronique', { mode: 'email' }) +
      '<div class="row2">' + text('id.telRes', 'I- Téléphone résidence', { mode: 'tel' }) + text('id.telBur', 'Bureau', { mode: 'tel' }) + '</div>' +
      text('id.bp', 'Boîte postale') +
      '</div>';
  }

  /* ---------- onglet Revenus ---------- */
  function salLine(d) {
    var base = 'sal.lines.' + d.id;
    var head = '<div class="lt"><span class="n">' + d.n + '</span>' + d.label + '</div>';
    if (d.mensuel) {
      return '<div class="line">' + head + '<div class="row2">' + money(base + '.m', 'Salaire mensuel brut', { nocalc: true }) +
        '<label class="f"><span class="fl">Nombre de mois</span><input inputmode="numeric" data-k="' + base + '.mois" data-int placeholder="12"></label></div>' +
        '<div class="row2">' + money(base + '.r', 'Retenue à la source (annuelle)') + '</div>' +
        '<div class="sub">Montant annuel : ' + out('sal.lines.reg.montant') + ' \u2014 mettez 1 mois pour saisir directement un montant annuel.</div></div>';
    }
    return '<div class="line">' + head + '<div class="row2">' + money(base + '.m', 'Montant brut annuel') +
      money(base + '.r', 'Retenue à la source', { auto: d.id }) + '</div>' +
      (d.hint ? '<div class="hint">' + d.hint + '</div>' : '') + '</div>';
  }
  function tabRevenus() {
    var s1 = '<div class="row2">' + text('sal.employeur', 'Employeur') + text('sal.exercice', 'Exercice fiscal', { ph: '2025-2026' }) + '</div>' +
      E.SAL_LINES.map(salLine).join('') +
      '<h3>Autres lignes (libres)</h3><div id="extra"></div>' +
      '<div class="btns"><button class="btn" data-act="addExtra">+ Ajouter une ligne</button></div>' +
      '<div class="tot"><span>Total annexe 1 (revenu brut)</span>' + out('sal.totalMontant') + '</div>' +
      '<div class="tot"><span>Total des retenues</span>' + out('sal.totalRetenues') + '</div>' +
      '<div class="sub">Une retenue laissée vide est calculée automatiquement : 15 % sur primes, allocations, indemnités, émoluments et boni/étrennes ; 10 % sur heures supplémentaires et nourriture. Les taux se modifient dans l\u2019onglet Retenues. Saisissez 0 pour annuler une retenue. Le bouton « \u00d7 mois » calcule un montant mensuel \u00d7 nombre de mois.</div>';
    var s2 = '<div class="line"><div class="lt">a) Revenu annuel brut du contribuable</div><div class="sub">Repris de l\u2019annexe 1 : ' + out('sal.totalMontant') + '</div></div>' +
      money('rev.epoux', 'b) Revenu brut de l\u2019époux(se)') + money('rev.enfants', 'c) Revenu brut des enfants du contribuable') +
      tot('Total I', 'sec.I');
    var s3 = money('rev.cap_a', 'a) Tantièmes, jetons de présence') + money('rev.cap_b', 'b) Intérêts et arrérages perçus') +
      money('rev.cap_c', 'c) Autres revenus de placements') + tot('Total II', 'sec.II') +
      '<div class="sub">Si vous avez déjà saisi des tantièmes/jetons dans l\u2019annexe 1, ne les répétez pas ici.</div>';
    var s4 = money('rev.pv_a', 'a) Mobilières — tangibles') + money('rev.pv_b', 'b) Mobilières — actions, obligations et autres titres') +
      money('rev.pv_c', 'c) Immobilières (non libératoires)') + money('rev.pv_d', 'd) Autres') +
      money('rev.pv_e', 'e) Moins : déduction d\u2019office') + tot('Total III', 'sec.III');
    var s5 = money('rev.fon_rec', 'a) Recettes annuelles des loyers et fermages') + money('rev.fon_dep', 'b) Dépenses locatives') + tot('Total IV', 'sec.IV');
    var s6 = money('rev.bic_a', 'a) Revenu net de l\u2019exercice (exploitant individuel)') + money('rev.bic_b', 'b) Quote-part du revenu net (société de personnes)') + tot('Total V', 'sec.V');
    var s7 = money('rev.bnc_rec', 'a) Recettes (ou quote-part) annuelles professionnelles') + money('rev.bnc_dep', 'b) Dépenses (ou quote-part) annuelles professionnelles') + tot('Total VI', 'sec.VI');
    var s8 = money('rev.aut_rev', 'a) Autres revenus') + money('rev.aut_dep', 'b) Dépenses y relatives') + tot('Total VII', 'sec.VII');
    return '<h2>Revenus imposables</h2><p class="lead">Montants annuels en gourdes. Les sections vides comptent pour zéro.</p>' +
      card('Annexe 1 — Traitements, salaires, avantages', out('sal.totalMontant'), s1, true) +
      card('I — Revenus de salaires (total)', out('sec.I'), s2) +
      card('II — Capitaux mobiliers (annexe 2)', out('sec.II'), s3) +
      card('III — Plus-values (annexe 3)', out('sec.III'), s4) +
      card('IV — Revenus fonciers (annexe 4)', out('sec.IV'), s5) +
      card('V — Bénéfices industriels et commerciaux (annexe 5)', out('sec.V'), s6) +
      card('VI — Professions non commerciales (annexe 6)', out('sec.VI'), s7) +
      card('VII — Autres revenus (annexe 7)', out('sec.VII'), s8) +
      '<div class="tot" style="font-size:17px"><span>VIII — Total revenus imposables</span>' + out('totalRevenus') + '</div>';
  }

  /* ---------- onglet Déductions ---------- */
  function tabDeductions() {
    var d9 = money('ded.def', 'a) Déficit extérieur antérieur') +
      money('ded.loyer', 'b) Loyers annuels de la résidence principale', { hint: 'Déduction automatique : 20 % des loyers annuels (art. 128 b).' }) +
      '<div class="sub">Déduction loyers (20 %) : ' + out('ded.loyerDeduit') + '</div>' + tot('Total IX', 'ded.IX');
    var d10 = money('ded.cfpb', 'c) CFPB — impôts locatifs', { hint: 'Montant annuel payé ; conservez le reçu.' }) +
      money('ded.hyp', '1- Intérêts hypothécaires') + money('ded.fdu', '2- Prélèvements sur salaires (FDU + CAS)') +
      '<div class="row2">' + text('ded.autre3L', '3- Autre à préciser') + money('ded.autre3', 'Montant') + '</div>' +
      '<div class="row2">' + text('ded.autre4L', '4- Autre à préciser') + money('ded.autre4', 'Montant') + '</div>' +
      tot('Total X', 'ded.X');
    var d11 = money('ded.ret', 'd1) Épargne retraite (pension)', { hint: 'Montant annuel versé pour votre pension.' }) +
      money('ded.logement', 'd2) Épargne logement') +
      money('ded.assur', 'e) Primes d\u2019assurance vie et santé', { hint: 'Montant annuel versé pour votre assurance.' }) +
      money('ded.medic', 'f) Frais médicaux non couverts par assurance') +
      money('ded.cotis', 'g) Cotisations professionnelles et formation') + tot('Total XI', 'ded.XI');
    var d12 = money('ded.dons', 'h) Dons aux fondations et institutions', { hint: 'Plafonnés à 20 % du revenu (voir le mode de plafond dans l\u2019onglet Résultat).' }) +
      '<div class="kv"><span>Plafond applicable</span>' + out('ded.plafondDons') + '</div>' +
      '<div class="kv"><span>Dons retenus</span>' + out('ded.donsRetenus') + '</div>' + tot('Total XII', 'ded.XII');
    return '<h2>Déductions</h2><p class="lead">Pièces justificatives à conserver. Montants annuels en gourdes.</p>' +
      card('IX — Déficit et loyers', out('ded.IX'), d9) +
      card('X — CFPB, intérêts hypothécaires, prélèvements', out('ded.X'), d10) +
      card('XI — Épargne, assurance, frais médicaux, cotisations', out('ded.XI'), d11) +
      card('XII — Dons', out('ded.XII'), d12) +
      '<div class="tot"><span>XIII — Total déductions</span>' + out('ded.total') + '</div>' +
      '<div class="tot" style="font-size:17px"><span>XIV — Revenu global imposable</span>' + out('revenuGlobal') + '</div>';
  }

  /* ---------- onglet Retenues ---------- */
  function tabRetenues() {
    var auto = V0.retRows ? '' : '';
    var rows = E.RET_LIGNES.map(function (d, i) {
      return '<div class="kv"><span>' + d[0] + ') ' + d[1] + '</span>' + out('retRows.' + i + '.v') + '</div>';
    }).join('') +
      '<div class="kv"><span>m+) Autres rémunérations, avantages en nature, lignes libres</span>' + out('retRows.' + E.RET_LIGNES.length + '.v') + '</div>';
    var man = E.RET_MANUELLES.map(function (d) { return money('ret.' + d[2], d[0] + ') ' + d[1]); }).join('');
    var rateRows = E.SAL_LINES.filter(function (d) { return d.rate; }).map(function (d) {
      return '<label class="f"><span class="fl">' + d.n + ' ' + d.label + ' (défaut ' + Math.round(d.rate * 100) + ' %)</span><span class="inp"><input inputmode="decimal" autocomplete="off" data-k="rates.' + d.id + '" placeholder="' + Math.round(d.rate * 100) + '"><em>%</em></span></label>';
    }).join('');
    return '<h2>Retenues et crédits</h2><p class="lead">Montants déjà payés au Trésor, déduits de votre impôt.</p>' +
      card('Taux de retenue automatique', '', '<div class="sub" style="margin-top:8px">Appliqués quand la retenue d\u2019une ligne de l\u2019annexe 1 est laissée vide. Laissez vide pour le taux par défaut.</div>' + rateRows) +
      card('XVII a) à m) — Retenues de l\u2019annexe 1 (automatique)', out('retTotalAuto'),
        rows + '<div class="sub">Ces lignes viennent de l\u2019onglet Revenus. Modifiez-les là-bas.</div>', true) +
      card('XVII n) à s) — Autres retenues et acomptes', '', man, true) +
      card('XVIII — Crédits d\u2019impôt', out('credits'), money('ret.credits', 'Crédits d\u2019impôt (exercices antérieurs, 5 ans maximum)'), true) +
      '<div class="tot" style="font-size:17px"><span>Total retenues + crédits (XVII & XVIII)</span>' + out('totalRetCred') + '</div>';
  }
  var V0 = {};

  /* ---------- onglet Résultat ---------- */
  function tabResultat() {
    return '<h2>Résultat</h2><p class="lead">Calcul mis à jour en direct.</p>' +
      '<div class="plain"><label class="f" style="margin-top:0"><span class="fl">Barème appliqué</span><select data-k="opts.bareme">' +
      '<option value="nouveau">Nouveau (depuis le 1er oct. 2026)</option>' +
      '<option value="ancien">Ancien (décret du 29 sept. 2005)</option></select></label>' +
      '<label class="f"><span class="fl">Plafond des dons</span><select data-k="opts.plafondDons">' +
      '<option value="decret">Décret : 20 % après autres déductions</option>' +
      '<option value="formulaire">Formulaire : 20 % après déficit et cotisations</option>' +
      '<option value="aucun">Aucun plafond</option></select></label></div>' +
      '<div id="resOut"></div>' +
      '<div class="btns"><button class="btn primary" data-act="print">Imprimer / PDF</button>' +
      '<button class="btn" data-act="share">Partager le résumé</button>' +
      '<button class="btn" data-act="copy">Copier le résumé</button></div>' +
      '<h3 style="margin:22px 4px 6px;font-size:14px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)">Mes données</h3>' +
      '<div class="plain"><p class="note" style="margin-top:0">Tout est enregistré automatiquement sur cet appareil (aucun envoi sur Internet). Faites une sauvegarde avant de changer de téléphone ou de vider le navigateur.</p>' +
      '<div class="btns"><button class="btn" data-act="export">Exporter (fichier)</button>' +
      '<button class="btn" data-act="import">Importer</button>' +
      '<button class="btn danger" data-act="reset">Tout effacer</button></div>' +
      '<div class="btns"><button class="btn primary" id="btnInstall" data-act="install" hidden>Installer l\u2019appli</button></div>' +
      '<p class="note">Installer : sur Android (Chrome), menu \u22ee puis « Installer l\u2019application » ; sur iPhone (Safari), Partager puis « Sur l\u2019écran d\u2019accueil ».</p></div>' +
      '<details class="card"><summary><span>Notes de calcul et vérifications</span></summary><div class="body"><ul class="clean">' +
      '<li>La CFGDCT (calculée, déjà payée, à payer, DSAV sur CT) n\u2019est plus prise en compte.</li>' +
      '<li>Barème par tranches : chaque taux ne s\u2019applique qu\u2019à la part du revenu comprise dans sa tranche.</li>' +
      '<li>Corrigé par rapport au fichier Excel : revenu exactement égal à une borne de tranche (ex. 60 001), DSAV facturé même sans impôt à payer, retenues sur avantages en nature et rémunérations quelconques oubliées, 20 % des loyers jamais appliqué, plafond des dons non appliqué.</li>' +
      '<li>DSAV : 0,2 % de l\u2019impôt à payer, minimum 2 G (comme dans le fichier Excel), seulement s\u2019il y a un impôt à payer.</li>' +
      '<li>Estimation personnelle : ce n\u2019est ni une déclaration officielle ni un avis de l\u2019administration.</li></ul></div></details>' +
      '<p class="foot">ISR-auto v' + VERSION + '</p>';
  }

  function renderResult(v) {
    var tr = v.tranches.map(function (t) {
      var lab = t.hi === Infinity ? 'Au-dessus de ' + fmt(t.lo) : 'De ' + fmt(t.lo + 1) + ' à ' + fmt(t.hi);
      return '<tr class="' + (t.base > 0 ? 'on' : '') + '"><td>' + lab + '</td><td>' + pct(t.rate) + '</td><td>' + fmt(t.base) + '</td><td>' + fmt(t.impot) + '</td></tr>';
    }).join('');
    var refund = v.remboursement > 0 && v.totalAPayer === 0;
    var hero = '<div class="hero' + (refund ? ' ok' : '') + '"><small>' + (refund ? 'Remboursement d\u2019impôt à recevoir' : 'Total à payer (impôt + DSAV)') + '</small>' +
      '<strong>' + g(refund ? v.remboursement : v.totalAPayer) + '</strong><span>' +
      (refund ? 'Retenues et crédits supérieurs à l\u2019impôt' : 'Impôt ' + g(v.impotAPayer) + ' + DSAV ' + g(v.dsav)) + '</span></div>';
    var steps = '<div class="plain">' +
      '<div class="kv"><span>VIII Total revenus imposables</span><b>' + g(v.totalRevenus) + '</b></div>' +
      '<div class="kv"><span>XIII Total déductions</span><b>\u2212 ' + g(v.ded.total) + '</b></div>' +
      '<div class="kv strong"><span>XIV Revenu global imposable</span><b>' + g(v.revenuGlobal) + '</b></div></div>';
    var bar = '<div class="plain"><span class="pill">' + esc(v.baremeLabel) + '</span><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tranche (G)</th><th>Taux</th><th>Base</th><th>Impôt</th></tr></thead><tbody>' + tr +
      '</tbody><tfoot><tr><td colspan="3">XVI Total impôt annuel</td><td>' + fmt(v.impotAnnuel) + '</td></tr></tfoot></table></div></div>';
    var fin = '<div class="plain">' +
      '<div class="kv"><span>XVI Total impôt annuel</span><b>' + g(v.impotAnnuel) + '</b></div>' +
      '<div class="kv"><span>XVII Retenues, forfaitaires et acomptes</span><b>\u2212 ' + g(v.retTotal) + '</b></div>' +
      '<div class="kv"><span>XVIII Crédits d\u2019impôt</span><b>\u2212 ' + g(v.credits) + '</b></div>' +
      '<div class="kv"><span>Impôt à payer</span><b>' + g(v.impotAPayer) + '</b></div>' +
      '<div class="kv"><span>DSAV (0,2 %, minimum 2 G)</span><b>' + g(v.dsav) + '</b></div>' +
      '<div class="kv strong"><span>XIX Impôt définitif à payer</span><b>' + g(v.totalAPayer) + '</b></div>' +
      '<div class="kv strong"><span>XX Remboursement à recevoir</span><b>' + g(v.remboursement) + '</b></div></div>';
    var diff = v.autreBareme.impot - v.impotAnnuel;
    var cmp = '<div class="plain"><div class="kv"><span>Taux moyen d\u2019imposition</span><b>' + pct(v.tauxMoyen) + '</b></div>' +
      '<div class="kv"><span>Taux marginal</span><b>' + pct(v.tauxMarginal) + '</b></div>' +
      '<div class="kv"><span>Impôt annuel avec l\u2019autre barème</span><b>' + g(v.autreBareme.impot) + '</b></div>' +
      '<div class="note">' + esc(v.autreBareme.label) + (diff === 0 ? ' : même impôt.' : (diff > 0 ? ' : vous paieriez ' + g(diff) + ' de plus.' : ' : vous paieriez ' + g(-diff) + ' de moins.')) + '</div></div>';
    var ver = '';
    if (v.verifIRI.salaireAnnuel > 0) {
      var e = v.verifIRI.ecart;
      ver = '<div class="plain"><div class="kv"><span>Vérification IRI/salaire — impôt théorique sur le salaire régulier</span><b>' + g(v.verifIRI.impotTheorique) + '</b></div>' +
        '<div class="kv"><span>Retenues saisies sur salaires</span><b>' + g(v.verifIRI.retenuesSalaire) + '</b></div>' +
        (Math.abs(e) < 0.01 ? '<div class="ok-box">Les retenues sur salaires correspondent à l\u2019impôt théorique.</div>'
          : '<div class="warn-box">' + (e < 0 ? 'Il manque ' + g(-e) + ' de retenues par rapport à l\u2019impôt théorique sur le salaire.' : 'Les retenues dépassent de ' + g(e) + ' l\u2019impôt théorique sur le salaire.') + '</div>') + '</div>';
    }
    return hero + steps + bar + fin + cmp + ver;
  }

  /* ---------- récapitulatif imprimable et texte ---------- */
  function recapHTML(v) {
    var d = S.id || {}, today = new Date().toLocaleDateString('fr-FR');
    var tr = function (a, b, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + esc(a) + '</td><td class="r">' + b + '</td></tr>'; };
    var nz = function (arr) { return arr.filter(function (r) { return Math.abs(r[1]) > 0.004; }).map(function (r) { return tr(r[0], g(r[1])); }).join(''); };
    var ident = [['Nom', [d.nom, d.prenoms].filter(Boolean).join(' ')], ['Carte d\u2019identité fiscale', d.nif], ['Année fiscale', d.anneeDecl],
      ['Adresse', [d.adrNo, d.adrRue, d.adrVille].filter(Boolean).join(', ')], ['Téléphone', d.telRes || d.telBur], ['Courriel', d.email]]
      .filter(function (r) { return r[1]; }).map(function (r) { return tr(r[0], esc(r[1])); }).join('');
    var h = '<h1>ISR-auto \u2014 Calcul de l\u2019impôt sur le revenu</h1><small>Établi le ' + today + ' \u00b7 ' + esc(v.baremeLabel) + '</small>';
    if (ident) h += '<h2>Contribuable</h2><table>' + ident + '</table>';
    h += '<h2>Revenus imposables</h2><table>' + nz([['I Salaires et rémunérations', v.sec.I], ['II Capitaux mobiliers', v.sec.II], ['III Plus-values', v.sec.III],
      ['IV Revenus fonciers', v.sec.IV], ['V Bénéfices industriels et commerciaux', v.sec.V], ['VI Professions non commerciales', v.sec.VI], ['VII Autres revenus', v.sec.VII]]) +
      tr('VIII Total revenus imposables', g(v.totalRevenus), 'big') + '</table>';
    h += '<h2>Déductions</h2><table>' + nz([['IX Déficit et loyers (20 % des loyers)', v.ded.IX], ['X CFPB, intérêts hypothécaires, prélèvements', v.ded.X],
      ['XI Épargne, assurance, frais médicaux, cotisations', v.ded.XI], ['XII Dons retenus', v.ded.XII]]) +
      tr('XIII Total déductions', g(v.ded.total), 'big') + tr('XIV Revenu global imposable', g(v.revenuGlobal), 'big') + '</table>';
    h += '<h2>Impôt</h2><table><thead><tr><th>Tranche</th><th class="r">Taux</th><th class="r">Base</th><th class="r">Impôt</th></tr></thead>' + v.tranches.map(function (t) {
      return '<tr><td>' + (t.hi === Infinity ? 'Au-dessus de ' + fmt(t.lo) : 'De ' + fmt(t.lo + 1) + ' à ' + fmt(t.hi)) + '</td><td class="r">' + pct(t.rate) + '</td><td class="r">' + fmt(t.base) + '</td><td class="r">' + fmt(t.impot) + '</td></tr>'; }).join('') +
      '<tr class="big"><td colspan="3">XVI Total impôt annuel</td><td class="r">' + fmt(v.impotAnnuel) + '</td></tr></table>';
    h += '<h2>Retenues, crédits et solde</h2><table>' + nz(v.retRows.map(function (r) { return ['XVII ' + r.k + ') ' + r.label, r.v]; }).concat([['XVIII Crédits d\u2019impôt', v.credits]])) +
      tr('Total retenues et crédits', g(v.totalRetCred), 'big') + tr('Impôt à payer', g(v.impotAPayer)) + tr('DSAV', g(v.dsav)) +
      tr('XIX Impôt définitif à payer', g(v.totalAPayer), 'big') + tr('XX Remboursement à recevoir', g(v.remboursement), 'big') + '</table>';
    h += '<p><small>Estimation personnelle générée par ISR-auto. Document non officiel, sans valeur déclarative.</small></p>';
    return h;
  }
  function summaryText(v) {
    return ['ISR-auto \u2014 ' + v.baremeLabel, 'Revenus imposables : ' + g(v.totalRevenus), 'Déductions : ' + g(v.ded.total),
      'Revenu global imposable : ' + g(v.revenuGlobal), 'Impôt annuel : ' + g(v.impotAnnuel), 'Retenues et crédits : ' + g(v.totalRetCred),
      'Impôt à payer : ' + g(v.impotAPayer), 'DSAV : ' + g(v.dsav), 'Total à payer : ' + g(v.totalAPayer),
      v.remboursement > 0 ? 'Remboursement : ' + g(v.remboursement) : ''].filter(Boolean).join('\n');
  }

  /* ---------- rafraîchissement ---------- */
  function refresh() {
    V = E.compute(S, S.opts);
    V.retTotalAuto = V.retRows.slice(0, E.RET_LIGNES.length + 1).reduce(function (a, r) { return a + r.v; }, 0);
    V0 = V;
    $$('[data-out]').forEach(function (el) {
      var v = getP(V, el.dataset.out);
      el.textContent = v == null ? '\u2014' : (el.dataset.f === 'p' ? pct(v) : g(v));
    });
    $$('[data-autoret]').forEach(function (el) {
      var L = V.sal.lines[el.dataset.autoret];
      el.placeholder = L && L.rate ? 'Auto ' + pct(L.rate) + ' : ' + fmt(L.montant * L.rate) : '0';
    });
    var refund = V.remboursement > 0 && V.totalAPayer === 0;
    $('#hdrLabel').textContent = refund ? 'Remboursement' : 'À payer';
    $('#hdrVal').textContent = g(refund ? V.remboursement : V.totalAPayer);
    $('#resOut').innerHTML = renderResult(V);
  }

  function hydrate(root) {
    $$('[data-k]', root || document).forEach(function (el) {
      var v = getP(S, el.dataset.k);
      if (el.hasAttribute('data-num') && document.activeElement !== el) el.value = pretty(v);
      else el.value = v == null ? '' : v;
    });
  }
  /* calculette mensuel x mois : écrit le produit dans le champ annuel */
  function mcHydrate(root) {
    $$('[data-mc]', root || document).forEach(function (box) {
      var k = box.dataset.mc, c = S.calc[k];
      $$('[data-mk]', box).forEach(function (i) { i.value = c ? (c[i.dataset.part] || '') : ''; });
      box.hidden = !c;
      var b = $('[data-calc="' + k + '"]', box.parentNode); if (b) b.classList.toggle('on', !!c);
      mcResult(k);
    });
  }
  function mcResult(k) {
    var c = S.calc[k], el = $('[data-mres="' + k + '"]');
    if (!el) return;
    el.textContent = c && String(c.mm || '').trim() !== '' ? '= ' + g(E.toNum(c.mm) * (String(c.n || '').trim() === '' ? 12 : E.toNum(c.n))) : '';
  }
  function mcApply(k) {
    var c = S.calc[k] || {};
    if (String(c.mm || '').trim() === '') return;
    var n = String(c.n || '').trim() === '' ? 12 : E.toNum(c.n);
    var v = String(Math.round(E.toNum(c.mm) * n * 100) / 100);
    setP(S, k, v);
    var inp = $('[data-k="' + k + '"]'); if (inp && document.activeElement !== inp) inp.value = pretty(v);
    mcResult(k);
  }
  function renderExtra() {
    $('#extra').innerHTML = (S.sal.extra || []).map(function (e, i) {
      return '<div class="line"><div class="row2" style="grid-template-columns:1fr auto;align-items:end">' + text('sal.extra.' + i + '.label', 'Libellé', { ph: 'Ex. prime exceptionnelle' }) +
        '<button class="ico" data-del="' + i + '" aria-label="Supprimer la ligne">\u2715</button></div>' +
        '<div class="row2">' + money('sal.extra.' + i + '.m', 'Montant') + money('sal.extra.' + i + '.r', 'Retenue') + '</div></div>';
    }).join('');
    hydrate($('#extra')); mcHydrate($('#extra'));
  }

  /* ---------- navigation ---------- */
  function show(tab) {
    if (!$('#tab-' + tab)) tab = 'revenus';
    $$('.tab').forEach(function (s) { s.hidden = s.id !== 'tab-' + tab; });
    $$('.nav button').forEach(function (b) { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    S.ui.tab = tab; save(); window.scrollTo(0, 0);
  }

  /* ---------- actions ---------- */
  function download(name, content, type) {
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([content], { type: type }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function fullReload() { hydrate(); mcHydrate(); renderExtra(); refresh(); applyTheme(); }
  function systemDark() { return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches; }
  function effectiveTheme() { return S.ui.theme || (systemDark() ? 'dark' : 'light'); }
  function applyTheme() {
    var t = effectiveTheme();
    document.documentElement.setAttribute('data-theme', t);
    var btn = $('#btnTheme');
    if (btn) {
      btn.innerHTML = t === 'dark'
        ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
      btn.setAttribute('aria-label', t === 'dark' ? 'Passer en mode jour' : 'Passer en mode nuit');
      btn.title = btn.getAttribute('aria-label');
    }
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'dark' ? '#171d21' : '#1f2a30');
  }
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; var b = $('#btnInstall'); if (b) b.hidden = false; });

  var actions = {
    addExtra: function () { S.sal.extra.push({ label: '', m: '', r: '' }); save(); renderExtra(); refresh(); },
    print: function () { $('#recap').innerHTML = recapHTML(V); window.print(); },
    copy: function () {
      var t = summaryText(V);
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { alert('Résumé copié.'); }, function () { window.prompt('Copiez ce résumé :', t); });
    },
    share: function () {
      var t = summaryText(V);
      if (navigator.share) navigator.share({ title: 'ISR-auto', text: t }).catch(function () {}); else actions.copy();
    },
    export: function () {
      download('isr-auto-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(S, null, 2), 'application/json');
    },
    import: function () { $('#fileImport').click(); },
    reset: function () {
      if (confirm('Effacer toutes les données saisies sur cet appareil ?')) { var tab = S.ui.tab; S = def(); S.ui.tab = tab; save(); fullReload(); }
    },
    install: function () { if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; $('#btnInstall').hidden = true; }); } }
  };

  /* ---------- démarrage ---------- */
  function init() {
    $('#tab-id').innerHTML = tabId();
    $('#tab-revenus').innerHTML = tabRevenus();
    $('#tab-deductions').innerHTML = tabDeductions();
    $('#tab-retenues').innerHTML = tabRetenues();
    $('#tab-resultat').innerHTML = tabResultat();
    hydrate(); mcHydrate(); renderExtra(); refresh(); applyTheme(); show(S.ui.tab);
    if (deferred) $('#btnInstall').hidden = false;

    var app = $('#app');
    function onInput(e) {
      var el = e.target; if (!el.dataset) return;
      if (el.dataset.mk) {
        var k = el.dataset.mk; S.calc[k] = S.calc[k] || {};
        S.calc[k][el.dataset.part] = strip(el.value);
        mcApply(k); save(); refresh(); return;
      }
      if (!el.dataset.k) return;
      if (S.calc[el.dataset.k] && e.type === 'input') { delete S.calc[el.dataset.k]; var fb = el.closest('.f'); if (fb) mcHydrate(fb); }
      var v = el.value;
      if (el.hasAttribute('data-num') || el.hasAttribute('data-int')) v = strip(v);
      setP(S, el.dataset.k, v); save(); refresh();
    }
    app.addEventListener('input', onInput);
    app.addEventListener('change', onInput);
    app.addEventListener('focusin', function (e) { var el = e.target; if (el.hasAttribute && el.hasAttribute('data-num')) { var v = getP(S, el.dataset.k); el.value = v == null ? '' : v; } });
    app.addEventListener('focusout', function (e) { var el = e.target; if (el.hasAttribute && el.hasAttribute('data-num')) el.value = pretty(getP(S, el.dataset.k)); });
    app.addEventListener('click', function (e) {
      var cb = e.target.closest('[data-calc]');
      if (cb) {
        var ck = cb.dataset.calc;
        if (S.calc[ck]) { delete S.calc[ck]; } else { S.calc[ck] = { mm: '', n: '' }; }
        save(); mcHydrate(cb.parentNode.parentNode);
        var f = $('[data-mk="' + ck + '"]'); if (S.calc[ck] && f) f.focus();
        return;
      }
      var b = e.target.closest('[data-act],[data-del]'); if (!b) return;
      if (b.dataset.del !== undefined) {
        S.sal.extra.splice(+b.dataset.del, 1);
        Object.keys(S.calc).forEach(function (k) { if (k.indexOf('sal.extra.') === 0) delete S.calc[k]; });
        save(); renderExtra(); refresh(); return;
      }
      var f = actions[b.dataset.act]; if (f) f();
    });
    $$('.nav button').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.tab); }); });
    $('#btnTheme').addEventListener('click', function () { S.ui.theme = effectiveTheme() === 'dark' ? 'light' : 'dark'; save(); applyTheme(); });
    $('#fileImport').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { var j = JSON.parse(r.result); if (!j || typeof j !== 'object' || !j.sal) throw 0; S = merge(def(), j); save(); fullReload(); alert('Données importées.'); }
        catch (err) { alert('Fichier non valide.'); }
        e.target.value = '';
      };
      r.readAsText(f);
    });
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  init();
})();
