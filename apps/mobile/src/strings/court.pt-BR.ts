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
    lockLabelLocked: "Tela travada. Segure para sair",
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
    teamLetter: { a: "A", b: "B" },
  },
  strip: {
    undo: "Desfazer",
    correct: "Corrigir",
    positions: "Posições no momento do saque",
    oneMorePoint: (team: string) => `Mais um ponto e o ${team} fecha o set`,
    nextPointCloses: "Quem fizer o próximo ponto fecha o set",
  },
  queue: {
    title: "Na fila",
    reserves: "reservas",
    team: (position: number) => `Time ${String(position)}`,
    waiting: (names: string) => `Na fila: ${names}`,
    streak: (team: string, count: number) => `${team} venceu ${String(count)} seguidas`,
    streakOne: (team: string) => `${team} venceu a última`,
    partialExit: "perde sai · saída parcial",
    fullExit: "perde sai",
  },
  roster: { unknownPlayer: "Jogador", orange: "Laranja", blue: "Azul" },
  loading: "Abrindo a partida",
  error: {
    title: "Não conseguimos abrir esta partida",
    body: "Seus pontos continuam salvos no celular. Tente de novo; se não abrir, feche e abra o app.",
    retry: "Tentar de novo",
    back: "Voltar ao início",
  },
  notPlayable: {
    refusedPoint: "Não foi possível marcar o ponto. Tente de novo.",
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
    themeSun: "Tema Sol",
    themeNight: "Tema Noite",
    resume: "Continuar partida",
    closeCourt: "Encerrar quadra",
    startFailed: "Não foi possível abrir a partida.",
    storageFailed: "O armazenamento do celular não abriu.",
  },
} as const;
