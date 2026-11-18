import type { ApiErrorCode } from "../api/generated/error-codes";

/** The 429 of the API's rate limit (ADR 0062), by its kind and by its code. */
const RATE_LIMITED_TEXT = "Muitas tentativas em pouco tempo. Espere um pouco e tente de novo.";

/**
 * What the person reads for each rule error of the API, by `code` (ADR 0039 and 0042). A `Record` over the
 * generated union: a new code without a text, or a text for a code that is gone, does not compile. A code
 * this app does not know (an older app against a newer API) never reaches the screen as raw text.
 */
export const apiErrorTexts: Readonly<Record<ApiErrorCode, string>> = {
  "api.rate-limited": RATE_LIMITED_TEXT,
  "groups.forbidden": "Você não tem permissão para fazer isso neste grupo.",
  "groups.group-not-found": "Esse grupo não existe ou você não faz mais parte dele.",
  "groups.invite-invalid": "Esse convite não vale mais. Peça um link novo a quem organiza o grupo.",
  "groups.invite-limit":
    "O grupo já tem o máximo de convites ativos. Revogue um antes de criar outro.",
  "groups.invite-not-found": "Esse convite não existe mais.",
  "groups.last-admin": "O grupo precisa de pelo menos um admin. Promova outra pessoa antes.",
  "groups.guest-invalid": "Confira a posição do convidado e tente de novo.",
  "groups.guest-name-invalid": "Escreva o nome ou apelido do convidado, com até 20 letras.",
  "groups.level-invalid": "Escolha uma nota de 1 a 5, de meio em meio ponto, ou Não sei.",
  "groups.member-limit": "O grupo já está com o número máximo de membros.",
  "groups.member-not-found": "Essa pessoa não faz mais parte do grupo.",
  "groups.member-removed": "Você foi removido deste grupo e não pode voltar por este link.",
  "groups.membership-limit":
    "Você já está no número máximo de grupos. Saia de algum para entrar neste.",
  "groups.name-invalid": "Escolha um nome de até 60 letras, sem deixar em branco.",
  "groups.regular-needs-account": "Só quem tem conta no Sacou pode ser mensalista.",
  "groups.role-needs-account": "Convidado sem conta só pode ser jogador.",
  "groups.settings-invalid":
    "Alguma configuração não é válida. Confira os valores e tente de novo.",
  "groups.template-limit":
    "O grupo já tem o máximo de modelos salvos. Apague um para salvar outro.",
  "groups.template-name-invalid":
    "Escolha um nome de até 40 letras para o modelo, sem deixar em branco.",
  "groups.template-not-found": "Esse modelo não existe mais.",
  "groups.use-leave": "Para sair do grupo, use a opção Sair do grupo.",
  "identity.account-deleted": "Esta conta foi excluída.",
  "identity.deletion-blocked":
    "Você é o único admin de um grupo. Passe o papel para alguém antes de excluir.",
  "identity.nickname-invalid": "Escolha um apelido de até 20 letras, sem deixar em branco.",
  "identity.profile-invalid": "Confira as posições e o nível escolhidos e tente de novo.",
  "identity.profile-not-found": "Você ainda não preencheu seu perfil.",
  "identity.recent-login-required": "Por segurança, entre de novo antes de excluir a conta.",
  "identity.subject-invalid": "Não deu para confirmar sua conta. Entre de novo.",
  "identity.user-not-registered": "Estamos terminando de preparar sua conta. Tente de novo.",
  "matches.batch-invalid": "Os pontos chegaram fora de ordem. O app vai enviar de novo.",
  "matches.batch-mismatch": "Este celular não está mais com a quadra.",
  "matches.court-session-not-found": "Essa quadra não existe nesta rodada.",
  "matches.event-id-conflict": "Um ponto chegou diferente do que já estava salvo.",
  "matches.event-implausible": "Um ponto não confere com o placar e não foi salvo.",
  "matches.event-rejected": "Um ponto não confere com a partida e não foi salvo.",
  "matches.event-too-large": "Um ponto chegou grande demais e não foi salvo.",
  "matches.invalid-envelope": "Um ponto chegou com defeito e não foi salvo.",
  "matches.limit-reached": "A quadra chegou ao limite de pontos desta rodada.",
  "matches.member-not-in-group": "Alguém na partida não faz parte deste grupo.",
  "matches.not-the-writer": "Outro celular está com a quadra.",
  "matches.round-canceled": "Esta rodada foi cancelada.",
  "matches.round-has-court-session": "Esta rodada já tem uma quadra aberta em outro celular.",
  "matches.sequence-conflict": "Outro celular está usando a mesma quadra.",
  "matches.sequence-gap": "Faltam pontos no envio. O app vai enviar de novo.",
  "matches.stream-changed":
    "O placar mudou enquanto você confirmava. Confira de novo antes de assumir.",
  "matches.stream-mismatch": "Os pontos são de outra quadra.",
  "matches.takeover-invalid": "Não deu para assumir a quadra. Tente de novo.",
  "matches.unknown-event-type": "Este app enviou algo que o servidor não conhece. Atualize o app.",
  "matches.unsupported-schema-version": "Atualize o app para enviar os pontos.",
  "sessions.attendance-disabled": "A presença está desligada nesta rodada.",
  "sessions.draw-disabled": "O sorteio está desligado nesta rodada.",
  // "24" is DrawLimits.MaxLocks in apps/api/src/Sacou.Modules/Sessions/Domain/Draw/DrawLimits.cs.
  "sessions.draw-lock-invalid":
    "Só dá para travar duas pessoas diferentes que estão nos times, sem repetir, até 24 travas.",
  "sessions.draw-lock-too-large": "Tem gente demais travada junta para caber num time.",
  "sessions.draw-locks-conflict": "Duas pessoas estão travadas juntas e separadas ao mesmo tempo.",
  "sessions.draw-locks-unsatisfiable":
    "Não dá para montar os times respeitando todas as travas. Tire uma e sorteie de novo.",
  // "4" is DrawLimits.MinPlayers in apps/api/src/Sacou.Modules/Sessions/Domain/Draw/DrawLimits.cs.
  "sessions.draw-not-enough-players": "O sorteio precisa de pelo menos 4 confirmados.",
  "sessions.draw-reserves-invalid": "Confira os reservas: cada um uma vez, só quem confirmou.",
  "sessions.drop-in-window-closed":
    "A lista ainda não abriu para avulsos. Tente de novo mais perto da rodada.",
  "sessions.member-not-found": "Essa pessoa não faz parte deste grupo.",
  "sessions.round-closed": "Esta rodada não aceita mais mudanças.",
  "sessions.round-date-taken": "Essa repetição já tem uma rodada nesse dia. Escolha outra data.",
  "sessions.round-full": "A rodada está cheia e a lista de espera está desligada.",
  "sessions.round-invalid": "Confira a data, a hora e o local da rodada.",
  "sessions.round-limit":
    "O grupo já tem rodadas demais marcadas. Cancele uma antes de criar outra.",
  "sessions.round-not-found": "Essa rodada não existe mais.",
  "sessions.series-limit":
    "O grupo já tem o máximo de rodadas que se repetem. Pare uma antes de criar outra.",
  "sessions.series-not-found": "Essa repetição não existe mais.",
};

/** What the person reads for the other kinds of `ApiError` (E4.2, D5). */
export const apiErrorKindTexts = {
  sessionExpired: "Sua sessão acabou. Entre de novo.",
  notRegistered: "Estamos terminando de preparar sua conta. Tente de novo.",
  tooLarge: "Esse conteúdo é grande demais.",
  rateLimited: RATE_LIMITED_TEXT,
  unavailable: "O Sacou está fora do ar por um instante. Tentando de novo.",
  offline: "Sem conexão.",
  accountChanged: "A conta mudou antes do envio. Nada foi enviado.",
  unexpected: "Algo deu errado. Tente de novo daqui a pouco.",
} as const;

/** The strip over data kept from the last time, without a network (question 20, option 1). */
export const offlineTexts = {
  banner: (updated: string) => `Sem conexão · atualizado ${updated}`,
  bannerNow: "Sem conexão",
  minutesAgo: (minutes: number) => `há ${String(minutes)} min`,
  hoursAgo: (hours: number) => `há ${String(hours)} h`,
  daysAgo: (days: number) => (days === 1 ? "há 1 dia" : `há ${String(days)} dias`),
} as const;
