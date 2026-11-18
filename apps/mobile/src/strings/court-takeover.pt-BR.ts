// Texts of taking the court over (screens 09a, 09b and 09c, E4.11). Plain functions interpolate.
// Names come without an article: the app does not know how each person is called.

const CLOCK_DIGITS = 2;
const score = (a: number, b: number) => `${String(a)} × ${String(b)}`;

export const courtTakeoverStrings = {
  // Screen 09a (AssumirQuadra.dc.html), without "Só olhar" (answer 75), closed by "Voltar" (answer 82).
  takeover: {
    title: "Outro celular está marcando",
    bodyNamed: (name: string) =>
      `${name} está marcando esta quadra. Se você assumir, o outro celular para de marcar.`,
    bodyUnnamed: "Outro celular está marcando esta quadra. Se você assumir, ele para de marcar.",
    lastPointNow: "Último ponto que chegou, agora há pouco",
    lastPointAgo: (minutes: number) => `Último ponto que chegou, há ${String(minutes)} min`,
    noPointYet: "Nenhum ponto chegou ainda",
    scoreLine: (a: number, b: number) => `Laranja ${score(a, b)} Azul`,
    noMatchOpen: "Nenhuma partida aberta agora",
    check: "Confira o placar com a quadra antes de seguir.",
    confirm: "Assumir o placar",
    back: "Voltar",
    loading: "Carregando o placar...",
    importing: (imported: number, total: number) =>
      `Carregando o placar... ${String(imported)} de ${String(total)}`,
    reading: "Lendo a quadra...",
    streamChanged: "O placar mudou enquanto você confirmava. Confira de novo antes de assumir.",
    retry: "Tentar de novo",
    failures: {
      "import-invalid": "O placar do servidor veio com defeito. Nada mudou neste celular.",
      "writers-limit": "Esta quadra não aceita mais trocas de celular.",
      "no-account": "Entre com sua conta para assumir a quadra.",
      "no-permission": "Sua conta não marca esta quadra. Peça ao admin para conferir.",
      "not-found": "Esta rodada não tem quadra aberta no servidor.",
      offline: "Sem internet. Conecte para assumir a quadra.",
      failed: "Não deu para assumir a quadra. Tente de novo.",
    },
  },
  // A round court opened without an account (ADR 0067, D8): its points are never sent.
  unowned: {
    title: "Esta quadra foi aberta sem conta",
    body: "Os pontos dela não vão para o servidor. Para seguir marcando, assuma a quadra com a sua conta.",
    leave: "Sair da quadra",
    takeOver: "Assumir a quadra",
  },
  // Before taking over a court with points of this phone the server never got (S4 of the review).
  discard: {
    title: (points: number) =>
      points === 1
        ? "1 ponto não enviado vai ficar de fora"
        : `${String(points)} pontos não enviados vão ficar de fora`,
    body: "Eles foram marcados neste celular e não chegaram ao servidor. Ao assumir, este celular fica com o placar do servidor.",
    confirm: "Assumir mesmo assim",
    cancel: "Cancelar",
  },
  // Screen 09b (PlacarAssumido.dc.html), with the text of answer 83.
  takenOver: {
    title: "Outro celular assumiu o placar",
    titleNamed: (name: string) => `${name} assumiu o placar`,
    body: "Este celular parou de marcar.",
    bodyAt: (time: string) => `Às ${time}. Este celular parou de marcar.`,
    leave: "Sair da quadra",
    takeBack: "Assumir de volta",
  },
  // Screen 09c (PontosRecusados.dc.html). The envelopes have no time: each row has the score only.
  refused: {
    title: (count: number) =>
      count === 1 ? "1 ponto não entrou" : `${String(count)} pontos não entraram`,
    undoTitle: "Um “Desfazer” não entrou",
    bodyNamed: (name: string, time: string) =>
      `${name} assumiu o placar às ${time}. Estes pontos foram marcados neste celular depois disso, sem internet, e ficaram de fora.`,
    bodyUnnamed:
      "Outro celular assumiu o placar. Estes pontos foram marcados neste celular depois disso, sem internet, e ficaram de fora.",
    bodyOtherFirst:
      "Outro celular já marcava esta quadra. Estes pontos foram marcados neste celular e ficaram de fora.",
    point: (team: string) => `Ponto do ${team}`,
    score,
    undoLeftOut:
      "Um “Desfazer” feito neste celular também ficou de fora: o ponto continua valendo.",
    askFixNamed: (name: string) => `Se algum valeu, peça para ${name} corrigir na quadra.`,
    askFix: "Se algum valeu, peça para quem está com a quadra corrigir.",
    understood: "Entendi",
  },
  clockTime: (hours: number, minutes: number) =>
    `${String(hours).padStart(CLOCK_DIGITS, "0")}h${String(minutes).padStart(CLOCK_DIGITS, "0")}`,
} as const;
