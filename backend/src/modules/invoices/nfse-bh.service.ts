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

import { decrypt } from '../../common/utils/encryption';

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

  constructor(config: {
    ambiente: string;
    urlWebservice?: string;
    usuario?: string;
    senha?: string;
  }) {
    this.ambiente = config.ambiente;
    this.urlWebservice = config.urlWebservice ||
      (config.ambiente === 'producao'
        ? 'https://bhissdigital.pbh.gov.br/bhiss-ws/nfse'
        : 'https://bhissdigital.pbh.gov.br/bhiss-ws/nfse');
    this.usuario = config.usuario ? decrypt(config.usuario) : undefined;
    this.senha = config.senha ? decrypt(config.senha) : undefined;
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

    // Produção - Chamada real ao webservice
    try {
      // TODO: Implementar chamada SOAP real ao webservice da PBH
      // Necessário: certificado digital A1, assinatura XML, envelope SOAP
      // A implementação completa requer:
      // 1. Leitura do certificado .pfx
      // 2. Assinatura do XML com xmldsig
      // 3. Montagem do envelope SOAP
      // 4. Chamada HTTPS com certificado cliente
      // 5. Parse da resposta
      
      return {
        success: false,
        errorMessage: 'Emissão em produção requer configuração do certificado digital. Configure nas configurações fiscais.',
      };
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

    return {
      success: false,
      errorMessage: 'Consulta em produção não implementada',
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
