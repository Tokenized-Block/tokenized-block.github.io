// deplacer-vers-org.mjs — deplace l app vers une organisation et REECRIT toutes les URL absolues.
// ================================================================================================
//   node deplacer-vers-org.mjs <nom-org>
//
// ⛔ POURQUOI UN SCRIPT ET PAS TROIS COMMANDES A LA MAIN. Le domaine apparait dans SEPT endroits :
//    le manifeste (5 URL), les deux balises d apercu (4 URL chacune), les balises og:, et deux
//    README. En oublier un donne une mini app dont l apercu pointe un domaine mort — et l apercu
//    est justement ce que les gens voient AVANT de cliquer. Le seul defaut visible serait
//    l absence d image, sans aucun message.
//
// ⛔ ET IL NE FAIT RIEN AVANT D AVOIR VERIFIE. L organisation doit exister, le depot cible ne doit
//    pas deja etre pris. Un transfert vers une org inexistante echoue proprement ; un transfert
//    par-dessus un depot existant, non.
//
// ⚠️ APRES LE DEPLACEMENT, l accountAssociation du manifeste devient INVALIDE si elle avait ete
//    signee : elle signe un DOMAINE. C est pourquoi elle doit etre generee APRES, jamais avant.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const org = process.argv[2];
if (!org || !/^[a-zA-Z0-9-]+$/.test(org)) {
  console.error('usage : node deplacer-vers-org.mjs <nom-org>');
  process.exit(1);
}
const nouveauDepot = org.toLowerCase() + '.github.io';
const ANCIEN = 'https://philpof102-svg.github.io/TokenizedBlock';
const NOUVEAU = 'https://' + org.toLowerCase() + '.github.io';

const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const peut = (c) => { try { return sh(c); } catch { return null; } };

console.log('cible : ' + org + '/' + nouveauDepot + '  ->  ' + NOUVEAU + '/');

/* ── 1. verifications AVANT toute ecriture ────────────────────────────────────────────────── */
console.log('\n1. verifications');
const existeOrg = peut('gh api orgs/' + org + ' --jq .login');
if (!existeOrg) { console.error('  ⛔ organisation « ' + org + ' » introuvable, ou jeton sans acces. Rien fait.'); process.exit(1); }
console.log('  OK  organisation trouvee : ' + existeOrg);
if (peut('gh api repos/' + org + '/' + nouveauDepot + ' --jq .name')) {
  console.error('  ⛔ ' + org + '/' + nouveauDepot + ' EXISTE DEJA. Rien fait — on n ecrase pas.');
  process.exit(1);
}
console.log('  OK  le nom cible est libre');

/* ── 2. reecriture des URL, AVANT le transfert ────────────────────────────────────────────── */
console.log('\n2. reecriture des URL absolues');
const fichiers = ['index.html', '.well-known/farcaster.json', 'README.md', 'MINI-APP.md'];
let total = 0;
/* ⛔ DEUX FORMES, PAS UNE. Le domaine apparait avec son chemin (`…github.io/TokenizedBlock`) mais
 * AUSSI nu, dans une phrase de prose (« points at `philpof102-svg.github.io` »). Ne remplacer que
 * la forme longue laissait une reference morte que le controle final a attrapee — il a REFUSE de
 * transferer, ce pour quoi il existe. */
const ANCIEN_NU = 'philpof102-svg.github.io';
const NOUVEAU_NU = org.toLowerCase() + '.github.io';
for (const f of fichiers) {
  if (!existsSync(f)) { console.log('  (absent) ' + f); continue; }
  const avant = readFileSync(f, 'utf8');
  const apres = avant.split(ANCIEN).join(NOUVEAU).split(ANCIEN_NU).join(NOUVEAU_NU);
  const n = (avant.length - apres.length) / (ANCIEN.length - NOUVEAU.length) || 0;
  if (apres !== avant) { writeFileSync(f, apres); total += 1; }
  console.log('  ' + (apres !== avant ? 'reecrit  ' : 'inchange ') + f);
}
/* ⛔ Un fichier inchange n est pas forcement une erreur, mais ZERO fichier reecrit en est une :
 * cela voudrait dire que l ancienne URL n apparait nulle part, donc que ce script ne sert a rien
 * et que quelque chose a deja change ailleurs. */
if (total === 0) { console.error('  ⛔ AUCUN fichier reecrit — l ancienne URL est introuvable. Arret.'); process.exit(1); }
const reste = fichiers.filter((f) => existsSync(f) && readFileSync(f, 'utf8').includes('philpof102-svg.github.io'));
if (reste.length) { console.error('  ⛔ ancienne URL encore presente dans : ' + reste.join(', ')); process.exit(1); }
console.log('  OK  plus aucune occurrence de l ancien domaine');

/* ── 3. commit, transfert, renommage ──────────────────────────────────────────────────────── */
console.log('\n3. commit et transfert');
sh('git add -A');
try { sh('git commit -q -m "Move to ' + NOUVEAU + '"'); } catch { console.log('  (rien a commiter)'); }
sh('git push -q origin main');
console.log('  OK  pousse sur l ancien remote');

sh('gh api -X POST repos/philpof102-svg/TokenizedBlock/transfer -f new_owner=' + org);
console.log('  OK  transfere vers ' + org);
sh('gh api -X PATCH repos/' + org + '/TokenizedBlock -f name=' + nouveauDepot);
console.log('  OK  renomme en ' + nouveauDepot);
sh('git remote set-url origin https://github.com/' + org + '/' + nouveauDepot + '.git');

/* ── 4. Pages, puis VERIFICATION sur l URL publique ───────────────────────────────────────── */
console.log('\n4. Pages');
peut('gh api -X POST repos/' + org + '/' + nouveauDepot + '/pages -f "source[branch]=main" -f "source[path]=/"');
for (let i = 0; i < 12; i++) {
  const s = peut('gh api repos/' + org + '/' + nouveauDepot + '/pages --jq .status');
  console.log('  status=' + s);
  if (s === 'built') break;
  execSync('powershell -NoProfile -Command "Start-Sleep -Seconds 15"');
}

console.log('\n5. ⛔ verification sur l URL PUBLIQUE (on ne croit pas le status)');
let echecs = 0;
for (const p of ['', 'index.html', 'icon.png', 'splash.png', 'embed.png', '.well-known/farcaster.json']) {
  const code = peut('curl -s -m 20 -o /dev/null -w "%{http_code}" ' + NOUVEAU + '/' + p);
  const ok = code === '200';
  if (!ok) echecs += 1;
  console.log('  ' + (ok ? 'OK  ' : '⛔  ') + code + '  ' + NOUVEAU + '/' + p);
}
console.log('');
if (echecs) { console.error('⛔ ' + echecs + ' ressource(s) non servie(s)'); process.exit(1); }
console.log('✅ ' + NOUVEAU + '/ sert tout.');
console.log('⚠️ Il reste a generer accountAssociation SUR CE DOMAINE — voir MINI-APP.md.');
