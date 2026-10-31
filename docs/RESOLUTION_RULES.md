# Resolution rules — implementation notes

The **public version** of the rules lives on the home page, in the
"How this resolves" block (`app/page.tsx`, anchor `#resolves`). There is no
separate rules page. This file is the engineering record: how those rules map onto
the contract, and what has to be frozen before deployment.

---

## 1. The decision, in one line

> **Yes** if the goat burns. Any fire, any extent, deliberate or accidental.
> **No** if nothing burns.

There is no requirement that the goat be destroyed or taken down, and no location
clause: wherever the goat is standing, if it catches fire, that is Yes.

## 2. Explicit No cases

| Case | Precedent | Result |
|---|---|---|
| Hit by a vehicle | 2021 | **No** — nothing burned |
| Felled by a storm | 2025 (Storm Johannes, 27 Dec) | **No** — nothing burned |
| Knocked over, cut, sprayed, stolen, eaten by birds | various | **No** |
| Goat never erected | — | **Void** |

A single scorched leg is **Yes**. The threshold is fire, not damage.

## 3. Sources — fixed list, ≥2 of 3

1. Official Visit Gävle / Gävle kommun live feed for Slottstorget.
2. Official statement from Gävle kommun / Visit Gävle, or the goat's official accounts.
3. Reporting by **SVT** or **Aftonbladet**.

If the live feed fails, two text sources still resolve the market.

## 4. Timeline

| Constant | Value | Immutable |
|---|---|---|
| `bettingClosesAt` | 2027-01-01 00:00 CET | yes |
| `resolutionDeadline` | 2027-01-31 | yes |
| `voidAfter` | `resolutionDeadline + 30 days` | yes, computed |
| Resolution timelock | 72 hours after `proposeResolution` | yes |

## 5. Contract mapping

```
proposeResolution(bool yesWon, bytes32 evidenceHash)   // resolver Safe only
    → state OPEN|FROZEN → FROZEN: betting, listings and fills stop instantly
    → emits ResolutionProposed(yesWon, evidenceHash, finalizesAt)
finalizeResolution()                                    // anyone, after finalizesAt
voidMarket()                                           // anyone, after voidAfter → 1:1 refunds
```

- `evidenceHash` is `keccak256` of the evidence bundle (screenshots, archive links,
  timestamps) published on `/rules`. The bundle is pinned to IPFS and the CID is
  included in the hash preimage, so the record cannot be altered afterwards.
- The 72-hour timelock is the substitute for a resolution committee: the decision is
  **publicly visible before any funds move**, which is what makes a single resolver
  defensible.
- `voidMarket` is permissionless. If the resolver disappears, loses keys, or refuses
  to call the outcome, every position refunds at face value without their help.

## 6. Resolver

- A **Safe** (1-of-1 at launch, convertible to 3-of-5 later without touching the
  market contract, because the resolver address is what the contract stores).
- Resolver address is published on `/rules` before launch.
- The resolver holds no position; any stake from that address is publicly visible
  on-chain and would be instantly disqualifying.

## 7. Freeze checklist before deployment

- [ ] This document and `/rules` are word-for-word consistent
- [ ] `keccak256` of the rules text committed to the repo and posted publicly
- [ ] Source list reproduced in the UI, not just in the docs
- [ ] Void path tested on Base Sepolia (nobody can be trapped)
- [ ] Resolver Safe deployed from a hardware wallet, address published
