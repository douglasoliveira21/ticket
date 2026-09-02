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
  // Obrigatorio (TCAtvEvento) quando cTribNac pertence ao item 12 (diversoes/eventos)
  evento?: {
    nome: string;
    dataInicio: Date;
    dataFim: Date;
    endereco: {
      cep: string;
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
    };
  };
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

/**
 * Formata a data/hora no fuso de Brasília (UTC-3, sem horário de verão desde
 * 2019), no formato exigido por TSDateTimeUTC (AAAA-MM-DDThh:mm:ss-03:00).
 * `date.toISOString()` sozinho retorna o horário em UTC (sufixo Z) - só
 * trocar o sufixo por "-03:00" sem subtrair as 3 horas deixaria o horário
 * declarado 3h à frente do real.
 */
export function toBrasiliaDateTime(date: Date): string {
  const brasilia = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return brasilia.toISOString().replace(/\.\d{3}Z$/, '-03:00');
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
    case '4': // Isento/Imune (associação/entidade sem fins lucrativos - não é optante do SN)
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
  // Imunidade de ISS (CF88 Art 150, VI, c - instituições de educação/assistência
  // social sem fins lucrativos) exige reconhecimento formal junto ao município;
  // regimeTributario '4' só deve ser usado quando esse reconhecimento já existe.
  const isIssImune = data.regimeTributario === '4';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
  <infDPS Id="${idDps}">
    <tpAmb>1</tpAmb>
    <dhEmi>${toBrasiliaDateTime(data.dataEmissao)}</dhEmi>
    <verAplic>1.0.0</verAplic>
    <serie>${data.serieDps}</serie>
    <nDPS>${data.numeroDps}</nDPS>
    <dCompet>${toDataCompetencia(data.dataCompetencia)}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>${pad(data.cLocEmi, 7)}</cLocEmi>
    <prest>
      <CNPJ>${prestadorDigits}</CNPJ>
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
      ${data.evento ? `<atvEvento>
        <xNome>${escapeXml(data.evento.nome)}</xNome>
        <dtIni>${toDataCompetencia(data.evento.dataInicio)}</dtIni>
        <dtFim>${toDataCompetencia(data.evento.dataFim)}</dtFim>
        <end>
          <CEP>${data.evento.endereco.cep.replace(/\D/g, '')}</CEP>
          <xLgr>${escapeXml(data.evento.endereco.logradouro)}</xLgr>
          <nro>${escapeXml(data.evento.endereco.numero)}</nro>
          ${data.evento.endereco.complemento ? `<xCpl>${escapeXml(data.evento.endereco.complemento)}</xCpl>` : ''}
          <xBairro>${escapeXml(data.evento.endereco.bairro)}</xBairro>
        </end>
      </atvEvento>` : ''}
    </serv>
    <valores>
      <vServPrest>
        <vServ>${data.valorServico.toFixed(2)}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          ${isIssImune
            ? '<tribISSQN>2</tribISSQN>\n          <tpImunidade>3</tpImunidade>'
            : '<tribISSQN>1</tribISSQN>'}
          <tpRetISSQN>1</tpRetISSQN>
        </tribMun>
        <totTrib>
          ${regTrib.opSimpNac === '1'
            ? '<pTotTrib>\n            <pTotTribFed>0.00</pTotTribFed>\n            <pTotTribEst>0.00</pTotTribEst>\n            <pTotTribMun>0.00</pTotTribMun>\n          </pTotTrib>'
            : '<indTotTrib>0</indTotTrib>'}
        </totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;

  return { xml, idDps };
}

/**
 * Assina digitalmente (enveloped, XMLDSIG) o elemento cujo Id está em
 * `elementLocalName` (ex: "infDPS", "infPedReg"), inserindo <Signature>
 * logo após esse elemento - padrão exigido pelo Sistema Nacional NFS-e
 * tanto para a DPS quanto para eventos (cancelamento, etc).
 */
export function signXmlElement(xml: string, certPem: string, keyPem: string, elementLocalName: string): string {
  const xpath = `//*[local-name(.)='${elementLocalName}']`;
  const sig = new SignedXml({
    privateKey: keyPem,
    publicCert: certPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  });

  sig.addReference({
    xpath,
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
  });

  sig.computeSignature(xml, {
    location: { reference: xpath, action: 'after' },
  });

  return sig.getSignedXml();
}

/** @deprecated use signXmlElement(xml, certPem, keyPem, 'infDPS') */
export function signDps(xml: string, certPem: string, keyPem: string): string {
  return signXmlElement(xml, certPem, keyPem, 'infDPS');
}

export interface PedRegEventoData {
  chaveNFSe: string;
  cnpjAutor: string;
  codigoMotivo: '1' | '2' | '9';
  descricaoMotivo: string;
  dataEvento: Date;
  nPedRegEvento: number;
}

/**
 * Monta o Id do pedido de registro de evento (59 posições), conforme
 * TSIdPedRegEvt: "PRE" + Chave de Acesso NFS-e (50) + Tipo do evento (3) +
 * Número do Pedido de Registro do Evento (3).
 * Tipo do evento "101" = grupo de cancelamento (e101101).
 */
export function buildIdPedRegEvento(chaveNFSe: string, nPedRegEvento: number): string {
  return `PRE${chaveNFSe}101${pad(String(nPedRegEvento), 3)}`;
}

/**
 * Monta o XML do pedido de registro de evento de cancelamento de NFS-e
 * (e101101), conforme pedRegEvento_v1.01.xsd / tiposEventos_v1.01.xsd.
 */
export function buildPedRegEventoCancelamentoXml(data: PedRegEventoData): { xml: string; idPedRegEvento: string } {
  const idPedRegEvento = buildIdPedRegEvento(data.chaveNFSe, data.nPedRegEvento);
  const cnpjDigits = data.cnpjAutor.replace(/\D/g, '');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
  <infPedReg Id="${idPedRegEvento}">
    <tpAmb>1</tpAmb>
    <verAplic>1.0.0</verAplic>
    <dhEvento>${toBrasiliaDateTime(data.dataEvento)}</dhEvento>
    <CNPJAutor>${cnpjDigits}</CNPJAutor>
    <chNFSe>${data.chaveNFSe}</chNFSe>
    <e101101>
      <xDesc>Cancelamento de NFS-e</xDesc>
      <cMotivo>${data.codigoMotivo}</cMotivo>
      <xMotivo>${escapeXml(data.descricaoMotivo)}</xMotivo>
    </e101101>
  </infPedReg>
</pedRegEvento>`;

  return { xml, idPedRegEvento };
}
