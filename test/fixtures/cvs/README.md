# Real CVS fixtures

Put the real Contractor Visual Studio job package exports (`*.json`) here. `test/cvs.mjs` imports every file in this
folder and checks that its lines match the package one for one. Until they arrive, the tests use the labeled
stand-ins in `../cvs-synthetic/`.
