import { EditProfileScreen } from "../../features/profile/ui/EditProfileScreen";
import { useSession } from "../../services/auth/use-session";

/** Screen 27 in edit mode, opened from the nickname row of screen 30 (question 60). */
export default function EditProfileRoute() {
  const session = useSession();
  return session.status === "signedIn" ? <EditProfileScreen account={session.account} /> : null;
}
