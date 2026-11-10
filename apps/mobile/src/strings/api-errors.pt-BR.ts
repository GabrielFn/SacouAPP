import type { ApiErrorCode } from "../api/generated/error-codes";

/**
 * What the person reads for each rule error of the API, by `code` (ADR 0039 and 0042). A `Record` over the
 * generated union: a new code without a text, or a text for a code that is gone, does not compile. A code
 * this app does not know (an older app against a newer API) never reaches the screen as raw text.
 */
export const apiErrorTexts: Readonly<Record<ApiErrorCode, string>> = {
  "groups.forbidden": "Você não tem permissão para fazer isso neste grupo.",
  "groups.group-not-found": "Esse grupo não existe ou você não faz mais parte dele.",
  "groups.invite-invalid": "Esse convite não vale mais. Peça um link novo a quem organiza o grupo.",
  "groups.invite-limit":
    "O grupo já tem o máximo de convites ativos. Revogue um antes de criar outro.",
  "groups.invite-not-found": "Esse convite não existe mais.",
  "groups.last-admin": "O grupo precisa de pelo menos um admin. Promova outra pessoa antes.",
  "groups.member-limit": "O grupo já está com o número máximo de membros.",
  "groups.member-not-found": "Essa pessoa não faz mais parte do grupo.",
  "groups.member-removed": "Você foi removido deste grupo e não pode voltar por este link.",
  "groups.membership-limit":
    "Você já está no número máximo de grupos. Saia de algum para entrar neste.",
  "groups.name-invalid": "Escolha um nome de até 60 letras, sem deixar em branco.",
  "groups.regular-needs-account": "Só quem tem conta no Sacou pode ser mensalista.",
  "groups.settings-invalid":
    "Alguma configuração não é válida. Confira os valores e tente de novo.",
  "groups.template-limit":
    "O grupo já tem o máximo de modelos salvos. Apague um para salvar outro.",
  "groups.template-name-invalid":
    "Escolha um nome de até 40 letras para o modelo, sem deixar em branco.",
  "groups.template-not-found": "Esse modelo não existe mais.",
  "groups.use-leave": "Para sair do grupo, use a opção Sair do grupo.",
  "identity.subject-invalid": "Não deu para confirmar sua conta. Entre de novo.",
  "identity.user-not-registered": "Estamos terminando de preparar sua conta. Tente de novo.",
};

/** What the person reads for the other kinds of `ApiError` (E4.2, D5). */
export const apiErrorKindTexts = {
  sessionExpired: "Sua sessão acabou. Entre de novo.",
  notRegistered: "Estamos terminando de preparar sua conta. Tente de novo.",
  tooLarge: "Esse conteúdo é grande demais.",
  unavailable: "O Sacou está fora do ar por um instante. Tentando de novo.",
  offline: "Sem conexão.",
  unexpected: "Algo deu errado. Tente de novo daqui a pouco.",
} as const;

/** The strip over data kept from the last time, without a network (question 20, option 1). */
export const offlineTexts = {
  banner: (updated: string) => `Sem conexão · atualizado ${updated}`,
  justNow: "agora há pouco",
  minutesAgo: (minutes: number) => `há ${String(minutes)} min`,
  hoursAgo: (hours: number) => `há ${String(hours)} h`,
  daysAgo: (days: number) => (days === 1 ? "há 1 dia" : `há ${String(days)} dias`),
} as const;
