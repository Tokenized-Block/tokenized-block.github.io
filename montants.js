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
