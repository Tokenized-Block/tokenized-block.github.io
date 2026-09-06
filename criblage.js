// criblage.js — cribler une adresse contre une liste publique, DANS LE NAVIGATEUR.
// ================================================================================================
// ⛔ POURQUOI LOCALEMENT, ET PAS PAR UN SERVICE. BIII est un serveur MCP qui rend ce verdict, mais
//    sa puissance n est pas le serveur : c est la DONNEE — `data/known-bad.json`, 812 adresses,
//    41 Ko, batie depuis OFAC SDN, le sous-ensemble malveillant d eth-labels, et les trouvailles
//    forensiques de MainStreet. Une donnee de cette taille voyage. On l embarque.
//    ⇒ Aucun appel reseau, et surtout : L ADRESSE DE L UTILISATEUR N EST ENVOYEE A PERSONNE.
//      Un criblage qui interrogerait un serveur transformerait une verification en collecte, et
//      cette page est justement vendue sur le fait qu elle ne detient et n envoie rien.
//
// ⛔ CE QU IL PEUT DIRE, ET CE QU IL NE PEUT PAS. Il repond a « cette adresse figure-t-elle dans
//    une liste publique de comptes signales ? ». Il ne repond PAS a « est-elle sure ». Figurer sur
//    la liste OFAC est un FAIT ; ne pas y figurer ne dit RIEN — la liste est finie, le monde ne
//    l est pas. Presenter l absence comme une innocence donnerait une garantie a des gens qui
//    prendraient un risque en la croyant. Le mot « sur » ne sort d ici sous aucune forme.
//
// ⛔ ET IL NE NOMME PERSONNE. Il rapporte une APPARTENANCE A UNE LISTE et sa SOURCE, jamais une
//    intention. « Cette adresse figure sur la liste OFAC » est une structure ; « cette personne
//    est un criminel » est une inference, et on n en fait pas.

/**
 * @param {string} adresse   l adresse a cribler
 * @param {object|null} jeu  le jeu de donnees embarque ({ asOf, sources, addresses })
 * @param {Date} [maintenant] injecte pour rendre l age testable sans dependre de l horloge
 */
export function cribler(adresse, jeu, maintenant = new Date()) {
  /* ⛔ UNE ADRESSE MALFORMEE EST REFUSEE, PAS TRAITEE COMME ABSENTE. Sinon une faute de frappe
   * rendrait un resultat rassurant produit par une question qui n a jamais ete posee — le motif
   * « un retour neutre avale un echec », le plus repete de ce depot. */
  if (typeof adresse !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(adresse)) {
    return { etat: 'ADRESSE_INVALIDE' };
  }
  /* ⛔ SANS DONNEES, ON NE CONCLUT PAS. Un jeu vide rendrait tout le monde « absent » : un
   * criblage qui ne crible rien et rassure tout le monde. */
  if (!jeu || !Array.isArray(jeu.addresses) || jeu.addresses.length === 0) {
    return { etat: 'PAS_DE_DONNEES' };
  }
  const asOf = jeu.asOf || null;
  /* ⚠️ L AGE EST RENDU POUR QUE L ECRAN PUISSE LE DIRE. Une liste perimee presentee comme
   * autoritaire est pire que pas de liste : elle donne une confiance que rien ne soutient. */
  const ageJours = asOf ? Math.floor((maintenant - new Date(asOf)) / 86400000) : null;
  /* ⛔ COMPARAISON EN MINUSCULES. Les adresses circulent en casse mixte (EIP-55) ; comparer brut
   * laisserait passer la MEME adresse ecrite autrement — un criblage qu on contourne en changeant
   * une majuscule. */
  const cherchee = adresse.toLowerCase();
  const trouvee = jeu.addresses.some((a) => String(a).toLowerCase() === cherchee);
  return trouvee
    ? { etat: 'SIGNALEE', sources: jeu.sources || [], asOf, ageJours }
    /* ⛔ « ABSENTE », jamais « SURE ». Le nom de l etat est la premiere chose qu on lira. */
    : { etat: 'ABSENTE', sources: jeu.sources || [], asOf, ageJours };
}
