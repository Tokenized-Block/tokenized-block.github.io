// lecteur.js — lire le CONTENU d un block, pas seulement constater qu il existe.
// ================================================================================================
// ⛔ CE MODULE TRAITE DU CONTENU ECRIT PAR DES INCONNUS. Le `contractURI` d un token tiers est
//    arbitraire : il peut porter un SVG contenant <script> ou un `onload`. Deux regles, aucune
//    negociable, et elles vivent ICI pour etre TESTABLES :
//      1. `sourceImage` n autorise que `data:image/`, `ipfs://` et `https://`. Tout autre schema
//         est REFUSE, jamais devine. `javascript:` est le cas qui compte.
//      2. l appelant pose l image via <img src="…">, JAMAIS par innerHTML. Un SVG charge par <img>
//         ne PEUT PAS executer de script — c est une contrainte du navigateur, pas notre politesse.
//
// ⛔ ET CHAQUE ECHEC PORTE SON ETAT. Un cadre vide se lit comme « ce block n a rien » ; ce n est
//    pas la meme affirmation que « nous n avons pas su lire ». Les deux appellent des gestes
//    opposes : republier, ou reessayer. On ne les confond pas.
//
// ⚠️ Extrait du HTML pour etre teste. Tant que cette logique vivait dans une balise <script>
//    inline, aucune de ces regles n etait verifiable autrement qu a l oeil.

/* ⛔⛔ DEFAUT TROUVE EN PRODUCTION, ET LE SYMPTOME ETAIT TROMPEUR. Sur le site en ligne, lire
 *    BLOCK 0 affichait « metadata FETCH FAILED », et la console disait CORS. Mesure
 *    (`sonde-passerelles-ipfs.mjs`, sept passerelles) : `ipfs.io` rend 429 — un RATE LIMIT — et
 *    sa reponse d erreur ne porte pas l en-tete CORS. Le navigateur signale donc « CORS » la ou
 *    la cause est le debit. Corriger le CORS n aurait rien corrige.
 * ⛔ ET LE PIEGE DE LA MESURE : depuis Node, tout marche — Node ignore CORS. Un test fait la
 *    aurait valide exactement le cas casse. On mesure l EN-TETE, pas le succes du telechargement.
 *    Resultat du jour : 429 sur ipfs.io, dweb.link, nftstorage.link, w3s.link ;
 *                       200 + CORS `*` sur gateway.pinata.cloud et 4everland.io.
 * ⚠️ UNE SEULE PASSERELLE EST UN POINT DE DEFAILLANCE UNIQUE sur la provenance d un jeton. On en
 *    essaie plusieurs, dans l ordre — et si toutes echouent, on le DIT au lieu d afficher un vide. */
export const PASSERELLES = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://4everland.io/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
];
export const PASSERELLE_PAR_DEFAUT = PASSERELLES[0];

/**
 * Echappe une valeur destinee a un ATTRIBUT HTML entre guillemets.
 *
 * ⛔ NE PAS CONFONDRE AVEC UN ECHAPPEUR DE TEXTE. L app posait la source de l image avec un
 *    helper bati sur `textContent -> innerHTML` : il echappe `<`, `>` et `&`, mais **PAS le
 *    guillemet ni l apostrophe**. Mesure du 2026-09-04, sur le site EN LIGNE :
 *
 *      data:image/svg+xml,<svg/>" data-x="oui        <- accepte par la liste blanche
 *      -> <img src="…"> obtenue avec l attribut `data-x` INJECTE
 *
 *    Le champ `image` d un block tiers est ecrit par son auteur. `onerror=` s executerait.
 *
 * ⛔ ET LA GARDE PRECEDENTE ETAIT VRAIE MAIS INSUFFISANTE. Le module affirmait qu un SVG charge
 *    par `<img src>` ne peut pas executer de script — c est exact, et ca protege contre
 *    l execution DEPUIS le SVG. Ca ne protege pas contre l injection DANS la balise. Une garde
 *    correcte peut couvrir la mauvaise moitie du probleme.
 *
 * ⚠️ `&` D ABORD, sinon on re-echappe les entites qu on vient d ecrire.
 */
export function enAttribut(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Classe un contractURI SANS aller le chercher. Pur, donc testable sans reseau. */
export function classerUri(u, passerelle = PASSERELLE_PAR_DEFAUT) {
  if (typeof u !== 'string' || u === '') return { type: 'VIDE' };
  if (u.startsWith('data:application/json;base64,')) return { type: 'DATA64', charge: u.slice(29) };
  if (u.startsWith('data:application/json,')) return { type: 'DATA', charge: u.slice(22) };
  /* ⚠️ `cid` EST RENDU EN PLUS DE `url`, pas a la place : `url` reste ce qu il etait pour les
   *    18 assertions existantes, et `cid` permet de reconstruire l URL sur une AUTRE passerelle.
   *    Sans lui, le repli multi-passerelles retomberait en silence sur une seule. */
  if (u.startsWith('ipfs://')) return { type: 'IPFS', cid: u.slice(7), url: passerelle + u.slice(7) };
  if (u.startsWith('http://') || u.startsWith('https://')) return { type: 'HTTP', url: u };
  return { type: 'INCONNU', brut: u.slice(0, 60) };
}

/**
 * Source utilisable pour une balise <img>, ou `null`.
 * ⛔ LISTE BLANCHE, PAS LISTE NOIRE. Interdire `javascript:` laisserait passer `vbscript:`,
 *    `data:text/html`, un espace de tete, une casse melangee. N autoriser QUE ce qu on sait sur
 *    est la seule forme qui ne se contourne pas par une variante qu on n avait pas prevue.
 */
export function sourceImage(v, passerelle = PASSERELLE_PAR_DEFAUT) {
  if (typeof v !== 'string' || v === '') return null;
  if (v.startsWith('data:image/')) return v;
  if (v.startsWith('ipfs://')) return passerelle + v.slice(7);
  if (v.startsWith('https://')) return v;
  return null;
}

/** Decode une charge base64 en texte UTF-8. Leve si la charge n est pas du base64 valide. */
function depuisBase64(charge) {
  const bin = typeof atob === 'function'
    ? atob(charge)
    : Buffer.from(charge, 'base64').toString('binary');
  /* ⛔ Node accepte du base64 invalide en le TRONQUANT au lieu de lever. On re-encode et on
   * compare : si l aller-retour ne rend pas la charge d origine, l entree n etait pas du base64.
   * Sans ce controle, une charge corrompue produirait un JSON partiel — donc « illisible » au lieu
   * de « invalide », c est-a-dire la mauvaise cause servie a l utilisateur. */
  const retour = typeof btoa === 'function'
    ? btoa(bin)
    : Buffer.from(bin, 'binary').toString('base64');
  const norme = (s) => s.replace(/=+$/, '');
  if (norme(retour) !== norme(charge)) throw new Error('base64 invalide');
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/**
 * Recupere et decode les metadonnees. `chercher` est injecte pour rester testable hors reseau.
 * Rend TOUJOURS un etat nomme — jamais `null`, jamais une exception qui remonte.
 */
export async function metadonnees(uri, { chercher = fetch, passerelle = PASSERELLE_PAR_DEFAUT } = {}) {
  const c = classerUri(uri, passerelle);
  if (c.type === 'VIDE') return { etat: 'NO URI', note: 'This block carries no contractURI. Nothing was engraved.' };
  if (c.type === 'INCONNU') return { etat: 'UNKNOWN SCHEME', note: 'URI starts with: ' + c.brut };

  let texte;
  try {
    if (c.type === 'DATA64') texte = depuisBase64(c.charge);
    else if (c.type === 'DATA') texte = decodeURIComponent(c.charge);
    else {
      /* ⚠️ DEPENDANCE EXTERNE, et elle se dit : une passerelle IPFS peut etre lente, filtree ou
       * absente. « injoignable » n est PAS « le block est vide ». */
      /* ⛔ ON ESSAIE CHAQUE PASSERELLE, ET ON GARDE LA CAUSE DE CHACUNE. Abandonner a la premiere
       * confondait « cette passerelle nous limite » avec « ce block n a pas de metadonnees » —
       * deux faits opposes, et c est le second qui s affichait a l utilisateur.
       * ⚠️ Seul le type IPFS a des alternatives : une URL http explicite pointe la ou elle
       *    pointe, et la remplacer serait aller chercher ailleurs ce que le jeton designe. */
      const candidats = c.type === 'IPFS' && c.cid
        ? PASSERELLES.map((p) => p + c.cid) : [c.url];
      const causes = [];
      let lu = null;
      /* ⛔⛔ ON GARDE LE PREMIER STATUT HTTP RENCONTRE, ET J AVAIS DETRUIT CETTE DISTINCTION.
       *    « GATEWAY 404 » dit que le contenu n est PAS LA — le geste est de republier.
       *    « FETCH FAILED » dit qu on n a pas pu joindre — le geste est de reessayer.
       *    Ma premiere version ecrasait tout sur le second : elle aurait fait reessayer
       *    indefiniment un contenu qui n existe pas. C est exactement la confusion que l en-tete
       *    de ce fichier interdit, et un test l a rattrapee. */
      let premierStatut = null;
      for (const url of candidats) {
        try {
          const r = await chercher(url);
          if (!r.ok) {
            if (premierStatut === null) premierStatut = r.status;
            /* ⚠️ L URL COMPLETE, PAS SEULEMENT L HOTE — un test l a exige et il avait raison :
             *    c est le CID qui identifie le contenu, et « pinata 404 » ne dit pas QUOI a
             *    manque. Quatre URL longues valent mieux qu une cause qu on ne peut pas rejouer. */
            causes.push(url + ' → ' + r.status);
            continue;
          }
          lu = await r.text();
          break;
        } catch (e) { causes.push(url + ' → ' + (e.message || 'echec')); }
      }
      if (lu === null && premierStatut !== null) {
        return { etat: 'GATEWAY ' + premierStatut, note: causes.join(' · '), essayees: candidats.length };
      }
      if (lu === null) {
        /* ⛔ ON GARDE LE NOM D ETAT EXISTANT. J avais invente « GATEWAYS FAILED » : deux tests sont
         *    tombes, et surtout l interface BRANCHE sur `FETCH FAILED`. Renommer un etat sur
         *    lequel d autres branches s appuient, c est le motif « un nouvel etat a besoin de sa
         *    branche PARTOUT » — et ici le gain aurait ete nul. La nouveaute va dans la CAUSE. */
        return { etat: 'FETCH FAILED', note: causes.join(' · '),
          /* ⛔ ON NOMME COMBIEN ONT ETE ESSAYEES : « echec » sur une passerelle et sur quatre ne
           *    disent pas la meme chose sur la disponibilite du contenu. */
          essayees: candidats.length };
      }
      texte = lu;
    }
  } catch (e) {
    return { etat: c.type === 'DATA64' ? 'INVALID BASE64' : c.type === 'DATA' ? 'INVALID ENCODING' : 'FETCH FAILED',
      note: e.message };
  }

  try { return { etat: 'LU', doc: JSON.parse(texte), source: c.type }; }
  catch (e) { return { etat: 'UNREADABLE JSON', note: e.message + ' — ' + texte.slice(0, 80) }; }
}
