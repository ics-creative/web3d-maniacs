const MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789=~";

/**
 * @public
 * @param {ArrayBuffer} buffer
 * @return {string}
 */
export const encode = (buffer) => {
  const u8 = new Uint8Array(buffer);
  const length = u8.length;
  let str = "";
  for (let i = 0; i < length; i++) {
    const v0 = u8[i];
    const v1 = ++i >= length ? 0 : u8[i];
    const v2 = ++i >= length ? 0 : u8[i];

    const v = (v0 << 16) | (v1 << 8) | v2;

    str += MAP.charAt(v >> 18);
    str += MAP.charAt((v >> 12) & 63);
    str += MAP.charAt((v >> 6) & 63);
    str += MAP.charAt(v & 63);
  }
  return str;
}

/**
 * @public
 * @param {string} str
 * @return {ArrayBuffer}
 */
export const decode = (str) => {
  str += ["", "A", "AA", "AAA"][str.length % 4];
  const length = str.length / 4;
  const u8 = new Uint8Array(length * 3);
  for (let i = 0; i < length; i++) {
    const s = i * 4;
    const v = (MAP.indexOf(str[s]) << 18) | (MAP.indexOf(str[s + 1]) << 12) | (MAP.indexOf(str[s + 2]) << 6) | (MAP.indexOf(str[s + 3]));

    const b = i * 3;
    u8[b] = v >> 16;
    u8[b + 1] = (v >> 8) & 255;
    u8[b + 2] = v & 255;
  }
  return u8.buffer;
}