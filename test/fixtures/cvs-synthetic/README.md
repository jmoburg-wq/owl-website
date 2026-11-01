# Synthetic stand-in fixtures

These three files are **not** real Contractor Visual Studio exports. They were written from the package format in
`docs/FULLBID-DIRECTION.md` section 4.1 so the importer could be built and tested before the real fixtures arrived.

- No maker names, SKUs or prices (all `null`), so nothing here can be mistaken for real maker data.
- `bath-neenan.json` stands in for the Neenan bath fixture (supplier lines, home-center setting materials, a
  contractor haul-away line, typical sizes, eight labor items).
- `roofing-report.json` stands in for the roofing fixture (exterior module, report-sourced measurements).
- `bath-three-options.json` exercises three options → Good / Better / Best.

Put the real files in `test/fixtures/cvs/`. `test/cvs.mjs` runs the shape checks against every file there too.
