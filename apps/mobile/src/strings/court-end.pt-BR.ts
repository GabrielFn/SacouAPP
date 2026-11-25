// Texts of the end of a set and of a match (screens 25 and 11, E4.10). Plain functions interpolate.

export const courtEndStrings = {
  setEnd: {
    title: (setNumber: number) => `Fim do set ${String(setNumber)}?`,
    pendingTitle: "Falta confirmar o fim da partida",
    pendingHint: "O fim do último set já está gravado.",
    winsSet: (team: string, won: number, lost: number) =>
      `${team} vence o set e faz ${String(won)}–${String(lost)}`,
    winsMatch: (team: string, won: number, lost: number) =>
      `${team} vence a partida ${String(won)}–${String(lost)}`,
    nextSet: (team: string) => `Próximo set: troca de lados e o ${team} começa sacando`,
    decider: "Set decisivo: sorteio de quem saca",
    servesFirst: "Saca primeiro",
    tossOption: (letter: string, team: string) => `${letter} · ${team}`,
    draw: "Sortear",
    undo: "Desfazer último ponto",
    confirm: "Confirmar fim do set",
    confirmMatch: "Confirmar fim da partida",
    scoreLabel: (first: string, a: number, second: string, b: number) =>
      `${first} ${String(a)}, ${second} ${String(b)}`,
    versus: "x",
  },
  matchEnd: {
    heading: (setNumber: number) => `Fim do set ${String(setNumber)} · partida encerrada`,
    headingManual: (setNumber: number) => `Partida encerrada no ${String(setNumber)}º set`,
    winner: (team: string) => `${team} venceu`,
    noWinner: "Sem vencedor",
    lastSet: (a: number, b: number) => `${String(a)}–${String(b)}`,
    sets: (a: number, b: number) => `sets ${String(a)}–${String(b)}`,
    streak: (wins: number) => `${String(wins)}ª seguida`,
    next: "Próxima:",
    versus: "x",
    nextWith: (names: string) => `(com ${names})`,
    sameTeams: "Ninguém esperando. Os mesmos times.",
    nobodyLeaves: "Sem vencedor: ninguém sai.",
    lost: (team: string) => `${team} perdeu`,
    winnerLeft: (team: string, wins: number) => `${team} saiu após ${String(wins)} vitórias`,
    teamEnters: (names: string) =>
      `entra o time de ${names}. A escalação começa pela ordem de chegada.`,
    partialExit: (team: string, waiting: number, leaving: number, criterion: string) =>
      `saída parcial no ${team}. ${waiting === 1 ? "Tem 1 reserva esperando" : `Tem ${String(waiting)} reservas esperando`}: ${leaving === 1 ? "sai 1" : `saem ${String(leaving)}`} do ${team} (${criterion}).`,
    fixedExit: (team: string, leaving: number, criterion: string) =>
      `${leaving === 1 ? "sai 1" : `saem ${String(leaving)}`} do ${team} (${criterion}).`,
    sentence: (lead: string, body: string) => `${lead}: ${body}`,
    criteria: {
      "consecutive-matches": "quem está há mais partidas seguidas",
      "arrival-order": "quem chegou primeiro",
      draw: "por sorteio",
      manual: "escolha de quem sai",
    },
    leaves: "Saem",
    enters: "Entram",
    streakOf: (matches: number) => (matches === 1 ? "1 seguida" : `${String(matches)} seguidas`),
    position: (zone: number) => `posição ${String(zone)}`,
    bench: "banco",
    benchEnd: "fim do banco",
    swaps: (pairs: string, leaving: string, count: number) =>
      `${pairs}. ${leaving} ${count === 1 ? "vai" : "vão"} para o fim da fila.`,
    firstSwap: (incoming: string, outgoing: string) => `${incoming} entra no lugar de ${outgoing}`,
    nextSwap: (incoming: string, outgoing: string) => `${incoming} no de ${outgoing}`,
    chooseHint: (count: number, team: string) =>
      count === 1
        ? `Toque em 1 jogador do ${team} para escolher quem sai.`
        : `Toque em ${String(count)} jogadores do ${team} para escolher quem sai.`,
    rowLabel: (name: string, detail: string | null) =>
      detail === null ? name : `${name}, ${detail}`,
    chosenLabel: (name: string, chosen: boolean) => (chosen ? `${name}, sai` : `${name}, fica`),
    confirm: "Confirmar e ir para a próxima partida",
    planFailed: "Não deu para montar a próxima partida.",
    roundUnavailable:
      "A rodada desta quadra não está no celular. Abra a rodada com internet e volte aqui.",
    startFailed: "Não deu para começar a próxima partida. Tente de novo.",
    home: "Voltar ao início",
    endRound: "Encerrar rodada",
  },
  endRound: {
    title: "Encerrar a rodada?",
    noMatches: "Nenhuma partida terminou ainda.",
    oneMatch: "Foi 1 partida.",
    manyMatches: (count: number) => `Foram ${String(count)} partidas.`,
    openMatch: (score: string) => `A partida em andamento (${score}) não entra no resumo.`,
    consequence: "Depois disso não dá para jogar outra nesta rodada.",
    consequenceWithVoting:
      "Depois disso não dá para jogar outra nesta rodada, e a votação do MVP abre por 24 h.",
    score: (a: number, b: number) => `${String(a)} × ${String(b)}`,
    confirm: "Encerrar rodada",
    cancel: "Continuar jogando",
    notStarted:
      "A rodada ainda não começou. Antes do horário, ela só pode ser encerrada depois de terminar uma partida.",
    closing: "Encerrando a rodada",
    storageFailed: "Não deu para encerrar a rodada. Tente de novo.",
  },
  names: {
    join: (names: readonly string[]) =>
      names.length <= 1
        ? (names[0] ?? "")
        : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1] ?? ""}`,
  },
} as const;
