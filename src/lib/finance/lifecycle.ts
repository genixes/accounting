// BUY → RENT → HOLD → SELL as an explicit state machine.

export const STAGES = ["PROSPECT", "UNDER_CONTRACT", "OWNED", "LEASED", "HELD", "LISTED", "SOLD"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  PROSPECT: "Prospect",
  UNDER_CONTRACT: "Under contract",
  OWNED: "Owned / renovating",
  LEASED: "Leased",
  HELD: "Held",
  LISTED: "Listed for sale",
  SOLD: "Sold",
};

export const PHASE_OF: Record<Stage, "BUY" | "RENT" | "HOLD" | "SELL"> = {
  PROSPECT: "BUY",
  UNDER_CONTRACT: "BUY",
  OWNED: "BUY",
  LEASED: "RENT",
  HELD: "HOLD",
  LISTED: "SELL",
  SOLD: "SELL",
};

const NEXT: Record<Stage, Stage[]> = {
  PROSPECT: ["UNDER_CONTRACT"],
  UNDER_CONTRACT: ["OWNED", "PROSPECT"], // fell through → back to prospect
  OWNED: ["LEASED", "HELD", "LISTED"],
  LEASED: ["HELD", "LISTED"],
  HELD: ["LEASED", "LISTED"],
  LISTED: ["SOLD", "LEASED", "HELD"], // pulled off the market
  SOLD: [],
};

export const allowedTransitions = (from: Stage): Stage[] => NEXT[from];
export const canTransition = (from: Stage, to: Stage) => NEXT[from].includes(to);
/** Stages in which the property is owned and income/expenses may be booked. */
export const isOwnedStage = (s: Stage) => s !== "PROSPECT" && s !== "UNDER_CONTRACT" && s !== "SOLD";
