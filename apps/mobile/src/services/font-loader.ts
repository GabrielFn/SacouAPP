export interface FontLoader {
  /** Hook-style contract: true once every font of the app is ready to render. */
  useFontsLoaded(): boolean;
}
