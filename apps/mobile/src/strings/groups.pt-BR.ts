/** Texts of the home, the groups list and the notifications (screens 03, 17 and 28). */
export const groupsStrings = {
  title: "Seus grupos",
  createGroup: "Criar grupo",
  roles: { admin: "Admin", coAdmin: "Co-admin", scorekeeper: "Placar", player: "Jogador" },
  summary: {
    oneOrganized: "1 grupo. Você organiza.",
    onePlays: "1 grupo. Você joga nele.",
    allOrganized: (total: number) => `${String(total)} grupos. Você organiza todos.`,
    allPlayed: (total: number) => `${String(total)} grupos. Você joga em todos.`,
    oneOrganizedOnePlayed: "2 grupos. Você organiza um, joga no outro.",
    oneOrganizedManyPlayed: (total: number) =>
      `${String(total)} grupos. Você organiza um, joga nos outros.`,
    manyOrganized: (total: number, organized: number) =>
      `${String(total)} grupos. Você organiza ${String(organized)}, joga em ${String(total - organized)}.`,
  },
  card: {
    noRound: "Nenhuma rodada marcada",
    noRoundStrip: "Sem rodada marcada",
    noRoundDash: "–",
    members: "Membros",
    settings: "Como jogamos",
    footerLabel: (groupName: string) => `Gerenciar ${groupName}`,
  },
  states: {
    loading: "Carregando seus grupos",
    offlineTitle: "Sem conexão.",
    offlineBody: "Quando a internet voltar, seus grupos aparecem aqui.",
    emptyTitle: "Você ainda não está em nenhum grupo.",
    emptyBody: "Recebeu um link do grupo? Abra pelo WhatsApp e toque em entrar.",
    errorTitle: "Não deu para carregar seus grupos",
    retry: "Tentar de novo",
  },
  home: {
    greeting: "Fala!",
    greetingNamed: (nickname: string) => `Fala, ${nickname}.`,
    noRoundsTitle: "Nenhuma rodada marcada.",
    noRoundsBody: "Quando o organizador abrir a lista, ela aparece aqui.",
    seeGroups: "Ver seus grupos",
    notifications: "Notificações",
  },
  tabs: { home: "Início", groups: "Grupo", me: "Eu", navigation: "Navegação principal" },
  meTitle: "Eu",
  notifications: {
    title: "Notificações",
    emptyTitle: "Nenhuma notificação por enquanto.",
    emptyBody:
      "A gente avisa aqui quando a lista abrir, quando você sair da espera e quando os times saírem.",
  },
} as const;
