import { SignJWT, jwtVerify } from 'jose';

const encoder = new TextEncoder();

function secretKey() {
  const raw = (process.env.AUDIFY_AUTH_SECRET || '').trim();
  if (raw.length < 32) throw new Error('AUDIFY_AUTH_SECRET must contain at least 32 characters');
  return encoder.encode(raw);
}

export function allowedReturnUri(value) {
  return value === 'audify://auth/apple';
}

export async function createAppleState({ appState, returnUri, nonce }) {
  if (!appState || appState.length < 12 || appState.length > 180) throw new Error('Invalid app state');
  if (!allowedReturnUri(returnUri)) throw new Error('Invalid return URI');
  return new SignJWT({ kind: 'apple_state', appState, returnUri, nonce })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secretKey());
}

export async function readAppleState(token) {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
  if (payload.kind !== 'apple_state') throw new Error('Invalid Apple state');
  if (!allowedReturnUri(payload.returnUri)) throw new Error('Invalid Apple return URI');
  return payload;
}

export async function createAppleTicket({ email, name, sub, appState }) {
  if (!email || !sub || !appState) throw new Error('Incomplete Apple profile');
  return new SignJWT({ kind: 'apple_ticket', email, name: name || '', sub, appState })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime('5m')
    .sign(secretKey());
}

export async function readAppleTicket(token) {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
  if (payload.kind !== 'apple_ticket') throw new Error('Invalid Apple ticket');
  return payload;
}
