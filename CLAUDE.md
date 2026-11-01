# Fullbid: start here

Read `docs/FULLBID-DIRECTION.md` before any change. It sets what Fullbid is for, how it stays compatible with Contractor
Visual Studio (CVS), and the build order. Section 9 lists guardrails that always apply.

- Fullbid serves every construction trade. Trade-specific rules live in trade packs (`js/trades/<pack>/`), not the core.
- Shared words (trades, units, measurement kinds and sources, where a line is bought) live only in `js/shared/vocab.js`.
- CVS job packages come in through one function, `importCvsPackage`. Test against `test/fixtures/cvs/*.json`.
- Whoever owns a piece of data decides it: CVS owns picks, finishes and design quantities; Fullbid owns measurements on
  site, prices, contracts, change orders, orders, schedule and money.
- Imperial units, plain English, no invented prices or maker data (every price has an evidence tier, E0–E5).
- Don't edit CVS from here. Requests for the CVS side go in `docs/CVS-REQUESTS.md`.
- Ask James before choosing a backend, a payment provider, or anything that needs an account or a key.
- Run `npm test` (unit + both end-to-end suites) before every commit; keep it green.
