# Data

    data/ger.json                                       GER categories (same for everyone)
    data/index.ts                                       registry (departments, majors, years)
    data/catalogs/CSE/CMP/mje.json                      CMP major electives (all years)
    data/catalogs/CSE/CMP/2026-2027/catalog.json        CMP course chart, catalog 2026-2027
    data/catalogs/CSE/COE/mje.json
    data/catalogs/CSE/COE/2026-2027/catalog.json

Everything is detected from the folder names. Add a year: add a folder like `2027-2028/` with a `catalog.json` under the major. Add a major or department: add the folders (with `mje.json` and a year). No code changes needed.

Course fields: `pre`, `co` (concurrent), `any` (one of), `minCr` (required credits), `rec` (recommended credits, a note only), `priority`, `terms`.
