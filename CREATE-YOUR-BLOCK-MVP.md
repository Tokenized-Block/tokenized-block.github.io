# Create-your-block — Zero 1 lead (2026-09-07, Europe/Brussels)

## Goal (honest)
Ship an app where **anyone creates their own Block** (B-20 Instant Create → Launch).  
Target **€10k/mo** is a **product ambition**, not a measured metric. METHODE: do not invent ARR/MRR until dated wallet+ledger evidence exists.

## What pays (attack flattering “creators = revenue”)
People creating free Practice blocks **does not** pay Tokenized Block. **Custody:** still none.

**Shipped 2026-09-07 overnight (subscription recovery, not gas):**
- **Real Create** → separate visible **0.001 ETH** Tokenized Block service fee to
  `0x37eb9b7ce0b51fe12fbf092026e001918128580a` **before** Create calldata. Fail-closed if transfer fails.
- **Practice Create** → **0** Tokenized Block fee.
- **Network gas** always → Base validators/builders — **cannot** be redirected to the fee wallet. Disclose loudly; never market the service fee as “gas”.

Honest further monetization candidates (pick later with evidence, not hope):
1. **Hosted Block skin** — creator pays for branded OpenLaunch `tokenized-block` config + Instant template hosting (SaaS / month).
2. **Distribution** — Base / Farcaster mini-app placement once accountAssociation works (traffic, not cash by itself). **Never invent accountAssociation.**
3. **Creator CRM `/me`** — collect/share deep links, optional paid tier (after Core CRM exists).
4. **Not in scope** — inventing trust scores, taking LP fees, admin keys, fictional “10k already”.

## Shipped locally (dated)
- **2026-09-07** — `feat/instant-create-handoff` @ `e6d3373` on `tokenized-block.github.io` clone:
  - Name/Symbol primary; photo behind disclosure
  - Auto find-free salt on `TokenAlreadyExists`
  - Post-create Launch/LP/Swap prefill + unilateral Launch CTA
- Live site still on older `main` until GitHub push (no `gh` auth on box).

## Next concrete build (this week)
1. Push Instant Create to GitHub → Pages live.
2. Practice-network Instant path verified **with a wallet** (METHODE trap #7).
3. One monetization spike only after Instant is live: Block skin subscribe stub OR mini-app association — not both.
4. OpenLaunch Instant Create UX stays **Zero 1 lead**; Grok Super = console UX hors Instant Create.

## Success criteria (no vanity)
- A stranger can Create + Launch a Practice block without opening Advanced.
- Chain re-read confirms address (not tx-success inference).
- Zero undated revenue claims in README or marketing.


## Dig-adapt Instant Create (2026-09-07, Europe/Brussels)

Shipped on branch `feat/instant-dig-adapt` (this repo):

1. **P11** — status funnel strip on simple Instant Create path.
2. **P1/P4** — Create CTA packet: network + irreversibility + pointer to What you will sign.
3. **P2** — post-create re-read max 3; repeated empty fingerprint → Blocked.
4. README dig-adapted UX notes; METHODE unchanged (no invented revenue).

Still required for honesty: Practice Instant path verified **with a wallet** (trap #7).

