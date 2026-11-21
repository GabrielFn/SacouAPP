/** Weekday of a group header of screen 28, Monday = 1 as in ISO. */
const weekdays: Readonly<Record<number, string>> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
};

/** Texts of the notifications (screen 28), of the bell of the home and of the push channel (E3.11). */
export const notificationsStrings = {
  title: "Notificações",
  emptyTitle: "Nenhuma notificação por enquanto.",
  emptyBody:
    "A gente avisa aqui quando a lista abrir, quando você sair da espera e quando os times saírem.",
  loading: "Carregando notificações",
  errorTitle: "Não deu para carregar as notificações",
  offlineTitle: "Sem conexão.",
  offlineBody: "Quando a internet voltar, suas notificações aparecem aqui.",
  retry: "Tentar de novo",
  markAllRead: "Marcar como lidas",
  unread: "Não lida",
  today: "Hoje",
  yesterday: "Ontem",
  weekdays,
  /** "12/11": a day more than a week ago. */
  date: (day: string, month: string) => `${day}/${month}`,
  /** "9h00", as in the canvas. */
  time: (hours: string, minutes: string) => `${hours}h${minutes}`,
  permission: {
    title: "Ative as notificações pra não perder a lista",
    body: "A gente avisa quando a lista abre, quando você sai da espera e quando os times saem.",
    enable: "Ativar",
    /** The person said no for good: only the settings of the phone can turn it on. */
    openSettings: "Abrir ajustes",
    blockedBody:
      "As notificações estão desligadas nos ajustes do celular. Ligue por lá pra saber quando sair da espera.",
  },
  bell: "Notificações",
  bellUnread: "Notificações, há não lidas",
  /** The Android channel of the waitlist pushes (high importance): the name shows in the phone settings. */
  channelName: "Saída da espera",
} as const;
