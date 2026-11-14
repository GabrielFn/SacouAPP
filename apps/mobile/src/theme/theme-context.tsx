import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";

import { createScaledTokens, shortSide, type ScaledTokens } from "./scale";
import { themes, type Theme, type ThemeName } from "./themes";

export interface ThemeContextValue {
  readonly name: ThemeName;
  readonly colors: Theme;
  readonly tokens: ScaledTokens;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly name: ThemeName;
  readonly children: ReactNode;
}

/** The active theme name is a prop: the single place where the choice is stored. */
export function ThemeProvider({ name, children }: ThemeProviderProps) {
  const { width, height, fontScale } = useWindowDimensions();
  const value = useMemo<ThemeContextValue>(
    () => ({
      name,
      colors: themes[name],
      tokens: createScaledTokens({ windowWidth: shortSide(width, height), fontScale }),
    }),
    [name, width, height, fontScale],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider is missing from the tree.");
  return value;
}
