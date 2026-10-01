/* =====================================================================================
   IMPRESSION / PDF · SAUVEGARDE · RÉGLAGES · MISES À JOUR RÉGLEMENTAIRES · AIDE · DÉMARRAGE
   ===================================================================================== */
'use strict';
const APP_VERSION = '3.6.0';

/* ---------------------------------- Impression / PDF ---------------------------------- */
let _pc = null;
function askPrintChoice(themeId, title){ persistTheme(themeId); _pc = {themeId, title}; openOverlay('pc-overlay'); }
function pcCancel(){ _pc=null; closeOverlay('pc-overlay'); }
function pcConfirm(mode){
  if(!_pc) return;
  const {themeId, title} = _pc; _pc=null; closeOverlay('pc-overlay');
  if(themeId==='abattement') printAbattement(title, mode); else printRecap(themeId, title, mode);
}
function recapHeader(title, mode, sub){
  let h = '<h1>'+esc(title)+'</h1><div class="meta">Carnet Assmat · édité le '+new Date().toLocaleDateString('fr-FR')+(sub?' · '+esc(sub):'')+' · réglementation version '+esc(REG.version)+'</div>';
  if(mode==='pdf') h += '<div class="meta">Choisissez « Enregistrer au format PDF » comme imprimante.</div>';
  return h;
}
function doPrint(html){
  $('print-recap').innerHTML = html;
  document.body.classList.add('printing');
  setTimeout(()=>{ window.print(); setTimeout(()=>document.body.classList.remove('printing'), 500); }, 60);
}
function visible(el){ return !!(el.offsetParent || el.getClientRects().length); }
function printRecap(themeId, title, mode){
  const th = $('theme-'+themeId), rows=[], res=[];
  const wasAll = th.classList.contains('all'); th.classList.add('all');
  th.querySelectorAll('.field, .toggle-row').forEach(el=>{
    if(!visible(el) || el.closest('.stub') || el.closest('.kid-picker')) return;
    if(el.classList.contains('toggle-row')){
      const q=el.querySelector('.q'), on=el.querySelector('.seg button.on');
      if(q && on) rows.push([q.textContent.trim(), on.textContent.trim()]);
    } else {
      const l=el.querySelector('label'), i=el.querySelector('input,select');
      if(l && i && i.value!=='' && i.type!=='file'){ let v=i.value; if(i.type==='date') v=fmtDate(v); if(i.type==='month') v=fmtMonth(v); rows.push([l.textContent.trim(), v]); }
    }
  });
  th.querySelectorAll('.result-line').forEach(el=>{
    if(!visible(el)) return;
    const l=el.querySelector('.lbl'), v=el.querySelector('.val');
    if(l && v && v.textContent.trim()!=='—') res.push([l.textContent.replace(/\s+/g,' ').trim(), v.textContent.trim(), el.classList.contains('total')]);
  });
  const k = PICKER_THEMES.includes(themeId) ? selKey(themeId) : null;
  const c = k && k!=='libre' ? getContrat(k) : null;
  let h = recapHeader(title, mode, c ? contratLabel(c) : '');
  h += '<h3>Informations saisies</h3><table>'+rows.map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td></tr>').join('')+'</table>';
  h += '<h3>Résultats</h3><table>'+res.map(r=>'<tr class="'+(r[2]?'tot':'')+'"><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td></tr>').join('')+'</table>';
  const lg = th.querySelector('.stub .legal');
  if(lg) h += '<div class="legal-p">'+esc(lg.textContent)+'</div>';
  h += '<div class="legal-p">Estimation indicative établie avec la réglementation connue à cette date ; les montants officiels sont ceux calculés par Pajemploi, la CAF/MSA ou l\'administration fiscale.</div>';
  if(!wasAll) th.classList.remove('all');
  doPrint(h);
}
function printAbattement(title, mode){
  const nb = seg('ab-nbenfants')+1, a = abYear(), T = abTauxBase();
  let h = recapHeader(title, mode, 'Revenus '+(a||'—')+' · abattement '+fmtEUR(T.eff)+' par jour complet');
  for(let i=1;i<=nb;i++){
    h += '<h3>'+esc(val('ab-c'+i+'-nom')||'Enfant '+i)+(val('ab-c'+i+'-employeur')?' — '+esc(val('ab-c'+i+'-employeur')):'')+(seg('ab-c'+i+'-hand')?' (enfant handicapé : abattement majoré)':'')+(seg('ab-c'+i+'-h24')?' (accueil continu de 24 h)':'')+'</h3>';
    if(val('ab-c'+i+'-debut')||val('ab-c'+i+'-fin')) h += '<div class="meta">Contrat : '+(fmtDate(val('ab-c'+i+'-debut'))||'—')+' au '+(fmtDate(val('ab-c'+i+'-fin'))||'—')+'</div>';
    h += '<table><tr><td><b>Mois</b></td><td><b>Sommes perçues</b></td><td><b>Jours ≥8 h / h &lt;8 h</b></td><td><b>Abattement</b></td><td><b>Imposable</b></td></tr>';
    for(let m=0;m<13;m++){
      if(!abSlotActive(i,m,a)) continue;
      const s = num('ab-c'+i+'-m'+m+'-sal')+num('ab-c'+i+'-m'+m+'-ind')+num('ab-c'+i+'-m'+m+'-av');
      const j8 = num('ab-c'+i+'-m'+m+'-j8'), hm8 = num('ab-c'+i+'-m'+m+'-hm8');
      if(!s && !j8 && !hm8) continue;
      h += '<tr><td>'+$('ab-c'+i+'-m'+m+'-row').firstChild.textContent+'</td><td>'+fmtEUR(s)+'</td><td>'+fmtNum(j8,1)+' j / '+fmtNum(hm8,2)+' h</td><td>'+$('ab-c'+i+'-m'+m+'-abatt').textContent+'</td><td>'+$('ab-c'+i+'-m'+m+'-decl').textContent+'</td></tr>';
    }
    h += '<tr class="tot"><td>Total</td><td>'+$('out-ab-c'+i+'-sal').textContent+'</td><td></td><td>'+$('out-ab-c'+i+'-abatt').textContent+'</td><td>'+$('out-ab-c'+i+'-decl').textContent+'</td></tr></table>';
  }
  h += '<h3>Synthèse</h3><table>'
    + '<tr><td>Total des sommes perçues</td><td>'+$('out-ab-total-sal').textContent+'</td></tr>'
    + '<tr><td>Total de l\'abattement</td><td>'+$('out-ab-total-abatt').textContent+'</td></tr>'
    + '<tr><td>Régime ordinaire (salaires seuls)</td><td>'+$('out-ab-commun').textContent+'</td></tr>'
    + '<tr class="tot"><td>Montant imposable à déclarer (régime spécial)</td><td>'+$('out-ab-total-decl').textContent+'</td></tr>'
    + '<tr><td>Case 1AJ / 1BJ</td><td>'+$('out-ab-1aj').textContent+'</td></tr><tr><td>Case 1GA / 1HA</td><td>'+$('out-ab-1ga').textContent+'</td></tr></table>';
  h += '<div class="legal-p">'+esc(document.querySelector('#theme-abattement .legal').textContent)+'</div>';
  doPrint(h);
}

/* ---------------------------------- Sauvegarde (copie de sécurité) ---------------------------------- */
async function syncExport(){
  persistTheme(CURRENT);
  const now = new Date();
  // pièces jointes du suivi (photos de certificats, tickets…) incluses dans la copie
  let pj = {};
  try{ const all = await pjAll(); for(const id of Object.keys(all)){ pj[id] = {nom: all[id].nom, type: all[id].type, t: all[id].t, data: await blobToB64(all[id].blob)}; } }catch(e){ pj = {}; }
  const payload = { app:'carnet-assmat', version:2, appVersion:APP_VERSION, exportedAt: now.toISOString(), state: STATE, pj };
  const blob = new Blob([JSON.stringify(payload, null, 1)], {type:'application/json'});
  const name = 'copie-carnet-assmat-'+iso(today())+'.json';
  const file = (typeof File==='function') ? new File([blob], name, {type:'application/json'}) : null;
  const finish = ()=>{ STATE.lastExport = now.toISOString(); saveNow(); if(CURRENT==='home') renderHome(); };
  // Sur téléphone : proposer directement le partage (Drive, mail, WhatsApp…), sinon téléchargement
  if(file && navigator.canShare && navigator.canShare({files:[file]})){
    navigator.share({files:[file], title:'Copie de sécurité Carnet Assmat'}).then(()=>{ finish(); toast('Copie de sécurité partagée.'); })
      .catch(err=>{ if(err && err.name==='AbortError') return; download(blob, name); finish(); });
  } else { download(blob, name); finish(); toast('Copie enregistrée dans vos téléchargements : '+name); }
}
function download(blob, name){
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
function syncImportPick(){ $('sync-file-input').click(); }
function syncImportFile(file){
  if(!file) return;
  const r = new FileReader();
  r.onload = e=>{
    let p; try{ p = JSON.parse(e.target.result); }catch(err){ toast('Fichier illisible.'); return; }
    let newState = null, label = '';
    if(p && p.app==='carnet-assmat' && p.state){ newState = Object.assign(clone(STATE_DEFAULT), p.state); label = 'copie du '+new Date(p.exportedAt).toLocaleString('fr-FR'); }
    else if(p && p.app==='carnet-calcul-assmat' && p.data){
      // ancienne version du carnet
      newState = clone(STATE); label = 'sauvegarde de l\'ancienne version';
      const keep = STATE; STATE = newState;
      try{
        if(p.data['assmat-abattement-v1']) legacyAbToForm(JSON.parse(p.data['assmat-abattement-v1']));
        if(p.data['assmat-cmg-v1']) legacyCmgToForm(JSON.parse(p.data['assmat-cmg-v1']));
        if(p.data['assmat-cmg-historique-v1']) STATE.cmgHistory = (JSON.parse(p.data['assmat-cmg-historique-v1'])||[]).map(h=>({id:h.id,label:h.label,savedAt:h.savedAt,form:legacyCmgForm(h.state)}));
      }catch(err){}
      newState = STATE; STATE = keep;
    }
    if(!newState){ toast('Ce fichier ne vient pas du Carnet Assmat.'); return; }
    showConfirmDialog('Restaurer cette copie ?', 'Fichier : '+label+'. Les données actuelles de ce téléphone seront remplacées par celles du fichier. Continuer ?', ()=>{
      STATE = newState; STATE.settings = Object.assign(clone(STATE_DEFAULT.settings), STATE.settings||{});
      saveNow(); regBuild(); applyTheme(); CURRENT='home'; showHome(); toast('Copie restaurée.');
      if(p.pj) (async ()=>{ for(const id of Object.keys(p.pj)){ try{ const x=p.pj[id]; await pjPutRaw(id, {blob: await b64ToBlob(x.data), nom:x.nom, type:x.type, t:x.t}); }catch(e){} } })();
    }, 'Oui, restaurer', 'Annuler');
  };
  r.readAsText(file);
  $('sync-file-input').value = '';
}
function wipeAll(){
  showConfirmDialog('Tout effacer ?', 'Tous les enfants, calculs et réglages enregistrés sur ce téléphone seront supprimés définitivement. Faites une copie de sécurité avant si besoin. Continuer ?', ()=>{
    STATE = clone(STATE_DEFAULT); saveNow(); regBuild(); applyTheme(); CURRENT='home'; showHome(); toast('Données effacées.');
  }, 'Oui, tout effacer', 'Annuler');
}

/* ---------------------------------- Réglages ---------------------------------- */
const PROFIL_FIELDS = ['nom','adresse','tel','email','agrementNum','agrementDate','agrementDuree','assurance','assuranceAuto'];
function applyTheme(){
  const t = STATE.settings.theme;
  if(t===1) document.documentElement.dataset.theme='light'; else if(t===2) document.documentElement.dataset.theme='dark'; else delete document.documentElement.dataset.theme;
}
function renderSettings(){
  setSegVal('set-am', STATE.settings.am); setSegVal('set-theme', STATE.settings.theme); setSegVal('set-autoreg', STATE.settings.autoreg);
  setVal('set-agrement', STATE.settings.agrement); setVal('set-regurl', STATE.settings.regUrl);
  PROFIL_FIELDS.forEach(k=>setVal('prof-'+k, (STATE.profil||{})[k]));
  setVal('set-zone', STATE.settings.zone||''); setVal('set-rappel', STATE.settings.rappel||'18:30'); setVal('set-conservation', STATE.settings.conservation||5);
  setVal('set-pin-new', ''); setSegVal('set-suivi', STATE.settings.suivi===0 ? 1 : 0); setSegVal('set-font', STATE.settings.font||0);
  regRenderStatus(); regRenderTable();
}
function settingsChanged(){
  const amBefore = STATE.settings.am;
  STATE.settings.am = seg('set-am'); STATE.settings.theme = seg('set-theme'); STATE.settings.autoreg = seg('set-autoreg');
  STATE.settings.agrement = parseInt(val('set-agrement')) || 4; STATE.settings.regUrl = val('set-regurl').trim();
  if(amBefore !== STATE.settings.am) Object.keys(_feriesCache).forEach(k=>delete _feriesCache[k]);
  STATE.profil = STATE.profil || {};
  PROFIL_FIELDS.forEach(k=>STATE.profil[k] = val('prof-'+k).trim());
  const z = val('set-zone'); if(z !== STATE.settings.zone){ STATE.settings.zone = z; if(z) loadVacances(z, true); }
  STATE.settings.rappel = val('set-rappel') || '18:30';
  STATE.settings.conservation = parseInt(val('set-conservation')) || 5;
  STATE.settings.suivi = seg('set-suivi')===1 ? 0 : 1; STATE.settings.font = seg('set-font'); applyFontSize();
  applyTheme(); saveState();
}

/* ---------------------------------- Mises à jour réglementaires ---------------------------------- */
function regRenderStatus(){
  const txt = 'Réglementation : version du <b>'+fmtDate(REG.version)+'</b>. '
    + (STATE.regCheckedAt ? 'Dernière recherche de mise à jour : '+new Date(STATE.regCheckedAt).toLocaleDateString('fr-FR')+'.' : 'Aucune recherche de mise à jour faite depuis ce téléphone.')
    + (Object.keys(STATE.regManual||{}).length ? ' Vous avez modifié certaines valeurs à la main.' : '');
  setHTML('reg-status', txt); setHTML('reg-home-status', txt);
}
function regSnapshot(){ const s={}; Object.keys(REG.params).forEach(k=>s[k]=JSON.stringify(REG.params[k].values.map(x=>[x.du,x.v]))); return s; }
function regDiff(before){
  const out=[];
  Object.keys(REG.params).forEach(k=>{
    const p = REG.params[k];
    const old = before[k] ? JSON.parse(before[k]) : [];
    p.values.forEach(x=>{
      const o = old.find(y=>y[0]===x.du);
      if(!o || JSON.stringify(o[1])!==JSON.stringify(x.v)) out.push({k, cat:p.cat, label:p.label, du:x.du, v:x.v, old:o?o[1]:null, unit:p.unit});
    });
  });
  return out;
}
function fmtRegV(v, unit){
  if(v && typeof v==='object' && !Array.isArray(v)) return Object.keys(v).map(k=>(EVT_LABELS[k]||k)+' : '+v[k]).join(' · ');
  if(Array.isArray(v)) return v.map(x=>typeof x==='object'?(x.mois?x.mois+' mois':x.jours+' j'):String(x).replace('.',',')).join(' · ');
  if(unit==='ratio') return fmtNum(v*100,2)+' %';
  if(typeof v==='number') return (unit && unit.indexOf('€')===0 ? fmtEUR(v)+unit.slice(1) : fmtNum(v, v%1?2:0)+' '+(unit||''));
  return String(v);
}
/* Conséquences concrètes pour les contrats enregistrés */
function regImpacts(changes){
  const out=[];
  const keys = new Set(changes.map(c=>c.k));
  STATE.contrats.forEach(c=>{
    const nom = esc(c.enfant||'Enfant');
    if(keys.has('salMin') || keys.has('salMinTitre')){
      const ch = changes.find(x=>x.k===(c.titre?'salMinTitre':'salMin'));
      if(ch && (parseFloat(c.taux)||0) < ch.v) out.push('<b>'+nom+'</b> : le salaire horaire ('+fmtEUR(parseFloat(c.taux)||0)+') est sous le nouveau minimum ('+fmtEUR(ch.v)+' à partir du '+fmtDate(ch.du)+'). Le carnet applique le minimum d\'office ; faites signer un avenant.');
    }
    if((keys.has('mg')||keys.has('iePct')||keys.has('iePlancher')) && c.ieMode===0) out.push('<b>'+nom+'</b> : l\'indemnité d\'entretien (minimum légal automatique) est recalculée.');
  });
  if(keys.has('smic')) out.push('Impôts : l\'abattement par jour suit le SMIC du 1er janvier de l\'année des revenus.');
  if([...keys].some(k=>k.indexOf('cmg')===0)) out.push('Aide CMG : le nouveau barème s\'applique aux mois concernés.');
  if(keys.has('netRatio')||keys.has('netRatioAM')) out.push('Les salaires nets estimés sont recalculés.');
  return out;
}
function showRegNews(all, changes){
  let h='';
  if(changes && changes.length){
    const byCat={};
    changes.forEach(c=>(byCat[c.cat]=byCat[c.cat]||[]).push(c));
    h += '<p>Nouvelles valeurs <b>appliquées automatiquement</b> aux calculs concernés, à partir de leur date d\'effet :</p>';
    Object.keys(byCat).forEach(cat=>{
      h += '<div class="section-label">'+esc(REG.categories[cat]||cat)+'</div>';
      byCat[cat].forEach(c=>{ h += '<div class="reg-row"><div class="rl">'+esc(c.label)+'</div><div class="rv">à partir du <b>'+fmtDate(c.du)+'</b> : <b>'+esc(fmtRegV(c.v,c.unit))+'</b>'+(c.old!==null?' (avant : '+esc(fmtRegV(c.old,c.unit))+')':'')+'</div></div>'; });
    });
    const imp = regImpacts(changes);
    if(imp.length) h += '<div class="section-label">Ce que ça change pour vous</div><div class="alerts">'+imp.map(x=>'<div class="alert warn">'+x+'</div>').join('')+'</div>';
  }
  const log = REG.changelog.slice(0, all ? 12 : 4);
  if(log.length){
    h += '<div class="section-label">Dernières évolutions</div>';
    log.forEach(l=>{ h += '<div class="reg-row"><div class="rv"><b>'+fmtDate(l.date)+'</b> · '+esc((l.cats||[]).map(c=>REG.categories[c]||c).join(', '))+'</div><div class="rl">'+esc(l.text)+'</div></div>'; });
  }
  h += '<p class="hint" style="margin-top:12px">Sources officielles à consulter en cas de doute : <a href="https://www.pajemploi.urssaf.fr/" target="_blank" rel="noopener">Pajemploi</a> · <a href="https://www.service-public.fr/particuliers/vosdroits/F2300" target="_blank" rel="noopener">Service-public (SMIC)</a> · <a href="https://www.urssaf.fr/accueil/actualites.html" target="_blank" rel="noopener">Urssaf</a> · <a href="https://www.impots.gouv.fr/" target="_blank" rel="noopener">impots.gouv</a> · <a href="https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000044594539" target="_blank" rel="noopener">Convention collective (Légifrance)</a></p>';
  setHTML('news-body', h); openOverlay('news-overlay');
}
async function regCheckUpdates(silent){
  const url = (STATE.settings.regUrl || 'reglementation.json');
  if(!navigator.onLine){ if(!silent) toast('Pas de connexion internet : réessayez plus tard.'); return; }
  if(location.protocol==='file:' && !STATE.settings.regUrl){
    if(!silent) showConfirmDialog('Mise à jour en ligne indisponible', 'Le carnet est ouvert comme un simple fichier : il ne peut pas télécharger la réglementation. Installez-le comme application (voir Aide) ou importez un fichier de réglementation. Voulez-vous ouvrir les sources officielles pour vérifier vous-même ?', ()=>showRegNews(true), 'Voir les sources', 'Fermer');
    return;
  }
  if(!silent) toast('Recherche des mises à jour…');
  try{
    const resp = await fetch(url + (url.indexOf('?')>=0?'&':'?') + 't=' + Date.now(), {cache:'no-store'});
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    const data = await resp.json();
    regApplyRemote(data, silent);
  }catch(e){
    STATE.regCheckedAt = STATE.regCheckedAt || null;
    if(!silent) showConfirmDialog('Recherche impossible', 'La source de réglementation n\'a pas répondu ('+e.message+'). Vos calculs utilisent la réglementation intégrée (version du '+fmtDate(REG.version)+'). Voulez-vous voir les sources officielles pour vérifier ?', ()=>showRegNews(true), 'Voir les sources', 'Fermer');
  }
}
function regValidate(d){
  if(!d || d.schema!==1 || typeof d.params!=='object' || !d.version) return false;
  return Object.values(d.params).every(p=>p && Array.isArray(p.values) && p.values.every(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.du) && x.v!==undefined));
}
function regApplyRemote(data, silent){
  if(!regValidate(data)){ if(!silent) toast('Fichier de réglementation invalide : rien n\'a été modifié.'); return; }
  const before = regSnapshot();
  STATE.regRemote = data; STATE.regCheckedAt = new Date().toISOString();
  regBuild(); saveNow();
  const changes = regDiff(before);
  regRenderStatus();
  if(CURRENT!=='home') recalc(CURRENT); else renderHome();
  if(changes.length) showRegNews(false, changes);
  else if(!silent) toast('Réglementation à jour (version du '+fmtDate(REG.version)+').');
}
function regImportPick(){ $('reg-file-input').click(); }
function regImportFile(file){
  if(!file) return;
  const r = new FileReader();
  r.onload = e=>{ try{ regApplyRemote(JSON.parse(e.target.result), false); }catch(err){ toast('Fichier illisible.'); } if(CURRENT==='reglages') regRenderTable(); };
  r.readAsText(file); $('reg-file-input').value='';
}
function regRenderTable(){
  const cats = {};
  Object.keys(REG.params).forEach(k=>{ const p=REG.params[k]; (cats[p.cat]=cats[p.cat]||[]).push(k); });
  let h='';
  Object.keys(REG.categories).forEach(cat=>{
    if(!cats[cat]) return;
    h += '<details class="reg-cat help"><summary>'+esc(REG.categories[cat])+'</summary><div>';
    cats[cat].forEach(k=>{
      const p = REG.params[k], cur = R(k), du = Rdu(k), nx = Rnext(k);
      h += '<div class="reg-row" id="regrow-'+k+'"><div class="rl">'+esc(p.label)+(p.src?' <a href="'+esc(p.src)+'" target="_blank" rel="noopener">↗</a>':'')+'</div>'
        + '<div class="rv">En vigueur : <b>'+esc(fmtRegV(cur,p.unit))+'</b> depuis le '+fmtDate(du)+(nx?' · prochaine valeur : <b>'+esc(fmtRegV(nx.v,p.unit))+'</b> le '+fmtDate(nx.du):'')
        + ' <a href="#" onclick="regEdit(\''+k+'\');return false;">✎</a></div>'
        + '<div class="rv">Historique : '+p.values.map(x=>fmtDate(x.du)+' → '+esc(fmtRegV(x.v,p.unit))+(x.manual?' <span class="manual">(saisi à la main)</span>':'')).join(' ; ')+'</div>'
        + (p.note?'<div class="hint">'+esc(p.note)+'</div>':'')+'</div>';
    });
    h += '</div></details>';
  });
  if(Object.keys(STATE.regManual||{}).length) h += '<button class="btn small danger" onclick="regClearManual()">Supprimer mes valeurs saisies à la main</button>';
  setHTML('reg-table', h);
}
function regEdit(k){
  const p = REG.params[k], cur = R(k);
  const isArr = Array.isArray(cur) && typeof cur[0]==='number';
  if(cur && typeof cur==='object' && !isArr){ toast('Cette valeur se modifie par fichier de réglementation.'); return; }
  askText('Nouvelle valeur : '+p.label, 'Saisissez la date d\'effet puis la valeur, séparées par un espace. Exemple : 2027-01-01 '+(isArr?cur.join(';'):String(cur))+(p.unit==='ratio'?' (ratio, ex. 0.7812)':''), iso(today())+' '+(isArr?cur.join(';'):String(cur)), txt=>{
    const m = String(txt||'').trim().match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    if(!m){ toast('Format attendu : AAAA-MM-JJ valeur'); return; }
    let v;
    if(isArr) v = m[2].split(/[;\s]+/).map(x=>parseFloat(x.replace(',','.')));
    else v = parseFloat(m[2].replace(',','.'));
    if(isArr ? v.some(isNaN) : isNaN(v)){ toast('Valeur non reconnue.'); return; }
    STATE.regManual[k] = (STATE.regManual[k]||[]).filter(x=>x.du!==m[1]).concat([{du:m[1], v}]);
    regBuild(); saveNow(); regRenderTable(); regRenderStatus();
    toast('Valeur ajoutée : elle s\'applique à partir du '+fmtDate(m[1])+'.');
  });
}
function regClearManual(){
  showConfirmDialog('Supprimer vos valeurs ?', 'Les valeurs saisies à la main seront supprimées ; les valeurs officielles du carnet s\'appliqueront.', ()=>{ STATE.regManual={}; regBuild(); saveNow(); regRenderTable(); regRenderStatus(); }, 'Oui', 'Annuler');
}

/* ---------------------------------- Aide ---------------------------------- */
const AIDE = [
  ['Comment commencer ?', 'Sur l\'accueil, touchez <b>« Ajouter un enfant »</b> et répondez aux questions (prénom, dates, planning, tarif). Recommencez pour chaque enfant (4 en cours au maximum). Ensuite, chaque calcul se remplit tout seul : choisissez l\'enfant en haut de l\'écran. Pour un calcul ponctuel, choisissez « Saisie libre ». Renseignez aussi une fois « Mon profil » (Réglages) pour les documents.'],
  ['Chaque mois : 3 gestes', '1. Touchez <b>« Ce mois-ci »</b> sur la carte de l\'enfant (ou l\'alerte « Déclaration Pajemploi »).<br>2. Vérifiez les cases (absence, heures en plus, jours de présence), puis <b>recopiez sur Pajemploi</b> le bloc orange, ligne par ligne : une déclaration par enfant.<br>3. Touchez <b>« Valider ce mois »</b>. Le mois est gardé dans l\'historique : congés payés, régularisation, indemnité de rupture et impôts se remplissent ensuite tout seuls, sans recalcul. Si le bulletin Pajemploi donne un autre net, corrigez avant de valider.'],
  ['Le suivi au jour le jour (facultatif)', 'Chaque soir, ouvrez <b>Suivi &amp; paie</b> : pour une journée normale, un appui sur <b>« Conforme »</b> (ou « Tout conforme » pour tous les enfants). En cas d\'écart, touchez « Écart / absence » : heures réelles, motif d\'absence, repas, kilomètres, frais avancés avec photo du ticket, certificat, note. En fin de mois, l\'onglet <b>Mois</b> fait la liste des vérifications, le récapitulatif à envoyer aux parents, la clôture (le mois ne se modifie plus, sauf par une régularisation tracée), puis <b>« Préparer la déclaration »</b> remplit « Salaire du mois &amp; Pajemploi » avec les vrais chiffres. Si vous n\'utilisez pas le suivi, tous les autres calculs fonctionnent comme avant, à partir du planning.'],
  ['Un contrat déjà commencé', 'Vous pouvez ajouter un enfant accueilli depuis longtemps. Indiquez la vraie date de début du contrat, puis ouvrez « Contrat déjà commencé : reprendre les compteurs » : date à partir de laquelle vous suivez l\'enfant dans le carnet, salaires déjà versés, congés restants, absences pour maladie déjà déduites. Les calculs (congés, fin de contrat, absences) en tiennent compte et le suivi ne vous demande rien avant cette date.'],
  ['Avenant ou correction ?', 'Quand vous modifiez le planning ou le salaire d\'un enfant, le carnet demande s\'il s\'agit d\'un <b>avenant</b> (à partir d\'une date : les mois d\'avant restent calculés avec les anciennes valeurs, et un avenant au milieu d\'un mois est réparti sur les deux périodes) ou d\'une <b>correction</b> d\'erreur (tout est recalculé).'],
  ['Que devient un contrat terminé ?', 'Touchez « Fin de contrat » sur la carte de l\'enfant et indiquez le dernier jour (fin du préavis). Le contrat reste affiché jusqu\'à cette date, puis <b>se range tout seul</b> dans « Contrats terminés » : il <b>libère sa place</b> pour un nouvel enfant mais <b>garde toutes ses données</b> (mois validés, calculs, documents), utiles pour vos impôts, une attestation ou un litige. Inutile de le supprimer. Une suppression efface tout définitivement : faites d\'abord une copie de sécurité. Conservez vos justificatifs au moins 5 ans.'],
  ['Les documents', 'Le thème « Documents » prépare, pour chaque enfant : la fiche d\'embauche (ce qu\'il faut saisir à la CAF et sur Pajemploi), le contrat de travail, les autorisations, l\'avenant, le récapitulatif annuel, les lettres de retrait ou de démission, le certificat de travail et le reçu pour solde de tout compte. Tout se pré-remplit à partir de « Mon profil » et du contrat. Ce sont des modèles à relire et signer.'],
  ['Année complète ou incomplète ?', '<b>Année complète</b> : l\'enfant vient toutes les semaines de l\'année, sauf pendant vos congés payés. Le salaire est calculé sur 52 semaines et vos congés payés sont compris dedans.<br><b>Année incomplète</b> : l\'enfant ne vient pas certaines semaines en plus de vos congés (vacances scolaires, par exemple). Le salaire est calculé sur les seules semaines d\'accueil, et les congés payés sont payés en plus.'],
  ['Brut, net : quelle différence ?', 'Le <b>brut</b> est le salaire avant cotisations sociales. Le <b>net</b> est ce que vous recevez vraiment (environ 78 % du brut). Le carnet donne une estimation ; le montant exact est celui calculé par Pajemploi.'],
  ['Le salaire mensualisé', 'Pour que vous touchiez la même somme chaque mois, on « lisse » les heures de l\'année : heures par semaine × nombre de semaines ÷ 12 × salaire horaire. Le salaire horaire ne peut jamais être inférieur au minimum légal : le carnet vous prévient et applique le minimum d\'office.'],
  ['Heures complémentaires et majorées', 'Les heures en plus du contrat sont payées au tarif normal jusqu\'à 45 h dans la semaine. Au-delà de 45 h, elles sont <b>majorées</b> (10 % au minimum). Elles sont exonérées d\'impôt dans une limite annuelle.'],
  ['Les indemnités d\'entretien', 'Elles remboursent vos frais (eau, chauffage, jouets, produits…). Elles sont dues pour chaque jour où l\'enfant est présent, au minimum 90 % du « minimum garanti » pour 9 h d\'accueil, calculé selon la durée de la journée, jamais moins de 2,65 € par jour. Ce n\'est pas du salaire : pas de cotisations.'],
  ['Les congés payés', 'Vous gagnez 2,5 jours ouvrables par mois d\'accueil (30 jours par an au maximum), du 1er juin au 31 mai. Un arrêt maladie donne aussi des congés (2 jours par mois). On prend d\'abord les jours les plus anciens. Le montant payé est le plus avantageux pour vous entre le « maintien de salaire » et 10 % des salaires de l\'année.'],
  ['Absences et mois incomplet', 'La méthode de la Cour de cassation sert à retirer du salaire mensualisé les heures d\'une absence <b>non payée</b> :<br>✅ arrivée ou départ en cours de mois, premier mois avec adaptation (obligatoire depuis 2022) ;<br>✅ votre arrêt maladie, accident du travail, maternité ou paternité (vous êtes indemnisée par la CPAM et l\'IRCEM) ;<br>✅ congé sans solde ou congés payés pas encore acquis, votre enfant malade, autre absence non payée ;<br>✅ événement familial, seulement pour les jours pris au-delà de ceux prévus par la loi ;<br>✅ enfant accueilli malade avec certificat : 5 jours au plus par période de 12 mois (plus en cas d\'hospitalisation ou de maladie de 14 jours et plus).<br>⛔ On ne déduit <b>jamais</b> : l\'absence de l\'enfant voulue par les parents ou une fermeture qu\'ils imposent, l\'enfant malade sans certificat ou au-delà des 5 jours, vos congés payés en année complète, les semaines non prévues en année incomplète, les jours fériés chômés, les événements familiaux dans la limite légale.<br>Le thème « Mois incomplet &amp; absences » vous guide motif par motif.'],
  ['Jours fériés', 'Un jour férié non travaillé qui tombe un jour d\'accueil prévu est payé (dès le début du contrat, si les jours d\'accueil prévus juste avant et juste après sont travaillés ou l\'absence autorisée). Le 1er mai travaillé est payé double ; un autre jour férié travaillé est majoré de 10 %. Le carnet connaît tous les jours fériés (y compris ceux d\'Alsace-Moselle si vous l\'activez dans les Réglages).'],
  ['Fin de contrat', 'Préavis : 8 jours si moins de 3 mois d\'ancienneté, 15 jours jusqu\'à 1 an, 1 mois au-delà. Les parents qui retirent l\'enfant après 9 mois doivent l\'indemnité de rupture (1/80ᵉ de tous les salaires bruts du contrat), sauf faute grave. Il faut aussi payer les congés non pris et, en année incomplète, faire la régularisation. Documents : certificat de travail, attestation France Travail, solde de tout compte.'],
  ['Impôts : l\'abattement', 'Vous avez droit à un régime spécial : on déduit, pour chaque enfant et chaque jour de présence, 3 fois le SMIC horaire (4 fois pour un enfant handicapé). <b>Attention</b> : le montant pré-rempli sur votre déclaration ne tient pas compte de cet abattement. Il faut le corriger vous-même. Le carnet vous donne les chiffres à mettre et vérifie si le régime ordinaire n\'est pas plus avantageux.'],
  ['L\'aide CMG des parents', 'La CAF (ou la MSA) aide les parents à vous payer : c\'est le complément de libre choix du mode de garde (CMG). Il dépend de leurs revenus, du nombre d\'enfants et des heures d\'accueil. Le carnet l\'estime pour vous aider à présenter votre tarif. Les cotisations sociales sont aussi prises en charge.'],
  ['Pajemploi', 'Chaque mois, les parents déclarent votre salaire sur Pajemploi. Le thème « Salaire du mois &amp; Pajemploi » donne exactement les chiffres à déclarer : heures, jours d\'activité, jours de congés, salaire net, indemnités.'],
  ['Agrément et durées maximales', 'Votre agrément fixe le nombre d\'enfants accueillis en même temps (4 en général). Au plus 13 h par jour (11 h de repos obligatoire) et 48 h par semaine en moyenne (plus seulement avec votre accord écrit, 2 250 h par an au maximum). Le carnet vous alerte en cas de dépassement.'],
  ['Les mises à jour de la loi', 'Chaque montant légal (SMIC, minimum garanti, salaire minimum, barème CMG, abattement…) est enregistré avec sa <b>date d\'effet</b>. Le bouton « Rechercher les mises à jour » télécharge les nouvelles valeurs : elles s\'appliquent automatiquement aux calculs concernés, à partir de la bonne date, et le carnet vous dit ce qui change pour chaque enfant. Vous pouvez aussi ajouter une valeur vous-même (Réglages ▸ ✎).'],
  ['Mes données et mon téléphone', 'Tout est enregistré <b>uniquement sur votre téléphone</b> : rien n\'est envoyé sur internet. Si vous changez de téléphone ou effacez les données du navigateur, vous perdez tout : faites régulièrement une <b>copie de sécurité</b> (bouton sur l\'accueil) et gardez le fichier (Google Drive, e-mail…). Sur le nouveau téléphone, utilisez « Restaurer une copie ».'],
  ['Installer l\'application sur Android', '1. Ouvrez l\'adresse du carnet dans <b>Chrome</b>.<br>2. Touchez le menu <b>⋮</b> en haut à droite.<br>3. Choisissez <b>« Installer l\'application »</b> (ou « Ajouter à l\'écran d\'accueil »).<br>L\'icône apparaît avec vos autres applications ; le carnet fonctionne ensuite même sans internet.'],
  ['Reprendre là où j\'en étais', 'Tout ce que vous saisissez est enregistré au fur et à mesure, sur chaque écran. Si vous quittez l\'application (appel, écran éteint, fermeture), elle rouvre <b>au même endroit</b> : même écran, même enfant, même mois, fiche ou journée en cours de saisie comprise. Après une longue absence, elle rouvre sur « Aujourd\'hui » et propose de reprendre. Les données de la version « fichier » et celles de l\'application installée sont séparées : passez de l\'une à l\'autre avec « Copie de sécurité » puis « Restaurer une copie ». Même principe pour changer de téléphone.'],
  ['Mises à jour de l\'application', 'Quand une nouvelle version est disponible, un bandeau « Mettre à jour » apparaît en bas de l\'écran. Vos données ne sont jamais touchées par une mise à jour. Les valeurs légales, elles, se mettent à jour séparément (Outils ▸ Réglementation).'],
  ['Départ à la retraite', 'Depuis 2023, l\'assistante maternelle qui part volontairement à la retraite après au moins 10 ans d\'activité a droit à une indemnité conventionnelle calculée sur l\'ensemble de sa carrière (salaires des 5 dernières années, tous employeurs). Le carnet ne la calcule pas : renseignez-vous auprès de l\'IRCEM et de Pajemploi. Pour chaque employeur, la fin de contrat suit les règles de la démission (préavis), sans indemnité de rupture.'],
  ['iPhone et iPad', 'Ouvrez l\'adresse du carnet dans <b>Safari</b>, touchez <b>Partager</b> (carré avec une flèche) puis <b>« Sur l\'écran d\'accueil »</b>. Important : sur iPhone, un site non installé peut voir ses données effacées après quelques semaines sans visite ; installez donc l\'application et faites des copies de sécurité régulières.'],
  ['Outre-mer', 'Le carnet utilise les valeurs de la métropole. À Mayotte, le SMIC et certaines règles diffèrent : vérifiez les montants auprès de Pajemploi avant de vous en servir.'],
  ['Limites du carnet', 'Les résultats sont des <b>estimations</b> établies avec la réglementation connue. En cas de litige, les montants officiels sont ceux de Pajemploi, de la CAF/MSA, de l\'administration fiscale et de la convention collective. Pour un conseil personnalisé : votre relais petite enfance (RPE), la DREETS, ou un syndicat/une association d\'assistants maternels.']
];
function renderAide(){
  setHTML('aide-content', AIDE.map(a=>'<details class="help"><summary>'+a[0]+'</summary><div>'+a[1]+'</div></details>').join('')
    + '<details class="help"><summary>📖 Lexique : tous les mots expliqués</summary><div>'+(typeof lexiqueHTML==='function'?lexiqueHTML():'')+'</div></details>'
    + ((STATE.errors||[]).length ? '<button class="btn small" onclick="copyErrorReport()">Copier le rapport technique ('+STATE.errors.length+')</button>' : '')
    + '<p class="hint" style="margin-top:14px">Carnet Assmat version '+APP_VERSION+' · réglementation du '+fmtDate(REG.version)+'.</p>');
}

/* ---------------------------------- Application installable (PWA) ---------------------------------- */
let _installEvt = null;
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); _installEvt = e; show('install-box', true); });
window.addEventListener('appinstalled', ()=>{ show('install-box', false); toast('Application installée.'); });
function installApp(){ if(_installEvt){ _installEvt.prompt(); _installEvt.userChoice.finally(()=>{ _installEvt=null; show('install-box', false); }); } }
/* Service worker : voir shell.js (proposition de mise à jour sans perte de données) */
/* Enregistrement immédiat quand l'appli passe en arrière-plan (téléphone) */
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden'){ if(CURRENT!=='home') persistTheme(CURRENT); saveNow(); } });
window.addEventListener('pagehide', ()=>{ if(CURRENT!=='home') persistTheme(CURRENT); saveNow(); });

/* ---------------------------------- Code de verrouillage ---------------------------------- */
async function pinHash(p){
  try{ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('carnet-assmat:'+p)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
  catch(e){ let h=0; for(const ch of 'carnet-assmat:'+p){ h=((h<<5)-h+ch.charCodeAt(0))|0; } return 'x'+h; }
}
async function setPin(){
  const p = val('set-pin-new').trim();
  if(!/^\d{4,8}$/.test(p)){ toast('Le code doit avoir 4 à 8 chiffres.'); return; }
  STATE.settings.pin = await pinHash(p); saveNow(); setVal('set-pin-new',''); toast('Code enregistré : il sera demandé à l\'ouverture.');
}
function removePin(){ showConfirmDialog('Supprimer le code ?', 'Le carnet s\'ouvrira sans code.', ()=>{ STATE.settings.pin=''; saveNow(); toast('Code supprimé.'); }, 'Supprimer', 'Annuler'); }
function lockNow(){ setVal('lock-input',''); setTxt('lock-msg',''); openOverlay('lock-overlay'); setTimeout(()=>{ const i=$('lock-input'); if(i) i.focus(); }, 100); }
async function unlock(){
  if(await pinHash(val('lock-input').trim()) === STATE.settings.pin){ closeOverlay('lock-overlay'); }
  else { setTxt('lock-msg', 'Code incorrect. Code oublié : il faut effacer les données du site et restaurer une copie de sécurité.'); }
}
let _hiddenAt = 0;
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='hidden') _hiddenAt = Date.now();
  else if(STATE.settings.pin && _hiddenAt && Date.now()-_hiddenAt > 5*60000) lockNow();
});

/* ---------------------------------- Démarrage ---------------------------------- */
function init(){
  const st = loadState();
  regBuild(); applyTheme();
  buildWeek('ct-wA','ct-wA'); buildWeek('ct-wB','ct-wB');
  buildCpPeriods(); buildFinAvenants(); buildAbattement(); buildCmg(); fillMotifSelect();
  initSegs(document); rememberSegDefaults();
  // choix de l'enfant et dates qui changent l'indemnité de rupture
  ['fin-qui','fin-faute'].forEach(id=>$(id).addEventListener('click', ()=>{ finAutoRupture(); VIS.fin(); CALC.fin(); }));
  $('sync-file-input').addEventListener('change', e=>syncImportFile(e.target.files[0]));
  $('reg-file-input').addEventListener('change', e=>regImportFile(e.target.files[0]));
  try{ history.replaceState({theme:'home'}, '', '#'); }catch(e){}
  showHome(true);
  if(STATE.settings.pin) lockNow();
  if(STATE.settings.zone && !((STATE.vacances||{})[STATE.settings.zone]||[]).length && navigator.onLine) loadVacances(STATE.settings.zone, true);
  if(st==='migrated') toast('Vos données de l\'ancienne version (impôts, CMG) ont été reprises.');
  if(!storageOK) toast('⚠️ Ce navigateur n\'autorise pas l\'enregistrement (navigation privée ?).');
  if(STATE.settings.autoreg && (!STATE.regCheckedAt || (Date.now()-new Date(STATE.regCheckedAt))/86400000 >= 7)) setTimeout(()=>regCheckUpdates(true), 1500);
}
/* init() est lancé à la fin de shell.js, une fois tous les modules chargés */
