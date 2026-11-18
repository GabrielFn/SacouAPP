/** Texts of the draw (screen 07, Sorteio.dc.html). The levels are formatted elsewhere ("3,7"). */

function plural(amount: number, one: string, many: string): string {
  return amount === 1 ? one : many;
}

function reservesPart(reserves: number): string {
  return reserves === 0 ? "" : ` + ${String(reserves)} ${plural(reserves, "reserva", "reservas")}`;
}

export const drawStrings = {
  /** "Racha de terça · 14 confirmados". */
  header: (groupName: string, confirmed: number) =>
    `${groupName} · ${String(confirmed)} ${plural(confirmed, "confirmado", "confirmados")}`,
  /** "2 times de 6 + 2 reservas", "2 times de 5", "4 times de 2 + 1 reserva". */
  title: (teams: number, perTeam: number, reserves: number) =>
    `${String(teams)} times de ${String(perTeam)}${reservesPart(reserves)}`,
  loading: "Sorteando os times…",
  redrawing: "Sorteando de novo…",
  teamNames: { orange: "Laranja", blue: "Azul" },
  /** From the third team on there is no color yet (E4.1): "Time 3". */
  otherTeam: (number: number) => `Time ${String(number)}`,
  teamLevel: (level: string) => `nota ${level}`,
  noName: "Sem apelido",
  meter: {
    caption: "média de nota",
    /** "Diferença 0,1 · ótimo". */
    difference: (gap: string, label: string) => `Diferença ${gap} · ${label}`,
    labels: { great: "ótimo", good: "bom", unbalanced: "desequilibrado" },
    /** "A 3,7 · B 3,6". */
    averages: (parts: readonly string[]) => parts.join(" · "),
    average: (letter: string, level: string) => `${letter} ${level}`,
    /** "Média de nota: Laranja 3,7, Azul 3,6". */
    accessibility: (parts: readonly string[]) => `Média de nota: ${parts.join(", ")}`,
    accessibilityPart: (team: string, level: string) => `${team} ${level}`,
  },
  reservesTitle: "Reservas na fila",
  /** "1 · Davi". */
  reserve: (place: number, name: string) => `${String(place)} · ${name}`,
  player: {
    /** What the screen reader says of a name: "Duda, nota 3,3". */
    accessibility: (name: string, level: string) => `${name}, nota ${level}`,
    lockedSuffix: ", travado",
  },
  /** "Montar times" (question 72): the draw is off, the teams follow the order of arrival. */
  manual: {
    title: "Montar times",
    intro: "Sorteio desligado: os times seguem a ordem de chegada. Toque em dois nomes pra trocar.",
    privacy: "O que você compartilha mostra só os times.",
    rebuild: "Montar de novo",
    notEnough: (minPlayers: number) =>
      `Precisa de pelo menos ${String(minPlayers)} confirmados para montar os times.`,
    /** "Duda saiu da lista. Monte de novo." */
    left: (name: string, others: number) =>
      others === 0
        ? `${name} saiu da lista. Monte de novo.`
        : `${name} e mais ${String(others)} saíram da lista. Monte de novo.`,
    arrived: (amount: number) =>
      `${String(amount)} ${plural(amount, "confirmou", "confirmaram")} depois. Monte de novo para incluir.`,
  },
  /** Question 71: the share is text until there is an image. */
  privacy: "Só admins veem as notas. O que você compartilha mostra só os times.",
  hint: {
    swap: "Toque num nome pra trocar.",
    lock: "Toque em dois nomes do mesmo time ou de times diferentes pra travar.",
    swapSelected: (name: string) => `Você selecionou ${name}. Toque em outro nome pra trocar.`,
    lockSelected: (name: string) => `Toque no parceiro de ${name} pra travar.`,
  },
  notice: {
    lockBroken: (first: string, second: string) => `A trava de ${first} e ${second} saiu.`,
    reserveCannotLock: "Reserva não trava: troque antes.",
    tooManyLocks: (maxLocks: number) => `Dá para travar até ${String(maxLocks)} duplas.`,
    offline: "Sem conexão. O sorteio precisa de internet.",
  },
  swap: "Trocar",
  lock: "Travar dupla",
  unlock: "Destravar",
  redraw: "Sortear de novo",
  confirm: "Confirmar e compartilhar",
  offlineRedraw: "Sem conexão",
  stale: {
    /** "Duda saiu da lista. Sorteie de novo." */
    left: (name: string, others: number) =>
      others === 0
        ? `${name} saiu da lista. Sorteie de novo.`
        : `${name} e mais ${String(others)} saíram da lista. Sorteie de novo.`,
    arrived: (amount: number) =>
      `${String(amount)} ${plural(amount, "confirmou", "confirmaram")} depois do sorteio.`,
  },
  blocked: {
    forbidden: "Só admins sorteiam os times.",
    canceled: "Rodada cancelada.",
    notEnough: (minPlayers: number) =>
      `Precisa de pelo menos ${String(minPlayers)} confirmados para sortear.`,
    disabled: "O sorteio está desligado nesta rodada.",
    offline: "Sem conexão. O sorteio precisa de internet.",
    title: "Sorteio dos times",
  },
  back: "Voltar",
  backToRound: "Voltar à rodada",
  retry: "Tentar de novo",
  openSettings: "Ligar em Ajustes",
  /** The text of "Confirmar e compartilhar": names only, never a level, a position nor an ID (D11). */
  share: {
    heading: (groupName: string, date: string) => `${groupName} · ${date}`,
    team: (team: string, names: readonly string[]) => `${team}: ${names.join(", ")}`,
    reserves: (names: readonly string[]) =>
      `Reservas: ${names.map((name, index) => `${String(index + 1)} ${name}`).join(", ")}`,
  },
  /** Sheet 08, the pre-game (PreJogo.dc.html). "6x0" and the "Pro" badges are out (D9). */
  preGame: {
    sheetLabel: "Configurar partida",
    title: (number: number) => `Partida ${String(number)}`,
    close: "Fechar",
    versus: "x",
    points: "Pontos por set",
    lessPoints: "Menos pontos",
    morePoints: "Mais pontos",
    sets: "Sets",
    bestOf: { one: "1 set", three: "Melhor de 3", five: "Melhor de 5" },
    tieBreak: (points: number) => `Tie-break: ${String(points)} pontos`,
    firstServer: "Saca primeiro",
    /** "A · João": who stands in zone 1, or the team name without rotation. */
    serverOption: (letter: string, name: string) => `${letter} · ${name}`,
    flip: "Sortear",
    rotation: "Rotação de cada time",
    /** "Laranja · 5x1". */
    rotationTab: (team: string, system: string) => `${team} · ${system}`,
    rotationGroup: (team: string) => `Sistema de rotação do ${team}`,
    systems: { livre: "Livre", "4x2": "4x2", "5x1": "5x1", "6x2": "6x2" },
    oneSetter: (team: string, name: string, zone: number) =>
      `Levantador do ${team}: ${name}, começa na posição ${String(zone)}`,
    twoSetters: (first: string, second: string) => `Levantadores: ${first} e ${second}`,
    noSetter: (name: string, zone: number) =>
      `Sem levantador fixo. ${name} começa na posição ${String(zone)}.`,
    fullTeam: (team: string, size: number) => `${team} tem ${String(size)}, sem banco.`,
    noRotation: (team: string, size: number) => `${team} tem ${String(size)}: sem rotação.`,
    start: "Começar partida",
    starting: "Abrindo a quadra…",
    blocked: {
      stale: "A lista mudou depois do sorteio. Sorteie de novo.",
      openMatch: "Termine a partida aberta antes.",
      otherRound: "Há uma partida aberta em outra rodada. Encerre-a antes.",
      failed: "Não deu para começar a partida. Tente de novo.",
    },
  },
} as const;
