import createQrCode from "qrcode-generator";

import type { QrEncoder, QrMatrix } from "../services/qr/qr-encoder";

/** The smallest version that fits the text (`0`), error correction M (ADR 0049, D7). */
const AUTO_VERSION = 0;
const ERROR_CORRECTION = "M";

export const qrcodeGeneratorEncoder: QrEncoder = {
  encode: (text): QrMatrix => {
    const code = createQrCode(AUTO_VERSION, ERROR_CORRECTION);
    code.addData(text, "Byte");
    code.make();
    const size = code.getModuleCount();
    const indexes = Array.from({ length: size }, (_, index) => index);
    return indexes.map((row) => indexes.map((column) => code.isDark(row, column)));
  },
};
