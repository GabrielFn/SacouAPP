const MINUS = "−";

function plural(amount: number, one: string, many: string): string {
  return `${String(amount)} ${amount === 1 ? one : many}`;
}

/**
 * Screen 12a, the MVP vote (VotarMvp.dc.html). No text here counts votes or voters (ADR 0048, item 2):
 * the secrecy test scans this file.
 */
export const mvpVoteStrings = {
  title: "Quem foi o MVP?",
  /** "Voto secreto · fecha em 23 h". */
  secretUntil: (remaining: string) => `Voto secreto · fecha em ${remaining}`,
  hours: (amount: number) => `${String(amount)} h`,
  minutes: (amount: number) => `${String(amount)} min`,
  ballotLabel: "Escolha o MVP da rodada",
  matches: (amount: number) => plural(amount, "partida", "partidas"),
  /** "+34", "−2", "0": the balance of the round, with the true minus sign. */
  balance: (amount: number) => {
    if (amount > 0) return `+${String(amount)}`;
    if (amount < 0) return `${MINUS}${String(Math.abs(amount))}`;
    return "0";
  },
  rule: "Só vota quem jogou, e ninguém vota em si mesmo. Empate: vence quem teve mais saldo no placar.",
  /** "Em", not "na" or "no": the app does not know the gender of a nickname. */
  voteFor: (name: string) => `Votar em ${name}`,
  chooseFirst: "Escolha quem foi o MVP",
  connectToVote: "Conecte-se para votar",
  sending: "Enviando o voto",
  noName: "Jogador",
  loading: "Carregando a votação",
  offlineTitle: "Sem internet.",
  offlineBody: "A votação aparece quando o celular voltar a se conectar.",
  errorTitle: "Não deu para abrir a votação.",
  retry: "Tentar de novo",
  seeSummary: "Ver resumo",
  staleNote: "Sem conexão. Mostrando a votação que o celular viu por último.",
  votingOff: "A votação do MVP está desligada neste grupo.",
  notOpen: "A votação abre quando a rodada terminar.",
  /** "Abre às 02h30", in the time of the phone. */
  opensAt: (time: string) => `Abre às ${time}`,
  notEligible: "Só vota quem jogou nesta rodada.",
  /** "Fecha em 23 h." under the refusal. */
  closesIn: (remaining: string) => `Fecha em ${remaining}.`,
  votedFor: (name: string) => `Você votou em ${name}. Seu voto é secreto.`,
  votedSecret: "Você já votou. Seu voto é secreto.",
  resultWhenClosed: (remaining: string) =>
    `O resultado sai quando a votação fechar, em ${remaining}.`,
  closed: "A votação fechou.",
  closedBody: "O MVP escolhido aparece no resumo da rodada.",
  offlineFailure: "Sem conexão. Tente de novo.",
} as const;
