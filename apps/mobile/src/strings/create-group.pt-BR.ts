export const createGroupStrings = {
  step1: {
    stepLabel: "Novo grupo",
    progress: "Passo 1 de 2",
    title: "Como é o seu racha?",
    subtitle: "Escolha um jeito de começar. Dá pra mudar tudo depois.",
    radiogroup: "Modelo do grupo",
    continueWith: (templateName: string) => `Continuar com ${templateName}`,
    proBadge: "Pro",
  },
  custom: {
    title: "Monte do seu jeito",
    subtitle:
      "Tudo começa desligado. Ligue o que o grupo usa; dá pra mudar depois em Como jogamos.",
    continue: "Continuar",
    blocks: {
      attendance: {
        title: "Presença e vagas",
        summary: "Lista de quem vai, limite de vagas, espera, mensalistas e avulsos",
        detail:
          "Liga a lista de presença, o limite de vagas, a espera, os mensalistas e os avulsos.",
      },
      scoring: {
        title: "Jogo",
        summary: "Placar no celular, pontos, sets, tie-break e vantagem",
        detail:
          "Liga o placar no celular, mesmo sem internet, com pontos, sets, tie-break e vantagem.",
      },
      queue: {
        title: "Fila",
        summary: "Quem perde sai, com saída parcial",
        detail: "Liga a fila de times: quem perde sai, com saída parcial.",
      },
      rotation: {
        title: "Rotação",
        summary: "Cada time com a sua: Livre / 6x0, 4x2, 5x1 ou 6x2",
        detail: "Liga a rotação: cada time joga com a sua, Livre / 6x0, 4x2, 5x1 ou 6x2.",
      },
      draw: {
        title: "Sorteio",
        summary: "Times equilibrados pela nota do admin",
        detail: "Liga o sorteio de times, equilibrado pela nota do admin.",
      },
      mvp: {
        title: "MVP do dia",
        summary: "Pelos dados do placar ou por votação",
        detail: "Liga o MVP do dia, pelos dados do placar ou por votação.",
      },
    },
  },
  step2: {
    progress: "Passo 2 de 2",
    title: "Duas perguntas e pronto",
    name: "Nome do grupo",
    namePlaceholder: "Racha de terça",
    whenAndWhere: "Quando e onde?",
    schedule: "Dia e horário",
    schedulePlaceholder: "Escolher",
    venue: "Local",
    capacity: "Vagas",
    whereYouPlay: "Onde vocês jogam?",
    hasRegulars: "Tem mensalistas fixos?",
    regularsHelp: "Mensalistas entram na lista sozinhos toda rodada.",
    yes: "Sim",
    no: "Não",
    submit: "Criar grupo",
  },
  errors: {
    nameRequired: "Escreva o nome do grupo.",
    nameTooLong: "Use até 60 letras no nome.",
    nameInvalid: "Escolha um nome com letras ou números.",
  },
  partial: {
    title: "Grupo criado, mas não salvamos tudo.",
    retry: "Tentar de novo",
    keep: "Seguir assim",
  },
} as const;
