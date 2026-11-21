const PREFIX = "sacou-cartinha-";
const EXTENSION = ".png";
const PART_LENGTH = 2;
const MONTH_OFFSET = 1;

const pad = (value: number) => String(value).padStart(PART_LENGTH, "0");

/** `sacou-cartinha-20261121-153045.png`: the moment on the phone, and nothing of the person. */
export function cardFileName(now: Date): string {
  const day = `${String(now.getFullYear())}${pad(now.getMonth() + MONTH_OFFSET)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${PREFIX}${day}-${time}${EXTENSION}`;
}
