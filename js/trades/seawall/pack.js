// Trade pack: Seawalls & docks. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "seawall",
  "name": "Seawalls & docks",
  "cvsModules": [
    "seawall"
  ],
  "areaKinds": [
    "linear",
    "flat"
  ],
  "measurements": [
    "seawall_length",
    "seawall_returns",
    "seawall_area"
  ],
  "trades": [
    "marine",
    "demo"
  ],
  "sequence": [
    "Permits (marine and local)",
    "Demo existing wall",
    "Install wall and tie-backs",
    "Cap and backfill"
  ],
  "holdPoints": [
    "Marine permits often take weeks",
    "Tide and water-level windows"
  ],
  "proposal": {
    "scope": [
      "Build or repair the seawall as described."
    ],
    "exclusions": [
      "Dredging",
      "Environmental mitigation unless listed"
    ],
    "selections": [
      "Wall material",
      "Cap finish"
    ]
  },
  "cvsReplaces": []
};

export const workItems = [
];

export const products = [
];
