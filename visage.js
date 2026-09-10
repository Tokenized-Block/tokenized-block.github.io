// visage.js — le visage d un block : une tete de chat taillee dans un cube, propre a son adresse.
// ================================================================================================
// ⛔ L IDENTITE VIENT DE L ADRESSE, ET DE RIEN D AUTRE. Le meme block doit produire EXACTEMENT le
//    meme visage a chaque chargement, sur chaque ecran, pour toujours. Un dessin qui dependrait de
//    l heure, du hasard ou du prix ferait de deux affichages du meme block deux objets differents —
//    et un compagnon qu on ne reconnait pas d un jour a l autre n est pas un compagnon.
//
// ⛔⛔ ET IL NE BOUGE JAMAIS AVEC LE MARCHE. C est la regle qui tient toute la map : ce qui grandit
//    quand un block prend de la vie, c est la PLACE qu il occupe, jamais son visage. Si la couleur
//    changeait avec le prix, un block riche et un block pauvre cesseraient d etre le meme objet, et
//    personne ne pourrait suivre le sien.
//
// ⚠️ CE QUE CE MODULE NE FAIT PAS : il ne lit pas la chaine, ne juge rien, et ne dit rien de la
//    valeur d un block. Deux blocks au visage proche ne sont PAS lies — la teinte vient de quelques
//    octets d adresse, et des collisions existent. Un visage n est pas une preuve d identite ; le
//    seul identifiant reste l adresse complete.

/** Les octets d une adresse, en nombres. ⛔ On lit l adresse TELLE QU ELLE EST — jamais un prefixe
 *  seul : deux blocks du meme lanceur partagent leurs premiers octets et auraient le meme visage. */
function octets(adr) {
  const h = String(adr || '').replace(/^0x/i, '').toLowerCase();
  const o = [];
  for (let i = 0; i + 1 < h.length; i += 2) o.push(parseInt(h.slice(i, i + 2), 16) || 0);
  return o.length ? o : [0];
}

/**
 * Un entier stable tire de l adresse, entre 0 et `max - 1`.
 *
 * ⛔⛔ ON BRASSE L ADRESSE ENTIERE, ET C EST UN CORRECTIF. La premiere version lisait QUATRE octets
 *    consecutifs a une position fixe — or tous les blocks B20 commencent par `b2 00 00 00`. La
 *    teinte se calculait donc sur des octets identiques pour tout le monde : mesure a l ecran le
 *    2026-09-10, les VINGT-SIX visages de la map avaient la meme teinte 38. Vingt-six compagnons
 *    impossibles a distinguer, sur une map dont c est le seul interet.
 * ⚠️ Et le test cense l empecher passait, parce qu il comparait une empreinte COMPOSITE dont
 *    d autres composantes variaient. Un test vert a cote de sa cible.
 * ⇒ Chaque octet compte, et `position` sert de SEL — deux traits differents d une meme adresse ne
 *   doivent pas retomber sur la meme valeur.
 */
function tire(o, position, max) {
  let n = 2166136261 ^ (position * 16777619);
  for (let i = 0; i < o.length; i++) {
    n ^= o[i] + position;
    n = Math.imul(n, 16777619) >>> 0;
  }
  return n % max;
}

/**
 * Le visage d un block, en SVG.
 * @param {string} adr    l adresse du block — la seule source
 * @param {object} [opt]  { taille } pour le viewBox, sinon 100 %
 */
export function visageDeBlock(adr, opt = {}) {
  const o = octets(adr);
  const teinte = tire(o, 0, 360);
  /* ⛔ SATURATION ET CLARTE BORNEES, et ce n est pas cosmetique : sans bornes, une adresse sur dix
   * rendrait un visage presque noir ou presque blanc, illisible sur le fond sombre de la map. Une
   * identite qu on ne distingue pas ne remplit pas son role. */
  const sat = 34 + tire(o, 1, 30);
  const clarte = 62 + tire(o, 2, 22);
  const museau = (teinte + 150 + tire(o, 3, 60)) % 360;
  const oreille = tire(o, 4, 3);          /* 0 pointue · 1 arrondie · 2 large */
  const oeil = tire(o, 5, 3);             /* 0 rond · 2 mi-clos · 1 large */
  const antenne = tire(o, 6, 2) === 1;
  const marque = tire(o, 7, 4);           /* une marque sur le front, ou aucune */

  const c = 'hsl(' + teinte + ' ' + sat + '% ' + clarte + '%)';
  const cOmbre = 'hsl(' + teinte + ' ' + sat + '% ' + Math.max(18, clarte - 34) + '%)';
  const cTrait = 'hsl(' + teinte + ' ' + Math.min(70, sat + 18) + '% ' + Math.max(12, clarte - 46) + '%)';
  const cMuseau = 'hsl(' + museau + ' 62% 68%)';

  /* les oreilles, en triangles poses sur la tete */
  const or = oreille === 0
    ? '<path d="M24 30 30 6 52 26Z" fill="' + c + '"/><path d="M124 26 146 6 152 30Z" fill="' + c + '"/>'
    : oreille === 1
      ? '<path d="M26 30 Q30 8 54 26Z" fill="' + c + '"/><path d="M122 26 Q146 8 150 30Z" fill="' + c + '"/>'
      : '<path d="M18 34 26 8 60 28Z" fill="' + c + '"/><path d="M116 28 150 8 158 34Z" fill="' + c + '"/>';

  const yeux = oeil === 0
    ? '<circle cx="64" cy="92" r="12" fill="' + cTrait + '"/><circle cx="112" cy="92" r="12" fill="' + cTrait + '"/>'
    : oeil === 1
      ? '<ellipse cx="64" cy="92" rx="14" ry="11" fill="' + cTrait + '"/><ellipse cx="112" cy="92" rx="14" ry="11" fill="' + cTrait + '"/>'
      : '<path d="M52 94 Q64 84 76 94" stroke="' + cTrait + '" stroke-width="7" fill="none" stroke-linecap="round"/>'
        + '<path d="M100 94 Q112 84 124 94" stroke="' + cTrait + '" stroke-width="7" fill="none" stroke-linecap="round"/>';

  const front = marque === 0 ? ''
    : marque === 1 ? '<rect x="80" y="44" width="16" height="16" rx="4" fill="' + cOmbre + '"/>'
    : marque === 2 ? '<path d="M88 42 100 60 76 60Z" fill="' + cOmbre + '"/>'
    : '<circle cx="88" cy="52" r="8" fill="' + cOmbre + '"/>';

  const ant = antenne
    ? '<rect x="85" y="2" width="5" height="16" rx="2" fill="' + cTrait + '"/>'
      + '<rect x="79" y="-6" width="17" height="15" rx="4" fill="' + cMuseau + '"/>'
    : '';

  return '<svg viewBox="-4 -8 184 200" xmlns="http://www.w3.org/2000/svg" role="img"'
    + ' aria-label="block face">'
    + ant + or
    /* ⛔ LA TETE EST UN CARRE ARRONDI, PAS UN CERCLE : c est un BLOCK avant d etre un chat. La forme
     * porte ce qu est la chose ; le visage porte laquelle. */
    + '<rect x="16" y="24" width="144" height="144" rx="34" fill="' + c + '"/>'
    /* une face laterale, pour que le carre garde son air de cube taille */
    + '<path d="M160 58 V134 A34 34 0 0 1 138 166 L160 166Z" fill="' + cOmbre + '" opacity=".55"/>'
    + front + yeux
    + '<path d="M82 116 h12 l-6 7Z" fill="' + cMuseau + '"/>'
    + '<path d="M88 124 Q80 134 72 128 M88 124 Q96 134 104 128" stroke="' + cTrait
      + '" stroke-width="5" fill="none" stroke-linecap="round"/>'
    + '</svg>';
}

/** ⛔ EXPORTE POUR LES TESTS : deux adresses differentes doivent donner deux visages differents,
 *  et la meme adresse doit toujours donner le meme. */
export function empreinteVisage(adr) {
  const o = octets(adr);
  return [tire(o, 0, 360), tire(o, 4, 3), tire(o, 5, 3), tire(o, 6, 2), tire(o, 7, 4)].join('-');
}
