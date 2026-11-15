/** Texts of the admin's level (ADR 0047): the row of screen 19, the sheet 19a and screen 19b. */
export const ratingsStrings = {
  positions: {
    setter: "Levantador",
    outsideHitter: "Ponteiro",
    opposite: "Oposto",
    middleBlocker: "Central",
    libero: "Líbero",
    any: "Qualquer uma",
  },
  guestOrigin: "entrou pelo WhatsApp",
  badge: {
    suggested: "sugeriu",
    none: "– sem nota",
    confirmedLabel: (name: string, level: string) => `Nota de ${name}: ${level}. Alterar`,
    suggestedLabel: (name: string, level: string) =>
      `${name} sugeriu ${level}, ainda sem nota confirmada. Definir`,
    noneLabel: (name: string) => `${name} sem nota. Definir`,
  },
  pendingLabel: (total: number) =>
    `${total === 1 ? "1 nota para confirmar" : `${String(total)} notas para confirmar`}. Revisar`,
  pending: {
    count: (total: number) =>
      total === 1 ? "1 nota para confirmar." : `${String(total)} notas para confirmar.`,
    body: "O sorteio usa a sugestão até lá.",
    review: "Revisar",
  },
  privacyRow: "A nota é usada no sorteio.",
  privacyRowStrong: "Só admins veem.",
  optionsRow: {
    title: "Nota do sorteio",
    label: (text: string) => `Nota do sorteio: ${text}. Alterar`,
    confirmed: (level: string) => level,
    suggested: (level: string) => `${level} · sugerida`,
    unknown: "Não sei · definir",
    none: "sem nota · definir",
  },
  sheet: {
    title: (name: string) => `Nota de ${name}`,
    suggested: "sugeriu",
    suggestionBefore: (name: string) => `${name} sugeriu`,
    suggestionAfter: "no cadastro.",
    useSuggestion: (level: string) => `Usar ${level}`,
    less: "Diminuir meio ponto",
    more: "Aumentar meio ponto",
    shortcuts: "Atalhos de nota",
    shortcutLabel: (level: string) => `Nota ${level}`,
    lowest: "1 · Tô aprendendo",
    highest: "5 · Jogo federado",
    privacy: (name: string) =>
      `Usada só no sorteio. ${name} não vê a nota, e só admins e co-admins podem mudar.`,
    cancel: "Agora não",
    save: (level: string) => `Salvar ${level}`,
    valueLabel: (level: string) => `Nota ${level}`,
  },
  review: {
    title: "Revisar notas",
    header: (groupName: string) => `${groupName} · membros`,
    intro:
      "Confirme a sugestão ou ajuste. Quem fica sem nota entra no sorteio com 3,0, e as partidas corrigem rápido.",
    suggested: (level: string) => `sugeriu ${level}`,
    notSuggested: "não sugeriu",
    noAccount: "sem conta",
    adjusted: "você ajustou",
    less: (name: string) => `Diminuir a nota de ${name}`,
    more: (name: string) => `Aumentar a nota de ${name}`,
    confirm: "Confirmar",
    confirmLabel: (name: string, level: string) => `Confirmar ${level} para ${name}`,
    unknown: "Não sei",
    unknownLabel: (name: string) => `Não sei a nota de ${name}`,
    privacy: "Os jogadores não veem as notas.",
    confirmAll: (total: number) => `Confirmar todas (${String(total)})`,
    done: "Nenhuma nota para confirmar.",
    partial: (failed: number) =>
      failed === 1
        ? "1 nota não entrou. Tente de novo."
        : `${String(failed)} notas não entraram. Tente de novo.`,
    notAllowedTitle: "Sem acesso às notas",
    notAllowed: "Só admins e co-admins veem as notas.",
    loading: "Carregando as notas",
    loadError: "Não deu para carregar as notas",
  },
} as const;
