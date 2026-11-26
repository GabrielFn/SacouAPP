/** Texts of "Denunciar" (E6.6): the line on the sheet 19c and on screen 18, and the sheet of the reasons. */
export const reportStrings = {
  memberAction: "Denunciar",
  groupAction: "Denunciar grupo",
  groupActionHelp: "Nome ou local do grupo com conteúdo ofensivo",
  memberTitle: (name: string) => `Denunciar ${name}`,
  groupTitle: "Denunciar grupo",
  intro: "Escolha o motivo. Ninguém do grupo fica sabendo quem denunciou.",
  reasonsLabel: "Motivo da denúncia",
  reasons: {
    offensiveName: "Nome ou apelido ofensivo",
    hateOrSexual: "Ódio, assédio ou conteúdo sexual",
    impersonation: "Se passando por outra pessoa",
    spam: "Spam ou propaganda",
  },
  submit: "Enviar denúncia",
  sent: "Denúncia enviada. O Sacou vai analisar.",
  close: "Fechar",
} as const;
