/* =====================================================================================
   07 · ABATTEMENT FISCAL (jusqu'à 4 enfants / employeurs)   —   08 · CMG des parents
   ===================================================================================== */
'use strict';

/* ---------------------------------- ABATTEMENT ---------------------------------- */
const AB_MAX = 8;   // un enfant par employeur ; sur une année, des contrats finissent et d'autres commencent
const AB_MOIS = ['Décembre','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const AB_COLS = [ {k:'sal', t:'Salaire net imposable (€)', step:'0.01'}, {k:'ind', t:'Indemnités entretien, repas, km (€)', step:'0.01'},
  {k:'av', t:'Repas fournis par les parents (€)', step:'0.01'}, {k:'j8', t:'Jours ≥ 8 h', step:'0.5'}, {k:'hm8', t:'Heures des jours < 8 h', step:'0.25'} ];
function buildAbattement(){
  let h='';
  for(let i=1;i<=AB_MAX;i++){
    let rows='';
    for(let m=0;m<13;m++){
      rows += '<tr id="ab-c'+i+'-m'+m+'-row"><td class="ab-month-label" data-m="'+m+'">'+AB_MOIS[m]+'</td>'
        + AB_COLS.map(c=>'<td data-l="'+c.t+'"><input type="number" inputmode="decimal" step="'+c.step+'" id="ab-c'+i+'-m'+m+'-'+c.k+'"></td>').join('')
        + '<td class="ab-out" data-l="Abattement" id="ab-c'+i+'-m'+m+'-abatt">—</td><td class="ab-out" data-l="Imposable" id="ab-c'+i+'-m'+m+'-decl">—</td></tr>';
    }
    rows += '<tr class="ab-total-row"><td>Total</td>'+AB_COLS.map(c=>'<td class="ab-out" data-l="'+c.t+'" id="ab-c'+i+'-tot-'+c.k+'">—</td>').join('')
      + '<td class="ab-out" data-l="Abattement" id="ab-c'+i+'-tot-abatt">—</td><td class="ab-out" data-l="Imposable" id="ab-c'+i+'-tot-decl">—</td></tr>';
    h += '<div class="ab-child-block" id="ab-child-'+i+'"'+(i>1?' style="display:none"':'')+'>'
      + '<div class="ab-child-head"><span class="ab-child-num">Enfant '+i+'</span><input type="hidden" id="ab-c'+i+'-cid"></div>'
      + '<div class="grid2"><div class="field"><label>Prénom de l\'enfant</label><input type="text" id="ab-c'+i+'-nom" placeholder="(facultatif)"></div>'
      + '<div class="field"><label>Famille / employeur</label><input type="text" id="ab-c'+i+'-employeur" placeholder="(facultatif)"></div></div>'
      + '<div class="grid2"><div class="field"><label>Début du contrat</label><input type="date" id="ab-c'+i+'-debut"></div>'
      + '<div class="field"><label>Fin du contrat</label><input type="date" id="ab-c'+i+'-fin"></div></div>'
      + '<div class="toggle-row"><span class="q">Enfant handicapé, malade ou inadapté (abattement majoré) ?</span><div class="seg" id="ab-c'+i+'-hand"><button class="on">Non</button><button>Oui</button></div></div>'
      + '<div class="toggle-row"><span class="q">Accueil continu de 24 heures (jour et nuit) ?</span><div class="seg" id="ab-c'+i+'-h24"><button class="on">Non</button><button>Oui</button></div><div class="hint">Abattement de 4 SMIC par jour (5 si l\'enfant est aussi handicapé, malade ou inadapté).</div></div>'
      + '<div class="btn-row" style="margin:-6px 0 10px"><button type="button" class="btn small" onclick="abFromJournal('+i+')">🗂️ Remplir avec les mois validés</button><button type="button" class="btn small" onclick="abPrefillDays('+i+')">📅 Jours d\'après le planning</button></div>'
      + '<div class="ab-table-wrap"><table class="ab-table"><thead><tr><th>Mois</th>'+AB_COLS.map(c=>'<th>'+c.t+'</th>').join('')+'<th>Abatte­ment</th><th>Imposable</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
      + '<div class="result-line"><span class="lbl">Sommes perçues</span><span class="val" id="out-ab-c'+i+'-sal">—</span></div>'
      + '<div class="result-line"><span class="lbl">Abattement</span><span class="val" id="out-ab-c'+i+'-abatt">—</span></div>'
      + '<div class="result-line total"><span class="lbl">Imposable pour cet enfant</span><span class="val" id="out-ab-c'+i+'-decl">—</span></div></div>';
  }
  $('ab-children').innerHTML = h;
  initSegs($('ab-children'));
}
function abYear(){ const a=parseInt(val('ab-annee')); return isNaN(a) ? null : a; }
function abTauxBase(){
  const a = abYear();
  const auto = a ? R('abatMult', a+'-01-01')*R('smic', a+'-01-01') : null;
  return { auto, eff: num('ab-taux') || auto || 0 };
}
function abSlot(m, annee){ return m===0 ? {y:annee-1, mo:11} : {y:annee, mo:m-1}; }
function abSlotActive(i, m, annee){
  const s=val('ab-c'+i+'-debut'), e=val('ab-c'+i+'-fin');
  if(!s && !e) return true;
  if(!annee) return true;
  const {y,mo} = abSlot(m, annee);
  const a=new Date(y,mo,1), b=new Date(y,mo+1,0);
  if(s && b < parseD(s)) return false;
  if(e && a > parseD(e)) return false;
  return true;
}
VIS.abattement = ()=>{
  const nb = seg('ab-nbenfants')+1;
  for(let i=1;i<=AB_MAX;i++) show('ab-child-'+i, i<=nb);
  const a = abYear();
  document.querySelectorAll('.ab-month-label').forEach(td=>{ const m=+td.dataset.m; td.textContent = AB_MOIS[m]+' '+(a ? (m===0?a-1:a) : (m===0?'(N-1)':'')); });
};
PREFILL.abattement = ()=>{
  const t = today();
  setVal('ab-annee', t.getMonth()<=5 ? t.getFullYear()-1 : t.getFullYear());
  abFillFromContracts(true);
};
function abFillFromContracts(silent){
  const a = abYear() || today().getFullYear();
  const list = STATE.contrats.filter(c=>{
    const s=parseD(c.debut), e=parseD(c.fin);
    return !(s && s > new Date(a,11,31)) && !(e && e < new Date(a-1,11,1));
  }).slice(0,AB_MAX);
  if(!list.length){ if(!silent) toast('Aucun enfant enregistré pour cette année.'); return; }
  setSegVal('ab-nbenfants', list.length-1);
  list.forEach((c,idx)=>{
    const i = idx+1;
    setVal('ab-c'+i+'-nom', c.enfant); setVal('ab-c'+i+'-employeur', c.famille);
    setVal('ab-c'+i+'-debut', c.debut); setVal('ab-c'+i+'-fin', c.fin);
    setSegVal('ab-c'+i+'-hand', c.handicap);
    setVal('ab-c'+i+'-cid', c.id);
    abFromJournal(i, true);
  });
  VIS.abattement(); CALC.abattement(); persistTheme('abattement');
  if(!silent) toast(list.length+' enfant(s) repris de vos contrats.');
}
/* Reprend, pour chaque mois de l'année, les montants des mois validés (net imposable, indemnités, jours) */
function abFromJournal(i, silent){
  const a = abYear(); if(!a){ if(!silent) toast('Indiquez d\'abord l\'année des revenus.'); return; }
  const nom = val('ab-c'+i+'-nom');
  const c = getContrat(val('ab-c'+i+'-cid')) || STATE.contrats.find(x=>x.enfant && x.enfant===nom);
  if(!c){ if(!silent) toast('Cet enfant ne correspond à aucun contrat enregistré.'); return; }
  const J = journalOf(c.id); let n = 0;
  for(let m=0;m<13;m++){
    const {y,mo} = abSlot(m,a), key = y+'-'+String(mo+1).padStart(2,'0'), r = J[key];
    if(!r) continue;
    n++;
    setVal('ab-c'+i+'-m'+m+'-sal', round2(r.netImp||0)); setVal('ab-c'+i+'-m'+m+'-ind', round2((r.ie||0)+(r.repas||0)+(r.km||0)));
    setVal('ab-c'+i+'-m'+m+'-j8', r.j8||''); setVal('ab-c'+i+'-m'+m+'-hm8', r.hm8||'');
  }
  if(!silent){ CALC.abattement(); persistTheme('abattement'); toast(n ? n+' mois repris. Remplacez le net imposable par celui de vos bulletins ou de l\'attestation fiscale Pajemploi s\'il diffère.' : 'Aucun mois validé pour cette année.'); }
}
function abPrefillDays(i){
  const a = abYear(); if(!a){ toast('Indiquez d\'abord l\'année des revenus.'); return; }
  const nom = val('ab-c'+i+'-nom');
  const c = getContrat(val('ab-c'+i+'-cid')) || STATE.contrats.find(x=>x.enfant && x.enfant===nom);
  if(!c){ toast('Cet enfant ne correspond à aucun contrat enregistré.'); return; }
  const seuil = R('abatHeuresJour');
  for(let m=0;m<13;m++){
    if(!abSlotActive(i,m,a)) continue;
    const {y,mo} = abSlot(m,a);
    const days = plannedDays(c, y, mo, {skipFeries:true});
    const j8 = days.filter(x=>x.h>=seuil).length, hm8 = days.filter(x=>x.h<seuil).reduce((s,x)=>s+x.h,0);
    setVal('ab-c'+i+'-m'+m+'-j8', j8||''); setVal('ab-c'+i+'-m'+m+'-hm8', hm8?round2(hm8):'');
  }
  CALC.abattement(); persistTheme('abattement');
  toast('Jours prévus par le planning remplis. Corrigez-les avec les jours de présence réels (absences, vacances'+(c.type===1?', semaines sans accueil':'')+').');
}
CALC.abattement = ()=>{
  const nb = seg('ab-nbenfants')+1, annee = abYear();
  const T = abTauxBase();
  setHTML('ab-taux-hint', T.auto ? 'Automatique pour '+annee+' : '+R('abatMult', annee+'-01-01')+' × '+fmtEUR(R('smic', annee+'-01-01'))+' (SMIC au 1er janvier) = <b>'+fmtEUR(T.auto)+'</b>. Laissez vide pour l\'utiliser.' : 'Indiquez l\'année : le montant est calculé automatiquement (3 × SMIC du 1er janvier).');
  let gSal=0, gAb=0, gDecl=0, gCommun=0;
  for(let i=1;i<=AB_MAX;i++){
    const hand = seg('ab-c'+i+'-hand')===1, h24 = seg('ab-c'+i+'-h24')===1;
    const base = R('abatMult');
    const mult = base + (hand ? R('abatMultMaj')-base : 0) + (h24 ? (R('abatMult24')||4)-base : 0);
    const t = T.eff * mult / base;
    const H = R('abatHeuresJour')||8;
    const tot = {sal:0,ind:0,av:0,j8:0,hm8:0,ab:0};
    for(let m=0;m<13;m++){
      const act = abSlotActive(i,m,annee);
      const row = $('ab-c'+i+'-m'+m+'-row'); if(row) row.classList.toggle('ab-row-inactive', !act);
      AB_COLS.forEach(c=>{ const el=$('ab-c'+i+'-m'+m+'-'+c.k); if(el) el.disabled=!act; });
      const v = {}; AB_COLS.forEach(c=>v[c.k] = act ? num('ab-c'+i+'-m'+m+'-'+c.k) : 0);
      const ab = v.j8*t + (v.hm8/H)*t, s = v.sal+v.ind+v.av, any = s||v.j8||v.hm8;
      setTxt('ab-c'+i+'-m'+m+'-abatt', !act ? 'Hors contrat' : any ? fmtEUR(ab) : '—');
      setTxt('ab-c'+i+'-m'+m+'-decl', !act ? '—' : any ? fmtEUR(Math.max(0,s-ab)) : '—');
      AB_COLS.forEach(c=>tot[c.k]+=v[c.k]); tot.ab+=ab;
    }
    const sal = tot.sal+tot.ind+tot.av, abC = Math.min(tot.ab, sal), decl = Math.max(0, sal-tot.ab);
    AB_COLS.forEach(c=>setTxt('ab-c'+i+'-tot-'+c.k, tot[c.k] ? (c.k==='j8'?fmtNum(tot[c.k],1)+' j':c.k==='hm8'?fmtNum(tot[c.k],2)+' h':fmtEUR(tot[c.k])) : '—'));
    setTxt('ab-c'+i+'-tot-abatt', tot.ab?fmtEUR(tot.ab):'—'); setTxt('ab-c'+i+'-tot-decl', sal?fmtEUR(decl):'—');
    setTxt('out-ab-c'+i+'-sal', sal?fmtEUR(sal):'—');
    setTxt('out-ab-c'+i+'-abatt', tot.ab?fmtEUR(abC)+(tot.ab>sal?' (plafonné)':''):'—');
    setTxt('out-ab-c'+i+'-decl', sal?fmtEUR(decl):'—');
    if(i<=nb){ gSal+=sal; gAb+=abC; gDecl+=decl; gCommun+=tot.sal+tot.av; }
  }
  setTxt('out-ab-total-sal', gSal?fmtEUR(gSal):'—');
  setTxt('out-ab-total-abatt', gAb?fmtEUR(gAb):'—');
  setTxt('out-ab-total-decl', gSal?fmtEUR(gDecl):'—');
  setTxt('out-ab-special', gSal?fmtEUR(gDecl):'—');
  setTxt('out-ab-commun', gSal?fmtEUR(gCommun):'—');
  const spec = gDecl <= gCommun;
  setTxt('ab-badge', gSal ? (spec?'Régime spécial':'Régime ordinaire') : '—');
  setTxt('out-ab-gain', gSal ? fmtEUR(Math.abs(gCommun-gDecl))+' de moins à déclarer' : '—');
  setTxt('out-ab-1aj', gSal ? fmtEUR(Math.round(spec?gDecl:gCommun)) : '—');
  setTxt('out-ab-1ga', gSal ? (spec?fmtEUR(Math.round(gAb)):'ne rien mettre') : '—');
  abUpdateStatus();
};
function abUpdateStatus(){ setTxt('ab-save-status', storageOK ? 'Enregistrement automatique sur ce téléphone, au fil des mois.' : 'Enregistrement impossible (navigation privée ?) : faites une copie de sécurité.'); }
function abResetForNewYear(){
  showConfirmDialog('Nouvelle année', 'Toutes les saisies d\'abattement (4 enfants, tous les mois) seront effacées pour commencer une nouvelle année. Pensez à enregistrer le récapitulatif PDF de l\'année en cours avant. Continuer ?', ()=>{
    if(STATE.forms.abattement) delete STATE.forms.abattement.all;
    saveState(); loadThemeForm('abattement'); toast('Nouvelle année prête.');
  }, 'Oui, effacer', 'Annuler');
}

/* ---------------------------------- CMG ---------------------------------- */
function buildCmg(){
  let h='';
  for(let i=1;i<=4;i++){
    h += '<div class="ab-child-block box" id="cmg-child-'+i+'"'+(i>1?' style="display:none"':'')+'>'
      + '<div class="ab-child-head"><span class="ab-child-num">Enfant '+i+'</span><select id="cmg-c'+i+'-from" class="btn small" style="flex:1;max-width:240px" aria-label="Remplir cet enfant depuis un contrat"></select></div>'
      + '<div class="grid2"><div class="field"><label>Heures d\'accueil dans le mois</label><input type="number" step="0.25" id="cmg-c'+i+'-heures" placeholder="ex. 160"></div>'
      + '<div class="field"><label>Salaire horaire brut (€)</label><input type="number" step="0.01" id="cmg-c'+i+'-taux" placeholder="ex. 4.50"></div></div>'
      + '<div class="grid2"><div class="field"><label>Indemnités d\'entretien du mois (€)</label><input type="number" step="0.01" id="cmg-c'+i+'-entretien" placeholder="0"></div>'
      + '<div class="field"><label>Repas du mois (€)</label><input type="number" step="0.01" id="cmg-c'+i+'-repas" placeholder="0"></div></div>'
      + '<div class="field"><label>Date de naissance de l\'enfant (facultatif)</label><input type="date" id="cmg-c'+i+'-naiss"></div>'
      + '<div class="result-line"><span class="lbl">Coût horaire (net + indemnités)</span><span class="val" id="out-cmg-c'+i+'-cout">—</span></div>'
      + '<div class="result-line"><span class="lbl">CMG estimé</span><span class="val" id="out-cmg-c'+i+'-cmg">—</span></div>'
      + '<div class="result-line total"><span class="lbl">Reste à payer pour cet enfant</span><span class="val" id="out-cmg-c'+i+'-reste">—</span></div></div>';
  }
  $('cmg-children').innerHTML = h;
  for(let i=1;i<=4;i++) $('cmg-c'+i+'-from').addEventListener('change', e=>cmgFromContract(i, e.target.value));
}
function cmgFillSelects(){
  for(let i=1;i<=4;i++){
    const s = $('cmg-c'+i+'-from'); if(!s) continue;
    s.innerHTML = '<option value="">Remplir depuis…</option>' + STATE.contrats.map(c=>'<option value="'+c.id+'">'+esc(contratLabel(c))+'</option>').join('');
    s.value = '';
  }
}
function cmgFromContract(i, id){
  const c = getContrat(id); if(!c) return;
  const m = val('cmg-mois') || curMonth();
  const dv = derive(c, m);
  setVal('cmg-c'+i+'-heures', round2(dv.hMensu)); setVal('cmg-c'+i+'-taux', round2(dv.tauxEff));
  setVal('cmg-c'+i+'-entretien', round2(dv.ieMois)); setVal('cmg-c'+i+'-repas', round2(dv.repasMois));
  setVal('cmg-c'+i+'-naiss', c.naissance);
  $('cmg-c'+i+'-from').value = '';
  CALC.cmg(); persistTheme('cmg');
  toast('Repris du contrat de '+(c.enfant||'l\'enfant')+'.');
}
VIS.cmg = ()=>{ const n=seg('cmg-nbenfants-gardes')+1; for(let i=1;i<=4;i++) show('cmg-child-'+i, i<=n); };
PREFILL.cmg = ()=>{
  setVal('cmg-mois', curMonth());
  if(STATE.contrats.length){ cmgFromContract(1, STATE.contrats[0].id); }
};
CALC.cmg = ()=>{
  cmgFillSelects();
  const m = val('cmg-mois') || curMonth();
  const chr = R('cmgCHR', m), plafH = R('cmgPlafondH', m), te = R('cmgTauxEffort', m)||[], plancher = R('cmgPlancher', m), plafond = R('cmgPlafond', m);
  const idx = seg('cmg-nbenfants-foyer'), tePct = te[Math.min(idx, te.length-1)] || 0, tx = tePct/100;
  setHTML('cmg-bareme-view', 'Mois de '+fmtMonth(m)+' : coût horaire de référence <b>'+fmtEUR(chr)+'</b> · plafond horaire <b>'+fmtEUR(plafH)+'</b> · ressources retenues entre <b>'+fmtEUR(plancher)+'</b> et <b>'+fmtEUR(plafond)+'</b> par mois · taux d\'effort <b>'+fmtNum(tePct,4)+' %</b>. Valeurs à jour au '+fmtDate(Rdu('cmgCHR', m))+' (modifiables dans Réglages).');
  const mono = seg('cmg-monoparental')===1, ageMax = R(mono?'cmgAgeMaxMono':'cmgAgeMax', m);
  const rs = num('cmg-revenu'), rev = rs ? Math.min(Math.max(rs, plancher), plafond) : 0;
  const n = seg('cmg-nbenfants-gardes')+1;
  let cT=0, cmgT=0, rT=0, any=false; const w=[];
  const md = parseD(m);
  for(let i=1;i<=4;i++){
    const h=num('cmg-c'+i+'-heures'), t=num('cmg-c'+i+'-taux'), ie=num('cmg-c'+i+'-entretien'), rp=num('cmg-c'+i+'-repas');
    if(i>n || !h || !t || !rs){ ['cout','cmg','reste'].forEach(k=>setTxt('out-cmg-c'+i+'-'+k,'—')); continue; }
    any = true;
    const net = toNet(h*t, m), cout = net+ie+rp, ch = cout/h;
    const coutPlaf = h*Math.min(ch, plafH);
    let cmg = Math.max(0, coutPlaf*(1 - rev*tx/chr));
    const nais = parseD(val('cmg-c'+i+'-naiss'));
    if(nais){ const lim = new Date(nais.getFullYear()+ageMax, nais.getMonth(), 1); if(md >= lim){ cmg = 0; w.push('Enfant '+i+' : a '+ageMax+' ans ou plus ce mois-ci, plus de CMG'+(mono?'':' (12 ans pour une famille monoparentale)')+'.'); } }
    if(t < R('salMin', m)-1e-9) w.push('Enfant '+i+' : salaire horaire inférieur au minimum légal ('+fmtEUR(R('salMin',m))+').');
    if(ch > plafH+1e-9) w.push('Enfant '+i+' : le coût horaire ('+fmtEUR(ch)+') dépasse le plafond de '+fmtEUR(plafH)+' : la part au-dessus reste entièrement à la charge des parents.');
    const reste = cout - cmg;
    cT+=cout; cmgT+=cmg; rT+=reste;
    setTxt('out-cmg-c'+i+'-cout', fmtEUR(ch)+' / h'); setTxt('out-cmg-c'+i+'-cmg', fmtEUR(cmg)); setTxt('out-cmg-c'+i+'-reste', fmtEUR(reste));
  }
  if(rs && (rs<plancher || rs>plafond)) w.push('Les ressources saisies sont ramenées à '+fmtEUR(rev)+' ('+(rs<plancher?'plancher':'plafond')+' du barème).');
  setHTML('cmg-warn', w.length ? '<div class="warn-box">'+w.join('<br>')+'</div>' : '');
  setTxt('out-cmg-cout-total', any?fmtEUR(cT):'—');
  setTxt('out-cmg-taux-effort', fmtNum(tePct,4)+' %');
  setTxt('out-cmg-total', any?fmtEUR(cmgT):'—');
  setTxt('out-cmg-reste-total', any?fmtEUR(rT):'—');
};
/* Historique mensuel du CMG */
function cmgRefreshHistorySelect(){
  const h = STATE.cmgHistory||[];
  show('cmg-history-bar', h.length>0);
  $('cmg-history-select').innerHTML = h.map(e=>'<option value="'+e.id+'">'+esc(e.label)+' (archivé le '+new Date(e.savedAt).toLocaleDateString('fr-FR')+')</option>').join('');
}
function cmgArchiveMonth(){
  const f = formCollect('cmg');
  if(!f.i['cmg-revenu'] && !f.i['cmg-c1-heures']){ toast('Rien à archiver : remplissez d\'abord le mois.'); return; }
  const def = fmtMonth(val('cmg-mois')||curMonth());
  askText('Archiver ce mois', 'Nom de ce mois archivé :', def, label=>{
    label = (label||'').trim() || def;
    STATE.cmgHistory.unshift({id:Date.now(), label, savedAt:new Date().toISOString(), form:f});
    while(STATE.cmgHistory.length>36) STATE.cmgHistory.pop();
    saveState(); cmgRefreshHistorySelect(); toast('« '+label+' » archivé.');
  });
}
function cmgLoadHistorySelected(){
  const id = val('cmg-history-select'), e = (STATE.cmgHistory||[]).find(x=>String(x.id)===String(id));
  if(!e) return;
  showConfirmDialog('Reprendre « '+e.label+' » ?', 'Les données de ce mois seront chargées comme point de départ. Vérifiez ensuite les heures et le revenu du mois en cours.', ()=>{
    const f = clone(e.form); f.i['cmg-mois'] = curMonth();
    formApply('cmg', f); VIS.cmg(); CALC.cmg(); persistTheme('cmg'); toast('Mois repris.');
  }, 'Oui, reprendre', 'Annuler');
}
function cmgClearForNewMonth(){
  showConfirmDialog('Nouveau mois', 'Les heures, indemnités, repas et revenu saisis seront effacés. Archivez d\'abord ce mois si vous voulez le retrouver. Continuer ?', ()=>{
    formApply('cmg', {i:{'cmg-mois':curMonth()}, s:{}}); VIS.cmg(); CALC.cmg(); persistTheme('cmg'); toast('Nouveau mois prêt.');
  }, 'Oui, vider', 'Annuler');
}
