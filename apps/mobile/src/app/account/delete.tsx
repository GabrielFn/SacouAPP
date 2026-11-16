import { DeleteAccountScreen } from "../../features/account/ui/DeleteAccountScreen";
import { useSession } from "../../services/auth/use-session";

/** Screen 30b: the provider of the session decides how the login is asked again. */
export default function DeleteAccountRoute() {
  const session = useSession();
  return session.status === "signedIn" ? (
    <DeleteAccountScreen provider={session.account.provider} />
  ) : null;
}
