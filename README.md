# Tokenized Block

Build a block — name, symbol, decimals, supply, description, colour — and it becomes a **B-20
native token on Base**.

The block is created **with no administrator and no minter**: no account holds `DEFAULT_ADMIN_ROLE`
or `MINT_ROLE`, at any point, including at creation. Its supply is minted in the creation
transaction itself and equals the supply cap, so no further unit can ever exist. Nobody — the
creator included — can mint more, or change its name, logo or description.

## What this page does, and what it does not

- It **presents** transactions. Your wallet shows them and signs them.
- It **holds no key**, sends nothing on your behalf, and has no backend.
- Every state it shows is **re-read from the chain** — never inferred from a transaction having
  been broadcast. A green result means a receipt with status `0x1` was read back.

## Verified on Base Sepolia

| what | evidence |
|---|---|
| the creation calldata is canonical | byte-for-byte identical to what `forge` produces via `B20FactoryLib` |
| a B-20 can hold liquidity in a Uniswap v4 pool | positions `27264` / `27265` |
| that pool quotes, both ways | measured curve, 0.3001 % → 83.34 % |
| that pool is tradeable | tx `0x2f952a47…d00ff` — the quote was exact **to the unit** |

Nothing above has been done on Base **mainnet**.

## Running it locally

Static files, no build step, no dependencies. Any static server works:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

⚠️ A wallet's built-in browser on Android refuses plain HTTP (`ERR_CLEARTEXT_NOT_PERMITTED`). Use
the hosted HTTPS page for mobile wallets, or a desktop browser with a wallet extension for local
runs.

## Files

`index.html` the app · `encodeur.js` B-20 creation calldata · `pool.js` Uniswap v4 liquidity and
swap · `lecteur.js` reads a block's on-chain metadata · `keccak.js` Keccak-256 · `abi.json`
precomputed selectors.

Every encoder is compared byte-for-byte against `forge` output in the development repository; the
references are read from simulation artifacts, never transcribed by hand.
