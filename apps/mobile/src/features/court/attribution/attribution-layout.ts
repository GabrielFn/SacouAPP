/** How the point author sheet (screen 31) lays its blocks out in a window. */
export type AttributionLayout = "stacked" | "columns";

/**
 * The prototype is upright (everything stacked); with the court on its side the sheet is short, so it
 * splits in two columns: the question on the left, the six of the rally on the right.
 */
export function attributionLayoutFor(windowWidth: number, windowHeight: number): AttributionLayout {
  return windowWidth > windowHeight ? "columns" : "stacked";
}
