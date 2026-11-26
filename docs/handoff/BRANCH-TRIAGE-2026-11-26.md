# Branch triage — 26 Nov 2026

Method: for all 155 non-main branches, compared the branch tip with every pull request opened from it (GitHub REST API).

| Result | Branches | Meaning |
|---|---:|---|
| Tip equals the head of a **merged** PR | 151 | Fully in `main` (PRs were squash-merged, so GitHub's "commits ahead" count is an artifact). Includes all nine branches the ChatGPT handover listed as "diverged". |
| Behind main only | 1 | Nothing unique. |
| Unmerged work | 3 | See below — all superseded. |

## The three genuinely unmerged branches (all 20 Nov 2026, 230+ commits behind main)
| Branch | Content | Decision |
|---|---|---|
| `feat/market-localized-stores-20261120` (PR #79, closed) | Early per-market dialect, palettes, policy pages | Superseded by `src/lib/store/market-experience.ts`, M4J/M9 five-market copy. Do not merge. |
| `feat/country-voice-theme-20261120` (no PR) | Same idea, earlier draft | Superseded as above. Do not merge. |
| `feat/country-shipping-evidence-20261120` (no PR) | First unverified shipping-rate encoding | Superseded by `docs/SUPPLIER-POLICIES-2026-11-20.md`, `egypt-shipping-evidence.ts`, M4H/M4I. Do not merge. |

No branch was deleted. Branches stay as history; new work starts from `main` only.
