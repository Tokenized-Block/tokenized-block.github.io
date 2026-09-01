// keccak.js — Keccak-256, l empreinte d Ethereum. Pur JS, zero dependance.
// ================================================================================================
// ⛔ POURQUOI CE FICHIER EXISTE, PLUTOT QU UN `npm i`.
//
// Vérifier un paiement x402 demande de lire la chaine : selecteur de fonction, topics d evenement,
// adresses en checksum. Tous se derivent de Keccak-256 — et Node n en a PAS. `crypto` propose
// « sha3-256 », qui est le SHA-3 de la NIST : meme permutation, PADDING DIFFERENT (0x06 contre
// 0x01). Les deux rendent 32 octets et ne se ressemblent en rien. Les confondre donnerait des
// selecteurs plausibles et faux, et un appel RPC qui rend `0x` — c est-a-dire un silence qu on
// lirait comme « non paye ».
//
// ⛔ ET SURTOUT : L ALTERNATIVE ETAIT D ECRIRE LES SELECTEURS DE MEMOIRE. C est exactement la
//    faute qu on ne fait plus ici — ne jamais completer un identifiant de tete. Un selecteur faux
//    ne plante pas : il interroge une AUTRE fonction, ou aucune, et rend une reponse vide qu on
//    prend pour un fait. Mieux vaut 80 lignes qu on peut PROUVER sur des vecteurs publies.
//
// La preuve vit dans test/keccak.test.js : vecteurs officiels (chaine vide, « abc », …) plus un
// controle qui refuse explicitement le digest SHA3-NIST de la meme entree.

/* Constantes de tour de Keccak-f[1600], en paires 32 bits [haut, bas] : JS n a pas d entiers
 * 64 bits natifs dans les operations bit a bit, on travaille donc en deux moities. */
const RC = [
  [0x00000000, 0x00000001], [0x00000000, 0x00008082], [0x80000000, 0x0000808a],
  [0x80000000, 0x80008000], [0x00000000, 0x0000808b], [0x00000000, 0x80000001],
  [0x80000000, 0x80008081], [0x80000000, 0x00008009], [0x00000000, 0x0000008a],
  [0x00000000, 0x00000088], [0x00000000, 0x80008009], [0x00000000, 0x8000000a],
  [0x00000000, 0x8000808b], [0x80000000, 0x0000008b], [0x80000000, 0x00008089],
  [0x80000000, 0x00008003], [0x80000000, 0x00008002], [0x80000000, 0x00000080],
  [0x00000000, 0x0000800a], [0x80000000, 0x8000000a], [0x80000000, 0x80008081],
  [0x80000000, 0x00008080], [0x00000000, 0x80000001], [0x80000000, 0x80008008],
];
/* Les 24 offsets de rotation de ρ, DANS L ORDRE DU PARCOURS π ci-dessous — pas dans l ordre des
 * voies. Ma premiere version melangeait les deux tables et comptait 26 entrees dont une doublee :
 * la permutation tournait, produisait 32 octets d apparence normale, et TOUS les digests etaient
 * faux. Aucune exception, aucun symptome — seuls les vecteurs publies l ont dit. */
const ROT = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44];
const PI = [10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1];

/** Rotation a gauche d un mot de 64 bits porte par deux moities 32 bits. */
function rotl(h, l, n) {
  if (n === 0) return [h, l];
  if (n < 32) return [(h << n) | (l >>> (32 - n)), (l << n) | (h >>> (32 - n))];
  if (n === 32) return [l, h];
  const m = n - 32;
  return [(l << m) | (h >>> (32 - m)), (h << m) | (l >>> (32 - m))];
}

function permuter(A) {
  const C = new Array(10);
  for (let tour = 0; tour < 24; tour++) {
    // θ
    for (let x = 0; x < 5; x++) {
      C[x * 2] = A[x * 2] ^ A[(x + 5) * 2] ^ A[(x + 10) * 2] ^ A[(x + 15) * 2] ^ A[(x + 20) * 2];
      C[x * 2 + 1] = A[x * 2 + 1] ^ A[(x + 5) * 2 + 1] ^ A[(x + 10) * 2 + 1] ^ A[(x + 15) * 2 + 1] ^ A[(x + 20) * 2 + 1];
    }
    for (let x = 0; x < 5; x++) {
      const [rh, rl] = rotl(C[((x + 1) % 5) * 2], C[((x + 1) % 5) * 2 + 1], 1);
      const dh = C[((x + 4) % 5) * 2] ^ rh;
      const dl = C[((x + 4) % 5) * 2 + 1] ^ rl;
      for (let y = 0; y < 25; y += 5) { A[(x + y) * 2] ^= dh; A[(x + y) * 2 + 1] ^= dl; }
    }
    // ρ et π
    let lh = A[2], ll = A[3];
    for (let i = 0; i < 24; i++) {
      const j = PI[i];
      const th = A[j * 2], tl = A[j * 2 + 1];
      const [rh, rl] = rotl(lh, ll, ROT[i]);
      A[j * 2] = rh; A[j * 2 + 1] = rl;
      lh = th; ll = tl;
    }
    // χ
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) { C[x * 2] = A[(y + x) * 2]; C[x * 2 + 1] = A[(y + x) * 2 + 1]; }
      for (let x = 0; x < 5; x++) {
        A[(y + x) * 2] ^= ~C[((x + 1) % 5) * 2] & C[((x + 2) % 5) * 2];
        A[(y + x) * 2 + 1] ^= ~C[((x + 1) % 5) * 2 + 1] & C[((x + 2) % 5) * 2 + 1];
      }
    }
    // ι
    A[0] ^= RC[tour][1]; A[1] ^= RC[tour][0];
  }
}

/**
 * @param {Buffer|Uint8Array} octets
 * @returns {Buffer} 32 octets
 */
export function keccak256(octets) {
  const msg = octets instanceof Uint8Array ? octets : Uint8Array.from(octets);
  const debit = 136; // 1088 bits : le taux de Keccak-256
  const A = new Int32Array(50);

  /* ⛔ LE PADDING EST 0x01, PAS 0x06. C est LA seule difference avec SHA3-256 de la NIST, et c est
   * elle qui separe deux empreintes totalement differentes. Toute la raison d etre de ce fichier
   * tient dans cet octet. */
  const rembourre = new Uint8Array(Math.ceil((msg.length + 1) / debit) * debit);
  rembourre.set(msg);
  rembourre[msg.length] = 0x01;
  rembourre[rembourre.length - 1] |= 0x80;

  const vue = new DataView(rembourre.buffer, rembourre.byteOffset, rembourre.byteLength);
  for (let bloc = 0; bloc < rembourre.length; bloc += debit) {
    for (let i = 0; i < debit; i += 8) {
      const mot = i / 8 * 2;
      A[mot] ^= vue.getUint32(bloc + i, true);
      A[mot + 1] ^= vue.getUint32(bloc + i + 4, true);
    }
    permuter(A);
  }

  const out = new Uint8Array(32);
  const vo = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) {
    vo.setInt32(i * 8, A[i * 2], true);
    vo.setInt32(i * 8 + 4, A[i * 2 + 1], true);
  }
  return out;
}

export function keccak256Hex(octets) { return '0x' + [...keccak256(octets)].map((b) => b.toString(16).padStart(2, '0')).join(''); }

/**
 * Le selecteur d une fonction Solidity : les 4 premiers octets de keccak256 de sa signature.
 * ⛔ CALCULE, JAMAIS RECOPIE. Un selecteur ecrit de memoire n echoue pas bruyamment : il appelle
 *    une autre fonction ou aucune, et l appel rend « 0x » — un silence qu on lirait comme un fait.
 */
export function selecteur(signature) {
  return '0x' + [...keccak256(new TextEncoder().encode(signature)).subarray(0, 4)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

/** Le topic d un evenement : keccak256 de sa signature, en entier. */
export function topic(signature) { return keccak256Hex(new TextEncoder().encode(signature)); }
