# Synthetic stand-in fixtures

These three files are **not** real Contractor Visual Studio exports. They were written from the package format in
`docs/FULLBID-DIRECTION.md` section 4.1 so the importer could be built and tested before the real fixtures arrived.

- No maker names, SKUs or prices (all `null`), so nothing here can be mistaken for real maker data.
- `bath-neenan.json` stands in for the Neenan bath fixture (supplier lines, home-center setting materials, a
  contractor haul-away line, typical sizes, eight labor items).
- `roofing-report.json` stands in for the roofing fixture (exterior module, report-sourced measurements).
- `bath-three-options.json` exercises three options → Good / Better / Best.

The real exports are now in `test/fixtures/cvs/` and carry the main checks; these stand-ins stay for edge cases
(a version 2 package, an unknown module, labor units above 1, edits and re-imports on a small package).
