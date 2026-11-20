import { describe, expect, it } from "vitest";

import { takeInviteToken } from "./invite-token";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCde";

function take(hash: string, search = "") {
  const replaced: string[] = [];
  const token = takeInviteToken(
    { hash, pathname: "/c", search },
    { replaceState: (_data, _unused, url) => replaced.push(url) },
  );
  return { token, replaced };
}

describe("takeInviteToken (ADR 0070, D8)", () => {
  it("reads the token and takes the fragment off the address", () => {
    expect(take(`#${TOKEN}`)).toEqual({ token: TOKEN, replaced: ["/c"] });
  });

  it("keeps the path and the query, never the fragment", () => {
    expect(take(`#${TOKEN}`, "?utm=x").replaced).toEqual(["/c?utm=x"]);
  });

  it("a malformed fragment is no token, and is cleared too", () => {
    expect(take("#<script>")).toEqual({ token: null, replaced: ["/c"] });
    expect(take(`#${TOKEN}=`)).toEqual({ token: null, replaced: ["/c"] });
  });

  it("without a fragment, nothing to clear", () => {
    expect(take("")).toEqual({ token: null, replaced: [] });
  });
});
