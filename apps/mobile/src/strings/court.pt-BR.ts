// Texts of the court mode (screens 09 and 10, QuadraSol.dc.html). Plain functions interpolate.

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
    menuLabelLocked: "Menu. Segure para abrir o menu",
    menuLabelUnlocked: "Menu",
    lockLabelLocked: "Tela travada. Segure para destravar",
    lockLabelUnlocked: "Tela destravada. Toque para travar",
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
    teamLetter: { a: "A", b: "B" },
  },
  strip: {
    undo: "Desfazer",
    correct: "Corrigir",
    positions: "Posições no momento do saque",
    oneMorePoint: (team: string) => `Mais um ponto e o ${team} fecha o set`,
    nextPointCloses: "Quem fizer o próximo ponto fecha o set",
    pointToast: (team: string, own: number, other: number) =>
      `+1 ${team} (${String(own)}–${String(other)})`,
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
  setEnd: {
    title: (setNumber: number) => `Fim do ${String(setNumber)}º set`,
    winner: (team: string) => `${team} venceu o set`,
    confirm: "Confirmar fim do set",
    back: "Voltar",
    whoServes: "Quem saca primeiro no set decisivo?",
    serves: (team: string) => `${team} saca`,
    scoreLine: (first: string, a: number, second: string, b: number) =>
      `${first} ${String(a)} x ${String(b)} ${second}`,
  },
  matchEnd: {
    title: "Partida encerrada",
    winner: (team: string) => `${team} venceu`,
    noWinner: "Sem vencedor",
    setScore: (setNumber: number, a: number, b: number) =>
      `${String(setNumber)}º set: ${String(a)} x ${String(b)}`,
    home: "Voltar ao início",
  },
  menuPlaceholder: {
    title: "Menu da partida",
    leave: "Sair do modo quadra",
    close: "Fechar",
  },
  correctionsPlaceholder: {
    title: "Corrigir",
    soon: "Disponível em breve",
    back: "Voltar",
  },
  dev: {
    title: "Modo quadra (desenvolvimento)",
    newOneSet: "Nova partida (1 set)",
    newBestOfThree: "Nova partida (melhor de 3)",
    newWithLibero: "Nova partida (com líbero)",
    themeSun: "Tema Sol",
    themeNight: "Tema Noite",
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
      corrections: "(d) linha do tempo do Corrigir",
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
