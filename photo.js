// photo.js — decider si une photo TIENT dans un block, avant de la proposer a quiconque.
// ================================================================================================
// ⛔ CE MODULE EST PUR ET TESTE PARCE QU IL VIT DANS LE CHEMIN QUI SIGNE. Trois regressions sont
//    deja parties en production cette semaine sur cette page. Aucun correctif n y entre plus sans
//    un test qui l a d abord montre ROUGE.
//
// ⛔ LE MUR EST MESURE, PAS SUPPOSE. `cout-photo.mjs` sur Base mainnet, le 2026-09-06 :
//      0 Ko de photo -> 350 515 gas   ✅
//      5 Ko          -> 6 847 635     ✅
//     12 Ko          -> 15 921 140    ✅
//     13 Ko          -> REFUSE : « out of gas: gas exhausted during precompiled contract execution »
//    Et ce n est PAS un plafond d estimation du noeud : la meme sonde a 13 Ko en offrant
//    100 000 000 de gaz echoue a l identique. C est une limite INTRINSEQUE du precompile B20 ;
//    elle ne se contourne pas, et aucun reglage cote app ne la deplacera.
//
// ⚠️ ET LE COUT N EST PAS CELUI QU ON CROIT : 712 gas par octet ajoute, alors que 16 est le
//    MAXIMUM theorique pour de la calldata. Le poste dominant est donc le travail du precompile
//    (il STOCKE l URI), pas le transport. Une intuition « c est juste des octets » sous-estimerait
//    la facture d un facteur 44.
//
// ⛔ POURQUOI UNE MARGE. 12 Ko a PASSE et 13 a ECHOUE : la frontiere est quelque part entre les
//    deux, et je ne l ai pas raffinee a l octet. Se poser sur 12 288 exactement, ce serait parier
//    que le dernier point mesure est aussi le dernier point valide. La taille d une meme photo
//    varie aussi avec l encodeur du navigateur. On garde donc une marge, et on la NOMME.

/** Le plus grand FICHIER reellement accepte lors de la mesure. Au-dela : refus du precompile. */
export const PHOTO_MESUREE_OK = 12 * 1024;
/** Le plus petit FICHIER reellement refuse. Entre les deux : non mesure, donc interdit. */
export const PHOTO_MESUREE_REFUS = 13 * 1024;

/**
 * Taille du data: URI JSON final, pour `n` octets de fichier image.
 * ⛔ CE N EST PAS `n`. Le fichier est encode en base64 (4 octets pour 3), glisse dans un JSON,
 *    et le JSON entier est LUI AUSSI encode en base64. Deux inflations successives, pas une.
 *    Ignorer la seconde sous-estimerait d un tiers — et l app annoncerait un cout qu elle ne
 *    tiendrait pas.
 * @param {number} n octets du fichier image
 * @param {number} enrobage octets du JSON hors image (nom, symbole, description…)
 */
export function octetsUri(n, enrobage = 0) {
  if (!Number.isInteger(n) || n < 0) return null;
  const b64Image = 4 * Math.ceil(n / 3);
  const json = b64Image + enrobage;
  return 4 * Math.ceil(json / 3);
}

/* ⛔⛔ DEUX GRANDEURS QUE J AI CONFONDUES, ET LA CONFUSION COUTAIT LA MOITIE DE LA QUALITE D IMAGE.
 *    Le mur a ete mesure en octets du FICHIER (12 Ko passent, 13 sont refuses). Mais ce que l app
 *    doit borner, c est l URI COMPLET — et l URI vaut environ 1,79 fois le fichier apres la double
 *    inflation base64. Comparer un budget « fichier » a des octets « URI » divisait donc la photo
 *    autorisee par presque deux. Aucune garde ne pouvait le voir : les deux sont des nombres
 *    d octets, seul le SENS differe. On derive donc le budget URI du mur mesure, une seule fois,
 *    et on ne compare plus jamais que des URI a des URI. */
export const URI_MESURE_OK = octetsUri(PHOTO_MESUREE_OK, 120);
/** Ce qu on autorise : sous le dernier succes, avec 12,5 % de marge. */
export const PHOTO_MAX = Math.floor(URI_MESURE_OK * 0.875);

/**
 * Le verdict sur UNE photo. Quatre etats — jamais un booleen.
 * ⛔ UN BOOLEEN MENTIRAIT ICI. « false » confondrait « trop grosse » (l utilisateur peut agir :
 *    recadrer, recompresser) avec « ce n est pas une image » (il doit changer de fichier) et avec
 *    « je n ai pas pu mesurer » (l app ne doit RIEN affirmer). Trois causes, trois gestes.
 * ⚠️ FAIL-CLOSED : toute entree qu on ne sait pas lire rend NON_MESURE, jamais ACCEPTEE.
 */
export function verdictPhoto({ octets, type, plafond = PHOTO_MAX }) {
  if (typeof octets !== 'number' || !Number.isFinite(octets) || octets < 0) {
    return { etat: 'NON_MESURE', pourquoi: 'the file size could not be read' };
  }
  if (octets === 0) return { etat: 'NON_MESURE', pourquoi: 'the file is empty' };
  if (typeof type !== 'string' || !type.startsWith('image/')) {
    return { etat: 'PAS_UNE_IMAGE', pourquoi: 'this file is not an image (' + (type || 'unknown type') + ')' };
  }
  if (octets > plafond) {
    return { etat: 'TROP_GROSSE', pourquoi: 'the B-20 factory refuses a block this large',
      octets, plafond, trop: octets - plafond };
  }
  return { etat: 'ACCEPTEE', octets, plafond };
}

/**
 * La qualite JPEG a viser pour tenir sous le plafond, par dichotomie cote navigateur.
 * ⛔ ON NE DEVINE PAS UNE QUALITE : on RE-ENCODE et on RE-MESURE a chaque essai. Le rapport entre
 *    qualite et octets depend de l image (une photo de ciel compresse dix fois mieux qu une
 *    capture de texte) et de l encodeur du navigateur. Une table de correspondance serait juste
 *    pour une image et fausse pour la suivante.
 * @param {(q:number)=>Promise<number>} mesurer rend les octets obtenus pour la qualite q
 */
export async function chercherQualite(mesurer, plafond = PHOTO_MAX, essais = 7) {
  let bas = 0.3, haut = 0.95, meilleure = null;
  /* ⛔ ON ESSAIE LE HAUT D ABORD : si la meilleure qualite tient deja, degrader l image serait une
   *    perte gratuite. Le cas frequent ne doit pas payer le prix du cas rare. */
  const auHaut = await mesurer(haut);
  if (typeof auHaut === 'number' && auHaut <= plafond) return { qualite: haut, octets: auHaut };
  for (let i = 0; i < essais && haut - bas > 0.02; i++) {
    const q = (bas + haut) / 2;
    const n = await mesurer(q);
    /* ⚠️ UNE MESURE ILLISIBLE NE VAUT PAS « TROP GROS » : on retrecit sans jamais la retenir. */
    if (typeof n !== 'number' || !Number.isFinite(n)) { haut = q; continue; }
    if (n <= plafond) { meilleure = { qualite: q, octets: n }; bas = q; } else { haut = q; }
  }
  /* ⛔ RENDRE `null` PLUTOT QUE LA MOINS MAUVAISE. Aucune qualite ne tient => l app doit dire a
   *    l utilisateur de recadrer, pas graver a jamais une image illisible dans un block. */
  return meilleure;
}
