# Yawmiyati design system (28 Nov 2026)

One identity in all five markets. The country changes dialect, photographs and prices, never the palette.

| Token | Value | Use |
|---|---|---|
| `--background` | warm paper | page |
| `--foreground` / `--primary` | ink (near black) | text, primary buttons, announcement bar |
| `--card` | warm white | cards, sheets |
| `--primary-soft`, `--muted`, `--surface` | warm greys | chips, skeletons, product picture background |
| `--accent`, `--gold` | sand | the one quiet accent (logo dot, highlights on photographs) |
| `--sale` | muted clay | real savings only (quantity offers, bundles) |
| `--success` | deep green | confirmations, free-delivery reached |

**Type:** headings `font-display` = El Messiri Variable; text = Readex Pro Variable (both self-hosted, one file per family).
Utilities: `ym-h1`, `ym-h2`, `ym-h3`, `ym-body`, `ym-eyebrow`, `ym-price`. Arabic body line height is 1.75–1.9.

**Components (utilities in `src/styles.css`):** `btn-primary` (52 px, ink pill), `btn-outline`, `btn-quiet`, `field`,
`ym-card`, `ym-chip` (+ `ym-chip-ink`, `ym-chip-sand`), `ym-skeleton` (loading), `ym-scroller` (horizontal rails), `ym-section`.

**Rules:** tap targets ≥ 44 px; one `h1` per page; RTL first (logical properties, `ms-`/`me-`, never `left`/`right` for layout);
pictures always carry width/height or an aspect box (no layout shift); savings, stock notes and ratings appear only when the
data behind them is real (see M9 and `scripts/check-storefront-truth.mjs`).
