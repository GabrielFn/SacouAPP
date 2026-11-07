// Logo geometry: a 3x2 grid of rounded squares (8 units, 3 apart), one of them yellow.
export const LOGO_VIEW_BOX = "0 0 30 19";
export const LOGO_ASPECT = 0.6333;

export const LOGO_CELLS = [
  {
    key: "a",
    d: "M2 0h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z",
    highlight: false,
  },
  {
    key: "b",
    d: "M2 11h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z",
    highlight: false,
  },
  {
    key: "c",
    d: "M13 0h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z",
    highlight: true,
  },
  {
    key: "d",
    d: "M13 11h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z",
    highlight: false,
  },
  {
    key: "e",
    d: "M24 0h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z",
    highlight: false,
  },
  {
    key: "f",
    d: "M24 11h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z",
    highlight: false,
  },
] as const;
