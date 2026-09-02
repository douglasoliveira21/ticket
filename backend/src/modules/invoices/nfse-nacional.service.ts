/**
 * Serviço de emissão de NFS-e via Sistema Nacional NFS-e (ADN - Ambiente de
 * Dados Nacional), obrigatório para Belo Horizonte desde 01/01/2026.
 *
 * Substitui o antigo webservice ABRASF/SOAP da PBH (BHISS Digital), que não
 * aceita mais novas emissões.
 *
 * Documentação técnica: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica
 * Endpoint de produção: https://sefin.nfse.gov.br/SefinNacional
 */

import https from 'https';
import zlib from 'zlib';
import { decrypt } from '../../common/utils/encryption';
import { loadCompanyCertificate } from '../company/certificate.controller';
import { readPfx } from '../../common/utils/pfx';
import { buildDpsXml, signDps, DpsData, toBrasiliaDateTime } from './dps-builder';

export interface NfseData {
  cnpjPrestador: string;
  inscricaoMunicipal: string;
  cpfCnpjTomador: string;
  nomeTomador: string;
  emailTomador: string;
  valorServico: number;
  aliquotaIss: number;
  codigoServico: string;
  descricaoServico: string;
  codigoMunicipio: string;
  numeroRps: number;
  serieRps: string;
  dataEmissao: Date;
  // Obrigatorio quando o cTribNac pertence ao item 12 (diversoes/eventos) - E0390
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

export interface NfseResult {
  success: boolean;
  numeroNota?: string;
  codigoVerificacao?: string;
  chaveAcesso?: string;
  idDps?: string;
  protocolo?: string;
  xmlRetorno?: string;
  pdfUrl?: string;
  errorMessage?: string;
}

const SEFIN_URL = 'https://sefin.nfse.gov.br/SefinNacional';

/**
 * Deriva um cTribNac (6 digitos: item(2) + subitem(2) + desdobro nacional(2))
 * a partir do codigoServico legado (LC116, ex: "12.08"), quando a empresa
 * ainda nao configurou o cTribNac exato em Configurações Fiscais.
 *
 * Conforme a tabela oficial (ANEXO_B - Lista de Serviço Nacional), o
 * desdobro "00" é sempre um cabeçalho de categoria (sem código de
 * tributação válido) - o item/subitem "folha" normalmente usa desdobro
 * "01" (ex: item 12.08 "Feiras, exposições, congressos" -> cTribNac
 * "120801"). "00" não é aceito pelo SEFIN Nacional (erro E0310).
 */
function buildCTribNacFallback(codigoServico: string): string {
  const digits = codigoServico.replace(/\D/g, '').padEnd(4, '0').slice(0, 4);
  return `${digits}01`;
}

export class NfseNacionalService {
  private ambiente: string;
  private companyId?: string;
  private razaoSocialPrestador?: string;
  private regimeTributario?: string | null;
  private cTribNac?: string | null;

  constructor(config: {
    ambiente: string;
    companyId?: string;
    razaoSocialPrestador?: string;
    regimeTributario?: string | null;
    cTribNac?: string | null;
  }) {
    this.ambiente = config.ambiente;
    this.companyId = config.companyId;
    this.razaoSocialPrestador = config.razaoSocialPrestador;
    this.regimeTributario = config.regimeTributario;
    this.cTribNac = config.cTribNac;
  }

  /**
   * Gera o XML da DPS (sem assinatura) - usado tambem para auditoria
   * (InvoiceAttempt.requestXml), analogo ao antigo generateRpsXml.
   */
  buildDps(data: NfseData): { xml: string; idDps: string; dpsData: DpsData } {
    const cTribNac = this.cTribNac || buildCTribNacFallback(data.codigoServico);
    if (cTribNac.startsWith('12') && !data.evento) {
      throw new Error('Dados do evento (nome, datas e endereço) são obrigatórios para este código de tributação nacional (item 12 - diversões/eventos).');
    }
    const dpsData: DpsData = {
      cLocEmi: data.codigoMunicipio,
      cnpjPrestador: data.cnpjPrestador,
      inscricaoMunicipalPrestador: data.inscricaoMunicipal,
      razaoSocialPrestador: this.razaoSocialPrestador || '',
      regimeTributario: this.regimeTributario ?? null,
      cpfCnpjTomador: data.cpfCnpjTomador,
      nomeTomador: data.nomeTomador,
      emailTomador: data.emailTomador,
      cTribNac,
      descricaoServico: data.descricaoServico,
      valorServico: data.valorServico,
      serieDps: data.serieRps,
      numeroDps: data.numeroRps,
      dataEmissao: data.dataEmissao,
      dataCompetencia: data.dataEmissao,
      // Grupo Atividade/Evento e obrigatorio para qualquer cTribNac do item 12
      // (diversoes, lazer, entretenimento e congeneres) - erro E0390.
      evento: cTribNac.startsWith('12') ? data.evento : undefined,
    };
    const { xml, idDps } = buildDpsXml(dpsData);
    return { xml, idDps, dpsData };
  }

  async emitirNfse(data: NfseData): Promise<NfseResult> {
    if (this.ambiente === 'homologacao') {
      const fakeNumero = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
      const fakeVerificacao = Math.random().toString(36).substring(2, 10).toUpperCase();
      return {
        success: true,
        numeroNota: fakeNumero,
        codigoVerificacao: fakeVerificacao,
        protocolo: `HOMOLOG-${Date.now()}`,
        xmlRetorno: `<NfseResponse><Numero>${fakeNumero}</Numero><CodigoVerificacao>${fakeVerificacao}</CodigoVerificacao></NfseResponse>`,
        pdfUrl: null as any,
      };
    }

    try {
      if (!this.companyId) {
        return { success: false, errorMessage: 'ID da empresa não configurado para emissão em produção.' };
      }

      const cert = await loadCompanyCertificate(this.companyId);
      if (!cert) {
        return { success: false, errorMessage: 'Certificado digital A1 não configurado. Faça o upload nas configurações fiscais.' };
      }

      const { xml, idDps } = this.buildDps(data);
      const { cert: certPem, key: keyPem } = readPfx(cert.buffer, cert.password);
      const signedXml = signDps(xml, certPem, keyPem);
      const dpsXmlGZipB64 = zlib.gzipSync(Buffer.from(signedXml, 'utf-8')).toString('base64');

      const response = await this.callSefin('POST', '/nfse', { dpsXmlGZipB64 }, certPem, keyPem);
      return this.parseNfseResponse(response, idDps);
    } catch (error: any) {
      return { success: false, errorMessage: error.message || 'Erro ao comunicar com o Sistema Nacional NFS-e' };
    }
  }

  async consultarPorChave(chaveAcesso: string): Promise<NfseResult> {
    if (this.ambiente === 'homologacao') {
      return { success: true, chaveAcesso, codigoVerificacao: 'HOMOLOG' };
    }
    if (!this.companyId) {
      return { success: false, errorMessage: 'ID da empresa não configurado.' };
    }

    const cert = await loadCompanyCertificate(this.companyId);
    if (!cert) {
      return { success: false, errorMessage: 'Certificado digital não configurado.' };
    }

    try {
      const { cert: certPem, key: keyPem } = readPfx(cert.buffer, cert.password);
      const response = await this.callSefin('GET', `/nfse/${chaveAcesso}`, null, certPem, keyPem);
      return this.parseNfseResponse(response);
    } catch (error: any) {
      return { success: false, errorMessage: error.message || 'Erro na consulta' };
    }
  }

  /**
   * Consulta se um código de tributação nacional (cTribNac) é administrado
   * pelo município informado (ex: alíquota parametrizada, retenções, etc).
   * Usado para diagnosticar o erro E0312 ("código não administrado pelo
   * município de incidência").
   */
  async consultarParametroMunicipal(codigoMunicipio: string, cTribNac: string): Promise<{ success: boolean; data?: any; errorMessage?: string }> {
    if (!this.companyId) {
      return { success: false, errorMessage: 'ID da empresa não configurado.' };
    }
    const cert = await loadCompanyCertificate(this.companyId);
    if (!cert) {
      return { success: false, errorMessage: 'Certificado digital não configurado.' };
    }
    try {
      const { cert: certPem, key: keyPem } = readPfx(cert.buffer, cert.password);
      const response = await this.callSefin('GET', `/parametros_municipais/${codigoMunicipio}/${cTribNac}`, null, certPem, keyPem);
      return { success: true, data: JSON.parse(response) };
    } catch (error: any) {
      return { success: false, errorMessage: error.message || 'Erro ao consultar parâmetros municipais' };
    }
  }

  async cancelarNfse(chaveAcesso: string, cnpjPrestador: string, codigoCancelamento: string = '2'): Promise<NfseResult> {
    if (this.ambiente === 'homologacao') {
      return { success: true, xmlRetorno: `<CancelarNfseResponse><ChaveAcesso>${chaveAcesso}</ChaveAcesso><Status>Cancelada</Status></CancelarNfseResponse>` };
    }
    if (!this.companyId) {
      return { success: false, errorMessage: 'ID da empresa não configurado.' };
    }

    const cert = await loadCompanyCertificate(this.companyId);
    if (!cert) {
      return { success: false, errorMessage: 'Certificado digital não configurado.' };
    }

    try {
      const { cert: certPem, key: keyPem } = readPfx(cert.buffer, cert.password);
      // O evento de cancelamento segue o schema evento_v1.01.xsd / pedRegEvento_v1.01.xsd.
      // TODO: este XML ainda não é assinado digitalmente (faltando validar a
      // estrutura exata de pedRegEvento contra o schema) - o SEFIN Nacional
      // deve rejeitar até isso ser implementado. Emissão (emitirNfse) já
      // assina corretamente via signDps; cancelamento precisa do mesmo
      // tratamento antes de ir para produção.
      const eventoXml = `<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
  <infPedReg Id="PR${chaveAcesso}">
    <tpAmb>1</tpAmb>
    <verAplic>1.0.0</verAplic>
    <dhEvento>${toBrasiliaDateTime(new Date())}</dhEvento>
    <CNPJAutor>${cnpjPrestador.replace(/\D/g, '')}</CNPJAutor>
    <chNFSe>${chaveAcesso}</chNFSe>
    <nPedRegEvento>1</nPedRegEvento>
    <e101101>
      <xDesc>Cancelamento de NFS-e</xDesc>
      <cMotivo>${codigoCancelamento}</cMotivo>
    </e101101>
  </infPedReg>
</pedRegEvento>`;
      const gzipB64 = zlib.gzipSync(Buffer.from(eventoXml, 'utf-8')).toString('base64');
      const response = await this.callSefin('POST', `/nfse/${chaveAcesso}/eventos`, { pedidoRegistroEventoXmlGZipB64: gzipB64 }, certPem, keyPem);
      return { success: true, xmlRetorno: response };
    } catch (error: any) {
      return { success: false, errorMessage: error.message || 'Erro ao cancelar NFS-e' };
    }
  }

  private callSefin(method: 'GET' | 'POST', path: string, body: Record<string, string> | null, certPem: string, keyPem: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(SEFIN_URL + path);
      const payload = body ? JSON.stringify(body) : undefined;

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload, 'utf-8') } : {}),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        cert: certPem,
        key: keyPem,
        rejectUnauthorized: true,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            console.error(`[NFSe-Nacional] SEFIN respondeu ${res.statusCode}. Headers: ${JSON.stringify(res.headers)}. Body: ${data.substring(0, 800)}`);
            reject(new Error(`SEFIN Nacional retornou status ${res.statusCode}: ${data.substring(0, 500)}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Erro de conexão com SEFIN Nacional: ${err.message}`)));
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout na comunicação com o SEFIN Nacional (30s)')); });

      if (payload) req.write(payload);
      req.end();
    });
  }

  private parseNfseResponse(rawResponse: string, idDps?: string): NfseResult {
    let parsed: any;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      return { success: false, errorMessage: 'Resposta do SEFIN Nacional não é um JSON válido', xmlRetorno: rawResponse };
    }

    if (!parsed.nfseXmlGZipB64 && !parsed.chaveAcesso) {
      return { success: false, errorMessage: parsed.mensagem || parsed.message || 'Resposta do SEFIN Nacional não reconhecida', xmlRetorno: rawResponse };
    }

    let nfseXml = '';
    if (parsed.nfseXmlGZipB64) {
      try {
        nfseXml = zlib.gunzipSync(Buffer.from(parsed.nfseXmlGZipB64, 'base64')).toString('utf-8');
      } catch {
        nfseXml = '';
      }
    }

    const numeroMatch = nfseXml.match(/<nNFSe>(.*?)<\/nNFSe>/);

    return {
      success: true,
      chaveAcesso: parsed.chaveAcesso,
      numeroNota: numeroMatch?.[1] || parsed.chaveAcesso,
      idDps,
      xmlRetorno: nfseXml || rawResponse,
    };
  }
}
