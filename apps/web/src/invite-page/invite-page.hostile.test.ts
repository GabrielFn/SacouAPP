import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createInvitePage } from "./invite-page.controller";
import { takeInviteToken } from "./invite-token";

const here = __dirname;
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCde";

function sourcesOf(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.includes(".test."),
    )
    .map((entry) => readFileSync(join(dir, entry.name), "utf8"));
}

describe("the invite token never persists (ADR 0070, D8)", () => {
  it("no invite source touches sessionStorage, localStorage, cookies or the full href", () => {
    const web = join(here, "..");
    const invite = [
      ...sourcesOf(here),
      ...sourcesOf(join(web, "dom")).filter(
        (s) => s.includes("INVITE_IDS") || s.includes("invite"),
      ),
      readFileSync(join(web, "invite-main.ts"), "utf8"),
      readFileSync(join(web, "adapters", "invite-fetch-api.ts"), "utf8"),
    ].join("\n");
    expect(invite).not.toMatch(/sessionStorage|localStorage|document\.cookie|indexedDB/);
    expect(invite).not.toMatch(
      /location\.href|location\.toString|location\.assign|location\.replace/,
    );
  });

  it("uses only hash and never writes the token back into history", () => {
    const calls: string[] = [];
    takeInviteToken(
      { hash: `#${TOKEN}`, pathname: "/c", search: "?a=1" },
      { replaceState: (_d, _u, url) => calls.push(url) },
    );
    expect(calls).toEqual(["/c?a=1"]);
    expect(calls.join()).not.toContain(TOKEN);
  });

  it.each([
    "#",
    "#short",
    `#${TOKEN}x`,
    `#${TOKEN.slice(1)}`,
    `#${TOKEN.slice(0, 42)}=`,
    "#<script>alert(1)</script>",
    `# ${TOKEN}`,
    `#${TOKEN}\n`,
  ])("malformed fragment %j is no token", (hash) => {
    const replaced: string[] = [];
    const token = takeInviteToken(
      { hash, pathname: "/c", search: "" },
      { replaceState: (_d, _u, u) => replaced.push(u) },
    );
    expect(token).toBeNull();
    expect(replaced).toEqual(["/c"]);
  });

  it("a malformed token never calls the API, even signed in", async () => {
    let fetched = 0;
    const token = takeInviteToken(
      { hash: "#bad", pathname: "/c", search: "" },
      { replaceState: () => undefined },
    );
    const invite = createInvitePage({
      token,
      auth: {
        restore: () => Promise.resolve({ displayName: "Ana" }),
        signInWithGooglePopup: () => Promise.resolve({ kind: "done" }),
        signInWithGoogleRedirect: () => Promise.resolve({ kind: "done" }),
        signInWithEmail: () => Promise.resolve({ kind: "done" }),
        signUpWithEmail: () => Promise.resolve({ kind: "done" }),
        sendPasswordReset: () => Promise.resolve({ kind: "done" }),
        currentUser: () => ({ displayName: "Ana" }),
        idToken: () => Promise.resolve("t"),
        signOut: () => Promise.resolve(),
      },
      api: {
        register: () => (fetched++, Promise.reject(new Error("must not be called"))),
        preview: () => (fetched++, Promise.reject(new Error("must not be called"))),
        accept: () => (fetched++, Promise.reject(new Error("must not be called"))),
      },
      onChange: () => undefined,
    });
    await invite.start();
    await invite.join();
    await invite.tapSignIn();
    expect(fetched).toBe(0);
  });
});
