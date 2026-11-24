// Generate an Ed25519 did:key identity for Technocore / $FLOP.
// No third-party deps: Node built-in crypto + hand-rolled base58btc.
// did:key = "did:key:z" + base58btc(0xed 0x01 || 32-byte Ed25519 pubkey)
// Writes ./agent-identity.json (chmod 600) — KEEP IT PRIVATE, never commit it.
import crypto from 'node:crypto';
import fs from 'node:fs';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Encode(buf) {
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of buf) { if (b === 0) out = '1' + out; else break; }
  return out || '1';
}
// Self-test against the classic base58 test vector.
const t = base58Encode(Buffer.from('Hello World', 'utf8'));
if (t !== 'JxF12TrwUP45BMd') { console.error('BASE58 SELF-TEST FAILED:', t); process.exit(1); }

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
const pubRaw = spkiDer.subarray(spkiDer.length - 32); // last 32 bytes = raw pubkey
const pkcs8Der = privateKey.export({ type: 'pkcs8', format: 'der' });
// PKCS#8 DER for Ed25519: 302e020100300506032b657004220420 || 32-byte seed
const seed = pkcs8Der.subarray(pkcs8Der.length - 32);
const did = 'did:key:z' + base58Encode(Buffer.concat([Buffer.from([0xed, 0x01]), pubRaw]));

// SS58 wallet (prefix 42) from the same pubkey, for the FLOP testnet faucet.
function ss58(pubkey) {
  const prefix = Buffer.from([42]);
  const payload = Buffer.concat([prefix, pubkey]);
  const hash = crypto.createHash('blake2b512').update(Buffer.concat([Buffer.from('SS58PRE', 'utf8'), payload])).digest();
  return base58Encode(Buffer.concat([payload, hash.subarray(0, 2)]));
}

const rec = {
  agent: process.env.AGENT_NAME || 'my-agent',
  did,
  ss58Wallet: ss58(pubRaw),
  publicKeyHex: Buffer.from(pubRaw).toString('hex'),
  privateSeedHex: Buffer.from(seed).toString('hex'),
  created: new Date().toISOString(),
  note: 'PRIVATE — never share the seed. Public DID only.',
};
fs.writeFileSync('./agent-identity.json', JSON.stringify(rec, null, 2), { mode: 0o600 });
console.log('DID:', did);
console.log('SS58 wallet:', rec.ss58Wallet);
console.log('Saved (chmod 600): ./agent-identity.json');
