// classement.js — qui a le gros block ? Un rang MESURE, jamais declare.
// ================================================================================================
// ⛔ POURQUOI UN CLASSEMENT, ET POURQUOI IL EST DANGEREUX. Ce qui fait qu on POSSEDE une chose et
//    qu on ne fait pas que la detenir, c est qu elle a une tete, qu elle est visible par d autres,
//    et qu on peut la perdre. Un solde n a rien de tout ca ; un block classe, si.
//    ⚠️ Et c est exactement la psychologie qui fait perdre de l argent aux gens. On construit donc
//    le classement ET les phrases qui empechent de le lire comme une richesse.
//
// ⛔⛔ LE RANG PORTE SA POPULATION. « 3e » ne veut rien dire sans « sur combien, choisis comment ».
//    Un classement des 12 blocks affiches n est pas un classement des blocks qui existent : c est
//    un classement de CE QU ON A SU LIRE, dans une fenetre donnee. Le taire transformerait un
//    echantillon en palmares.
//
// ⛔ ET UN BLOCK SANS PRIX N EST PAS DERNIER. Il n est PAS CLASSE. Le mettre au fond du tableau
//    dirait « il vaut moins que tous les autres » alors qu on n a pas su le lire — la meme faute
//    que « 0 PV » pour « jamais cote ». Deux listes, donc : les classes, et les non mesures.
//
// ⚠️ CE QU IL NE PROUVE PAS : une capitalisation elevee n est pas de l argent dans la pool. Elle se
//    fabrique en initialisant une pool au prix qu on veut avec une liquidite derisoire. Le rang
//    transporte donc la PROFONDEUR, et l appelant doit l afficher — sinon le classement vend un
//    nombre achetable comme un exploit.

/** Un block non classe : on dit POURQUOI, jamais « dernier ». */
export const NON_CLASSE = 'NON_CLASSE';

/**
 * Classe des blocks par capitalisation mesuree.
 * @param {Array} blocks  [{ adr, symbole, capitalisation, devise, liquidite }]
 *                        `capitalisation` null = non mesuree (PAS zero)
 * @returns {{ classes: Array, nonMesures: Array, population: number, devises: Array }}
 */
export function classer(blocks) {
  const tous = Array.isArray(blocks) ? blocks : [];
  const mesures = [], nonMesures = [];
  for (const b of tous) {
    if (!b || typeof b.adr !== 'string') continue;
    const c = b.capitalisation;
    if (typeof c === 'number' && Number.isFinite(c) && c >= 0) mesures.push({ ...b });
    else nonMesures.push({ ...b, etat: NON_CLASSE, pourquoi: (b && b.pourquoi) || 'no price read' });
  }
  /* ⛔ TRI DECROISSANT, ET STABLE SUR L ADRESSE. Sans depart de depart deterministe, deux blocks a
   * capitalisation egale changeraient de place d une lecture a l autre : un classement qui bouge
   * sans que rien ne bouge se lit comme du mouvement de marche. */
  mesures.sort((x, y) => (y.capitalisation - x.capitalisation) || (x.adr < y.adr ? -1 : x.adr > y.adr ? 1 : 0));
  const classes = mesures.map((b, i) => ({ ...b, rang: i + 1 }));

  /* ⛔ LES DEVISES SONT NOMMEES, ET S IL Y EN A PLUSIEURS ON REFUSE DE COMPARER. Ranger une
   * capitalisation en ETH a cote d une en USDC produirait un classement faux avec des chiffres
   * vrais — la forme la plus difficile a reperer. */
  const devises = [...new Set(classes.map((b) => b.devise).filter(Boolean))];

  return {
    classes: devises.length > 1 ? [] : classes,
    /* Quand les devises se melangent, TOUT devient non classe, avec la raison. */
    nonMesures: devises.length > 1
      ? [...classes.map((b) => ({ ...b, etat: NON_CLASSE, pourquoi: 'mixed quote currencies — refusing to rank ' + devises.join(' vs ') })), ...nonMesures]
      : nonMesures,
    population: tous.length,
    devises,
    /* ⛔ LA BORNE VOYAGE AVEC LE RESULTAT : un appelant qui n afficherait que `classes` afficherait
     * un palmares. Cette phrase existe pour qu il ne puisse pas l ignorer sans le vouloir. */
    borne: 'Rank among the blocks this page could READ in one window — not among all blocks that '
      + 'exist. A market cap is price × supply: it is not money in the pool, and it can be set by '
      + 'initializing a pool at any price with almost no liquidity.',
  };
}

/**
 * Le rang d UN block dans un classement deja calcule.
 * ⛔ Rend `null` s il n y est pas — jamais un rang invente, jamais « dernier ».
 */
export function rangDe(classement, adr) {
  if (!classement || !Array.isArray(classement.classes) || typeof adr !== 'string') return null;
  const a = adr.toLowerCase();
  const t = classement.classes.find((b) => String(b.adr).toLowerCase() === a);
  return t ? { rang: t.rang, sur: classement.classes.length } : null;
}
