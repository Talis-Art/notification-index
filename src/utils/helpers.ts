import BN from "bignumber.js";

/**
 * Encodes an object to base64 string
 */
export function encodeBase64(obj: object) {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

/**
 * Decodes a base54 string to object
 */
export function decodeBase64(base64: string) {
  return JSON.parse(Buffer.from(base64, "base64").toString());
}

export const minus = (a?: BN.Value, b?: BN.Value): string =>
  new BN(a || 0).minus(b || 0).toString();
