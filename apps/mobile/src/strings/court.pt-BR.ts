// Texts of the court mode (screens 09 and 10, QuadraSol.dc.html). Plain functions interpolate.

import { courtEndStrings } from "./court-end.pt-BR";
import { courtTakeoverStrings } from "./court-takeover.pt-BR";

export interface ZoneLabelInput {
  readonly team: string;
  readonly score: number;
  readonly setPoint: boolean;
  readonly serving: boolean;
  readonly serverName: string | null;
}

function zoneStatus({ team, serving, serverName }: ZoneLabelInput): string {
  if (!serving) {
    return `${team} em recepção`;
  }
  return serverName === null ? `${team} sacando` : `${team} sacando, ${serverName} no saque`;
}

export const courtStrings = {
  header: {
    setTitle: (setNumber: number) => `${String(setNumber)}º set`,
    savedOnPhone: "Salvo no celular",
    menu: "Menu",
    menuLabel: "Menu da partida",
    setsLabel: (firstTeam: string, firstSets: number, secondTeam: string, secondSets: number) =>
      `Sets: ${firstTeam} ${String(firstSets)}, ${secondTeam} ${String(secondSets)}`,
  },
  zone: {
    pointFor: ({ team, score, setPoint, ...rest }: ZoneLabelInput) =>
      `Ponto para ${team}. Placar ${String(score)}${setPoint ? ", set point" : ""}. ${zoneStatus({ team, score, setPoint, ...rest })}`,
    serving: "Sacando",
    receiving: "Em recepção",
    rotation: (system: string, zone: number) => `${system} · rotação ${String(zone)}`,
    freeSystem: "Livre",
    setPointTag: "Set point",
    setterBadge: "L",
    setterLabel: "levantador",
    liberoBadge: "Lí",
    liberoLabel: "líbero",
    serverLabel: "sacador",
    markerLabel: (name: string, zone: number, role: string | null) =>
      `${name}, posição ${String(zone)}${role === null ? "" : `, ${role}`}`,
    teamLetter: { a: "A", b: "B" },
  },
  strip: {
    undo: "Desfazer",
    correct: "Corrigir",
    positions: "Posições no momento do saque",
    oneMorePoint: (team: string) => `Mais um ponto e o ${team} fecha o set`,
    nextPointCloses: "Quem fizer o próximo ponto fecha o set",
    firstServerDrawn: (team: string) => `Saca primeiro: ${team} (sorteio)`,
  },
  // The points are not reaching the server (question 85): the court goes on, and the strip says why.
  upload: {
    stopped: "Os pontos não estão indo para o servidor. Peça ao admin para conferir.",
    roundCanceled: "A rodada foi cancelada. Os pontos ficam só neste celular.",
    noPermission: "Sua conta não marca mais esta quadra. Peça ao admin para conferir.",
  },
  // The session of another account (ADR 0067, D8): the court does not open for marking.
  otherAccount: {
    title: "Entre com a conta que abriu a quadra",
    body: "Os pontos desta quadra só podem ser marcados e enviados pela conta que a abriu.",
    leave: "Sair da quadra",
    takeOver: "Assumir a quadra",
  },
  queue: {
    title: "Na fila",
    reserves: "reservas",
    more: (hidden: number) => `+${String(hidden)}`,
    team: (position: number) => `Time ${String(position)}`,
    waiting: (names: string, reservesOnly: boolean) =>
      `Na fila: ${names}${reservesOnly ? " (reservas)" : ""}`,
    streak: (team: string, count: number) => `${team} venceu ${String(count)} seguidas`,
    partialExit: "perde sai · saída parcial",
    fullExit: "perde sai",
  },
  roster: { unknownPlayer: "Jogador", orange: "Laranja", blue: "Azul" },
  battery: {
    warning: (percent: number) => `Bateria em ${String(percent)}%. Ligue o carregador.`,
    dismiss: "Entendi",
  },
  storageError: {
    title: "Não conseguimos abrir o armazenamento",
    body: "O app não conseguiu abrir o banco de dados do celular. Nada foi apagado. Tente de novo; se continuar, feche e abra o app.",
  },
  error: {
    title: "Não conseguimos abrir esta partida",
    body: "Seus pontos continuam salvos no celular. Tente de novo; se não abrir, feche e abra o app.",
    retry: "Tentar de novo",
    back: "Voltar ao início",
  },
  ...courtEndStrings,
  ...courtTakeoverStrings,
  menu: {
    title: "Menu da partida",
    subtitle: (matchNumber: number, setNumber: number, scoreLine: string) =>
      `Partida ${String(matchNumber)} · ${String(setNumber)}º set · ${scoreLine}`,
    scoreLine: (first: string, a: number, b: number, second: string) =>
      `${first} ${String(a)}–${String(b)} ${second}`,
    close: "Fechar menu",
    groupLabel: "Ajustes do jogo",
    corrections: "Corrigir",
    correctionsHint: "linha do tempo",
    hintAfter: (hint: string) => ` · ${hint}`,
    hintLabel: (label: string, hint: string) => `${label} ${hint}`,
    flipSides: "Inverter lados",
    flipSidesLabel: (inverted: boolean) =>
      inverted ? "Inverter lados, lados invertidos" : "Inverter lados, lados normais",
    theme: "Tema",
    themeLabel: "Tema da quadra",
    themeSun: "Sol",
    themeNight: "Noite",
    leave: "Sair do modo quadra",
    endMatch: "Encerrar partida",
  },
  endMatchDialog: {
    title: "Encerrar a partida agora?",
    winsOnSets: (team: string, won: number, lost: number) =>
      `${team} vence: ${String(won)}–${String(lost)} em sets.`,
    winsOnPoints: (team: string, won: number, lost: number, setNumber: number) =>
      `${team} vence: lidera ${String(won)}–${String(lost)} no ${String(setNumber)}º set.`,
    noWinner: "Sem vencedor: ninguém sai da quadra.",
    confirm: "Encerrar partida",
    cancel: "Cancelar",
  },
  corrections: {
    title: "Corrigir",
    subtitle: (setNumber: number, scoreLine: string, listed: number) =>
      `${String(setNumber)}º set · ${scoreLine} · ${listed === 1 ? "último ponto" : `últimos ${String(listed)} pontos`}`,
    close: "Fechar",
    switchServer: "Trocar sacador",
    shiftTeam: "Girar / desgirar time",
    listHint: "Mais recente no topo · toque num ponto para voltar até ele",
    listLabel: (setNumber: number) => `Linha do tempo do ${String(setNumber)}º set`,
    empty: "Nenhum ponto neste set ainda.",
    score: (a: number, b: number) => `${String(a)}–${String(b)}`,
    serves: "Saque",
    servesTeam: (team: string) => `Saque do ${team}`,
    sideOut: "Side-out",
    sideOutRotation: (zone: number) => `Side-out · rot. ${String(zone)}`,
    willUndo: "Será desfeito",
    currentRow: "Placar atual",
    currentPoint: "Esse é o placar de agora. Para tirar esse ponto, use DESFAZER na quadra.",
    selected: "Selecionado",
    rowLabel: (a: number, b: number, team: string, serve: string, sideOut: string | null) =>
      `${String(a)} a ${String(b)}, ponto do ${team}, ${serve}${sideOut === null ? "" : `. ${sideOut}`}`,
    spokenParts: (parts: readonly string[]) => parts.join(". "),
    serveWithName: (serve: string, name: string) => `${serve} ${name}`,
    rowSideOutLabel: (team: string, zone: number | null) =>
      zone === null ? "Side-out" : `Side-out, ${team} gira para rotação ${String(zone)}`,
    revertTitle: (a: number, b: number) => `Voltar o jogo para ${String(a)}x${String(b)}?`,
    revertScore: "Placar",
    revertServe: "Saque",
    revertRotation: "Rotação",
    revertServeReturns: (team: string, server: string | null) =>
      `volta para o ${team}${server === null ? "" : ` (${server})`}`,
    revertRotationReturns: (team: string, zone: number) =>
      `${team} volta para rotação ${String(zone)}`,
    removedPoints: (count: number) =>
      count === 1 ? "1 ponto será apagado." : `${String(count)} pontos serão apagados.`,
    removedAlso: (parts: readonly string[]) => `Também sai: ${parts.join(", ")}.`,
    removedServing: (count: number) =>
      count === 1 ? "1 troca de saque" : `${String(count)} trocas de saque`,
    removedSetEnds: (count: number) =>
      count === 1 ? "1 fim de set" : `${String(count)} fins de set`,
    removedAttributions: (count: number) =>
      count === 1 ? "1 autor de ponto" : `${String(count)} autores de ponto`,
    removedLineups: (count: number) =>
      count === 1 ? "1 troca de escalação" : `${String(count)} trocas de escalação`,
    removedQueues: (count: number) =>
      count === 1 ? "1 mudança na fila" : `${String(count)} mudanças na fila`,
    revertConfirm: "Voltar para este ponto",
    revertCancel: "Cancelar",
    servingNow: (team: string) => `Agora saca o ${team}.`,
    servingAtStart: (team: string) => `Agora o ${team} começa o set.`,
    shiftTitle: "Girar / desgirar time",
    shiftTeamLabel: "Time",
    shiftForward: "Girar ↻",
    shiftBackward: "Desgirar ↺",
    shiftChange: (team: string, from: number, to: number) =>
      `${team}: rotação ${String(from)} → ${String(to)}`,
    noRotation: "Sem rotação",
    shiftTeamOff: (team: string) => `${team} · Sem rotação`,
    shiftBoth: (forward: string, backward: string) => `${forward} · ${backward}`,
    shiftButtonLabel: (button: string, change: string) => `${button}. ${change}`,
    scoreChange: (from: string, to: string) => `${from} → ${to}`,
    shiftClose: "Fechar",
  },
  undoNotice: {
    point: (team: string, a: number, b: number) =>
      `Desfeito: ponto do ${team} (${String(a)}–${String(b)})`,
    servingChange: "Desfeito: troca de saque",
    rotation: (team: string) => `Desfeito: giro do ${team}`,
    queue: "Desfeito: mudança na fila",
    setEnd: "Desfeito: fim do set",
    attribution: "Desfeito: autor do ponto",
  },
  refusals: {
    generic: "Não foi possível fazer isso agora. Nada mudou.",
    "nothing-to-undo": "Não há nada para desfazer.",
    "invalid-revert-target": "Esse ponto não está mais na linha do tempo.",
    "set-decided": "O set já foi decidido. Confirme o fim do set.",
    "rotation-off": "Este time está sem rotação.",
    "no-open-set": "Não há set em andamento.",
    "no-open-match": "Não há partida em andamento.",
  },
  dev: {
    title: "Modo quadra (desenvolvimento)",
    newOneSet: "Nova partida (1 set)",
    newBestOfThree: "Nova partida (melhor de 3)",
    newWithLibero: "Nova partida (com líbero)",
    newLongNames: "Nova partida (nomes longos)",
    resume: "Continuar partida",
    closeCourt: "Encerrar quadra",
    startFailed: "Não foi possível abrir a partida.",
    catalogLink: "Catálogo de componentes (desenvolvimento)",
    benchmarkLink: "Medição do Hermes (desenvolvimento)",
  },
  benchmark: {
    title: "Medição do replay",
    intro:
      "Mede o replay do log no motor do celular. Vale só em build de produção (APK de teste). Leva alguns minutos; não mexa no aparelho.",
    run: "Rodar",
    running: (scenario: string) => `Medindo ${scenario}...`,
    done: "Pronto. Fotografe ou copie o texto abaixo.",
    failed: "A medição falhou. Feche e abra o app e tente de novo.",
    mode: (production: boolean, hermes: boolean, groupBy: boolean) =>
      `Modo: ${production ? "produção" : "DESENVOLVIMENTO (não vale)"} · Hermes: ${hermes ? "sim" : "não"} · Object.groupBy: ${groupBy ? "sim" : "não"}`,
    scenarioLine: (scenario: string, events: number) => `${scenario} · ${String(events)} eventos`,
    stepLine: (step: string, median: string, p95: string, max: string) =>
      `${step}: mediana ${median} ms · p95 ${p95} ms · máx ${max} ms`,
    steps: {
      parse: "(a) ler e validar as linhas",
      replay: "(b) replay",
      screen: "(c) montar a tela",
      corrections: "(d) linha do tempo do Corrigir e prévia de um ponto",
      load: "(f) ler do SQLite",
      reopen: "Reabrir a quadra (ler + replay)",
      tap: "(e) toque inteiro (comando, simulação, gravação)",
    },
    budgetTap: (p95: string, limit: number, within: boolean) =>
      `Orçamento do toque no S3: p95 ${p95} ms de ${String(limit)} ms · ${within ? "dentro" : "ESTOUROU"}`,
    budgetReopen: (median: string, limit: number, within: boolean) =>
      `Orçamento de reabrir no S4: ${median} ms de ${String(limit)} ms · ${within ? "dentro" : "ESTOUROU"}`,
    budgetMissing: "Orçamento: sem medida.",
  },
} as const;
