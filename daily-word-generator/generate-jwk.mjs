import crypto from 'crypto';

(async () => {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  
  const privateJWK = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const publicRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicBase64 = Buffer.from(publicRaw).toString('base64url');
  
  console.log("Private JWK:");
  console.log(JSON.stringify(privateJWK));
  console.log("\nPublic Key Base64url:");
  console.log(publicBase64);
})();
