/* =====================================================================================
   SOCLE : outils, dates, jours fériés, stockage, référentiel réglementaire
   ===================================================================================== */
'use strict';
/* Mode test (tests.html) : aucune écriture possible dans le stockage du téléphone, quoi qu'il arrive */
const TEST_MODE = /#test$/.test(location.href);
if(TEST_MODE){ const _set = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v){ if(String(k).indexOf('assmat')===0) return; return _set.call(this, k, v); }; }

/* ---------- Outils ---------- */
const $ = id => document.getElementById(id);
function num(id){ const el=$(id); if(!el) return 0; const v=parseFloat(String(el.value).replace(',','.')); return isNaN(v)?0:v; }
function val(id){ const el=$(id); return el ? el.value : ''; }
function setVal(id, v){ const el=$(id); if(el) el.value = (v===undefined||v===null||(typeof v==='number'&&isNaN(v))) ? '' : v; }
function setTxt(id, t){ const el=$(id); if(el) el.textContent = t; }
function setHTML(id, h){ const el=$(id); if(el) el.innerHTML = h; }
function show(id, on, disp){ const el=$(id); if(el) el.style.display = on ? (disp||'block') : 'none'; }
function round2(x){ return Math.round((x+Number.EPSILON)*100)/100; }
function fmtEUR(n){ if(n===null||n===undefined||isNaN(n)) return '—'; return n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'; }
function fmtNum(n, dec){ if(n===null||n===undefined||isNaN(n)) return '—'; return n.toLocaleString('fr-FR',{minimumFractionDigits:dec,maximumFractionDigits:dec}); }
function esc(s){ return String(s===undefined||s===null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }

/* ---------- Dates (toujours en heure locale, jamais en UTC) ---------- */
function parseD(s){
  if(!s) return null;
  if(s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const m = String(s).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if(!m) return null;
  return new Date(+m[1], +m[2]-1, m[3]?+m[3]:1);
}
function iso(d){ if(!d) return ''; const p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
function isoMonth(d){ return iso(d).slice(0,7); }
function today(){ const n=new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function fmtDate(s){ const d=parseD(s); return d ? d.toLocaleDateString('fr-FR') : ''; }
function fmtMonth(s){ const d=parseD(s); return d ? d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}) : ''; }
function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function addMonths(d, n){ const x=new Date(d.getFullYear(), d.getMonth()+n, 1); const last=new Date(x.getFullYear(), x.getMonth()+1, 0).getDate(); x.setDate(Math.min(d.getDate(), last)); return x; }
function daysInMonth(y, m){ return new Date(y, m+1, 0).getDate(); }
/* mois complets entre deux dates (équivalent DATEDIF « m ») */
function monthsBetween(a, b){
  if(!a||!b||b<a) return 0;
  let m=(b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth());
  if(b.getDate()<a.getDate()) m--;
  return Math.max(0,m);
}
function mondayOf(d){ const x=new Date(d); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
const DOW_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];        // index 0 = lundi
function dowIdx(d){ return (d.getDay()+6)%7; }

/* ---------- Jours fériés (métropole + Alsace-Moselle si activé) ---------- */
function easter(y){
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),
        h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
        mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;
  return new Date(y,mo-1,da);
}
const _feriesCache = {};
function feries(y){
  const am = !!(STATE && STATE.settings && STATE.settings.am);
  const key = y+(am?'am':'');
  if(_feriesCache[key]) return _feriesCache[key];
  const e = easter(y), f = {};
  const add=(d,n)=>{ f[iso(d)]=n; };
  add(new Date(y,0,1),'Jour de l\'an'); add(addDays(e,1),'Lundi de Pâques'); add(new Date(y,4,1),'1er mai');
  add(new Date(y,4,8),'8 mai'); add(addDays(e,39),'Ascension'); add(addDays(e,50),'Lundi de Pentecôte');
  add(new Date(y,6,14),'14 juillet'); add(new Date(y,7,15),'Assomption'); add(new Date(y,10,1),'Toussaint');
  add(new Date(y,10,11),'11 novembre'); add(new Date(y,11,25),'Noël');
  if(am){ add(addDays(e,-2),'Vendredi saint'); add(new Date(y,11,26),'Saint-Étienne'); }
  _feriesCache[key]=f; return f;
}
function ferieName(d){ return feries(d.getFullYear())[iso(d)] || ''; }

/* =====================================================================================
   STOCKAGE : un seul objet d'état, enregistré automatiquement sur l'appareil
   ===================================================================================== */
const STORE_KEY = 'assmat-v2';
/* Mode démonstration : les données d'exemple vivent sous une autre clé, jamais mélangées aux vraies */
const DEMO_FLAG = 'assmat-demo-on', DEMO_KEY = 'assmat-demo';
function isDemo(){ try{ return localStorage.getItem(DEMO_FLAG)==='1'; }catch(e){ return false; } }
function curStoreKey(){ return isDemo() ? DEMO_KEY : STORE_KEY; }
/* Stockage étendu (IndexedDB) : copie complète des données, sans la limite d'environ 5 Mo du stockage simple.
   Au démarrage, la copie la plus récente des deux est utilisée. */
let IDB_PRELOAD = null;
function stateDB(){
  return new Promise((ok, ko)=>{
    if(!('indexedDB' in window)) return ko(new Error('indexedDB indisponible'));
    const rq = indexedDB.open('carnet-assmat-etat', 1);
    rq.onupgradeneeded = ()=>rq.result.createObjectStore('etat');
    rq.onsuccess = ()=>ok(rq.result); rq.onerror = ()=>ko(rq.error);
  });
}
async function idbSaveState(key, json){
  try{ const db = await stateDB(); await new Promise((ok,ko)=>{ const tx = db.transaction('etat','readwrite'); tx.objectStore('etat').put(json, key); tx.oncomplete=ok; tx.onerror=()=>ko(tx.error); }); return true; }
  catch(e){ return false; }
}
async function idbLoadState(key){
  try{ const db = await stateDB(); return await new Promise((ok,ko)=>{ const rq = db.transaction('etat').objectStore('etat').get(key); rq.onsuccess=()=>ok(rq.result||null); rq.onerror=()=>ko(rq.error); }); }
  catch(e){ return null; }
}
/* Appelé avant le démarrage : garde la copie IndexedDB si elle est plus récente que celle du stockage simple */
async function idbPreload(){
  const key = curStoreKey();
  const json = await Promise.race([idbLoadState(key), new Promise(r=>setTimeout(()=>r(null), 1500))]);
  if(!json) return;
  let local = null; try{ local = localStorage.getItem(key); }catch(e){}
  const at = s=>{ try{ return (JSON.parse(s)||{})._savedAt || ''; }catch(e){ return ''; } };
  if(!local || at(json) > at(local)) IDB_PRELOAD = json;
}
const STATE_DEFAULT = {
  v: 2,
  settings: { am:0, agrement:4, theme:0, autoreg:1, regUrl:'', zone:'', pin:'', rappel:'18:30', conservation:5, suivi:1, font:0 },
  contrats: [],                 // 4 au maximum
  forms: {},                    // forms[theme][cléEnfant] = {i:{id:valeur}, s:{id:index}}
  sel: {},                      // sel[theme] = clé de l'enfant sélectionné
  cmgHistory: [],
  journal: {},
  suivi: {},                    // suivi[idContrat] = {days:{'AAAA-MM-JJ':{…}}, months:{'AAAA-MM':{…}}, regs:[]}
  audit: [],
  vacances: {},                 // vacances scolaires téléchargées, par zone et année scolaire                  // journal[idContrat]['AAAA-MM'] = mois validé (montants déclarés)
  profil: {},                   // coordonnées de l'assistante maternelle (pour les documents)
  regRemote: null, regManual: {}, regCheckedAt: null, regSeenVersion: null,
  lastExport: null
};
let STATE = clone(STATE_DEFAULT);
let storageOK = true;

function loadState(){
  try{
    let raw = IDB_PRELOAD;
    if(!raw){ try{ raw = localStorage.getItem(curStoreKey()); }catch(e){ raw = null; } }
    if(raw){
      let parsed;
      try{ parsed = JSON.parse(raw); }
      catch(err){
        // données illisibles : on les met de côté (jamais effacées) et on repart d'un carnet vide
        try{ localStorage.setItem(curStoreKey()+'-illisible-'+Date.now(), raw); }catch(e2){}
        setTimeout(()=>toast('⚠️ Les données enregistrées étaient abîmées : elles ont été mises de côté. Restaurez votre dernière copie de sécurité.'), 800);
        return 'new';
      }
      STATE = Object.assign(clone(STATE_DEFAULT), parsed); STATE.settings = Object.assign(clone(STATE_DEFAULT.settings), STATE.settings||{});
      migrateState(); return 'ok';
    }
    if(migrateLegacy()) return 'migrated';
  }catch(e){ storageOK = false; }
  return 'new';
}
let _saveTimer = null;
function saveState(){
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveNow, 400);
}
function saveNow(){
  STATE._savedAt = new Date().toISOString();
  const key = curStoreKey(), json = JSON.stringify(STATE);
  let localOK = true;
  try{ localStorage.setItem(key, json); }
  catch(e){ localOK = false; }
  // copie complète dans le stockage étendu (prend le relais si le stockage simple est plein)
  idbSaveState(key, json).then(ok=>{
    storageOK = localOK || ok;
    if(!storageOK) toast('⚠️ Enregistrement impossible sur cet appareil (navigation privée ?). Faites une copie de sécurité.');
    else if(!localOK && !window._bigWarned){ window._bigWarned = true; toast('Le stockage simple est plein : vos données sont enregistrées dans le stockage étendu du téléphone.'); }
  });
}
/* Mise à niveau des données enregistrées par une version précédente (aucune perte) */
function migrateState(){
  ['forms','sel','journal','suivi','profil','ui','vacances','regManual'].forEach(k=>{ if(!STATE[k] || typeof STATE[k]!=='object') STATE[k] = {}; });
  ['contrats','cmgHistory','audit'].forEach(k=>{ if(!Array.isArray(STATE[k])) STATE[k] = []; });
  if(typeof newContrat==='function'){
    const def = newContrat(); delete def.id;
    STATE.contrats = STATE.contrats.map(c=>{
      const n = Object.assign(clone(def), c);
      ['wA','wB'].forEach(w=>{ if(!Array.isArray(n[w])) n[w] = ['','','','','','','']; });
      ['tA','tB','semOff','hist'].forEach(w=>{ if(!Array.isArray(n[w])) n[w] = []; });
      return n;
    });
  }
  STATE.v = 3;
}
/* Reprise automatique des anciennes versions du carnet (abattement, CMG) */
function migrateLegacy(){
  let done = false;
  try{
    const ab = localStorage.getItem('assmat-abattement-v1');
    if(ab){ legacyAbToForm(JSON.parse(ab)); done = true; }
    const cmg = localStorage.getItem('assmat-cmg-v1');
    if(cmg){ legacyCmgToForm(JSON.parse(cmg)); done = true; }
    const hist = localStorage.getItem('assmat-cmg-historique-v1');
    if(hist){ STATE.cmgHistory = (JSON.parse(hist)||[]).map(h=>({id:h.id,label:h.label,savedAt:h.savedAt,form:legacyCmgForm(h.state)})); done = true; }
  }catch(e){}
  if(done) saveNow();
  return done;
}
function legacyAbToForm(st){
  if(!st) return;
  const f = {i:{}, s:{}};
  if(st.annee) f.i['ab-annee']=st.annee;
  if(st.taux) f.i['ab-taux']=st.taux;
  f.s['ab-nbenfants'] = st.nbenfants||0;
  (st.children||[]).forEach(ch=>Object.keys(ch||{}).forEach(k=>{ if(ch[k]!=='' && ch[k]!==undefined) f.i[k]=ch[k]; }));
  STATE.forms.abattement = {all:f};
}
function legacyCmgForm(st){
  const f = {i:{}, s:{}};
  if(!st) return f;
  if(st.revenu) f.i['cmg-revenu']=st.revenu;
  f.s['cmg-nbenfants-foyer']=st.nbenfantsFoyer||0;
  f.s['cmg-monoparental']=st.monoparental||0;
  f.s['cmg-nbenfants-gardes']=st.nbenfantsGardes||0;
  (st.children||[]).forEach(ch=>Object.keys(ch||{}).forEach(k=>{ if(ch[k]) f.i[k]=ch[k]; }));
  return f;
}
function legacyCmgToForm(st){ STATE.forms.cmg = {all:legacyCmgForm(st)}; }

/* =====================================================================================
   RÉFÉRENTIEL RÉGLEMENTAIRE : fusion (intégré + téléchargé + saisi à la main)
   ===================================================================================== */
let REG = clone(REG_DEFAULT);

function regBuild(){
  const base = clone(REG_DEFAULT);
  const remote = STATE.regRemote;
  if(remote && remote.params){
    const remoteNewer = String(remote.version||'') >= String(base.version);
    Object.keys(remote.params).forEach(k=>{
      const rp = remote.params[k];
      if(!rp || !Array.isArray(rp.values)) return;
      if(!base.params[k]){ base.params[k] = clone(rp); return; }
      const bp = base.params[k];
      ['label','cat','unit','note','src'].forEach(f=>{ if(rp[f] && remoteNewer) bp[f]=rp[f]; });
      rp.values.forEach(rv=>{
        const ex = bp.values.find(x=>x.du===rv.du);
        if(!ex) bp.values.push(clone(rv));
        else if(remoteNewer) ex.v = clone(rv.v);
      });
    });
    if(remoteNewer && remote.version) base.version = remote.version;
    (remote.changelog||[]).forEach(c=>{ if(!base.changelog.some(x=>x.date===c.date && x.text===c.text)) base.changelog.push(c); });
    if(remote.categories) Object.assign(base.categories, remote.categories);
  }
  Object.keys(STATE.regManual||{}).forEach(k=>{
    if(!base.params[k]) return;
    (STATE.regManual[k]||[]).forEach(mv=>{
      const ex = base.params[k].values.find(x=>x.du===mv.du);
      if(ex){ ex.v = mv.v; ex.manual = true; } else base.params[k].values.push({du:mv.du, v:mv.v, manual:true});
    });
  });
  Object.values(base.params).forEach(p=>p.values.sort((a,b)=>a.du<b.du?-1:a.du>b.du?1:0));
  base.changelog.sort((a,b)=>a.date<b.date?1:-1);
  REG = base;
}
/* Valeur en vigueur à une date (Date, 'AAAA-MM-JJ' ou 'AAAA-MM'). Sans date : aujourd'hui. */
function R(key, when){
  const p = REG.params[key];
  if(!p || !p.values.length) return undefined;
  let d = when ? (when instanceof Date ? iso(when) : String(when)) : iso(today());
  if(d.length===7) d += '-01';
  let cur = p.values[0];
  for(const x of p.values){ if(x.du <= d) cur = x; else break; }
  return cur.v;
}
/* Date d'effet de la valeur en vigueur */
function Rdu(key, when){
  const p = REG.params[key]; if(!p) return '';
  let d = when ? (when instanceof Date ? iso(when) : String(when)) : iso(today());
  if(d.length===7) d += '-01';
  let cur = p.values[0];
  for(const x of p.values){ if(x.du <= d) cur = x; else break; }
  return cur.du;
}
/* Prochaine valeur connue après une date (pour prévenir à l'avance) */
function Rnext(key, when){
  const p = REG.params[key]; if(!p) return null;
  const d = when ? iso(parseD(when)) : iso(today());
  return p.values.find(x=>x.du > d) || null;
}
function netRatio(when){ return R(STATE.settings.am ? 'netRatioAM' : 'netRatio', when) || 0.78; }
function toNet(brut, when){ return brut * netRatio(when); }
/* Indemnité d'entretien minimale pour une journée de h heures */
function ieLegalJour(h, when, personneMorale){
  const mg = R('mg', when), ref = R('ieHeuresRef', when) || 9;
  const pct = personneMorale ? R('iePctPM', when) : R('iePct', when);
  const plancher = R('iePlancher', when);
  if(!h) return plancher;
  // minimum arrondi au centime supérieur (jamais sous le minimum légal)
  return Math.max(plancher, Math.ceil(pct*mg*h/ref*100 - 1e-7)/100);
}
/* Arrondi au centime supérieur, comme le font les simulateurs officiels pour les minima */
function ceil2(x){ return Math.ceil(x*100 - 1e-7)/100; }

/* ---------- Petits dialogues ---------- */
let _confirmCb = null, _confirmNoCb = null;
function showConfirmDialog(title, message, onYes, yesLabel, noLabel){
  setTxt('confirm-title', title); setTxt('confirm-message', message);
  setTxt('confirm-yes-label', yesLabel||'Oui'); setTxt('confirm-no-label', noLabel||'Non');
  _confirmCb = onYes; openOverlay('confirm-overlay');
}
function confirmYes(){ closeOverlay('confirm-overlay'); const cb=_confirmCb; _confirmCb=null; _confirmNoCb=null; if(cb) cb(); }
function confirmNo(){ closeOverlay('confirm-overlay'); const cb=_confirmNoCb; _confirmCb=null; _confirmNoCb=null; if(cb) cb(); }
/* Journal d'audit : trace datée de toute modification sensible (non effaçable depuis l'appli) */
function auditLog(cid, txt){
  STATE.audit = STATE.audit || [];
  STATE.audit.push({t:new Date().toISOString(), cid:cid||'', txt:String(txt)});
  if(STATE.audit.length > 5000) STATE.audit.splice(0, STATE.audit.length-5000);
}
let _promptCb = null;
function askText(title, message, def, cb){
  setTxt('prompt-title', title); setTxt('prompt-message', message); setVal('prompt-input', def||'');
  _promptCb = cb; openOverlay('prompt-overlay'); setTimeout(()=>{ const i=$('prompt-input'); if(i){ i.focus(); i.select(); } }, 50);
}
function promptOk(){ const v=val('prompt-input'); closeOverlay('prompt-overlay'); const cb=_promptCb; _promptCb=null; if(cb) cb(v); }
function promptCancel(){ closeOverlay('prompt-overlay'); _promptCb=null; }
function openOverlay(id){ $(id).classList.add('show'); }
function closeOverlay(id){ $(id).classList.remove('show'); if(id==='day-overlay' && STATE.ui) delete STATE.ui.dayDraft; }
function anyOverlayOpen(){ return [...document.querySelectorAll('.overlay.show')]; }
let _toastTimer = null;
function toast(msg, action){
  const t=$('toast'); t.textContent=msg;
  if(action){ const b=document.createElement('button'); b.className='toast-act'; b.textContent=action.label; b.onclick=()=>{ t.classList.remove('show'); action.fn(); }; t.appendChild(b); }
  t.classList.toggle('with-act', !!action); t.classList.add('show');
  clearTimeout(_toastTimer); _toastTimer=setTimeout(()=>t.classList.remove('show'), action ? 6000 : 3500);
}

/* ---------- Boutons à choix (segments) ---------- */
function seg(id){ const g=$(id); return g ? parseInt(g.dataset.value||0) : 0; }
function setSegVal(id, idx){
  const g=$(id); if(!g) return;
  const n = Math.max(0, Math.min(g.children.length-1, parseInt(idx)||0));
  [...g.children].forEach((b,i)=>{ b.classList.toggle('on', i===n); b.setAttribute('aria-pressed', i===n ? 'true' : 'false'); });
  g.dataset.value = n;
}
function initSegs(root){
  (root||document).querySelectorAll('.seg[id]').forEach(g=>{
    if(g.dataset.wired) return;
    g.dataset.wired = '1';
    const on = [...g.children].findIndex(b=>b.classList.contains('on'));
    g.dataset.value = on<0 ? 0 : on;
    if(on<0 && g.children[0]) g.children[0].classList.add('on');
    [...g.children].forEach((b,i)=>{
      b.type = 'button';
      b.addEventListener('click', ()=>{ setSegVal(g.id, i); onSegChange(g.id, i); });
    });
  });
}
