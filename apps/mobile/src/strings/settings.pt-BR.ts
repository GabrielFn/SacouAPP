import type {
  SettingsErrorCode,
  SettingsPath,
  SettingsTemplateKey,
} from "@sacou/match-engine";

/** Weekdays by ISO number (1 is Monday), with the form used in a summary ("toda terça"). */
const weekdays: Readonly<Record<number, { readonly name: string; readonly every: string }>> = {
  1: { name: "Segunda", every: "toda segunda" },
  2: { name: "Terça", every: "toda terça" },
  3: { name: "Quarta", every: "toda quarta" },
  4: { name: "Quinta", every: "toda quinta" },
  5: { name: "Sexta", every: "toda sexta" },
  6: { name: "Sábado", every: "todo sábado" },
  7: { name: "Domingo", every: "todo domingo" },
};

/** The ready-made templates (screen 04), by catalog key: a new key without a text does not compile. */
const templates: Readonly<
  Record<SettingsTemplateKey, { readonly name: string; readonly line: string }>
> = {
  pelada: {
    name: "Pelada descontraída",
    line: "Liga lista aberta e sorteio rápido. Sem cobrança.",
  },
  "racha-organizado": {
    name: "Racha organizado",
    line: "Liga mensalistas, Pix, sorteio por nível e fila de quem perde sai.",
  },
  treino: {
    name: "Treino",
    line: "Liga presença e rotação 5x1 ou 4x2 (Pro). Sem fila de times.",
  },
  "areia-rei-da-quadra": {
    name: "Areia rei da quadra",
    line: "Liga duplas ou quartetos, rei da quadra e ranking do dia.",
  },
  "do-zero": { name: "Do zero", line: "Tudo desligado. Você liga o que usar." },
};

const fields: Readonly<Record<SettingsPath, string>> = {
  "attendance.enabled": "Presença e vagas",
  "attendance.capacityLimited": "Limite de vagas",
  "attendance.capacity": "Vagas",
  "attendance.waitlistEnabled": "Lista de espera",
  "attendance.regularsEnabled": "Mensalistas com prioridade",
  "attendance.dropInWindowEnabled": "Avulsos abrem antes",
  "attendance.dropInOpensHoursBefore": "Horas antes da rodada",
  "schedule.enabled": "Dia fixo",
  "schedule.weekday": "Dia",
  "schedule.startTime": "Horário",
  "schedule.venue": "Local",
  "format.modality": "Onde vocês jogam",
  "scoring.enabled": "Jogo",
  "scoring.bestOf": "Sets",
  "scoring.pointsPerSet": "Pontos por set",
  "scoring.tieBreakEnabled": "Tie-break",
  "scoring.tieBreakPoints": "Pontos do tie-break",
  "scoring.winMargin": "Vantagem de 2 pontos",
  "queue.enabled": "Fila",
  "queue.exitCriterion": "Quem sai primeiro",
  "rotation.enabled": "Rotação",
  "rotation.system": "Sistema padrão",
  "rotation.ruleMode": "Regra de sobreposição",
  "rotation.liberoEnabled": "Líbero",
  "draw.enabled": "Sorteio",
  "draw.balanceByLevel": "Equilibrar por nível",
  "mvp.enabled": "MVP do dia",
  "mvp.byStats": "Pelos dados do placar",
  "mvp.voting": "Votação da galera",
  "mvp.individualPoints": "Ponto individual",
  "money.enabled": "Dinheiro",
  "money.dropInFeeCents": "Avulso por rodada",
  "money.monthlyFeeCents": "Mensalidade",
};

/** The label of each value of a choice leaf, by the value as text. */
const choices: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "format.modality": {
    "indoor-6x6": "Quadra 6x6",
    "beach-4x4": "Areia 4x4",
    "beach-2x2": "Areia 2x2",
  },
  "scoring.bestOf": { "1": "1 set", "3": "3 sets", "5": "5 sets" },
  "queue.exitCriterion": {
    "consecutive-matches": "Mais partidas seguidas",
    draw: "Sorteio",
    "arrival-order": "Ordem de chegada",
    manual: "Manual",
  },
  "rotation.system": { livre: "Livre", "4x2": "4x2", "5x1": "5x1", "6x2": "6x2" },
  "rotation.ruleMode": { "fivb-2025-28": "FIVB atual", classic: "Clássica" },
};

const errorsByCode: Readonly<Record<SettingsErrorCode, string>> = {
  "settings.unknown-field": "Essa configuração não existe.",
  "settings.missing-field": "Falta preencher uma configuração.",
  "settings.wrong-type": "Confira o valor digitado.",
  "settings.out-of-range": "Esse valor está fora do permitido.",
  "settings.unknown-value": "Essa opção não existe.",
  "settings.invalid-text": "Use só letras, números e símbolos comuns.",
  "settings.not-allowed-at-level": "Essa configuração não pode ser mudada aqui.",
  "settings.unsupported-version": "Atualize o app para mudar as configurações.",
};

export const settingsStrings = {
  weekdays,
  templates,
  fields,
  choices,
  errors: {
    byCode: errorsByCode,
    range: (min: number, max: number) => `Use um valor de ${String(min)} a ${String(max)}.`,
    tooLong: (max: number) => `Use até ${String(max)} caracteres.`,
    offline: "Sem conexão. A mudança não foi salva.",
    templateLimit: "O grupo já tem 20 modelos. Apague um para salvar outro.",
  },
  screen: {
    title: "Como jogamos",
    subtitle: (groupName: string) => `${groupName} · só admins e co-admins mudam`,
    templateUsed: "Modelo usado",
    custom: "Personalizado",
    saveAsTemplate: "Salvar como modelo",
    loading: "Carregando as regras do grupo",
    errorTitle: "Não deu para carregar as regras",
    offlineTitle: "Sem conexão.",
    offlineBody: "Quando a internet voltar, as regras do grupo aparecem aqui.",
    retry: "Tentar de novo",
    expand: (block: string) => `Abrir ${block}`,
    collapse: (block: string) => `Fechar ${block}`,
    off: "Desligado",
    pro: "Pro",
    proLabel: (label: string) => `${label}, recurso Pro`,
    editValue: (label: string, value: string) => `${label}: ${value}. Mudar`,
    schedulePick: "Escolher",
    dismissError: "Fechar aviso",
  },
  blocks: {
    attendance: { title: "Presença e vagas" },
    scoring: { title: "Jogo" },
    queue: { title: "Fila", caption: "quem joga a próxima" },
    draw: { title: "Sorteio", caption: "times na hora" },
    rotation: { title: "Rotação", caption: "cada time tem a sua" },
    mvp: { title: "MVP do dia" },
    money: { title: "Dinheiro" },
  },
  queueRule: {
    label: "Regra",
    value: "Perde sai",
    accessibility: "Regra da fila: perde sai",
    help: "Só sai do perdedor quem vai ser substituído.",
  },
  rotationHelp: {
    libero: "Líbero só vale nos sistemas 5x1 e 6x2.",
    now: (note: string) => `Agora: ${note}.`,
  },
  summary: {
    limit: (capacity: number) => `Limite ${String(capacity)}`,
    noLimit: "sem limite",
    regulars: "mensalistas com prioridade",
    dropIn: (hours: number) => `avulsos abrem ${String(hours)}h antes`,
    points: (points: number) => `${String(points)} pontos`,
    sets: (sets: number) => (sets === 1 ? "1 set" : `${String(sets)} sets`),
    tieBreak: (points: number) => `tie-break ${String(points)}`,
    margin: (margin: number) => `vantagem de ${String(margin)}`,
    noMargin: "sem vantagem",
    noLibero: "sem líbero",
    libero: "com líbero",
  },
  sheets: {
    confirm: "Confirmar",
    cancel: "Cancelar",
    weekday: "Dia da semana",
    time: "Horário (24h)",
    timePlaceholder: "20:30",
    dismiss: "Fechar",
    templatePickerTitle: "Aplicar um modelo",
    templatePickerBody:
      "Isso troca as regras do jogo pelas do modelo. Dia, horário, local, vagas e valores ficam.",
    readyTemplates: "Modelos prontos",
    savedTemplates: "Seus modelos",
    apply: "Aplicar",
    applyLabel: (name: string) => `Aplicar ${name}`,
    deleteLabel: (name: string) => `Apagar o modelo ${name}`,
    delete: "Apagar",
    saveTitle: "Salvar como modelo",
    saveName: "Nome do modelo",
    saveNamePlaceholder: "Meu racha",
    save: "Salvar",
    saveError: "Escolha um nome de até 40 letras, sem deixar em branco.",
    moneyHint: "Em reais, de R$ 0 a R$ 1.000.",
  },
} as const;
