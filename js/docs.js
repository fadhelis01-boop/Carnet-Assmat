/* =====================================================================================
   09 · DOCUMENTS PRÉ-REMPLIS (embauche, vie du contrat, fin de contrat)
   Modèles indicatifs établis d'après la CCN IDCC 3239 : à relire, compléter et signer.
   Aucun numéro de sécurité sociale n'est stocké : une ligne est laissée pour l'écrire à la main.
   ===================================================================================== */
'use strict';
let DOCS_ID = null;
const DOCS = [
  {id:'pajemploi', g:'Embauche', t:'Fiche d\'embauche : ce qu\'il faut saisir (CAF, Pajemploi)', d:'Toutes les informations que les parents doivent entrer pour la demande de CMG et sur Pajemploi.'},
  {id:'contrat', g:'Embauche', t:'Contrat de travail (CDI)', d:'Pré-rempli avec le planning, le salaire, les indemnités, les congés, les absences et la rupture.'},
  {id:'autorisations', g:'Embauche', t:'Autorisations et fiche de renseignements', d:'Personnes autorisées, sorties, transport, photos, santé et urgences.'},
  {id:'avenant', g:'Vie du contrat', t:'Avenant au contrat', d:'Changement d\'horaires, de salaire ou d\'indemnités (valeurs actuelles pré-remplies).'},
  {id:'recap', g:'Vie du contrat', t:'Récapitulatif annuel des sommes versées', d:'Mois par mois, d\'après les mois validés (utile pour vérifier les bulletins et l\'attestation fiscale).'},
  {id:'retrait', g:'Fin de contrat', t:'Lettre de retrait de l\'enfant (par les parents)', d:'Avec le préavis calculé.'},
  {id:'demission', g:'Fin de contrat', t:'Lettre de démission (par l\'assistante maternelle)', d:'Avec le préavis calculé.'},
  {id:'certificat', g:'Fin de contrat', t:'Certificat de travail', d:'Obligatoire à la fin du contrat.'},
  {id:'solde', g:'Fin de contrat', t:'Reçu pour solde de tout compte', d:'Détail des sommes repris du calcul « Fin de contrat ».'}
];
function openDocs(id){ DOCS_ID = id || DOCS_ID; showTheme('docs'); }
function renderDocs(){
  if(!DOCS_ID || !getContrat(DOCS_ID)) DOCS_ID = STATE.contrats[0] ? STATE.contrats[0].id : null;
  let h = '<div class="kid-picker"><span class="q">Pour quel enfant ?</span><div class="chips">';
  STATE.contrats.forEach(c=>{ h += '<button type="button" class="chip'+(c.id===DOCS_ID?' on':'')+'" onclick="DOCS_ID=\''+c.id+'\';renderDocs()">'+esc(c.enfant||'Enfant')+(contratTermine(c)?' (terminé)':'')+'</button>'; });
  h += '</div>';
  if(!STATE.contrats.length) h += '<div class="kp-hint">Enregistrez d\'abord un enfant (accueil ▸ « Ajouter un enfant »).</div>';
  h += '</div>';
  const p = STATE.profil||{}, miss = [];
  if(!p.nom) miss.push('votre nom'); if(!p.agrementNum) miss.push('votre numéro d\'agrément'); if(!p.adresse) miss.push('votre adresse');
  if(miss.length) h += '<div class="warn-box">Pour des documents complets, renseignez '+miss.join(', ')+' dans <a href="#" onclick="showTheme(\'reglages\');return false;">Réglages ▸ Mon profil</a>.</div>';
  const c = getContrat(DOCS_ID);
  if(c){
    const m = []; if(!c.parent1) m.push('le nom du parent employeur'); if(!c.adresse) m.push('l\'adresse de la famille');
    if(m.length) h += '<div class="info-box">Pour '+esc(c.enfant)+', il manque '+m.join(' et ')+' : <a href="#" onclick="editContrat(\''+c.id+'\');return false;">compléter le contrat</a> (étape 1, « Coordonnées »). Sinon, des lignes vides seront laissées à remplir à la main.</div>';
  }
  let g = '';
  DOCS.forEach(d=>{
    if(d.g!==g){ g=d.g; h += '<div class="section-label">'+esc(g)+'</div>'; }
    h += '<button class="dlg-choice" '+(c?'':'disabled')+' onclick="printDoc(\''+d.id+'\')"><div class="t">📄 '+esc(d.t)+'</div><div class="d">'+esc(d.d)+'</div></button>';
  });
  h += '<p class="hint" style="margin-top:12px">Chaque document s\'ouvre en aperçu d\'impression : choisissez « Enregistrer au format PDF » pour l\'envoyer, ou imprimez-le pour le signer. Modèles indicatifs établis d\'après la convention collective IDCC 3239 : relisez-les et adaptez-les à votre situation.</p>';
  setHTML('docs-content', h);
}

/* ---------- Aides de mise en page ---------- */
const BL = '______________________________';
function v(x, blank){ return x ? esc(x) : (blank||BL); }
function row(l, val){ return '<tr><td>'+l+'</td><td>'+val+'</td></tr>'; }
function sign(a, b){ return '<table class="sig"><tr><td>'+a+'<br><br>Signature précédée de « lu et approuvé »<br><br><br></td><td>'+b+'<br><br>Signature précédée de « lu et approuvé »<br><br><br></td></tr></table>'; }
function lieuDate(){ return '<p>Fait à '+BL+', le '+today().toLocaleDateString('fr-FR')+', en deux exemplaires originaux.</p>'; }
function employeurs(c){ return [c.parent1, c.parent2].filter(Boolean).map(esc).join(' et ') || BL; }
function assmatNom(){ return v((STATE.profil||{}).nom); }
function planningTable(c){
  const A = wNums(c.wA), B = c.alterne ? wNums(c.wB) : null;
  let h = '<table><tr><td><b>Jour</b></td>'+DOW_SHORT.map(d=>'<td><b>'+d+'</b></td>').join('')+'</tr>';
  h += '<tr><td>'+(B?'Semaine A':'Heures')+'</td>'+A.map(x=>'<td>'+(x?fmtNum(x,2)+' h':'—')+'</td>').join('')+'</tr>';
  if(B) h += '<tr><td>Semaine B</td>'+B.map(x=>'<td>'+(x?fmtNum(x,2)+' h':'—')+'</td>').join('')+'</tr>';
  h += '<tr><td>Horaires (arrivée – départ)</td>'+A.map(x=>'<td>'+(x?'__h__ – __h__':'')+'</td>').join('')+'</tr></table>';
  return h;
}
function docHead(title, c){
  return '<h1>'+esc(title)+'</h1><div class="meta">'+esc(contratLabel(c))+' · document établi le '+today().toLocaleDateString('fr-FR')+' avec Carnet Assmat (réglementation du '+fmtDate(REG.version)+')</div>';
}
function finValues(c){
  // relance le calcul « Fin de contrat » de cet enfant pour en lire les montants
  const prev = CURRENT; STATE.sel.fin = c.id; loadThemeForm('fin');
  const g = id=>($(id)||{}).textContent||'—';
  const vis = id=>{ const e=$(id); return e && e.style.display!=='none'; };
  const out = {salaire:g('out-fin-salaire'), preavis: vis('row-fin-preavis')?g('out-fin-preavis'):null, entretien: vis('row-fin-entretien')?g('out-fin-entretien-r'):null,
    cp: seg('fin-cp')===1?g('out-fin-cp'):null,
    regul: (seg('fin-regul')===1 && vis('fin-regul-results') && g('fin-regul-badge')==='Rappel dû') ? g('out-fin-regul-ecart') : null,
    tropPercu: (seg('fin-regul')===1 && vis('fin-regul-results') && g('fin-regul-badge')==='Trop-perçu') ? g('out-fin-regul-ecart') : null,
    rupture: seg('fin-rupture')===1?g('out-fin-rupture'):null, total:g('out-fin-total'), net:g('out-fin-net'), preavisTxt: $('fin-preavis-info').textContent, notif: val('fin-notif')};
  CURRENT = prev;
  return out;
}

/* ---------- Les documents ---------- */
function printDoc(id){
  const c = getContrat(DOCS_ID); if(!c) return;
  const p = STATE.profil||{}, dv = derive(c, parseD(c.debut)||today()), dvNow = derive(c);
  let h = '';
  if(id==='pajemploi'){
    h = docHead('Fiche d\'embauche — informations à saisir', c)
      + '<h3>1. Avant le début de l\'accueil (parents)</h3><ul>'
      + '<li>Demander le <b>complément de libre choix du mode de garde (CMG)</b> à la CAF ou à la MSA (caf.fr ▸ « Faire une demande de prestation »), au plus tôt. La CAF transmet ensuite à Pajemploi, qui envoie les identifiants.</li>'
      + '<li>Activer le compte <b>Pajemploi</b> (pajemploi.urssaf.fr), donner ses coordonnées bancaires, puis ajouter l\'assistante maternelle et l\'enfant.</li>'
      + '<li>Option : <b>Pajemploi+</b> (Pajemploi verse le salaire à l\'assistante maternelle et prélève les parents, CMG déduit).</li></ul>'
      + '<h3>2. Assistante maternelle</h3><table>'
      + row('Nom et prénom', assmatNom()) + row('Numéro de sécurité sociale', BL+' (à écrire à la main)') + row('Date de naissance', BL)
      + row('Adresse', v(p.adresse)) + row('Téléphone / e-mail', v([p.tel,p.email].filter(Boolean).join(' · ')))
      + row('Numéro d\'agrément', v(p.agrementNum)) + row('Date de l\'agrément / de son renouvellement', v(fmtDate(p.agrementDate))) + row('Nombre d\'enfants autorisés', v(String(STATE.settings.agrement||'')))
      + row('Titre professionnel AM-AP', c.titre?'Oui':'Non') + '</table>'
      + '<h3>3. Employeur et enfant</h3><table>'
      + row('Parent(s) employeur(s)', employeurs(c)) + row('Adresse', v(c.adresse)) + row('Téléphone / e-mail', v([c.tel,c.email].filter(Boolean).join(' · ')))
      + row('Enfant', esc((c.enfant||'')+' '+(c.enfantNom||''))) + row('Date de naissance de l\'enfant', v(fmtDate(c.naissance))) + '</table>'
      + '<h3>4. Éléments du contrat (déclarations mensuelles)</h3><table>'
      + row('Date de début du contrat', v(fmtDate(c.debut))) + row('Type d\'accueil', c.type===1?'Année incomplète : '+(c.semaines||'__')+' semaines programmées':'Année complète (52 semaines)')
      + row('Salaire horaire brut', fmtEUR(dv.tauxEff)) + row('Salaire horaire net (estimation)', fmtEUR(toNet(dv.tauxEff, c.debut||null)))
      + row('Heures normales mensualisées (à déclarer chaque mois)', Math.round(dv.hMensu)+' h ('+fmtNum(dv.hMensu,2)+' h)')
      + row('Jours d\'activité mensualisés (à déclarer chaque mois)', Math.ceil(dv.joursMensu-1e-9)+' j ('+fmtNum(dv.joursMensu,2)+' j)')
      + row('Salaire mensuel brut / net estimé', fmtEUR(dv.brut)+' / '+fmtEUR(dv.net)+(dv.cp12?' (dont 1/12ᵉ de congés payés)':''))
      + row('Indemnité d\'entretien par jour de présence', c.ieMode===1 ? fmtEUR(Math.max(parseFloat(c.ieMontant)||0, dv.ieJour))+' (montant fixe)' : 'minimum légal, soit '+fmtEUR(dv.ieJour)+' en moyenne')
      + row('Repas', c.repasMode===1 ? fmtEUR(parseFloat(c.repasPrix)||0)+' par jour' : c.repasMode===0 ? 'fournis par les parents' : 'aucun')
      + row('Date de paiement du salaire', c.paiementJour ? 'le '+esc(c.paiementJour)+' du mois suivant' : BL) + '</table>'
      + '<p class="legal-p">Depuis janvier 2026, Pajemploi demande une déclaration par enfant, chaque mois entre le 25 et le 5 du mois suivant. Le thème « Salaire du mois & Pajemploi » du carnet donne chaque mois les chiffres exacts à recopier.</p>';
  }
  else if(id==='contrat'){
    const fe = finEssai(c), essaiMois = Math.max(dv.jA,dv.jB) >= 4 ? (R('essai')||[3,2])[1] : (R('essai')||[3,2])[0];
    const cpMode = ['par 12ᵉ chaque mois (10 % du salaire brut)','en une seule fois en juin','lors de la prise principale des congés'][c.cpMode];
    h = docHead('Contrat de travail à durée indéterminée — assistant(e) maternel(le) agréé(e)', c)
      + '<p>Contrat régi par la convention collective nationale des particuliers employeurs et de l\'emploi à domicile (IDCC 3239 : socle commun et socle spécifique assistant maternel), le Code de l\'action sociale et des familles et les dispositions du Code du travail applicables aux assistants maternels.</p>'
      + '<h3>Article 1 — Les parties</h3><table>'
      + row('Employeur(s)', employeurs(c)) + row('Adresse', v(c.adresse)) + row('Téléphone / e-mail', v([c.tel,c.email].filter(Boolean).join(' · ')))
      + row('Salariée', assmatNom()) + row('Adresse', v(p.adresse)) + row('N° de sécurité sociale', BL)
      + row('Agrément', 'n° '+v(p.agrementNum)+' délivré le '+v(fmtDate(p.agrementDate))+' pour '+v(String(STATE.settings.agrement||''))+' enfant(s)')
      + row('Assurance responsabilité civile professionnelle', v(p.assurance)) + (p.assuranceAuto?row('Assurance du véhicule (transport d\'enfants)', esc(p.assuranceAuto)):'') + '</table>'
      + '<h3>Article 2 — L\'enfant accueilli</h3><table>' + row('Prénom et nom', esc((c.enfant||'')+' '+(c.enfantNom||''))) + row('Date de naissance', v(fmtDate(c.naissance))) + '</table>'
      + '<h3>Article 3 — Date d\'effet, période d\'essai et adaptation</h3>'
      + '<p>Le contrat prend effet le <b>'+v(fmtDate(c.debut))+'</b>. La période d\'essai est de <b>'+essaiMois+' mois</b>'+(fe?' (jusqu\'au '+fe.toLocaleDateString('fr-FR')+' au plus tard)':'')+' ; chacune des parties peut y mettre fin sans préavis ni indemnité. '
      + 'Période d\'adaptation (comprise dans l\'essai, 30 jours calendaires au plus) : '+v(c.adaptation)+'. Le salaire est mensualisé dès le premier jour ; les heures non effectuées pendant l\'adaptation sont déduites selon la méthode de la Cour de cassation.</p>'
      + '<h3>Article 4 — Durée et organisation de l\'accueil</h3>'
      + '<p>'+(c.type===1 ? 'Accueil en <b>année incomplète</b> : <b>'+(c.semaines||'__')+' semaines</b> d\'accueil programmées par an (hors congés payés), listées en annexe.' : 'Accueil en <b>année complète</b> : 52 semaines par an, congés payés de la salariée compris.')
      + ' Durée hebdomadaire moyenne : <b>'+fmtNum(dv.moyH,2)+' h</b> sur <b>'+fmtNum(dv.moyJ,1)+' jours</b>.</p>' + planningTable(c)
      + '<p>Toute modification durable du planning ou du salaire fait l\'objet d\'un avenant écrit et signé.</p>'
      + '<h3>Article 5 — Rémunération</h3><table>'
      + row('Salaire horaire brut', fmtEUR(dv.tauxEff)+' (net estimé '+fmtEUR(toNet(dv.tauxEff, c.debut||null))+')')
      + row('Heures mensualisées', fmtNum(dv.hMensu,2)+' h = '+fmtNum(dv.moyH,2)+' h × '+dv.semaines+' semaines ÷ 12')
      + row('Salaire mensuel brut', fmtEUR(dv.brutBase)+(dv.cp12?' + congés payés 1/12ᵉ : '+fmtEUR(dv.cp12):''))
      + row('Heures au-delà de 45 h par semaine', 'majorées de '+dv.majPct+' %') + row('Heures complémentaires (jusqu\'à 45 h)', 'payées au salaire horaire normal')
      + row('Date de paiement', c.paiementJour ? 'le '+esc(c.paiementJour)+' de chaque mois, pour le mois écoulé' : BL) + row('Déclaration', 'par l\'employeur sur Pajemploi, chaque mois') + '</table>'
      + '<p>Le salaire horaire ne peut être inférieur au minimum conventionnel en vigueur ; en cas de revalorisation de ce minimum, il est relevé d\'office.</p>'
      + '<h3>Article 6 — Indemnités et frais</h3><table>'
      + row('Indemnité d\'entretien', c.ieMode===1 ? fmtEUR(parseFloat(c.ieMontant)||0)+' par jour de présence (jamais inférieure au minimum légal)' : 'minimum légal par jour de présence, calculé selon la durée d\'accueil (90 % du minimum garanti pour 9 h, 2,65 € au moins)')
      + row('Repas et goûters', c.repasMode===1 ? fournisPar('assmat', c) : c.repasMode===0 ? 'fournis par les parents' : 'sans objet')
      + row('Indemnités kilométriques', (parseFloat(c.km)||0) ? fmtEUR(parseFloat(c.km))+' par mois en moyenne, selon les déplacements autorisés' : 'selon les déplacements autorisés par écrit, au barème convenu : '+BL) + '</table>'
      + '<h3>Article 7 — Congés payés</h3>'
      + '<p>La salariée acquiert 2,5 jours ouvrables par mois d\'accueil (30 jours au plus) du 1er juin au 31 mai. Les dates sont fixées d\'un commun accord au plus tard le 1er mars ; à défaut d\'accord pour une salariée ayant plusieurs employeurs, elle fixe elle-même 4 semaines en été et 1 semaine en hiver. '
      + (c.type===1 ? 'En année incomplète, l\'indemnité de congés payés (la plus favorable entre 10 % des salaires et le maintien de salaire) est versée en plus du salaire mensualisé, <b>'+cpMode+'</b>.' : 'En année complète, les congés sont compris dans le salaire mensualisé ; en fin de période de référence, la différence éventuelle en faveur de la règle des 10 % est versée.')+'</p>'
      + '<h3>Article 8 — Jours fériés</h3><p>Le 1er mai est chômé et payé (s\'il est travaillé : majoration de 100 %). Les autres jours fériés sont : ☐ chômés et payés (dès le début du contrat, si les jours d\'accueil prévus avant et après sont travaillés) ☐ travaillés, avec une majoration de 10 %. Jours fériés travaillés convenus : '+BL+'</p>'
      + '<h3>Article 9 — Absences</h3><p>Absence de l\'enfant : le salaire est maintenu, sauf maladie justifiée par un certificat médical remis dans les 48 heures, dans la limite de 5 jours par période de 12 mois à compter de la date d\'effet du contrat ; une hospitalisation ou une maladie d\'au moins 14 jours consécutifs ne sont pas rémunérées. Absences de la salariée non rémunérées (maladie, congé sans solde…) : déduites selon la méthode de la Cour de cassation. Les congés pour événements familiaux prévus par la loi sont rémunérés.</p>'
      + '<h3>Article 10 — Rupture du contrat</h3><p>Hors période d\'essai, préavis : 8 jours calendaires si l\'ancienneté est inférieure à 3 mois, 15 jours de 3 mois à moins d\'un an, un mois au-delà. Le retrait de l\'enfant par l\'employeur est notifié par lettre recommandée avec accusé de réception ou remise en main propre contre décharge ; après 9 mois d\'ancienneté, il ouvre droit à une indemnité de rupture égale à 1/80ᵉ du total des salaires bruts perçus pendant le contrat (sauf faute grave ou lourde). La suspension ou le retrait d\'agrément entraîne la rupture sans préavis ni indemnité. En fin de contrat, l\'employeur remet le certificat de travail, l\'attestation France Travail et le reçu pour solde de tout compte ; en année incomplète, une régularisation du salaire est calculée.</p>'
      + '<h3>Article 11 — Dispositions diverses</h3><p>Les parents fournissent le carnet de santé (vaccinations), les autorisations écrites (personnes habilitées à reprendre l\'enfant, sorties, transport, photos) et signalent tout changement de situation. La salariée respecte la confidentialité des informations concernant la famille. Pour tout ce qui n\'est pas prévu ici, la convention collective IDCC 3239 s\'applique. Clauses particulières : '+BL+BL+'</p>'
      + lieuDate() + sign('L\'employeur', 'La salariée')
      + (c.type===1 ? '<h3>Annexe — Semaines d\'accueil programmées (année incomplète)</h3><p>Semaines où l\'enfant est accueilli (n° de semaine ou dates) : '+BL+BL+BL+'</p><p>Semaines sans accueil (hors congés payés de la salariée) : '+BL+BL+'</p>' : '')
      + '<p class="legal-p">Modèle indicatif établi d\'après la convention collective IDCC 3239 en vigueur au '+fmtDate(REG.version)+'. Relisez-le et adaptez-le ; en cas de doute, rapprochez-vous de votre relais petite enfance (RPE).</p>';
  }
  else if(id==='autorisations'){
    h = docHead('Autorisations parentales et fiche de renseignements', c)
      + '<h3>Personnes autorisées à reprendre l\'enfant</h3><table>'+[1,2,3].map(i=>row('Nom, lien, téléphone', BL+BL)).join('')+'</table><p>Une pièce d\'identité pourra être demandée.</p>'
      + '<h3>Autorisations</h3><p>☐ Sorties à pied (parc, médiathèque, relais petite enfance…)<br>☐ Transport en voiture par l\'assistante maternelle (siège adapté, assurance du véhicule déclarée)<br>☐ Photos et vidéos à usage privé (aucune diffusion sur internet)<br>☐ Administration d\'un médicament sur ordonnance (joindre l\'ordonnance)<br>☐ Soins d\'urgence et transport vers un établissement de santé</p>'
      + '<h3>Santé et urgences</h3><table>'+row('Médecin traitant (nom, téléphone)', BL)+row('Allergies, régime, PAI', BL)+row('Vaccinations à jour (carnet de santé vu le)', BL)+row('Personnes à prévenir en urgence', BL+BL)+'</table>'
      + lieuDate() + sign('Le(s) parent(s)', 'L\'assistante maternelle');
  }
  else if(id==='avenant'){
    h = docHead('Avenant au contrat de travail', c)
      + '<p>Entre '+employeurs(c)+', employeur(s), et '+assmatNom()+', assistante maternelle agréée, au titre de l\'accueil de '+esc(c.enfant||'')+', contrat du '+v(fmtDate(c.debut))+'.</p>'
      + '<p>À compter du '+BL+', les éléments suivants sont modifiés :</p><table>'
      + '<tr><td><b>Élément</b></td><td><b>Avant</b></td><td><b>Après</b></td></tr>'
      + '<tr><td>Salaire horaire brut</td><td>'+fmtEUR(dvNow.tauxEff)+'</td><td>'+BL+'</td></tr>'
      + '<tr><td>Heures par semaine (moyenne) / jours</td><td>'+fmtNum(dvNow.moyH,2)+' h / '+fmtNum(dvNow.moyJ,1)+' j</td><td>'+BL+'</td></tr>'
      + '<tr><td>Semaines d\'accueil par an</td><td>'+dvNow.semaines+'</td><td>'+BL+'</td></tr>'
      + '<tr><td>Heures mensualisées</td><td>'+fmtNum(dvNow.hMensu,2)+' h</td><td>'+BL+'</td></tr>'
      + '<tr><td>Salaire mensuel brut</td><td>'+fmtEUR(dvNow.brut)+'</td><td>'+BL+'</td></tr>'
      + '<tr><td>Indemnité d\'entretien</td><td>'+(c.ieMode===1?fmtEUR(parseFloat(c.ieMontant)||0)+'/jour':'minimum légal')+'</td><td>'+BL+'</td></tr>'
      + '<tr><td>Planning (jours et horaires)</td><td>voir contrat</td><td>'+BL+'</td></tr></table>'
      + '<p>Les autres clauses du contrat restent inchangées. Pensez à mettre à jour l\'enfant dans le carnet (✎ Modifier) à la date d\'effet. En année incomplète, la régularisation de fin de contrat se calcule par période, avant et après chaque avenant.</p>'
      + lieuDate() + sign('L\'employeur', 'La salariée');
  }
  else if(id==='recap'){
    const y = String(today().getFullYear()), J = journalOf(c.id);
    const years = [...new Set(Object.keys(J).map(m=>m.slice(0,4)))].sort().reverse();
    h = docHead('Récapitulatif des sommes versées', c);
    if(!years.length) h += '<p>Aucun mois validé pour cet enfant. Validez chaque mois dans « Salaire du mois & Pajemploi ».</p>';
    years.forEach(yr=>{
      const t = journalTotals(c.id, yr+'-01', yr+'-12');
      h += '<h3>Année '+yr+'</h3><table><tr><td><b>Mois</b></td><td><b>Brut</b></td><td><b>Net</b></td><td><b>Net imposable</b></td><td><b>Entretien</b></td><td><b>Repas + km</b></td></tr>'
        + t.mois.map(m=>{ const r=J[m]; return '<tr><td>'+fmtMonth(m)+'</td><td>'+fmtEUR(r.brut)+'</td><td>'+fmtEUR(r.net)+'</td><td>'+fmtEUR(r.netImp)+'</td><td>'+fmtEUR(r.ie)+'</td><td>'+fmtEUR((r.repas||0)+(r.km||0))+'</td></tr>'; }).join('')
        + '<tr class="tot"><td>Total</td><td>'+fmtEUR(t.brut)+'</td><td>'+fmtEUR(t.net)+'</td><td>'+fmtEUR(t.netImp)+'</td><td>'+fmtEUR(t.ie)+'</td><td>'+fmtEUR(t.repas+t.km)+'</td></tr></table>';
    });
    h += '<p class="legal-p">Montants enregistrés dans le carnet (estimations pour le net et le net imposable). Les montants officiels sont ceux des bulletins et de l\'attestation fiscale Pajemploi.</p>';
  }
  else if(id==='retrait' || id==='demission'){
    const f = finValues(c);
    const parParents = id==='retrait';
    const qui = (STATE.forms.fin && STATE.forms.fin[c.id] && STATE.forms.fin[c.id].s['fin-qui']) || 0;
    h = docHead(parParents ? 'Lettre de retrait de l\'enfant' : 'Lettre de démission', c)
      + '<p>'+(parParents ? employeurs(c)+'<br>'+v(c.adresse) : assmatNom()+'<br>'+v(p.adresse))+'</p>'
      + '<p style="text-align:right">'+(parParents ? 'À '+assmatNom()+'<br>'+v(p.adresse) : 'À '+employeurs(c)+'<br>'+v(c.adresse))+'</p>'
      + '<p>Lettre recommandée avec accusé de réception, ou remise en main propre contre décharge.</p>'
      + '<p>Objet : '+(parParents ? 'retrait de l\'enfant '+esc(c.enfant||'') : 'démission')+'</p>'
      + (parParents
        ? '<p>Madame,</p><p>Nous vous informons de notre décision de retirer notre enfant '+esc(c.enfant||'')+', accueilli(e) chez vous depuis le '+v(fmtDate(c.debut))+', et de mettre ainsi fin à votre contrat de travail.</p>'
        : '<p>Madame, Monsieur,</p><p>Je vous informe de ma décision de '+(qui===7?'partir à la retraite et de mettre fin à':'démissionner de')+' mon poste d\'assistante maternelle pour l\'accueil de votre enfant '+esc(c.enfant||'')+', que j\'accueille depuis le '+v(fmtDate(c.debut))+'.</p>')
      + '<p>'+esc(f.preavisTxt)+'</p><p>Le préavis commence à la date de première présentation de cette lettre. '+(parParents?'Les documents de fin de contrat (certificat de travail, attestation France Travail, reçu pour solde de tout compte) vous seront remis à son terme, avec les sommes dues.':'Je vous remercie de me remettre, à la fin du préavis, le certificat de travail, l\'attestation France Travail et le reçu pour solde de tout compte.')+'</p>'
      + '<p>'+(parParents?'Nous vous prions d\'agréer, Madame, nos salutations distinguées.':'Je vous prie d\'agréer, Madame, Monsieur, mes salutations distinguées.')+'</p>'
      + '<p>Le '+(f.notif?fmtDate(f.notif):today().toLocaleDateString('fr-FR'))+'</p><p>Signature : <br><br><br></p>';
  }
  else if(id==='certificat'){
    h = docHead('Certificat de travail', c)
      + '<p>Je soussigné(e) '+employeurs(c)+', demeurant '+v(c.adresse)+', particulier employeur, certifie avoir employé :</p><table>'
      + row('Salariée', assmatNom()) + row('Adresse', v(p.adresse)) + row('Emploi occupé', 'Assistante maternelle agréée (agrément n° '+v(p.agrementNum)+')')
      + row('Du', v(fmtDate(c.debut))) + row('Au', v(fmtDate(c.fin))+' (fin du préavis, effectué ou non)') + '</table>'
      + '<p>Convention collective applicable : particuliers employeurs et emploi à domicile (IDCC 3239).</p>'
      + '<p>Mme '+assmatNom()+' nous quitte libre de tout engagement.</p>'
      + '<p>Portabilité de la prévoyance : la salariée peut bénéficier du maintien des garanties de prévoyance (IRCEM) dans les conditions prévues par la loi ; elle est invitée à se rapprocher de l\'IRCEM.</p>'
      + '<p>Fait à '+BL+', le '+today().toLocaleDateString('fr-FR')+', pour servir et valoir ce que de droit.</p><p>Signature de l\'employeur :<br><br><br></p>';
  }
  else if(id==='solde'){
    const f = finValues(c);
    h = docHead('Reçu pour solde de tout compte', c)
      + '<p>Je soussignée '+assmatNom()+', assistante maternelle, reconnais avoir reçu de '+employeurs(c)+', pour solde de tout compte, les sommes suivantes au titre de mon contrat de travail du '+v(fmtDate(c.debut))+' au '+v(fmtDate(c.fin))+' :</p><table>'
      + row('Salaire du dernier mois (brut)', esc(f.salaire))
      + (f.preavis?row('Indemnité compensatrice de préavis (brut)', esc(f.preavis)):'')
      + (f.cp?row('Indemnité compensatrice de congés payés (brut)', esc(f.cp)):'')
      + (f.regul?row('Rappel de salaire (régularisation)', esc(f.regul)):'')
      + (f.entretien?row('Indemnités d\'entretien', esc(f.entretien)):'')
      + (f.rupture?row('Indemnité de rupture', esc(f.rupture)):'')
      + '<tr class="tot"><td>Total (brut, frais et indemnité de rupture compris)</td><td>'+esc(f.total)+'</td></tr>'
      + row('Montant net estimé versé', esc(f.net)) + row('Mode de paiement', BL) + '</table>'
      + (f.tropPercu ? '<p>Note : la régularisation fait apparaître un trop-perçu de '+esc(f.tropPercu)+'. Il n\'est pas retenu sur les sommes ci-dessus ; il ne peut être récupéré qu\'avec l\'accord écrit de la salariée ou sur décision de justice.</p>' : '')
      + '<p>Ce reçu, établi en deux exemplaires, peut être dénoncé dans les six mois qui suivent sa signature, après quoi il devient libératoire pour les sommes qui y sont mentionnées.</p>'
      + '<p>Fait à '+BL+', le '+today().toLocaleDateString('fr-FR')+'.</p>' + sign('L\'employeur', 'La salariée (mention « pour solde de tout compte »)')
      + '<p class="legal-p">Montants repris du calcul « Fin de contrat » du carnet : vérifiez-les avec la dernière déclaration Pajemploi.</p>';
  }
  doPrint('<div class="doc">'+h+'</div>');
}
function fournisPar(qui, c){ return fmtEUR(parseFloat(c.repasPrix)||0)+' par jour de présence, repas fournis par l\'assistante maternelle'; }
