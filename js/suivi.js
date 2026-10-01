/* =====================================================================================
   10 · SUIVI AU JOUR LE JOUR & PRÉPARATION DE LA PAIE
   Principe : le contrat fixe le « normal » ; on ne note que les écarts et les faits générateurs
   de paie. Une journée conforme au planning = 1 appui. En fin de mois, le récapitulatif
   alimente « Salaire du mois & Pajemploi », les congés, la fin de contrat et les impôts.
   Le module est facultatif : tous les autres calculs fonctionnent sans lui.
   ===================================================================================== */
'use strict';

/* Statuts d'une journée.  acc = enfant accueilli (entretien dû) ; ded = heures prévues déduites
   (méthode Cour de cassation) ; 'mal' = déduction limitée à 5 jours / 12 mois ; cp = congé payé. */
const ST = {
  conf:     {l:'Accueil conforme au planning', g:'Accueil', c:'ok', acc:1},
  ecart:    {l:'Accueil avec écart d\'horaires', g:'Accueil', c:'ecart', acc:1},
  exc:      {l:'Accueil exceptionnel (jour non prévu, dépannage)', g:'Accueil', c:'ecart', acc:1},
  ferieTr:  {l:'Jour férié travaillé', g:'Accueil', c:'ecart', acc:1},
  adapt:    {l:'Adaptation (heures non faites déduites)', g:'Accueil', c:'ecart', acc:1, adapt:1},
  renvoye:  {l:'Enfant renvoyé malade en cours de journée', g:'Accueil', c:'ecart', acc:1},
  absPrev:  {l:'Enfant absent : congés ou absence prévue des parents', g:'Absence de l\'enfant', c:'abs', ded:0},
  absAutre: {l:'Enfant absent : autre raison (convenance)', g:'Absence de l\'enfant', c:'abs', ded:0},
  absMalC:  {l:'Enfant malade, avec certificat médical', g:'Absence de l\'enfant', c:'abs', ded:'mal'},
  absMalS:  {l:'Enfant malade, sans certificat', g:'Absence de l\'enfant', c:'abs', ded:0},
  absHosp:  {l:'Enfant hospitalisé, ou malade 14 jours et plus', g:'Absence de l\'enfant', c:'abs', ded:1},
  cpAm:     {l:'Mes congés payés', g:'Mon absence', c:'cp', ded:0, cp:1},
  malAm:    {l:'Mon arrêt maladie, accident, maternité/paternité', g:'Mon absence', c:'am', ded:1},
  sansSolde:{l:'Congé sans solde, ou absence non payée', g:'Mon absence', c:'am', ded:1},
  fermeture:{l:'Fermeture imprévue de mon côté', g:'Mon absence', c:'am', ded:1},
  evtFam:   {l:'Congé pour événement familial (payé)', g:'Mon absence', c:'am', ded:0},
  form:     {l:'Formation sur le temps d\'accueil (salaire maintenu)', g:'Mon absence', c:'am', ded:0},
  ferieCh:  {l:'Jour férié chômé (payé)', g:'Autre', c:'ferie', ded:0},
  none:     {l:'Pas d\'accueil prévu', g:'Autre', c:'none'}
};
const MONTH_ST = ['ouvert','avalider','valide','cloture','declare','paye'];
const MONTH_ST_L = {ouvert:'Ouvert', avalider:'À valider par le parent', valide:'Validé par le parent', cloture:'Clôturé', declare:'Déclaré sur Pajemploi', paye:'Payé'};
let SV = {tab:'jour', date:null, cid:null, ym:null};

function suiviOf(cid){ STATE.suivi = STATE.suivi || {}; return STATE.suivi[cid] = STATE.suivi[cid] || {days:{}, months:{}, regs:[]}; }
function dayRec(cid, k){ return ((STATE.suivi||{})[cid]||{days:{}}).days[k] || null; }
function monthRec(cid, ym){ const s = suiviOf(cid); return s.months[ym] = s.months[ym] || {st:'ouvert'}; }
function monthLocked(cid, ym){ const m = ((STATE.suivi||{})[cid]||{months:{}}).months[ym]; return !!(m && ['valide','cloture','declare','paye'].includes(m.st)); }
function suiviDebut(c){ return parseD((c.rep && c.rep.date) || c.debut); }

/* Planning du jour (selon l'avenant en vigueur ce jour-là) — sans tenir compte des dates du contrat */
function plannedDay(c, d){
  const cc = paramsAt(c, d);
  if(semaineSansAccueil(cc, d)) return {min:0, s:'', e:''};
  const B = weekIsB(cc, d), i = dowIdx(d);
  const h = wNums(B && cc.alterne ? cc.wB : cc.wA)[i] || 0;
  const t = cc.horaires ? (((B && cc.alterne ? cc.tB : cc.tA)||[])[i]||null) : null;
  return {min: Math.round(h*60), s: t ? (t[0]||'') : '', e: t ? (t[1]||'') : ''};
}
function inContract(c, d){ const a=parseD(c.debut), b=parseD(c.fin); return !(a && d<a) && !(b && d>b); }

/* Jours d'absence pour maladie (certificat) déjà déduits dans l'année du contrat (date anniversaire) */
function malCountBefore(c, d){
  const deb = parseD(c.debut); if(!deb) return 0;
  let anniv = new Date(d.getFullYear(), deb.getMonth(), deb.getDate());
  if(anniv > d) anniv = new Date(d.getFullYear()-1, deb.getMonth(), deb.getDate());
  const days = (suiviOf(c.id).days)||{};
  let n = 0;
  Object.keys(days).forEach(k=>{ const r=days[k]; if(r.st==='absMalC' && k >= iso(anniv) && k < iso(d)) n++; });
  const rep = c.rep||{};
  if(rep.mal && parseD(rep.date) && parseD(rep.date) >= anniv) n += parseFloat(rep.mal)||0;
  return n;
}

/* Une journée : minutes prévues, réelles, déduites, indemnités */
function calcDay(c, d, k){
  const pl = plannedDay(c, d), inC = inContract(c, d), r = dayRec(c.id, k);
  const sd = suiviDebut(c);
  let st = r ? r.st : (!inC ? 'hors' : (sd && d < sd) ? 'avant' : (pl.min ? 'todo' : 'none'));
  const def = ST[st] || {};
  const P = inC ? pl.min : 0;
  let real = 0;
  const acc = !!def.acc || st==='avant' || st==='todo';   // « à renseigner » : estimé conforme
  if(acc){
    const a = hmToMin(r && r.a), b = hmToMin(r && r.dep);
    if(r && a!==null && b!==null && b>a) real = b - a - (parseFloat(r.pause)||0);
    else if(r && r.duree) real = Math.round(parseFloat(r.duree)*60);
    else real = st==='exc' ? 0 : P;
  }
  let ded = 0, dedNote = '';
  if(def.ded===1) ded = P;
  else if(def.ded==='mal'){
    if(malCountBefore(c, d) < R('absMaladieEnfant', d)) ded = P;
    else dedNote = 'au-delà des '+R('absMaladieEnfant', d)+' jours : salaire dû';
  }
  if(def.adapt) ded = Math.max(0, P - real);
  // Indemnités du jour
  const cc = paramsAt(c, d);
  let ie = 0;
  if(acc && real>0 && st!=='avant'){
    const leg = ieLegalJour(real/60, d);
    ie = (cc.ieMode===1 && parseFloat(cc.ieMontant)) ? Math.max(parseFloat(cc.ieMontant), leg) : leg;
  }
  const rep = r && r.rep ? r.rep : {};
  const nbRepas = ['pdj','dej','gou','din'].filter(x=>rep[x]).length;
  const repas = (cc.repasMode===1 && nbRepas && acc) ? (parseFloat(cc.repasPrix)||0) : 0;
  const km = r ? (parseFloat(r.km)||0) : 0, kmEur = km*(parseFloat(cc.kmTaux)||0);
  const frais = r && Array.isArray(r.frais) ? r.frais.reduce((s,f)=>s+(parseFloat(f.montant)||0),0) : 0;
  const ferie = ferieName(d);
  const plEnd = hmToMin(pl.e), dep = hmToMin(r && r.dep);
  const retard = !!(acc && r && plEnd!==null && dep!==null && dep > plEnd+5);
  return {d, k, st, def, P, R: acc ? Math.max(0, real) : 0, acc: acc && st!=='hors', ded, dedNote, ie, repas, nbRepas, km, kmEur, frais, ferie, retard, r, pl, inC};
}

/* Le mois complet : répartition hebdomadaire des heures en plus, salaire (méthode Cour de cassation), totaux */
function suiviMonth(c, ym){
  const d0 = parseD(ym), y = d0.getFullYear(), m = d0.getMonth(), nb = daysInMonth(y, m);
  const last = new Date(y, m, nb);
  // calcul sur les semaines complètes qui touchent le mois (une semaine à cheval sur deux mois est traitée en entier)
  const days = [];
  for(let d = mondayOf(d0); d <= addDays(mondayOf(last), 6); d = addDays(d,1)) days.push(calcDay(c, d, iso(d)));
  const seuil = 60*(R('seuilMaj', d0)||45);
  for(let w=0; w<days.length; w+=7){
    const wk = days.slice(w, w+7);
    // Heures en plus = heures faites au-delà du planning de chaque jour (une absence, payée ou non,
    // ne « compense » jamais une heure travaillée en plus). Majorées : au-delà de 45 h réellement
    // travaillées dans la semaine (seuil relevé si le contrat prévoit déjà des heures majorées).
    const Pw = wk.reduce((s,x)=>s+x.P,0), thr = Math.max(seuil, Pw);
    let cum = 0;
    wk.forEach(x=>{
      x.extra = x.acc ? Math.max(0, x.R - x.P) : 0;
      const cb = cum, ca = cum + x.R; cum = ca;
      x.maj = Math.min(x.extra, Math.max(0, ca-thr) - Math.max(0, cb-thr));
      x.compl = x.extra - x.maj;
    });
  }
  const md = days.filter(x=>x.d.getMonth()===m);
  const T = {hPrev:0, hDed:0, hOut:0, compl:0, maj:0, R:0, jAcc:0, jPrev:0, jDed:0, cp:0, cpOuv:0, ie:0, repas:0, nbRepas:0, km:0, kmEur:0, frais:0,
    ferieMin:0, mai1Min:0, retards:0, todo:0, j8:0, hm8:0, inC:0};
  const versions = {};
  md.forEach(x=>{
    const plFull = plannedDay(c, x.d).min;
    const vkey = JSON.stringify(paramsOf(paramsAt(c, x.d)));
    versions[vkey] = versions[vkey] || {d:x.d, hPlan:0, hDed:0};
    versions[vkey].hPlan += plFull;
    T.hPrev += plFull;
    if(!x.inC){ T.hOut += plFull; versions[vkey].hDed += plFull; return; }
    T.inC++;
    if(x.P) T.jPrev++;
    T.hDed += x.ded; versions[vkey].hDed += x.ded;
    if(x.ded && x.ded >= x.P && x.P) T.jDed++;
    T.compl += x.compl||0; T.maj += x.maj||0; T.R += x.R;
    if(x.acc && x.R>0 && x.st!=='avant'){ T.jAcc++; if(x.R >= 60*(R('abatHeuresJour', x.d)||8)) T.j8++; else T.hm8 += x.R/60; }
    if(x.def.cp) T.cp++;
    T.ie += x.ie; T.repas += x.repas; T.nbRepas += x.nbRepas; T.km += x.km; T.kmEur += x.kmEur; T.frais += x.frais;
    if(x.acc && x.ferie && x.R){ if(x.ferie==='1er mai') T.mai1Min += x.R; else T.ferieMin += x.R; }
    if(x.retard) T.retards++;
    if(x.st==='todo' && x.d < today()) T.todo++;
  });
  // congés en jours ouvrables : une semaine entière de congés compte 6 jours
  for(let w=0; w<days.length; w+=7){
    const wk = days.slice(w,w+7).filter(x=>x.d.getMonth()===m && x.inC);
    const pl = wk.filter(x=>x.P>0), cp = wk.filter(x=>x.def.cp);
    if(cp.length && cp.length===pl.length) T.cpOuv += wk.filter(x=>dowIdx(x.d)<6).length;
    else T.cpOuv += cp.length;
  }
  // salaire mensualisé dû (méthode Cour de cassation, ventilé par avenant)
  const vs = Object.values(versions);
  let due = 0, base = 0;
  vs.forEach(v=>{ const b = derive(c, v.d).brutBase; base += T.hPrev ? b*v.hPlan/T.hPrev : b/vs.length;
    if(T.hPrev) due += b*(v.hPlan - v.hDed)/T.hPrev; });
  if(!T.hPrev){ // mois sans aucun jour d'accueil prévu (vacances en année incomplète) : la mensualisation reste due
    const dv = derive(c, last); base = dv.brutBase;
    due = T.inC ? base*T.inC/nb : 0;
  }
  const dvEnd = derive(c, last), taux = dvEnd.tauxEff, majPct = dvEnd.majPct;
  const complPay = T.compl/60*taux, majPay = T.maj/60*taux*(1+majPct/100);
  const ferieSup = T.ferieMin/60*taux*R('majFerie', d0)/100 + T.mai1Min/60*taux*R('majPremierMai', d0)/100;
  const regs = (suiviOf(c.id).regs||[]).filter(g=>g.imput===ym);
  const regBrut = regs.reduce((s,g)=>s+(parseFloat(g.montant)||0),0);
  const cc = paramsAt(c, last);
  const cp12 = (cc.type===1 && cc.cpMode===0) ? (due+complPay+majPay+ferieSup)*0.10 : 0;
  const brut = due + complPay + majPay + ferieSup + regBrut + cp12;
  const ratio = netRatio(d0), red = R('hsReduction', d0)||0;
  const net = (due + ferieSup + regBrut + cp12)*ratio + (complPay+majPay)*Math.min(1, ratio+red);
  return {c, ym, days: md, T, base, due, taux, majPct, complPay, majPay, ferieSup, regs, regBrut, cp12, brut, net, dv: dvEnd, versions: vs.length};
}

/* Vérifications avant clôture (non bloquantes) */
function suiviChecks(M){
  const out = [], c = M.c;
  if(M.T.todo) out.push({ok:false, t:M.T.todo+' journée(s) passée(s) à renseigner'});
  M.days.forEach(x=>{
    const r = x.r; if(!r) return;
    const a = hmToMin(r.a), b = hmToMin(r.dep);
    if(a!==null && b!==null && b<=a) out.push({ok:false, t:fmtDate(x.k)+' : départ avant l\'arrivée'});
    if(x.R > 60*R('hMaxJour', x.d)) out.push({ok:false, t:fmtDate(x.k)+' : plus de '+R('hMaxJour', x.d)+' h d\'accueil (repos de 11 h non respecté)'});
    if(x.st==='exc' && !r.note && !(r.preuves||[]).length) out.push({ok:false, t:fmtDate(x.k)+' : accueil exceptionnel sans trace de l\'accord des parents'});
    if(x.st==='absMalC' && !(r.preuves||[]).length && !r.certif) out.push({ok:false, t:fmtDate(x.k)+' : certificat médical non noté'});
    if(x.def.cp && x.ferie) out.push({ok:false, t:fmtDate(x.k)+' : congé posé sur un jour férié ('+x.ferie+')'});
    if(x.def.cp && paramsAt(c, x.d).type===1 && x.P) out.push({ok:false, t:fmtDate(x.k)+' : en année incomplète, les congés se prennent normalement pendant les semaines sans accueil'});
    if((r.frais||[]).some(f=>!f.pj)) out.push({ok:false, t:fmtDate(x.k)+' : frais sans justificatif'});
    if(x.km && !(parseFloat(paramsAt(c,x.d).kmTaux)>0)) out.push({ok:false, t:fmtDate(x.k)+' : kilomètres notés mais pas de tarif au kilomètre dans le contrat'});
  });
  if(M.T.retards >= 3) out.push({ok:false, t:M.T.retards+' dépassements de l\'heure de départ ce mois-ci : pensez à en parler (ou à un avenant)'});
  for(let w=0; w<M.days.length; w++){ /* durée hebdomadaire contrôlée dans les alertes globales */ }
  if(M.versions>1) out.push({ok:true, t:'Avenant en cours de mois : salaire ventilé sur les deux périodes'});
  if(!out.length) out.push({ok:true, t:'Tout est cohérent'});
  return out;
}

/* ---------------------------------- Écran ---------------------------------- */
function suiviContrats(){ return STATE.contrats.filter(c=>!contratTermine(c) || (today()-parseD(c.fin))/86400000 < 100); }
function openSuivi(tab, cid, ym){ if(tab) SV.tab = tab; if(cid) SV.cid = cid; if(ym) SV.ym = ym; showTheme('suivi'); }
function suiviRefresh(){ if(CURRENT==='home') renderHome(); else renderSuivi(); }
function renderSuivi(){
  const list = suiviContrats();
  if(!SV.date) SV.date = iso(today());
  if(!SV.cid || !getContrat(SV.cid)) SV.cid = list[0] ? list[0].id : (STATE.contrats[0]||{}).id;
  if(!SV.ym) SV.ym = curMonth();
  const tabs = [['jour','Aujourd\'hui'],['cal','Calendrier'],['mois','Mois'],['cpt','Compteurs']];
  let h = '<div class="chips" style="margin-bottom:14px">'+tabs.map(t=>'<button type="button" class="chip'+(SV.tab===t[0]?' on':'')+'" onclick="SV.tab=\''+t[0]+'\';renderSuivi()">'+t[1]+'</button>').join('')+'</div>';
  if(!STATE.contrats.length){ setHTML('suivi-content', h+'<div class="info-box">Enregistrez d\'abord un enfant (accueil ▸ « Ajouter un enfant »). Le suivi part du planning de son contrat.</div>'); return; }
  if(SV.tab==='jour') h += renderJour(list);
  else {
    h += '<div class="chips" style="margin-bottom:12px">'+STATE.contrats.map(c=>'<button type="button" class="chip'+(SV.cid===c.id?' on':'')+'" onclick="SV.cid=\''+c.id+'\';renderSuivi()">'+esc(c.enfant||'Enfant')+(contratTermine(c)?' (terminé)':'')+'</button>').join('')+'</div>';
    const c = getContrat(SV.cid);
    if(SV.tab==='cal') h += renderCal(c);
    if(SV.tab==='mois') h += renderMoisSuivi(c);
    if(SV.tab==='cpt') h += renderCompteurs(c);
  }
  setHTML('suivi-content', h);
}

/* --- Aujourd'hui : un bloc par enfant, « Conforme » en 1 appui --- */
function renderJour(list){
  const d = parseD(SV.date), k = SV.date, isToday = k===iso(today());
  let h = '<div class="box" style="display:flex;align-items:center;gap:8px;justify-content:space-between">'
    + '<button class="icon-btn" onclick="SV.date=iso(addDays(parseD(SV.date),-1));suiviRefresh()" aria-label="Jour précédent">‹</button>'
    + '<div style="text-align:center"><b>'+d.toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'long'})+'</b>'+(isToday?'':'<br><a href="#" onclick="SV.date=iso(today());suiviRefresh();return false;">revenir à aujourd\'hui</a>')+(ferieName(d)?'<br><span class="pill">'+esc(ferieName(d))+'</span>':'')+(isVacances(d)?' <span class="pill inc">vacances scolaires</span>':'')+'</div>'
    + '<button class="icon-btn" onclick="SV.date=iso(addDays(parseD(SV.date),1));suiviRefresh()" aria-label="Jour suivant">›</button></div>';
  let nbConf = 0;
  const cards = list.filter(c=>inContract(c, d)).map(c=>{
    const x = calcDay(c, d, k), locked = monthLocked(c.id, k.slice(0,7));
    const prev = x.P ? 'Prévu : '+(x.pl.s && x.pl.e ? x.pl.s+' – '+x.pl.e+' · ' : '')+fmtH(x.P) : 'Pas d\'accueil prévu';
    let etat;
    if(x.st==='todo'){ nbConf++; etat = '<span class="pill">à renseigner</span>'; }
    else if(x.st==='avant') etat = '<span class="pill off">avant le suivi</span>';
    else etat = '<span class="pill st-'+(x.def.c||'none')+'">'+esc((ST[x.st]||{}).l||x.st)+'</span>'
      + (x.r && x.r.a ? ' <span class="hint">'+esc(x.r.a)+' – '+esc(x.r.dep||'?')+'</span>' : '') + (x.r && x.r.late ? ' <span class="badge">saisi après coup</span>' : '');
    return '<div class="kid" style="margin-bottom:10px"><div class="kname">'+esc(c.enfant||'Enfant')+'</div>'
      + '<div class="kfam">'+esc(prev)+'</div><div style="margin:6px 0">'+etat+'</div>'
      + (locked ? '<div class="hint">Mois clôturé : modification par régularisation (onglet Mois).</div>' :
        '<div class="kactions">'
        + (x.P && x.st!=='conf' ? '<button class="btn small primary" onclick="suiviConforme(\''+c.id+'\',\''+k+'\')">✔ Conforme</button>' : '')
        + '<button class="btn small" onclick="dayEdit(\''+c.id+'\',\''+k+'\')">'+(x.r?'✎ Modifier':'✎ Écart / absence')+'</button></div>')
      + '</div>';
  }).join('');
  h += cards || '<div class="info-box">Aucun contrat en cours ce jour-là.</div>';
  if(nbConf > 1) h += '<button class="btn primary block" onclick="suiviToutConforme(\''+k+'\')">✔ Tout conforme au planning ('+nbConf+' enfants)</button>';
  h += '<p class="hint" style="margin-top:12px">Ne notez que ce qui change par rapport au planning : un appui sur « Conforme » suffit pour une journée normale. Les jours passés peuvent être saisis après coup (ils sont alors marqués comme tels).</p>';
  h += '<div class="btn-row"><button class="btn small" onclick="downloadICS()">🔔 Ajouter les rappels à mon agenda</button></div>';
  return h;
}
function stampRec(r, k){
  r.ts = new Date().toISOString();
  if(k < iso(today())) r.late = true;
  return r;
}
function suiviConforme(cid, k){
  const c = getContrat(cid), d = parseD(k);
  if(monthLocked(cid, k.slice(0,7))){ toast('Mois clôturé : passez par une régularisation.'); return; }
  const pl = plannedDay(c, d), cc = paramsAt(c, d);
  const r = {st: ferieName(d) ? 'ferieTr' : 'conf', a: pl.s, dep: pl.e};
  if(cc.repasMode===1) r.rep = {dej:true, gou:true};
  suiviOf(cid).days[k] = stampRec(r, k);
  saveState(); suiviRefresh();
  toast((c.enfant||'Journée')+' : conforme.', {label:'Annuler', fn:()=>{ delete suiviOf(cid).days[k]; saveState(); suiviRefresh(); }});
}
function suiviToutConforme(k){
  const d = parseD(k); let n=0;
  suiviContrats().forEach(c=>{ if(inContract(c,d) && !dayRec(c.id,k) && plannedDay(c,d).min && !monthLocked(c.id, k.slice(0,7))){ const pl=plannedDay(c,d), cc=paramsAt(c,d); const r={st: ferieName(d)?'ferieTr':'conf', a:pl.s, dep:pl.e}; if(cc.repasMode===1) r.rep={dej:true,gou:true}; suiviOf(c.id).days[k]=stampRec(r,k); n++; } });
  saveState(); suiviRefresh(); toast(n+' journée(s) enregistrée(s).');
}

/* --- Fiche d'une journée --- */
let DE = null;
function dayEdit(cid, k){
  const c = getContrat(cid), d = parseD(k);
  if(monthLocked(cid, k.slice(0,7))){ toast('Mois clôturé : passez par une régularisation.'); return; }
  const pl = plannedDay(c, d), r = clone(dayRec(cid, k) || {st: pl.min ? 'conf' : 'exc', a: pl.s, dep: pl.e});
  DE = {cid, k, r};
  const groups = {};
  Object.keys(ST).forEach(s=>{ (groups[ST[s].g]=groups[ST[s].g]||[]).push(s); });
  let opts = Object.keys(groups).map(g=>'<optgroup label="'+esc(g)+'">'+groups[g].map(s=>'<option value="'+s+'"'+(r.st===s?' selected':'')+'>'+esc(ST[s].l)+'</option>').join('')+'</optgroup>').join('');
  const rep = r.rep||{};
  let h = '<h3>'+esc(c.enfant||'')+' · '+d.toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'long'})+'</h3>'
    + '<p>'+(pl.min ? 'Prévu : '+(pl.s&&pl.e?pl.s+' – '+pl.e+' · ':'')+fmtH(pl.min) : 'Aucun accueil prévu ce jour-là')+(ferieName(d)?' · '+esc(ferieName(d)):'')+'</p>'
    + '<div class="field"><label>Que s\'est-il passé ?</label><select id="de-st" onchange="deVis()">'+opts+'</select></div>'
    + '<div id="de-info" class="info-box" style="display:none"></div>'
    + '<div id="de-acc"><div class="grid2">'
    + '<div class="field"><label>Arrivée</label><div style="display:flex;gap:6px"><input type="time" id="de-a" value="'+esc(r.a||'')+'"><button type="button" class="btn small" onclick="setVal(\'de-a\',minToHM(new Date().getHours()*60+new Date().getMinutes()))">maint.</button></div></div>'
    + '<div class="field"><label>Départ</label><div style="display:flex;gap:6px"><input type="time" id="de-dep" value="'+esc(r.dep||'')+'"><button type="button" class="btn small" onclick="setVal(\'de-dep\',minToHM(new Date().getHours()*60+new Date().getMinutes()))">maint.</button></div></div>'
    + '</div><div class="grid2"><div class="field"><label>Absence de l\'enfant dans la journée (minutes)</label><input type="number" step="5" min="0" id="de-pause" value="'+esc(r.pause||'')+'" placeholder="0"></div>'
    + '<div class="field"><label>ou durée totale (heures), sans horaires</label><input type="number" step="0.25" min="0" id="de-duree" value="'+esc(r.duree||'')+'"></div></div>'
    + '<div class="field"><label>Repas fournis par moi</label><div class="chips">'
    + [['pdj','Petit-déj.'],['dej','Déjeuner'],['gou','Goûter'],['din','Dîner']].map(m=>'<label class="chip'+(rep[m[0]]?' on':'')+'"><input type="checkbox" id="de-r-'+m[0]+'" '+(rep[m[0]]?'checked':'')+' onchange="this.parentElement.classList.toggle(\'on\',this.checked)" style="display:none">'+m[1]+'</label>').join('')+'</div></div>'
    + '<div class="grid2"><div class="field"><label>Kilomètres parcourus avec l\'enfant</label><input type="number" step="0.1" min="0" id="de-km" value="'+esc(r.km||'')+'"></div>'
    + '<div class="field"><label>Motif du trajet</label><input type="text" id="de-kmMotif" value="'+esc(r.kmMotif||'')+'" placeholder="ex. école, médiathèque"></div></div>'
    + '<div class="grid2"><div class="field"><label>Déposé par</label><input type="text" id="de-par1" value="'+esc(r.par1||'')+'"></div><div class="field"><label>Repris par</label><input type="text" id="de-par2" value="'+esc(r.par2||'')+'"></div></div></div>'
    + '<div id="de-abs" style="display:none"><div class="grid2"><div class="field"><label>Prévenu(e) par / quand</label><input type="text" id="de-prevenu" value="'+esc(r.prevenu||'')+'" placeholder="ex. SMS de la maman à 7 h 10"></div>'
    + '<div class="field"><label>Certificat médical reçu</label><select id="de-certif"><option value="">non</option><option value="1"'+(r.certif?' selected':'')+'>oui</option></select></div></div></div>'
    + '<div class="section-label">Frais avancés à rembourser</div><div id="de-frais"></div>'
    + '<button type="button" class="btn small" onclick="deAddFrais()">＋ Ajouter un frais</button>'
    + '<div class="section-label">Note, événement, preuves</div>'
    + '<div class="field"><select id="de-evt"><option value="">Pas d\'événement particulier</option>'+['Échange avec les parents','Accord des parents pour un changement','Incident (chute, blessure…)','Remise de document','Retard de paiement','Autre'].map(e=>'<option'+(r.evt===e?' selected':'')+'>'+e+'</option>').join('')+'</select></div>'
    + '<div class="field"><textarea id="de-note" rows="2" placeholder="Note (facultatif). Pas d\'information médicale détaillée : juste ce qui est utile.">'+esc(r.note||'')+'</textarea></div>'
    + '<div class="field"><label>Preuves (photo d\'un certificat, d\'un message d\'accord…)</label><input type="file" accept="image/*,application/pdf" id="de-file" onchange="deAddPreuve(this.files[0])"><div id="de-preuves" class="hint"></div></div>'
    + '<div class="btn-row"><button class="btn primary" onclick="deSave()">✔ Enregistrer</button><button class="btn" onclick="closeOverlay(\'day-overlay\')">Annuler</button>'
    + (dayRec(cid,k) ? '<button class="btn danger" onclick="deDelete()">Effacer la journée</button>' : '')+'</div>';
  setHTML('day-body', h); openOverlay('day-overlay');
  DE.r.frais = DE.r.frais || []; DE.r.preuves = DE.r.preuves || [];
  deRenderFrais(); deRenderPreuves(); deVis();
}
function deVis(){
  const st = val('de-st'), def = ST[st]||{};
  show('de-acc', !!def.acc); show('de-abs', !def.acc && st!=='none');
  const msg = {
    absMalC:'Déduction possible dans la limite de 5 jours par période de 12 mois (à partir de la date du contrat), avec certificat remis dans les 48 h. Le carnet compte les jours.',
    absMalS:'Sans certificat : le salaire reste dû. Pas d\'entretien ni de repas ce jour-là.',
    absPrev:'Absence voulue ou prévue par les parents : le salaire reste dû. Pas d\'entretien ni de repas.',
    absAutre:'Le salaire reste dû. Pas d\'entretien ni de repas.',
    absHosp:'Hospitalisation ou maladie de 14 jours et plus : pas de salaire pour ces jours (avec justificatif).',
    malAm:'Le particulier employeur ne maintient pas le salaire : les heures prévues sont déduites. Envoyez l\'arrêt à la CPAM sous 48 h (indemnités journalières + complément IRCEM Prévoyance).',
    sansSolde:'Heures prévues déduites. Gardez une trace de l\'accord des parents.',
    fermeture:'Votre absence non prévue : heures prévues déduites, sauf si les parents acceptent par écrit de la compter en congés payés.',
    cpAm:'Année complète : déjà payé dans le salaire mensualisé. Année incomplète : à prendre en principe pendant les semaines sans accueil.',
    evtFam:'Payé dans la limite légale (mariage 4 j, naissance 3 j, décès 3 à 7 j…). Au-delà, choisissez « Congé sans solde ».',
    form:'Formation sur le temps d\'accueil : salaire maintenu par les parents, qui sont remboursés par l\'organisme de formation.',
    ferieCh:'Payé (dès le début du contrat, si les jours d\'accueil prévus juste avant et juste après sont travaillés ou l\'absence autorisée ; le 1er mai est toujours chômé et payé).',
    adapt:'Indiquez les horaires réellement faits : les heures prévues non faites sont déduites (convention de 2022).',
    renvoye:'Indiquez l\'heure de départ réelle : la journée reste payée comme prévu, l\'entretien est dû.',
    exc:'Toutes les heures de ce jour sont en plus du contrat (complémentaires, ou majorées au-delà de 45 h dans la semaine). Notez l\'accord des parents.',
    ferieTr:'Majoration de 10 % sur les heures (100 % le 1er mai), en plus du salaire mensualisé.'
  }[st];
  const box = $('de-info'); box.style.display = msg ? 'block' : 'none'; box.textContent = msg || '';
}
function deRenderFrais(){
  setHTML('de-frais', (DE.r.frais||[]).map((f,i)=>'<div class="grid3" style="align-items:end"><div class="field"><label>Libellé</label><input type="text" value="'+esc(f.lib||'')+'" oninput="DE.r.frais['+i+'].lib=this.value"></div>'
    + '<div class="field"><label>Montant (€)</label><input type="number" step="0.01" value="'+esc(f.montant||'')+'" oninput="DE.r.frais['+i+'].montant=this.value"></div>'
    + '<div class="field"><label>Justificatif</label>'+(f.pj?'<a href="#" onclick="pjOpen(\''+f.pj+'\');return false;">voir</a> ':'')+'<input type="file" accept="image/*,application/pdf" onchange="deFraisPj('+i+',this.files[0])"></div></div>'
    + '<button type="button" class="btn small danger" onclick="DE.r.frais.splice('+i+',1);deRenderFrais()">Retirer</button>').join(''));
}
function deAddFrais(){ DE.r.frais.push({lib:'', montant:'', pj:''}); deRenderFrais(); }
async function deFraisPj(i, file){ if(!file) return; const id = await pjPut(file); DE.r.frais[i].pj = id; deRenderFrais(); }
async function deAddPreuve(file){ if(!file) return; const id = await pjPut(file); DE.r.preuves.push({id, nom:file.name, t:new Date().toISOString()}); deRenderPreuves(); $('de-file').value=''; }
function deRenderPreuves(){ setHTML('de-preuves', (DE.r.preuves||[]).map((p,i)=>'📎 <a href="#" onclick="pjOpen(\''+p.id+'\');return false;">'+esc(p.nom||'pièce')+'</a> <a href="#" onclick="DE.r.preuves.splice('+i+',1);deRenderPreuves();return false;">✕</a>').join('<br>')); }
function deSave(){
  const r = DE.r;
  r.st = val('de-st');
  ['a','dep','pause','duree','km','kmMotif','par1','par2','prevenu','note','evt'].forEach(f=>{ const el=$('de-'+f); if(el) r[f] = el.value.trim(); });
  r.certif = val('de-certif')==='1';
  r.rep = {}; ['pdj','dej','gou','din'].forEach(m=>{ if($('de-r-'+m) && $('de-r-'+m).checked) r.rep[m]=true; });
  if(!ST[r.st].acc){ r.a=''; r.dep=''; r.rep={}; r.km=''; }
  const a=hmToMin(r.a), b=hmToMin(r.dep);
  if(a!==null && b!==null && b<=a){ toast('L\'heure de départ doit être après l\'arrivée.'); return; }
  const before = dayRec(DE.cid, DE.k);
  suiviOf(DE.cid).days[DE.k] = stampRec(r, DE.k);
  if(before && JSON.stringify(before.st)!==JSON.stringify(r.st)) auditLog(DE.cid, 'Journée du '+fmtDate(DE.k)+' : '+(ST[before.st]||{}).l+' → '+ST[r.st].l);
  saveState(); closeOverlay('day-overlay'); suiviRefresh(); toast('Journée enregistrée.');
}
function deDelete(){ delete suiviOf(DE.cid).days[DE.k]; auditLog(DE.cid, 'Journée du '+fmtDate(DE.k)+' effacée'); saveState(); closeOverlay('day-overlay'); suiviRefresh(); }

/* --- Calendrier du mois en couleurs --- */
function renderCal(c){
  const ym = SV.ym, d0 = parseD(ym), y=d0.getFullYear(), m=d0.getMonth();
  let h = monthNav();
  h += '<div class="cal-grid sv-cal">';
  const lead = dowIdx(new Date(y,m,1));
  for(let i=0;i<lead;i++) h += '<div class="cal-day off" style="visibility:hidden"></div>';
  for(let day=1; day<=daysInMonth(y,m); day++){
    const d = new Date(y,m,day), k = iso(d), x = calcDay(c, d, k);
    const cls = x.st==='hors' ? 'off' : x.st==='todo' ? (d<today()?'todo':'prev') : x.st==='avant' ? 'off' : 'st-'+(x.def.c||'none');
    const sym = {ok:'✓', ecart:'≠', abs:'A', am:'M', cp:'CP', ferie:'F', none:''}[x.def.c] || (x.st==='todo' && d<today() ? '?' : '');
    const lbl = d.toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'long'})+' : '+(x.st==='todo'?(d<today()?'à renseigner':'prévu'):x.st==='hors'?'hors contrat':x.st==='avant'?'avant le suivi':((ST[x.st]||{}).l||''))+(x.R?', '+fmtH(x.R):'');
    h += '<button type="button" class="cal-day sv '+cls+(isVacances(d)?' vac':'')+'" aria-label="'+esc(lbl)+'" onclick="'+(x.st==='hors'?'':'dayEdit(\''+c.id+'\',\''+k+'\')')+'"><div class="dname">'+DOW_SHORT[dowIdx(d)]+'</div><div class="dnum">'+day+(sym?' <b class="sym">'+sym+'</b>':'')+'</div>'
      + '<div class="fname">'+(x.R?fmtH(x.R):x.P&&x.st!=='none'?'('+fmtH(x.P)+')':'')+'</div></button>';
  }
  h += '</div>' + legend();
  return h;
}
function legend(){
  return '<div class="hint" style="display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px">'
    + [['st-ok','conforme'],['st-ecart','écart / en plus'],['st-abs','absence enfant'],['st-am','mon absence'],['st-cp','congé payé'],['st-ferie','férié'],['todo','à renseigner'],['prev','prévu']].map(l=>'<span class="pill sv '+l[0]+'">'+l[1]+'</span>').join('')+'</div>';
}
function monthNav(){
  const d0 = parseD(SV.ym);
  return '<div class="box" style="display:flex;align-items:center;justify-content:space-between">'
    + '<button class="icon-btn" onclick="SV.ym=isoMonth(new Date('+d0.getFullYear()+','+(d0.getMonth()-1)+',1));renderSuivi()">‹</button>'
    + '<b>'+fmtMonth(SV.ym)+'</b>'
    + '<button class="icon-btn" onclick="SV.ym=isoMonth(new Date('+d0.getFullYear()+','+(d0.getMonth()+1)+',1));renderSuivi()">›</button></div>';
}

/* --- Récapitulatif du mois, clôture, validation, transfert vers la paie --- */
function renderMoisSuivi(c){
  const M = suiviMonth(c, SV.ym), T = M.T, mr = monthRec(c.id, SV.ym), locked = monthLocked(c.id, SV.ym);
  let h = monthNav();
  const idx = MONTH_ST.indexOf(mr.st);
  h += '<div class="steps" title="Statut du mois">'+MONTH_ST.map((s,i)=>'<span class="'+(i<=idx?'on':'')+'"></span>').join('')+'</div>'
    + '<p class="hint" style="margin-top:-8px">Statut : <b>'+MONTH_ST_L[mr.st]+'</b>'+(mr.valideLe?' · validé le '+fmtDate(mr.valideLe)+(mr.valideMode?' ('+esc(mr.valideMode)+')':''):'')+(mr.payeLe?' · payé le '+fmtDate(mr.payeLe):'')+(mr.archive?' · archive '+esc(mr.archive.hash.slice(0,12))+'…':'')+'</p>';
  // Vérifications
  const ck = suiviChecks(M);
  h += '<div class="box"><div class="section-label">Avant de clôturer</div>'+ck.map(x=>'<div class="hint">'+(x.ok?'✅ ':'⚠️ ')+esc(x.t)+'</div>').join('')+'</div>';
  // Totaux
  const L = [
    ['Heures prévues au planning du mois', fmtH(T.hPrev)],
    ['Heures réellement faites', fmtH(T.R)],
    ['Heures déduites (absences non payées'+(T.hOut?', hors contrat':'')+')', fmtH(T.hDed+T.hOut)],
    ['Heures complémentaires (au-delà du planning du jour, taux normal)', fmtH(T.compl)],
    ['Heures majorées (au-delà de 45 h/semaine, +'+M.majPct+' %)', fmtH(T.maj)],
    ['Heures travaillées un jour férié', fmtH(T.ferieMin+T.mai1Min)],
    ['Jours d\'accueil (présence réelle)', T.jAcc+' j'],
    ['Jours de congés payés (jours ouvrables)', T.cp ? T.cpOuv+' j ('+T.cp+' jours d\'accueil)' : '0'],
    ['Repas fournis', T.nbRepas],
    ['Kilomètres', fmtNum(T.km,1)+' km'],
  ];
  h += '<div class="stub" style="margin-top:0"><div class="stub-head">Récapitulatif — '+esc(c.enfant||'')+'</div><div class="stub-body">'
    + L.map(l=>'<div class="result-line"><span class="lbl">'+l[0]+'</span><span class="val">'+esc(String(l[1]))+'</span></div>').join('')
    + '<div class="section-label">Montants estimés</div>'
    + '<div class="result-line"><span class="lbl">Salaire mensualisé dû'+(T.hDed||T.hOut?' (après déduction : '+fmtEUR(M.base)+' × '+fmtH(T.hPrev-T.hDed-T.hOut)+' ÷ '+fmtH(T.hPrev)+')':'')+'</span><span class="val">'+fmtEUR(M.due)+'</span></div>'
    + (M.complPay?'<div class="result-line"><span class="lbl">Heures complémentaires</span><span class="val">'+fmtEUR(M.complPay)+'</span></div>':'')
    + (M.majPay?'<div class="result-line"><span class="lbl">Heures majorées</span><span class="val">'+fmtEUR(M.majPay)+'</span></div>':'')
    + (M.ferieSup?'<div class="result-line"><span class="lbl">Majoration jours fériés travaillés</span><span class="val">'+fmtEUR(M.ferieSup)+'</span></div>':'')
    + (M.regBrut?'<div class="result-line"><span class="lbl">Régularisations imputées sur ce mois</span><span class="val">'+fmtEUR(M.regBrut)+'</span></div>':'')
    + (M.cp12?'<div class="result-line"><span class="lbl">Congés payés (1/12ᵉ)</span><span class="val">'+fmtEUR(M.cp12)+'</span></div>':'')
    + '<div class="result-line total"><span class="lbl">Salaire brut estimé</span><span class="val">'+fmtEUR(M.brut)+'</span></div>'
    + '<div class="result-line"><span class="lbl">Salaire net estimé</span><span class="val">'+fmtEUR(M.net)+'</span></div>'
    + '<div class="result-line"><span class="lbl">Indemnités d\'entretien ('+T.jAcc+' jours)</span><span class="val">'+fmtEUR(T.ie)+'</span></div>'
    + '<div class="result-line"><span class="lbl">Repas</span><span class="val">'+fmtEUR(T.repas)+'</span></div>'
    + '<div class="result-line"><span class="lbl">Indemnités kilométriques</span><span class="val">'+fmtEUR(T.kmEur)+'</span></div>'
    + '<div class="result-line"><span class="lbl">Frais avancés à rembourser (hors Pajemploi)</span><span class="val">'+fmtEUR(T.frais)+'</span></div>'
    + '<div class="net-hint">Estimation indicative. Les chiffres exacts à déclarer sont donnés par « Salaire du mois & Pajemploi » ; la référence reste le contrat, la convention collective et Pajemploi.</div>'
    + '<button class="btn primary block" onclick="suiviVersPaie(\''+c.id+'\',\''+SV.ym+'\')">➡️ Préparer la déclaration Pajemploi de ce mois</button>'
    + '</div></div>';
  // Actions de statut
  h += '<div class="btn-row">'
    + '<button class="btn small" onclick="suiviPrint(\''+c.id+'\',\''+SV.ym+'\')">📄 Récapitulatif pour les parents (PDF)</button>'
    + '<button class="btn small" onclick="suiviShare(\''+c.id+'\',\''+SV.ym+'\')">📤 Envoyer aux parents</button>'
    + '<button class="btn small" onclick="suiviCSV(\''+c.id+'\',\''+SV.ym+'\')">⬇️ Tableau (CSV)</button></div>'
    + '<div class="btn-row">'
    + (!locked ? '<button class="btn small" onclick="suiviSetSt(\''+c.id+'\',\''+SV.ym+'\',\'avalider\')">Envoyé aux parents</button><button class="btn small" onclick="suiviValide(\''+c.id+'\',\''+SV.ym+'\')">✔ Validé par le parent</button><button class="btn small" onclick="suiviCloture(\''+c.id+'\',\''+SV.ym+'\')">🔒 Clôturer le mois</button>' :
      '<button class="btn small" onclick="suiviPaye(\''+c.id+'\',\''+SV.ym+'\')">💶 Marquer payé</button><button class="btn small danger" onclick="suiviRouvrir(\''+c.id+'\',\''+SV.ym+'\')">Rouvrir (tracé)</button>')
    + '</div>';
  if(mr.contestation) h += '<div class="warn-box">Contestation du parent : '+esc(mr.contestation)+'</div>';
  // Régularisations
  const regs = suiviOf(c.id).regs||[];
  h += '<div class="section-label">Régularisations (corrections d\'un mois déjà clôturé)</div>'
    + (regs.length ? regs.map((g,i)=>'<div class="hint">'+fmtDate(g.date)+' · mois d\'origine '+fmtMonth(g.origine)+' → imputée sur '+fmtMonth(g.imput)+' : '+esc(g.motif)+' ('+fmtEUR(parseFloat(g.montant)||0)+')</div>').join('') : '<div class="hint">Aucune.</div>')
    + '<button class="btn small" onclick="suiviAddReg(\''+c.id+'\')">＋ Ajouter une régularisation</button>';
  // Détail jour par jour
  h += '<details class="help" style="margin-top:14px"><summary>Détail jour par jour</summary><div><div class="ab-table-wrap"><table class="ab-table" style="min-width:600px"><thead><tr><th>Jour</th><th>Statut</th><th>Prévu</th><th>Fait</th><th>En plus</th><th>Déduit</th><th>Entretien</th><th>Repas</th><th>Km</th></tr></thead><tbody>'
    + M.days.filter(x=>x.inC && (x.P||x.r)).map(x=>'<tr><td>'+x.d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'})+'</td><td style="white-space:normal;text-align:left">'+esc(x.st==='todo'?'à renseigner':x.st==='avant'?'avant le suivi':(ST[x.st]||{}).l||'')+(x.dedNote?' — '+esc(x.dedNote):'')+'</td><td>'+fmtH(x.P)+'</td><td>'+fmtH(x.R)+'</td><td>'+fmtH((x.compl||0)+(x.maj||0))+'</td><td>'+fmtH(x.ded)+'</td><td>'+(x.ie?fmtEUR(x.ie):'')+'</td><td>'+(x.nbRepas||'')+'</td><td>'+(x.km||'')+'</td></tr>').join('')
    + '</tbody></table></div></div></details>';
  return h;
}

/* Transfert du récapitulatif vers « Salaire du mois & Pajemploi » (rien à recalculer) */
function hasSuiviMonth(cid, ym){ const S=(STATE.suivi||{})[cid]; return !!(S && Object.keys(S.days||{}).some(k=>k.slice(0,7)===ym)); }
function suiviVersPaie(cid, ym){
  const c = getContrat(cid);
  STATE.sel.mois = cid; if(STATE.forms.mois) delete STATE.forms.mois[cid];
  showTheme('mois');
  setVal('mois-mois', ym); moisFillFromContract(c, ym);
  if(!hasSuiviMonth(cid, ym)) suiviFillMois(c, ym);
  VIS.mois(); CALC.mois(); persistTheme('mois');
  toast('Mois repris du suivi. Vérifiez, recopiez sur Pajemploi, puis validez le mois.');
}
/* Remplit « Salaire du mois » avec les chiffres réels du suivi (appelé aussi automatiquement) */
function suiviFillMois(c, ym){
  const cid = c.id, M = suiviMonth(c, ym), T = M.T, mr = monthRec(cid, ym);
  const ded = Math.max(0, M.base - M.due);
  setVal('mois-base', round2(M.base));
  setSegVal('mois-incomplet', ded>0.004 ? 1 : 0);
  setVal('mois-deduction', round2(ded)); setVal('mois-jprev', T.jPrev); setVal('mois-jded', T.jDed); setVal('mois-hded', round2((T.hDed+T.hOut)/60));
  setSegVal('mois-heuresup', (T.compl||T.maj) ? 1 : 0); setVal('mois-hcompl', round2(T.compl/60)); setVal('mois-hmaj', round2(T.maj/60)); setVal('mois-majoration', M.majPct);
  setSegVal('mois-ferie', (T.ferieMin||T.mai1Min) ? 1 : 0); setVal('mois-hferie', round2(T.ferieMin/60)); setVal('mois-h1mai', round2(T.mai1Min/60));
  if(paramsAt(c, parseD(ym)).type===1) setVal('mois-jcp', T.cpOuv||'');
  setVal('mois-jours', T.jAcc);
  setVal('mois-hjour', T.jAcc ? round2(T.R/60/T.jAcc) : '');
  // moyenne non arrondie : le total du mois retombe exactement sur le total jour par jour (0 centime d'écart)
  setVal('mois-indemj', T.jAcc ? +(T.ie/T.jAcc).toFixed(6) : '');
  setVal('mois-repas', T.jAcc ? +(T.repas/T.jAcc).toFixed(6) : '');
  setVal('mois-km', round2(T.kmEur || (parseFloat(paramsAt(c,parseD(ym)).km)||0)));
  setVal('mois-hreel', round2(T.R/60));
  setVal('mois-j8', T.j8); setVal('mois-hm8', round2(T.hm8));
  setVal('mois-regul', M.regBrut ? round2(M.regBrut) : '');
  if(mr.acompte) setVal('mois-acompte', mr.acompte);
}
function suiviSetSt(cid, ym, st){ const mr = monthRec(cid, ym); mr.st = st; auditLog(cid, fmtMonth(ym)+' : statut « '+MONTH_ST_L[st]+' »'); saveState(); suiviRefresh(); }
function suiviValide(cid, ym){
  askText('Validation par le parent', 'Comment le parent a-t-il validé ? (ex. « signé sur papier », « OK par SMS le 3/10 »). Pour une contestation, commencez par « contesté : » et expliquez.', 'OK par message', v=>{
    const mr = monthRec(cid, ym); v = (v||'').trim();
    if(/^contest/i.test(v)){ mr.contestation = v; mr.st = 'avalider'; auditLog(cid, fmtMonth(ym)+' contesté : '+v); }
    else { mr.valideLe = iso(today()); mr.valideMode = v; delete mr.contestation; suiviArchive(cid, ym, 'valide'); }
    saveState(); suiviRefresh();
  });
}
function suiviCloture(cid, ym){
  const M = suiviMonth(getContrat(cid), ym);
  const pb = suiviChecks(M).filter(x=>!x.ok);
  showConfirmDialog('Clôturer '+fmtMonth(ym)+' ?', (pb.length ? pb.length+' point(s) à vérifier restent signalés. ' : '')+'Après clôture, les journées de ce mois ne se modifient plus directement : toute correction passe par une régularisation datée (traçabilité). Une archive du mois est créée.', ()=>suiviArchive(cid, ym, 'cloture'), 'Clôturer', 'Annuler');
}
async function suiviArchive(cid, ym, st){
  const c = getContrat(cid), M = suiviMonth(c, ym), mr = monthRec(cid, ym);
  const snap = {contrat: c.id, enfant: c.enfant, mois: ym, jours: M.days.filter(x=>x.inC).map(x=>({j:x.k, st:x.st, prevu:x.P, fait:x.R, compl:Math.round(x.compl||0), maj:Math.round(x.maj||0), deduit:x.ded, ie:round2(x.ie), r:x.r})),
    totaux: Object.assign({}, M.T), brut: round2(M.brut), net: round2(M.net), le: new Date().toISOString(), reglementation: REG.version};
  const txt = JSON.stringify(snap);
  let hash = '';
  try{ const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); hash = [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''); }catch(e){ hash = 'indisponible (ouvrir l\'appli en ligne pour l\'empreinte)'; }
  mr.archive = {hash, le: snap.le, data: snap};
  if(MONTH_ST.indexOf(mr.st) < MONTH_ST.indexOf(st)) mr.st = st;
  auditLog(cid, fmtMonth(ym)+' : '+MONTH_ST_L[st]+' (empreinte '+hash.slice(0,16)+')');
  saveState(); suiviRefresh(); toast('Mois '+(st==='valide'?'validé':'clôturé')+' et archivé.');
}
function suiviPaye(cid, ym){
  askText('Date de paiement', 'Date à laquelle le salaire a été payé (AAAA-MM-JJ) :', iso(today()), v=>{
    const d = parseD((v||'').trim()); if(!d){ toast('Date non reconnue.'); return; }
    const mr = monthRec(cid, ym); mr.payeLe = iso(d); mr.st = 'paye'; auditLog(cid, fmtMonth(ym)+' payé le '+d.toLocaleDateString('fr-FR')); saveState(); suiviRefresh();
  });
}
function suiviRouvrir(cid, ym){
  showConfirmDialog('Rouvrir '+fmtMonth(ym)+' ?', 'Rouvrir un mois validé ou clôturé est tracé dans le journal. Préférez une régularisation si le mois est déjà déclaré ou payé.', ()=>{
    const mr = monthRec(cid, ym); mr.st = 'ouvert'; auditLog(cid, fmtMonth(ym)+' rouvert'); saveState(); suiviRefresh();
  }, 'Rouvrir', 'Annuler');
}
function suiviAddReg(cid){
  askText('Régularisation', 'Format : mois d\'origine (AAAA-MM), montant brut en € (+ dû à l\'assistante, − trop payé), motif. Exemple : 2026-09 ; 12,40 ; 3 heures de dépassement oubliées', SV.ym+' ; 0 ; ', v=>{
    const p = String(v||'').split(';').map(x=>x.trim());
    if(!/^\d{4}-\d{2}$/.test(p[0]||'') || isNaN(parseFloat((p[1]||'').replace(',','.')))){ toast('Format attendu : AAAA-MM ; montant ; motif'); return; }
    const imput = curMonth();
    suiviOf(cid).regs.push({date: iso(today()), origine: p[0], imput, montant: parseFloat(p[1].replace(',','.')), motif: p.slice(2).join(';')||'régularisation'});
    auditLog(cid, 'Régularisation '+p[0]+' → '+imput+' : '+p[1]+' € ('+(p[2]||'')+')');
    if(parseFloat(p[1].replace(',','.')) < 0) toast('Un trop-perçu ne peut être retenu qu\'avec l\'accord écrit de la salariée.');
    saveState(); suiviRefresh();
  });
}
function suiviRecapHTML(cid, ym){
  const c = getContrat(cid), M = suiviMonth(c, ym), T = M.T;
  let h = '<h1>Récapitulatif du mois — '+esc(fmtMonth(ym))+'</h1><div class="meta">'+esc(contratLabel(c))+' · assistante maternelle : '+esc((STATE.profil||{}).nom||'')+' · édité le '+today().toLocaleDateString('fr-FR')+'</div>'
    + '<table><tr><td><b>Jour</b></td><td><b>Statut</b></td><td><b>Arrivée – départ</b></td><td><b>Heures</b></td></tr>'
    + M.days.filter(x=>x.inC && (x.P||x.r)).map(x=>'<tr><td>'+x.d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'})+'</td><td>'+esc(x.st==='todo'?'non renseigné':(ST[x.st]||{}).l||'')+'</td><td>'+(x.r&&x.r.a?esc(x.r.a)+' – '+esc(x.r.dep||''):'')+'</td><td>'+fmtH(x.R)+'</td></tr>').join('')+'</table>'
    + '<h3>Totaux</h3><table>'
    + '<tr><td>Heures prévues / faites</td><td>'+fmtH(T.hPrev)+' / '+fmtH(T.R)+'</td></tr><tr><td>Heures déduites</td><td>'+fmtH(T.hDed+T.hOut)+'</td></tr>'
    + '<tr><td>Heures complémentaires / majorées</td><td>'+fmtH(T.compl)+' / '+fmtH(T.maj)+'</td></tr><tr><td>Jours d\'accueil</td><td>'+T.jAcc+'</td></tr>'
    + '<tr><td>Salaire brut / net estimé</td><td>'+fmtEUR(M.brut)+' / '+fmtEUR(M.net)+'</td></tr><tr><td>Entretien / repas / km</td><td>'+fmtEUR(T.ie)+' / '+fmtEUR(T.repas)+' / '+fmtEUR(T.kmEur)+'</td></tr>'
    + '<tr><td>Frais avancés à rembourser</td><td>'+fmtEUR(T.frais)+'</td></tr></table>'
    + '<p class="legal-p">Calcul indicatif : salaire mensualisé diminué des heures d\'absence non payées (méthode de la Cour de cassation : salaire × heures faites ÷ heures prévues), heures complémentaires au taux normal, heures au-delà de 45 h par semaine majorées. Les montants officiels sont ceux de Pajemploi.</p>'
    + '<p>Validé par le parent : ☐ oui ☐ avec remarques : ______________________ Date et signature :</p>';
  return h;
}
function suiviPrint(cid, ym){ doPrint('<div class="doc">'+suiviRecapHTML(cid, ym)+'</div>'); }
function suiviShare(cid, ym){
  const c = getContrat(cid), M = suiviMonth(c, ym), T = M.T;
  const txt = 'Récapitulatif '+fmtMonth(ym)+' — '+(c.enfant||'')+'\nHeures faites : '+fmtH(T.R)+' (prévu '+fmtH(T.hPrev)+')\nHeures en plus : '+fmtH(T.compl+T.maj)+'\nJours d\'accueil : '+T.jAcc+'\nSalaire net estimé : '+fmtEUR(M.net)+'\nEntretien : '+fmtEUR(T.ie)+' · Repas : '+fmtEUR(T.repas)+' · Km : '+fmtEUR(T.kmEur)+'\nFrais à rembourser : '+fmtEUR(T.frais)+'\nMerci de me confirmer votre accord (ou vos remarques).';
  monthRec(cid, ym).st = monthRec(cid, ym).st==='ouvert' ? 'avalider' : monthRec(cid, ym).st; saveState();
  if(navigator.share) navigator.share({title:'Récapitulatif '+fmtMonth(ym), text:txt}).catch(()=>{});
  else { try{ navigator.clipboard.writeText(txt); toast('Récapitulatif copié : collez-le dans un message.'); }catch(e){ toast('Partage indisponible ici.'); } }
  suiviRefresh();
}
function suiviCSV(cid, ym){
  const c = getContrat(cid), M = suiviMonth(c, ym);
  const rows = [['date','statut','prevu_min','fait_min','complementaires_min','majorees_min','deduit_min','arrivee','depart','entretien_eur','repas','km','frais_eur','note']];
  M.days.filter(x=>x.inC && (x.P||x.r)).forEach(x=>rows.push([x.k, (ST[x.st]||{}).l||x.st, x.P, x.R, Math.round(x.compl||0), Math.round(x.maj||0), x.ded, (x.r||{}).a||'', (x.r||{}).dep||'', round2(x.ie), x.nbRepas, x.km, round2(x.frais), ((x.r||{}).note||'').replace(/[\r\n;]/g,' ')]));
  const csv = '﻿'+rows.map(r=>r.join(';')).join('\r\n');
  download(new Blob([csv], {type:'text/csv'}), ym+'_'+(c.enfant||'enfant')+'_'+(c.famille||'').replace(/\s+/g,'-')+'.csv');
}

/* --- Compteurs --- */
function renderCompteurs(c){
  const t = today(), ref = cpRefStart(t);
  // Congés payés
  const cpPris = Object.keys(suiviOf(c.id).days).filter(k=>k>=iso(ref) && (ST[suiviOf(c.id).days[k].st]||{}).cp).length;
  const dispo = cpDispoFor(c);
  // Absences de l'enfant dans l'année du contrat
  const mal = malCountBefore(c, addDays(t,1));
  const days = suiviOf(c.id).days, y0 = iso(new Date(t.getFullYear(),0,1));
  const cnt = st=>Object.keys(days).filter(k=>k>=y0 && days[k].st===st).length;
  // Période d'essai
  const fe = finEssai(c), essai = fe ? Math.ceil((fe - t)/86400000) : null;
  // Heures annuelles (année incomplète) : depuis le début du contrat ou de la reprise
  let annual = '';
  if(paramsAt(c,t).type===1){
    const J = journalTotals(c.id), rep = c.rep||{};
    const real = J.hContrat + (parseFloat(rep.regulHeures)||0);
    const paid = J.n ? journalTotals(c.id).mois.reduce((s,m)=>s+derive(c, parseD(m)).hMensu,0) : 0;
    annual = '<div class="result-line"><span class="lbl">Année incomplète : heures payées par la mensualisation (mois validés)</span><span class="val">'+fmtNum(paid,2)+' h</span></div>'
      + '<div class="result-line"><span class="lbl">Heures réellement dues (planning, absences déduites)</span><span class="val">'+fmtNum(real,2)+' h</span></div>'
      + '<div class="result-line"><span class="lbl">Écart (régularisation en fin de contrat)</span><span class="val">'+fmtNum(real-paid,2)+' h</span></div>';
  }
  const yJ = journalTotals(c.id, t.getFullYear()+'-01', t.getFullYear()+'-12');
  let h = '<div class="stub" style="margin-top:0"><div class="stub-head">Compteurs — '+esc(c.enfant||'')+'</div><div class="stub-body">'
    + '<div class="result-line"><span class="lbl">Congés payés disponibles (estimation)</span><span class="val">'+fmtNum(dispo||0,1)+' j</span></div>'
    + '<div class="result-line"><span class="lbl">Jours de congés notés depuis le '+ref.toLocaleDateString('fr-FR')+'</span><span class="val">'+cpPris+' j</span></div>'
    + '<div class="result-line"><span class="lbl">Enfant malade avec certificat (sur 12 mois depuis la date anniversaire)</span><span class="val">'+mal+' / '+R('absMaladieEnfant')+' j</span></div>'
    + '<div class="result-line"><span class="lbl">Absences de l\'enfant cette année : convenance / sans certificat</span><span class="val">'+(cnt('absPrev')+cnt('absAutre'))+' / '+cnt('absMalS')+' j</span></div>'
    + (essai!==null && essai>=0 ? '<div class="result-line'+(essai<=7?' warn':'')+'"><span class="lbl">Période d\'essai : jours restants</span><span class="val">'+essai+' j (fin le '+fe.toLocaleDateString('fr-FR')+')</span></div>' : '')
    + annual
    + '<div class="result-line"><span class="lbl">Indemnités cumulées '+t.getFullYear()+' (mois validés) : entretien / repas / km</span><span class="val">'+fmtEUR(yJ.ie)+' / '+fmtEUR(yJ.repas)+' / '+fmtEUR(yJ.km)+'</span></div>'
    + '<div class="btn-row"><button class="btn small" onclick="openFor(\'cp\',\''+c.id+'\')">Détail des congés</button><button class="btn small" onclick="openFor(\'fin\',\''+c.id+'\')">Fin de contrat</button></div>'
    + '</div></div>';
  // Année en couleurs
  h += '<div class="section-label">L\'année en un coup d\'œil</div><div class="year-grid">';
  for(let i=0;i<12;i++){
    const d0 = new Date(t.getFullYear(), i, 1), nb = daysInMonth(d0.getFullYear(), i);
    h += '<div class="ym"><div class="hint" style="margin:0 0 3px"><b>'+d0.toLocaleDateString('fr-FR',{month:'short'})+'</b></div><div class="ym-days">';
    for(let k=0;k<dowIdx(d0);k++) h += '<i></i>';
    for(let day=1; day<=nb; day++){ const d = new Date(t.getFullYear(), i, day), x = calcDay(c, d, iso(d)); const cls = x.st==='hors'||x.st==='avant'?'off':x.st==='todo'?(d<t?'todo':'prev'):'st-'+(x.def.c||'none'); h += '<i class="sv '+cls+'" title="'+iso(d)+'"></i>'; }
    h += '</div></div>';
  }
  h += '</div>'+legend();
  h += '<details class="help"><summary>Journal des modifications (traçabilité)</summary><div>'+((STATE.audit||[]).filter(a=>a.cid===c.id).slice(-60).reverse().map(a=>new Date(a.t).toLocaleString('fr-FR')+' — '+esc(a.txt)).join('<br>')||'Aucune modification tracée.')+'</div></details>';
  return h;
}

/* ---------------------------------- Rappels (agenda du téléphone) ---------------------------------- */
function downloadICS(){
  const hm = (STATE.settings.rappel||'18:30').replace(':','');
  const d = iso(today()).replace(/-/g,'');
  const ev = (uid, titre, rrule, when)=>'BEGIN:VEVENT\r\nUID:'+uid+'@carnet-assmat\r\nDTSTAMP:'+d+'T000000Z\r\nDTSTART;TZID=Europe/Paris:'+when+'\r\nDURATION:PT10M\r\nRRULE:'+rrule+'\r\nSUMMARY:'+titre+'\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:'+titre+'\r\nTRIGGER:PT0M\r\nEND:VALARM\r\nEND:VEVENT\r\n';
  const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Carnet Assmat//FR\r\n'
    + ev('jour', 'Carnet Assmat : valider la journée', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', d+'T'+hm+'00')
    + ev('pajemploi', 'Carnet Assmat : clôturer le mois et déclarer sur Pajemploi', 'FREQ=MONTHLY;BYMONTHDAY=25', d.slice(0,6)+'25T190000')
    + ev('sauvegarde', 'Carnet Assmat : faire une copie de sécurité', 'FREQ=MONTHLY;BYMONTHDAY=1', d.slice(0,6)+'01T190000')
    + 'END:VCALENDAR\r\n';
  download(new Blob([ics], {type:'text/calendar'}), 'rappels-carnet-assmat.ics');
  toast('Ouvrez le fichier téléchargé : votre agenda proposera d\'ajouter les rappels.');
}

/* ---------------------------------- Vacances scolaires (données officielles) ---------------------------------- */
function isVacances(d){
  const z = STATE.settings.zone; if(!z) return false;
  const all = (STATE.vacances||{})[z] || [];
  const k = iso(d);
  return all.some(v=>k >= v.du && k < v.au);
}
async function loadVacances(zone, quiet){
  if(!zone){ if(!quiet) toast('Choisissez d\'abord votre zone dans les Réglages.'); return false; }
  const t = today(), y = t.getMonth()>=7 ? t.getFullYear() : t.getFullYear()-1;
  const annees = [(y-1)+'-'+y, y+'-'+(y+1), (y+1)+'-'+(y+2)];
  const where = 'zones="Zone '+zone+'" and annee_scolaire in ("'+annees.join('","')+'") and population!="Enseignants"';
  const url = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?select=description,start_date,end_date,annee_scolaire&where='+encodeURIComponent(where)+'&group_by=description,start_date,end_date,annee_scolaire&limit=100';
  try{
    const r = await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status);
    const j = await r.json();
    STATE.vacances = STATE.vacances || {};
    STATE.vacances[zone] = (j.results||[]).filter(v=>!/pont/i.test(v.description)).map(v=>({nom:v.description, du: iso(new Date(v.start_date)), au: iso(new Date(v.end_date))}))
      .map(v=>{ const s=parseD(v.du); if(s.getDay()===6) v.du=iso(addDays(s,2)); return v; }); // le samedi de départ → lundi
    saveNow(); if(!quiet) toast((STATE.vacances[zone].length)+' périodes de vacances chargées (zone '+zone+').');
    return true;
  }catch(e){ if(!quiet) toast('Vacances scolaires indisponibles (connexion ?).'); return false; }
}
/* Dans l'assistant de contrat (année incomplète) : cocher d'un coup les semaines de vacances scolaires */
async function ctCocherVacances(){
  const z = STATE.settings.zone;
  if(!z){ toast('Indiquez votre zone de vacances scolaires dans les Réglages.'); return; }
  if(!((STATE.vacances||{})[z]||[]).length){ const ok = await loadVacances(z); if(!ok) return; }
  ctRead(); CT.semOff = CT.semOff||[];
  const deb = parseD(CT.debut)||today();
  let start = mondayOf(deb); if((today()-deb)/86400000 > 330) start = mondayOf(new Date(today().getFullYear() - (today().getMonth()<7?1:0), 8, 1));
  let n = 0;
  for(let i=0;i<52;i++){
    const w = addDays(start, 7*i); let vac = 0;
    for(let j=0;j<5;j++) if(isVacances(addDays(w,j))) vac++;
    const k = iso(w);
    if(vac>=3 && !CT.semOff.includes(k)){ CT.semOff.push(k); n++; }
  }
  ctRenderWeeks(); toast(n+' semaine(s) de vacances scolaires cochée(s). Ajustez si besoin (vos congés, semaines où l\'enfant vient quand même).');
}

/* ---------------------------------- Pièces jointes (stockées sur le téléphone, IndexedDB) ---------------------------------- */
function pjDB(){
  return new Promise((ok, ko)=>{
    const rq = indexedDB.open('carnet-assmat-pj', 1);
    rq.onupgradeneeded = ()=>rq.result.createObjectStore('pj');
    rq.onsuccess = ()=>ok(rq.result); rq.onerror = ()=>ko(rq.error);
  });
}
async function pjCompress(file){
  if(!/^image\//.test(file.type)) return file;
  try{
    const bmp = await createImageBitmap(file), max = 1400, sc = Math.min(1, max/Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width*sc); cv.height = Math.round(bmp.height*sc);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise(r=>cv.toBlob(b=>r(b||file), 'image/jpeg', 0.72));
  }catch(e){ return file; }
}
async function pjPut(file){
  if(file.size > 8*1024*1024){ toast('Fichier trop lourd (8 Mo maximum).'); throw new Error('trop lourd'); }
  const blob = await pjCompress(file), id = 'pj'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const db = await pjDB();
  await new Promise((ok,ko)=>{ const tx = db.transaction('pj','readwrite'); tx.objectStore('pj').put({blob, nom:file.name, type:blob.type||file.type, t:new Date().toISOString()}, id); tx.oncomplete=ok; tx.onerror=()=>ko(tx.error); });
  return id;
}
async function pjGet(id){ const db = await pjDB(); return new Promise((ok,ko)=>{ const rq = db.transaction('pj').objectStore('pj').get(id); rq.onsuccess=()=>ok(rq.result); rq.onerror=()=>ko(rq.error); }); }
async function pjOpen(id){ const p = await pjGet(id); if(!p){ toast('Pièce introuvable sur ce téléphone.'); return; } window.open(URL.createObjectURL(p.blob), '_blank'); }
async function pjAll(){ const db = await pjDB(); return new Promise((ok,ko)=>{ const out={}, rq = db.transaction('pj').objectStore('pj').openCursor(); rq.onsuccess=()=>{ const cur=rq.result; if(cur){ out[cur.key]=cur.value; cur.continue(); } else ok(out); }; rq.onerror=()=>ko(rq.error); }); }
async function pjPutRaw(id, v){ const db = await pjDB(); return new Promise((ok,ko)=>{ const tx = db.transaction('pj','readwrite'); tx.objectStore('pj').put(v, id); tx.oncomplete=ok; tx.onerror=()=>ko(tx.error); }); }
function blobToB64(b){ return new Promise(r=>{ const fr = new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(b); }); }
async function b64ToBlob(u){ return (await fetch(u)).blob(); }

/* ---------------------------------- Alertes du suivi (accueil) ---------------------------------- */
function suiviAlerts(out){
  const t = today();
  contratsEnCours().forEach(c=>{
    const S = (STATE.suivi||{})[c.id]; if(!S || !Object.keys(S.days||{}).length) return;   // module non utilisé pour cet enfant
    // journées passées non renseignées depuis le début du mois précédent
    let n = 0; const from = new Date(t.getFullYear(), t.getMonth()-1, 1), sd = suiviDebut(c);
    for(let d = from; d < t; d = addDays(d,1)){ if(sd && d<sd) continue; if(!inContract(c,d)) continue; if(plannedDay(c,d).min && !dayRec(c.id, iso(d))) n++; }
    if(n) out.push({lvl:'warn', html:'<b>'+esc(c.enfant||'Enfant')+'</b> : '+n+' journée(s) passée(s) à renseigner dans le suivi.', act:'<button class="btn small" onclick="openSuivi(\'cal\',\''+c.id+'\')">Compléter</button>'});
    const prev = isoMonth(new Date(t.getFullYear(), t.getMonth()-1, 1)), mr = (S.months||{})[prev];
    if(t.getDate() <= 10 && (!mr || ['ouvert','avalider'].includes(mr.st))) out.push({lvl:'info', html:'Suivi de <b>'+esc(c.enfant||'')+'</b> : le mois de '+fmtMonth(prev)+' n\'est pas encore clôturé.', act:'<button class="btn small" onclick="openSuivi(\'mois\',\''+c.id+'\',\''+prev+'\')">Voir le mois</button>'});
    const fe = finEssai(c); if(fe){ const j = Math.ceil((fe-t)/86400000); if(j>=0 && j<=7) out.push({lvl:'warn', html:'Fin de la période d\'essai de <b>'+esc(c.enfant||'')+'</b> dans '+j+' jour(s) ('+fe.toLocaleDateString('fr-FR')+').'}); }
  });
  // Agrément : enfants présents en même temps (d'après les horaires du jour)
  const k = iso(t), agr = parseInt(STATE.settings.agrement)||R('agrementMax');
  const ints = [];
  contratsEnCours().forEach(c=>{ const x = calcDay(c, t, k); if(x.acc){ const a = hmToMin((x.r&&x.r.a)||x.pl.s), b = hmToMin((x.r&&x.r.dep)||x.pl.e); if(a!==null && b!==null) ints.push([a,b]); } });
  for(let m=0; m<24*60; m+=15){ if(ints.filter(v=>v[0]<=m && m<v[1]).length > agr){ out.push({lvl:'err', html:'Aujourd\'hui vers '+minToHM(m)+', plus de '+agr+' enfants sont présents en même temps : au-delà de votre agrément.'}); break; } }
  // Paramètres réglementaires anciens
  if((t - parseD(REG.version))/86400000 > 365) out.push({lvl:'warn', html:'La réglementation du carnet date de plus d\'un an : recherchez les mises à jour.'});
}
