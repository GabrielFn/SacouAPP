import type { Failure, FailureKind, Standing } from "./round-page/round-page.types";

/** What the page knows of the avulsos' window, read from the server's `data-` attributes; the invite page has none. */
export interface DropInContext {
  /** "hoje, às 20h", "amanhã, às 20h" or "na terça, 24/11, às 20h"; empty when the server found nothing to wait for. */
  readonly phrase: string;
  /** Whether the round's list has a mensalista: the sentence differs for a group of avulsos only. */
  readonly hasRegulars: boolean;
}

export const NO_DROP_IN_CONTEXT: DropInContext = { phrase: "", hasRegulars: true };

/**
 * The texts the script writes on the round page and on the invite page. The texts the server renders (screen 01 and the sheet of
 * screen 02) live in `Sacou.Api/Web/WebTexts.cs`; both are pt-BR and centralized.
 */
export const webStrings = {
  going: (position: number | null) =>
    position === null ? "Você vai." : `Você vai. Sua vaga é a ${String(position)}ª.`,
  waitlisted: (position: number | null) =>
    position === null ? "Você está na espera." : `Na espera, ${String(position)}º.`,
  notGoing: "Você marcou que não vai.",
  notGoingAnymore: "NÃO VOU MAIS",
  notGoingLabel: "NÃO VOU",
  working: "Um instante…",
  resetSent: "Se houver uma conta com esse e-mail, mandamos um link.",
  joinedPrefix: "Você entrou no grupo. ",
  sheet: {
    choice: "Entrar pra confirmar",
    signIn: "Entrar com e-mail",
    signUp: "Criar conta",
    reset: "Recuperar a senha",
    nickname: "Como te chamam na quadra?",
  },
  submit: {
    signIn: "Entrar",
    signUp: "Criar conta",
    reset: "Mandar link",
  },
  failures: {
    offline: "Sem conexão com o Sacou agora. Tente de novo.",
    rateLimited: "Muitas tentativas. Tente de novo em alguns segundos.",
    linkInvalid: "Link inválido. Peça um novo para quem organiza.",
    inviteInvalid: "Link inválido ou desativado.",
    roundClosed: "Essa rodada já fechou.",
    removed: "Você não pode mais entrar nesse grupo pelo link.",
    groupFull: "Não deu para entrar: o grupo ou a sua conta chegou ao limite.",
    accountDeleted: "Sua conta foi excluída.",
    nicknameInvalid: "Use letras, números ou emojis, até 20, sem símbolos invisíveis.",
    /** Without the phrase (a race at the edge of the window) the server's refusal has no day to show. */
    dropInWindowClosed: "A lista dos avulsos ainda não abriu.",
    roundFull: "A rodada lotou e não tem espera.",
    invalidCredentials: "E-mail ou senha incorretos.",
    emailUnavailable:
      "Não deu para criar a conta com esse e-mail. Tente entrar ou recuperar a senha.",
    weakPassword: "A senha precisa de pelo menos 6 caracteres.",
    tooManySignIns: "Muitas tentativas. Espere alguns minutos e tente de novo.",
    providerUnavailable: "Esse jeito de entrar não funciona aqui. Use o e-mail.",
    unexpected: "Não deu certo agora. Tente de novo.",
  } satisfies Record<FailureKind, string>,
  /** The invite page (`/c`, ADR 0070, D8); the server renders only its first words (`WebTexts.cs`). */
  invite: {
    title: "Convite para um grupo no Sacou",
    signInHint: "Entre para ver o grupo do convite.",
    signIn: "ENTRAR PRA VER O CONVITE",
    retry: "VER O CONVITE",
    sheetTitle: "Entrar pra ver o convite",
    members: (count: number) => (count === 1 ? "1 membro" : `${String(count)} membros`),
    joined: "Você entrou. Baixe o app para ver as rodadas.",
    alreadyMember: "Você já está nesse grupo. Abra o app para ver as rodadas.",
  },
  /** The window refusal with the day: the avulso waits, the mensalistas already confirm. */
  dropInWindowClosedWhen: (phrase: string, hasRegulars: boolean) =>
    hasRegulars
      ? `A lista abre para você ${phrase}. Até lá, só os mensalistas confirmam.`
      : `A lista abre ${phrase}.`,
  retryIn: (seconds: number) => `Muitas tentativas. Tente de novo em ${String(seconds)} s.`,
} as const;

/** The sentence of a failure; the refusals after the group step say that the person came in anyway (ADR 0070, D2). */
export function failureText(
  failure: Failure,
  dropIn: DropInContext = NO_DROP_IN_CONTEXT,
): string {
  if (failure.kind === "rateLimited") return webStrings.retryIn(failure.retryAfterSeconds);
  const text =
    failure.kind === "dropInWindowClosed" && dropIn.phrase !== ""
      ? webStrings.dropInWindowClosedWhen(dropIn.phrase, dropIn.hasRegulars)
      : webStrings.failures[failure.kind];
  const joined =
    (failure.kind === "dropInWindowClosed" || failure.kind === "roundFull") && failure.joined;
  return joined ? webStrings.joinedPrefix + text : text;
}

export function standingText(standing: Standing): string {
  switch (standing.status) {
    case "going":
    case "promoted":
      return webStrings.going(standing.position);
    case "waitlisted":
      return webStrings.waitlisted(standing.position);
    case "notGoing":
      return webStrings.notGoing;
  }
}
