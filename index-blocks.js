// index-blocks.js — la liste des blocks qui existent. Sans elle, un block cree est INVISIBLE.
// ================================================================================================
// ⛔ CE MODULE COMBLE LE MANQUE LE MOINS CHER ET LE PLUS BLOQUANT : le lecteur exige de DEJA
//    connaitre une adresse. Un block cree par quelqu un d autre n existe pour personne.
//
// ⛔ TROIS CONTRAINTES MESUREES, pas supposees :
//    1. `eth_getLogs` est borne a 10 000 blocs sur Base. La plage complete est REFUSEE. On pagine,
//       et on DIT jusqu ou on a regarde — « rien trouve » et « pas regarde » sont deux reponses
//       differentes.
//    2. L evenement `B20Created(address indexed token, B20Variant indexed variant, string name,
//       string symbol, uint8 decimals, bytes variantEventParams)` porte le token en `topics[1]`.
//       ⚠️ Mon premier recensement lisait `topics[1]` SANS filtrer sur `topic0` : il ramassait
//       d autres evenements de la factory et rendait des adresses qui n etaient pas des tokens.
//       Le filtre par topic0 n est pas une optimisation, c est la correction.
//    3. **L EVENEMENT NE PORTE PAS LE CREATEUR.** Il faut le lire dans `tx.from`. Un log dit ce
//       qui a ete emis ; seule la transaction dit QUI A PAYE. C est la meme regle que pour les
//       `Transfer` forges : un evenement n est pas une transaction.
import { selecteur } from './pool.js';
import { keccak256 } from './keccak.js';

export const FACTORY = '0xb20f000000000000000000000000000000000000';
/** ⛔ Fenetre maximale acceptee par le RPC de Base. Mesuree, pas choisie. */
export const FENETRE_MAX = 9500;

const enc = new TextEncoder();
const hexDe = (o) => [...o].map((b) => b.toString(16).padStart(2, '0')).join('');
export const TOPIC_CREATED = '0x' + hexDe(keccak256(enc.encode(
  'B20Created(address,uint8,string,string,uint8,bytes)')));

/**
 * Decode une `string` ABI a un offset donne dans un blob hex sans `0x`.
 *
 * ⛔ LA LONGUEUR EST BORNEE PAR LES DONNEES DISPONIBLES, ET CE N EST PAS DU ZELE.
 *    Un log mal forme (ou hostile) porte un offset absurde ; la longueur lue vaut alors ~2^256, et
 *    la boucle qui construit la chaine ne LEVE PAS — elle BOUCLE, et fait tomber le moteur sur un
 *    depassement memoire. Un `try/catch` ne rattrape rien : il n y a pas d exception, il y a un
 *    gel. Trouve par `test-index.mjs`, qui a fait planter V8 au lieu d echouer proprement.
 *    ⇒ on refuse AVANT de boucler, en comparant a ce qui existe reellement.
 */
function chaineA(donnees, offsetOctets) {
  const d = offsetOctets * 2;
  if (!Number.isFinite(d) || d < 0 || d + 64 > donnees.length) {
    throw new Error('offset de chaine hors des donnees (' + offsetOctets + ')');
  }
  const len = parseInt(donnees.slice(d, d + 64), 16);
  const dispo = (donnees.length - (d + 64)) / 2;
  if (!Number.isFinite(len) || len < 0 || len > dispo) {
    throw new Error('longueur de chaine annoncee (' + len + ') > octets disponibles (' + dispo + ')');
  }
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(parseInt(donnees.slice(d + 64 + i * 2, d + 66 + i * 2), 16));
  return s;
}

/**
 * Decode un log `B20Created`. Rend `null` si le log n est pas celui-la — un decodage force
 * produirait des noms de fantaisie a partir d octets qui ne sont pas des chaines.
 */
export function decoderCreation(log) {
  if (!log || !log.topics || log.topics[0] !== TOPIC_CREATED) return null;
  const jeton = '0x' + log.topics[1].slice(26);
  const variante = Number(BigInt(log.topics[2]));
  const d = log.data.replace(/^0x/, '');
  try {
    const offNom = Number(BigInt('0x' + d.slice(0, 64)));
    const offSym = Number(BigInt('0x' + d.slice(64, 128)));
    const decimales = Number(BigInt('0x' + d.slice(128, 192)));
    return { jeton, variante, nom: chaineA(d, offNom), symbole: chaineA(d, offSym), decimales,
      bloc: log.blockNumber ? parseInt(log.blockNumber, 16) : null, tx: log.transactionHash };
  } catch (e) {
    /* ⛔ Un log mal forme se DIT, il ne se devine pas. */
    return { jeton, variante, nom: null, symbole: null, decimales: null, erreur: e.message,
      bloc: log.blockNumber ? parseInt(log.blockNumber, 16) : null, tx: log.transactionHash };
  }
}

/**
 * Parcourt les `n` derniers blocs par fenetres, et rend les creations trouvees.
 * ⛔ Rend AUSSI la fenetre reellement parcourue et les fenetres qui ont ECHOUE. Une liste sans sa
 *    borne se lit comme exhaustive, ce qu elle n est jamais.
 */
export async function listerCreations({ rpc, blocs = 90000, fin = null, surProgres = null }) {
  const dernier = fin ?? parseInt(await rpc('eth_blockNumber', []), 16);
  const debut = Math.max(0, dernier - blocs);
  const trouvees = [];
  const fenetresRatees = [];
  let bas = dernier;
  while (bas > debut) {
    const haut = bas;
    bas = Math.max(debut, haut - FENETRE_MAX);
    try {
      const logs = await rpc('eth_getLogs', [{
        fromBlock: '0x' + bas.toString(16), toBlock: '0x' + haut.toString(16),
        address: FACTORY, topics: [TOPIC_CREATED],
      }]);
      for (const l of logs) { const c = decoderCreation(l); if (c) trouvees.push(c); }
    } catch (e) {
      /* ⛔ Une fenetre ratee n est pas une fenetre vide. On la NOMME. */
      fenetresRatees.push({ de: bas, a: haut, cause: e.message });
    }
    if (surProgres) surProgres({ parcouru: dernier - bas, total: dernier - debut, trouvees: trouvees.length });
  }
  trouvees.sort((a, b) => (b.bloc ?? 0) - (a.bloc ?? 0));
  return { creations: trouvees, fenetre: { de: debut, a: dernier }, fenetresRatees };
}

/**
 * Resout le CREATEUR d une creation. ⛔ Depuis la TRANSACTION, jamais depuis le log : l evenement
 * ne le porte pas, et le deduire serait l inventer.
 */
export async function createurDe({ rpc, tx, essais = 4, attente = 350 }) {
  if (!tx) return { createur: null, raison: 'aucun hash de transaction dans le log' };
  let derniere = null;
  for (let n = 0; n < essais; n++) {
    try {
      const t = await rpc('eth_getTransactionByHash', [tx]);
      /* ⛔ « introuvable » est une REPONSE, pas une panne : on ne la reessaie pas. Reessayer une
       * reponse stable ne fait que perdre du temps et brouiller la distinction. */
      if (!t) return { createur: null, raison: 'transaction introuvable : non mesure, pas absent' };
      return { createur: t.from, essais: n + 1 };
    } catch (e) {
      /* ⚠️ CE QU ON REESSAIE : les pannes TRANSITOIRES. Mesure du 2026-09-02 sur le RPC public de
       * Base Sepolia : meme a concurrence 4, seules 95 % des lectures passent ; a 16, 33 %.
       * Sans reprise, 2 110 blocks sur 3 000 remontaient « createur inconnu » — un resultat
       * honnete et inutilisable. La limite de debit est transitoire PAR NATURE : la traiter comme
       * un verdict etait la faute. */
      derniere = e.message;
      if (n < essais - 1) await new Promise((r) => setTimeout(r, attente * (2 ** n)));
    }
  }
  return { createur: null, raison: derniere + ' (apres ' + essais + ' essais)' };
}

/**
 * Filtre par createur. ⛔ Une transaction a lire PAR ENTREE — c est le coût irreductible, puisque
 * l evenement ne porte pas le createur.
 *
 * ⚠️ LA CONCURRENCE N EST PAS UNE OPTIMISATION, C EST CE QUI REND LA FONCTION UTILISABLE.
 *    En sequentiel, 400 resolutions prenaient assez longtemps pour qu il faille plafonner a 400 —
 *    et sur une fenetre de 60 000 blocs contenant 4 806 creations, le block de l utilisateur
 *    tombait AU-DELA du plafond. La liste disait honnetement « 4 406 non verifies », et restait
 *    inutilisable : honnete et inutilisable reste inutilisable.
 *
 * ⛔ `surProgres` existe pour que l appelant puisse montrer l avancement plutot qu un ecran fige.
 */
export async function creationsDe({ rpc, creations, adresse, concurrence = 12, surProgres = null }) {
  const cible = adresse.toLowerCase();
  const gardees = [];
  const nonResolues = [];
  let faits = 0;
  for (let i = 0; i < creations.length; i += concurrence) {
    const lot = creations.slice(i, i + concurrence);
    const res = await Promise.all(lot.map((c) => createurDe({ rpc, tx: c.tx })));
    for (let j = 0; j < lot.length; j++) {
      const { createur, raison } = res[j];
      if (createur === null) { nonResolues.push({ ...lot[j], raison }); continue; }
      if (createur.toLowerCase() === cible) gardees.push({ ...lot[j], createur });
    }
    faits += lot.length;
    if (surProgres) surProgres({ faits, total: creations.length, trouves: gardees.length });
  }
  /* ⛔ Les non resolues ne sont ni « a lui » ni « pas a lui » : elles sont INCONNUES, et l appelant
   * doit pouvoir le dire a l ecran. */
  return { gardees, nonResolues };
}

export { selecteur };
