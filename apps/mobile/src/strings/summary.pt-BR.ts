const MINUS = "−";

function plural(amount: number, one: string, many: string): string {
  return `${String(amount)} ${amount === 1 ? one : many}`;
}

/** Screen 12, the summary of the round (Resumo.dc.html). */
export const summaryStrings = {
  title: "Resumo da rodada",
  matches: (amount: number) => plural(amount, "partida", "partidas"),
  mvpTitle: "MVP do dia",
  mvpNote: "Calculado pelo placar",
  mvpAccessibility: (name: string) => `MVP do dia: ${name}`,
  noName: "Jogador",
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
} as const;
