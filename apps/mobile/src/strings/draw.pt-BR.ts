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
    locked: "Travado",
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
    // "24" is DrawLimits.MaxLocks in apps/api/src/Sacou.Modules/Sessions/Domain/Draw/DrawLimits.cs.
    tooManyLocks: "Dá para travar até 24 duplas.",
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
    // "4" is DrawLimits.MinPlayers in apps/api/src/Sacou.Modules/Sessions/Domain/Draw/DrawLimits.cs.
    notEnough: "Precisa de pelo menos 4 confirmados para sortear.",
    disabled: "O sorteio está desligado nesta rodada.",
    offline: "Sem conexão. O sorteio precisa de internet.",
    failed: "Não deu para sortear os times.",
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
} as const;
