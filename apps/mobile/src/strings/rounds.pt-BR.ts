import { copyListStrings, roundWhenStrings } from "./rounds-when.pt-BR";
import { roundTeamsStrings } from "./round-teams.pt-BR";

/** Texts of the round screens (20 and 06). Dinheiro, "Pro" and the "Avulso" field are not here (ADR 0046). */
const weekdayShort: Readonly<Record<number, string>> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
  7: "Dom",
};

const modalities: Readonly<Record<string, string>> = {
  "indoor-6x6": "6x6",
  "beach-4x4": "4x4",
  "beach-2x2": "2x2",
};

const rotationSystems: Readonly<Record<string, string>> = {
  livre: "Livre / 6x0",
  "4x2": "4x2",
  "5x1": "5x1",
  "6x2": "6x2",
};

/** "confirmado" for one, "confirmados" otherwise. */
function confirmedNoun(amount: number): string {
  return amount === 1 ? "confirmado" : "confirmados";
}

/** "Vôlei de quinta · Ter, 3/11 · 20h30 · Arena · 14 vagas": the start of the WhatsApp message (question 45). */
function shareHeadline(title: string, when: string, venue: string, capacity: string): string {
  return `${title} · ${when}${venue === "" ? "" : ` · ${venue}`}${capacity === "" ? "" : ` · ${capacity}`}`;
}

export const roundsStrings = {
  weekdayShort,
  when: roundWhenStrings,
  chips: {
    modalities,
    rotationSystems,
    points: (points: number) => `${String(points)} pontos`,
    oneSet: "1 set",
    bestOf: (sets: number) => `Melhor de ${String(sets)}`,
    queue: "Perde sai",
    partialExit: "Saída parcial",
    legend: "Cinza vem do grupo.",
    legendOrange: "Ponto laranja vale só nesta rodada.",
  },
  create: {
    title: "Nova rodada",
    subtitle: "Veio com o padrão do grupo. Mude só o que precisar.",
    day: "Dia",
    time: "Horário",
    venue: "Local",
    capacity: "Vagas",
    capacityPlaceholder: "Sem limite",
    howItGoes: "Como vai ser",
    personalize: "Personalizar esta rodada",
    changes: (count: number) => (count === 1 ? "1 mudança" : `${String(count)} mudanças`),
    fromGroup: "do grupo",
    onlyThisRound: "só nesta rodada",
    groupDefault: (value: string) => `padrão do grupo: ${value}`,
    resetToDefault: "Voltar ao padrão",
    repeat: "Repetir toda semana",
    repeatSummary: (every: string, time: string) => `${every}, ${time}.`,
    regularsConfirmed: "Mensalistas já confirmados.",
    publish: "Publicar e compartilhar no WhatsApp",
    publishing: "Publicando…",
    editTitle: "Editar rodada",
    editSubtitle: "Mude só o que precisar. Quem já confirmou continua na lista.",
    save: "Salvar",
    saving: "Salvando…",
    pickDay: "Escolher o dia",
    pickTime: "Escolher o horário",
    timeHint: "Use 24 horas, por exemplo 20:30.",
    confirm: "Confirmar",
    cancel: "Cancelar",
    loading: "Carregando o padrão do grupo",
    retry: "Tentar de novo",
    loadError: "Não deu para carregar o padrão do grupo.",
    offline: "Sem conexão. A rodada não foi publicada.",
    errors: {
      datePast: "Escolha uma data que ainda não passou.",
      dateTooFar: "Escolha uma data dentro dos próximos 365 dias.",
      timeInvalid: "Use o formato 20:30.",
      timePast: "Esse horário já passou hoje.",
      venueInvalid: "Use só letras, números e símbolos comuns, em até 80 caracteres.",
      capacityInvalid: (min: number, max: number) =>
        `Use um número de vagas de ${String(min)} a ${String(max)}.`,
    },
  },
  settingTitles: {
    "scoring.bestOf": "Sets",
    "scoring.pointsPerSet": "Pontos por set",
    "rotation.system": "Rotação",
  },
  setBestOf: (sets: number) => (sets === 1 ? "1 set" : `Melhor de ${String(sets)}`),
  share: {
    /** Without the page link (a member without ManageRounds, or a build without the public base). */
    text: (title: string, when: string, venue: string, capacity: string) =>
      `${shareHeadline(title, when, venue, capacity)}. Confirma no app Sacou.`,
    /** With the link of the round page (E3.12, ADR 0070, D1): the URL comes from the API, never built here. */
    textWithLink: (title: string, when: string, venue: string, capacity: string, url: string) =>
      `${shareHeadline(title, when, venue, capacity)}. Confirma aqui: ${url}`,
    spots: (capacity: number) => `${String(capacity)} vagas`,
  },
  detail: {
    youAreAdmin: "Você é admin",
    youAreCoAdmin: "Você é co-admin",
    youAreScorekeeper: "Você é placar",
    youArePlayer: "Você é jogador",
    subtitle: (date: string, time: string, venue: string) =>
      venue === "" ? `${date} · ${time}` : `${date} · ${time} · ${venue}`,
    confirmedOf: (going: number, capacity: number) => `${String(going)}/${String(capacity)}`,
    confirmedCount: (going: number) => String(going),
    confirmedLabel: confirmedNoun,
    waitlistCount: (count: number) => String(count),
    waitlistLabel: "na espera",
    waitlistTitle: "Espera",
    noName: "Sem apelido",
    summaryLink: "Resumo da rodada",
    /** The seal of a round that is over (R99, ADR 0077): screens 06 and 26 offer only "Ver resumo" then. */
    ended: "Encerrada",
    canceled: "Rodada cancelada",
    loading: "Carregando a rodada",
    retry: "Tentar de novo",
    loadError: "Não deu para carregar a rodada.",
    notFound: "Essa rodada não existe mais.",
    backToGroups: "Voltar aos grupos",
    drawTimes: "Sortear times",
    buildTeams: "Montar times",
    openCourt: "Abrir quadra",
    back: "Voltar",
    /** Under the count on 06, until the window of the drop-ins opens: "A lista dos avulsos abre amanhã, às 20h." */
    dropInWindow: (phrase: string) => `A lista dos avulsos abre ${phrase}.`,
    changeDropInWindow: "Mudar",
    copyList: "Copiar lista",
    listCopied: "Lista copiada.",
    listAndLinkCopied: "Lista e link copiados.",
    shareOnWhatsApp: "Mandar no WhatsApp",
    shareOnWhatsAppAccessibility: "Mandar o link da rodada no WhatsApp",
    shareFailed: "Não deu para abrir o compartilhar. Use Copiar lista.",
    copyFailed: "Não deu para copiar a lista. Tente de novo.",
    addFromWhatsApp: "Adicionar quem confirmou no WhatsApp",
    openConfirmed: (count: string, amount: number) =>
      `Ver a lista de ${count} ${confirmedNoun(amount)}`,
  },
  /** The "Sua presença" card of screen 26 (D7, question 46). Ordinals in the masculine, as question 41. */
  presence: {
    section: "Sua presença",
    going: "Você vai",
    waitlisted: "Você está na espera",
    ask: "Vai?",
    canceled: "Rodada cancelada",
    regularPosition: (position: number) => `${String(position)}º mensalista`,
    listPosition: (position: number) => `${String(position)}º da lista`,
    waitlistPosition: (position: number) => `${String(position)}º da espera`,
    spotsLeft: (left: number) => (left === 1 ? "Falta 1 vaga" : `Faltam ${String(left)} vagas`),
    fullToWaitlist: "Lista cheia: você entra na espera",
    full: "Lista cheia",
    /** Screen 26, a drop-in before the window, in a group with regulars. */
    dropInOpensWithRegulars: (phrase: string) =>
      `A lista abre para você ${phrase}. Até lá, só os mensalistas confirmam.`,
    /** Screen 26, a drop-in before the window, in a group without regulars. */
    dropInOpensNoRegulars: (phrase: string, hours: number) =>
      `A lista abre ${phrase}, ${String(hours)} h antes da rodada.`,
    dropInLockedHint: "A lista ainda não abriu para você",
    started: "A rodada já começou. Fale com o admin.",
    goingAction: "VOU",
    notGoingAction: "Não vou",
    notGoingAnymore: "Não vou mais",
    leaveWaitlist: "Sair da espera",
    takesYourPlace: (name: string) => `${name} (1º da espera) entra no seu lugar.`,
    waitlistCount: (count: number) => `${String(count)} na espera`,
    leaveTitle: "Sair da lista?",
    /** Full list with a waitlist: the first of the waitlist takes the place, coming back is at the end. */
    leaveBodyFullWithWaitlist: (name: string) =>
      `${name} (1º da espera) entra no seu lugar. Se mudar de ideia, você volta pelo fim da espera.`,
    leaveBodyFull: "Se mudar de ideia, só volta se abrir vaga.",
    leaveBodyOpen: "Se mudar de ideia, é só tocar em VOU de novo enquanto houver vaga.",
    leaveConfirm: "Não vou mais",
    keep: "Continuar na lista",
  },
  confirmed: {
    title: "Confirmados",
    seeAll: (count: number) => `Ver os ${String(count)}`,
    you: "você",
    youRow: "Você",
    andMore: (rest: number) => ` e mais ${String(rest)}`,
    nobody: "Ninguém confirmou ainda",
    noInitial: "?",
    waitlist: (line: string) => `Espera: ${line}`,
    sheetTitle: (count: number) => `${String(count)} ${confirmedNoun(count)}`,
    waitlistTitle: "Espera",
    remove: "Tirar",
    removeLabel: (name: string) => `Tirar ${name} da lista`,
    removeTitle: "Tirar da lista?",
    removeBody: (name: string) => `${name} sai da lista. Se tiver espera, o 1º entra.`,
    removeConfirm: "Tirar",
    cancel: "Cancelar",
    close: "Fechar",
    position: (position: number) => `${String(position)}º`,
  },
  teams: roundTeamsStrings,
  /** Screen 21. */
  add: {
    title: "Adicionar quem confirmou no WhatsApp",
    subtitle: (group: string, count: string, amount: number) =>
      `${group} · ${count} ${confirmedNoun(amount)}`,
    search: "Buscar membro do grupo",
    notYet: "Ainda não confirmaram",
    nobodyLeft: "Todo mundo do grupo já está na lista.",
    noMatch: "Ninguém com esse nome.",
    you: "Você",
    action: "Adicionar",
    actionLabel: (name: string) => `Adicionar ${name}`,
    adding: "Adicionando…",
    close: "Fechar",
    spotsLeft: (left: number) => (left === 1 ? "Falta 1 vaga." : `Faltam ${String(left)} vagas.`),
    spotsLeftThenWaitlist: (left: number, capacity: number) =>
      `${left === 1 ? "Falta 1 vaga" : `Faltam ${String(left)} vagas`}. Quem passar de ${String(capacity)} entra na espera.`,
    fullToWaitlist: "Lista cheia. Quem você adicionar entra na espera.",
    full: "Lista cheia.",
    added: (name: string) => `${name} entrou na lista.`,
    waitlisted: (name: string, position: number) =>
      `${name} entrou na espera (${String(position)}º).`,
  },
  /** The guest block of screen 21 and the sheet 21a, without the claim of the profile (ADR 0046). */
  guest: {
    blockTitle: "Convidado sem conta",
    name: "Nome",
    joinsAs: "Entra como",
    open: "Adicionar convidado",
    title: "Adicionar convidado",
    intro: "Para quem ainda não tem o app. Ele entra como avulso nesta rodada.",
    nameLabel: "Nome ou apelido",
    position: "Posição",
    optional: "· opcional",
    level: "Nota do sorteio",
    levelUnset: (level: string) => `${level} · definir`,
    levelLabel: (level: string) => `Nota do sorteio: ${level}. Definir`,
    privacy: "Só admins veem a nota.",
    submit: "Adicionar à rodada",
    submitting: "Adicionando…",
    close: "Fechar",
    nameRequired: "Escreva o nome ou apelido do convidado.",
    nameInvalid: "Use só letras, números e símbolos comuns, em até 20 caracteres.",
  },
  /** The round cards of the home (03) and of the groups list (17). */
  cards: {
    oneInWindow: (days: number) => `1 rodada nos próximos ${String(days)} dias.`,
    manyInWindow: (count: number, days: number) =>
      `${String(count)} rodadas nos próximos ${String(days)} dias.`,
    going: "Vou",
    waiting: (position: number | null) =>
      position === null ? "Na espera" : `Na espera · ${String(position)}º`,
    full: "Lista cheia",
    confirmed: (count: string, amount: number) => `${count} ${confirmedNoun(amount)}`,
    withWaitlist: (count: string, waitlist: number) => `${count} · ${String(waitlist)} na espera`,
    next: (when: string) => `Próxima: ${when}`,
    recent: (when: string) => `Rodada de ${when}`,
    /** The card of the round between its start and its end (R97, D3); it opens screen 06. */
    live: "Rolando agora",
    seeSummary: "Ver resumo",
    editRound: "Editar rodada",
    createRound: "Criar rodada",
    stripLabel: (day: string, hour: string) => `${day}, ${hour}`,
  },
  /** The "Rodadas do grupo" screen (R97 part 2, D6; ADR 0075). */
  groupRounds: {
    title: "Rodadas",
    newRound: "Nova rodada",
    upcoming: "Próximas",
    recent: "Recentes",
    state: {
      open: "Aberta",
      live: "Rolando agora",
      ended: "Encerrada · Ver resumo",
      canceled: "Cancelada",
    },
    rowTitle: (date: string, state: string) => `${date} · ${state}`,
    rowLabel: (date: string, state: string, venue: string) => `${date}, ${state}, ${venue}`,
    noUpcoming: "Nenhuma rodada marcada.",
    recentHint: "Rodadas encerradas recentemente.",
    emptyTitle: "Nenhuma rodada por aqui",
    emptyOrganizer: "Marque a próxima em Nova rodada.",
    emptyPlayer: "Quando a organização marcar uma rodada, ela aparece aqui.",
    loading: "Carregando as rodadas",
    errorTitle: "Não deu para carregar as rodadas",
    errorBody: "Confira a conexão e tente de novo.",
    retry: "Tentar de novo",
  },
  copyList: copyListStrings,
} as const;
