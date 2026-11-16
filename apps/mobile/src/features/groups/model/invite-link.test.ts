import { describe, expect, test } from "vitest";

import {
  displayInviteLink,
  inviteLink,
  inviteMessage,
  parseInviteBaseUrl,
  whatsappUrl,
} from "./invite-link";
import { initialInviteScreenState, inviteScreenReducer } from "./invite-screen.reducer";
import { initialMembersScreenState, membersScreenReducer } from "./members-screen.reducer";

const TOKEN = "K7fQ2xAbCdEfGhIjKlMnOpQrStUvWxYz0123456789-";

describe("the invite link", () => {
  test("the token goes after the #, never in the path", () => {
    expect(inviteLink("https://sacou.app", "t")).toBe("https://sacou.app/c#t");
  });

  test("the screen shows the host and 6 characters of the token", () => {
    expect(displayInviteLink("https://sacou.app", TOKEN)).toBe("sacou.app/c#K7fQ2x…");
  });

  test("an origin with https is the base; a path, a query or a fragment is refused", () => {
    expect(parseInviteBaseUrl("https://sacou.app", false)).toBe("https://sacou.app");
    expect(parseInviteBaseUrl("HTTPS://Sacou.App", false)).toBe("https://sacou.app");
    for (const wrong of [
      "https://sacou.app/",
      "https://sacou.app/c",
      "https://sacou.app?x=1",
      "https://sacou.app#x",
      "https://user@sacou.app",
      "ftp://sacou.app",
      "sacou.app",
    ]) {
      expect(parseInviteBaseUrl(wrong, true)).toBeNull();
    }
  });

  test("http is only for a development build", () => {
    expect(parseInviteBaseUrl("http://192.168.0.10:8080", false)).toBeNull();
    expect(parseInviteBaseUrl("http://192.168.0.10:8080", true)).toBe("http://192.168.0.10:8080");
  });

  test("without the variable there is no invite", () => {
    expect(parseInviteBaseUrl(undefined, true)).toBeNull();
    expect(parseInviteBaseUrl("", true)).toBeNull();
  });

  test("WhatsApp gets the message through its app scheme, never wa.me", () => {
    const message = inviteMessage("Racha de terça", "https://sacou.app/c#t");
    expect(message).toBe("Entra no Racha de terça no Sacou: https://sacou.app/c#t");
    expect(whatsappUrl(message)).toBe(`whatsapp://send?text=${encodeURIComponent(message)}`);
    expect(whatsappUrl(message)).not.toContain("#");
  });
});

describe("the reducers of screens 19 and 19d hold no token", () => {
  test("the sheet and the confirmations, one at a time", () => {
    const opened = membersScreenReducer(initialMembersScreenState, {
      type: "sheet-opened",
      memberId: "m",
    });
    expect(opened).toEqual({ sheetMemberId: "m", level: null, confirm: null });
    const leaving = membersScreenReducer(opened, { type: "leave-asked" });
    expect(leaving).toEqual({ sheetMemberId: null, level: null, confirm: { kind: "leave" } });
    const revoking = membersScreenReducer(leaving, { type: "revoke-asked", inviteId: "i" });
    expect(revoking.confirm).toEqual({ kind: "revoke-invite", inviteId: "i" });
    expect(membersScreenReducer(revoking, { type: "confirm-closed" })).toEqual(
      initialMembersScreenState,
    );
    expect(membersScreenReducer(opened, { type: "sheet-closed" })).toEqual(
      initialMembersScreenState,
    );
  });

  test("a new link clears 'Link copiado' and the confirmation", () => {
    const copied = inviteScreenReducer(initialInviteScreenState, { type: "copied" });
    const asked = inviteScreenReducer(copied, { type: "regenerate-asked" });
    expect(asked).toEqual({ confirmingRegenerate: true, copied: true });
    expect(inviteScreenReducer(asked, { type: "regenerate-closed" }).confirmingRegenerate).toBe(
      false,
    );
    expect(inviteScreenReducer(asked, { type: "link-changed" })).toEqual(initialInviteScreenState);
  });
});
