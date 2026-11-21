/** Screen 22, Escalação (Escalacao.dc.html; E4.8). */
export const lineupStrings = {
  title: "Escalação",
  back: "Voltar",
  /** The pre-game has no set nor score yet (D9). */
  beforeStart: (match: number) => `Partida ${String(match)} · antes de começar`,
  teams: "Time",
  /** "Azul tem 5: sem rotação." on a tab without six (D2). */
  noRotation: (team: string, size: number) => `${team} tem ${String(size)}: sem rotação.`,
  rotation: "Rotação",
  rotationGroup: (team: string) => `Rotação do ${team}`,
  rotationOption: (zone: number) => `Rotação ${String(zone)}`,
  serving: (team: string) => `${team} sacando`,
  receiving: (team: string) => `${team} recebendo`,
  atServe: "No saque",
  courtLabel: (team: string) => `Meia quadra do ${team} no momento do saque`,
  attackLine: "linha de 3 m",
  net: "Rede",
  hint: "Toque em dois jogadores para trocar",
  makeSetter: "Tornar levantador",
  /** The order of the names is the one of the court diagram: 4, 3, 2, then 5, 6, 1 (D4). */
  misplacedOne: (name: string) => `${name} está fora de ordem`,
  misplacedTwo: (first: string, second: string) => `${first} e ${second} estão fora de ordem`,
  misplacedMany: (count: number) => `${String(count)} jogadores fora de ordem`,
  fixRoles: "Corrigir",
  stale: "A partida mudou enquanto você editava. Confira a escalação.",
  officialOrder: "Ordem oficial",
  officialOrderLabel: "Ordem oficial de 1 a 6",
  noBench: (size: number) => `Sem banco (${String(size)} jogadores)`,
  bench: (names: string) => `Banco: ${names}`,
  nameSeparator: ", ",
  libero: "Líbero",
  liberoGroup: (team: string) => `Líbero do ${team}`,
  noLibero: "Sem líbero",
  /** The bench of the pre-game takes reserves of the queue (R96). */
  benchGroup: (team: string) => `Banco do ${team}`,
  noReservesForBench: "Sem reservas para o banco.",
  benchOption: (name: string, onBench: boolean) =>
    onBench ? `${name}, no banco` : `${name}, na fila`,
  liberoSystemsOnly: "Líbero só no 5x1 e no 6x2.",
  noReserves: "Sem reservas para líbero.",
  noBenchForLibero: (size: number) => `Sem líbero: o time tem ${String(size)}.`,
  /** "João passa a sacar." when the rotation of the team that serves changes who serves (D4). */
  newServer: (name: string) => `${name} passa a sacar.`,
  save: "Salvar escalação",
  /** Between sets nobody serves yet: the change holds for the next set (D7). */
  betweenSets: "Entre sets",
  nextSet: "Vale para o próximo set.",
  /** Item of the menu of the match (MenuQuadra.dc.html), shown only with a team that rotates. */
  menuItem: "Escalação",
  /** "Voltar" with a draft (D7). */
  discard: {
    title: "Descartar as mudanças?",
    body: "A escalação volta a ser a da partida.",
    confirm: "Descartar",
    cancel: "Continuar editando",
  },
  /** Why the engine did not save the lineup, by code (D7); any other code has the court's text. */
  refusals: {
    "rotation-off": "Esse time joga sem rotação.",
    "no-open-match": "A partida já terminou.",
    "invalid-payload": "Não deu para salvar. Confira a escalação.",
  },
  chip: {
    position: (zone: number) => `posição ${String(zone)}`,
    serving: "sacando",
    setter: "levantador",
    misplaced: "fora de ordem",
    libero: "líbero, troca na linha Líbero",
    separator: ", ",
  },
  badges: { setter: "L", libero: "Lí", misplaced: "!" },
} as const;
