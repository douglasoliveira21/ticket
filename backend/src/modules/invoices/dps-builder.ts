import { SignedXml } from 'xml-crypto';

/**
 * Construção e assinatura do XML da DPS (Declaração de Prestação de Serviço),
 * conforme DPS_v1.01.xsd do Sistema Nacional NFS-e (gov.br/nfse).
 */

export interface DpsData {
  cLocEmi: string; // codigo IBGE do municipio emissor (ex: 3106200 para BH)
  cnpjPrestador: string;
  inscricaoMunicipalPrestador: string;
  razaoSocialPrestador: string;
  regimeTributario: string | null; // '1' Simples Nacional | '2' Simples Nacional Excesso | '3' Regime Normal
  cpfCnpjTomador: string;
  nomeTomador: string;
  emailTomador?: string;
  cTribNac: string; // codigo de tributacao nacional (6 digitos)
  descricaoServico: string;
  valorServico: number;
  serieDps: string; // ate 5 digitos
  numeroDps: string | number; // ate 15 digitos, sem zero a esquerda
  dataEmissao: Date; // data/hora de emissao da DPS
  dataCompetencia: Date; // data de inicio da prestacao do servico
}

function pad(value: string, length: number): string {
  return value.padStart(length, '0');
}

function tipoInscricaoFederal(documento: string): { tipo: '1' | '2'; inscricao: string } {
  const digits = documento.replace(/\D/g, '');
  if (digits.length === 14) return { tipo: '2', inscricao: digits }; // CNPJ
  return { tipo: '1', inscricao: pad(digits, 14) }; // CPF, zero a esquerda
}

/**
 * Monta o identificador da DPS (45 posicoes), conforme TSIdDPS:
 * "DPS" + CodMunIBGE(7) + TipoInscricaoFederal(1) + InscricaoFederal(14) + Serie(5) + Numero(15)
 */
export function buildIdDps(cLocEmi: string, cnpjPrestador: string, serieDps: string, numeroDps: string | number): string {
  const { tipo, inscricao } = tipoInscricaoFederal(cnpjPrestador);
  return (
    'DPS' +
    pad(cLocEmi, 7) +
    tipo +
    inscricao +
    pad(serieDps, 5) +
    pad(String(numeroDps), 15)
  );
}

function toUtcDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, '-03:00');
}

function toDataCompetencia(date: Date): string {
  return date.toISOString().split('T')[0];
}

function mapRegimeTributario(regime: string | null): { opSimpNac: string; regApTribSN?: string; regEspTrib: string } {
  switch (regime) {
    case '1': // Simples Nacional
      return { opSimpNac: '3', regEspTrib: '0' };
    case '2': // Simples Nacional - Excesso de sublimite (ISS apurado fora do SN)
      return { opSimpNac: '3', regApTribSN: '2', regEspTrib: '0' };
    case '3': // Regime Normal
    default:
      return { opSimpNac: '1', regEspTrib: '0' };
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pessoaCpfCnpjXml(documento: string): string {
  const digits = documento.replace(/\D/g, '');
  return digits.length > 11 ? `<CNPJ>${digits}</CNPJ>` : `<CPF>${pad(digits, 11)}</CPF>`;
}

/**
 * Monta o XML da DPS (sem assinatura) conforme TCInfDPS.
 */
export function buildDpsXml(data: DpsData): { xml: string; idDps: string } {
  const idDps = buildIdDps(data.cLocEmi, data.cnpjPrestador, data.serieDps, data.numeroDps);
  const regTrib = mapRegimeTributario(data.regimeTributario);
  const prestadorDigits = data.cnpjPrestador.replace(/\D/g, '');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
  <infDPS Id="${idDps}">
    <tpAmb>1</tpAmb>
    <dhEmi>${toUtcDateTime(data.dataEmissao)}</dhEmi>
    <verAplic>1.0.0</verAplic>
    <serie>${data.serieDps}</serie>
    <nDPS>${data.numeroDps}</nDPS>
    <dCompet>${toDataCompetencia(data.dataCompetencia)}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>${pad(data.cLocEmi, 7)}</cLocEmi>
    <prest>
      <CNPJ>${prestadorDigits}</CNPJ>
      <IM>${escapeXml(data.inscricaoMunicipalPrestador)}</IM>
      <xNome>${escapeXml(data.razaoSocialPrestador)}</xNome>
      <regTrib>
        <opSimpNac>${regTrib.opSimpNac}</opSimpNac>
        ${regTrib.regApTribSN ? `<regApTribSN>${regTrib.regApTribSN}</regApTribSN>` : ''}
        <regEspTrib>${regTrib.regEspTrib}</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      ${pessoaCpfCnpjXml(data.cpfCnpjTomador)}
      <xNome>${escapeXml(data.nomeTomador)}</xNome>
      ${data.emailTomador ? `<email>${escapeXml(data.emailTomador)}</email>` : ''}
    </toma>
    <serv>
      <locPrest>
        <cLocPrestacao>${pad(data.cLocEmi, 7)}</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>${data.cTribNac}</cTribNac>
        <xDescServ>${escapeXml(data.descricaoServico)}</xDescServ>
      </cServ>
    </serv>
    <valores>
      <vServPrest>
        <vServ>${data.valorServico.toFixed(2)}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <tpRetISSQN>1</tpRetISSQN>
        </tribMun>
        <totTrib>
          <indTotTrib>0</indTotTrib>
        </totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;

  return { xml, idDps };
}

/**
 * Assina digitalmente o elemento infDPS (assinatura enveloped, conforme
 * exigido pelo Sistema Nacional NFS-e), inserindo <Signature> como último
 * filho de <DPS>.
 */
export function signDps(xml: string, certPem: string, keyPem: string): string {
  const sig = new SignedXml({
    privateKey: keyPem,
    publicCert: certPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  });

  sig.addReference({
    xpath: "//*[local-name(.)='infDPS']",
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
  });

  sig.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='infDPS']", action: 'after' },
  });

  return sig.getSignedXml();
}
