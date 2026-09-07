// lien-x.js — lier un compte X a un wallet, dans LES DEUX SENS, ou pas du tout.
// ================================================================================================
// ⛔ POURQUOI DEUX SENS. Chaque moitie prise seule ne prouve RIEN, et se retourne meme contre
//    l utilisateur :
//      · une SIGNATURE seule : n importe qui signe « je suis @elonmusk ». Le compte n a rien dit.
//      · un POST seul : n importe qui publie une adresse qu il ne possede pas.
//    Ensemble elles se lient : le wallet nomme le compte, et le compte publie la signature. Aucune
//    des deux ne peut etre fabriquee sans l autre.
//
// ⛔⛔ ET C EST LA MOITIE MANQUANTE QUI EST DANGEREUSE, PAS LA MOITIE FAUSSE. Un outil « anti-scam »
//    bati sur un handle AUTO-DECLARE designerait la victime comme la source : le fraudeur inscrit
//    le handle d un compte de confiance sur son jeton, et l outil accuse le compte de confiance.
//    Preuve que le risque est reel et deja present : sur openlaunch, un jeton porte
//    `x_handle: Clansy314495853` — ecrit par nous, verifie par personne. Le champ existe partout
//    et ne prouve rien nulle part.
//
// ⛔⛔⛔ ON SE LIE A L IDENTIFIANT NUMERIQUE, JAMAIS AU @HANDLE. Un handle se change et se REVEND :
//    se lier a un handle, c est se lier a un nom loue, et la preuve suivrait le nouveau
//    proprietaire. `user.id_str` ne change jamais. C est exactement la lecon `0xb200` contre
//    `0xef` : le prefixe est impersonnable, le code ne l est pas.
//    Mesure du 2026-09-06 : l endpoint de syndication rend `user.id_str` SANS authentification —
//    la liaison a l identifiant stable est donc possible, et rien ne justifie de s en priver.
//
// ⚠️ CE QUE CE LIEN NE PROUVERA JAMAIS, ET QUI DOIT ETRE DIT AVEC LUI :
//    · le post peut etre SUPPRIME apres coup : la preuve disparait sans que rien ne l annonce.
//      Une verification est donc valable A UNE DATE, jamais « pour toujours ».
//    · il prouve qu un compte et une cle se reconnaissent — PAS que leur proprietaire est honnete.
//      Un fraudeur peut parfaitement prouver son propre lien. Ce lien sert a ATTRIBUER, pas a
//      absoudre.
//    · les wallets a contrat (EIP-1271) ne signent pas comme une cle : ils ne sont PAS couverts,
//      et une adresse de contrat doit rendre NON_MESURE plutot qu un refus qui la dirait fausse.

/** Le domaine du defi : sans lui, une signature obtenue ailleurs se rejouerait ici. */
export const DOMAINE = 'tokenized-block';

/**
 * Normalise un handle X saisi a la main. Rend `null` si ce n est pas un handle.
 * ⛔ ON NE FABRIQUE PAS D URL A PARTIR DE N IMPORTE QUOI. Un champ libre colle dans
 *    `https://x.com/<valeur>` accepterait « ../../autre-site » ou un handle avec un slash, et
 *    l app publierait un lien vers ailleurs en le presentant comme le compte du createur.
 */
export function handleNormalise(saisi) {
  const brut = String(saisi || '').trim();
  /* ⛔⛔ DEUX CAS, ET LES CONFONDRE FABRIQUE UNE IDENTITE. Ma premiere version retirait tout ce
   *    qui suivait un `/` sur N IMPORTE QUELLE saisie : « a/b » devenait « a », un handle qui
   *    appartient a QUELQU UN D AUTRE, et l app l affichait comme le compte du createur. Une
   *    troncature silencieuse sur un identifiant est une usurpation, pas un nettoyage.
   *    ⇒ Un CHEMIN n est tolere que dans une URL x.com/twitter.com reconnue. Une saisie brute
   *      doit etre un handle et rien d autre. */
  const urlX = brut.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)/i);
  const t = (urlX ? urlX[1] : brut).replace(/^@/, '');
  /* Les regles de X : 1 a 15 caracteres, lettres, chiffres et souligne. Rien d autre. */
  return /^[A-Za-z0-9_]{1,15}$/.test(t) ? t : null;
}

/**
 * Rend une URL de site SEULEMENT si elle est sure a afficher.
 * ⛔⛔ CE N EST PAS DE LA COSMETIQUE : `javascript:` dans un `href` EXECUTE du code au clic, avec
 *    la page — et cette page parle au portefeuille. Une metadonnee vient d un INCONNU : c est une
 *    entree hostile par defaut, exactement comme le texte d un commentaire.
 * ⚠️ Liste BLANCHE, jamais liste noire : interdire `javascript:` laisserait passer `data:`,
 *    `vbscript:`, et le prochain schema invente. On n autorise que http et https.
 */
export function siteSur(saisi) {
  const t = String(saisi || '').trim();
  if (!t) return null;
  let u;
  try { u = new URL(t); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname) return null;
  /* ⛔ UN HOTE D UN SEUL MOT EST REFUSE, ET LE TEST M A APPRIS POURQUOI. `https:///chemin` ne
   *    donne PAS un hote vide : le parseur lit « chemin » COMME nom d hote et rend
   *    « https://chemin/ ». Ce qui ressemblait a un chemin devient un site inconnu, affiche comme
   *    le site du createur. Un site public a toujours un point dans son nom. */
  if (!u.hostname.includes('.')) return null;
  return u.href;
}

/**
 * Le message EXACT a signer. Il est reconstruit a l identique au moment de verifier ; si un seul
 * caractere differe, la signature ne correspondra plus — c est voulu.
 * ⛔ CHAQUE CHAMP EST LA POUR EMPECHER UNE ATTAQUE PRECISE, aucun n est decoratif :
 *    · `domaine`   — empeche de rejouer ici une signature donnee a un autre site ;
 *    · `xId`       — LIE AU COMPTE, pas au nom ; c est le pivot de tout ;
 *    · `adresse`   — sans elle, la signature vaudrait pour n importe quel wallet ;
 *    · `chaineId`  — empeche de transporter une preuve d un reseau a l autre ;
 *    · `nonce`     — empeche de rejouer la MEME preuve deux fois ;
 *    · `expire`    — une preuve eternelle est une preuve qu on ne peut plus retirer.
 */
export function messageDefi({ xId, handle, adresse, chaineId, nonce, expire }) {
  const manquants = Object.entries({ xId, adresse, chaineId, nonce, expire })
    .filter(([, v]) => v === undefined || v === null || v === '').map(([k]) => k);
  /* ⛔ ON REFUSE PLUTOT QUE DE CONSTRUIRE UN MESSAGE INCOMPLET. Un champ vide produirait un
   *    message qui a l air normal et qui ne lie rien — le pire des deux mondes. */
  if (manquants.length) return { etat: 'REFUSE', pourquoi: 'missing: ' + manquants.join(', ') };
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(adresse))) {
    return { etat: 'REFUSE', pourquoi: 'not an address: ' + adresse };
  }
  if (!/^\d{1,25}$/.test(String(xId))) {
    /* ⚠️ Un handle glisse ici a la place de l identifiant est l erreur la plus probable, et la
     *    plus silencieuse : tout continuerait de fonctionner en liant au mauvais objet. */
    return { etat: 'REFUSE', pourquoi: 'xId must be the numeric account id, not the @handle: ' + xId };
  }
  const texte = [
    DOMAINE + ' — link an X account to a wallet',
    'x account id: ' + xId,
    'x handle when signed: ' + (handle || '(not recorded)'),
    'wallet: ' + String(adresse).toLowerCase(),
    'chain: ' + chaineId,
    'nonce: ' + nonce,
    'expires: ' + new Date(expire).toISOString(),
  ].join('\n');
  return { etat: 'OK', texte };
}

/** Trouve une signature 65 octets dans le texte d un post. */
export function signatureDansTexte(texte) {
  const m = String(texte || '').match(/0x[0-9a-fA-F]{130}\b/);
  return m ? m[0] : null;
}

/**
 * Le verdict sur un lien. SIX etats — jamais un booleen.
 * ⛔ UN BOOLEEN SERAIT ICI UNE FAUTE DE SECURITE, pas un raccourci de style. « false » confondrait
 *    « la signature ne correspond pas » (quelqu un ment) avec « je n ai pas pu lire le post »
 *    (je ne sais rien). Le premier accuse, le second ne dit rien — et les afficher pareil, c est
 *    accuser sur sa propre panne.
 * @param {object} attendu  ce que le lien PRETEND : xId, adresse, chaineId, nonce, expire
 * @param {object} post     ce que X a rendu : auteurId, texte, absent
 * @param {string} recouvre l adresse recuperee de la signature, ou null si non recuperable
 */
export function verdictLien({ attendu, post, recouvre, maintenant = Date.now() }) {
  if (!post || post.absent) {
    return { etat: 'POST_ILLISIBLE',
      pourquoi: 'the post could not be read — it may have been deleted, or X may be unreachable' };
  }
  /* ⛔ L ORDRE COMPTE. On verifie D ABORD que le post vient du bon compte : une signature valide
   *    publiee par QUELQU UN D AUTRE est precisement l attaque, et l accepter serait le defaut. */
  if (String(post.auteurId) !== String(attendu.xId)) {
    return { etat: 'COMPTE_DIFFERENT',
      pourquoi: 'the post was written by account ' + post.auteurId + ', not ' + attendu.xId,
      attendu: attendu.xId, trouve: post.auteurId };
  }
  if (!recouvre) {
    return { etat: 'NON_MESURE',
      pourquoi: 'no address could be recovered from the signature — a smart-contract wallet (EIP-1271) is not covered here' };
  }
  if (String(recouvre).toLowerCase() !== String(attendu.adresse).toLowerCase()) {
    return { etat: 'SIGNATURE_ETRANGERE',
      pourquoi: 'the signature was made by ' + recouvre + ', not by ' + attendu.adresse };
  }
  /* ⛔ L EXPIRATION EN DERNIER, ET C EST DELIBERE : un lien expire mais par ailleurs VALIDE n est
   *    pas une tentative de fraude, c est une preuve a rafraichir. Le dire dans cet ordre evite
   *    d afficher « signature etrangere » a quelqu un dont le seul tort est d avoir attendu. */
  if (maintenant > attendu.expire) {
    return { etat: 'EXPIRE', pourquoi: 'this proof expired on ' + new Date(attendu.expire).toISOString(),
      expire: attendu.expire };
  }
  return { etat: 'LIE_PROUVE', xId: attendu.xId, adresse: String(attendu.adresse).toLowerCase(),
    /* ⚠️ LA DATE VOYAGE AVEC LE VERDICT. Un post peut etre supprime demain : « prouve » sans date
     *    laisserait croire a une garantie permanente. */
    verifieLe: new Date(maintenant).toISOString(),
    /* ⛔ ET ON REPETE CE QUE CA NE DIT PAS, DANS LA DONNEE ELLE-MEME — pas seulement dans un
     *    commentaire que l appelant ne lira jamais. */
    neProuvePas: 'that this account is honest — only that this account and this key acknowledge each other' };
}
