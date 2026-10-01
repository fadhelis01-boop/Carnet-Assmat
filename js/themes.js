/* =====================================================================================
   CALCULS : mensualisation, mois, mois incomplet, congés payés, entretien, fin de contrat
   ===================================================================================== */
'use strict';

const CALC = {};      // CALC[theme]() relance le calcul
const PREFILL = {};   // PREFILL[theme](contrat|null) remplit les cases depuis un contrat
const VIS = {};       // VIS[theme]() met à jour ce qui est affiché/masqué

function recalc(theme){ if(CALC[theme]) CALC[theme](); }
function refreshVisibility(theme){ if(VIS[theme]) VIS[theme](); }
function onThemeOpen(id){
  if(id==='contrat'){ ctRefresh(); return; }
  if(id==='reglages'){ renderSettings(); return; }
  if(id==='aide'){ renderAide(); return; }
  if(id==='docs'){ renderDocs(); return; }
  if(id==='suivi'){ renderSuivi(); return; }
  loadThemeForm(id);
  if(id==='cmg') cmgRefreshHistorySelect();
  if(id==='abattement') abUpdateStatus();
}
function onSegChange(groupId, idx){
  const theme = ($(groupId).closest('.theme')||{}).id;
  if(!theme){ return; }
  const t = theme.replace('theme-','');
  if(t==='contrat'){ ctRefresh(); return; }
  if(t==='reglages'){ settingsChanged(); return; }
  refreshVisibility(t);
  recalc(t);
  persistTheme(t);
}
/* Toute saisie relance le calcul du thème et l'enregistre */
document.addEventListener('input', e=>{
  const th = e.target.closest && e.target.closest('.theme');
  if(!th) return;
  const t = th.id.replace('theme-','');
  if(t==='contrat'){ ctRefresh(); return; }
  if(t==='reglages'){ settingsChanged(); return; }
  if(e.target.id==='ccass-cal-mois'){ buildCcassCalendar(); }
  if(e.target.id==='ccass-motif-sel'){ VIS.ccass(); }
  if(e.target.id==='mois-mois' && moisContrat() && e.target.value){ moisFillFromContract(moisContrat(), e.target.value); VIS.mois(); }
  if(e.target.id && e.target.id.indexOf('ccass-d')===0){ onCcassCalInput(); }
  recalc(t);
  clearTimeout(th._pt); th._pt = setTimeout(()=>persistTheme(t), 500);
});
function warnHTML(list){ return list.length ? '<div class="warn-box">'+list.join('<br>')+'</div>' : ''; }
function infoHTML(list){ return list.length ? '<div class="info-box">'+list.join('<br>')+'</div>' : ''; }
function curMonth(){ return isoMonth(today()); }

/* =====================================================================================
   01 · SALAIRE MENSUALISÉ
   ===================================================================================== */
VIS.mensu = ()=>{
  const alt = seg('mensu-rythme')===1;
  show('mensu-semaines-wrap', seg('mensu-type')===1);
  show('mensu-hB-wrap', alt); show('mensu-jB-wrap', alt);
  setTxt('mensu-hA-label', alt ? 'Heures semaine A' : 'Heures par semaine');
  setTxt('mensu-jA-label', alt ? 'Jours d\'accueil semaine A' : 'Jours d\'accueil par semaine');
};
PREFILL.mensu = c=>{
  if(!c) return;
  const dv = derive(c);
  setSegVal('mensu-type', c.type); setSegVal('mensu-rythme', c.alterne); setSegVal('mensu-titre', c.titre);
  setVal('mensu-semaines', c.semaines);
  setVal('mensu-hA', round2(dv.hA)); setVal('mensu-jA', dv.jA);
  if(c.alterne){ setVal('mensu-hB', round2(dv.hB)); setVal('mensu-jB', dv.jB); }
  setVal('mensu-taux', c.taux); setVal('mensu-maj', c.maj);
};
CALC.mensu = ()=>{
  const alt = seg('mensu-rythme')===1;
  const hA=num('mensu-hA'), hB=alt?num('mensu-hB'):hA, jA=num('mensu-jA'), jB=alt?num('mensu-jB'):jA;
  const sem = seg('mensu-type')===1 ? num('mensu-semaines') : 52;
  const seuil = R('seuilMaj');
  const majA=Math.max(0,hA-seuil), majB=Math.max(0,hB-seuil);
  const moy=(hA+hB)/2, moyMaj=(majA+majB)/2, moyJ=(jA+jB)/2;
  const tauxMin = R(seg('mensu-titre')? 'salMinTitre':'salMin');
  const tSaisi = num('mensu-taux');
  const taux = tSaisi ? Math.max(tSaisi, tauxMin) : 0;
  const majPct = Math.max(num('mensu-maj')||R('majMin'), R('majMin'));
  const hNorm=(moy-moyMaj)*sem/12, hMaj=moyMaj*sem/12;
  const salaire = hNorm*taux + hMaj*taux*(1+majPct/100);
  const w = [];
  if(tSaisi && tSaisi < tauxMin-1e-9) w.push('⛔ Le salaire horaire saisi ('+fmtEUR(tSaisi)+') est inférieur au minimum légal ('+fmtEUR(tauxMin)+' depuis le '+fmtDate(Rdu(seg('mensu-titre')?'salMinTitre':'salMin'))+'). Le calcul applique le minimum.');
  if(seg('mensu-type')===1 && sem>46) w.push('En année incomplète, le nombre de semaines d\'accueil ne dépasse pas 46 (52 semaines − 6 semaines au moins sans accueil, congés compris). Au-delà, il s\'agit d\'une année complète.');
  if(moy > R('hMaxSemaine')) w.push('Plus de '+R('hMaxSemaine')+' h par semaine : seulement avec votre accord écrit (2 250 h par an au maximum).');
  setHTML('mensu-warn', warnHTML(w));
  setTxt('out-mensu-moy', moy ? fmtNum(moy,2)+' h' : '—');
  setTxt('out-mensu-heures', (hNorm+hMaj) ? fmtNum(hNorm+hMaj,2)+' h' : '—');
  show('row-mensu-hmaj', hMaj>0, 'flex'); setTxt('out-mensu-hmaj', fmtNum(hMaj,2)+' h (+'+majPct+' %)');
  setTxt('out-mensu-jours', moyJ&&sem ? fmtNum(moyJ*sem/12,2)+' j' : '—');
  setTxt('out-mensu-salaire', salaire ? fmtEUR(salaire) : '—');
  setTxt('out-mensu-net', salaire ? fmtEUR(toNet(salaire)) : '—');
  setTxt('mensu-net-hint', 'Estimation à '+fmtNum(netRatio()*100,2)+' % du brut'+(STATE.settings.am?' (Alsace-Moselle)':'')+' ; le net exact est calculé par Pajemploi.');
};

/* =====================================================================================
   02 · SALAIRE DU MOIS, DÉCLARATION PAJEMPLOI ET HISTORIQUE DES MOIS VALIDÉS
   ===================================================================================== */
VIS.mois = ()=>{
  const inc = seg('mois-type')===1;
  show('mois-incomplet-wrap', seg('mois-incomplet')===1);
  show('mois-heuresup-wrap', seg('mois-heuresup')===1);
  show('mois-ferie-wrap', seg('mois-ferie')===1);
  show('mois-cp-complete', !inc); show('mois-cp-incomplete', inc);
};
function moisContrat(){ const k = selKey('mois'); return k!=='libre' ? getContrat(k) : null; }
PREFILL.mois = c=>{
  const m = curMonth(); setVal('mois-mois', m);
  if(!c) return;
  moisFillFromContract(c, m);
};
function moisFillFromContract(c, m){
  const d = parseD(m);
  const dv = derive(c, d);
  setSegVal('mois-type', c.type);
  setVal('mois-base', round2(dv.brutBase)); setVal('mois-heures', round2(dv.hMensu)); setVal('mois-taux', round2(dv.tauxEff));
  setVal('mois-jmensu', round2(dv.joursMensu));
  const jours = plannedDays(c, d.getFullYear(), d.getMonth(), {skipFeries:true});
  setVal('mois-jours', jours.length || '');
  setVal('mois-hjour', jours.length ? round2(jours.reduce((s,x)=>s+x.h,0)/jours.length) : round2(dv.hDayAvg));
  setVal('mois-indemj', c.ieMode===1 ? c.ieMontant : '');
  setVal('mois-repas', c.repasMode===1 ? c.repasPrix : '');
  setVal('mois-km', c.km);
  setSegVal('mois-cp12', (c.type===1 && c.cpMode===0) ? 1 : 0);
  if(c.paiementJour){
    const pj = Math.min(parseInt(c.paiementJour)||1, 28);
    const nx = new Date(d.getFullYear(), d.getMonth()+1, pj);   // salaire payé le mois suivant
    setVal('mois-datepaie', iso(nx));
  }
  // Le mois de début ou de fin du contrat est forcément incomplet : on le signale
  setVal('mois-j8',''); setVal('mois-hm8',''); setVal('mois-regul','');
  // mois suivi au jour le jour : les chiffres réels remplacent l'estimation du planning
  if(typeof hasSuiviMonth==='function' && hasSuiviMonth(c.id, m)){ suiviFillMois(c, m); return; }
  const deb = parseD(c.debut), fin = parseD(c.fin);
  if((deb && deb.getFullYear()===d.getFullYear() && deb.getMonth()===d.getMonth() && deb.getDate()>1) ||
     (fin && fin.getFullYear()===d.getFullYear() && fin.getMonth()===d.getMonth() && fin.getDate()<daysInMonth(d.getFullYear(), d.getMonth())))
    setSegVal('mois-incomplet', 1);
}
/* Tous les chiffres du mois : utilisés pour l'affichage, Pajemploi et l'historique */
function moisCompute(){
  const m = val('mois-mois') || curMonth(), d = parseD(m);
  const inc = seg('mois-type')===1;
  const taux = num('mois-taux'), base = num('mois-base');
  const absent = seg('mois-incomplet')===1;
  const ded = absent ? Math.min(num('mois-deduction'), base) : 0;
  const hs = seg('mois-heuresup')===1;
  const hcompl = hs ? num('mois-hcompl') : 0, hmaj = hs ? num('mois-hmaj') : 0;
  const majPct = Math.max(num('mois-majoration')||R('majMin',d), R('majMin',d));
  const fer = seg('mois-ferie')===1;
  const supFerie = fer ? num('mois-hferie')*taux*R('majFerie',d)/100 + num('mois-h1mai')*taux*R('majPremierMai',d)/100 : 0;
  const brutCompl = hcompl*taux, brutMaj = hmaj*taux*(1+majPct/100);
  const brutNormal = Math.max(0, base-ded) + supFerie;
  const cp12 = inc && seg('mois-cp12')===1 ? (brutNormal+brutCompl+brutMaj)*0.10 : 0;
  const cpVerse = inc ? num('mois-cpmontant') : 0;
  const cpTot = cp12 + cpVerse;
  const regul = num('mois-regul');
  const brut = brutNormal + brutCompl + brutMaj + cpTot + regul;
  // Net : cotisations réduites sur les heures complémentaires et majorées
  const ratio = netRatio(d), red = R('hsReduction', d) || 0;
  const netHs = (brutCompl+brutMaj)*Math.min(1, ratio+red);
  const net = (brutNormal+cpTot+regul)*ratio + netHs;
  // Net imposable : + CSG non déductible et CRDS ; les heures en plus sont exonérées d'impôt
  const csgnd = R('csgNonDed', d)||0, assiette = R('assietteCsg', d)||0.9825;
  const netImp = (brutNormal+cpTot+regul)*(ratio + csgnd*assiette);
  // Entretien, repas, km
  const jours = num('mois-jours'), hj = num('mois-hjour');
  const ieLeg = ieLegalJour(hj, d), ieSaisie = num('mois-indemj');
  const ieJour = ieSaisie ? Math.max(ieSaisie, ieLeg) : ieLeg;
  const ie = jours ? ieJour*jours : 0, repas = jours*num('mois-repas'), km = num('mois-km');
  // Pajemploi : heures et jours mensualisés, diminués de l'absence ; + heures de congés payés (année incomplète)
  const hMensu = num('mois-heures'), jMensu = num('mois-jmensu');
  const ratioDu = base ? Math.max(0, base-ded)/base : 1;
  const hNormDecl = Math.round(hMensu*ratioDu + (inc && taux ? cpTot/taux : 0));
  const jprev = num('mois-jprev'), jded = absent ? num('mois-jded') : 0;
  const jDecl = jMensu ? Math.ceil((jprev ? jMensu - jMensu/jprev*jded : jMensu*ratioDu) - 1e-9) : 0;
  // Heures réellement effectuées (pour la régularisation)
  let hReel = num('mois-hreel'), hReelAuto = false;
  if(!val('mois-hreel')){
    const c = moisContrat();
    // heures dues du planning : les jours fériés chômés sont payés, ils comptent donc comme effectués
    if(c){ const days = plannedDays(c, d.getFullYear(), d.getMonth()); hReel = days.reduce((s,x)=>s+x.h,0); }
    else hReel = hMensu;
    // les heures travaillées un jour férié sont déjà dans le planning : seules les heures en plus s'ajoutent
    hReel = Math.max(0, hReel - (absent ? num('mois-hded') : 0)) + hcompl + hmaj;
    hReelAuto = true;
  }
  // pour la régularisation : heures du contrat seulement (les heures en plus sont déjà payées à part)
  const hContrat = Math.max(0, hReel - hcompl - hmaj);
  // Abattement fiscal : jours de 8 h et plus / heures des jours plus courts
  const H8 = R('abatHeuresJour', d)||8;
  // jours exacts quand le mois vient du suivi au jour le jour, sinon estimation par la durée moyenne
  const j8 = val('mois-j8')!=='' ? num('mois-j8') : (hj >= H8 ? jours : 0), hm8 = val('mois-hm8')!=='' ? num('mois-hm8') : (hj < H8 ? jours*hj : 0);
  return {m, d, inc, taux, base, ded, hContrat, brutMensu: Math.max(0, base-ded), hcompl, hmaj, majPct, supFerie, brutCompl, brutMaj, brutNormal, cp12, cpVerse, cpTot, brut,
    net, netHs, netImp, jours, hj, ieLeg, ieSaisie, ieJour, ie, repas, km, hNormDecl, jDecl, hReel, hReelAuto, j8, hm8,
    jcp: inc ? num('mois-jcp') : 0, acompte: num('mois-acompte'), datepaie: val('mois-datepaie')};
}
CALC.mois = ()=>{
  const r = moisCompute(), d = r.d;
  const fl = Object.entries(feries(d.getFullYear())).filter(([k])=>k.slice(0,7)===r.m.slice(0,7)).map(([k,n])=>n+' ('+fmtDate(k)+')');
  setTxt('mois-feries-liste', fl.length ? 'Jours fériés ce mois-ci : '+fl.join(', ')+'. Un jour férié chômé prévu au planning est payé normalement (dès le début du contrat, si les jours d\'accueil prévus juste avant et juste après sont travaillés ou l\'absence autorisée).' : 'Aucun jour férié ce mois-ci.');
  setTxt('mois-ie-hint', 'Minimum légal pour une journée de '+fmtNum(r.hj||9,2)+' h : '+fmtEUR(r.ieLeg)+'. Laissez vide pour l\'appliquer.');
  setTxt('mois-hreel-hint', r.hReelAuto ? 'Calculé d\'après le planning : '+fmtNum(r.hReel,2)+' h. Corrigez si besoin (sert à la régularisation de fin de contrat).' : 'Gardées dans l\'historique pour la régularisation de fin de contrat.');
  const w = [];
  const tauxMin = R('salMin', d);
  if(r.taux && r.taux < tauxMin-1e-9) w.push('⛔ Salaire horaire inférieur au minimum légal de ce mois ('+fmtEUR(tauxMin)+').');
  if(r.ieSaisie && r.ieSaisie < r.ieLeg-1e-9) w.push('⚠️ L\'indemnité d\'entretien saisie ('+fmtEUR(r.ieSaisie)+') est sous le minimum légal ('+fmtEUR(r.ieLeg)+') : le minimum est appliqué.');
  if(seg('mois-incomplet')===1 && !num('mois-deduction')) w.push('Indiquez le montant déduit (calcul « Mois incomplet & absences », bouton « Reporter »).');
  if(!r.inc && (num('mois-cpmontant')||num('mois-jcp'))) w.push('Année complète : pas de congés payés à ajouter ni à déclarer.');
  const c = moisContrat();
  if(c && journalOf(c.id)[r.m]) w.push('ℹ️ Ce mois est déjà validé : valider à nouveau remplacera l\'enregistrement.');
  setHTML('mois-warn', warnHTML(w));
  setTxt('out-mois-brut', r.brut ? fmtEUR(r.brut)+(r.cpTot?' (dont congés '+fmtEUR(r.cpTot)+')':'') : '—');
  setTxt('out-mois-net-sal', r.brut ? fmtEUR(r.net) : '—');
  setTxt('out-mois-entretien', r.ie ? fmtEUR(r.ie)+' ('+r.jours+' j × '+fmtEUR(r.ieJour)+')' : '—');
  setTxt('out-mois-repas-r', r.repas ? fmtEUR(r.repas) : '—');
  setTxt('out-mois-km-r', r.km ? fmtEUR(r.km) : '—');
  const total = r.net+r.ie+r.repas+r.km;
  setTxt('out-mois-net', (r.brut||r.ie) ? fmtEUR(total) : '—');
  show('row-mois-reste', r.acompte>0, 'flex'); setTxt('out-mois-reste', fmtEUR(total - r.acompte));
  setTxt('out-mois-netimp', r.brut ? fmtEUR(r.netImp) : '—');
  // Lignes Pajemploi, dans l'ordre du formulaire en ligne
  const L = [
    ['Période (mois déclaré)', fmtMonth(r.m)],
    ['Nombre d\'heures normales', r.hNormDecl ? r.hNormDecl+' h' : '—'],
    ['Nombre de jours d\'activité', r.jDecl ? r.jDecl+' j' : '—'],
    ['Heures complémentaires : nombre / montant net', r.hcompl ? fmtNum(r.hcompl,2)+' h / '+fmtEUR(r.brutCompl*Math.min(1,netRatio(d)+(R('hsReduction',d)||0))) : '0'],
    ['Heures majorées : nombre / montant net', r.hmaj ? fmtNum(r.hmaj,2)+' h / '+fmtEUR(r.brutMaj*Math.min(1,netRatio(d)+(R('hsReduction',d)||0))) : '0'],
    ['Congés payés : jours / montant net', r.inc ? (r.cpTot||r.jcp ? fmtNum(r.jcp,1)+' j / '+fmtEUR(r.cpTot*netRatio(d)) : 'rien ce mois-ci') : 'ne rien remplir (année complète)'],
    ['Salaire net total', r.brut ? fmtEUR(r.net) : '—'],
    ['Indemnités d\'entretien', fmtEUR(r.ie)],
    ['Indemnités de repas', fmtEUR(r.repas)],
    ['Indemnités kilométriques', fmtEUR(r.km)],
    ['Acompte déjà versé', r.acompte ? fmtEUR(r.acompte) : '0'],
    ['Date de paiement', r.datepaie ? fmtDate(r.datepaie) : 'à indiquer'],
  ];
  if(c && c.fin && c.fin.slice(0,7)===r.m) L.push(['Fin de contrat ce mois-ci', 'Oui, le '+fmtDate(c.fin)+' (indemnités : voir « Fin de contrat »)']);
  setHTML('pj-lines', L.map(x=>'<div class="result-line"><span class="lbl">'+x[0]+'</span><span class="val">'+esc(x[1])+'</span></div>').join(''));
  renderJournal();
};
function validerMois(){
  const c = moisContrat();
  if(!c){ toast('Choisissez un enfant enregistré pour garder ce mois dans son historique.'); return; }
  const r = moisCompute();
  if(!r.brut){ toast('Le salaire du mois est vide.'); return; }
  STATE.journal = STATE.journal || {};
  STATE.journal[c.id] = STATE.journal[c.id] || {};
  STATE.journal[c.id][r.m] = { brut:round2(r.brut), net:round2(r.net), netImp:round2(r.netImp), ie:round2(r.ie), repas:round2(r.repas), km:round2(r.km),
    hDecl:r.hNormDecl, jDecl:r.jDecl, hCompl:r.hcompl, hMaj:r.hmaj, hReel:round2(r.hReel), hContrat:round2(r.hContrat), brutMensu:round2(r.brutMensu), jours:r.jours, jCP:r.jcp, cpMontant:round2(r.cpTot),
    ded:round2(r.ded), j8:r.j8, hm8:round2(r.hm8), taux:r.taux, datepaie:r.datepaie, validatedAt:new Date().toISOString() };
  // le mois correspondant du suivi passe au statut « déclaré »
  const S = (STATE.suivi||{})[c.id];
  if(S && S.months){ const mr = S.months[r.m] = S.months[r.m] || {st:'ouvert'}; if(MONTH_ST.indexOf(mr.st) < MONTH_ST.indexOf('declare')){ mr.st='declare'; auditLog(c.id, fmtMonth(r.m)+' déclaré (mois validé)'); } }
  persistTheme('mois'); saveNow();
  CALC.mois();
  toast('Mois de '+fmtMonth(r.m)+' enregistré pour '+(c.enfant||'l\'enfant')+'.');
}
function supprimerMois(id, m){
  showConfirmDialog('Retirer ce mois ?', 'Le mois de '+fmtMonth(m)+' sera retiré de l\'historique (vous pourrez le valider à nouveau).', ()=>{
    delete STATE.journal[id][m]; saveNow(); CALC.mois();
  }, 'Oui, retirer', 'Annuler');
}
function renderJournal(){
  const c = moisContrat();
  if(!c){ setHTML('mois-journal', '<p class="hint">L\'historique est tenu pour chaque enfant enregistré (pas en saisie libre).</p>'); return; }
  const J = journalOf(c.id), ms = Object.keys(J).sort().reverse();
  if(!ms.length){ setHTML('mois-journal', '<p class="hint">Aucun mois validé pour '+esc(c.enfant)+'. Après chaque déclaration Pajemploi, touchez « Valider ce mois » : les cumuls ci-dessous se rempliront tout seuls.</p>'); return; }
  const t = journalTotals(c.id);
  const ref = cpRefStart(today());
  const tN = journalTotals(c.id, isoMonth(ref)), tN1 = journalTotals(c.id, isoMonth(new Date(ref.getFullYear()-1,5,1)), isoMonth(new Date(ref.getFullYear(),4,1)));
  let h = '<div class="ab-table-wrap"><table class="ab-table" style="min-width:560px"><thead><tr><th>Mois</th><th>Brut</th><th>Net</th><th>Entretien + repas + km</th><th>Heures déclarées</th><th>Heures réelles</th><th></th></tr></thead><tbody>';
  ms.forEach(m=>{ const r=J[m];
    h += '<tr><td>'+fmtMonth(m)+'</td><td class="ab-out">'+fmtEUR(r.brut)+'</td><td class="ab-out">'+fmtEUR(r.net)+'</td><td class="ab-out">'+fmtEUR((r.ie||0)+(r.repas||0)+(r.km||0))+'</td><td>'+(r.hDecl||0)+' h</td><td>'+fmtNum(r.hReel||0,2)+' h</td>'
      + '<td><button class="btn small" onclick="supprimerMois(\''+c.id+'\',\''+m+'\')" aria-label="Retirer">✕</button></td></tr>'; });
  h += '</tbody></table></div>';
  h += '<div class="box"><div class="section-label">Cumuls repris automatiquement ailleurs</div>'
    + '<div class="result-line"><span class="lbl">Salaires bruts depuis le début ('+t.n+' mois validés) → indemnité de rupture</span><span class="val">'+fmtEUR(t.brut)+'</span></div>'
    + '<div class="result-line"><span class="lbl">Salaires bruts de la période de congés N-1 → congés payés (10 %)</span><span class="val">'+fmtEUR(tN1.brut)+'</span></div>'
    + '<div class="result-line"><span class="lbl">Salaires bruts de la période en cours (depuis le '+ref.toLocaleDateString('fr-FR')+')</span><span class="val">'+fmtEUR(tN.brut)+'</span></div>'
    + '<div class="result-line"><span class="lbl">Heures réellement effectuées depuis le début → régularisation</span><span class="val">'+fmtNum(t.hReel,2)+' h</span></div>'
    + '<div class="result-line"><span class="lbl">Net imposable + indemnités de l\'année '+today().getFullYear()+' → impôts</span><span class="val">'+fmtEUR((()=>{const y=journalTotals(c.id, today().getFullYear()+'-01', today().getFullYear()+'-12'); return y.netImp+y.ie+y.repas+y.km;})())+'</span></div>'
    + '<div class="net-hint">Les mois non validés ne sont pas comptés : validez chaque mois après la déclaration Pajemploi (ou corrigez avec les montants exacts du bulletin).</div></div>';
  setHTML('mois-journal', h);
}
function cpRefStart(d){ return new Date(d.getMonth()>=5 ? d.getFullYear() : d.getFullYear()-1, 5, 1); }

/* =====================================================================================
   03 · MOIS INCOMPLET (méthode Cour de cassation) & ABSENCES
   ===================================================================================== */
/* Motifs d'un mois incomplet.  ded : 'oui' = déduction (méthode Cour de cassation),
   'cond' = déduction sous conditions (aide au calcul), 'non' = aucune déduction (salaire dû). */
const MOTIFS = [
  {id:'debut', ded:'oui', t:'Arrivée ou départ de l\'enfant en cours de mois',
   info:'✅ Déduction. Premier ou dernier mois du contrat : on déduit les jours situés avant la date de début ou après la date de fin. Les jours fériés chômés compris dans le contrat restent payés. Dans le calendrier, gardez les heures de tout le mois et indiquez à déduire celles d\'avant le début / d\'après la fin.'},
  {id:'adapt', ded:'cond', t:'Premier mois avec période d\'adaptation',
   info:'✅ Déduction obligatoire avec cette méthode depuis la convention collective de 2022 (le paiement « au réel » n\'est plus admis). Le salaire mensualisé est dû dès le 1er jour ; on déduit les heures du planning normal qui n\'ont pas été faites pendant l\'adaptation (30 jours calendaires au plus, horaires prévus au contrat). Si le contrat prévoit le maintien du salaire pendant l\'adaptation, ne déduisez rien.'},
  {id:'maladie', ded:'oui', t:'Arrêt maladie, accident du travail, maternité ou paternité de l\'assmat',
   info:'✅ Déduction de toutes les heures prévues pendant l\'arrêt : le particulier employeur ne maintient pas le salaire (pas de subrogation). Vous êtes indemnisée par la CPAM (indemnités journalières ; 3 jours de carence en maladie) et par l\'IRCEM Prévoyance (complément). Envoyez l\'arrêt à la CPAM sous 48 h ; les parents déclarent l\'absence sur Pajemploi. Entretien et repas non dus.'},
  {id:'enfmal', ded:'cond', t:'Enfant accueilli malade, avec certificat médical',
   info:'✅ Déduction sous conditions : certificat médical (daté du 1er jour d\'absence, remis dans les 48 h), 5 jours au maximum (de suite ou non) par période de 12 mois comptée à partir de la date du contrat. Au-delà, le salaire est dû. Hospitalisation ou maladie d\'au moins 14 jours d\'affilée : pas de salaire pendant cette période (les parents peuvent aussi rompre le contrat).'},
  {id:'sanssolde', ded:'oui', t:'Congé sans solde, ou congés payés pas encore acquis',
   info:'✅ Déduction quand c\'est vous qui demandez l\'absence et que les parents l\'acceptent (de préférence par écrit), ou que vous partez en congés sans avoir assez de jours acquis (souvent la 1re année). ⚠️ Si ce sont les parents qui imposent une fermeture ou leurs propres vacances au-delà de vos congés acquis, le salaire reste en principe dû : choisissez alors « Absence de l\'enfant voulue par les parents ».'},
  {id:'enfassmat', ded:'cond', t:'Votre propre enfant malade',
   info:'✅ Déduction : congé non rémunéré pour enfant malade de moins de 16 ans, sur certificat médical, 3 jours par an (5 jours si l\'enfant a moins d\'un an ou si vous avez au moins 3 enfants de moins de 16 ans).'},
  {id:'evt', ded:'cond', t:'Événement familial (mariage, naissance, décès…)',
   info:'Ces jours sont payés normalement dans la limite prévue par la loi : on ne déduit que les jours pris en plus. Le congé de deuil d\'un enfant (8 jours supplémentaires) est indemnisé par la CPAM : ces jours-là se déduisent.'},
  {id:'autre', ded:'oui', t:'Autre absence non rémunérée de l\'assmat',
   info:'✅ Déduction : absence injustifiée, congé parental, congé de proche aidant ou de présence parentale, formation suivie sur le temps d\'accueil et indemnisée par un organisme, mise à pied… Gardez un écrit qui explique l\'absence.'},
  {id:'parents', ded:'non', t:'Absence de l\'enfant voulue par les parents, ou fermeture imposée par eux',
   info:'⛔ Pas de déduction : vacances des parents non prévues au contrat, convenance personnelle, garde par la famille, fermeture imposée au-delà de vos congés acquis… Le salaire mensualisé reste dû en entier. Seules les indemnités d\'entretien et de repas ne sont pas dues ces jours-là.'},
  {id:'enfmalsans', ded:'non', t:'Enfant malade sans certificat, ou au-delà des 5 jours',
   info:'⛔ Pas de déduction : sans certificat médical remis à temps, ou une fois les 5 jours de la période de 12 mois utilisés, le salaire est dû (sauf hospitalisation ou maladie d\'au moins 14 jours d\'affilée). Entretien et repas non dus les jours d\'absence.'},
  {id:'cp', ded:'non', t:'Vos congés payés (année complète)',
   info:'⛔ Pas de déduction : en année complète, vos congés payés sont déjà compris dans le salaire mensualisé. (Si vous n\'avez pas assez de jours acquis, choisissez « Congé sans solde ».)'},
  {id:'nonprog', ded:'non', t:'Semaine sans accueil prévue au contrat (année incomplète)',
   info:'⛔ Rien à déduire : les semaines non programmées sont déjà exclues du salaire mensualisé, et vos congés payés sont payés à part. Dans le calendrier d\'un mois incomplet pour une autre raison, laissez simplement ces jours vides.'},
  {id:'ferie', ded:'non', t:'Jour férié chômé',
   info:'⛔ Pas de déduction : un jour férié chômé qui tombe un jour d\'accueil prévu est payé (dès le début du contrat, si les jours d\'accueil prévus juste avant et juste après sont travaillés ou l\'absence autorisée ; le 1er mai est toujours chômé et payé).'},
  {id:'evtquota', ded:'non', t:'Événement familial dans la limite légale',
   info:'⛔ Pas de déduction : ces jours sont payés normalement (voir la liste dans « Événement familial »).'}
];
const EVT_LABELS = {mariage:'votre mariage ou PACS', mariageEnfant:'le mariage de votre enfant', naissance:'une naissance ou adoption', decesEnfant:'le décès de votre enfant',
  decesEnfantMoins25:'le décès de votre enfant de moins de 25 ans', decesConjoint:'le décès du conjoint', decesParentFratrie:'le décès d\'un proche (parent, beau-parent, frère, sœur)', handicapEnfant:'l\'annonce du handicap ou de la maladie de votre enfant'};
function ccassMotif(){ return MOTIFS.find(m=>m.id===val('ccass-motif-sel')) || MOTIFS[0]; }
function fillMotifSelect(){
  const s = $('ccass-motif-sel'); if(s.options.length) return;
  const grp = (lbl, ded)=>'<optgroup label="'+lbl+'">'+MOTIFS.filter(m=>ded.includes(m.ded)).map(m=>'<option value="'+m.id+'">'+esc(m.t)+'</option>').join('')+'</optgroup>';
  s.innerHTML = grp('✅ Absences qui se déduisent', ['oui','cond']) + grp('⛔ Absences qui ne se déduisent pas', ['non']);
}
VIS.ccass = ()=>{
  fillMotifSelect();
  if(!val('ccass-motif-sel')) setVal('ccass-motif-sel', 'debut');
  const sup = seg('ccass-hassup')===1, cal = seg('ccass-usecal')===0, mo = ccassMotif();
  ['ccass-base-sup-wrap','ccass-hsup-habituel-wrap','ccass-hpot-sup-wrap','ccass-hded-sup-wrap'].forEach(id=>show(id, sup));
  show('row-ccass-deduct-sup', sup, 'flex'); show('row-ccass-cal-hsup', sup, 'flex'); show('row-ccass-hsup-declar', sup, 'flex');
  show('ccass-cal-wrap', cal); show('ccass-manuel-wrap', !cal);
  show('ccass-ie-wrap', seg('ccass-entretien')===1); show('row-ccass-entretien', seg('ccass-entretien')===1, 'flex');
  show('ccass-maladie-wrap', mo.id==='enfmal'); show('ccass-evt-wrap', mo.id==='evt');
  show('ccass-ea-wrap', mo.id==='enfassmat'); show('ccass-adapt-wrap', mo.id==='adapt');
  show('ccass-report-row', mo.ded==='cond', 'flex');
  const box = $('ccass-motif-info');
  box.textContent = mo.info;
  box.className = mo.ded==='non' ? 'warn-box' : 'info-box';
  if(cal) buildCcassCalendar();
};
/* Aides au calcul des motifs « sous conditions » : renvoie {jours, heures, txt} déductibles */
function ccassHelper(){
  const mo = ccassMotif();
  const jp = num('ccass-jours-potentiels'), hp = num('ccass-hpot-normal');
  const hJour = jp ? hp/jp : 0;   // durée moyenne d'une journée prévue ce mois-ci
  const est = j => hJour ? ' Soit environ <b>'+fmtNum(j*hJour,2)+' h</b> (durée moyenne d\'une journée prévue ce mois-ci) : corrigez si les jours concernés ont une autre durée.' : '';
  if(mo.id==='enfmal'){
    const lim = R('absMaladieEnfant'), deja = num('ccass-mal-deja'), mois = num('ccass-mal-mois');
    if(seg('ccass-mal-longue')===1) return {jours:mois, heures:mois*hJour, txt:'Hospitalisation ou maladie d\'au moins '+R('absMaladieLongue')+' jours d\'affilée : les <b>'+mois+'</b> jour(s) de ce mois se déduisent.'+est(mois)};
    const ded = Math.max(0, Math.min(mois, lim-deja));
    return {jours:ded, heures:ded*hJour, txt:'Jours déductibles ce mois-ci : <b>'+ded+'</b> sur '+mois+'. Il restera '+Math.max(0,lim-deja-ded)+' jour(s) déductible(s) jusqu\'à la prochaine date anniversaire du contrat.'+(mois>ded?' Les '+(mois-ded)+' autre(s) jour(s) restent payés.':'')+est(ded)};
  }
  if(mo.id==='evt'){
    const q = R('evtFamiliaux')||{}, type = val('ccass-evt-type')||'mariage', quota = q[type]||0, pris = num('ccass-evt-jours');
    const ded = Math.max(0, pris-quota);
    return {jours:ded, heures:ded*hJour, txt:'Pour '+EVT_LABELS[type]+', <b>'+quota+' jour(s)</b> sont payés normalement. Jours à déduire : <b>'+ded+'</b> sur '+pris+'.'
      +(type==='decesEnfantMoins25'?' En plus, le congé de deuil ('+R('congeDeuil')+' jours, indemnisé par la CPAM) se déduit : ajoutez ces jours s\'ils sont pris ce mois-ci.':'')+est(ded)};
  }
  if(mo.id==='enfassmat'){
    const quota = (R('enfantMaladeAssmat')||[3,5])[seg('ccass-ea-plus')], deja = num('ccass-ea-deja'), mois = num('ccass-ea-mois');
    const reste = Math.max(0, quota-deja);
    return {jours:mois, heures:mois*hJour, txt:'Ces <b>'+mois+'</b> jour(s) ne sont pas rémunérés : ils se déduisent.'+(mois>reste?' ⚠️ Vous dépassez votre droit annuel ('+quota+' jours, il en restait '+reste+') : les jours en plus doivent être acceptés par les parents (congé sans solde).':' Il vous restera '+(reste-mois)+' jour(s) cette année.')+est(mois)};
  }
  if(mo.id==='adapt'){
    const faites = num('ccass-adapt-faites');
    if(!hp) return {jours:0, heures:0, txt:'Remplissez d\'abord le calendrier avec le planning normal du mois (bouton « Remplir avec le planning du contrat »).'};
    const h = Math.max(0, hp-faites);
    return {jours:null, heures:h, txt:'Heures prévues au planning ce mois-ci : '+fmtNum(hp,2)+' h ; faites : '+fmtNum(faites,2)+' h. Heures à déduire : <b>'+fmtNum(h,2)+' h</b>. Indiquez aussi les jours où l\'enfant n\'est pas venu du tout.'};
  }
  return null;
}
function ccassReport(){
  const r = ccassHelper(); if(!r) return;
  if(r.jours!==null) setVal('ccass-jours-non-travailles', r.jours);
  setVal('ccass-hded-normal', round2(r.heures));
  CALC.ccass(); persistTheme('ccass');
  toast('Reporté : vérifiez les heures, puis le résultat.');
}
PREFILL.ccass = c=>{
  setVal('ccass-cal-mois', curMonth());
  if(!c){ buildCcassCalendar(); return; }
  const dv = derive(c);
  setVal('ccass-base-normal', round2(dv.hNormMensu*dv.tauxEff));
  setSegVal('ccass-hassup', dv.hMajMensu>0 ? 1 : 0);
  if(dv.hMajMensu>0){ setVal('ccass-base-sup', round2(dv.hMajMensu*dv.tauxEff*(1+dv.majPct/100))); setVal('ccass-hsup-habituel', round2(dv.hMajMensu)); }
  setVal('ccass-jours-habituel', round2(dv.joursMensu));
  setVal('ccass-hnorm-habituel', round2(dv.hNormMensu));
  setSegVal('ccass-entretien', 1);
  setVal('ccass-ie-montant', round2(c.ieMode===1 ? Math.max(parseFloat(c.ieMontant)||0, dv.ieJour) : dv.ieJour));
  const dm = malCountBefore(c, parseD(curMonth())); if(dm) setVal('ccass-mal-deja', dm);
  refreshVisibility('ccass');
  ccassPrefillCalendar(true);
};
function buildCcassCalendar(){
  const m = val('ccass-cal-mois') || curMonth();
  const base = parseD(m), y = base.getFullYear(), mo = base.getMonth(), nb = daysInMonth(y, mo);
  const hasSup = seg('ccass-hassup')===1;
  const prevN = {}, prevS = {};
  document.querySelectorAll('[id^="ccass-d-"]').forEach(i=>{ if(i.value!=='') prevN[i.id]=i.value; });
  document.querySelectorAll('[id^="ccass-ds-"]').forEach(i=>{ if(i.value!=='') prevS[i.id]=i.value; });
  const cont = $('ccass-calendar');
  if(cont.dataset.month !== m){ Object.keys(prevN).forEach(k=>delete prevN[k]); Object.keys(prevS).forEach(k=>delete prevS[k]); }
  let h = '<div class="cal-grid">';
  // cases vides pour aligner le 1er du mois sur son jour de semaine (affichage 7 colonnes)
  const lead = dowIdx(new Date(y,mo,1));
  for(let i=0;i<lead;i++) h += '<div class="cal-day off lead" style="visibility:hidden"></div>';
  for(let d=1; d<=nb; d++){
    const dt = new Date(y,mo,d), fn = ferieName(dt), dw = dowIdx(dt);
    h += '<div class="cal-day'+(dw===6?' off':'')+(fn?' ferie':'')+'"><div class="dname">'+DOW_SHORT[dw]+'</div><div class="dnum">'+d+'</div>'
      + (fn?'<div class="fname">'+esc(fn)+'</div>':'')
      + '<input type="number" inputmode="decimal" step="0.25" min="0" placeholder="h" id="ccass-d-'+d+'" value="'+esc(prevN['ccass-d-'+d]||'')+'">'
      + (hasSup?'<input type="number" inputmode="decimal" step="0.25" min="0" placeholder="maj" class="sup" id="ccass-ds-'+d+'" value="'+esc(prevS['ccass-ds-'+d]||'')+'">':'')
      + '</div>';
  }
  h += '</div>';
  cont.innerHTML = h; cont.dataset.month = m;
  // sur petit écran (4 colonnes) l'alignement n'a pas de sens : on masque les cases d'alignement
  if(window.matchMedia('(max-width:480px)').matches) cont.querySelectorAll('.lead').forEach(e=>e.remove());
  onCcassCalInput(true);
}
function ccassPrefillCalendar(silent){
  const k = selKey('ccass'), c = k!=='libre' ? getContrat(k) : null;
  if(!c){ if(!silent) toast('Choisissez d\'abord un enfant enregistré.'); return; }
  const m = val('ccass-cal-mois') || curMonth(); setVal('ccass-cal-mois', m);
  $('ccass-calendar').dataset.month = '';
  buildCcassCalendar();
  const d = parseD(m), seuil = R('seuilMaj', d);
  const days = plannedDays(c, d.getFullYear(), d.getMonth());
  const hasSup = seg('ccass-hassup')===1;
  // répartition des heures au-delà de 45 h sur les derniers jours de chaque semaine
  const byWeek = {};
  days.forEach(x=>{ const k=iso(mondayOf(x.d)); (byWeek[k]=byWeek[k]||[]).push(x); });
  Object.values(byWeek).forEach(list=>{
    const A=wNums(c.wA), B=c.alterne?wNums(c.wB):A;
    const tot = (weekIsB(c,list[0].d)?B:A).reduce((s,x)=>s+x,0);
    let exc = hasSup ? Math.max(0, tot-seuil) : 0;
    for(let i=list.length-1;i>=0;i--){ const take=Math.min(exc, list[i].h); list[i].sup=take; list[i].norm=list[i].h-take; exc-=take; }
  });
  days.forEach(x=>{ setVal('ccass-d-'+x.d.getDate(), round2(x.norm)); if(hasSup && x.sup) setVal('ccass-ds-'+x.d.getDate(), round2(x.sup)); });
  onCcassCalInput();
  if(!silent) toast(c.type===1
    ? 'Calendrier rempli d\'après le planning. Année incomplète : videz les jours des semaines où l\'accueil n\'est pas prévu au contrat.'
    : 'Calendrier rempli d\'après le planning. Les jours fériés sont comptés comme prévus (ils sont payés).');
}
function ccassClearCalendar(){ document.querySelectorAll('[id^="ccass-d-"],[id^="ccass-ds-"]').forEach(i=>i.value=''); onCcassCalInput(); }
function onCcassCalInput(noCalc){
  let hn=0, hs=0, j=0;
  document.querySelectorAll('#ccass-calendar .cal-day').forEach(cell=>{
    const a = cell.querySelector('[id^="ccass-d-"]'), b = cell.querySelector('[id^="ccass-ds-"]');
    const av = a ? parseFloat(a.value) : NaN, bv = b ? parseFloat(b.value) : NaN;
    if(av>0) hn+=av; if(bv>0) hs+=bv;
    if(av>0 || bv>0) j++;
  });
  setTxt('out-ccass-cal-jours', j ? j+' j' : '—');
  setTxt('out-ccass-cal-hnorm', hn ? fmtNum(hn,2)+' h' : '—');
  setTxt('out-ccass-cal-hsup', hs ? fmtNum(hs,2)+' h' : '—');
  if(seg('ccass-usecal')===0){
    setVal('ccass-jours-potentiels', j||''); setVal('ccass-hpot-normal', hn||''); setVal('ccass-hpot-sup', hs||'');
  }
  if(noCalc!==true) CALC.ccass();
}
CALC.ccass = ()=>{
  const sup = seg('ccass-hassup')===1;
  const bN = num('ccass-base-normal'), bS = sup ? num('ccass-base-sup') : 0;
  const hpN = num('ccass-hpot-normal'), hpS = sup ? num('ccass-hpot-sup') : 0;
  const mo = ccassMotif(), nonDed = mo.ded==='non';
  // motif non déductible : le salaire mensualisé reste dû en entier, quelles que soient les heures saisies
  const hdN = nonDed ? 0 : num('ccass-hded-normal'), hdS = (sup && !nonDed) ? num('ccass-hded-sup') : 0;
  const dN = hpN ? bN/hpN*hdN : 0, dS = hpS ? bS/hpS*hdS : 0;
  setHTML('ccass-verdict', nonDed
    ? '<div class="warn-box">⛔ <b>Aucune déduction</b> pour ce motif : le salaire mensualisé est dû en entier'+(num('ccass-jours-non-travailles')?' ; seuls l\'entretien et les repas ne sont pas dus les '+num('ccass-jours-non-travailles')+' jour(s) d\'absence':'')+'.</div>'
    : (num('ccass-hded-normal')||num('ccass-hded-sup')) ? '' : '<div class="info-box">Indiquez les heures non travaillées à déduire pour obtenir le salaire du mois.</div>');
  const sal = (bN-dN)+(bS-dS);
  setTxt('out-ccass-deduct-normal', fmtEUR(dN)); setTxt('out-ccass-deduct-sup', fmtEUR(dS));
  setTxt('out-ccass-salaire', (bN||bS) ? fmtEUR(sal) : '—');
  const jh=num('ccass-jours-habituel'), jp=num('ccass-jours-potentiels'), jnt=num('ccass-jours-non-travailles');
  const hnh=num('ccass-hnorm-habituel'), hsh=sup?num('ccass-hsup-habituel'):0;
  const up = x=>Math.ceil(x-1e-9);
  const jD = jp ? up(jh - jh/jp*(nonDed?0:jnt)) : NaN;
  const hnD = hpN ? up(hnh - hnh/hpN*hdN) : NaN;
  const hsD = (sup && hpS) ? up(hsh - hsh/hpS*hdS) : 0;
  setTxt('out-ccass-jours-declar', !isNaN(jD) ? Math.max(jD,0)+' j' : '—');
  setTxt('out-ccass-hnorm-declar', !isNaN(hnD) ? Math.max(hnD,0)+' h' : '—');
  setTxt('out-ccass-hsup-declar', Math.max(hsD,0)+' h');
  setTxt('out-ccass-h-total-declar', !isNaN(hnD) ? Math.max((hnD||0)+(hsD||0),0)+' h' : '—');
  const jAcc = Math.max(0, jp-jnt);
  const ie = seg('ccass-entretien')===1 ? jAcc*num('ccass-ie-montant') : 0;
  setTxt('out-ccass-entretien', fmtEUR(ie));
  const m = val('ccass-cal-mois') || curMonth();
  setTxt('out-ccass-total', (bN||bS||ie) ? fmtEUR(sal+ie) : '—');
  setTxt('out-ccass-net', (bN||bS||ie) ? fmtEUR(toNet(sal, m)+ie) : '—');
  // Aides au calcul selon le motif
  const r = ccassHelper();
  if(r){ const id = {enfmal:'ccass-mal-result', evt:'ccass-evt-result', enfassmat:'ccass-ea-result', adapt:'ccass-adapt-result'}[mo.id]; setHTML(id, r.txt); }
};
function ccassSendToMois(){
  const sup = seg('ccass-hassup')===1;
  const sal = num('ccass-base-normal')+(sup?num('ccass-base-sup'):0);
  if(!sal){ toast('Faites d\'abord le calcul.'); return; }
  const nonDed = ccassMotif().ded==='non';
  const hpN=num('ccass-hpot-normal'), hpS=sup?num('ccass-hpot-sup'):0;
  const ded = nonDed ? 0 : (hpN ? num('ccass-base-normal')/hpN*num('ccass-hded-normal') : 0) + (hpS ? num('ccass-base-sup')/hpS*num('ccass-hded-sup') : 0);
  const v = { m: val('ccass-cal-mois'), jprev: num('ccass-jours-potentiels'), jnt: num('ccass-jours-non-travailles'),
    hded: num('ccass-hded-normal') + (sup ? num('ccass-hded-sup') : 0) };
  persistTheme('ccass');
  const key = selKey('ccass');
  STATE.sel.mois = key;
  STATE.forms.mois = STATE.forms.mois || {};
  let f = STATE.forms.mois[key];
  if(!f){ showTheme('mois'); f = formCollect('mois'); }
  f.s['mois-incomplet'] = nonDed ? 0 : 1; f.i['mois-deduction'] = round2(ded);
  if(v.m) f.i['mois-mois'] = v.m;
  f.i['mois-jprev'] = v.jprev || '';
  f.i['mois-jded'] = nonDed ? 0 : v.jnt;
  f.i['mois-hded'] = nonDed ? 0 : v.hded;
  // présence réelle (entretien, repas) : on retire les jours d'absence, même quand ils ne se déduisent pas du salaire
  const jp = v.jprev - v.jnt; if(jp>0) f.i['mois-jours'] = jp;
  STATE.forms.mois[key] = f; saveState();
  if(CURRENT==='mois') loadThemeForm('mois'); else showTheme('mois');
  toast('Déduction de '+fmtEUR(ded)+' reportée.');
}

/* =====================================================================================
   04 · CONGÉS PAYÉS (périodes N-2, N-1, N)
   ===================================================================================== */
const CP_P = [ {k:'n2', t:'Période N-2'}, {k:'n1', t:'Période N-1'}, {k:'n', t:'Période N (en cours)'} ];
function buildCpPeriods(){
  let h='';
  CP_P.forEach((p,i)=>{
    h += '<div class="cp-period"><div class="cp-period-title">'+p.t+'</div>'
      + '<div class="grid2"><div class="field"><label>Date de début</label><input type="date" id="cp-'+p.k+'-debut"></div>'
      + '<div class="field"><label>Date de fin'+(p.k==='n'?' (ou aujourd\'hui)':'')+'</label><input type="date" id="cp-'+p.k+'-fin"></div></div>'
      + '<div class="field"><label>Mois d\'arrêt maladie (non professionnelle) sur la période</label><input type="number" step="0.5" min="0" id="cp-'+p.k+'-mal" placeholder="0"><div class="hint">Ces mois donnent 2 jours au lieu de 2,5 (accident du travail : laissez 0).</div></div>'
      + (i>0 ? '<div class="result-line" id="row-cp-'+p.k+'-report" style="display:none"><span class="lbl">↳ reliquat reporté de la période précédente</span><span class="val" id="out-cp-'+p.k+'-report">—</span></div>' : '')
      + '<div class="result-line cp-sub"><span class="lbl">Jours acquis sur cette période</span><span class="val" id="out-cp-'+p.k+'-acquis">—</span></div>'
      + '<div class="field"><label>Jours de congés pris sur cette période</label><input type="number" step="0.5" min="0" id="cp-'+p.k+'-solde" placeholder="0"></div>'
      + '<div class="result-line cp-rel"><span class="lbl">Reliquat en fin de période</span><span class="val" id="out-cp-'+p.k+'-reliquat">—</span></div></div>';
  });
  $('cp-periods').innerHTML = h;
}
function joursAcquisCP(d1, d2, moisMal, enCours){
  const s=parseD(d1), e=parseD(d2);
  if(!s||!e||e<=s) return 0;
  const months = monthsBetween(s,e);
  const anchor = addMonths(s, months);
  const lenInc = Math.round((addMonths(anchor,1)-anchor)/86400000) || 30;
  const daysInc = Math.max(0, Math.round((e-anchor)/86400000)+1);
  const frac = Math.min(1, daysInc/lenInc);
  const total = months + frac;
  const mal = Math.min(total, Math.max(0, moisMal||0));
  const parMois = R('cpParMois', e), parMal = R('cpMaladie', e)||0;
  const jMal = Math.min(mal*parMal, R('cpMaladieMax', e)||24);
  const brut = (total-mal)*parMois + jMal;
  // l'arrondi au jour supérieur se fait sur la période close ; en cours de période on montre la valeur exacte
  return Math.min(enCours ? Math.floor(brut*100)/100 : Math.ceil(brut - 1e-9), R('cpMax', e));
}
VIS.cp = ()=>{
  show('cp-valeur-wrap', seg('cp-valeur')===1);
  show('cp-valeur-results', seg('cp-valeur')===1);
};
function cpRefPeriods(c){
  const t = today();
  const startN = new Date(t.getMonth()>=5 ? t.getFullYear() : t.getFullYear()-1, 5, 1);
  const deb = c ? parseD(c.debut) : null, fin = c ? parseD(c.fin) : null;
  const P = [
    {k:'n2', s:new Date(startN.getFullYear()-2,5,1), e:new Date(startN.getFullYear()-1,4,31)},
    {k:'n1', s:new Date(startN.getFullYear()-1,5,1), e:new Date(startN.getFullYear(),4,31)},
    {k:'n',  s:startN, e:t}
  ];
  return P.map(p=>{
    let s=p.s, e=p.e;
    if(deb && deb>s) s=deb;
    if(fin && fin<e) e=fin;
    return {k:p.k, s: e>=s ? s : null, e: e>=s ? e : null};
  });
}
function cpAutoDates(){
  const k = selKey('cp'), c = k!=='libre' ? getContrat(k) : null;
  cpRefPeriods(c).forEach(p=>{ setVal('cp-'+p.k+'-debut', p.s?iso(p.s):''); setVal('cp-'+p.k+'-fin', p.e?iso(p.e):''); });
  CALC.cp(); persistTheme('cp');
  toast(c ? 'Dates calculées d\'après le contrat (périodes du 1er juin au 31 mai).' : 'Dates des périodes de référence remplies (1er juin – 31 mai).');
}
PREFILL.cp = c=>{
  cpRefPeriods(c).forEach(p=>{ setVal('cp-'+p.k+'-debut', p.s?iso(p.s):''); setVal('cp-'+p.k+'-fin', p.e?iso(p.e):''); });
  if(!c) return;
  const dv = derive(c);
  setSegVal('cp-type', c.type); setVal('cp-taux', round2(dv.tauxEff)); setVal('cp-heures', round2(dv.moyH));
};
CALC.cp = ()=>{
  const A = {}, S = {};
  CP_P.forEach(p=>{
    const fin = parseD(val('cp-'+p.k+'-fin')), enCours = p.k==='n' && fin && !(fin.getMonth()===4 && fin.getDate()===31);
    A[p.k]=joursAcquisCP(val('cp-'+p.k+'-debut'), val('cp-'+p.k+'-fin'), num('cp-'+p.k+'-mal'), enCours); S[p.k]=num('cp-'+p.k+'-solde');
  });
  const take=(pools, n)=>{ for(const k of Object.keys(pools)){ const u=Math.min(pools[k], n); pools[k]-=u; n-=u; } return pools; };
  let pools = take({n2:A.n2}, S.n2);
  setTxt('out-cp-n2-acquis', fmtNum(A.n2,2)+' j'); setTxt('out-cp-n2-reliquat', fmtNum(pools.n2,2)+' j');
  show('row-cp-n1-report', pools.n2>0, 'flex'); setTxt('out-cp-n1-report', fmtNum(pools.n2,2)+' j');
  pools = take({n2:pools.n2, n1:A.n1}, S.n1);
  setTxt('out-cp-n1-acquis', fmtNum(A.n1,2)+' j'); setTxt('out-cp-n1-reliquat', fmtNum(pools.n2+pools.n1,2)+' j');
  show('row-cp-n-report', pools.n2+pools.n1>0, 'flex'); setTxt('out-cp-n-report', fmtNum(pools.n2+pools.n1,2)+' j');
  pools = take({n2:pools.n2, n1:pools.n1, n:A.n}, S.n);
  const dispo = pools.n2+pools.n1+pools.n;
  setTxt('out-cp-n-acquis', fmtNum(A.n,2)+' j'); setTxt('out-cp-n-reliquat', fmtNum(dispo,2)+' j');
  setTxt('out-cp-acquis', fmtNum(A.n2+A.n1,2)+' j'); setTxt('out-cp-encours', fmtNum(A.n,2)+' j');
  setTxt('out-cp-pris', fmtNum(S.n2+S.n1+S.n,2)+' j'); setTxt('out-cp-total', fmtNum(dispo,2)+' j');
  let rep='';
  if(pools.n2>0||pools.n1>0){
    if(pools.n2>0) rep+='<div class="result-line"><span class="lbl">↳ dont reliquat N-2 (à prendre en premier)</span><span class="val">'+fmtNum(pools.n2,2)+' j</span></div>';
    if(pools.n1>0) rep+='<div class="result-line"><span class="lbl">↳ dont reliquat N-1</span><span class="val">'+fmtNum(pools.n1,2)+' j</span></div>';
    rep+='<div class="result-line"><span class="lbl">↳ dont période N</span><span class="val">'+fmtNum(pools.n,2)+' j</span></div>';
  }
  setHTML('cp-repart', rep);
  // Suggestion du total des salaires d'après le contrat
  const k = selKey('cp'), c = k!=='libre' ? getContrat(k) : null;
  if(c && val('cp-n1-debut') && val('cp-n1-fin')){
    const s=parseD(val('cp-n1-debut')), e=parseD(val('cp-n1-fin'));
    const mo = monthsBetween(s, addDays(e,1)) || 0;
    const jt = journalTotals(c.id, isoMonth(s), isoMonth(e));
    const est = jt.n ? jt.brut - jt.cpMontant : derive(c, e).brutBase*mo;
    const src = jt.n ? 'Total de vos '+jt.n+' mois validés sur la période N-1' : 'Estimation d\'après le contrat pour la période N-1 (validez vos mois pour avoir le montant exact)';
    setHTML('cp-total-suggest', est ? src+' : <a href="#" onclick="setVal(\'cp-total-salaires\','+round2(est)+');CALC.cp();persistTheme(\'cp\');return false;">'+fmtEUR(est)+'</a> (touchez pour l\'utiliser).' : '');
  } else setHTML('cp-total-suggest','');
  if(seg('cp-valeur')!==1) return;
  const taux=num('cp-taux'), h=num('cp-heures'), tot=num('cp-total-salaires');
  const vj = (h/6)*taux;                          // valeur d'un jour ouvrable (6 jours ouvrables par semaine)
  const maintien = dispo*vj, dixieme = tot*0.10;
  const verser = Math.max(maintien, dixieme);
  setTxt('out-cp-maintien', fmtEUR(maintien)); setTxt('out-cp-dixieme', fmtEUR(dixieme));
  setTxt('out-cp-verser', fmtEUR(verser)); setTxt('out-cp-net', fmtEUR(toNet(verser)));
  setTxt('cp-badge', maintien>=dixieme ? 'Maintien' : 'Dixième');
  // Paiement selon le type de contrat (sur la période N-1, celle des congés acquis)
  const mN1 = A.n1*vj, iN1 = Math.max(mN1, dixieme);
  let p = '<div class="section-label">Comment payer les congés acquis sur la période N-1 ?</div>';
  if(seg('cp-type')===0){
    const comp = Math.max(0, dixieme - mN1);
    p += '<div class="result-line"><span class="lbl">Année complète : les congés pris sont déjà payés par le salaire mensualisé. Complément à verser en juin si les 10 % sont plus favorables</span><span class="val">'+fmtEUR(comp)+'</span></div>';
  } else {
    p += '<div class="result-line"><span class="lbl">Indemnité de congés payés de la période (la plus favorable)</span><span class="val">'+fmtEUR(iN1)+'</span></div>'
      +  '<div class="result-line"><span class="lbl">• Paiement en une fois en juin</span><span class="val">'+fmtEUR(iN1)+'</span></div>'
      +  '<div class="result-line"><span class="lbl">• Paiement par 12ᵉ chaque mois (≈ 10 % du salaire)</span><span class="val">'+fmtEUR(iN1/12)+' / mois</span></div>'
      +  '<div class="result-line"><span class="lbl">• Paiement à la prise des congés, par jour pris</span><span class="val">'+(A.n1?fmtEUR(iN1/A.n1)+' / jour':'—')+'</span></div>'
      +  '<div class="net-hint">Année incomplète : l\'indemnité de congés s\'ajoute au salaire mensualisé, selon le mode prévu au contrat. En cas de paiement par 12ᵉ, une vérification est faite en fin de période (maintien ou 10 %, le plus favorable).</div>';
  }
  setHTML('cp-paiement', p);
};

/* =====================================================================================
   05 · INDEMNITÉS D'ENTRETIEN
   ===================================================================================== */
VIS.ie = ()=>{ show('ie-contrat-wrap', seg('ie-mode')===1); show('ie-compare-results', seg('ie-mode')===1); };
PREFILL.ie = c=>{
  setVal('ie-mois', curMonth());
  if(!c) return;
  const d = parseD(curMonth());
  const days = plannedDays(c, d.getFullYear(), d.getMonth(), {skipFeries:true});
  setVal('ie-jours-accueil', days.length||'');
  setVal('ie-heures', days.length ? round2(days.reduce((s,x)=>s+x.h,0)/days.length) : round2(derive(c).hDayAvg));
  if(c.ieMode===1){ setSegVal('ie-mode',1); setVal('ie-montant-contrat', c.ieMontant); }
};
CALC.ie = ()=>{
  const m = val('ie-mois') || curMonth();
  const pm = seg('ie-employeur')===1;
  const mg = R('mg', m), h = num('ie-heures'), j = num('ie-jours-accueil');
  const leg = ieLegalJour(h||R('ieHeuresRef',m), m, pm);
  setTxt('out-ie-mg', fmtEUR(mg)+' (depuis le '+fmtDate(Rdu('mg',m))+')');
  setTxt('out-ie-9h', fmtEUR(ceil2(ieLegalJour(R('ieHeuresRef',m), m, pm))));
  setTxt('out-ie-taux', fmtEUR(ceil2(leg))+' / jour'+(h?' ('+fmtNum(h,2)+' h)':''));
  setTxt('out-ie-jours', j ? j+' j' : '—');
  setTxt('out-ie-mois-min', j ? fmtEUR(ceil2(leg)*j) : '—');
  if(seg('ie-mode')===1){
    const mc = num('ie-montant-contrat');
    setTxt('out-ie-contrat', mc&&j ? fmtEUR(mc*j) : '—');
    const b=$('ie-badge'), row=$('row-ie-conformite');
    row.classList.remove('warn');
    if(mc && mc+1e-9 >= ceil2(leg)){ b.textContent='Conforme'; b.className='badge ok'; setTxt('out-ie-ecart','Marge : '+fmtEUR(mc-ceil2(leg))+'/jour'); }
    else { b.textContent='Insuffisant'; b.className='badge warn'; row.classList.add('warn'); setTxt('out-ie-ecart', mc ? 'Manque : '+fmtEUR(ceil2(leg)-mc)+'/jour' : '—'); }
  }
};

/* =====================================================================================
   06 · FIN DE CONTRAT
   ===================================================================================== */
function buildFinAvenants(){
  let h='';
  for(let i=1;i<=4;i++){
    h += '<div id="fin-regul-av'+i+'-block" class="box" style="display:none;background:var(--bg)"><div class="section-label">Avenant n°'+i+'</div>'
      + '<div class="field"><label>Date d\'effet de l\'avenant n°'+i+'</label><input type="date" id="fin-regul-av'+i+'-date"></div>'
      + '<div class="field"><label>Total des salaires mensualisés versés depuis cet avenant (€)</label><input type="number" step="0.01" id="fin-regul-av'+i+'-verse" placeholder="ex. 3200"></div>'
      + '<div class="grid2"><div class="field"><label>Heures réellement effectuées depuis cet avenant</label><input type="number" step="0.25" id="fin-regul-av'+i+'-heures" placeholder="ex. 520"></div>'
      + '<div class="field"><label>Nouveau salaire horaire (€)</label><input type="number" step="0.01" id="fin-regul-av'+i+'-taux" placeholder="ex. 4.60"></div></div></div>';
  }
  $('fin-regul-avs').innerHTML = h;
}
function finRegulApplicable(){ return seg('fin-type')===1 || seg('fin-regul-q1')===1 || seg('fin-regul-q2')===1; }
function finPreavis(){
  const qui = seg('fin-qui'), faute = qui===0 && seg('fin-faute')===1;
  const deb = parseD(val('fin-debut')), notif = parseD(val('fin-notif'));
  const res = {qui, faute, deb, notif, mois:null, jours:0, moisP:0, fin:null, motifSans:''};
  if(qui===2){ res.motifSans='Suspension, modification ou retrait d\'agrément : le contrat est rompu sans préavis ni indemnité de rupture (les congés non pris restent dus).'; return res; }
  if(qui===4){ res.motifSans='Renonciation avant le début de l\'accueil (engagement réciproque signé) : la partie qui renonce verse à l\'autre une indemnité forfaitaire égale à un demi-mois du salaire brut prévu. Elle n\'est pas due en cas de décès de l\'enfant, ou de retrait, suspension ou non-renouvellement de l\'agrément (sur justificatif).'; return res; }
  if(qui===3){ res.motifSans='Rupture pendant la période d\'essai : pas de préavis ni d\'indemnité de rupture (prévenir l\'autre partie le plus tôt possible).'; return res; }
  // décès du parent employeur ou de l'enfant : fin au jour du décès, préavis payé (il ne peut pas être fait)
  if(qui===5 || qui===6){ res.deces = true; }
  if(faute){ res.motifSans='Faute grave ou lourde : pas de préavis ni d\'indemnité de rupture. Les parents doivent pouvoir la prouver et la motiver par écrit ; en cas de contestation, c\'est le conseil de prud\'hommes qui tranche. Les congés non pris restent dus.'; return res; }
  if(!deb||!notif) return res;
  res.mois = monthsBetween(deb, notif);
  const p = R('preavis', notif) || [{jours:8},{jours:15},{mois:1}];
  const t = res.mois < 3 ? p[0] : res.mois < 12 ? p[1] : p[2];
  if(t.mois){ res.moisP=t.mois; res.fin = addDays(addMonths(notif, t.mois), -1); }
  else { res.jours=t.jours; res.fin = addDays(notif, t.jours-1); }
  return res;
}
VIS.fin = ()=>{
  const inc = seg('fin-type')===1;
  show('fin-faute-row', seg('fin-qui')===0, 'flex');
  const quiV = seg('fin-qui'), deces = quiV===5 || quiV===6;
  show('fin-retraite-wrap', quiV===7);
  setTxt('fin-notif-label', deces ? 'Date du décès' : quiV===7 ? 'Date d\'envoi / de remise de votre lettre de départ' : 'Date d\'envoi / de remise de la lettre');
  setTxt('fin-notif-hint', deces ? 'Le contrat s\'arrête ce jour-là. Un proche (ayant droit) doit vous prévenir par écrit ; les documents de fin de contrat sont à remettre sous 30 jours.' : 'Le préavis commence le jour de la première présentation de la lettre.');
  const pr = finPreavis();
  show('fin-preavis-row', seg('fin-qui')===0 && !pr.motifSans && (pr.jours||pr.moisP), 'flex');
  show('fin-entretien-wrap', seg('fin-entretien')===1); show('row-fin-entretien', seg('fin-entretien')===1, 'flex');
  show('fin-cp-wrap', seg('fin-cp')===1); show('fin-cp-results', seg('fin-cp')===1);
  show('fin-rupture-wrap', seg('fin-rupture')===1); show('fin-rupture-results', seg('fin-rupture')===1);
  // Régularisation : textes selon le type de contrat
  setTxt('fin-regul-question', inc ? 'Calculer la régularisation de fin de contrat (obligatoire en année incomplète) ?' : 'Une régularisation est-elle nécessaire à titre exceptionnel ?');
  setTxt('fin-regul-hint', inc ? 'Compare le salaire mensualisé versé aux heures réellement effectuées ; indispensable s\'il y a eu un avenant.' : 'En année complète, pas de régularisation de principe : la mensualisation couvre exactement les heures dues. Seulement en cas de rythmes variables ou d\'avenant appliqué en retard.');
  const regul = seg('fin-regul')===1;
  show('fin-regul-wrap', regul);
  const warn = $('fin-regul-warn');
  if(!inc){ warn.style.display='block'; warn.innerHTML='<strong>Rappel —</strong> en année complète, aucune régularisation n\'est due de plein droit. Répondez aux deux questions pour vérifier si votre situation est un cas particulier.'; }
  else { warn.style.display='none'; }
  show('fin-regul-qualify', regul && !inc);
  const ok = regul && finRegulApplicable();
  show('fin-regul-notapplicable', regul && !ok);
  setHTML('fin-regul-notapplicable', '<strong>Régularisation non nécessaire —</strong> d\'après vos réponses, la mensualisation couvre déjà exactement les heures dues.');
  show('fin-regul-details', ok); show('fin-regul-results', ok);
  const av = seg('fin-regul-avenants')===1, nb = av ? seg('fin-regul-nbav')+1 : 0;
  show('fin-regul-nbav-wrap', av, 'flex');
  for(let i=1;i<=4;i++) show('fin-regul-av'+i+'-block', i<=nb);
  setTxt('fin-regul-base-label', av ? 'Avant le 1er avenant' : 'Sur toute la période');
  setTxt('fin-regul-verse-label', av ? 'Total des salaires mensualisés versés avant le 1er avenant (€)' : 'Total des salaires mensualisés versés sur la période (€)');
  setTxt('fin-regul-heures-label', av ? 'Heures réellement effectuées avant le 1er avenant' : 'Total des heures réellement effectuées sur la période');
};
PREFILL.fin = c=>{
  setVal('fin-notif', iso(today()));
  if(!c) return;
  const dv = derive(c);
  setSegVal('fin-type', c.type);
  setVal('fin-debut', c.debut);
  if(c.fin) setVal('fin-regul-fin', c.fin);
  setVal('fin-salaire', round2(dv.brut)); setVal('fin-taux', round2(dv.tauxEff)); setVal('fin-heures', round2(dv.moyH));
  setVal('fin-regul-taux', round2(dv.tauxEff));
  const fin = parseD(c.fin) || today();
  const d12 = addMonths(fin, -12), deb = parseD(c.debut);
  setVal('fin-regul-debut', iso(deb && deb>d12 ? deb : addDays(d12,1)));
  if(!c.fin) setVal('fin-regul-fin', iso(fin));
  setSegVal('fin-regul', c.type===1 ? 1 : 0);
  if(c.ieMode===0 || c.ieMode===1){ setSegVal('fin-entretien', 1); setVal('fin-entretien-montant', round2(dv.ieMois)); }
  // Reprise automatique de l'historique des mois validés : rien à recalculer
  const J = journalTotals(c.id), rp = c.rep || {};
  if(J.n || rp.cumulBrut){
    setVal('fin-rupture-total', round2(J.brut - J.cpMontant + (parseFloat(rp.cumulBrut)||0)));
    const Rg = journalTotals(c.id, val('fin-regul-debut').slice(0,7), val('fin-regul-fin').slice(0,7));
    if(Rg.n || rp.regulVerse){ setVal('fin-regul-verse', round2(Rg.brutMensu + (parseFloat(rp.regulVerse)||0))); setVal('fin-regul-heures', round2(Rg.hContrat + (parseFloat(rp.regulHeures)||0))); }
    if(rp.regulVerse && parseD(rp.date)) setVal('fin-regul-debut', c.debut);
    const N = journalTotals(c.id, isoMonth(cpRefStart(parseD(c.fin)||today())));
    setVal('fin-total-salaires', round2(N.brut - N.cpMontant));
  }
  // Avenants enregistrés pendant la période de régularisation : une sous-période par avenant
  const rd = val('fin-regul-debut'), rf = val('fin-regul-fin');
  const avs = (c.hist||[]).map(h=>h.avenantDu).filter(x=>x && x>rd && x<=rf).sort().slice(0,4);
  if(avs.length){
    setSegVal('fin-regul-avenants', 1); setSegVal('fin-regul-nbav', avs.length-1);
    const bornes = [rd].concat(avs), mois = x=>x.slice(0,7);
    // un mois coupé par un avenant est compté entièrement dans la période où il commence
    const debM = x=>{ const d=parseD(x); return d.getDate()===1 ? isoMonth(d) : isoMonth(new Date(d.getFullYear(), d.getMonth()+1, 1)); };
    bornes.forEach((deb, i)=>{
      const fin = i<avs.length ? isoMonth(new Date(parseD(debM(avs[i])).getFullYear(), parseD(debM(avs[i])).getMonth()-1, 1)) : mois(rf);
      const T = journalTotals(c.id, i===0 ? mois(deb) : debM(deb), fin), taux = round2(derive(c, parseD(deb)).tauxEff);
      if(i===0){ setVal('fin-regul-verse', round2(T.brutMensu)); setVal('fin-regul-heures', round2(T.hContrat)); setVal('fin-regul-taux', taux); }
      else { setVal('fin-regul-av'+i+'-date', deb); setVal('fin-regul-av'+i+'-verse', round2(T.brutMensu)); setVal('fin-regul-av'+i+'-heures', round2(T.hContrat)); setVal('fin-regul-av'+i+'-taux', taux); }
    });
  }
  const cpd = cpDispoFor(c);
  if(cpd !== null){ setSegVal('fin-cp', cpd>0 ? 1 : 0); setVal('fin-jours', round2(cpd)); }
  // Année incomplète payée par 12ᵉ : les congés sont déjà payés chaque mois
  if(c.type===1 && c.cpMode===0){ setSegVal('fin-cp', 0); }
  finAutoRupture();
};
/* Jours de congés restants d'un contrat : calcul « Congés payés » enregistré s'il existe,
   sinon périodes du contrat et jours de congés notés dans les mois validés */
function cpDispoFor(c){
  const f = STATE.forms.cp && STATE.forms.cp[c.id];
  if(!f){
    // Sans calcul « Congés payés » enregistré : seule la période en cours est reprise (les périodes
    // précédentes sont normalement prises ou payées) ; les reliquats éventuels sont à vérifier.
    const Pn = cpRefPeriods(Object.assign({}, c, {fin: iso(parseD(c.fin) || today())})).find(x=>x.k==='n');
    if(!Pn || !Pn.s) return 0;
    const acquis = joursAcquisCP(iso(Pn.s), iso(Pn.e), 0, false);
    const rp = c.rep || {};
    // congés notés dans le suivi au jour le jour, sinon ceux des mois validés
    const S = (STATE.suivi||{})[c.id], sCP = S ? Object.keys(S.days||{}).filter(k=>k>=iso(Pn.s) && k<=iso(Pn.e) && (ST[S.days[k].st]||{}).cp).length : 0;
    const pris = Math.max(sCP, journalTotals(c.id, isoMonth(Pn.s), isoMonth(Pn.e)).jCP) + (parseFloat(rp.cpPrisN)||0);
    return Math.max(0, acquis - pris + (parseFloat(rp.cpReliquat)||0));
  }
  const P = cpRefPeriods(Object.assign({}, c, {fin: iso(parseD(c.fin) || today())}));
  const order = ['n2','n1','n'], pools = {};
  order.forEach(k=>{
    const p = P.find(x=>x.k===k);
    const deb = f ? (f.i['cp-'+k+'-debut']||'') : (p.s ? iso(p.s) : ''), end = f ? (f.i['cp-'+k+'-fin']||'') : (p.e ? iso(p.e) : '');
    pools[k] = joursAcquisCP(deb, end, f ? parseFloat(f.i['cp-'+k+'-mal'])||0 : 0, false);
    let pris = f ? parseFloat(f.i['cp-'+k+'-solde'])||0 : (deb && end ? journalTotals(c.id, deb.slice(0,7), end.slice(0,7)).jCP : 0);
    for(const kk of order){ if(pools[kk]===undefined) continue; const u = Math.min(pools[kk], pris); pools[kk] -= u; pris -= u; }
  });
  const rest = Object.values(pools).reduce((a,b)=>a+b, 0);
  return isNaN(rest) ? null : rest;
}
function finAutoRupture(){
  const pr = finPreavis();
  const min = R('ruptureAnciennete');
  // retrait de l'enfant ou décès du parent employeur : à partir de 9 mois ; décès de l'enfant : sans condition d'ancienneté
  const due = (pr.qui===0 && !pr.faute && pr.mois!==null && pr.mois >= min) || (pr.qui===5 && pr.mois!==null && pr.mois >= min) || pr.qui===6;
  if(pr.mois!==null || pr.qui!==0) setSegVal('fin-rupture', due ? 1 : 0);
  if(pr.qui===5 || pr.qui===6){
    setTxt('fin-rupture-hint', pr.qui===6 ? '✔ Due en cas de décès de l\'enfant, quelle que soit l\'ancienneté (calculée comme pour un retrait).' : (due ? '✔ Due (décès du parent employeur, ancienneté d\'au moins '+min+' mois) : payée par la succession.' : '✘ Pas due : ancienneté inférieure à '+min+' mois.'));
    return;
  }
  setTxt('fin-rupture-hint', pr.qui!==0 || pr.faute
    ? 'Pas d\'indemnité de rupture dans cette situation (seulement quand les parents retirent l\'enfant, hors faute grave).'
    : pr.mois===null ? 'Due par les parents qui retirent l\'enfant après au moins '+min+' mois de contrat, sauf faute grave ou lourde.'
    : (due ? '✔ Due : '+ancienneteTxt(val('fin-debut'), val('fin-notif'))+' d\'ancienneté (minimum '+min+' mois).' : '✘ Pas due : ancienneté de '+ancienneteTxt(val('fin-debut'), val('fin-notif'))+' (il faut au moins '+min+' mois).'));
}
function finEstimeTotal(){
  const k = selKey('fin'), c = k!=='libre' ? getContrat(k) : null;
  if(!c || !c.debut){ toast('Choisissez un enfant enregistré avec une date de début.'); return; }
  const deb = parseD(c.debut), end = parseD(val('fin-notif')) || today();
  let tot = 0, d = new Date(deb.getFullYear(), deb.getMonth(), 1);
  while(d <= end){
    const dv = derive(c, d);
    const dim = daysInMonth(d.getFullYear(), d.getMonth());
    let part = 1;
    if(d.getFullYear()===deb.getFullYear() && d.getMonth()===deb.getMonth()) part = (dim-deb.getDate()+1)/dim;
    if(d.getFullYear()===end.getFullYear() && d.getMonth()===end.getMonth()) part = Math.min(part, end.getDate()/dim);
    tot += dv.brut*part;
    d = new Date(d.getFullYear(), d.getMonth()+1, 1);
  }
  setVal('fin-rupture-total', round2(tot)); CALC.fin(); persistTheme('fin');
  toast('Estimation : '+fmtEUR(tot)+'. Vérifiez avec le cumul Pajemploi (absences, heures en plus, augmentations…).');
}
function toBrutFin(x){ return seg('fin-unite')===1 ? x/netRatio() : x; }
CALC.fin = ()=>{
  if(document.activeElement && ['fin-debut','fin-notif'].includes(document.activeElement.id)) finAutoRupture();
  const pr = finPreavis();
  // Préavis
  let piTxt;
  if(pr.motifSans) piTxt = pr.motifSans;
  else if(!pr.deb || !pr.notif) piTxt = 'Indiquez la date de début du contrat et la date de la lettre pour connaître le préavis.';
  else {
    const dur = pr.moisP ? pr.moisP+' mois' : pr.jours+' jours calendaires';
    piTxt = 'Ancienneté : <b>'+ancienneteTxt(val('fin-debut'), val('fin-notif'))+'</b>. Préavis : <b>'+dur+'</b>'+(pr.fin?', jusqu\'au <b>'+pr.fin.toLocaleDateString('fr-FR')+'</b> inclus':'')+'.'
      + (pr.qui===1 || pr.qui===7 ? ' C\'est vous qui devez ce préavis à la famille.' : '')
      + (pr.deces ? ' Il ne peut pas être effectué : il est payé (indemnité compensatrice). Les sommes sont dues par '+(pr.qui===5?'la succession (le notaire rembourse la personne qui les avance)':'les parents')+'.' : '');
  }
  setHTML('fin-preavis-info', piTxt);
  const salaire = toBrutFin(num('fin-salaire'));
  setTxt('out-fin-salaire', salaire ? fmtEUR(salaire) : '—');
  let ipr = 0;
  const dispense = ((pr.qui===0 && seg('fin-preavis-fait')===1) || pr.deces) && !pr.motifSans && (pr.jours||pr.moisP);
  if(dispense) ipr = pr.moisP ? salaire*pr.moisP : salaire*pr.jours/30;
  show('row-fin-preavis', !!dispense, 'flex'); setTxt('out-fin-preavis', fmtEUR(ipr));
  // départ à la retraite : estimation de l'indemnité IRCEM (non payée par les parents, donc hors total)
  if(pr.qui===7){
    const tot = num('fin-ret-mois'), rec = num('fin-ret-recents'), sal = num('fin-ret-salaire'), b = R('retraiteBareme') || [1,1.5,2,2.5];
    const k = tot>=360 ? b[3] : tot>=240 ? b[2] : tot>=180 ? b[1] : tot>=120 ? b[0] : 0;
    const ok = k && rec>=60;
    show('row-fin-retraite', true, 'flex');
    setTxt('out-fin-retraite', !tot ? '—' : ok ? fmtEUR(k*sal)+' ('+k+' mois)' : tot<120 ? 'pas de droit (moins de 120 mois)' : 'pas de droit (moins de 60 mois sur 7 ans)');
  } else show('row-fin-retraite', false);
  // engagement réciproque rompu avant le premier jour : ½ mois du salaire brut prévu (non soumis à cotisations)
  const engag = pr.qui===4 ? salaire/2 : 0;
  show('row-fin-engag', pr.qui===4, 'flex'); setTxt('out-fin-engag', fmtEUR(engag));
  const ent = seg('fin-entretien')===1 ? num('fin-entretien-montant') : 0;
  setTxt('out-fin-entretien-r', fmtEUR(ent));
  let cpV = 0;
  if(seg('fin-cp')===1){
    const vj = (num('fin-heures')/6)*toBrutFin(num('fin-taux'));
    const mt = num('fin-jours')*vj, dx = toBrutFin(num('fin-total-salaires'))*0.10;
    cpV = Math.max(mt, dx);
    setTxt('out-fin-maintien', fmtEUR(mt)); setTxt('out-fin-dixieme', fmtEUR(dx)); setTxt('out-fin-cp', fmtEUR(cpV));
    setTxt('fin-badge', mt>=dx ? 'Maintien' : 'Dixième');
  }
  let ecart = 0;
  if(seg('fin-regul')===1 && finRegulApplicable()){
    const pd=val('fin-regul-debut'), pf=val('fin-regul-fin');
    setTxt('out-fin-periode', pd&&pf ? fmtDate(pd)+' → '+fmtDate(pf) : '—');
    const av = seg('fin-regul-avenants')===1, nb = av ? seg('fin-regul-nbav')+1 : 0;
    const vB=toBrutFin(num('fin-regul-verse')), hB=num('fin-regul-heures'), tB=toBrutFin(num('fin-regul-taux'));
    let du=hB*tB, verse=vB; const rows=[{l:'Avant le 1er avenant', du:hB*tB, v:vB}];
    for(let i=1;i<=nb;i++){
      const v=toBrutFin(num('fin-regul-av'+i+'-verse')), h=num('fin-regul-av'+i+'-heures'), t=toBrutFin(num('fin-regul-av'+i+'-taux')), d=val('fin-regul-av'+i+'-date');
      du+=h*t; verse+=v; rows.push({l:'Avenant n°'+i+(d?' (depuis le '+fmtDate(d)+')':''), du:h*t, v});
    }
    ecart = du - verse;
    setHTML('fin-regul-detail', av ? rows.map(r=>{ const e=r.du-r.v; return '<div class="result-line'+(e<0?' warn':'')+'"><span class="lbl">'+r.l+' : dû '+fmtEUR(r.du)+' / versé '+fmtEUR(r.v)+'<span class="badge '+(e>=0?'ok':'warn')+'">'+(e>=0?'Rappel dû':'Trop-perçu')+'</span></span><span class="val">'+fmtEUR(Math.abs(e))+'</span></div>'; }).join('') : '');
    setTxt('out-fin-regul-du', fmtEUR(du)); setTxt('out-fin-regul-verse-r', fmtEUR(verse)); setTxt('out-fin-regul-ecart', fmtEUR(Math.abs(ecart)));
    const b=$('fin-regul-badge'), row=$('row-fin-regul-ecart'); row.classList.remove('warn');
    if(ecart>=0){ b.textContent='Rappel dû'; b.className='badge ok'; }
    else { b.textContent='Trop-perçu'; b.className='badge warn'; row.classList.add('warn'); }
  }
  // un trop-perçu n'est pas déduit d'office du solde de tout compte
  const ecartRetenu = Math.max(0, ecart);
  let rup = 0;
  if(seg('fin-rupture')===1){ rup = toBrutFin(num('fin-rupture-total'))/R('ruptureDiviseur'); setTxt('out-fin-rupture', fmtEUR(rup)); }
  // avant le début de l'accueil : ni salaire, ni congés, ni entretien — seule l'indemnité forfaitaire est due
  const avant = pr.qui===4;
  const cot = avant ? 0 : salaire + ipr + cpV + ecartRetenu, nonCot = (avant ? 0 : ent + rup) + engag;
  const any = cot || nonCot;
  setTxt('out-fin-total', any ? fmtEUR(cot+nonCot) : '—');
  if(typeof finNavUpdate==='function') finNavUpdate();
  setTxt('out-fin-net', any ? fmtEUR(toNet(cot)+nonCot) : '—');
};
