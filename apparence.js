// apparence.js — le block que PERSONNE D AUTRE n a, derive de l adresse elle-meme.
// ================================================================================================
// ⛔ L IDEE, ET POURQUOI ELLE TIENT. Aujourd hui chaque nouveau venu voit le MEME block bleu par
//    defaut : celui de la demo. « Personnaliser » lui demande donc de bouger huit curseurs avant
//    d avoir quelque chose a lui — c est-a-dire de faire un travail pour obtenir ce qu il croyait
//    deja posseder. En derivant l apparence de son ADRESSE, son block est le sien des la
//    connexion, sans un geste.
//
// ⛔ DETERMINISTE, ET C EST LA PROPRIETE QUI COMPTE. La meme adresse rend TOUJOURS le meme block :
//    on peut le reconnaitre, le retrouver, le montrer. Un aleatoire donnerait un joli dessin qui
//    changerait a chaque visite — donc rien a quoi s attacher, et rien de reproductible dans des
//    metadonnees GRAVEES.
//
// ⛔ ET ON NE DERIVE PAS DE L ADRESSE BRUTE. Les adresses ne sont pas uniformes : elles partagent
//    des prefixes (0x000…, 0xb200… chez nous), et decouper les caracteres tels quels donnerait le
//    meme dessin a des familles entieres d adresses. On passe par keccak, dont la sortie est
//    uniforme — c est la meme fonction que le reste du depot utilise deja, pas une nouvelle
//    dependance.
//
// ⚠️ CE QUE CE MODULE NE FAIT PAS : il ne remplace JAMAIS un choix. L app ne l applique qu a la
//    connexion et seulement si l utilisateur n a touche a rien. Ecraser un reglage choisi serait
//    pire que ne rien proposer.
import { keccak256 } from './keccak.js';

const enc = new TextEncoder();

/* Les valeurs possibles, dans l ordre exact des menus de la page.
 * ⛔ SI UNE OPTION EST AJOUTEE AU MENU ET PAS ICI, elle ne sortira jamais au hasard : le block
 *    « personnel » n explorerait qu une partie du catalogue, sans que rien ne le dise. Un test
 *    compare donc ces listes a celles du HTML. */
export const ORBITES = ['sillage', 'couronne', 'essaim', 'chute', 'coins', 'spirale', 'colonne', 'ailes', 'ronde', 'diagonale'];
export const FACETTES = ['lettre', 'anneau', 'barres', 'disque', 'croix', 'losange', 'triangle',
  'points', 'chevrons', 'cible', 'etoile', 'eclair', 'hexagone', 'coche', 'cle', 'vague', 'grille', 'fleche', 'vide'];
export const MATIERES = ['verre', 'plein', 'fil', 'neon', 'papier', 'encre', 'chrome', 'braise', 'givre'];

/**
 * L apparence d une adresse. Rend `null` si l entree n est pas une adresse — jamais un defaut.
 * ⛔ RENDRE UN DEFAUT SUR UNE ENTREE ILLISIBLE donnerait a deux personnes differentes le meme
 *    block « personnel », et personne ne saurait pourquoi.
 */
export function apparenceDepuisAdresse(adresse) {
  if (typeof adresse !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(adresse)) return null;
  const h = keccak256(enc.encode(adresse.toLowerCase()));
  /* ⚠️ On lit des octets DIFFERENTS pour chaque champ. Reutiliser le meme octet lierait deux
   *    reglages entre eux — par exemple « toujours cette matiere avec cette face » — et le
   *    catalogue apparent se reduirait sans que le compte de combinaisons le montre. */
  const o = (i) => h[i];
  return {
    /* 0-360 : on prend deux octets pour eviter les 256 teintes seulement */
    teinte: (o(0) * 256 + o(1)) % 361,
    accent: (o(2) * 256 + o(3)) % 361,
    /* le curseur va de 1 a 5 */
    division: 1 + (o(4) % 5),
    /* de 0 a 6 : zero est un etat VALIDE, un block qu on ne veut pas voir se diviser */
    eclats: o(5) % 7,
    orbite: ORBITES[o(6) % ORBITES.length],
    facette: FACETTES[o(7) % FACETTES.length],
    matiere: MATIERES[o(8) % MATIERES.length],
  };
}

/**
 * Combien de blocks distincts ce schema peut-il rendre ?
 * ⛔ CE CHIFFRE SERT A NE PAS SUR-VENDRE. « Unique pour chacun » est faux : deux adresses peuvent
 *    tomber sur la meme apparence, et avec 361x361x5x7x10x19x9 possibilites le paradoxe des
 *    anniversaires donne une collision bien avant d avoir epuise le catalogue. On publie le
 *    nombre, pas l adjectif.
 */
export function combinaisons() {
  return 361 * 361 * 5 * 7 * ORBITES.length * FACETTES.length * MATIERES.length;
}
