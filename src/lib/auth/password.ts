import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** OWASP scrypt profile N = 2^15, r = 8, p = 3 (32 MiB per hash); maxmem leaves room above Node's 32 MiB default. */
const SCRYPT_OPTIONS = { N: 2 ** 15, r: 8, p: 3 } as const;
const MAX_MEMORY = 64 * 1024 * 1024;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const deriveKey = (password: string, salt: Buffer, keyLength: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, { ...options, maxmem: MAX_MEMORY }, (error, key) => (error ? reject(error) : resolve(key)));
  });

/** Stored as `scrypt$N$r$p$salt$key` (base64url): the parameters travel with the hash. */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  const { N, r, p } = SCRYPT_OPTIONS;
  return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
};

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [scheme, N, r, p, salt, key] = storedHash.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await deriveKey(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return timingSafeEqual(actual, expected);
};
