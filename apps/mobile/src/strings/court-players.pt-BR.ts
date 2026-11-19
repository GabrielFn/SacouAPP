// Texts of the screens of the court about who plays and who scored (E4.10, part 3): screen 23a
// (Trocar jogador) and screen 31 (Quem fez o ponto), with the author on screens 24 and 25.

export const courtPlayersStrings = {
  substitution: {
    menuItem: "Trocar jogador",
    noBench: "sem banco",
    title: "Trocar jogador",
    close: "Voltar ao menu",
    teamLabel: "Time da troca",
    outgoing: "Sai",
    incoming: "Entra",
    position: (position: number) => `pos ${String(position)}`,
    serving: "sacando",
    setter: "levantador",
    bench: "banco",
    detail: (parts: readonly string[]) => parts.join(" · "),
    sentence: (incoming: string, position: number, outgoing: string) =>
      `${incoming} entra na posição ${String(position)}, no lugar de ${outgoing}. ${outgoing} vai para o banco.`,
    confirm: (outgoing: string, incoming: string) => `Trocar ${outgoing} por ${incoming}`,
    pickBoth: "Escolha quem sai e quem entra.",
    rowLabel: (name: string, detail: string) => `${name}, ${detail}`,
  },
  attribution: {
    title: (team: string, a: number, b: number) => `Ponto do ${team} · ${String(a)}–${String(b)}`,
    onScore: "já está no placar",
    afterSpace: (hint: string) => ` ${hint}`,
    inParentheses: (hint: string) => ` (${hint})`,
    question: "De quem foi?",
    questionHint: "toque no jogador",
    kindsLabel: "Tipo do ponto",
    kinds: { attack: "Ataque", block: "Bloqueio", ace: "Ace", other: "Outro" },
    onCourt: (team: string) => `${team} em quadra`,
    onCourtHint: "posição no rali",
    position: (position: number) => `pos ${String(position)}`,
    served: (position: number) => `pos ${String(position)} · sacou`,
    playerLabel: (name: string, detail: string | null, role: string | null) =>
      [name, detail, role].filter((part) => part !== null).join(", "),
    notPlausible: "não combina com o tipo",
    opponentError: (team: string) => `Erro do ${team}`,
    skip: "Pular",
    footnote:
      "Fica aberto até o próximo ponto. Sem resposta, o ponto fica sem autor e dá pra preencher depois no Corrigir ou no fim do set.",
    // Screen 24: who scored each line, and the button to answer or change it.
    rowAuthor: (kind: string, name: string) => `${kind} · ${name}`,
    noAuthor: "sem autor",
    authorButton: "Autor",
    authorButtonLabel: (score: string) => `Autor do ponto ${score}`,
    // Screen 25: the points of the set nobody answered yet.
    unattributed: (count: number) =>
      count === 1 ? "1 ponto sem autor" : `${String(count)} pontos sem autor`,
    fill: "Preencher",
    lastChance: "Última chance: depois de confirmar, a partida fecha.",
  },
  refusals: {
    "invalid-attribution-target": "Esse ponto não está mais na partida.",
    "invalid-point-author": "Esse jogador não pode ter feito esse ponto.",
    "invalid-point-kind": "Escolha o tipo do ponto.",
  },
} as const;
