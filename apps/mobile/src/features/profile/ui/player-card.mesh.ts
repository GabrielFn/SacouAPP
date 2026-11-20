import { MESH_VIEW_BOX } from "./player-card.layout.data";

/** The mesh of the top (`.kmesh`): two sets of diagonals every `step`, in the box of the card. */
export function meshPath(step: number): string {
  const { width, height } = MESH_VIEW_BOX;
  const count = Math.floor((width + height) / step) + 1;
  return Array.from({ length: count }, (_, index) => {
    const offset = index * step - height;
    return (
      `M${String(offset)} ${String(height)}L${String(offset + height)} 0` +
      `M${String(offset)} 0L${String(offset + height)} ${String(height)}`
    );
  }).join("");
}
