import type { AuthFailure, SignOutReason } from "../services/auth/auth-session";

/** Texts of the login (screen 02) and of the e-mail sheet (question 61, the pattern of screen 30a). */
export const authStrings = {
  // The top of screen 02 without the context of a round (question 61, option 1).
  heroTitle: "Seu racha organizado.",
  heroBody: "Entre para ver seus grupos e confirmar as rodadas.",
  sheetTitle: "Entrar pra confirmar",
  sheetBody: "É só uma vez. Depois você confirma qualquer rodada com um toque.",
  google: "Entrar com Google",
  // The letter of the white badge of the Google button, hidden from the screen reader.
  googleMark: "G",
  apple: "Entrar com Apple",
  email: "Usar e-mail e senha",
  privacy: "Seu nome aparece só pra galera do grupo.",
  legal: {
    before: "Ao entrar você aceita os ",
    terms: "Termos",
    between: " e a ",
    privacy: "Política de Privacidade",
    after: ".",
  },
  reasons: {
    expired: "Sua sessão acabou. Entre de novo.",
    deleted: "Sua conta foi excluída.",
  } satisfies Partial<Record<SignOutReason, string>>,
  failures: {
    offline: "Sem conexão. Confira a internet e tente de novo.",
    "invalid-credentials": "E-mail ou senha incorretos.",
    "email-unavailable":
      "Não deu para criar a conta com esse e-mail. Tente entrar ou recuperar a senha.",
    "weak-password": "A senha precisa de pelo menos 6 caracteres.",
    "too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.",
    "provider-unavailable": "Esse jeito de entrar não funciona neste celular. Tente outro.",
    unexpected: "Não deu para entrar agora. Tente de novo.",
  } satisfies Record<Exclude<AuthFailure, "cancelled">, string>,
  emailSheet: {
    signInTitle: "Entrar com e-mail",
    resetTitle: "Recuperar a senha",
    modes: "Entrar ou criar conta",
    signInTab: "Entrar",
    signUpTab: "Criar conta",
    emailLabel: "E-mail",
    emailInvalid: "Confira o e-mail.",
    passwordLabel: "Senha",
    passwordRule: "Pelo menos 6 caracteres",
    signIn: "Entrar",
    signUp: "Criar conta",
    forgot: "Esqueci a senha",
    resetBody: "Digite o e-mail da conta. Mandamos um link para criar uma senha nova.",
    sendReset: "Mandar link",
    // The same answer whether the account exists or not: the screen is no oracle (D7).
    resetSent: "Se houver uma conta com esse e-mail, mandamos um link.",
    backToSignIn: "Voltar para entrar",
  },
} as const;
