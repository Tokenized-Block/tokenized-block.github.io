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

export const PASSERELLE_PAR_DEFAUT = 'https://ipfs.io/ipfs/';

/** Classe un contractURI SANS aller le chercher. Pur, donc testable sans reseau. */
export function classerUri(u, passerelle = PASSERELLE_PAR_DEFAUT) {
  if (typeof u !== 'string' || u === '') return { type: 'VIDE' };
  if (u.startsWith('data:application/json;base64,')) return { type: 'DATA64', charge: u.slice(29) };
  if (u.startsWith('data:application/json,')) return { type: 'DATA', charge: u.slice(22) };
  if (u.startsWith('ipfs://')) return { type: 'IPFS', url: passerelle + u.slice(7) };
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
      const r = await chercher(c.url);
      if (!r.ok) return { etat: 'GATEWAY ' + r.status, note: c.url };
      texte = await r.text();
    }
  } catch (e) {
    return { etat: c.type === 'DATA64' ? 'INVALID BASE64' : c.type === 'DATA' ? 'INVALID ENCODING' : 'FETCH FAILED',
      note: e.message };
  }

  try { return { etat: 'LU', doc: JSON.parse(texte), source: c.type }; }
  catch (e) { return { etat: 'UNREADABLE JSON', note: e.message + ' — ' + texte.slice(0, 80) }; }
}
