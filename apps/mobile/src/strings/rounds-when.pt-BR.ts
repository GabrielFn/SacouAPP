/** "na terça", "no sábado": the article agrees with the weekday (ISO 1 = Monday). */
const weekdayWithArticle: Readonly<Record<number, string>> = {
  1: "na segunda",
  2: "na terça",
  3: "na quarta",
  4: "na quinta",
  5: "na sexta",
  6: "no sábado",
  7: "no domingo",
};

/** The phrase of a moment of the round: "hoje, às 20h", "amanhã, às 20h", "na terça, 24/11, às 20h". */
export const roundWhenStrings = {
  today: "hoje",
  tomorrow: "amanhã",
  weekdayWithArticle,
  /** "às 20h"; "à 1h" for the hour that takes the singular. */
  at: (hour: number, time: string) => (hour === 1 ? `à ${time}` : `às ${time}`),
  day: (day: string, at: string) => `${day}, ${at}`,
  dated: (weekday: string, date: string, at: string) => `${weekday}, ${date}, ${at}`,
} as const;

/** The text "Copiar lista" puts on the clipboard: only nicknames (ADR 0054). */
export const copyListStrings = {
  header: (group: string, when: string) => `${group} · ${when}`,
  confirmed: (count: string) => `Confirmados (${count})`,
  line: (index: number, name: string) => `${String(index)}. ${name}`,
  nobody: "Ninguém confirmou ainda.",
  waitlist: "Espera",
  /** The last line when the list carries the link of the round (R101 item 1). */
  confirmHere: (url: string) => `Confirma aqui: ${url}`,
} as const;
