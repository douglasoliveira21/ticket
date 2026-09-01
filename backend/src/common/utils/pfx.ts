import forge from 'node-forge';

export interface PfxData {
  cert: string;
  key: string;
  subject: string;
  validFrom: Date;
  validTo: Date;
}

/**
 * Lê um certificado PFX/P12 usando node-forge (parser ASN.1/PKCS12 puro em JS).
 * Evita o erro "Unsupported PKCS12 PFX data" que ocorre no OpenSSL 3.x (usado
 * pelo Node.js) ao processar certificados A1 antigos, exportados com algoritmos
 * de criptografia legados (ex: RC2-40-CBC), que exigem o "legacy provider".
 *
 * Retorna o certificado e a chave privada já convertidos para PEM, prontos
 * para uso em `https.request` / `tls.createSecureContext` via `{ cert, key }`.
 */
export function readPfx(buffer: Buffer, password: string): PfxData {
  let p12Asn1: forge.asn1.Asn1;
  try {
    p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(buffer.toString('binary')));
  } catch (err: any) {
    throw new Error('Arquivo de certificado inválido ou corrompido');
  }

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
  } catch (err: any) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('invalid password') || msg.includes('mac')) {
      throw new Error('Senha incorreta');
    }
    throw new Error('Não foi possível ler o certificado: ' + err.message);
  }

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]
    || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];

  if (!keyBags || keyBags.length === 0 || !keyBags[0].key) {
    throw new Error('Não foi possível encontrar a chave privada no certificado');
  }
  if (!certBags || certBags.length === 0 || !certBags[0].cert) {
    throw new Error('Não foi possível encontrar o certificado (chave pública) no arquivo');
  }

  const privateKey = keyBags[0].key;
  const certificate = certBags[0].cert;

  const keyPem = forge.pki.privateKeyToPem(privateKey);
  const certPem = forge.pki.certificateToPem(certificate);

  const subject = certificate.subject.attributes
    .map((attr) => `${attr.shortName || attr.name}=${attr.value}`)
    .join(', ');

  return {
    cert: certPem,
    key: keyPem,
    subject,
    validFrom: certificate.validity.notBefore,
    validTo: certificate.validity.notAfter,
  };
}
