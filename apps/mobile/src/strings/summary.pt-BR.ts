const MINUS = "−";
const MIN_STREAK_TO_SHOW = 2;

function plural(amount: number, one: string, many: string): string {
  return `${String(amount)} ${amount === 1 ? one : many}`;
}

/** Screen 12, the summary of the round (Resumo.dc.html). */
export const summaryStrings = {
  title: "Resumo da rodada",
  matches: (amount: number) => plural(amount, "partida", "partidas"),
  mvpTitle: "MVP do dia",
  mvpNote: "Calculado pelo placar",
  mvpByVotesNote: "Escolhido pela galera",
  /** Title of the card while the MVP is provisional: the voting is open or yet to open (R101 item 4). */
  provisionalTitle: "Na frente pelo placar",
  today: "hoje",
  tomorrow: "amanhã",
  /** "amanhã, 12h44": the day is "hoje" or "amanhã", the time is the phone's. */
  deadline: (day: string, time: string) => `${day}, ${time}`,
  /** "A galera decide até amanhã, 12h44". */
  votingUntil: (deadline: string) => `A galera decide até ${deadline}`,
  /** "7 vitórias · ficaram 4 seguidas na quadra": the MVP of a team of the sand (screen 12b). */
  teamMvpLine: (wins: number, streak: number) =>
    streak >= MIN_STREAK_TO_SHOW
      ? `${plural(wins, "vitória", "vitórias")} · ficaram ${String(streak)} seguidas na quadra`
      : plural(wins, "vitória", "vitórias"),
  rankingTitle: "Ranking do dia",
  /** The sand header: "Areia de sábado · 9 partidas · duplas". */
  sandTeamKind: { pairs: "duplas", quartets: "quartetos" },
  /** "7 vitórias · 2 derrotas", and "· 1 sem vencedor" only when a match ended without one. */
  record: (wins: number, losses: number, undecided: number) =>
    [
      plural(wins, "vitória", "vitórias"),
      plural(losses, "derrota", "derrotas"),
      ...(undecided > 0 ? [`${String(undecided)} sem vencedor`] : []),
    ].join(" · "),
  rankingAccessibility: (position: number, name: string, record: string) =>
    `${String(position)}º, ${name}, ${record}`,
  mvpAccessibility: (name: string) => `MVP do dia: ${name}`,
  provisionalAccessibility: (name: string) => `Na frente pelo placar: ${name}`,
  noName: "Jogador",
  /** "Bia", "Bia e Caio", "Bia, Caio e Dani": the MVP shared by votes. */
  names: (names: readonly string[]) => {
    const last = names.at(-1) ?? "";
    const rest = names.slice(0, -1);
    return rest.length === 0 ? last : `${rest.join(", ")} e ${last}`;
  },
  mostWinsTitle: "Time que mais venceu",
  longestStreakTitle: "Maior sequência",
  teamLabel: (letter: string, name: string) => `${letter} ${name}`,
  wins: (amount: number) => plural(amount, "vitória", "vitórias"),
  streak: (amount: number) => plural(amount, "seguida", "seguidas"),
  winsOf: (wins: number, played: number) =>
    `${plural(wins, "vitória", "vitórias")} em ${String(played)}`,
  plusMinus: (balance: number) => {
    if (balance > 0) return `+${String(balance)} de saldo`;
    if (balance < 0) return `${MINUS}${String(Math.abs(balance))} de saldo`;
    return "0 de saldo";
  },
  loading: "Carregando o resumo",
  emptyTitle: "Nenhuma partida terminou nesta rodada.",
  offlineTitle: "Sem internet.",
  offlineBody: "O resumo aparece quando o celular voltar a se conectar.",
  errorTitle: "Não deu para abrir o resumo.",
  retry: "Tentar de novo",
  staleNote: "Sem internet. Mostrando o último resumo que o celular viu.",
  unsent: (points: number) =>
    points === 1
      ? "Ainda falta 1 ponto para enviar. O resumo pode mudar."
      : `Ainda faltam ${String(points)} pontos para enviar. O resumo pode mudar.`,
  entry: "Resumo da rodada",
  share: {
    title: "Mandar pro grupo",
    whatsapp: "WhatsApp",
    /** "Resumo do Racha de terça · 4 partidas." */
    intro: (header: string) => `Resumo do ${header}.`,
    mvp: (name: string, detail: string) => `MVP do dia: ${name} (${detail}).`,
    mvpNoDetail: (name: string) => `MVP do dia: ${name}.`,
    /** The voting is open or yet to open: the card says who leads, not who won (question 186). */
    provisional: (name: string, detail: string) => `Na frente pelo placar: ${name} (${detail}).`,
    provisionalNoDetail: (name: string) => `Na frente pelo placar: ${name}.`,
    /** "A galera decide o MVP até amanhã, 12h44." */
    provisionalDeadline: (deadline: string) => `A galera decide o MVP até ${deadline}.`,
    mvpByVotes: (name: string) => `MVP do dia (escolhido pela galera): ${name}.`,
    /** "Ranking do dia: 1. Bia e Gabi, 7-2; 2. Caio e Léo, 5-4." */
    ranking: (lines: readonly string[]) => `Ranking do dia: ${lines.join("; ")}.`,
    rankingLine: (position: number, name: string, wins: number, losses: number) =>
      `${String(position)}. ${name}, ${String(wins)}-${String(losses)}`,
    mostWins: (label: string, figure: string) => `Time que mais venceu: ${label}, ${figure}.`,
    longestStreak: (label: string, figure: string) => `Maior sequência: ${label}, ${figure}.`,
  },
} as const;
