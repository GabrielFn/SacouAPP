import { accountStrings } from "./account.pt-BR";
import { authStrings } from "./auth.pt-BR";
import { courtStrings } from "./court.pt-BR";
import { courtPlayersStrings } from "./court-players.pt-BR";
import { createGroupStrings } from "./create-group.pt-BR";
import { drawStrings } from "./draw.pt-BR";
import { groupsStrings } from "./groups.pt-BR";
import { inviteStrings } from "./invite.pt-BR";
import { lineupStrings } from "./lineup.pt-BR";
import { membersStrings } from "./members.pt-BR";
import { mvpVoteStrings } from "./mvp-vote.pt-BR";
import { notificationsStrings } from "./notifications.pt-BR";
import { profileStrings } from "./profile.pt-BR";
import { ratingsStrings } from "./ratings.pt-BR";
import { roundsStrings } from "./rounds.pt-BR";
import { settingsStrings } from "./settings.pt-BR";
import { summaryStrings } from "./summary.pt-BR";

export const strings = {
  auth: authStrings,
  profile: profileStrings,
  account: accountStrings,
  court: courtStrings,
  courtPlayers: courtPlayersStrings,
  groups: groupsStrings,
  notifications: notificationsStrings,
  createGroup: createGroupStrings,
  settings: settingsStrings,
  rounds: roundsStrings,
  summary: summaryStrings,
  mvpVote: mvpVoteStrings,
  draw: drawStrings,
  lineup: lineupStrings,
  members: membersStrings,
  invite: inviteStrings,
  ratings: ratingsStrings,
  appName: "Sacou",
  a11y: { createGroup: "Criar grupo", back: "Voltar", logo: "Logo do Sacou" },
  catalog: {
    title: "Catálogo de componentes",
    buttonPrimary: "Criar grupo",
    buttonSecondary: "Entrar no grupo",
    buttonLink: "Já tenho conta",
    chipRadio: "Sábado",
    chipToggle: "Quinta",
    fieldLabel: "Nome do grupo",
    fieldHelp: "Aparece para todos os jogadores",
    fieldPlaceholder: "Racha da Quinta",
    cardTitle: "Racha da Quinta",
    cardBody: "Hoje, 20h",
    statusConfirmed: "Confirmado",
    statusWaiting: "Espera",
    statusPay: "Pagar",
    source: "Tela de origem",
    themeApp: "Tema Areia (app)",
    themeCourtSun: "Tema Sol (quadra)",
    themeCourtNight: "Tema Noite (quadra)",
  },
} as const;
