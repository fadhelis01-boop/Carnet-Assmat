/* =====================================================================================
   INTERFACE : onglets par rythme d'usage (jour / mois / année), reprise de session,
   mises à jour de l'application, stockage protégé, erreurs. Lancement de l'application.
   ===================================================================================== */
'use strict';
let HOME_TAB = 'accueil';
let DASH_YM = null, ANNEE = null;
const TAB_TITLES = {accueil:'Aujourd\'hui', mois:'Le mois', annee:'L\'année', enfants:'Mes enfants', outils:'Outils'};
const THEME_TAB = {suivi:'accueil', mois:'mois', ccass:'mois', ie:'outils', mensu:'outils', cp:'annee', fin:'enfants', docs:'enfants',
  contrat:'enfants', abattement:'annee', cmg:'outils', reglages:'outils', aide:'outils'};

/* ---------------------------------- Onglets ---------------------------------- */
function goTab(t){
  HOME_TAB = t;
  if(CURRENT !== 'home') showHome(false, t);
  else { renderTabs(); try{ history.replaceState({theme:'home', tab:t}, '', '#'); }catch(e){} window.scrollTo(0,0); afterNavigate(); }
}
function renderTabs(){
  document.querySelectorAll('.tab-panel').forEach(p=>p.style.display = p.id==='tab-'+HOME_TAB ? 'block' : 'none');
  $('topbar-title').innerHTML = '<span class="tag">Carnet Assmat</span>'+esc(TAB_TITLES[HOME_TAB]||'');
  if(HOME_TAB==='accueil') renderAccueil();
  if(HOME_TAB==='mois') renderMoisDash();
  if(HOME_TAB==='annee') renderAnnee();
  if(HOME_TAB==='outils') renderOutils();
  highlightTab();
}
function highlightTab(){
  const t = CURRENT==='home' ? HOME_TAB : (THEME_TAB[CURRENT]||'');
  document.querySelectorAll('#tabbar button').forEach(b=>b.classList.toggle('on', b.dataset.tab===t));
}

/* ---------------------------------- Aujourd'hui ---------------------------------- */
function renderAccueil(){
  const p = STATE.profil||{}, t = today();
  setHTML('hello', 'Bonjour'+(p.nom?' '+esc(p.nom.split(' ')[0]):'')+' · <span>'+t.toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'long'})+'</span>');
  // Premiers pas, tant que l'essentiel n'est pas fait
  const steps = [
    {ok: !!p.nom, t:'Renseigner mon profil (nom, agrément)', a:"showTheme('reglages')"},
    {ok: STATE.contrats.length>0, t:'Ajouter mon premier enfant', a:"editContrat(null)"},
    {ok: !!STATE.lastExport, t:'Faire une première copie de sécurité', a:'syncExport()'},
    {ok: isStandalone(), t:'Installer l\'application sur le téléphone', a:"showTheme('aide')", opt:true},
    {ok: !!(STATE.ui||{}).demoVue || STATE.contrats.length>0, t:'Découvrir avec un exemple (sans risque)', a:'STATE.ui.demoVue=1;startDemo()', opt:true}
  ];
  const todoSteps = steps.filter(s=>!s.ok);
  if(todoSteps.length && !(STATE.ui||{}).onboardingDone){
    setHTML('onboarding', '<div class="box onboard"><div class="section-label">Pour bien démarrer</div>'
      + steps.map(s=>'<div class="ob-step'+(s.ok?' done':'')+'">'+(s.ok?'✔':'○')+' '+(s.ok?esc(s.t):'<a href="#" onclick="'+s.a+';return false;">'+esc(s.t)+'</a>')+(s.opt&&!s.ok?' <span class="hint">(conseillé)</span>':'')+'</div>').join('')
      + '<div class="hint" style="margin-top:8px"><a href="#" onclick="STATE.ui.onboardingDone=1;saveState();renderAccueil();return false;">Masquer</a></div></div>');
  } else setHTML('onboarding', '');
  // À faire : les points les plus urgents seulement
  const al = computeAlerts().sort((a,b)=>({err:0,warn:1,info:2}[a.lvl]-{err:0,warn:1,info:2}[b.lvl]));
  const top = al.filter(a=>a.lvl!=='info').slice(0,4);
  const shown = top.length ? top : al.slice(0,2);
  setHTML('todo', shown.map(a=>'<div class="alert '+a.lvl+'">'+(a.lvl==='err'?'⛔ ':a.lvl==='warn'?'⚠️ ':'ℹ️ ')+a.html+(a.act?'<div class="a-act">'+a.act+'</div>':'')+'</div>').join('')
    + (al.length > shown.length ? '<a href="#" class="hint" onclick="goTab(\'enfants\');setTimeout(()=>$(\'alerts-wrap\').scrollIntoView(),50);return false;">Voir les '+al.length+' points</a>' : ''));
  show('todo-wrap', shown.length>0);
  // La journée : suivi (par défaut) ou résumé des enfants
  const list = suiviContrats().filter(c=>contratActif(c, t) || parseD(c.debut)>t);
  if(!STATE.contrats.length){ setHTML('home-today', '<div class="info-box">Aucun enfant enregistré. <a href="#" onclick="editContrat(null);return false;">Ajouter un enfant</a></div>'); return; }
  if(STATE.settings.suivi !== 0){
    setTxt('today-title', '🗓️ La journée');
    if(!SV.date) SV.date = iso(t);
    setHTML('home-today', renderJour(list));
  } else {
    setTxt('today-title', '👶 Mes enfants aujourd\'hui');
    setHTML('home-today', list.filter(c=>contratActif(c,t)).map(c=>{
      const pl = plannedDay(c, t);
      return '<div class="kid" style="margin-bottom:10px"><div class="kname">'+esc(c.enfant||'')+'</div><div class="kfam">'+(pl.min?'Prévu aujourd\'hui : '+(pl.s&&pl.e?pl.s+' – '+pl.e+' · ':'')+fmtH(pl.min):'Pas d\'accueil prévu aujourd\'hui')+'</div>'
        + '<div class="kactions"><button class="btn small primary" onclick="preparerDeclaration(\''+c.id+'\',curMonth())">Salaire du mois</button><button class="btn small" onclick="openFor(\'ccass\',\''+c.id+'\')">Absence</button></div></div>';
    }).join('') || '<div class="info-box">Aucun accueil aujourd\'hui.</div>');
  }
}
function isStandalone(){ return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true; }

/* ---------------------------------- Le mois : parcours de paie par enfant ---------------------------------- */
function defaultDashYm(){ const t = today(); return t.getDate() <= 10 ? isoMonth(new Date(t.getFullYear(), t.getMonth()-1, 1)) : isoMonth(t); }
function renderMoisDash(){
  if(!DASH_YM) DASH_YM = defaultDashYm();
  const ym = DASH_YM, d0 = parseD(ym), t = today();
  const debM = d0, finM = new Date(d0.getFullYear(), d0.getMonth()+1, 0);
  const list = STATE.contrats.filter(c=>{ const a=parseD(c.debut), b=parseD(c.fin); return !(a && a>finM) && !(b && b<debM); });
  const ouv = new Date(d0.getFullYear(), d0.getMonth(), 25), lim = new Date(d0.getFullYear(), d0.getMonth()+1, 5);
  const jr = Math.ceil((lim - t)/86400000);
  let h = '<div class="box" style="display:flex;align-items:center;justify-content:space-between">'
    + '<button class="icon-btn" onclick="DASH_YM=isoMonth(new Date('+d0.getFullYear()+','+(d0.getMonth()-1)+',1));renderMoisDash();afterNavigate()" aria-label="Mois précédent">‹</button>'
    + '<div style="text-align:center"><b>'+fmtMonth(ym)+'</b><div class="hint" style="margin:2px 0 0">Déclaration Pajemploi du '+ouv.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' au '+lim.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})
    + (t>=ouv && t<=lim ? ' · <b>'+(jr>0?'encore '+jr+' j':'dernier jour')+'</b>' : '')+'</div></div>'
    + '<button class="icon-btn" onclick="DASH_YM=isoMonth(new Date('+d0.getFullYear()+','+(d0.getMonth()+1)+',1));renderMoisDash();afterNavigate()" aria-label="Mois suivant">›</button></div>';
  if(!list.length){ setHTML('home-mois', h+'<div class="info-box">Aucun contrat ce mois-ci.</div>'); return; }
  let totNet = 0, totFrais = 0, estim = false;
  list.forEach(c=>{
    const J = journalOf(c.id)[ym], S = (STATE.suivi||{})[c.id], useSuivi = !!(S && Object.keys(S.days||{}).length);
    const mr = (S && S.months && S.months[ym]) || {st:'ouvert'};
    let net, frais, M = null;
    if(J){ net = J.net; frais = (J.ie||0)+(J.repas||0)+(J.km||0); }
    else if(useSuivi){ M = suiviMonth(c, ym); net = M.net; frais = M.T.ie+M.T.repas+M.T.kmEur; estim = true; }
    else { const dv = derive(c, d0); net = dv.net; frais = dv.ieMois+dv.repasMois+dv.km; estim = true; }
    totNet += net; totFrais += frais;
    const todo = useSuivi ? (M || suiviMonth(c, ym)).T.todo : 0;
    const passe = finM < t;
    const steps = [];
    if(useSuivi) steps.push({b:'Compléter les journées', ok: todo===0 && (passe || t>=ouv), cur: todo>0, t: todo ? todo+' journée(s) à renseigner' : 'Journées renseignées', a: todo ? "openSuivi('cal','"+c.id+"','"+ym+"')" : ''});
    if(useSuivi) steps.push({b: mr.st==='avalider' ? 'Noter la validation' : 'Envoyer le récapitulatif', ok: ['valide','cloture','declare','paye'].includes(mr.st), cur: mr.st==='avalider', t: mr.st==='avalider' ? 'Récapitulatif envoyé, en attente de validation' : ['valide','cloture','declare','paye'].includes(mr.st) ? 'Récapitulatif validé / clôturé' : 'Récapitulatif à envoyer aux parents', a: "openSuivi('mois','"+c.id+"','"+ym+"')"});
    steps.push({b:'Préparer la déclaration', ok: !!J, t: J ? 'Déclaré sur Pajemploi (net '+fmtEUR(J.net)+')' : 'Déclaration Pajemploi à préparer', a: J ? "preparerDeclaration('"+c.id+"','"+ym+"')" : (useSuivi ? "suiviVersPaie('"+c.id+"','"+ym+"')" : "preparerDeclaration('"+c.id+"','"+ym+"')")});
    steps.push({b:'Marquer payé', ok: !!mr.payeLe, t: mr.payeLe ? 'Payé le '+fmtDate(mr.payeLe) : 'Salaire à recevoir', a: mr.payeLe ? '' : "suiviPaye('"+c.id+"','"+ym+"')"});
    const next = steps.find(s=>!s.ok);
    h += '<div class="kid" style="margin-bottom:12px"><div class="kname">'+esc(c.enfant||'')+'</div><div class="kfam">'+esc(c.famille||'')+'</div>'
      + '<div class="stepper">'+steps.map(s=>'<div class="sp '+(s.ok?'done':s.cur?'cur':'')+'">'+(s.ok?'✔':'○')+' '+(s.a?'<a href="#" onclick="'+s.a+';return false;">'+esc(s.t)+'</a>':esc(s.t))+'</div>').join('')+'</div>'
      + '<div class="kline"><span>Salaire net'+(J?'':' (estimation)')+'</span><b>'+fmtEUR(net)+'</b></div>'
      + '<div class="kline"><span>Entretien, repas, km</span><b>'+fmtEUR(frais)+'</b></div>'
      + (next && next.a ? '<button class="btn small primary" style="margin-top:8px" onclick="'+next.a+'">'+esc(next.b)+' →</button>' : (next?'':'<div class="hint" style="margin-top:6px">✔ Mois terminé pour cet enfant.</div>'))
      + '</div>';
  });
  h += '<div class="month-total"><div class="mt-row"><span>Total du mois'+(estim?' (en partie estimé)':'')+'</span></div>'
    + '<div class="mt-row"><span>Salaires nets</span><b>'+fmtEUR(totNet)+'</b></div><div class="mt-row"><span>Indemnités et frais</span><b>'+fmtEUR(totFrais)+'</b></div>'
    + '<div class="mt-row mt-big"><span>Total perçu</span><b>'+fmtEUR(totNet+totFrais)+'</b></div></div>'
    + '<div class="btn-row"><button class="btn small" onclick="showTheme(\'ccass\')">Absence à calculer</button><button class="btn small" onclick="openSuivi(\'mois\',null,DASH_YM)">Détail du suivi</button></div>';
  setHTML('home-mois', h);
}

/* ---------------------------------- L'année : échéances et bilan ---------------------------------- */
function renderAnnee(){
  if(!ANNEE) ANNEE = today().getFullYear();
  const y = ANNEE, t = today(), ev = [];
  const add = (date, titre, txt, act, done)=>ev.push({date, titre, txt, act, done});
  const regChecked = STATE.regCheckedAt && new Date(STATE.regCheckedAt) >= new Date(y,0,1);
  add(new Date(y,0,1), 'Nouvelles valeurs légales', 'SMIC, minimum garanti, salaire minimum : vérifiez que le carnet est à jour.', "regCheckUpdates(false)", regChecked);
  add(new Date(y,2,1), 'Dates de congés', 'Fixer les dates de congés de l\'été avec chaque famille (au plus tard le 1er mars).', null, false);
  const abY = ((STATE.forms.abattement||{}).all||{i:{}}).i['ab-annee'];
  add(new Date(y,3,15), 'Déclaration de revenus '+(y-1), 'Préparer l\'abattement fiscal des assistantes maternelles (avril à juin, selon votre département).', "openAbattement("+(y-1)+")", String(abY)===String(y-1));
  add(new Date(y,4,31), 'Fin de la période de congés', 'Les congés acquis du 1er juin au 31 mai sont arrêtés. En juin : comparaison maintien / 10 % (année complète) ou paiement prévu au contrat (année incomplète).', "showTheme('cp')", false);
  add(new Date(y,5,1), 'Revalorisations du 1er juin', 'Le minimum garanti et parfois le salaire minimum changent souvent à cette date.', "regCheckUpdates(false)", false);
  STATE.contrats.forEach(c=>{
    const deb = parseD(c.debut), fin = parseD(c.fin), nom = esc(c.enfant||'');
    if(deb && deb.getFullYear() < y && !(fin && fin < new Date(y,0,1))) add(new Date(y, deb.getMonth(), deb.getDate()), 'Date anniversaire — '+nom, 'Une année d\'ancienneté de plus ; le compteur des 5 jours d\'absence pour maladie repart à zéro.', null, false);
    if(paramsAt(c, new Date(y,6,1)).type===1 && !(fin && fin < new Date(y,6,1))) add(new Date(y,6,1), 'Semaines d\'accueil de la rentrée — '+nom, 'Année incomplète : notez les semaines sans accueil de la prochaine année scolaire (vacances scolaires en un appui).', "editContrat('"+c.id+"')", false);
    if(fin && fin.getFullYear()===y) add(fin, 'Fin du contrat — '+nom, 'Préavis, congés, régularisation, indemnité de rupture et documents.', "openFor('fin','"+c.id+"')", fin < t);
  });
  const ag = parseD((STATE.profil||{}).agrementDate);
  if(ag){ const ech = new Date(ag.getFullYear()+(parseInt((STATE.profil||{}).agrementDuree)||5), ag.getMonth(), ag.getDate()); if(ech.getFullYear()===y || ech.getFullYear()===y+1 && ech.getMonth()<3) add(new Date(ech.getFullYear(), ech.getMonth()-4, ech.getDate()), 'Renouvellement de l\'agrément', 'Échéance le '+ech.toLocaleDateString('fr-FR')+' : demande à faire au moins 4 mois avant (PMI).', null, false); }
  add(new Date(y,11,31), 'Copie de sécurité de l\'année', 'Gardez une copie de vos données de l\'année (Drive, mail).', 'syncExport()', STATE.lastExport && new Date(STATE.lastExport) >= new Date(y,11,1));
  ev.sort((a,b)=>a.date-b.date);
  let h = '<div class="box" style="display:flex;align-items:center;justify-content:space-between">'
    + '<button class="icon-btn" onclick="ANNEE--;renderAnnee();afterNavigate()" aria-label="Année précédente">‹</button><b>'+y+'</b>'
    + '<button class="icon-btn" onclick="ANNEE++;renderAnnee();afterNavigate()" aria-label="Année suivante">›</button></div>';
  h += '<div class="h-sec">📌 Échéances</div><div class="timeline">'
    + ev.map(e=>{ const passe = e.date < t; const st = e.done ? 'done' : passe ? 'past' : (e.date - t)/86400000 < 45 ? 'soon' : '';
      return '<div class="tl '+st+'"><div class="tl-d">'+e.date.toLocaleDateString('fr-FR',{day:'numeric', month:'short'})+'</div><div class="tl-b"><b>'+(e.done?'✔ ':'')+e.titre+'</b><div class="hint" style="margin:2px 0 0">'+e.txt+'</div>'
        + (e.act && !e.done ? '<a href="#" onclick="'+e.act+';return false;">Y aller →</a>' : '')+'</div></div>'; }).join('')+'</div>';
  // Bilan de l'année (mois validés)
  const rows = STATE.contrats.map(c=>({c, T: journalTotals(c.id, y+'-01', y+'-12')})).filter(r=>r.T.n);
  h += '<div class="h-sec">📊 Bilan '+y+' (mois validés)</div>';
  if(!rows.length) h += '<div class="info-box">Aucun mois validé en '+y+'. Les mois validés dans « Salaire du mois & Pajemploi » apparaissent ici.</div>';
  else {
    const tot = {brut:0, net:0, netImp:0, ind:0};
    h += '<div class="ab-table-wrap"><table class="ab-table" style="min-width:520px"><thead><tr><th>Enfant</th><th>Mois</th><th>Brut</th><th>Net</th><th>Net imposable</th><th>Entretien, repas, km</th></tr></thead><tbody>'
      + rows.map(r=>{ const ind = r.T.ie+r.T.repas+r.T.km; tot.brut+=r.T.brut; tot.net+=r.T.net; tot.netImp+=r.T.netImp; tot.ind+=ind;
          return '<tr><td>'+esc(r.c.enfant||'')+'</td><td>'+r.T.n+'</td><td class="ab-out">'+fmtEUR(r.T.brut)+'</td><td class="ab-out">'+fmtEUR(r.T.net)+'</td><td class="ab-out">'+fmtEUR(r.T.netImp)+'</td><td class="ab-out">'+fmtEUR(ind)+'</td></tr>'; }).join('')
      + '<tr class="ab-total-row"><td>Total</td><td></td><td class="ab-out">'+fmtEUR(tot.brut)+'</td><td class="ab-out">'+fmtEUR(tot.net)+'</td><td class="ab-out">'+fmtEUR(tot.netImp)+'</td><td class="ab-out">'+fmtEUR(tot.ind)+'</td></tr></tbody></table></div>';
  }
  h += '<div class="btn-row"><button class="btn small" onclick="openAbattement('+y+')">Impôts sur '+y+'</button><button class="btn small" onclick="showTheme(\'cp\')">Congés payés</button><button class="btn small" onclick="openDocs()">Récapitulatifs annuels</button></div>';
  setHTML('home-annee', h);
}
function openAbattement(y){
  showTheme('abattement');
  if(String(val('ab-annee'))!==String(y)){ setVal('ab-annee', y); VIS.abattement(); abFillFromContracts(true); CALC.abattement(); persistTheme('abattement'); }
}

/* ---------------------------------- Outils ---------------------------------- */
function renderOutils(){
  regRenderStatus();
  setHTML('app-version', 'Carnet Assmat '+APP_VERSION+' · réglementation du '+fmtDate(REG.version)+(location.protocol==='file:'?' · version « fichier »':''));
  if(navigator.storage && navigator.storage.estimate){
    navigator.storage.estimate().then(e=>{
      const used = (e.usage||0)/1024/1024;
      navigator.storage.persisted ? navigator.storage.persisted().then(p=>setTxt('storage-status', 'Place utilisée : '+fmtNum(used,1)+' Mo. '+(p?'Stockage protégé : le téléphone ne l\'effacera pas pour faire de la place.':'Stockage non protégé : installez l\'application pour éviter tout effacement automatique.'))) : null;
    }).catch(()=>{});
  }
  if(location.protocol==='file:') setTxt('storage-status', 'Version « fichier » : les données sont propres à ce fichier dans ce navigateur. Pour les retrouver dans l\'application installée : copie de sécurité ici, puis « Restaurer une copie » là-bas.');
}

/* =====================================================================================
   REPRISE DE SESSION : l'application rouvre là où vous en étiez
   ===================================================================================== */
function uiState(){ return STATE.ui = STATE.ui || {}; }
let _booting = true;   // pendant le démarrage, on lit la session précédente sans l'écraser
function afterNavigate(){
  if(_booting){ highlightTab(); return; }
  const u = uiState();
  u.tab = HOME_TAB; u.theme = CURRENT==='home' ? null : CURRENT;
  u.sv = {tab:SV.tab, cid:SV.cid, ym:SV.ym}; u.dashYm = DASH_YM; u.annee = ANNEE; u.docsId = typeof DOCS_ID!=='undefined' ? DOCS_ID : null;
  u.at = new Date().toISOString();
  highlightTab();
  saveState();
}
function uiSaveDraft(){
  const u = uiState();
  if(CURRENT==='contrat' && CT){ const c = clone(CT); delete c._orig; u.ctDraft = {ct:c, step:CT_STEP, isNew:CT_IS_NEW, orig: CT._orig||null}; }
  saveState();
}
function uiSaveDay(){
  const u = uiState();
  if($('day-overlay').classList.contains('show') && typeof DE!=='undefined' && DE){
    const f = {}; $('day-body').querySelectorAll('input[id],select[id],textarea[id]').forEach(el=>{ if(el.type!=='file') f[el.id] = el.type==='checkbox' ? el.checked : el.value; });
    u.dayDraft = {cid:DE.cid, k:DE.k, r:DE.r, f};
  } else delete u.dayDraft;
}
function uiSnapshot(){ const u = uiState(); u.scroll = window.scrollY; uiSaveDay(); if(CURRENT==='contrat') uiSaveDraft(); if(CURRENT!=='home' && !['contrat','reglages','aide','docs','suivi'].includes(CURRENT)) persistTheme(CURRENT); u.at = new Date().toISOString(); }
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden'){ uiSnapshot(); saveNow(); } });
window.addEventListener('pagehide', ()=>{ uiSnapshot(); saveNow(); });
document.addEventListener('input', e=>{ if(e.target.closest && e.target.closest('#day-overlay')){ clearTimeout(window._dayT); window._dayT = setTimeout(()=>{ uiSaveDay(); saveState(); }, 400); } });
/* Restaure l'écran, le brouillon et la position de la dernière session */
function resumeSession(){
  const u = uiState();
  if(u.sv){ SV.tab = u.sv.tab||'jour'; SV.cid = u.sv.cid||null; SV.ym = u.sv.ym||null; }
  SV.date = iso(today());
  DASH_YM = u.dashYm || null; ANNEE = u.annee || null;
  if(typeof DOCS_ID!=='undefined' && u.docsId) DOCS_ID = u.docsId;
  HOME_TAB = u.tab || 'accueil';
  const ageH = u.at ? (Date.now() - new Date(u.at))/3600000 : 999;
  const restoreScroll = ()=>{ if(u.scroll) setTimeout(()=>window.scrollTo(0, u.scroll), 80); };
  // Fiche « enfant » en cours de saisie
  if(u.ctDraft && (u.theme==='contrat' || ageH < 72)){
    const d = u.ctDraft;
    if(u.theme==='contrat'){ restoreContratDraft(d); restoreScroll(); return; }
  }
  // Retour exact à l'écran quitté si la session est récente ; sinon accueil avec proposition de reprise
  if(u.theme && $('theme-'+u.theme) && u.theme!=='contrat'){
    if(ageH < 12){
      try{ history.replaceState({theme:'home', tab:HOME_TAB}, '', '#'); }catch(e){}
      showTheme(u.theme); restoreScroll();
      if(u.dayDraft) restoreDayDraft(u.dayDraft);
      return;
    }
    showHome(true, 'accueil');
    toast('Reprendre là où vous en étiez : '+(THEME_TITLES[u.theme]||''), {label:'Reprendre', fn:()=>{ showTheme(u.theme); if(u.dayDraft) restoreDayDraft(u.dayDraft); }});
    return;
  }
  showHome(true, ageH < 12 ? HOME_TAB : 'accueil');
  if(ageH < 12) restoreScroll();
  if(u.dayDraft) restoreDayDraft(u.dayDraft);
}
function restoreContratDraft(d){
  CT_IS_NEW = d.isNew; CT = clone(d.ct); CT._orig = d.orig || (d.isNew ? null : paramsOf(getContrat(CT.id)||CT));
  setTxt('ct-title', CT_IS_NEW ? 'Nouvel enfant' : 'Modifier : '+(CT.enfant||'enfant'));
  CT_TEXT.forEach(k=>setVal('ct-'+k, CT[k]));
  setSegVal('ct-handicap', CT.handicap); setSegVal('ct-type', CT.type); setSegVal('ct-titre', CT.titre); setSegVal('ct-alterne', CT.alterne);
  setSegVal('ct-ieMode', CT.ieMode); setSegVal('ct-repasMode', CT.repasMode); setSegVal('ct-cpMode', CT.cpMode); setSegVal('ct-horaires', CT.horaires||0);
  for(let i=0;i<7;i++){ setVal('ct-wA'+i, CT.wA[i]); setVal('ct-wB'+i, CT.wB[i]); ['A','B'].forEach(w=>{ const tt=(CT['t'+w]||[])[i]||[]; setVal('ct-w'+w+i+'s', tt[0]||''); setVal('ct-w'+w+i+'e', tt[1]||''); }); }
  const rp = CT.rep||{}; REP_KEYS.forEach(k=>setVal('ct-rep-'+k, rp[k]));
  CT_STEP = d.step||0;
  try{ history.replaceState({theme:'home', tab:'enfants'}, '', '#'); }catch(e){}
  showTheme('contrat'); ctRefresh();
  toast('Fiche de '+(CT.enfant||'l\'enfant')+' reprise là où vous l\'aviez laissée.');
}
function restoreDayDraft(dd){
  if(!getContrat(dd.cid)) return;
  dayEdit(dd.cid, dd.k);
  if(typeof DE!=='undefined' && DE){ DE.r = Object.assign(DE.r, dd.r||{}); deRenderFrais(); deRenderPreuves(); }
  Object.keys(dd.f||{}).forEach(id=>{ const el=$(id); if(!el) return; if(el.type==='checkbox'){ el.checked = !!dd.f[id]; if(el.parentElement) el.parentElement.classList.toggle('on', el.checked); } else el.value = dd.f[id]; });
  deVis();
  toast('Journée en cours de saisie reprise.');
}

/* =====================================================================================
   MISES À JOUR DE L'APPLICATION (sans perte de données)
   ===================================================================================== */
let _swReg = null, _reloading = false, _updateAsked = false;
function showUpdateBar(){ show('update-bar', true, 'flex'); }
function applyUpdate(){
  uiSnapshot(); saveNow(); _updateAsked = true;
  if(_swReg && _swReg.waiting) _swReg.waiting.postMessage('SKIP_WAITING'); else location.reload();
}
if('serviceWorker' in navigator && /^https?:/.test(location.protocol) && !TEST_MODE){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      _swReg = reg;
      if(reg.waiting && navigator.serviceWorker.controller) showUpdateBar();
      reg.addEventListener('updatefound', ()=>{
        const w = reg.installing; if(!w) return;
        w.addEventListener('statechange', ()=>{ if(w.state==='installed' && navigator.serviceWorker.controller) showUpdateBar(); });
      });
      // vérifie s'il existe une nouvelle version à chaque retour dans l'application
      document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') reg.update().catch(()=>{}); });
    }).catch(()=>{});
    // rechargement seulement après « Mettre à jour » (jamais à la première installation : la saisie en cours n'est pas coupée)
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{ if(_reloading || !_updateAsked) return; _reloading = true; location.reload(); });
  });
}
/* Connexion */
function netStatus(){ show('offline-bar', !navigator.onLine); }
window.addEventListener('online', ()=>{ netStatus(); toast('Connexion retrouvée.'); });
window.addEventListener('offline', netStatus);

/* =====================================================================================
   ROBUSTESSE : stockage protégé, erreurs, texte agrandi
   ===================================================================================== */
function protectStorage(){ try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{}); }catch(e){} }
let _errShown = false;
function logError(msg){
  try{ STATE.errors = (STATE.errors||[]).slice(-19); STATE.errors.push({t:new Date().toISOString(), v:APP_VERSION, m:String(msg).slice(0,400)}); saveState(); }catch(e){}
  if(!_errShown){ _errShown = true; toast('Un petit problème est survenu. Vos données sont conservées ; si cela se répète, signalez-le (Aide ▸ rapport).'); }
}
window.addEventListener('error', e=>logError((e.message||'erreur')+' @'+(e.filename||'').split('/').pop()+':'+(e.lineno||'')));
window.addEventListener('unhandledrejection', e=>logError('promesse : '+((e.reason && e.reason.message)||e.reason)));
function copyErrorReport(){
  const txt = 'Carnet Assmat '+APP_VERSION+' — '+navigator.userAgent+'\n'+(STATE.errors||[]).map(x=>x.t+' ['+x.v+'] '+x.m).join('\n');
  try{ navigator.clipboard.writeText(txt); toast('Rapport copié (il ne contient aucune donnée personnelle).'); }catch(e){ toast('Copie impossible ici.'); }
}
function applyFontSize(){ document.documentElement.style.fontSize = ['100%','112%','125%'][STATE.settings.font||0]; }

/* =====================================================================================
   ACCESSIBILITÉ (lecteurs d'écran, clavier) : appliquée automatiquement à tout l'écran,
   y compris aux parties créées dynamiquement (tableaux, calendriers, fiches)
   ===================================================================================== */
let _a11yN = 0;
function a11yName(el){
  if(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return;
  if(el.id && document.querySelector('label[for="'+CSS.escape(el.id)+'"]')) return;
  if(el.closest('label')) return;
  // 1) champ dans une « field » : on relie le libellé
  const f = el.closest('.field');
  const lab = f && f.querySelector(':scope > label');
  if(lab){
    if(!el.id) el.id = 'a11y-'+(++_a11yN);
    if(!lab.htmlFor){ lab.htmlFor = el.id; return; }
    el.setAttribute('aria-label', lab.textContent.trim()); return;
  }
  // 2) tableau (impôts, historique) : en-tête de colonne + libellé de ligne
  const td = el.closest('td');
  if(td){
    const tr = td.parentElement, table = td.closest('table');
    const th = table && table.querySelectorAll('thead th')[td.cellIndex];
    const lign = tr.cells[0] ? tr.cells[0].textContent.trim() : '';
    el.setAttribute('aria-label', ((th?th.textContent.trim():'')+' — '+lign).trim()); return;
  }
  // 3) planning de la semaine / calendrier du mois
  const wd = el.closest('.wday, .cal-day');
  if(wd){
    const n = wd.querySelector('.dname'), d = wd.querySelector('.dnum');
    const quoi = el.classList.contains('tm') ? (/s$/.test(el.id)?'heure d\'arrivée':'heure de départ') : el.classList.contains('sup') ? 'heures majorées' : 'heures';
    el.setAttribute('aria-label', quoi+' — '+((n?n.textContent:'')+' '+(d?d.textContent:'')).trim()); return;
  }
  if(el.placeholder) el.setAttribute('aria-label', el.placeholder);
}
function a11yPass(root){
  root = root || document;
  root.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(a11yName);
  root.querySelectorAll('.seg').forEach(g=>{
    g.setAttribute('role','group');
    const q = g.parentElement && g.parentElement.querySelector(':scope > .q');
    if(q && !g.getAttribute('aria-label')) g.setAttribute('aria-label', q.textContent.trim());
    [...g.children].forEach(b=>b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false'));
  });
  root.querySelectorAll('.chips .chip').forEach(b=>{ if(b.tagName==='BUTTON') b.setAttribute('aria-pressed', b.classList.contains('on')?'true':'false'); });
  root.querySelectorAll('.overlay > .dlg').forEach(d=>{
    d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true');
    const h = d.querySelector('h3'); if(h){ if(!h.id) h.id = 'a11y-h-'+(++_a11yN); d.setAttribute('aria-labelledby', h.id); }
  });
  root.querySelectorAll('.cal-day.sv').forEach(b=>{ if(!b.getAttribute('aria-label') && b.dataset.lbl) b.setAttribute('aria-label', b.dataset.lbl); });
}
let _a11yT = null;
new MutationObserver(()=>{ clearTimeout(_a11yT); _a11yT = setTimeout(()=>a11yPass(document), 120); }).observe(document.body, {childList:true, subtree:true});
/* Fenêtres : focus dans la fenêtre à l'ouverture, retour au bouton d'origine à la fermeture, touche Échap */
let _lastFocus = null;
new MutationObserver(muts=>muts.forEach(m=>{
  const o = m.target; if(!o.classList || !o.classList.contains('overlay')) return;
  if(o.classList.contains('show')){
    _lastFocus = document.activeElement;
    setTimeout(()=>{ const f = o.querySelector('input:not([type=hidden]),select,textarea,button'); if(f) f.focus(); }, 60);
  } else if(_lastFocus && document.body.contains(_lastFocus)){ try{ _lastFocus.focus(); }catch(e){} }
})).observe(document.body, {attributes:true, attributeFilter:['class'], subtree:true});
document.addEventListener('keydown', e=>{
  if(e.key!=='Escape') return;
  const o = [...document.querySelectorAll('.overlay.show')].pop();
  if(!o || o.id==='lock-overlay') return;
  if(o.id==='confirm-overlay') confirmNo(); else if(o.id==='prompt-overlay') promptCancel(); else if(o.id==='pc-overlay') pcCancel(); else closeOverlay(o.id);
});

/* ---------------------------------- Lancement ---------------------------------- */
// mode test (tests.html) : l'application ne lit que le stockage, n'écrit jamais rien
if(TEST_MODE){ window.saveNow = ()=>{}; window.saveState = ()=>{}; }
function launch(){
  init();
  applyFontSize(); netStatus();
  a11yPass(document);
  if(typeof demoBanner==='function') demoBanner();
  if(typeof setupFinSteps==='function') setupFinSteps();
  if(!TEST_MODE){ protectStorage(); try{ resumeSession(); }catch(e){ logError('reprise : '+e.message); showHome(true,'accueil'); } }
  _booting = false; afterNavigate();
}
if(TEST_MODE) launch(); else idbPreload().then(launch, launch);
