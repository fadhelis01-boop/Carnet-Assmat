/* =====================================================================================
   CONTRATS (jusqu'à 4 enfants), ACCUEIL, POINTS D'ATTENTION, NAVIGATION
   ===================================================================================== */
'use strict';
const MAX_ENFANTS = 4;

function newContrat(){
  return { id:'c'+Date.now().toString(36), enfant:'', famille:'', naissance:'', handicap:0,
    debut:'', fin:'', type:0, semaines:'', titre:0, alterne:0, wA:['','','','','','',''], wB:['','','','','','',''],
    taux:'', maj:'', ieMode:0, ieMontant:'', repasMode:0, repasPrix:'', km:'', cpMode:1,
    // coordonnées (facultatives, servent aux documents)
    enfantNom:'', parent1:'', parent2:'', adresse:'', tel:'', email:'', adaptation:'', paiementJour:'',
    kmTaux:'', horaires:0, tA:[], tB:[], semOff:[], hist:[], rep:null };
}
function getContrat(id){ return STATE.contrats.find(c=>c.id===id) || null; }
function contratLabel(c){ return (c.enfant||'Enfant sans nom') + (c.famille ? ' ('+c.famille+')' : '') + (contratTermine(c) ? ' — terminé' : ''); }
/* Un contrat dont la date de fin est passée se range tout seul dans « Contrats terminés » :
   il ne compte plus parmi les 4 places, mais toutes ses données restent conservées. */
function contratTermine(c, when){ const fin = parseD(c.fin); return !!(fin && fin < (when ? parseD(when) : today())); }
function contratsEnCours(){ return STATE.contrats.filter(c=>!contratTermine(c)); }
function placesMax(){ return Math.max(MAX_ENFANTS, parseInt(STATE.settings.agrement)||MAX_ENFANTS); }
function contratActif(c, when){
  const d = when ? parseD(when) : today();
  const deb = parseD(c.debut), fin = parseD(c.fin);
  if(deb && d < deb) return false;
  if(fin && d > fin) return false;
  return true;
}
/* ---------- Journal des mois validés (un enregistrement par enfant et par mois) ---------- */
function journalOf(id){ return (STATE.journal && STATE.journal[id]) || {}; }
/* Totaux sur une période (mois 'AAAA-MM' inclus) */
function journalTotals(id, fromM, toM){
  const t = {n:0, brut:0, net:0, netImp:0, ie:0, repas:0, km:0, hReel:0, hContrat:0, brutMensu:0, hDecl:0, jCP:0, cpMontant:0, j8:0, hm8:0, mois:[]};
  Object.entries(journalOf(id)).sort().forEach(([m, r])=>{
    if(fromM && m < fromM) return;
    if(toM && m > toM) return;
    t.n++; t.mois.push(m);
    ['brut','net','netImp','ie','repas','km','hReel','hContrat','brutMensu','hDecl','jCP','cpMontant','j8','hm8'].forEach(k=>t[k]+= +r[k]||0);
  });
  return t;
}
/* ---------- Avenants : chaque modification datée garde les anciennes valeurs pour les mois passés ---------- */
const PARAM_KEYS = ['type','semaines','titre','alterne','wA','wB','tA','tB','horaires','semOff','taux','maj','ieMode','ieMontant','repasMode','repasPrix','km','kmTaux','cpMode'];
function paramsAt(c, when){
  if(!c || !Array.isArray(c.hist) || !c.hist.length) return c;
  const k = iso(parseD(when) || today());
  const h = c.hist.slice().sort((a,b)=>a.jusqua<b.jusqua?-1:1).find(x=>k <= x.jusqua);
  return h ? Object.assign({}, c, clone(h.p)) : c;
}
function paramsOf(c){ const p={}; PARAM_KEYS.forEach(k=>p[k]=clone(c[k]===undefined?null:c[k])); return p; }
/* Heures « HH:MM » <-> minutes */
function hmToMin(t){ const m=/^(\d{1,2}):(\d{2})/.exec(t||''); return m ? (+m[1])*60+(+m[2]) : null; }
function minToHM(n){ if(n===null||n===undefined||isNaN(n)) return ''; n=Math.round(n); return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'); }
function fmtH(min){ if(!min) return '0 h'; const sg=min<0?'-':''; min=Math.abs(Math.round(min)); return sg+Math.floor(min/60)+' h'+(min%60?String(min%60).padStart(2,'0'):''); }
function wNums(w){ return (w||[]).map(x=>{ const v=parseFloat(String(x).replace(',','.')); return isNaN(v)||v<0?0:v; }); }

/* Tout ce qui découle d'un contrat, à une date donnée (minimum légal, MG… en vigueur ce jour-là) */
function derive(c, when){
  const d = when ? parseD(when) : today();
  c = paramsAt(c, d);
  const A = wNums(c.wA), B = c.alterne ? wNums(c.wB) : A;
  const sum = a=>a.reduce((s,x)=>s+x,0), cnt = a=>a.filter(x=>x>0).length;
  const hA=sum(A), hB=sum(B), jA=cnt(A), jB=cnt(B);
  const seuil = R('seuilMaj', d);
  const majA=Math.max(0,hA-seuil), majB=Math.max(0,hB-seuil);
  const semaines = c.type===1 ? (parseFloat(c.semaines)||0) : 52;
  const moyH=(hA+hB)/2, moyJ=(jA+jB)/2, moyMaj=(majA+majB)/2, moyNorm=moyH-moyMaj;
  const hNormMensu = moyNorm*semaines/12, hMajMensu = moyMaj*semaines/12;
  const joursMensu = moyJ*semaines/12;
  const tauxMin = R(c.titre ? 'salMinTitre' : 'salMin', d);
  const tauxSaisi = parseFloat(c.taux)||0;
  const tauxEff = tauxSaisi ? Math.max(tauxSaisi, tauxMin) : 0;
  const tauxReleve = tauxSaisi>0 && tauxSaisi < tauxMin - 1e-9;
  const majPct = Math.max(parseFloat(c.maj)||R('majMin',d), R('majMin',d));
  const brutBase = hNormMensu*tauxEff + hMajMensu*tauxEff*(1+majPct/100);
  const cp12 = (c.type===1 && c.cpMode===0) ? brutBase*0.10 : 0;
  const brut = brutBase + cp12;
  const net = toNet(brut, d);
  // Indemnité d'entretien : moyenne par jour d'accueil sur le planning (A et B)
  const jours = A.filter(x=>x>0).concat(B.filter(x=>x>0));
  const ieFixe = parseFloat(c.ieMontant)||0;
  let ieSum=0, ieSousMin=false;
  jours.forEach(h=>{
    const leg = ieLegalJour(h, d);
    if(c.ieMode===1 && ieFixe){ if(ieFixe < leg-1e-9) ieSousMin=true; ieSum += Math.max(ieFixe, leg); }
    else ieSum += leg;
  });
  const ieJour = jours.length ? ieSum/jours.length : 0;
  const ieMois = ieJour*joursMensu;
  const repasMois = c.repasMode===1 ? (parseFloat(c.repasPrix)||0)*joursMensu : 0;
  const km = parseFloat(c.km)||0;
  const maxJour = Math.max(0, ...A, ...B);
  return { A,B,hA,hB,jA,jB,moyH,moyJ,moyMaj,moyNorm,semaines,hNormMensu,hMajMensu,hMensu:hNormMensu+hMajMensu,joursMensu,
    tauxMin,tauxSaisi,tauxEff,tauxReleve,majPct,brutBase,cp12,brut,net,ieJour,ieMois,ieSousMin,repasMois,km,
    totalNet: net+ieMois+repasMois+km, maxJour, hMaxSem: Math.max(hA,hB), hDayAvg: (moyJ? moyH/moyJ : 0) };
}
/* Semaine A ou B pour un contrat alterné (la semaine du début de contrat = A) */
function weekIsB(c, d){
  if(!c.alterne) return false;
  const ref = parseD(c.debut) || new Date(2024,0,1);
  const diff = Math.round((mondayOf(d)-mondayOf(ref))/(7*86400000));
  return Math.abs(diff)%2===1;
}
/* Jours prévus par le planning dans un mois donné (dans les dates du contrat) */
/* Année incomplète : semaines sans accueil cochées dans le contrat (lundi de chaque semaine) */
function semaineSansAccueil(c, d){ return c.type===1 && Array.isArray(c.semOff) && c.semOff.includes(iso(mondayOf(d))); }
function isoWeek(d){ const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const n=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-n); const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1)); return Math.ceil(((t-y0)/86400000+1)/7); }
function plannedDays(c, y, m, opts){
  opts = opts||{};
  const out=[], deb=parseD(c.debut), fin=parseD(c.fin);
  const A=wNums(c.wA), B=c.alterne?wNums(c.wB):A;
  for(let day=1; day<=daysInMonth(y,m); day++){
    const d = new Date(y,m,day);
    if(deb && d<deb) continue;
    if(fin && d>fin) continue;
    const cc = paramsAt(c, d);
    const AA = cc===c ? A : wNums(cc.wA), BB = cc===c ? B : (cc.alterne ? wNums(cc.wB) : AA);
    const h = (weekIsB(cc,d)?BB:AA)[dowIdx(d)];
    if(!h) continue;
    if(semaineSansAccueil(cc, d)) continue;
    const f = ferieName(d);
    if(f && opts.skipFeries) continue;
    out.push({d, h, ferie:f});
  }
  return out;
}
function ancienneteTxt(deb, fin){
  const a=parseD(deb), b=fin?parseD(fin):today();
  if(!a||!b||b<a) return '—';
  const m = monthsBetween(a,b), y=Math.floor(m/12), r=m%12;
  return (y? y+' an'+(y>1?'s':'')+(r?' et ':'') : '') + (r||!y ? r+' mois' : '');
}
function finEssai(c){
  const deb=parseD(c.debut); if(!deb) return null;
  const dv = derive(c, deb);
  const e = R('essai', deb) || [3,2];
  const mois = Math.max(dv.jA, dv.jB) >= 4 ? e[1] : e[0];
  return addDays(addMonths(deb, mois), -1);
}

/* ---------- Navigation (avec le bouton « retour » d'Android) ---------- */
const THEME_TITLES = { contrat:'Enfant & contrat', mensu:'Salaire mensualisé', mois:'Salaire du mois', ccass:'Mois incomplet',
  cp:'Congés payés', ie:'Indemnités d\'entretien', fin:'Fin de contrat', abattement:'Impôts', cmg:'Aide CMG', reglages:'Réglages', aide:'Aide', docs:'Documents', suivi:'Suivi & paie' };
let CURRENT = 'home';
function showTheme(id, opts){
  opts = opts||{};
  if(CURRENT !== 'home' && CURRENT !== id) persistTheme(CURRENT);
  $('home').style.display='none';
  document.querySelectorAll('.theme').forEach(t=>t.classList.remove('active'));
  $('theme-'+id).classList.add('active');
  document.body.classList.add('in-theme');
  $('topbar-title').innerHTML = '<span class="tag">Carnet Assmat</span>'+esc(THEME_TITLES[id]||'');
  CURRENT = id;
  if(!opts.fromHistory){ try{ history.pushState({theme:id}, '', '#'+id); }catch(e){} }
  window.scrollTo(0,0);
  onThemeOpen(id);
  if(typeof afterNavigate==='function') afterNavigate();
}
function showHome(fromHistory, tab){
  if(CURRENT !== 'home') persistTheme(CURRENT);
  if(tab && typeof HOME_TAB!=='undefined') HOME_TAB = tab;
  document.querySelectorAll('.theme').forEach(t=>t.classList.remove('active'));
  $('home').style.display='block';
  document.body.classList.remove('in-theme');
  CURRENT = 'home';
  if(!fromHistory){ try{ history.replaceState({theme:'home', tab:(typeof HOME_TAB!=='undefined'?HOME_TAB:'accueil')}, '', '#'); }catch(e){} }
  window.scrollTo(0,0);
  renderHome();
  if(typeof afterNavigate==='function') afterNavigate();
}
function goBack(){
  if(history.state && history.state.theme && history.state.theme!=='home') history.back();
  else showHome();
}
window.addEventListener('popstate', e=>{
  const open = anyOverlayOpen();
  if(open.length){ open.forEach(o=>o.classList.remove('show')); try{ history.pushState({theme:CURRENT},'', '#'+CURRENT);}catch(_){} return; }
  const t = e.state && e.state.theme;
  if(t && t!=='home' && $('theme-'+t)) showTheme(t, {fromHistory:true});
  else showHome(true, e.state && e.state.tab);
});

/* =====================================================================================
   ACCUEIL : cartes enfants, total du mois, points d'attention
   ===================================================================================== */
function renderHome(){
  const wrap = $('kids');
  const now = today();
  let html = '';
  const enCours = contratsEnCours(), termines = STATE.contrats.filter(c=>contratTermine(c));
  enCours.forEach(c=>{
    const dv = derive(c, now);
    const actif = contratActif(c, now);
    const nbMois = Object.keys(journalOf(c.id)).length;
    const pill = '<span class="pill '+(c.type===1?'inc':'')+'">'+(c.type===1?'Année incomplète':'Année complète')+'</span>'
      + (actif ? '' : ' <span class="pill off">À venir</span>')
      + (c.fin ? ' <span class="pill off">fin le '+fmtDate(c.fin)+'</span>' : '');
    html += '<div class="kid'+(actif?'':' inactive')+'">'
      + '<div class="kname">'+esc(c.enfant||'Sans prénom')+'</div>'
      + '<div class="kfam">'+esc(c.famille||'Famille ?')+' · '+pill+'</div>'
      + '<div class="kline"><span>Planning</span><b>'+fmtNum(dv.moyH,2)+' h/sem · '+fmtNum(dv.moyJ,1)+' j</b></div>'
      + '<div class="kline"><span>Salaire mensuel brut</span><b>'+(dv.brut?fmtEUR(dv.brut):'—')+'</b></div>'
      + '<div class="kline"><span>Salaire net estimé</span><b>'+(dv.net?fmtEUR(dv.net):'—')+'</b></div>'
      + '<div class="kline"><span>Entretien (moyenne/mois)</span><b>'+(dv.ieMois?fmtEUR(dv.ieMois):'—')+'</b></div>'
      + '<div class="kline"><span>Mois validés</span><b>'+nbMois+'</b></div>'
      + '<div class="kactions"><button class="btn small primary" onclick="openFor(\'mois\',\''+c.id+'\')">Ce mois-ci</button>'
      + '<button class="btn small" onclick="openDocs(\''+c.id+'\')">📄 Documents</button>'
      + '<button class="btn small" onclick="editContrat(\''+c.id+'\')">✎ Modifier</button>'
      + '<button class="btn small" onclick="terminerContrat(\''+c.id+'\')">Fin de contrat</button></div>'
      + '</div>';
  });
  const max = placesMax();
  if(enCours.length < max){
    html += '<button class="kid add" onclick="editContrat(null)"><span style="font-size:1.6rem">＋</span>Ajouter un enfant<span class="hint">'+(enCours.length? (max-enCours.length)+' place(s) disponible(s)' : 'Commencez par là')+'</span></button>';
  }
  wrap.innerHTML = html;
  // Contrats terminés : rangés automatiquement, données conservées
  let th = '';
  if(termines.length){
    th = '<details class="help" style="margin-top:12px"><summary>📁 Contrats terminés ('+termines.length+') — données conservées</summary><div>'
      + '<p class="hint" style="margin:0 0 10px">Un contrat se range ici tout seul le lendemain de sa date de fin : il libère sa place mais garde ses mois validés, ses calculs et ses documents (utiles pour les impôts, une attestation ou un litige). Conservez-les au moins 5 ans.</p>'
      + termines.map(c=>{
          const tot = journalTotals(c.id);
          return '<div class="kid" style="margin-bottom:8px"><div class="kname">'+esc(c.enfant||'Sans prénom')+'</div>'
            + '<div class="kfam">'+esc(c.famille||'')+' · du '+(fmtDate(c.debut)||'?')+' au '+fmtDate(c.fin)+'</div>'
            + '<div class="kline"><span>Mois validés</span><b>'+tot.n+'</b></div>'
            + '<div class="kline"><span>Total des salaires bruts enregistrés</span><b>'+fmtEUR(tot.brut)+'</b></div>'
            + '<div class="kactions"><button class="btn small" onclick="openDocs(\''+c.id+'\')">📄 Documents</button>'
            + '<button class="btn small" onclick="openFor(\'fin\',\''+c.id+'\')">Fin de contrat</button>'
            + '<button class="btn small" onclick="editContrat(\''+c.id+'\')">Voir</button>'
            + '<button class="btn small danger" onclick="deleteContrat(\''+c.id+'\')">Supprimer</button></div></div>';
        }).join('')
      + '</div></details>';
  }
  setHTML('kids-termines', th);

  // Total du mois (contrats actifs)
  const actifs = STATE.contrats.filter(c=>contratActif(c, now));
  if(actifs.length){
    let brut=0, net=0, ie=0, rep=0, km=0;
    actifs.forEach(c=>{ const dv=derive(c,now); brut+=dv.brut; net+=dv.net; ie+=dv.ieMois; rep+=dv.repasMois; km+=dv.km; });
    $('month-total').innerHTML =
      '<div class="mt-row"><span>Mes revenus habituels d\'un mois ('+actifs.length+' enfant'+(actifs.length>1?'s':'')+')</span></div>'
      + '<div class="mt-row"><span>Salaires bruts</span><b>'+fmtEUR(brut)+'</b></div>'
      + '<div class="mt-row"><span>Salaires nets (estimation)</span><b>'+fmtEUR(net)+'</b></div>'
      + '<div class="mt-row"><span>Indemnités d\'entretien</span><b>'+fmtEUR(ie)+'</b></div>'
      + (rep? '<div class="mt-row"><span>Repas</span><b>'+fmtEUR(rep)+'</b></div>' : '')
      + (km? '<div class="mt-row"><span>Frais kilométriques</span><b>'+fmtEUR(km)+'</b></div>' : '')
      + '<div class="mt-row mt-big"><span>Total perçu (net)</span><b>'+fmtEUR(net+ie+rep+km)+'</b></div>';
    show('month-total', true);
  } else show('month-total', false);

  $('home-intro').style.display = STATE.contrats.length ? 'none' : 'block';
  renderAlerts();
  if(typeof renderTabs==='function') renderTabs();
  regRenderStatus();
  const se = $('sync-status');
  if(se) se.textContent = STATE.lastExport ? 'Dernière copie de sécurité : '+new Date(STATE.lastExport).toLocaleDateString('fr-FR')+'.' : 'Aucune copie de sécurité faite depuis cet appareil.';
}

function computeAlerts(){
  const out = [], now = today(), mNow = now.getMonth();
  const actifs = STATE.contrats.filter(c=>contratActif(c, now));
  STATE.contrats.forEach(c=>{
    const nom = '<b>'+esc(c.enfant||'Enfant')+'</b>';
    const dv = derive(c, now);
    if(!contratActif(c, now) && parseD(c.fin) && parseD(c.fin) < now) return;
    // Salaire minimum (appliqué d'office)
    if(dv.tauxReleve){
      out.push({lvl:'err', html:'Le salaire horaire de '+nom+' ('+fmtEUR(dv.tauxSaisi)+') est inférieur au minimum légal en vigueur depuis le '+fmtDate(Rdu(c.titre?'salMinTitre':'salMin'))+' ('+fmtEUR(dv.tauxMin)+'). Les calculs appliquent automatiquement '+fmtEUR(dv.tauxMin)+'. Il faut signer un avenant avec la famille.',
        act:'<button class="btn small" onclick="raiseToMin(\''+c.id+'\')">Mettre le contrat au minimum</button>'});
    }
    const nx = Rnext(c.titre?'salMinTitre':'salMin', now);
    if(nx && dv.tauxSaisi && dv.tauxSaisi < nx.v && (parseD(nx.du)-now)/86400000 < 75){
      out.push({lvl:'warn', html:'À partir du '+fmtDate(nx.du)+', le salaire minimum passe à '+fmtEUR(nx.v)+' de l\'heure : le tarif de '+nom+' ('+fmtEUR(dv.tauxSaisi)+') devra être augmenté.'});
    }
    if(!dv.tauxSaisi) out.push({lvl:'warn', html:'Le salaire horaire de '+nom+' n\'est pas renseigné.', act:'<button class="btn small" onclick="editContrat(\''+c.id+'\')">Compléter</button>'});
    if(c.type===1 && !(parseFloat(c.semaines)>0)) out.push({lvl:'warn', html:'Indiquez le nombre de semaines d\'accueil par an pour '+nom+' (année incomplète).', act:'<button class="btn small" onclick="editContrat(\''+c.id+'\')">Compléter</button>'});
    if(dv.ieSousMin) out.push({lvl:'warn', html:'L\'indemnité d\'entretien prévue pour '+nom+' ('+fmtEUR(parseFloat(c.ieMontant))+'/jour) est inférieure au minimum légal pour au moins une journée du planning. Les calculs appliquent le minimum.'});
    if(dv.maxJour > R('hMaxJour')) out.push({lvl:'err', html:'Le planning de '+nom+' compte une journée de '+fmtNum(dv.maxJour,2)+' h : au-delà de '+R('hMaxJour')+' h, le repos quotidien de 11 h n\'est plus respecté.'});
    if(dv.moyH > R('hMaxSemaine')) out.push({lvl:'err', html:'Le planning de '+nom+' dépasse en moyenne '+R('hMaxSemaine')+' h par semaine : ce n\'est possible qu\'avec votre accord écrit et dans la limite de 2 250 h par an.'});
    else if(dv.hMaxSem > R('hMaxSemaine')) out.push({lvl:'info', html:'Une semaine du planning de '+nom+' dépasse '+R('hMaxSemaine')+' h : c\'est admis tant que la moyenne sur 4 mois reste sous '+R('hMaxSemaine')+' h (ici '+fmtNum(dv.moyH,2)+' h).'});
    else if(dv.hMaxSem > R('seuilMaj')) out.push({lvl:'info', html:'Le planning de '+nom+' dépasse 45 h par semaine : les heures au-delà sont majorées (déjà comptées dans le salaire mensualisé).'});
    // Période d'essai
    const fe = finEssai(c);
    if(fe && fe >= now && parseD(c.debut) <= now) out.push({lvl:'info', html:'Période d\'essai de '+nom+' en cours jusqu\'au '+fe.toLocaleDateString('fr-FR')+'.'});
    // Fin prévue
    const fin = parseD(c.fin);
    if(fin && fin >= now && (fin-now)/86400000 <= 60){
      out.push({lvl:'warn', html:'Le contrat de '+nom+' se termine le '+fin.toLocaleDateString('fr-FR')+'. Pensez au préavis, aux congés payés'+(c.type===1?', à la régularisation (obligatoire en année incomplète)':'')+' et aux documents de fin de contrat.',
        act:'<button class="btn small" onclick="openFor(\'fin\',\''+c.id+'\')">Calculer la fin de contrat</button>'});
    }
    // Âge et CMG
    const nais = parseD(c.naissance);
    if(nais){
      const six = new Date(nais.getFullYear()+R('cmgAgeMax'), nais.getMonth(), nais.getDate());
      const dd = (six-now)/86400000;
      if(dd>=0 && dd<=90) out.push({lvl:'info', html:nom+' aura '+R('cmgAgeMax')+' ans le '+six.toLocaleDateString('fr-FR')+' : l\'aide CMG des parents s\'arrête alors (sauf famille monoparentale, jusqu\'à 12 ans). Prévenez la famille.'});
    }
    // Date anniversaire du contrat : remise à zéro du compteur d'absences pour maladie
    const deb = parseD(c.debut);
    if(deb && deb < now && deb.getMonth()===mNow && deb.getFullYear()<now.getFullYear()){
      out.push({lvl:'info', html:'Ce mois-ci, le contrat de '+nom+' a un an de plus ('+ancienneteTxt(c.debut)+' d\'ancienneté). Le compteur des 5 jours d\'absence pour maladie de l\'enfant repart à zéro le '+new Date(now.getFullYear(), deb.getMonth(), deb.getDate()).toLocaleDateString('fr-FR')+'.'});
    }
  });
  // Déclaration Pajemploi du mois (fenêtre du 25 au 5) : une par enfant depuis 2026
  const jour = now.getDate();
  if(jour >= 25 || jour <= 5){
    const mDecl = jour >= 25 ? isoMonth(now) : isoMonth(new Date(now.getFullYear(), now.getMonth()-1, 1));
    STATE.contrats.filter(c=>{ const deb=parseD(c.debut), fin=parseD(c.fin); return (!deb || isoMonth(deb) <= mDecl) && (!fin || isoMonth(fin) >= mDecl); })
      .filter(c=>!journalOf(c.id)[mDecl]).forEach(c=>{
        out.push({lvl:'warn', html:'Déclaration Pajemploi de '+fmtMonth(mDecl)+' pour <b>'+esc(c.enfant||'Enfant')+'</b> (entre le 25 et le 5) : préparez les chiffres puis validez le mois.',
          act:'<button class="btn small" onclick="preparerDeclaration(\''+c.id+'\',\''+mDecl+'\')">Préparer la déclaration</button>'});
      });
  }
  // Contrats terminés depuis moins de 2 mois : documents de fin
  STATE.contrats.filter(c=>contratTermine(c) && (now-parseD(c.fin))/86400000 <= 60).forEach(c=>{
    out.push({lvl:'info', html:'Contrat de <b>'+esc(c.enfant||'Enfant')+'</b> terminé le '+fmtDate(c.fin)+' : dernière déclaration Pajemploi (répondre « oui » à « fin de contrat »), certificat de travail, attestation France Travail et reçu pour solde de tout compte.',
      act:'<button class="btn small" onclick="openDocs(\''+c.id+'\')">Documents</button>'});
  });
  // Renouvellement de l'agrément (tous les 5 ans ; demande au moins 4 mois avant l'échéance)
  const ag = parseD((STATE.profil||{}).agrementDate);
  if(ag){
    const ech = new Date(ag.getFullYear()+(parseInt((STATE.profil||{}).agrementDuree)||5), ag.getMonth(), ag.getDate()), dd = (ech-now)/86400000;
    if(dd <= 180) out.push({lvl: dd<=120?'err':'warn', html:'Votre agrément arrive à échéance le '+ech.toLocaleDateString('fr-FR')+' : demandez son renouvellement au service PMI du département au moins 4 mois avant.'});
  }
  if(typeof suiviAlerts==='function') suiviAlerts(out);
  try{ const mo = JSON.stringify(STATE).length/1024/1024;
    if(mo > 4) out.push({lvl:'info', html:'Vos données occupent '+fmtNum(mo,1)+' Mo : elles sont gardées dans le stockage étendu du téléphone. Pensez aux copies de sécurité ; les contrats terminés depuis plus de 5 ans peuvent être supprimés.', act:'<button class="btn small" onclick="syncExport()">Copie de sécurité</button>'}); }catch(e){}
  const cons = parseInt(STATE.settings.conservation)||5;
  STATE.contrats.filter(c=>contratTermine(c) && (now-parseD(c.fin))/86400000 > cons*365-60).forEach(c=>{
    out.push({lvl:'info', html:'Le contrat de <b>'+esc(c.enfant||'')+'</b> est terminé depuis près de '+cons+' ans (durée de conservation choisie). Vous pouvez exporter ses documents puis le supprimer ; rien n\'est jamais effacé automatiquement.', act:'<button class="btn small" onclick="syncExport()">Copie de sécurité</button>'});
  });
  // Agrément : nombre d'enfants présents le même jour
  const agr = parseInt(STATE.settings.agrement)||R('agrementMax');
  for(let i=0;i<7;i++){
    const n = actifs.filter(c=>wNums(c.wA)[i]>0 || (c.alterne && wNums(c.wB)[i]>0)).length;
    if(n > agr){ out.push({lvl:'err', html:'Le '+['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'][i]+', '+n+' enfants sont prévus alors que votre agrément en autorise '+agr+'. Vérifiez que leurs horaires ne se chevauchent pas.'}); break; }
  }
  // Rappels de calendrier
  if((mNow===4 || mNow===5) && actifs.length) out.push({lvl:'info', html:'Juin approche : la période de congés payés se termine le 31 mai. Comparez le maintien de salaire et les 10 % (année complète), ou faites payer les congés si votre contrat prévoit un paiement en juin (année incomplète).', act:'<button class="btn small" onclick="showTheme(\'cp\')">Congés payés</button>'});
  if(mNow>=3 && mNow<=5) out.push({lvl:'info', html:'Période de déclaration des revenus : calculez votre abattement fiscal avant de valider votre déclaration.', act:'<button class="btn small" onclick="showTheme(\'abattement\')">Impôts : abattement</button>'});
  if(STATE.contrats.length && (!STATE.lastExport || (Date.now()-new Date(STATE.lastExport))/86400000 > 60))
    out.push({lvl:'info', html:'Pensez à faire une copie de sécurité de vos données (en cas de perte ou de changement de téléphone).', act:'<button class="btn small" onclick="syncExport()">Faire une copie</button>'});
  if(!STATE.regCheckedAt || (Date.now()-new Date(STATE.regCheckedAt))/86400000 > 45)
    out.push({lvl:'info', html:'La réglementation n\'a pas été vérifiée depuis longtemps.', act:'<button class="btn small" onclick="regCheckUpdates(false)">Rechercher les mises à jour</button>'});
  return out;
}
function renderAlerts(){
  const list = computeAlerts();
  const order = {err:0, warn:1, info:2};
  list.sort((a,b)=>order[a.lvl]-order[b.lvl]);
  $('alerts').innerHTML = list.map(a=>'<div class="alert '+a.lvl+'">'+(a.lvl==='err'?'⛔ ':a.lvl==='warn'?'⚠️ ':'ℹ️ ')+a.html+(a.act?'<div class="a-act">'+a.act+'</div>':'')+'</div>').join('');
  show('alerts-wrap', list.length>0);
}
function raiseToMin(id){
  const c = getContrat(id); if(!c) return;
  const dv = derive(c);
  showConfirmDialog('Avenant de salaire', 'Passer le salaire horaire de '+(c.enfant||'cet enfant')+' de '+fmtEUR(dv.tauxSaisi)+' à '+fmtEUR(dv.tauxMin)+' ? Pensez à faire signer un avenant au contrat par la famille.', ()=>{
    c.taux = String(dv.tauxMin); saveState(); renderHome(); toast('Contrat mis à jour.');
  }, 'Oui, mettre à jour', 'Annuler');
}
function deleteContrat(id){
  const c = getContrat(id); if(!c) return;
  const n = Object.keys(journalOf(id)).length;
  showConfirmDialog('Supprimer définitivement ?', 'Le contrat de '+contratLabel(c)+', ses '+n+' mois validés et ses calculs seront effacés de ce téléphone, sans retour possible. Inutile de supprimer un contrat terminé : il libère déjà sa place tout seul. Les saisies d\'impôts et de CMG sont conservées. Si vous continuez, faites d\'abord une copie de sécurité (gardez vos justificatifs au moins 5 ans).', ()=>{
    STATE.contrats = STATE.contrats.filter(x=>x.id!==id);
    if(STATE.journal) delete STATE.journal[id];
    Object.keys(STATE.forms).forEach(t=>{ if(STATE.forms[t]) delete STATE.forms[t][id]; });
    Object.keys(STATE.sel).forEach(t=>{ if(STATE.sel[t]===id) STATE.sel[t]='libre'; });
    saveState(); renderHome(); toast('Contrat supprimé.');
  }, 'Oui, supprimer définitivement', 'Annuler');
}
function terminerContrat(id){
  const c = getContrat(id); if(!c) return;
  askText('Fin du contrat de '+(c.enfant||'l\'enfant'), 'Date du dernier jour du contrat (dernier jour du préavis), au format AAAA-MM-JJ. Le contrat reste affiché jusqu\'à cette date, puis se range tout seul dans « Contrats terminés » avec toutes ses données. Ensuite : calcul de fin de contrat et documents.', c.fin || iso(addDays(today(), 30)), v=>{
    const d = parseD((v||'').trim()); if(!d){ toast('Date non reconnue (AAAA-MM-JJ).'); return; }
    c.fin = iso(d); saveState(); openFor('fin', id);
    toast('Fin de contrat enregistrée au '+d.toLocaleDateString('fr-FR')+'.');
  });
}
function preparerDeclaration(id, m){
  STATE.sel.mois = id; if(STATE.forms.mois) delete STATE.forms.mois[id];
  showTheme('mois');
  const c = getContrat(id); if(c && m){ setVal('mois-mois', m); moisFillFromContract(c, m); VIS.mois(); CALC.mois(); persistTheme('mois'); }
}
function openFor(theme, id){ STATE.sel[theme] = id; delete (STATE.forms[theme]||{})[id]; showTheme(theme); }

/* =====================================================================================
   ASSISTANT « ENFANT & CONTRAT »
   ===================================================================================== */
let CT = null, CT_STEP = 0, CT_IS_NEW = true;
const CT_TEXT = ['enfant','famille','naissance','debut','fin','semaines','taux','maj','ieMontant','repasPrix','km',
  'enfantNom','parent1','parent2','adresse','tel','email','adaptation','paiementJour','kmTaux'];
const REP_KEYS = ['date','cumulBrut','cpReliquat','cpPrisN','mal','regulVerse','regulHeures'];
function buildWeek(containerId, prefix){
  let h='';
  DOW_SHORT.forEach((n,i)=>{ h += '<div class="wday"><div class="dname">'+n+'</div><input type="number" inputmode="decimal" step="0.25" min="0" max="24" id="'+prefix+i+'" placeholder="—">'
    + '<input type="time" class="tm" id="'+prefix+i+'s" aria-label="arrivée '+n+'"><input type="time" class="tm" id="'+prefix+i+'e" aria-label="départ '+n+'"></div>'; });
  $(containerId).innerHTML = h;
}
function editContrat(id, force){
  const dr = STATE.ui && STATE.ui.ctDraft;
  if(!force && dr && ((dr.isNew && !id) || (!dr.isNew && dr.ct && dr.ct.id===id))){
    _confirmNoCb = ()=>{ delete STATE.ui.ctDraft; saveState(); editContrat(id, true); };
    showConfirmDialog('Reprendre la saisie ?', 'Une fiche commencée pour « '+(dr.ct.enfant||'un enfant')+' » n\'a pas été enregistrée. Voulez-vous la reprendre là où vous l\'aviez laissée ?', ()=>restoreContratDraft(dr), 'Oui, reprendre', 'Non, repartir de zéro');
    return;
  }
  if(!id && contratsEnCours().length >= placesMax()){ toast(placesMax()+' enfants en cours au maximum. Un contrat terminé libère sa place automatiquement.'); return; }
  CT_IS_NEW = !id;
  CT = id ? clone(getContrat(id)) : newContrat();
  setTxt('ct-title', CT_IS_NEW ? 'Nouvel enfant' : 'Modifier : '+(CT.enfant||'enfant'));
  CT_TEXT.forEach(k=>setVal('ct-'+k, CT[k]));
  setSegVal('ct-handicap', CT.handicap); setSegVal('ct-type', CT.type); setSegVal('ct-titre', CT.titre);
  setSegVal('ct-alterne', CT.alterne); setSegVal('ct-ieMode', CT.ieMode); setSegVal('ct-repasMode', CT.repasMode); setSegVal('ct-cpMode', CT.cpMode);
  for(let i=0;i<7;i++){ setVal('ct-wA'+i, CT.wA[i]); setVal('ct-wB'+i, CT.wB[i]);
    ['A','B'].forEach(w=>{ const t=(CT['t'+w]||[])[i]||[]; setVal('ct-w'+w+i+'s', t[0]||''); setVal('ct-w'+w+i+'e', t[1]||''); }); }
  setSegVal('ct-horaires', CT.horaires||0);
  const rp = CT.rep||{}; REP_KEYS.forEach(k=>setVal('ct-rep-'+k, rp[k]));
  CT._orig = id ? paramsOf(CT) : null;
  CT_STEP = 0;
  showTheme('contrat');
  ctRefresh();
}
function ctRead(){
  if(!CT) return;
  CT_TEXT.forEach(k=>CT[k]=val('ct-'+k).trim());
  CT.handicap=seg('ct-handicap'); CT.type=seg('ct-type'); CT.titre=seg('ct-titre'); CT.alterne=seg('ct-alterne');
  CT.ieMode=seg('ct-ieMode'); CT.repasMode=seg('ct-repasMode'); CT.cpMode=seg('ct-cpMode');
  CT.horaires = seg('ct-horaires');
  CT.tA = CT.tA||[]; CT.tB = CT.tB||[];
  for(let i=0;i<7;i++){
    ['A','B'].forEach(w=>{
      const s=val('ct-w'+w+i+'s'), e=val('ct-w'+w+i+'e');
      CT['t'+w][i] = (s||e) ? [s,e] : null;
      if(CT.horaires){ const a=hmToMin(s), b=hmToMin(e); setVal('ct-w'+w+i, (a!==null && b!==null && b>a) ? round2((b-a)/60) : ''); }
    });
    CT.wA[i]=val('ct-wA'+i); CT.wB[i]=val('ct-wB'+i);
  }
  const rep = {}; let anyRep=false; REP_KEYS.forEach(k=>{ rep[k]=val('ct-rep-'+k).trim(); if(rep[k]) anyRep=true; });
  CT.rep = anyRep ? rep : null;
}
function ctRefresh(){
  ctRead();
  document.querySelectorAll('#theme-contrat .step').forEach(s=>s.classList.toggle('active', +s.dataset.step===CT_STEP));
  document.querySelectorAll('#ct-steps span').forEach((s,i)=>s.classList.toggle('on', i<=CT_STEP));
  $('ct-prev').style.visibility = CT_STEP===0 ? 'hidden' : 'visible';
  $('ct-next').textContent = CT_STEP===4 ? '✔ Enregistrer' : 'Suivant →';
  show('ct-semaines-wrap', CT.type===1);
  show('ct-semoff-wrap', CT.type===1);
  if(CT.type===1) ctRenderWeeks();
  show('ct-cpMode-row', CT.type===1, 'flex');
  setTxt('ct-type-hint', CT.type===1
    ? '« Une partie de l\'année » = l\'enfant ne vient pas certaines semaines en plus de vos congés (ex. vacances scolaires). Le salaire est calculé sur les seules semaines d\'accueil.'
    : '« Toute l\'année » = l\'enfant vient toutes les semaines, sauf pendant vos 5 semaines de congés payés (année complète, 52 semaines payées).');
  show('ct-wB-wrap', CT.alterne===1);
  $('ct-wA').classList.toggle('with-times', CT.horaires===1); $('ct-wB').classList.toggle('with-times', CT.horaires===1);
  for(let i=0;i<7;i++){ ['A','B'].forEach(w=>{ const inp=$('ct-w'+w+i); if(inp) inp.readOnly = CT.horaires===1; }); }
  const debD = parseD(CT.debut); show('ct-rep-wrap', !!(debD && (today()-debD)/86400000 > 20));
  show('ct-rep-regul', CT.type===1);
  setTxt('ct-wA-label', CT.alterne ? 'Semaine A : nombre d\'heures pour chaque jour' : 'Nombre d\'heures d\'accueil pour chaque jour de la semaine');
  show('ct-ieMontant-wrap', CT.ieMode===1);
  show('ct-repasPrix-wrap', CT.repasMode===1);
  for(let i=0;i<7;i++){
    ['A','B'].forEach(w=>{ const inp=$('ct-w'+w+i); if(inp) inp.parentElement.classList.toggle('filled', parseFloat(inp.value)>0); });
  }
  const dv = derive(CT, today());
  show('ct-maj-wrap', dv.hMaxSem > R('seuilMaj'));
  setHTML('ct-planning-sum', dv.moyH
    ? (CT.alterne ? 'Semaine A : <b>'+fmtNum(dv.hA,2)+' h</b> sur '+dv.jA+' jours · Semaine B : <b>'+fmtNum(dv.hB,2)+' h</b> sur '+dv.jB+' jours. ' : 'Total : <b>'+fmtNum(dv.hA,2)+' h par semaine</b> sur <b>'+dv.jA+' jours</b>. ')
      + 'Durée moyenne d\'une journée : '+fmtNum(dv.hDayAvg,2)+' h.'
    : 'Indiquez les heures de chaque jour d\'accueil.');
  const warns = [];
  if(dv.maxJour > R('hMaxJour')) warns.push('Une journée dépasse '+R('hMaxJour')+' h : impossible avec 11 h de repos obligatoire entre deux journées.');
  if(dv.moyH > R('hMaxSemaine')) warns.push('Plus de '+R('hMaxSemaine')+' h par semaine en moyenne : possible seulement avec votre accord écrit (2 250 h par an au maximum).');
  if(dv.hMaxSem > R('seuilMaj')) warns.push('Plus de 45 h par semaine : les heures au-delà seront payées avec une majoration (10 % minimum).');
  setHTML('ct-planning-warn', warns.join('<br>')); show('ct-planning-warn', warns.length>0);
  setHTML('ct-taux-hint', 'Minimum légal aujourd\'hui : <b>'+fmtEUR(dv.tauxMin)+'</b> brut de l\'heure'+(CT.titre?' (avec titre AM-AP)':'')+' — en vigueur depuis le '+fmtDate(Rdu(CT.titre?'salMinTitre':'salMin'))+'.'
    + (dv.tauxReleve ? ' <span style="color:var(--error)">Votre tarif est en dessous : '+fmtEUR(dv.tauxMin)+' sera appliqué.</span>' : '')
    + ' <a href="#" onclick="setVal(\'ct-taux\','+dv.tauxMin+');ctRefresh();return false;">Mettre le minimum</a>');
  if(CT_STEP===4) ctRecap(dv);
  $('ct-extra').innerHTML = CT_IS_NEW ? '' : '<button class="btn small" onclick="ctSave()">✔ Enregistrer maintenant</button>';
  if(typeof uiSaveDraft==='function') uiSaveDraft();
}
/* Calendrier des semaines sans accueil (année incomplète) : 12 mois à partir du début du contrat
   (ou de la rentrée en cours si le contrat a commencé il y a plus d'un an) */
function ctRenderWeeks(){
  if(!Array.isArray(CT.semOff)) CT.semOff = [];
  const deb = parseD(CT.debut) || today();
  let start = mondayOf(deb);
  if((today()-deb)/86400000 > 330) start = mondayOf(new Date(today().getFullYear() - (today().getMonth()<7?1:0), 8, 1));
  let h='', off=0;
  for(let i=0;i<52;i++){
    const w = addDays(start, 7*i), k = iso(w), isOff = CT.semOff.includes(k);
    if(isOff) off++;
    h += '<button type="button" class="chip'+(isOff?'':' on')+'" style="min-height:34px;padding:5px 9px;font-size:.74rem" onclick="ctToggleWeek(\''+k+'\')" title="'+(isOff?'sans accueil':'accueil')+'">S'+isoWeek(w)+' · '+w.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+'</button>';
  }
  setHTML('ct-semoff', h);
  const prog = 52-off;
  setHTML('ct-semoff-info', 'En vert : semaines d\'accueil. Sur ces 52 semaines : <b>'+prog+' semaines d\'accueil</b>, '+off+' sans accueil. '
    + (off ? '<a href="#" onclick="setVal(\'ct-semaines\','+prog+');ctRefresh();return false;">Utiliser '+prog+' comme nombre de semaines</a>. ' : '')
    + 'Ce calendrier sert à compter les vrais jours d\'accueil de chaque mois (entretien, repas, impôts, régularisation).');
}
function ctToggleWeek(k){
  ctRead();
  if(!Array.isArray(CT.semOff)) CT.semOff = [];
  CT.semOff = CT.semOff.includes(k) ? CT.semOff.filter(x=>x!==k) : CT.semOff.concat([k]);
  ctRenderWeeks();
}
function ctRecap(dv){
  const fe = finEssai(CT);
  const lines = [
    ['Enfant', esc(CT.enfant||'—')+(CT.famille?' · '+esc(CT.famille):'')],
    ['Type de contrat', CT.type===1 ? 'Année incomplète ('+(dv.semaines||'?')+' semaines)' : 'Année complète (52 semaines)'],
    ['Heures par semaine (moyenne)', fmtNum(dv.moyH,2)+' h'],
    ['Heures payées chaque mois', fmtNum(dv.hMensu,2)+' h'+(dv.hMajMensu?' (dont '+fmtNum(dv.hMajMensu,2)+' h majorées)':'')],
    ['Jours d\'accueil par mois (moyenne)', fmtNum(dv.joursMensu,2)+' j'],
    ['Salaire horaire appliqué', fmtEUR(dv.tauxEff)+(dv.tauxReleve?' <span class="badge warn">relevé au minimum</span>':'')],
  ];
  let h = '';
  lines.forEach(l=>{ h+='<div class="result-line"><span class="lbl">'+l[0]+'</span><span class="val">'+l[1]+'</span></div>'; });
  if(dv.cp12) h+='<div class="result-line"><span class="lbl">dont congés payés (1/12ᵉ chaque mois)</span><span class="val">'+fmtEUR(dv.cp12)+'</span></div>';
  h+='<div class="result-line total"><span class="lbl">Salaire mensuel brut</span><span class="val">'+fmtEUR(dv.brut)+'</span></div>';
  h+='<div class="result-line"><span class="lbl">Salaire mensuel net (estimation)</span><span class="val">'+fmtEUR(dv.net)+'</span></div>';
  h+='<div class="result-line"><span class="lbl">Indemnité d\'entretien moyenne par jour</span><span class="val">'+fmtEUR(dv.ieJour)+'</span></div>';
  h+='<div class="result-line"><span class="lbl">Indemnités d\'entretien (moyenne par mois)</span><span class="val">'+fmtEUR(dv.ieMois)+'</span></div>';
  if(dv.repasMois) h+='<div class="result-line"><span class="lbl">Repas (moyenne par mois)</span><span class="val">'+fmtEUR(dv.repasMois)+'</span></div>';
  if(dv.km) h+='<div class="result-line"><span class="lbl">Frais kilométriques</span><span class="val">'+fmtEUR(dv.km)+'</span></div>';
  h+='<div class="result-line total"><span class="lbl">Total perçu par mois (net)</span><span class="val">'+fmtEUR(dv.totalNet)+'</span></div>';
  if(fe) h+='<div class="result-line"><span class="lbl">Fin de la période d\'essai (maximum)</span><span class="val">'+fe.toLocaleDateString('fr-FR')+'</span></div>';
  h+='<div class="legal">Montants calculés avec la réglementation en vigueur aujourd\'hui. Le salaire horaire ne peut jamais être inférieur au minimum légal : s\'il change, le carnet l\'applique automatiquement et vous prévient. La période d\'essai est de '+((R('essai')||[3,2])[0])+' mois au plus pour 1 à 3 jours d\'accueil par semaine, '+((R('essai')||[3,2])[1])+' mois pour 4 jours et plus.</div>';
  setHTML('ct-recap', h);
}
function ctStep(dir){
  ctRead();
  if(dir>0){
    if(CT_STEP===0 && !CT.enfant){ toast('Indiquez au moins le prénom de l\'enfant.'); $('ct-enfant').focus(); return; }
    if(CT_STEP===1 && CT.type===1 && !(parseFloat(CT.semaines)>0)){ toast('Indiquez le nombre de semaines d\'accueil par an.'); $('ct-semaines').focus(); return; }
    if(CT_STEP===2 && !derive(CT).moyH){ toast('Indiquez les heures d\'au moins un jour.'); return; }
    if(CT_STEP===4){ ctSave(); return; }
  }
  CT_STEP = Math.max(0, Math.min(4, CT_STEP+dir));
  ctRefresh(); window.scrollTo(0,0);
}
function ctSave(){
  ctRead();
  if(!CT.enfant){ toast('Indiquez au moins le prénom de l\'enfant.'); CT_STEP=0; ctRefresh(); return; }
  const exist = STATE.contrats.find(c=>c.id===CT.id);
  if(exist && CT._orig && JSON.stringify(paramsOf(CT)) !== JSON.stringify(CT._orig) && !CT._avenantDone){
    _confirmNoCb = ()=>{ CT._avenantDone = true; auditLog(CT.id, 'Correction du contrat (sans date d\'effet)'); ctSave(); };
    showConfirmDialog('Avenant ou correction ?', 'Vous avez changé le planning, le salaire ou les indemnités. Est-ce un AVENANT (changement à partir d\'une date : les mois d\'avant gardent les anciennes valeurs) ou la CORRECTION d\'une erreur de saisie (tout est recalculé avec les nouvelles valeurs) ?', ()=>{
      _confirmNoCb = null;
      const def = iso(new Date(today().getFullYear(), today().getMonth()+1, 1));
      askText('Date d\'effet de l\'avenant', 'À partir de quel jour les nouvelles valeurs s\'appliquent-elles ? (AAAA-MM-JJ)', def, v=>{
        const d = parseD((v||'').trim()); if(!d){ toast('Date non reconnue.'); return; }
        CT.hist = (CT.hist||[]).filter(x=>x.jusqua < iso(d));
        CT.hist.push({jusqua: iso(addDays(d,-1)), p: CT._orig, avenantDu: iso(d), saisiLe: new Date().toISOString()});
        CT._avenantDone = true; auditLog(CT.id, 'Avenant à effet du '+d.toLocaleDateString('fr-FR')); ctSave();
      });
    }, 'C\'est un avenant', 'C\'est une correction');
    return;
  }
  delete CT._orig; delete CT._avenantDone;
  const i = STATE.contrats.findIndex(c=>c.id===CT.id);
  if(i>=0){
    STATE.contrats[i] = CT;
    // les calculs déjà enregistrés pour cet enfant sont repris depuis le contrat modifié
    Object.keys(STATE.forms).forEach(t=>{ if(STATE.forms[t] && t!=='abattement' && t!=='cmg') delete STATE.forms[t][CT.id]; });
  } else STATE.contrats.push(CT);
  if(STATE.ui) delete STATE.ui.ctDraft;
  saveState(); toast('Enregistré : '+CT.enfant);
  CT = null; showHome(false, 'enfants');
}

/* =====================================================================================
   SÉLECTEUR D'ENFANT DANS CHAQUE CALCUL + MÉMOIRE DES SAISIES
   ===================================================================================== */
const PICKER_THEMES = ['mensu','mois','ccass','cp','ie','fin'];
function selKey(theme){ const k = STATE.sel[theme]; return (k && (k==='libre' || getContrat(k))) ? k : (STATE.contrats[0] ? STATE.contrats[0].id : 'libre'); }
function renderPicker(theme){
  const el = document.querySelector('.kid-picker[data-for="'+theme+'"]'); if(!el) return;
  const k = selKey(theme);
  let h = '<span class="q">Pour quel enfant ?</span><div class="chips">';
  STATE.contrats.forEach(c=>{ h+='<button type="button" class="chip'+(k===c.id?' on':'')+'" onclick="pickKid(\''+theme+'\',\''+c.id+'\')">'+esc(c.enfant||'Enfant')+'</button>'; });
  h += '<button type="button" class="chip'+(k==='libre'?' on':'')+'" onclick="pickKid(\''+theme+'\',\'libre\')">Saisie libre</button></div>';
  h += '<div class="kp-hint">'+(k==='libre'
      ? 'Calcul ponctuel : remplissez les cases vous-même. Vos saisies restent mémorisées.'
      : 'Cases remplies d\'après le contrat de '+esc(getContrat(k).enfant)+'. Vous pouvez les modifier : vos changements sont mémorisés. <a href="#" onclick="refillFromContract(\''+theme+'\');return false;">↺ Revenir aux valeurs du contrat</a>')+'</div>';
  el.innerHTML = h;
}
function pickKid(theme, key){
  persistTheme(theme);
  STATE.sel[theme] = key; saveState();
  loadThemeForm(theme);
}
function refillFromContract(theme){
  const k = selKey(theme);
  if(STATE.forms[theme]) delete STATE.forms[theme][k];
  loadThemeForm(theme);
  toast('Valeurs du contrat rechargées.');
}
function formCollect(theme){
  const root = $('theme-'+theme), f = {i:{}, s:{}};
  root.querySelectorAll('input[id], select[id]').forEach(el=>{ if(el.type!=='file' && el.value!=='') f.i[el.id]=el.value; });
  root.querySelectorAll('.seg[id]').forEach(g=>{ f.s[g.id]=parseInt(g.dataset.value||0); });
  return f;
}
function formApply(theme, f){
  const root = $('theme-'+theme);
  root.querySelectorAll('input[id], select[id]').forEach(el=>{ if(el.type!=='file') el.value=''; });
  root.querySelectorAll('.seg[id]').forEach(g=>{ const def=g.dataset.def!==undefined?+g.dataset.def:0; setSegVal(g.id, def); });
  if(!f) return;
  Object.keys(f.s||{}).forEach(id=>setSegVal(id, f.s[id]));
  Object.keys(f.i||{}).forEach(id=>setVal(id, f.i[id]));
  refreshVisibility(theme);
  // 2ᵉ passage : champs créés dynamiquement (calendrier…)
  Object.keys(f.i||{}).forEach(id=>{ if($(id)) setVal(id, f.i[id]); });
}
function formKey(theme){ return (theme==='abattement'||theme==='cmg') ? 'all' : selKey(theme); }
function persistTheme(theme){
  if(!$('theme-'+theme) || ['contrat','reglages','aide','docs','suivi'].includes(theme)) return;
  STATE.forms[theme] = STATE.forms[theme] || {};
  STATE.forms[theme][formKey(theme)] = formCollect(theme);
  saveState();
}
function loadThemeForm(theme){
  const key = formKey(theme);
  const saved = STATE.forms[theme] && STATE.forms[theme][key];
  if(saved){ formApply(theme, saved); }
  else {
    formApply(theme, null);
    const c = key!=='libre' && key!=='all' ? getContrat(key) : null;
    if(PREFILL[theme]) PREFILL[theme](c);
    refreshVisibility(theme);
  }
  if(PICKER_THEMES.includes(theme)) renderPicker(theme);
  recalc(theme);
}
/* Remet les segments à leur valeur par défaut HTML (mémorisée au démarrage) */
function rememberSegDefaults(){ document.querySelectorAll('.seg[id]').forEach(g=>{ g.dataset.def = g.dataset.value||0; }); }
