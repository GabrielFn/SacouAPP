/** How the two quick actions of "Corrigir" sit under the title. */
export type QuickActionsDirection = "row" | "column";

/**
 * Upright they sit side by side as in the prototype. On its side the actions column is narrow
 * (half the window), so each action takes the full width and its label fits whole.
 */
export function quickActionsDirection(windowWidth: number, windowHeight: number): QuickActionsDirection {
  return windowWidth > windowHeight ? "column" : "row";
}
