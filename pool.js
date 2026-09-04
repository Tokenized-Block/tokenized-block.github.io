// pool.js — encoder la sequence de mise en liquidite d un block dans une pool Uniswap v4.
// ================================================================================================
// ⛔ MEME DISCIPLINE QUE POUR LA CREATION : ces octets sont compares OCTET POUR OCTET a ceux que
//    `base-forge` produit pour les memes parametres (`test-pool.mjs`, reference lue dans
//    l artefact de simulation contre l ETAT REEL de Base Sepolia). Un encodage « qui a l air bon »
//    ne se detecte pas seul : il reverte APRES le gaz, sur un message qui ne parle pas d encodage.
//
// ⛔ ET LA SEQUENCE COMPTE AUTANT QUE LES OCTETS. Six transactions, dans cet ordre :
//    1. initialize            — cree la pool si elle n existe pas
//    2. approve(B20 -> Permit2)
//    3. approve(quote -> Permit2)
//    4. permit2.approve(B20, PositionManager)
//    5. permit2.approve(quote, PositionManager)
//    6. modifyLiquidities     — mint de la position
//    ⚠️ v4 REGLE PAR PERMIT2 : approuver le PositionManager ne suffit PAS. Il faut les DEUX
//       autorisations par jeton. Un seul des deux gestes et le mint reverte sur une erreur qui ne
//       parle jamais d autorisation.
import { keccak256 } from './keccak.js';

const enc = new TextEncoder();
const hexDe = (o) => [...o].map((b) => b.toString(16).padStart(2, '0')).join('');
export function selecteur(sig) { return hexDe(keccak256(enc.encode(sig))).slice(0, 8); }

const mot = (v) => BigInt(v).toString(16).padStart(64, '0');
/** ⛔ Un entier SIGNE se complete a deux sur 32 octets. Un tick negatif encode en non signe
 *  designerait une autre borne — et le revert ne parlerait pas de signe. */
const motSigne = (v) => { const b = BigInt(v); return (b < 0n ? (1n << 256n) + b : b).toString(16).padStart(64, '0'); };
const motAdr = (a) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0');
const dyn = (h) => { const n = h.length / 2; return mot(n) + h + '00'.repeat((32 - (n % 32)) % 32); };

/** PoolKey est une struct STATIQUE : ses 5 champs s inlinent, sans offset. */
const cleInline = (k) => motAdr(k.currency0) + motAdr(k.currency1) + mot(k.fee) + motSigne(k.tickSpacing) + motAdr(k.hooks);

export function encodeInitialize(cle, sqrtPriceX96) {
  return '0x' + selecteur('initialize((address,address,uint24,int24,address),uint160)')
    + cleInline(cle) + mot(sqrtPriceX96);
}

export function encodeApprove(spender, montant) {
  return '0x' + selecteur('approve(address,uint256)') + motAdr(spender) + mot(montant);
}

export function encodePermit2Approve(jeton, spender, montant, expiration) {
  return '0x' + selecteur('approve(address,address,uint160,uint48)')
    + motAdr(jeton) + motAdr(spender) + mot(montant) + mot(expiration);
}

/**
 * modifyLiquidities(bytes unlockData, uint256 deadline)
 *   unlockData = abi.encode(bytes actions, bytes[] params)
 *   params[0]  = (PoolKey, int24, int24, uint256, uint128, uint128, address, bytes)
 *   params[1]  = (Currency, Currency)
 * ⛔ MINT_POSITION = 0x02 et SETTLE_PAIR = 0x0d, relus dans Uniswap/v4-periphery Actions.sol.
 *    Une constante d action fausse ne plante pas proprement : elle execute UNE AUTRE action.
 */
export function encodeMintPosition({ cle, tickBas, tickHaut, liquidite, max0, max1, proprietaire, deadline }) {
  const actions = '020d';                        // MINT_POSITION, SETTLE_PAIR

  /* params[0] : 12 mots de tete (5 pour la PoolKey inline + 6 champs + 1 offset), puis hookData. */
  const p0 = cleInline(cle) + motSigne(tickBas) + motSigne(tickHaut) + mot(liquidite)
    + mot(max0) + mot(max1) + motAdr(proprietaire) + mot(0x180) + mot(0);
  const p1 = motAdr(cle.currency0) + motAdr(cle.currency1);

  const elements = [dyn(p0), dyn(p1)];
  let curseur = BigInt(32 * elements.length);
  const offsets = elements.map((e) => { const o = mot(curseur); curseur += BigInt(e.length / 2); return o; });
  const tableau = mot(elements.length) + offsets.join('') + elements.join('');

  const blocActions = dyn(actions);
  const unlock = mot(0x40) + mot(0x40 + blocActions.length / 2) + blocActions + tableau;

  return '0x' + selecteur('modifyLiquidities(bytes,uint256)') + mot(0x40) + mot(deadline) + dyn(unlock);
}

/** ⛔ L ordre des devises est IMPOSE par v4 : currency0 < currency1 PAR ADRESSE. L inverser
 *  designerait une AUTRE pool — qui n existe pas — et le mint reverterait sans parler d ordre. */
export function cleDePool(a, b, { fee = 3000, tickSpacing = 60, hooks = '0x0000000000000000000000000000000000000000' } = {}) {
  const [c0, c1] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
  return { currency0: c0, currency1: c1, fee, tickSpacing, hooks };
}

export const MAX_UINT256 = (1n << 256n) - 1n;
export const MAX_UINT160 = (1n << 160n) - 1n;
export const MAX_UINT48 = (1n << 48n) - 1n;
export const MAX_UINT128 = (1n << 128n) - 1n;
/** Prix 1:1 en unites BRUTES : sqrt(1) << 96. */
export const PRIX_1_POUR_1 = 79228162514264337593543950336n;
/** ⛔ Bornes alignees sur tickSpacing = 60. Une borne non alignee reverte sans parler d alignement. */
export const TICK_BAS = -887220, TICK_HAUT = 887220;

/** poolId = keccak256(abi.encode(PoolKey)). La PoolKey etant STATIQUE, c est exactement ses 5 mots. */
export function poolId(cle) {
  const h = cleInline(cle);
  return '0x' + hexDe(keccak256(Uint8Array.from(h.match(/../g).map((b) => parseInt(b, 16)))));
}

/** ⛔ Lit l etat REEL avant d agir : une etape deja faite ne doit pas etre refaite, et une etape
 *  manquante ne doit pas etre sautee. `appel` est injecte pour rester testable hors reseau. */
export async function etatPool({ appel, cle, jetons, proprietaire, posm, permit2, stateView }) {
  const motAdr2 = (a) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0');
  const lire = async (to, data) => { try { return await appel(to, data); } catch (e) { return { err: e.message }; } };

  const slot0 = await lire(stateView, '0x' + selecteur('getSlot0(bytes32)') + poolId(cle).slice(2));
  /* ⛔ sqrtPriceX96 == 0 signifie « pool non initialisee ». Une LECTURE ECHOUEE ne signifie PAS
   * cela — elle veut dire qu on ne sait pas, et les deux appellent des gestes differents. */
  const initialisee = slot0 && slot0.err ? null : BigInt('0x' + String(slot0).slice(2, 66)) !== 0n;

  const permissions = {};
  for (const j of jetons) {
    const a = await lire(j, '0x' + selecteur('allowance(address,address)') + motAdr2(proprietaire) + motAdr2(permit2));
    const p = await lire(permit2, '0x' + selecteur('allowance(address,address,address)')
      + motAdr2(proprietaire) + motAdr2(j) + motAdr2(posm));
    permissions[j.toLowerCase()] = {
      versPermit2: a && a.err ? { err: a.err } : BigInt(a),
      /* permit2.allowance rend (uint160 amount, uint48 expiration, uint48 nonce) : le montant est
       * le PREMIER mot, l expiration le deuxieme. Une autorisation EXPIREE vaut zero. */
      versPosm: p && p.err ? { err: p.err } : BigInt('0x' + String(p).slice(2, 66)),
      expiration: p && p.err ? null : BigInt('0x' + String(p).slice(66, 130)),
    };
  }
  return { initialisee, permissions };
}

/* ══ SWAP ══════════════════════════════════════════════════════════════════════════════════════
 * ⛔ CONSTANTES LUES A LA SOURCE (Uniswap/v4-periphery Actions.sol, universal-router Commands.sol),
 *    jamais recitees : SWAP_EXACT_IN_SINGLE 0x06 · SETTLE_ALL 0x0c · TAKE_ALL 0x0f · V4_SWAP 0x10.
 *    Recoupement utile : le meme fichier donne MINT_POSITION 0x02 et SETTLE_PAIR 0x0d, qui sont
 *    exactement ceux que la sequence de pool employait deja.
 *
 * ⛔ ET UNE INCERTITUDE QU ON NE TRANCHE PAS DE MEMOIRE. La struct ExactInputSingleParams de la
 *    branche `main` porte un champ `minHopPriceX36` entre `amountOutMinimum` et `hookData`. Le
 *    routeur DEPLOYE peut dater d avant. La source dit ce qui est ECRIT, pas ce qui TOURNE.
 *    ⇒ on encode les DEUX formes, et l appelant demande a la CHAINE laquelle elle accepte, par
 *      eth_call, avant de faire signer quoi que ce soit. */
export const AVEC_MINHOP = true, SANS_MINHOP = false;

export function encodeSwapExactInSingle({ cle, zeroForOne, montant, sortieMin, deadline, forme }) {
  /* ⛔ DEUX CORRECTIONS TROUVEES PAR BISSECTION SUR LA CHAINE, et elles se MASQUAIENT l une l autre.
   * 1. ExactInputSingleParams contient `bytes hookData` : c est une struct DYNAMIQUE, donc
   *    `abi.encode` la fait PRECEDER d un mot d offset. Il manquait.
   * 2. L offset de hookData compte TOUS les mots de tete, Y COMPRIS SON PROPRE MOT :
   *    PoolKey(5) + zeroForOne + amountIn + amountOutMinimum = 8 champs -> offset 0x120, pas 0x100.
   * ⚠️ Corriger UNE SEULE des deux ne changeait RIEN : le revert restait vide et identique. C est
   *    pourquoi quatre essais successifs semblaient dire la meme chose alors qu ils disaient
   *    seulement « il reste au moins une faute ».
   * ⚠️ Le Quoter, lui, marchait : QuoteExactSingleParams n a que 7 champs avant hookData, donc son
   *    offset 0x100 etait juste. Le meme nombre, correct ici, faux la-bas. */
  const champs = forme === AVEC_MINHOP ? 9 : 8;
  const tete = mot(0x20) + cleInline(cle) + mot(zeroForOne ? 1 : 0) + mot(montant) + mot(sortieMin)
    + (forme === AVEC_MINHOP ? mot(0) : '')
    + mot((champs + 1) * 32) + mot(0);

  const entree = zeroForOne ? cle.currency0 : cle.currency1;
  const sortie = zeroForOne ? cle.currency1 : cle.currency0;
  const elements = [dyn(tete), dyn(motAdr(entree) + mot(montant)), dyn(motAdr(sortie) + mot(sortieMin))];
  let curseur = BigInt(32 * elements.length);
  const offsets = elements.map((e) => { const o = mot(curseur); curseur += BigInt(e.length / 2); return o; });
  const tableau = mot(elements.length) + offsets.join('') + elements.join('');

  const actions = dyn('060c0f');
  const input0 = dyn(mot(0x40) + mot(0x40 + actions.length / 2) + actions + tableau);
  const commands = dyn('10');
  const offCommands = 0x60n, offInputs = offCommands + BigInt(commands.length / 2);
  return '0x' + selecteur('execute(bytes,bytes[],uint256)')
    + mot(offCommands) + mot(offInputs) + mot(deadline) + commands + mot(1) + mot(0x20) + input0;
}

/** Quote read-only : ne signe rien, ne coute rien. */
export function encodeQuote({ cle, zeroForOne, montant }) {
  return '0x' + selecteur('quoteExactInputSingle(((address,address,uint24,int24,address),bool,uint128,bytes))')
    + mot(0x20) + cleInline(cle) + mot(zeroForOne ? 1 : 0) + mot(montant) + mot(0x100) + mot(0);
}

/**
 * ⛔ DEMANDE A LA CHAINE quelle forme de struct le routeur accepte, par eth_call, AVANT toute
 *    signature. Rend la forme acceptee, ou null avec la cause — jamais une supposition.
 * ⚠️ Un eth_call qui reverte pour une AUTRE raison (autorisation manquante, solde) fait echouer
 *    les deux formes a l identique : dans ce cas on rend `null` et on le DIT, au lieu de choisir
 *    au hasard celle qui « semble » bonne.
 */
export async function formeAcceptee({ appelBrut, ur, de, cle, zeroForOne, montant, deadline }) {
  const causes = {};
  for (const forme of [AVEC_MINHOP, SANS_MINHOP]) {
    const data = encodeSwapExactInSingle({ cle, zeroForOne, montant, sortieMin: 0n, deadline, forme });
    const r = await appelBrut({ from: de, to: ur, data });
    if (!r.error) return { forme, causes };
    causes[forme ? 'avecMinHop' : 'sansMinHop'] = (r.error.message || '') + (r.error.data ? ' data=' + r.error.data : '');
  }
  return { forme: null, causes };
}

/**
 * Racine carree entiere d un BigInt (methode de Newton).
 * ⛔ PAS DE FLOTTANT ICI. `Math.sqrt` sur un nombre au-dela de 2^53 perd des bits, et le
 *    resultat sert a fixer le prix d une pool — une valeur qu on n a pas le droit de reviser.
 */
export function isqrt(n) {
  if (n < 0n) throw new Error('isqrt d un negatif');
  if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}

/**
 * sqrtPriceX96 pour un prix EXPRIME EN JETONS ENTIERS, decimales comprises.
 *
 * ⛔ NE PAS UTILISER `PRIX_1_POUR_1` SUR UNE PAIRE DONT LES DECIMALES DIFFERENT. Cette constante
 *    vaut 2^96, soit un ratio 1:1 d UNITES DE BASE. Mesure du 2026-09-04 : avec une devise a 6
 *    decimales (USDC) face a un block a 18, elle signifie 1 USDC = 1 000 000 000 000 blocks —
 *    une supply de 1e9 y vaudrait 0,001 USDC, et n importe qui racheterait tout le token pour un
 *    dixieme de centime. Le prix d une pool ne se reinitialise pas.
 *
 * @param {object} p
 * @param {bigint} p.prixNum  numerateur du prix : combien d unites de DEVISE pour…
 * @param {bigint} p.prixDen  …`prixDen` jetons entiers de BLOCK. (une fraction, donc exacte)
 * @param {number} p.decDevise  decimales de la devise, LUES sur la chaine
 * @param {number} p.decBlock   decimales du block
 * @param {boolean} p.deviseEst0  la devise est-elle currency0 (adresse la plus basse) ?
 */
export function sqrtPriceDepuisPrix({ prixNum, prixDen, decDevise, decBlock, deviseEst0 }) {
  const n = BigInt(prixNum), d = BigInt(prixDen);
  if (n <= 0n || d <= 0n) throw new Error('prix nul ou negatif');
  /* Le pool raisonne en UNITES DE BASE : ratio = currency1 / currency0.
   * devise = currency0 -> 1 unite de devise vaut (d/n) blocks, corrige des decimales. */
  const eB = 10n ** BigInt(decBlock), eD = 10n ** BigInt(decDevise);
  const num = deviseEst0 ? d * eB : n * eD;
  const den = deviseEst0 ? n * eD : d * eB;
  /* sqrt(num/den) * 2^96 = sqrt(num * 2^192 / den) — tout en entiers. */
  return isqrt((num << 192n) / den);
}

/** sqrtPriceX96 aux bornes de la pleine etendue. ⛔ Valeurs du protocole, pas calculees ici :
 *  TickMath.MIN_SQRT_PRICE et MAX_SQRT_PRICE. Les recalculer introduirait un arrondi la ou
 *  Uniswap utilise des constantes exactes. */
export const SQRT_MIN = 4295128739n;
export const SQRT_MAX = 1461446703485210103287273052203988822378723970342n;

/**
 * Les MONTANTS DE JETONS qu une position pleine etendue exige, pour une liquidite L donnee.
 *
 * ⛔ `L` N EST PAS UN MONTANT DE JETONS, ET LES CONFONDRE COUTE TOUT LE SOLDE.
 *    L app comparait le solde de l utilisateur a `L` directement. A un prix de 1, `amount0` et
 *    `amount1` valent tous deux ≈ L — c est pourquoi la garde semblait juste sur Sepolia, ou la
 *    paire etait a 1:1. Elle etait correcte PAR ACCIDENT.
 *    Mesure du 2026-09-04, au prix 1 block = 1e-5 WETH, pour L = 1e15 :
 *      WETH exige   3 162 277 660 168        soit L x 0,0032
 *      block exige  316 227 766 016 837 933  soit L x 316
 *    L etape d enveloppe aurait donc converti 316 fois trop d ETH — tout le solde, pour rien.
 *
 * ⚠️ Formule standard, position couvrant [Pa, Pb] avec le prix courant DEDANS :
 *      amount0 = L * (√Pb − √P) / (√P · √Pb)      amount1 = L * (√P − √Pa)
 *    en virgule fixe X96. Hors de l intervalle elle ne vaut plus — ici l intervalle est la
 *    pleine etendue, donc le prix y est toujours.
 */
export function montantsPourLiquidite(L, sqrtP, sqrtMin = SQRT_MIN, sqrtMax = SQRT_MAX) {
  const l = BigInt(L), p = BigInt(sqrtP);
  if (l < 0n) throw new Error('liquidite negative');
  if (p <= sqrtMin || p >= sqrtMax) throw new Error('prix hors des bornes de la pleine etendue');
  const Q96 = 2n ** 96n;
  return {
    montant0: (l * Q96 * (sqrtMax - p)) / (p * sqrtMax),
    montant1: (l * (p - sqrtMin)) / Q96,
  };
}
