// Room codes (ADR 0005): 4 letters, no vowels (no words), no easily confused letters.
import { randomBytes, randomInt } from 'node:crypto';

export const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';

export function makeCode(taken: (code: string) => boolean, rand: (n: number) => number = randomInt): string {
  for (let tries = 0; tries < 1000; tries++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
    if (!taken(code)) return code;
  }
  throw new Error('no free room code');
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

export function makeToken(): string {
  return randomBytes(18).toString('base64url');
}
