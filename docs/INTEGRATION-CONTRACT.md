# Integration contract — 19 November 2026
Lovable project Souq Of Saudi (6bc552b8-1629-4a0b-8706-8bc21c5c1279) is synchronized with this private repository; workspace plan Free; GitHub and Supabase connectors enabled, but Lovable cloud database status explicitly enabled=false. External staging Supabase skhtunkknshvolturqlm is active, with nine SA candidates and zero listings across all five markets. Do not enable a new database, import another project's credentials, or incur Lovable build charges. Existing AGENTS.md database management boundary requires owner clarification before further migrations.

## Single target architecture
Lovable is the customer UI design/editor, GitHub canonical source, external Supabase canonical data/auth/server functions, Cloudflare preview/deploy. Main GitHub transfer destination rashidhamzy-hue. Transfer only this repository and the named Supabase staging project after verification. Preserve Lovable project history.

## Next transaction, not yet implemented
- Content revisions are immutable once submitted; owner acceptance records revision, fact references, reviewer and timestamp. Superseding revision invalidates publication eligibility. Plain text/approved image URLs only, no raw supplier HTML.
- Candidate draft promotion accepts market + complete supplier identity + expected review version + approved content revision, under authenticated market membership and database locks. Read current data from database, do not trust client approval flags. Check fresh observation, shortlist, cost and price evidence, exact approval revision. Insert catalog product, draft listing, unknown-stock variant and supplier mapping atomically. Unique market and supplier identity; replay returns same draft only if input revision matches. Never mark available just because Woo says instock.
- Existing commercial review RPC is simple-products-only; variants must remain blocked until identity-aware review changes. Introduce compare-and-swap review revision to prevent lost updates.
- Publication requires separate authorization, current review and content, independently verified stock within 15 minutes, and explicit release gate. Public reads must still hide stale stock. Add approved description, category, image metadata to public read contract; avoid exposing cost or private candidate fields.
- Rollback fixture tests: unauthenticated and cross-market denial, stale data, missing costs, duplicate replay, concurrent edits, partial failure, changed review, changed content, stock expiry, all release flags off. No fixture rows persisted.
- Existing PR25 approval helpers are advisory only. No production publish endpoint or real checkout currently exists.

## Current runtime distinction
Owner Worker live PR20; PR21 upload blocked by safety review. React owner commercial workspace PR27, storefront preview PR26, market import PR28 and fulfillment state PR29 merged, not deployed or browser-verified. No override or alternate route around blocked deployment. Read-only verified Saudi sync stays intact. All five checkout and fulfillment flags false.
