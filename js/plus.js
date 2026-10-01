/* =====================================================================================
   CONFORT D'USAGE : définitions d'un appui (lexique), « Fin de contrat » en étapes,
   mode démonstration (données d'exemple, jamais mélangées aux vraies)
   ===================================================================================== */
'use strict';

/* ---------------------------------- Lexique ---------------------------------- */
const LEXIQUE = [
  ['mensualis', 'Mensualisation', 'Le salaire est « lissé » : le même montant chaque mois, calculé sur les heures de toute l\'année divisées par 12, même les mois de vacances.'],
  ['année complète', 'Année complète', 'L\'enfant vient toutes les semaines de l\'année, sauf pendant les 5 semaines de congés payés de l\'assistante maternelle. Le salaire est calculé sur 52 semaines, congés compris.'],
  ['année incomplète', 'Année incomplète', 'L\'enfant ne vient pas certaines semaines en plus des congés (vacances scolaires…). Le salaire est calculé sur les seules semaines d\'accueil ; les congés payés sont payés en plus.'],
  ['régularisation', 'Régularisation', 'En fin de contrat (surtout en année incomplète), on compare ce qui a été payé avec les heures réellement dues : la différence est versée à l\'assistante maternelle.'],
  ['cour de cassation', 'Méthode de la Cour de cassation', 'Façon de calculer une absence imposée par les juges : salaire mensualisé × heures non travaillées ÷ heures prévues dans le mois.'],
  ['1/80', 'Indemnité de rupture (1/80ᵉ)', 'Le total des salaires bruts de tout le contrat, divisé par 80. Due quand les parents retirent l\'enfant après 9 mois de contrat.'],
  ['indemnité de rupture', 'Indemnité de rupture', 'Somme due par les parents qui retirent l\'enfant après 9 mois de contrat (sauf faute grave) : 1/80ᵉ des salaires bruts du contrat.'],
  ['entretien', 'Indemnité d\'entretien', 'Somme versée pour chaque jour de présence de l\'enfant, pour vos frais (eau, chauffage, jeux, produits…). Ce n\'est pas du salaire : pas de cotisations.'],
  ['minimum garanti', 'Minimum garanti (MG)', 'Montant fixé par l\'État qui sert à calculer l\'indemnité d\'entretien minimale (90 % du MG pour 9 heures).'],
  ['smic', 'SMIC', 'Salaire minimum légal en France. Il sert aussi à calculer votre abattement fiscal.'],
  ['pajemploi', 'Pajemploi', 'Service de l\'Urssaf où les parents déclarent chaque mois votre salaire. Il calcule les cotisations et établit votre bulletin de paie.'],
  ['cmg', 'CMG', 'Complément de libre choix du mode de garde : aide de la CAF ou de la MSA versée aux parents pour vous payer.'],
  ['abattement', 'Abattement fiscal', 'Somme retirée de vos revenus imposables pour chaque jour d\'accueil de chaque enfant (3 fois le SMIC horaire par jour en général).'],
  ['net imposable', 'Net imposable', 'Montant retenu pour l\'impôt sur le revenu : le salaire net plus une partie de la CSG.'],
  ['heures complémentaires', 'Heures complémentaires', 'Heures faites en plus du contrat, jusqu\'à 45 h dans la semaine : payées au tarif normal.'],
  ['heures majorées', 'Heures majorées', 'Heures faites au-delà de 45 h dans la semaine : payées avec une majoration d\'au moins 10 %.'],
  ['période de référence', 'Période de référence', 'Pour les congés payés : du 1er juin au 31 mai. Les jours gagnés pendant cette période se prennent ensuite.'],
  ['reliquat', 'Reliquat', 'Jours de congés gagnés mais pas encore pris.'],
  ['préavis', 'Préavis', 'Délai entre l\'annonce de la fin du contrat et le dernier jour : 8 jours, 15 jours ou 1 mois selon l\'ancienneté.'],
  ['période d\'essai', 'Période d\'essai', 'Début du contrat pendant lequel chacun peut arrêter sans préavis ni indemnité (2 ou 3 mois selon le nombre de jours d\'accueil).'],
  ['adaptation', 'Période d\'adaptation', 'Premiers jours où l\'enfant vient progressivement, sur des durées courtes (30 jours au plus, comprise dans l\'essai).'],
  ['avenant', 'Avenant', 'Document signé par les deux parties qui modifie le contrat (horaires, salaire…) à partir d\'une date.'],
  ['agrément', 'Agrément', 'Autorisation donnée par le département (service PMI) pour exercer, avec un nombre maximal d\'enfants. Valable 5 ans, ou 10 ans avec le CAP AEPE.'],
  ['maintien', 'Maintien de salaire', 'Méthode de calcul des congés payés : on paie ce que vous auriez gagné en travaillant pendant ces jours.'],
  ['dixième', 'Règle du dixième', 'Méthode de calcul des congés payés : 10 % des salaires bruts de la période de référence. On retient la plus favorable des deux méthodes.'],
  ['solde de tout compte', 'Solde de tout compte', 'Document qui liste toutes les sommes versées à la fin du contrat. Il peut être contesté pendant 6 mois après sa signature.'],
  ['engagement réciproque', 'Engagement réciproque', 'Promesse d\'embauche signée avant le début de l\'accueil. Celui qui y renonce doit à l\'autre un demi-mois de salaire brut.'],
  ['ircem', 'IRCEM', 'Caisse de retraite complémentaire et de prévoyance des salariés des particuliers employeurs. Elle complète vos indemnités en cas d\'arrêt maladie et verse l\'indemnité de départ à la retraite.'],
  ['am-ap', 'Titre AM-AP', 'Titre professionnel « assistant maternel / garde d\'enfants » : il donne droit à un salaire minimum plus élevé.'],
  ['jours ouvrables', 'Jours ouvrables', 'Tous les jours de la semaine sauf le dimanche et les jours fériés (6 par semaine). Une semaine de congés compte 6 jours ouvrables.'],
  ['brut', 'Brut et net', 'Le brut est le salaire avant les cotisations sociales ; le net est ce que vous recevez vraiment (environ 78 % du brut).']
];
const LEX_SCOPE = '.legal, .sub, .info-box, .warn-box, .net-hint, .alert, details.help > div, .intro';
function lexPass(root){
  (root||document).querySelectorAll(LEX_SCOPE).forEach(box=>{
    if(box.closest('#print-recap') || box.closest('.dlg')) return;
    LEXIQUE.forEach(([cle, titre], idx)=>{
      if(box.querySelector('.term[data-k="'+idx+'"]')) return;
      const re = new RegExp('(^|[^\\p{L}])('+cle.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&')+'[\\p{L}ᵉ]*)', 'iu');
      const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, {acceptNode: n=>{
        const p = n.parentElement; if(!p) return NodeFilter.FILTER_REJECT;
        if(p.closest('a, button, .term, input, select, textarea, label, b.sym, summary')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }});
      let n;
      while((n = tw.nextNode())){
        const m = re.exec(n.nodeValue); if(!m) continue;
        const start = m.index + m[1].length, mot = m[2];
        const after = n.splitText(start); after.splitText(mot.length);
        const sp = document.createElement('span');
        sp.className = 'term'; sp.dataset.k = idx; sp.tabIndex = 0; sp.setAttribute('role','button');
        sp.setAttribute('aria-label', mot+' : voir la définition');
        sp.textContent = mot; after.parentNode.replaceChild(sp, after);
        break;
      }
    });
  });
}
function openTerm(idx){
  const t = LEXIQUE[idx]; if(!t) return;
  setTxt('term-title', t[1]); setTxt('term-text', t[2]); openOverlay('term-overlay');
}
document.addEventListener('click', e=>{ const t = e.target.closest && e.target.closest('.term'); if(t){ e.preventDefault(); openTerm(+t.dataset.k); } });
document.addEventListener('keydown', e=>{ if((e.key==='Enter'||e.key===' ') && e.target.classList && e.target.classList.contains('term')){ e.preventDefault(); openTerm(+e.target.dataset.k); } });
let _lexT = null;
new MutationObserver(()=>{ clearTimeout(_lexT); _lexT = setTimeout(()=>lexPass(document), 200); }).observe(document.body, {childList:true, subtree:true});
function lexiqueHTML(){
  return LEXIQUE.slice().sort((a,b)=>a[1].localeCompare(b[1],'fr')).map(t=>'<p style="margin:0 0 8px"><b>'+esc(t[1])+'</b> — '+esc(t[2])+'</p>').join('');
}

/* ---------------------------------- Fin de contrat en 3 étapes ---------------------------------- */
let FIN_STEP = 1;
function setupFinSteps(){
  const th = $('theme-fin'); if(!th || th.dataset.steps) return;
  const labels = [...th.querySelectorAll(':scope > .section-label')];
  const stub = th.querySelector(':scope > .stub');
  if(labels.length < 2 || !stub) return;
  th.dataset.steps = '1';
  const mk = (n)=>{ const d = document.createElement('div'); d.className = 'fstep'; d.dataset.s = n; return d; };
  const s1 = mk(1), s2 = mk(2), s3 = mk(3);
  labels[0].before(s1);
  let el = s1.nextSibling;
  while(el && el !== labels[1]){ const nx = el.nextSibling; s1.appendChild(el); el = nx; }
  labels[1].before(s2);
  el = s2.nextSibling;
  while(el && el !== stub){ const nx = el.nextSibling; s2.appendChild(el); el = nx; }
  stub.before(s3); s3.appendChild(stub);
  const head = document.createElement('div');
  head.className = 'fin-steps-head'; head.id = 'fin-steps-head';
  s1.before(head);
  const nav = document.createElement('div');
  nav.className = 'step-nav'; nav.id = 'fin-steps-nav';
  s3.after(nav);
  FIN_STEP = (STATE.ui && STATE.ui.finStep) || 1;
  finShowStep(FIN_STEP);
}
function finShowStep(n){
  FIN_STEP = Math.max(1, Math.min(3, n));
  const th = $('theme-fin'); if(!th) return;
  th.querySelectorAll('.fstep').forEach(s=>s.classList.toggle('on', +s.dataset.s===FIN_STEP));
  const titres = ['Qui arrête, et quand ?', 'Ce qui reste à payer', 'Résultat et documents'];
  setHTML('fin-steps-head', '<div class="steps">'+[1,2,3].map(i=>'<span class="'+(i<=FIN_STEP?'on':'')+'"></span>').join('')+'</div>'
    + '<div class="hint" style="margin:-8px 0 12px">Étape '+FIN_STEP+' sur 3 : <b>'+titres[FIN_STEP-1]+'</b> · <a href="#" onclick="$(\'theme-fin\').classList.toggle(\'all\');return false;">tout voir sur une page</a></div>');
  finNavUpdate();
  if(STATE.ui){ STATE.ui.finStep = FIN_STEP; saveState(); }
  if(CURRENT==='fin') window.scrollTo(0, 0);
}
function finNavUpdate(){
  const nav = $('fin-steps-nav'); if(!nav) return;
  const tot = ($('out-fin-total')||{}).textContent || '—';
  nav.innerHTML = '<button class="btn" '+(FIN_STEP===1?'style="visibility:hidden"':'')+' onclick="finShowStep(FIN_STEP-1)">← Précédent</button>'
    + '<span class="hint" style="align-self:center">Total dû : <b>'+esc(tot)+'</b></span>'
    + (FIN_STEP<3 ? '<button class="btn primary" onclick="finShowStep(FIN_STEP+1)">Suivant →</button>' : '<button class="btn primary" onclick="openDocs(selKey(\'fin\')!==\'libre\'?selKey(\'fin\'):null)">Documents →</button>');
}

/* ---------------------------------- Mode démonstration ---------------------------------- */
function demoBanner(){
  if(!isDemo()) return;
  const b = document.createElement('div');
  b.className = 'demo-bar'; b.id = 'demo-bar';
  b.innerHTML = '🎓 <b>Démonstration</b> : données d\'exemple, vos vraies données sont à l\'abri. <button class="btn small" onclick="exitDemo()">Quitter la démo</button>';
  document.body.appendChild(b);
}
function startDemo(){
  showConfirmDialog('Essayer avec un exemple ?', 'Le carnet va s\'ouvrir avec deux enfants fictifs et un mois déjà suivi, pour tout essayer sans risque. Vos vraies données sont mises de côté, intactes, et reviennent dès que vous quittez la démonstration.', ()=>{
    uiSnapshot(); saveNow();
    const t = today(), S = clone(STATE_DEFAULT);
    S.profil = {nom:'Marie Exemple', adresse:'1 rue des Tilleuls, 44000 Nantes', agrementNum:'EX-0001', agrementDate:iso(new Date(t.getFullYear()-2, 2, 1)), agrementDuree:'5', assurance:'Assurance Exemple n° 123'};
    S.settings.zone = STATE.settings.zone || 'B'; S.lastExport = new Date().toISOString(); S.ui = {onboardingDone:1};
    const deb1 = iso(new Date(t.getFullYear()-1, t.getMonth(), 1)), deb2 = iso(new Date(t.getFullYear(), t.getMonth()-4, 1));
    const lea = Object.assign(newContrat(), {id:'demo1', enfant:'Léo', enfantNom:'Durand', famille:'Famille Durand', parent1:'Claire Durand', adresse:'5 place du Marché, Nantes',
      naissance: iso(new Date(t.getFullYear()-2, 4, 12)), debut:deb1, horaires:1, wA:['9','9','','9','9','',''],
      tA:[['08:00','17:00'],['08:00','17:00'],null,['08:00','17:00'],['08:00','17:00']], taux:'4.60', repasMode:1, repasPrix:'4', paiementJour:'5', kmTaux:'0.40'});
    const ines = Object.assign(newContrat(), {id:'demo2', enfant:'Inès', enfantNom:'Martin', famille:'Famille Martin', parent1:'Paul Martin', adresse:'12 allée des Roses, Nantes',
      naissance: iso(new Date(t.getFullYear()-1, 8, 3)), debut:deb2, type:1, semaines:'40', horaires:1, wA:['','','8','8','8','',''],
      tA:[null,null,['08:30','16:30'],['08:30','16:30'],['08:30','16:30']], taux:'4.40', paiementJour:'5'});
    S.contrats = [lea, ines];
    // un mois précédent suivi au jour le jour, avec quelques écarts
    const prev = new Date(t.getFullYear(), t.getMonth()-1, 1);
    const days = {}, k = (d)=>iso(d);
    plannedDays(lea, prev.getFullYear(), prev.getMonth()).forEach((x,i)=>{ days[k(x.d)] = {st:'conf', a:'08:00', dep:'17:00', rep:{dej:true}}; });
    const pd = Object.keys(days);
    if(pd[3]) days[pd[3]] = {st:'ecart', a:'08:00', dep:'18:15', rep:{dej:true}, note:'Retard de la maman (prévenue par SMS)'};
    if(pd[6]) days[pd[6]] = {st:'absMalC', certif:true, prevenu:'Appel du papa à 7 h 30'};
    if(pd[10]) days[pd[10]] = {st:'absPrev'};
    S.suivi = {demo1:{days, months:{}, regs:[]}};
    // trois mois plus anciens déjà validés (historique)
    S.journal = {demo1:{}, demo2:{}};
    for(let i=2;i<=4;i++){
      const m = new Date(t.getFullYear(), t.getMonth()-i, 1), ym = isoMonth(m);
      [lea, ines].forEach(c=>{ if(parseD(c.debut) > m) return; const dv = derive(c, m);
        S.journal[c.id][ym] = {brut:round2(dv.brut), net:round2(dv.net), netImp:round2(dv.net*1.037), ie:round2(dv.ieMois), repas:round2(dv.repasMois), km:0, hDecl:Math.round(dv.hMensu), jDecl:Math.ceil(dv.joursMensu), hCompl:0, hMaj:0, hReel:round2(dv.hMensu), hContrat:round2(dv.hMensu), brutMensu:round2(dv.brutBase), jours:Math.round(dv.joursMensu), jCP:0, cpMontant:0, ded:0, j8:Math.round(dv.joursMensu), hm8:0, taux:dv.tauxEff}; });
    }
    // copie de sécurité des vraies données, remise en place à la sortie de la démonstration
    const vraies = JSON.stringify(STATE);
    try{ localStorage.setItem(STORE_KEY+'-avant-demo', vraies); }catch(e){}
    idbSaveState(STORE_KEY+'-avant-demo', vraies);
    try{ localStorage.setItem(DEMO_FLAG, '1'); }catch(e){}
    S._savedAt = new Date().toISOString();
    STATE = S; saveNow();
    setTimeout(()=>location.reload(), 300);
  }, 'Oui, essayer', 'Annuler');
}
async function exitDemo(){
  // plus aucun enregistrement possible pendant la sortie : les données d'exemple ne doivent jamais
  // être écrites à la place des vraies (l'enregistrement automatique à la fermeture de la page le ferait)
  window.saveNow = ()=>{}; window.saveState = ()=>{};
  let vraies = null;
  try{ vraies = localStorage.getItem(STORE_KEY+'-avant-demo'); }catch(e){}
  if(!vraies) vraies = await idbLoadState(STORE_KEY+'-avant-demo');
  try{
    localStorage.removeItem(DEMO_FLAG); localStorage.removeItem(DEMO_KEY);
    if(vraies){ localStorage.setItem(STORE_KEY, vraies); localStorage.removeItem(STORE_KEY+'-avant-demo'); }
  }catch(e){}
  if(vraies) await idbSaveState(STORE_KEY, vraies);
  await idbSaveState(DEMO_KEY, '');
  location.reload();
}
