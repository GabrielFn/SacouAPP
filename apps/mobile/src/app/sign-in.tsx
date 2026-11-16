import { SignInScreen } from "../features/auth/ui/SignInScreen";

/** Screen 02: the only route while nobody is signed in (ADR 0057, D3). */
export default function SignInRoute() {
  return <SignInScreen />;
}
