import { courtStrings } from "./court.pt-BR";
import { createGroupStrings } from "./create-group.pt-BR";
import { groupsStrings } from "./groups.pt-BR";
import { inviteStrings } from "./invite.pt-BR";
import { membersStrings } from "./members.pt-BR";
import { roundsStrings } from "./rounds.pt-BR";
import { settingsStrings } from "./settings.pt-BR";

export const strings = {
  court: courtStrings,
  groups: groupsStrings,
  createGroup: createGroupStrings,
  settings: settingsStrings,
  rounds: roundsStrings,
  members: membersStrings,
  invite: inviteStrings,
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
