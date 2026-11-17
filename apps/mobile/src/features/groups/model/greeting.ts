import { strings } from "../../../strings/pt-BR";

const { home } = strings.groups;

/** "Fala, <nickname>!" when the profile has one; plain "Fala!" without a profile or while it loads. */
export function greetingText(nickname: string | null | undefined): string {
  const name = nickname?.trim() ?? "";
  return name === "" ? home.greeting : home.greetingNamed(name);
}
