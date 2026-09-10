// logo.js — LE dessin d un block. Un seul, partage par tous les ecrans.
// ================================================================================================
// ⛔⛔ CE FICHIER EST DEPLACE DEPUIS `index.html`, PAS REECRIT. Le dessin part dans le
//    `contractURI`, qui est GRAVE : mesure du 2026-09-06, `updateContractURI` est refuse au
//    createur, aux tiers ET au jeton lui-meme. Une seule difference de caractere ici et les blocks
//    crees demain ne ressembleraient plus a ceux d hier, sans aucun moyen de revenir en arriere.
//
// ⇒ `test-logo.mjs` compare le rendu de ce module a une REFERENCE figee, sur un large echantillon
//   de reglages. Ce n est pas une precaution de style : c est ce qui rend le deplacement sur.
//
// ⛔ POURQUOI LE DEPLACER. La map de `app.html` dessinait ses propres cubes, parce que `logoSvg`
//    vivait dans une balise `<script>` et n etait donc importable par personne. Deux dessins pour
//    le meme block, c est deux identites pour une seule chose — et celui qu on maintient le moins
//    finit par contredire l autre. Phil l a dit autrement : « prends tes exemples de creation qui
//    existaient deja et mets-les sur la map ».
//
// ⚠️ FONCTION PURE : aucun DOM, aucun reseau, aucune horloge. Le meme objet de reglages rend
//    TOUJOURS exactement le meme texte SVG — c est ce qui permet de le graver.

/** Les reglages de logo derives d une apparence deterministe (voir `apparence.js`). */
export function paramsLogoDepuisApparence(a, lettre) {
  return {
    teinte: a.teinte, accent: a.accent, division: a.division, eclats: a.eclats,
    orbite: a.orbite, facette: a.facette, matiere: a.matiere, ornement: a.ornement,
    ecart: a.ecart, lettre: (lettre || 'T').toUpperCase().slice(0, 1),
    photoOu: 'aucune', photo: null,
  };
}

export function logoSvg(o) {
  const h = Number(o.teinte), ha = Number(o.accent);
  const n = Math.max(1, Math.min(5, Number(o.division) || 3));
  const eclats = Math.max(0, Math.min(6, Number(o.eclats) ?? 3));
  const c = (s, l, a = 1) => `hsl(${h} ${s}% ${l}%${a < 1 ? ' / ' + a : ''})`;
  const ca = (s, l) => `hsl(${ha} ${s}% ${l}%)`;
  const L = (o.lettre || 'T').toUpperCase().slice(0, 1);

  /* La grille suit la division : n = 1 ne trace rien, n = 5 decoupe finement. */
  let grille = '';
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = (ax, ay, bx, by) => `${ax + (bx - ax) * t} ${ay + (by - ay) * t}`;
    grille += `M${p(100, 30, 30, 70)} L${p(170, 70, 100, 110)}`
      + `M${p(100, 30, 170, 70)} L${p(30, 70, 100, 110)}`
      + `M${p(30, 70, 30, 150)} L${p(100, 110, 100, 190)}`
      + `M${p(30, 70, 100, 110)} L${p(30, 150, 100, 190)}`
      + `M${p(170, 70, 170, 150)} L${p(100, 110, 100, 190)}`
      + `M${p(170, 70, 100, 110)} L${p(170, 150, 100, 190)}`;
  }

  /* ⛔ Le motif de face est un CHOIX, pas une lettre imposee : un symbole de plus d une lettre,
   * ou aucun, doit rester representable. */
  const motif = (m, f) => {
    if (o.facette === 'vide') return '';
    /* ⛔ TOUT EST DESSINE, RIEN N EST IMPORTE. Chaque motif est une forme geometrique tracee ici :
     *    aucun asset tiers, donc aucune licence a verifier — et c est la seule politique tenable,
     *    puisque l image est GRAVEE et que personne ne peut la changer ensuite. Une licence mal lue
     *    serait la seule erreur irreversible du projet. */
    const d = { anneau: `<circle r="17" fill="none" stroke="${f}" stroke-width="9"/>`,
      barres: `<g fill="${f}"><rect x="-19" y="-17" width="38" height="9" rx="2"/>`
        + `<rect x="-19" y="-4" width="38" height="9" rx="2"/><rect x="-19" y="9" width="38" height="9" rx="2"/></g>`,
      disque: `<circle r="18" fill="${f}"/>`,
      croix: `<g fill="${f}"><rect x="-6" y="-20" width="12" height="40" rx="3"/>`
        + `<rect x="-20" y="-6" width="40" height="12" rx="3"/></g>`,
      losange: `<path d="M0-20 20 0 0 20-20 0Z" fill="none" stroke="${f}" stroke-width="8" stroke-linejoin="round"/>`,
      triangle: `<path d="M0-19 19 15-19 15Z" fill="${f}"/>`,
      points: `<g fill="${f}">` + [-13, 0, 13].map((y) => [-13, 0, 13].map((x) =>
        `<circle cx="${x}" cy="${y}" r="4"/>`).join('')).join('') + `</g>`,
      chevrons: `<g fill="none" stroke="${f}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">`
        + `<path d="M-15-14 0-2-15 10"/><path d="M2-14 17-2 2 10"/></g>`,
      cible: `<g fill="none" stroke="${f}"><circle r="19" stroke-width="6"/><circle r="8" stroke-width="6"/></g>`,
      etoile: `<path d="M0-21 6-7 21-7 9 2 14 17 0 8-14 17-9 2-21-7-6-7Z" fill="${f}"/>`,
      eclair: `<path d="M4-21-14 3H-2L-4 21 14-4H2Z" fill="${f}"/>`,
      hexagone: `<path d="M0-20 17-10 17 10 0 20-17 10-17-10Z" fill="none" stroke="${f}" stroke-width="7" stroke-linejoin="round"/>`,
      coche: `<path d="M-17 1 -5 13 18-13" fill="none" stroke="${f}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
      cle: `<g fill="${f}"><circle cx="-8" cy="0" r="11"/><rect x="0" y="-4" width="21" height="8" rx="2"/>`
        + `<rect x="12" y="0" width="6" height="9" rx="2"/></g>`,
      vague: `<path d="M-19-6q9-11 19 0t19 0M-19 8q9-11 19 0t19 0" fill="none" stroke="${f}" stroke-width="6" stroke-linecap="round"/>`,
      grille: `<g fill="none" stroke="${f}" stroke-width="5" stroke-linecap="round">`
        + `<path d="M-18-7H18M-18 7H18M-7-18V18M7-18V18"/></g>`,
      fleche: `<path d="M0-20 0 20M-12-8 0-20 12-8" fill="none" stroke="${f}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
    }[o.facette];
    return `<g transform="matrix(${m})">`
      + (d || `<text x="0" y="14" font-family="ui-sans-serif,sans-serif" font-size="46" font-weight="800" text-anchor="middle" fill="${f}">${L}</text>`)
      + `</g>`;
  };

  /* Les eclats : le meme cube, plus petit, qui s eloigne. Zero est un etat valide.
   * ⚠️ Chaque disposition est PURE et deterministe : le meme choix rend toujours le meme dessin.
   *    Un aleatoire, meme joli, rendrait le logo non reproductible — or il part dans les
   *    metadonnees, ou il est GRAVE. */
  const PLACES = {
    sillage: (i) => ({ x: 158 + i * 11, y: 34 - i * 11, s: 0.30 - i * 0.035, o: 1 - i * 0.13 }),
    couronne: (i, n) => { const a = Math.PI * (0.15 + 0.7 * (n === 1 ? 0.5 : i / (n - 1)));
      return { x: 100 - Math.cos(a) * 78, y: 44 - Math.sin(a) * 30, s: 0.26 - i * 0.012, o: 0.95 - i * 0.06 }; },
    essaim: (i) => { const a = (i * 137.5) * Math.PI / 180;
      const r = 74 + (i % 3) * 12;
      return { x: 100 + Math.cos(a) * r, y: 104 + Math.sin(a) * r * 0.62, s: 0.24 - (i % 3) * 0.04, o: 0.9 - i * 0.07 }; },
    chute: (i) => ({ x: 150 + i * 9, y: 150 + i * 12, s: 0.26 - i * 0.03, o: 0.92 - i * 0.12 }),
    coins: (i) => { const p = [[26, 26], [174, 26], [26, 196], [174, 196], [100, 14], [100, 208]][i % 6];
      return { x: p[0], y: p[1], s: 0.22 - (i > 3 ? 0.05 : 0), o: 0.9 }; },
    spirale: (i) => { const a = (i * 137.5) * Math.PI / 180, r = 46 + i * 15;
      return { x: 100 + Math.cos(a) * r, y: 104 + Math.sin(a) * r * 0.6, s: 0.30 - i * 0.03, o: 1 - i * 0.11 }; },
    colonne: (i) => ({ x: 100, y: 26 - i * 0, s: 0.20 - i * 0.02, o: 0.95 - i * 0.1,
      /* ⚠️ decale horizontalement en alternance, sinon les eclats se superposent EXACTEMENT et
       *    « 6 eclats » se dessine comme un seul — un reglage qui ne change rien a l ecran. */
      ...{ x: 100 + (i % 2 ? 26 : -26) * Math.ceil(i / 2) * 0.7, y: 30 + i * 4 } }),
    ailes: (i) => { const cote = i % 2 ? 1 : -1, rang = Math.floor(i / 2);
      return { x: 100 + cote * (58 + rang * 26), y: 96 + rang * 16, s: 0.26 - rang * 0.05, o: 0.95 - rang * 0.15 }; },
    ronde: (i, n) => { const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      return { x: 100 + Math.cos(a) * 80, y: 106 + Math.sin(a) * 52, s: 0.22, o: 0.92 }; },
    diagonale: (i) => ({ x: 22 + i * 28, y: 200 - i * 30, s: 0.24 - i * 0.02, o: 0.95 - i * 0.09 }),
  };
  const place = PLACES[o.orbite] || PLACES.sillage;
  /* ⛔ L ECART S APPLIQUE A UN SEUL ENDROIT : le vecteur qui va du CENTRE DU BLOC vers l eclat. */
  const ECARTS = [0.55, 0.78, 1, 1.28, 1.6];
  const k = ECARTS[Math.max(0, Math.min(4, Number(o.ecart) ?? 2))] ?? 1;
  let frag = '';
  for (let i = 0; i < eclats; i++) {
    const p0 = place(i, eclats);
    const dans = (v, min, max) => Math.max(min, Math.min(max, v));
    const p = k === 1 ? p0 : { ...p0,
      x: dans(100 + (p0.x - 100) * k, 12, 188),
      y: dans(104 + (p0.y - 104) * k, 12, 208) };
    const s = p.s, x = p.x, y = p.y;
    frag += `<g transform="translate(${x.toFixed(1)} ${Math.max(4, y).toFixed(1)}) scale(${Math.max(0.08, s).toFixed(3)})" opacity="${Math.max(0.15, p.o).toFixed(2)}">`
      + `<path d="M0-40 46-13 0 13-46-13Z" fill="${c(70, 62)}"/>`
      + `<path d="M-46-13 0 13 0 66-46 40Z" fill="${c(75, 44)}"/>`
      + `<path d="M46-13 0 13 0 66 46 40Z" fill="${c(78, 32)}"/>`
      + `<path d="M0-40 46-13 46 40 0 66-46 40-46-13Z" fill="none" stroke="${ca(90, 72)}" stroke-width="5" stroke-linejoin="round"/></g>`;
  }

  /* ⛔ L IDENTIFIANT DU clipPath NE DEPEND QUE DE LA FACE, ET C EST VOULU : la collision entre deux
   * blocks qui utilisent la meme face est INOFFENSIVE (le decoupage est identique), tandis qu un
   * identifiant unique par rendu casserait la REPRODUCTIBILITE — or le SVG est GRAVE. */
  const FACES = {
    haut: { d: 'M100 30 170 70 100 110 30 70Z', x: 30, y: 30, w: 140, h: 80 },
    gauche: { d: 'M30 70 100 110 100 190 30 150Z', x: 30, y: 70, w: 70, h: 120 },
    droite: { d: 'M170 70 100 110 100 190 170 150Z', x: 100, y: 70, w: 70, h: 120 },
  };
  const face = FACES[o.photoOu];
  const photo = typeof o.photo === 'string' && o.photo.startsWith('data:image/') ? o.photo : null;
  const surFace = face && photo
    ? `<clipPath id="tbf-${o.photoOu}"><path d="${face.d}"/></clipPath>`
      + `<image href="${photo}" x="${face.x}" y="${face.y}" width="${face.w}" height="${face.h}"`
      + ` preserveAspectRatio="xMidYMid slice" clip-path="url(#tbf-${o.photoOu})"/>`
      + `<path d="${face.d}" fill="none" stroke="${ca(90, 70)}" stroke-width="2" stroke-linejoin="round" opacity=".9"/>`
    : '';

  /* ⛔ NOMMEE `COINS` ET PAS `ORNEMENTS`, ET LA VALEUR `motifCoin` ET PAS `motif` : il existe DEJA
   *    un `const motif` dans cette meme fonction. Deux `const` du meme nom dans la meme portee,
   *    c est une SyntaxError — la page entiere n aurait pas demarre. */
  const COINS = {
    aucun: '',
    points: '<circle cx="0" cy="0" r="5"/>',
    equerres: '<path d="M0 22 L0 0 L22 0" fill="none" stroke-width="5" stroke-linecap="round"/>',
    griffes: '<path d="M2 26 L2 2 L26 2" fill="none" stroke-width="4" stroke-linecap="round"/><circle cx="2" cy="2" r="3.5" stroke="none"/>',
    arcs: '<path d="M0 26 A26 26 0 0 1 26 0" fill="none" stroke-width="5" stroke-linecap="round"/>',
    croix: '<path d="M-8 0 H8 M0 -8 V8" fill="none" stroke-width="5" stroke-linecap="round"/>',
    chevrons: '<path d="M18 4 L4 4 L4 18" fill="none" stroke-width="5" stroke-linecap="round"/><path d="M26 12 L12 12 L12 26" fill="none" stroke-width="4" stroke-linecap="round" opacity="0.55"/>',
    etoiles: '<path d="M0-11 3-3 11 0 3 3 0 11-3 3-11 0-3-3Z"/>',
  };
  const motifCoin = COINS[o.ornement] ?? '';
  const coins = !motifCoin ? '' : '<g fill="' + ca(85, 66) + '" stroke="' + ca(85, 66) + '" opacity="0.85">'
    + [[16, 16, 1, 1], [184, 16, -1, 1], [16, 204, 1, -1], [184, 204, -1, -1]]
      .map(([x, y, sx, sy]) => `<g transform="translate(${x} ${y}) scale(${sx} ${sy})">${motifCoin}</g>`).join('')
    + '</g>';

  /* ⛔ ET LE DEFAUT DOIT RENDRE EXACTEMENT L ANCIEN DESSIN : les blocs deja graves ont ete crees
   *    sans ce champ, et leur logo ne doit pas se mettre a differer du jour ou on ajoute une
   *    option. Les valeurs de « verre » sont donc celles d avant, au chiffre pres.
   * ⚠️ `epInt` est ECRIT, PAS CALCULE : `ep * 0.87` donnait 1.31 la ou l original valait 1.3. */
  const MATIERES = {
    verre: { haut: c(75, 52, .72), gauche: c(78, 42, .68), droite: c(80, 30, .7), fond: c(80, 8),
      trait: '#eaf6ff', ep: 1.5, epInt: 1.3, lustre: true },
    plein: { haut: c(85, 58), gauche: c(88, 40), droite: c(90, 26), fond: c(70, 6),
      trait: '#0b1020', ep: 2, epInt: 1.6, lustre: false },
    /* ⛔ « fil » n a AUCUN remplissage : sans lustre, le cube serait recouvert d un voile blanc
     *    qui le rendrait plein — c est-a-dire exactement ce qu il n est pas. */
    fil: { haut: 'none', gauche: 'none', droite: 'none', fond: c(85, 5),
      trait: ca(92, 66), ep: 2, epInt: 1.6, lustre: false },
    neon: { haut: c(90, 14, .5), gauche: c(90, 10, .5), droite: c(90, 8, .5), fond: 'hsl(0 0% 4%)',
      trait: ca(100, 62), ep: 3, epInt: 2.2, lustre: false },
    papier: { haut: c(18, 92), gauche: c(20, 82), droite: c(22, 72), fond: c(15, 96),
      trait: c(45, 28), ep: 1.6, epInt: 1.2, lustre: false },
    encre: { haut: 'hsl(0 0% 96%)', gauche: 'hsl(0 0% 88%)', droite: 'hsl(0 0% 78%)', fond: 'hsl(0 0% 100%)',
      trait: 'hsl(0 0% 6%)', ep: 3.4, epInt: 2.4, lustre: false },
    chrome: { haut: c(6, 88), gauche: c(8, 62), droite: c(10, 40), fond: c(10, 12),
      trait: c(4, 98), ep: 2, epInt: 1.5, lustre: true },
    braise: { haut: c(95, 46), gauche: c(98, 26), droite: c(100, 16), fond: c(90, 4),
      trait: ca(100, 70), ep: 2.4, epInt: 1.8, lustre: false },
    givre: { haut: c(30, 78, .55), gauche: c(34, 66, .5), droite: c(38, 54, .5), fond: c(40, 14),
      trait: c(20, 96), ep: 1.4, epInt: 1.1, lustre: true },
  };
  const M = MATIERES[o.matiere] || MATIERES.verre;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220"><rect width="200" height="220" fill="${M.fond}"/>`
    + coins
    + `<path d="M100 30 170 70 100 110 30 70Z" fill="${M.haut}"/>`
    + `<path d="M30 70 100 110 100 190 30 150Z" fill="${M.gauche}"/>`
    + `<path d="M170 70 100 110 100 190 170 150Z" fill="${M.droite}"/>`
    + (grille ? `<path d="${grille}" fill="none" stroke="#cfe6ff" stroke-width="1" opacity=".32"/>` : '')
    /* ⛔ LA PHOTO REMPLACE LE MOTIF DE SA FACE, elle ne se pose pas DESSUS. */
    + (o.photoOu === 'haut' && surFace ? '' : motif('.866 .5 -.866 .5 100 70', ca(92, 56)))
    + (o.photoOu === 'gauche' && surFace ? '' : motif('.866 .5 0 1 65 130', ca(90, 48)))
    + (o.photoOu === 'droite' && surFace ? '' : motif('.866 -.5 0 1 135 130', ca(88, 38)))
    + surFace
    + (M.lustre ? `<path d="M100 30 170 70 100 110 30 70Z" fill="#fff" opacity=".10"/>` : '')
    + `<g fill="none" stroke="${M.trait}" stroke-width="${M.ep}" stroke-linejoin="round">`
    + `<path d="M100 30 170 70 170 150 100 190 30 150 30 70Z"/>`
    + `<path d="M100 110 30 70 M100 110 170 70 M100 110 100 190" stroke-width="${M.epInt}" opacity=".85"/></g>`
    + frag + `</svg>`;
}
