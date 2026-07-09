/**
 * Serviço de emissão de NFS-e para Prefeitura de Belo Horizonte
 * 
 * Baseado na documentação do BHISS Digital:
 * - WebService ABRASF 2.01
 * - URL Homologação: https://bhissdigital.pbh.gov.br/bhiss-ws/nfse?wsdl
 * - URL Produção: https://bhissdigital.pbh.gov.br/bhiss-ws/nfse?wsdl
 * 
 * Operações suportadas:
 * - GerarNfse (RPS individual)
 * - RecepcionarLoteRps (Lote)
 * - ConsultarLoteRps
 * - ConsultarNfsePorRps
 * - CancelarNfse
 */

import https from 'https';
import crypto from 'crypto';
import { decrypt } from '../../common/utils/encryption';
import { loadCompanyCertificate } from '../company/certificate.controller';

export interface NfseData {
  // Prestador
  cnpjPrestador: string;
  inscricaoMunicipal: string;
  
  // Tomador
  cpfCnpjTomador: string;
  nomeTomador: string;
  emailTomador: string;
  
  // Serviço
  valorServico: number;
  aliquotaIss: number;
  codigoServico: string;
  descricaoServico: string;
  codigoMunicipio: string;
  
  // RPS
  numeroRps: number;
  serieRps: string;
  dataEmissao: Date;
}

export interface NfseResult {
  success: boolean;
  numeroNota?: string;
  codigoVerificacao?: string;
  protocolo?: string;
  xmlRetorno?: string;
  pdfUrl?: string;
  errorMessage?: string;
}

export class NfseBHService {
  private ambiente: string;
  private urlWebservice: string;
  private usuario?: string;
  private senha?: string;
  private companyId?: string;

  constructor(config: {
    ambiente: string;
    urlWebservice?: string;
    usuario?: string;
    senha?: string;
    companyId?: string;
  }) {
    this.ambiente = config.ambiente;
    this.urlWebservice = config.urlWebservice ||
      (config.ambiente === 'producao'
        ? 'https://bhissdigital.pbh.gov.br/bhiss-ws/nfse'
        : 'https://bhissdigital.pbh.gov.br/bhiss-ws/nfse');
    this.usuario = config.usuario ? decrypt(config.usuario) : undefined;
    this.senha = config.senha ? decrypt(config.senha) : undefined;
    this.companyId = config.companyId;
  }

  /**
   * Gera o XML do RPS conforme padrão ABRASF 2.01 para BH
   */
  generateRpsXml(data: NfseData): string {
    const issRetido = 2; // 1=Sim, 2=Não (padrão para prestador em BH)
    const valorIss = data.valorServico * (data.aliquotaIss / 100);
    const valorLiquido = data.valorServico - valorIss;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GerarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Rps>
    <InfDeclaracaoPrestacaoServico>
      <Rps>
        <IdentificacaoRps>
          <Numero>${data.numeroRps}</Numero>
          <Serie>${data.serieRps}</Serie>
          <Tipo>1</Tipo>
        </IdentificacaoRps>
        <DataEmissao>${data.dataEmissao.toISOString().split('T')[0]}</DataEmissao>
        <Status>1</Status>
      </Rps>
      <Competencia>${data.dataEmissao.toISOString().split('T')[0]}</Competencia>
      <Servico>
        <Valores>
          <ValorServicos>${data.valorServico.toFixed(2)}</ValorServicos>
          <ValorDeducoes>0.00</ValorDeducoes>
          <ValorPis>0.00</ValorPis>
          <ValorCofins>0.00</ValorCofins>
          <ValorInss>0.00</ValorInss>
          <ValorIr>0.00</ValorIr>
          <ValorCsll>0.00</ValorCsll>
          <IssRetido>${issRetido}</IssRetido>
          <ValorIss>${valorIss.toFixed(2)}</ValorIss>
          <Aliquota>${(data.aliquotaIss / 100).toFixed(4)}</Aliquota>
        </Valores>
        <ItemListaServico>${data.codigoServico}</ItemListaServico>
        <CodigoTributacaoMunicipio>${data.codigoServico}</CodigoTributacaoMunicipio>
        <Discriminacao>${this.escapeXml(data.descricaoServico)}</Discriminacao>
        <CodigoMunicipio>${data.codigoMunicipio}</CodigoMunicipio>
        <ExigibilidadeISS>1</ExigibilidadeISS>
        <MunicipioIncidencia>${data.codigoMunicipio}</MunicipioIncidencia>
      </Servico>
      <Prestador>
        <CpfCnpj>
          <Cnpj>${data.cnpjPrestador}</Cnpj>
        </CpfCnpj>
        <InscricaoMunicipal>${data.inscricaoMunicipal}</InscricaoMunicipal>
      </Prestador>
      <Tomador>
        <IdentificacaoTomador>
          <CpfCnpj>
            ${data.cpfCnpjTomador.length > 11
              ? `<Cnpj>${data.cpfCnpjTomador}</Cnpj>`
              : `<Cpf>${data.cpfCnpjTomador}</Cpf>`
            }
          </CpfCnpj>
        </IdentificacaoTomador>
        <RazaoSocial>${this.escapeXml(data.nomeTomador)}</RazaoSocial>
        <Contato>
          <Email>${data.emailTomador}</Email>
        </Contato>
      </Tomador>
    </InfDeclaracaoPrestacaoServico>
  </Rps>
</GerarNfseEnvio>`;

    return xml;
  }

  /**
   * Emite NFS-e individual (GerarNfse)
   * Em ambiente de homologação, simula a resposta
   * Em produção, usa o certificado A1 para comunicação HTTPS com o webservice
   */
  async emitirNfse(data: NfseData): Promise<NfseResult> {
    const xmlEnvio = this.generateRpsXml(data);

    if (this.ambiente === 'homologacao') {
      // Simulação em homologação
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

    // Produção - Chamada real ao webservice com certificado A1
    try {
      if (!this.companyId) {
        return {
          success: false,
          errorMessage: 'ID da empresa não configurado para emissão em produção.',
        };
      }

      // Carregar certificado digital A1
      const cert = await loadCompanyCertificate(this.companyId);
      if (!cert) {
        return {
          success: false,
          errorMessage: 'Certificado digital A1 não configurado. Faça o upload nas configurações fiscais.',
        };
      }

      // Montar envelope SOAP
      const soapEnvelope = this.buildSoapEnvelope('GerarNfseEnvio', xmlEnvio);

      // Fazer chamada HTTPS com certificado cliente
      const response = await this.callWebservice(soapEnvelope, cert.buffer, cert.password);

      // Parse da resposta
      return this.parseNfseResponse(response);
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error.message || 'Erro ao comunicar com webservice da Prefeitura',
      };
    }
  }

  /**
   * Consulta NFS-e por RPS
   */
  async consultarPorRps(numeroRps: number, serieRps: string, cnpj: string, im: string): Promise<NfseResult> {
    if (this.ambiente === 'homologacao') {
      return {
        success: true,
        numeroNota: String(numeroRps),
        codigoVerificacao: 'HOMOLOG',
      };
    }

    if (!this.companyId) {
      return { success: false, errorMessage: 'ID da empresa não configurado.' };
    }

    const cert = await loadCompanyCertificate(this.companyId);
    if (!cert) {
      return { success: false, errorMessage: 'Certificado digital não configurado.' };
    }

    const xmlConsulta = `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <IdentificacaoRps>
    <Numero>${numeroRps}</Numero>
    <Serie>${serieRps}</Serie>
    <Tipo>1</Tipo>
  </IdentificacaoRps>
  <Prestador>
    <CpfCnpj>
      <Cnpj>${cnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${im}</InscricaoMunicipal>
  </Prestador>
</ConsultarNfseRpsEnvio>`;

    try {
      const soapEnvelope = this.buildSoapEnvelope('ConsultarNfsePorRps', xmlConsulta);
      const response = await this.callWebservice(soapEnvelope, cert.buffer, cert.password);
      return this.parseNfseResponse(response);
    } catch (error: any) {
      return { success: false, errorMessage: error.message || 'Erro na consulta' };
    }
  }

  /**
   * Monta o envelope SOAP para o webservice da PBH
   */
  private buildSoapEnvelope(operation: string, xmlContent: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.bhiss.pbh.gov.br">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:${operation}Input>
      <nfseCabecMsg><![CDATA[<?xml version="1.0" encoding="UTF-8"?><cabecalho xmlns="http://www.abrasf.org.br/nfse.xsd" versao="2.01"><versaoDados>2.01</versaoDados></cabecalho>]]></nfseCabecMsg>
      <nfseDadosMsg><![CDATA[${xmlContent}]]></nfseDadosMsg>
    </ws:${operation}Input>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  /**
   * Realiza a chamada HTTPS ao webservice usando o certificado A1 como client certificate
   */
  private callWebservice(soapXml: string, pfxBuffer: Buffer, pfxPassword: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.urlWebservice);

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(soapXml, 'utf-8'),
          'SOAPAction': '',
        },
        pfx: pfxBuffer,
        passphrase: pfxPassword,
        rejectUnauthorized: true,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Webservice retornou status ${res.statusCode}: ${data.substring(0, 500)}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Erro de conexão com webservice: ${err.message}`));
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Timeout na comunicação com o webservice (30s)'));
      });

      req.write(soapXml);
      req.end();
    });
  }

  /**
   * Parse da resposta XML do webservice da PBH
   */
  private parseNfseResponse(xmlResponse: string): NfseResult {
    // Verificar se há mensagem de erro
    const erroMatch = xmlResponse.match(/<MensagemRetorno>[\s\S]*?<Codigo>(.*?)<\/Codigo>[\s\S]*?<Mensagem>(.*?)<\/Mensagem>/);
    if (erroMatch) {
      return {
        success: false,
        errorMessage: `Erro ${erroMatch[1]}: ${erroMatch[2]}`,
        xmlRetorno: xmlResponse,
      };
    }

    // Extrair número da nota
    const numeroMatch = xmlResponse.match(/<Numero>(.*?)<\/Numero>/);
    const codigoMatch = xmlResponse.match(/<CodigoVerificacao>(.*?)<\/CodigoVerificacao>/);
    const protocoloMatch = xmlResponse.match(/<Protocolo>(.*?)<\/Protocolo>/);

    if (numeroMatch) {
      return {
        success: true,
        numeroNota: numeroMatch[1],
        codigoVerificacao: codigoMatch?.[1],
        protocolo: protocoloMatch?.[1],
        xmlRetorno: xmlResponse,
      };
    }

    // Resposta não reconhecida
    return {
      success: false,
      errorMessage: 'Resposta do webservice não reconhecida',
      xmlRetorno: xmlResponse,
    };
  }

  /**
   * Cancela NFS-e na Prefeitura de BH
   */
  async cancelarNfse(numeroNota: string, cnpj: string, inscricaoMunicipal: string, codigoCancelamento: string = '2'): Promise<NfseResult> {
    if (this.ambiente === 'homologacao') {
      return {
        success: true,
        xmlRetorno: `<CancelarNfseResponse><Confirmacao><NumeroNfse>${numeroNota}</NumeroNfse><Status>Cancelada</Status></Confirmacao></CancelarNfseResponse>`,
      };
    }

    if (!this.companyId) {
      return { success: false, errorMessage: 'ID da empresa não configurado.' };
    }

    const cert = await loadCompanyCertificate(this.companyId);
    if (!cert) {
      return { success: false, errorMessage: 'Certificado digital não configurado.' };
    }

    const xmlCancelamento = `<?xml version="1.0" encoding="UTF-8"?>
<CancelarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Pedido>
    <InfPedidoCancelamento Id="cancel_${numeroNota}">
      <IdentificacaoNfse>
        <Numero>${numeroNota}</Numero>
        <CpfCnpj>
          <Cnpj>${cnpj}</Cnpj>
        </CpfCnpj>
        <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
        <CodigoMunicipio>3106200</CodigoMunicipio>
      </IdentificacaoNfse>
      <CodigoCancelamento>${codigoCancelamento}</CodigoCancelamento>
    </InfPedidoCancelamento>
  </Pedido>
</CancelarNfseEnvio>`;

    try {
      const soapEnvelope = this.buildSoapEnvelope('CancelarNfse', xmlCancelamento);
      const response = await this.callWebservice(soapEnvelope, cert.buffer, cert.password);
      return this.parseCancelResponse(response);
    } catch (error: any) {
      return { success: false, errorMessage: error.message || 'Erro ao cancelar NFS-e' };
    }
  }

  /**
   * Parse da resposta de cancelamento
   */
  private parseCancelResponse(xmlResponse: string): NfseResult {
    const erroMatch = xmlResponse.match(/<MensagemRetorno>[\s\S]*?<Codigo>(.*?)<\/Codigo>[\s\S]*?<Mensagem>(.*?)<\/Mensagem>/);
    if (erroMatch) {
      return {
        success: false,
        errorMessage: `Erro ${erroMatch[1]}: ${erroMatch[2]}`,
        xmlRetorno: xmlResponse,
      };
    }

    const confirmacao = xmlResponse.match(/<Confirmacao>|<RetCancelamento>/);
    if (confirmacao) {
      return {
        success: true,
        xmlRetorno: xmlResponse,
      };
    }

    return {
      success: false,
      errorMessage: 'Resposta de cancelamento não reconhecida',
      xmlRetorno: xmlResponse,
    };
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
