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
