import { describe, expect, test } from "vitest";

import { qrPath } from "../ui/qr-path";
import {
  decodeIndex,
  decodeInviteLink,
  encodeInviteLink,
  inviteKeyOf,
} from "./invite-link-codec";
import { qrcodeGeneratorEncoder } from "./qrcode-generator-encoder";

const GROUP = "8a4c2f0e-1111-4c3b-9d2e-000000000001";
const TOKEN = "K7fQ2xAbCdEfGhIjKlMnOpQrStUvWxYz0123456789-";

describe("the codec of the stored invite", () => {
  test("a group ID becomes a key the system store accepts; anything else does not", () => {
    expect(inviteKeyOf(GROUP)).toBe(`sacou.invite.${GROUP}`);
    expect(inviteKeyOf("../x")).toBeNull();
    expect(inviteKeyOf("")).toBeNull();
  });

  test("what is written reads back the same", () => {
    const link = { inviteId: "i", token: TOKEN };
    expect(decodeInviteLink(encodeInviteLink(link))).toEqual(link);
  });

  test("anything else reads as nothing stored", () => {
    for (const raw of [null, "", "{", "[]", "null", '{"inviteId":1,"token":"t"}', '"t"']) {
      expect(decodeInviteLink(raw)).toBeNull();
    }
  });

  test("the index keeps only the group IDs", () => {
    expect(decodeIndex('["a", 1, "b"]')).toEqual(["a", "b"]);
    expect(decodeIndex("{}")).toEqual([]);
    expect(decodeIndex(null)).toEqual([]);
    expect(decodeIndex("not json")).toEqual([]);
  });
});

describe("the QR of an invite", () => {
  test("a 43-character token on the base gives version 5 at level M (37 modules)", () => {
    const matrix = qrcodeGeneratorEncoder.encode(`https://sacou.app/c#${TOKEN}`);
    expect(matrix.length).toBe(37);
    expect(matrix.every((row) => row.length === 37)).toBe(true);
    // The three finder patterns start dark in their corners.
    expect([matrix[0]?.[0], matrix[0]?.[36], matrix[36]?.[0]]).toEqual([true, true, true]);
  });

  test("the path draws one unit square per dark module, shifted by the quiet zone", () => {
    expect(
      qrPath(
        [
          [true, false],
          [false, true],
        ],
        4,
      ),
    ).toBe("M4 4h1v1h-1zM5 5h1v1h-1z");
  });
});
