// consentement.js — se souvenir du consentement mainnet SANS le diluer.
// ================================================================================================
// ⛔ CE QU ON CHANGE, ET LA RAISON QU ON CONTREDIT. La page reinitialisait la case a chaque
//    changement de reseau, avec un commentaire explicite : « un retour sur Sepolia puis sur
//    mainnet ne doit pas retrouver un consentement donne pour une autre session d attention ».
//    C etait une bonne raison. La demande — ne plus cocher a chaque visite — la contredit
//    frontalement, et on ne contredit pas une garde documentee en silence.
//
// ⛔ LES DEUX SE CONCILIENT A TROIS CONDITIONS, ET CHACUNE EST TESTEE :
//      1. le consentement est lie AU COMPTE. Un autre wallet est une autre decision — sans ca,
//         cocher une fois vaudrait pour tous les comptes connectes ensuite sur cette machine,
//         y compris celui d un tiers.
//      2. il EXPIRE au bout de 30 jours. Celui d il y a un an n en est plus un.
//      3. tout ce qui n est pas un consentement LU et VALIDE vaut refus : stockage indisponible,
//         donnee corrompue, pas de compte. On n invente jamais un « oui ».
//    Un « oui » qui survit a tout n est plus un consentement, c est une case decorative.
//
// ⚠️ CE QUE CA NE FAIT PAS : dispenser de la banniere. Le texte reste affiche ; c est la CASE qui
//    est pre-cochee pour un compte qui a deja accepte. Masquer l avertissement serait une autre
//    decision, bien plus lourde, et personne ne l a prise.

const CLE = 'tblock.consentement.mainnet';
const JOURS = 30;

/** Vrai seulement si CE compte a consenti, il y a moins de 30 jours, et qu on a pu le LIRE. */
export function consentementValide({ stockage, compte, maintenant = new Date() }) {
  if (!compte || typeof compte !== 'string') return false;
  let brut = null;
  /* ⛔ `localStorage` LEVE en navigation privee, cookies bloques, ou quota plein. Un catch qui
   * rendrait `true` inventerait un consentement jamais donne — le motif « un retour neutre avale
   * un echec », applique a la pire chose possible. */
  try { brut = stockage.getItem(CLE); } catch { return false; }
  if (!brut) return false;
  let doc = null;
  /* ⛔ N IMPORTE QUI PEUT ECRIRE N IMPORTE QUOI DANS `localStorage`. Un JSON illisible, un champ
   * manquant ou une date absurde doivent REDEMANDER, jamais accorder. */
  try { doc = JSON.parse(brut); } catch { return false; }
  if (!doc || typeof doc !== 'object' || typeof doc.compte !== 'string' || typeof doc.le !== 'string') return false;
  /* ⛔ COMPARAISON EN MINUSCULES : les wallets rendent l adresse tantot en EIP-55, tantot non.
   * Comparer brut redemanderait au hasard des sessions — un agacement qui apprend a cliquer sans
   * lire, exactement ce que la banniere cherche a eviter. */
  if (doc.compte.toLowerCase() !== compte.toLowerCase()) return false;
  const quand = new Date(doc.le);
  if (Number.isNaN(quand.getTime())) return false;
  const jours = (maintenant.getTime() - quand.getTime()) / 86400000;
  /* ⛔ Une date dans le FUTUR est une donnee corrompue, pas un consentement tres frais. */
  if (jours < 0) return false;
  return jours <= JOURS;
}

/** Enregistre le consentement de CE compte. ⚠️ Ne leve jamais : un stockage refuse n est pas une panne. */
export function marquerConsentement({ stockage, compte, maintenant = new Date() }) {
  if (!compte) return;
  try {
    stockage.setItem(CLE, JSON.stringify({ compte: String(compte).toLowerCase(), le: maintenant.toISOString() }));
  } catch { /* ⚠️ silencieux ET sans consequence : la case restera simplement a cocher. */ }
}
