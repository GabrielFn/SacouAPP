import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { resolveLegalLinks } from "../../../config/legal-links";
import { strings } from "../../../strings/pt-BR";
import { LegalLine } from "./LegalLine";

vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable" }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({ tokens: { fontSizes: {}, sizes: {} }, colors: {} }),
}));
vi.mock("../../../ui/Text", () => ({ Text: "Text" }));

interface WordProps {
  readonly label?: string;
  readonly url?: string | null;
  readonly onOpen?: (url: string) => void;
  readonly onPress?: () => void;
  readonly accessibilityRole?: string;
  readonly children?: ReactNode;
}

type WordElement = ReactElement<WordProps, (props: WordProps) => ReactNode>;

function elementsOf(node: ReactNode): readonly ReactElement<WordProps>[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => elementsOf(child));
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<WordProps>;
  return [element, ...elementsOf(element.props.children)];
}

/** The two words that name a document, drawn as screen 02 draws them. */
function documentWords(node: ReactNode): readonly WordElement[] {
  return elementsOf(node).filter(
    (element): element is WordElement =>
      typeof element.type === "function" && element.props.url !== undefined,
  );
}

const BASE = "https://sacou-api-abc.a.run.app";

describe("screen 02: the legal line (E6.1)", () => {
  test("with only the invite origin, Termos and Política de Privacidade open the API's pages", () => {
    const onOpen = vi.fn();
    const links = resolveLegalLinks({
      termsUrl: undefined,
      privacyUrl: undefined,
      inviteBaseUrl: BASE,
    });

    const words = documentWords(LegalLine({ links, onOpen }));
    for (const word of words) {
      const drawn = word.type(word.props);
      const link = elementsOf(drawn).find((element) => element.props.accessibilityRole === "link");
      link?.props.onPress?.();
    }

    expect(words.map((word) => word.props.label)).toEqual([
      strings.auth.legal.terms,
      strings.auth.legal.privacy,
    ]);
    expect(onOpen.mock.calls).toEqual([[`${BASE}/termos`], [`${BASE}/privacidade`]]);
  });

  test("without any address the words stay plain text, never a link", () => {
    const links = resolveLegalLinks({
      termsUrl: undefined,
      privacyUrl: undefined,
      inviteBaseUrl: undefined,
    });

    const words = documentWords(LegalLine({ links, onOpen: vi.fn() }));
    const drawn = words.flatMap((word) => elementsOf(word.type(word.props)));

    expect(words).toHaveLength(2);
    expect(drawn.some((element) => element.props.accessibilityRole === "link")).toBe(false);
  });
});
