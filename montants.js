// montants.js — afficher un montant en wei sans mentir sur ce qu il coute.
// ================================================================================================
// ⛔ POURQUOI CE MODULE EXISTE. La page affiche desormais le cout de la creation AVANT que le
//    wallet s ouvre — elle promettait « what you pay is the network's gas » sans jamais montrer
//    de chiffre. Mais la conversion wei -> ETH se fait a la main sur des BigInt (division,
//    modulo, remplissage a 18 chiffres) : c est exactement le genre d endroit ou vit un
//    decalage d un rang, et tant que ce code vivait dans une balise <script> inline il n etait
//    verifiable qu a l oeil.
//
// ⛔ LA DECISION QUI COMPTE : ON ARRONDIT VERS LE HAUT.
//    Un cout tronque vers le bas affiche MOINS que ce qui sera preleve. Sur un montant de
//    0,0000018 ETH la difference est invisible ; le principe, lui, ne l est pas — une interface
//    qui arrondit systematiquement en sa faveur ment systematiquement dans le meme sens.
//    Un montant affiche ne doit JAMAIS etre inferieur au montant reel. Le plafond est donc la
//    seule direction defendable pour un COUT, et c est l inverse pour un SOLDE.
//
// ⚠️ Aucune conversion en devise. Il n y a pas d oracle de prix ici, et inventer un taux serait
//    un chiffre non mesure dans une interface qui promet le contraire.

const UN_ETH = 10n ** 18n;

/**
 * Formate un montant en wei vers une chaine en ETH, avec au plus `decimales` chiffres.
 *
 * ⛔ ARRONDI VERS LE HAUT (plafond) : voir l en-tete. Le montant rendu est toujours >= au reel.
 * ⛔ Rend une CHAINE, jamais un nombre : un `Number` perd de la precision des 2^53 wei, soit
 *    0,009 ETH — bien en dessous des montants qu on affiche.
 *
 * @param {bigint|string|number} wei  montant, en wei
 * @param {number} decimales          chiffres apres la virgule, 0 a 18
 */
export function formaterEth(wei, decimales = 9) {
  const w = BigInt(wei);
  if (w < 0n) throw new Error('montant negatif');
  if (!Number.isInteger(decimales) || decimales < 0 || decimales > 18) {
    throw new Error('decimales hors [0, 18]');
  }
  /* On travaille sur une unite reduite, puis on remonte au plafond.
   * ⚠️ `pas` est la valeur d un chiffre affiche : arrondir au plafond revient a compter les
   *    `pas` entiers, plus un si le reste n est pas nul. */
  const pas = 10n ** BigInt(18 - decimales);
  const unites = w / pas + (w % pas === 0n ? 0n : 1n);
  const ent = unites / 10n ** BigInt(decimales);
  if (decimales === 0) return ent.toString();
  const frac = (unites % 10n ** BigInt(decimales)).toString().padStart(decimales, '0');
  /* ⛔ On retire les zeros de FIN, mais on garde au moins un chiffre : « 1. » n est pas un nombre,
   * et « 1 » ferait croire a une valeur exacte alors qu elle peut etre arrondie. */
  const net = frac.replace(/0+$/, '') || '0';
  return ent.toString() + '.' + net;
}

/**
 * Vrai si l affichage a du arrondir — donc si le montant reel est STRICTEMENT inferieur.
 * ⛔ Existe pour que l appelant puisse ecrire « ≈ » plutot que « = ». Afficher un montant arrondi
 *    avec un signe d egalite est un petit mensonge, et il est evitable.
 */
export function estArrondi(wei, decimales = 9) {
  const w = BigInt(wei);
  return w % 10n ** BigInt(18 - decimales) !== 0n;
}

/** Separateurs de milliers pour une quantite de gas. Purement lisible, aucune perte. */
export function formaterGas(gaz) {
  return BigInt(gaz).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Lit un ENTIER tape par un humain — et REFUSE plutot que de transformer.
 * ================================================================================================
 * ⛔⛔ CE QUE FAISAIT L ANCIEN NETTOYEUR, ET CE QUE CA COUTAIT. Cinq champs de la page passaient
 *    par `.replace(/\D/g, '')`, qui SUPPRIME tout ce qui n est pas un chiffre au lieu de refuser.
 *    Mesure du 2026-09-04, dans la page en cours :
 *        « 0.001 » -> 1        (1000 fois trop)
 *        « 1.5 »   -> 15       (10 fois trop)
 *        « 1e6 »   -> 16       (62 500 fois trop)
 *        « -5 »    -> 5        (le signe disparait)
 *        « abc »   -> 0
 *    Quatre de ces champs decident d ARGENT ou d IRREVERSIBLE : le prix initial de la pool (grave
 *    a l etape 1 et jamais rejouable), la supply du jeton a sa creation, le depot de liquidite,
 *    le montant d un swap. Taper « 1.5 » ouvrait donc une pool a un prix 10 fois faux, en
 *    silence, sans un mot a l ecran. Une saisie mal lue est pire qu une saisie refusee : l une
 *    coute un clic, l autre coute la pool.
 *
 * ⛔ ON N ACCEPTE QUE DES CHIFFRES, ET LES ESPACES DE GROUPEMENT. Pas la virgule, pas le point :
 *    « 10.000 » vaut dix mille pour un francophone et dix pour un anglophone. Un separateur
 *    ambigu ne se DEVINE pas — le deviner, c est choisir a la place de l utilisateur sur un
 *    chiffre qui va etre grave.
 *
 * ⚠️ TROIS ETATS, JAMAIS DEUX : une valeur, « rien de tape », ou « ce n est pas un entier » — ce
 *    dernier PORTANT ce qui a ete tape, pour que le message puisse le montrer.
 */
/**
 * Lit les DECIMALES d un jeton — bornees, et sans jamais rogner en silence.
 * ================================================================================================
 * ⛔ TROIS DEFAUTS MESURES LE 2026-09-04 sur `Math.min(18, Math.max(6, parseInt(v, 10)))` :
 *      « 1e1 » -> parseInt rend 1, borne a 6.  L utilisateur voulait 10 : il obtient 6.
 *      « 8.9 » -> 8, tronque sans un mot.
 *      « -3 » -> 6 et « 99 » -> 18, rognes sans un mot.
 *    Les decimales sont GRAVEES a la creation : elles decident de ce que « 1 jeton » veut dire,
 *    pour toujours. Une valeur rognee en silence est une valeur choisie a la place de l utilisateur.
 *
 * ⛔ ET LA PROTECTION CONTRE NaN ETAIT ACCIDENTELLE. `parseInt('abc')` rend NaN, et NaN TRAVERSE
 *    `Math.max` comme `Math.min` — les deux bornes le laissent passer — apres quoi `BigInt(NaN)`
 *    LEVE. Si ca ne cassait pas, c est seulement parce que le champ est `type="number"` : le
 *    navigateur y rend `''` pour une saisie non numerique, et le repli `|| '18'` sauvait la mise.
 *    Une garde qui ne tient qu a un attribut HTML n est pas une garde ; passer le champ en
 *    `type="text"` la supprimerait sans que rien ne le signale. Ici, NaN est refuse explicitement.
 *
 * ⚠️ QUATRE ETATS. OK / VIDE / REFUSE (pas un entier) / BORNE (entier valide, hors des limites) —
 *    ce dernier rend la valeur bornee ET dit ce qui a ete tape, pour que l ecran puisse l avouer
 *    au lieu de faire comme si l utilisateur l avait voulue.
 */
export function decimalesStrictes(texte, min = 6, max = 18) {
  const t = String(texte ?? '').trim();
  if (t === '') return { etat: 'VIDE' };
  /* ⛔ On exige la forme d un entier decimal AVANT toute conversion. `parseInt` lit « 1e1 » comme
   * 1 et « 8.9 » comme 8 : il s arrete au premier caractere qu il ne comprend pas au lieu de
   * refuser. Ce qu il jette, il ne le signale pas. */
  if (!/^-?\d+$/.test(t)) {
    return { etat: 'REFUSE', tape: t,
      pourquoi: 'Decimals must be a whole number — "' + t + '" is not one'
        + (/^-?\d*\.\d+$|e/i.test(t) ? ' (values like "1e1" or "8.9" get silently cut).' : '.') };
  }
  const n = Number(t);
  /* ⛔ Ceinture ET bretelles : si une entree passait le motif tout en donnant NaN, on refuse
   * plutot que de laisser NaN franchir les bornes. Un NaN qui atteint `BigInt` leve. */
  if (!Number.isInteger(n)) return { etat: 'REFUSE', tape: t, pourquoi: 'Not a whole number.' };
  if (n < min || n > max) {
    return { etat: 'BORNE', tape: t, valeur: n < min ? min : max, min, max,
      pourquoi: 'Decimals must be between ' + min + ' and ' + max + '.' };
  }
  return { etat: 'OK', valeur: n };
}

/**
 * Lit un montant tape EN JETONS ENTIERS (« 0,17 ») et rend des unites brutes.
 * ================================================================================================
 * ⛔ POURQUOI. Tous les champs de montant de l app se lisaient en unites BRUTES. Pour vendre
 *    l equivalent de 0,50 $ il fallait taper `200436811106540992`. Personne ne tape ca, et
 *    surtout personne ne le RELIT : un zero de trop passe inapercu et vend mille fois plus.
 *
 * ⛔ DEUX CHAMPS, DEUX REGLES, ET C EST VOULU. `entierStrict` REFUSE les decimales parce qu un
 *    champ en unites brutes n en a pas — « 1.5 unite » n existe pas. Ce champ-ci se compte en
 *    jetons, donc « 1,5 » y est une saisie normale. Une seule fonction pour les deux accepterait
 *    l ambigu d un cote ou refuserait le legitime de l autre.
 *
 * ⛔ AUCUN PASSAGE PAR `Number`. `1.005 * 1e18` ne rend PAS 1005000000000000000 — le flottant se
 *    trompe, et un jeton a 18 decimales perd des chiffres bien avant. Tout se fait sur les
 *    CHAINES, puis en BigInt.
 *
 * ⚠️ LA VIRGULE EST ACCEPTEE. Refuser « 0,5 » ferait echouer la moitie des gens sur leur propre
 *    clavier. Aucune ambiguite ici, contrairement au champ de prix : un separateur de MILLIERS
 *    n a pas sa place dans un montant a decimales, donc « , » et « . » designent la meme chose.
 *
 * ⚠️ TROP DE DECIMALES : REFUSE, jamais tronque. Tronquer ferait accepter une saisie et en
 *    executer une autre — le defaut exact du nettoyeur `\D` qui lisait « 1.5 » comme 15.
 */
export function montantHumain(texte, decimales) {
  const t = String(texte ?? '').trim().replace(',', '.');
  if (t === '') return { etat: 'VIDE' };
  if (!/^\d+(\.\d+)?$/.test(t)) {
    return { etat: 'REFUSE', tape: String(texte),
      pourquoi: '"' + texte + '" is not an amount. Digits and one decimal point only.' };
  }
  const [ent, frac = ''] = t.split('.');
  if (frac.length > decimales) {
    return { etat: 'REFUSE', tape: String(texte),
      pourquoi: 'This token has ' + decimales + ' decimals — "' + texte + '" has '
        + frac.length + '. Nothing was rounded: fix the amount.' };
  }
  return { etat: 'OK', valeur: BigInt(ent + frac.padEnd(decimales, '0')) };
}

/**
 * L inverse : des unites brutes vers un texte lisible et RETAPABLE.
 * ⛔ L ALLER-RETOUR DOIT ETRE EXACT. Si l affichage rend un nombre que retaper ne redonne pas,
 *    l utilisateur ne peut pas verifier ce qu il fait — et c est teste dans les deux sens.
 * ⚠️ On retire les zeros de FIN pour la lisibilite, jamais un chiffre significatif.
 */
export function formaterUnites(brut, decimales) {
  const s = BigInt(brut).toString().padStart(decimales + 1, '0');
  const ent = s.slice(0, s.length - decimales);
  const frac = s.slice(s.length - decimales).replace(/0+$/, '');
  return frac === '' ? ent : ent + '.' + frac;
}

export function entierStrict(texte) {
  const t = String(texte ?? '').trim();
  if (t === '') return { etat: 'VIDE' };
  const sansEspaces = t.replace(/[\s _]/g, '');
  if (!/^\d+$/.test(sansEspaces)) {
    return { etat: 'REFUSE', tape: t,
      pourquoi: /[.,]/.test(t)
        /* ⛔ Le cas le plus dangereux merite son propre message : c est celui qui a l air de
         * marcher. On dit ce que ca VAUDRAIT si on l acceptait, pour que l ecart se voie. */
        ? 'Whole numbers only — "' + t + '" has a decimal separator, and its meaning depends on '
          + 'your locale. Type the amount in raw units instead.'
        : 'Whole numbers only — "' + t + '" is not a whole number.' };
  }
  return { etat: 'OK', valeur: BigInt(sansEspaces) };
}
