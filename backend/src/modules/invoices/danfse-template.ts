import QRCode from 'qrcode';
import { NFSE_LOGO_BASE64, BRASAO_BH_BASE64 } from './danfse-assets';

export interface DanfseData {
  // Dados da nota
  chaveAcesso: string;
  numeroNfse: string;
  competencia: string;
  dataHoraEmissao: string;
  numeroDps: string;
  serieDps: string;
  dataHoraEmissaoDps: string;

  // Prestador
  prestadorCnpj: string;
  prestadorInscricaoMunicipal: string;
  prestadorTelefone: string;
  prestadorNome: string;
  prestadorEmail: string;
  prestadorEndereco: string;
  prestadorMunicipio: string;
  prestadorCep: string;
  simplesNacional: string;
  regimeApuracao: string;

  // Tomador
  tomadorCpfCnpj: string;
  tomadorInscricaoMunicipal: string;
  tomadorTelefone: string;
  tomadorNome: string;
  tomadorEmail: string;
  tomadorEndereco: string;
  tomadorMunicipio: string;
  tomadorCep: string;

  // Serviço
  codigoTribNacional: string;
  codigoTribMunicipal: string;
  localPrestacao: string;
  paisPrestacao: string;
  descricaoServico: string;

  // Tributação Municipal
  tributacaoIssqn: string;
  paisResultado: string;
  municipioIncidencia: string;
  regimeEspecial: string;
  tipoImunidade: string;
  suspensaoExigibilidade: string;
  numeroProcessoSuspensao: string;
  beneficioMunicipal: string;
  valorServico: string;
  descontoIncondicionado: string;
  totalDeducoes: string;
  calculoBm: string;
  bcIssqn: string;
  aliquotaAplicada: string;
  retencaoIssqn: string;
  issqnApurado: string;

  // Tributação Federal
  irrf: string;
  contribuicaoPrevidenciaria: string;
  contribuicoesSociais: string;
  descricaoContribSociais: string;
  pisDebito: string;
  cofinsDebito: string;

  // Valor Total
  valorServicoTotal: string;
  descontoCondicionado: string;
  descontoIncondicionadoTotal: string;
  issqnRetido: string;
  totalRetencoesFederais: string;
  pisCofinsDebito: string;
  valorLiquido: string;

  // Totais Aproximados
  tributosFederais: string;
  tributosEstaduais: string;
  tributosMunicipais: string;

  // Informações Complementares
  informacoesComplementares: string;
}

export async function generateDanfseHtml(data: DanfseData): Promise<string> {
  // Gerar QR Code como base64
  const qrCodeUrl = `https://www.nfse.gov.br/ConsultaPublica?chave=${data.chaveAcesso}`;
  let qrCodeBase64 = '';
  try {
    qrCodeBase64 = await QRCode.toDataURL(qrCodeUrl, { width: 120, margin: 1 });
  } catch {
    qrCodeBase64 = '';
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>DANFSe - NFS-e ${data.numeroNfse}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #000; padding: 15px; max-width: 210mm; margin: 0 auto; }
  
  .container { border: 2px solid #000; }
  
  .header { display: flex; align-items: center; border-bottom: 2px solid #000; padding: 8px; }
  .header-logo { width: 80px; text-align: center; border-right: 1px solid #000; padding-right: 8px; margin-right: 8px; }
  .header-logo img { width: 70px; }
  .header-logo .nfse-text { font-size: 8px; font-weight: bold; margin-top: 2px; }
  .header-center { flex: 1; text-align: center; }
  .header-center h2 { font-size: 12px; font-weight: bold; }
  .header-center p { font-size: 9px; }
  .header-right { width: 120px; text-align: center; border-left: 1px solid #000; padding-left: 8px; margin-left: 8px; }
  .header-right .prefeitura { font-size: 9px; font-weight: bold; }
  
  .section { border-bottom: 1px solid #000; }
  .section-title { background: #e0e0e0; font-weight: bold; font-size: 9px; padding: 3px 5px; border-bottom: 1px solid #000; }
  
  .row { display: flex; border-bottom: 1px solid #ccc; }
  .row:last-child { border-bottom: none; }
  .cell { padding: 3px 5px; border-right: 1px solid #ccc; flex: 1; min-height: 28px; }
  .cell:last-child { border-right: none; }
  .cell label { font-size: 7px; font-weight: bold; color: #333; display: block; margin-bottom: 1px; }
  .cell span { font-size: 9px; display: block; word-break: break-word; }
  .cell-2 { flex: 2; }
  .cell-3 { flex: 3; }
  .cell-4 { flex: 4; }
  
  .chave-acesso { padding: 5px; border-bottom: 1px solid #000; }
  .chave-acesso label { font-size: 7px; font-weight: bold; }
  .chave-acesso span { font-size: 10px; font-family: monospace; letter-spacing: 0.5px; }
  
  .qr-section { display: flex; border-bottom: 1px solid #000; }
  .qr-data { flex: 1; }
  .qr-code { width: 140px; padding: 5px; border-left: 1px solid #000; text-align: center; }
  .qr-code img { width: 100px; height: 100px; }
  .qr-code p { font-size: 7px; margin-top: 3px; }
  
  .info-complementar { padding: 5px; font-size: 8px; }
  .info-complementar p { margin-bottom: 3px; }
  
  .full-row { padding: 3px 5px; border-bottom: 1px solid #ccc; }
  .full-row label { font-size: 7px; font-weight: bold; color: #333; }
  .full-row span { font-size: 9px; }
  
  @media print {
    body { padding: 0; }
    .container { border-width: 1px; }
  }
</style>
</head>
<body>
<div class="container">
  <!-- Cabeçalho -->
  <div class="header">
    <div class="header-logo">
      <img src="${NFSE_LOGO_BASE64}" alt="NFS-e" style="width:70px;">
    </div>
    <div class="header-center">
      <h2>DANFSe v1.0</h2>
      <p>Documento Auxiliar da NFS-e</p>
    </div>
    <div class="header-right">
      <img src="${BRASAO_BH_BASE64}" alt="Brasão BH" style="width:40px; margin-bottom:4px;">
      <p class="prefeitura">Prefeitura Municipal de Belo Horizonte</p>
      <p style="font-size: 8px; margin-top: 2px;">Secretaria Municipal de Fazenda - SMFA</p>
    </div>
  </div>

  <!-- Chave de Acesso + QR Code -->
  <div class="qr-section">
    <div class="qr-data">
      <div class="chave-acesso">
        <label>Chave de Acesso da NFS-e</label>
        <span>${data.chaveAcesso}</span>
      </div>
      <div class="row">
        <div class="cell"><label>Número da NFS-e</label><span>${data.numeroNfse}</span></div>
        <div class="cell"><label>Competência da NFS-e</label><span>${data.competencia}</span></div>
        <div class="cell"><label>Data e Hora da emissão da NFS-e</label><span>${data.dataHoraEmissao}</span></div>
      </div>
      <div class="row">
        <div class="cell"><label>Número da DPS</label><span>${data.numeroDps}</span></div>
        <div class="cell"><label>Série da DPS</label><span>${data.serieDps}</span></div>
        <div class="cell"><label>Data e Hora da emissão da DPS</label><span>${data.dataHoraEmissaoDps}</span></div>
      </div>
    </div>
    <div class="qr-code">
      ${qrCodeBase64 ? `<img src="${qrCodeBase64}" alt="QR Code">` : '<div style="width:100px;height:100px;border:1px solid #ccc;"></div>'}
      <p>A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e</p>
    </div>
  </div>

  <!-- Emitente -->
  <div class="section">
    <div class="section-title">EMITENTE DA NFS-e</div>
    <div class="row">
      <div class="cell"><label>Prestador do Serviço</label></div>
      <div class="cell"><label>CNPJ / CPF / NIF</label><span>${data.prestadorCnpj}</span></div>
      <div class="cell"><label>Inscrição Municipal</label><span>${data.prestadorInscricaoMunicipal}</span></div>
      <div class="cell"><label>Telefone</label><span>${data.prestadorTelefone}</span></div>
    </div>
    <div class="row">
      <div class="cell cell-4"><label>Nome / Nome Empresarial</label><span>${data.prestadorNome}</span></div>
      <div class="cell cell-2"><label>E-mail</label><span>${data.prestadorEmail}</span></div>
    </div>
    <div class="row">
      <div class="cell cell-3"><label>Endereço</label><span>${data.prestadorEndereco}</span></div>
      <div class="cell"><label>Município</label><span>${data.prestadorMunicipio}</span></div>
      <div class="cell"><label>CEP</label><span>${data.prestadorCep}</span></div>
    </div>
    <div class="row">
      <div class="cell cell-3"><label>Simples Nacional na Data de Competência</label><span>${data.simplesNacional}</span></div>
      <div class="cell cell-3"><label>Regime de Apuração Tributária pelo SN</label><span>${data.regimeApuracao}</span></div>
    </div>
  </div>

  <!-- Tomador -->
  <div class="section">
    <div class="section-title">TOMADOR DO SERVIÇO</div>
    <div class="row">
      <div class="cell"><label>CNPJ / CPF / NIF</label><span>${data.tomadorCpfCnpj}</span></div>
      <div class="cell"><label>Inscrição Municipal</label><span>${data.tomadorInscricaoMunicipal}</span></div>
      <div class="cell"><label>Telefone</label><span>${data.tomadorTelefone}</span></div>
    </div>
    <div class="row">
      <div class="cell cell-4"><label>Nome / Nome Empresarial</label><span>${data.tomadorNome}</span></div>
      <div class="cell cell-2"><label>E-mail</label><span>${data.tomadorEmail}</span></div>
    </div>
    <div class="row">
      <div class="cell cell-3"><label>Endereço</label><span>${data.tomadorEndereco}</span></div>
      <div class="cell"><label>Município</label><span>${data.tomadorMunicipio}</span></div>
      <div class="cell"><label>CEP</label><span>${data.tomadorCep}</span></div>
    </div>
  </div>

  <!-- Intermediário -->
  <div class="section">
    <div style="text-align: center; padding: 3px; font-size: 8px; font-weight: bold;">INTERMEDIÁRIO DO SERVIÇO NÃO IDENTIFICADO NA NFS-e</div>
  </div>

  <!-- Serviço Prestado -->
  <div class="section">
    <div class="section-title">SERVIÇO PRESTADO</div>
    <div class="row">
      <div class="cell"><label>Código de Tributação Nacional</label><span>${data.codigoTribNacional}</span></div>
      <div class="cell"><label>Código de Tributação Municipal</label><span>${data.codigoTribMunicipal}</span></div>
      <div class="cell"><label>Local da Prestação</label><span>${data.localPrestacao}</span></div>
      <div class="cell"><label>País da Prestação</label><span>${data.paisPrestacao}</span></div>
    </div>
    <div class="full-row">
      <label>Descrição do Serviço</label><br>
      <span>${data.descricaoServico}</span>
    </div>
  </div>

  <!-- Tributação Municipal -->
  <div class="section">
    <div class="section-title">TRIBUTAÇÃO MUNICIPAL</div>
    <div class="row">
      <div class="cell"><label>Tributação do ISSQN</label><span>${data.tributacaoIssqn}</span></div>
      <div class="cell"><label>País Resultado da Prestação do Serviço</label><span>${data.paisResultado}</span></div>
      <div class="cell"><label>Município de Incidência do ISSQN</label><span>${data.municipioIncidencia}</span></div>
      <div class="cell"><label>Regime Especial de Tributação</label><span>${data.regimeEspecial}</span></div>
    </div>
    <div class="row">
      <div class="cell"><label>Tipo de Imunidade</label><span>${data.tipoImunidade}</span></div>
      <div class="cell"><label>Suspensão da Exigibilidade do ISSQN</label><span>${data.suspensaoExigibilidade}</span></div>
      <div class="cell"><label>Número Processo Suspensão</label><span>${data.numeroProcessoSuspensao}</span></div>
      <div class="cell"><label>Benefício Municipal</label><span>${data.beneficioMunicipal}</span></div>
    </div>
    <div class="row">
      <div class="cell"><label>Valor do Serviço</label><span>${data.valorServico}</span></div>
      <div class="cell"><label>Desconto Incondicionado</label><span>${data.descontoIncondicionado}</span></div>
      <div class="cell"><label>Total Deduções/Reduções</label><span>${data.totalDeducoes}</span></div>
      <div class="cell"><label>Cálculo do BM</label><span>${data.calculoBm}</span></div>
    </div>
    <div class="row">
      <div class="cell"><label>BC ISSQN</label><span>${data.bcIssqn}</span></div>
      <div class="cell"><label>Alíquota Aplicada</label><span>${data.aliquotaAplicada}</span></div>
      <div class="cell"><label>Retenção do ISSQN</label><span>${data.retencaoIssqn}</span></div>
      <div class="cell"><label>ISSQN Apurado</label><span>${data.issqnApurado}</span></div>
    </div>
  </div>

  <!-- Tributação Federal -->
  <div class="section">
    <div class="section-title">TRIBUTAÇÃO FEDERAL</div>
    <div class="row">
      <div class="cell"><label>IRRF</label><span>${data.irrf}</span></div>
      <div class="cell"><label>Contribuição Previdenciária - Retida</label><span>${data.contribuicaoPrevidenciaria}</span></div>
      <div class="cell"><label>Contribuições Sociais - Retidas</label><span>${data.contribuicoesSociais}</span></div>
      <div class="cell"><label>Descrição Contrib. Sociais - Retidas</label><span>${data.descricaoContribSociais}</span></div>
    </div>
    <div class="row">
      <div class="cell"><label>PIS - Débito Apuração Própria</label><span>${data.pisDebito}</span></div>
      <div class="cell"><label>COFINS - Débito Apuração Própria</label><span>${data.cofinsDebito}</span></div>
      <div class="cell"></div>
      <div class="cell"></div>
    </div>
  </div>

  <!-- Valor Total -->
  <div class="section">
    <div class="section-title">VALOR TOTAL DA NFS-E</div>
    <div class="row">
      <div class="cell"><label>Valor do Serviço</label><span>${data.valorServicoTotal}</span></div>
      <div class="cell"><label>Desconto Condicionado</label><span>${data.descontoCondicionado}</span></div>
      <div class="cell"><label>Desconto Incondicionado</label><span>${data.descontoIncondicionadoTotal}</span></div>
      <div class="cell"><label>ISSQN Retido</label><span>${data.issqnRetido}</span></div>
    </div>
    <div class="row">
      <div class="cell"><label>Total das Retenções Federais</label><span>${data.totalRetencoesFederais}</span></div>
      <div class="cell"><label>PIS/COFINS - Débito Apur. Própria</label><span>${data.pisCofinsDebito}</span></div>
      <div class="cell"></div>
      <div class="cell"><label>Valor Líquido da NFS-e</label><span style="font-weight:bold; font-size:11px;">${data.valorLiquido}</span></div>
    </div>
  </div>

  <!-- Totais Aproximados -->
  <div class="section">
    <div class="section-title">TOTAIS APROXIMADOS DOS TRIBUTOS</div>
    <div class="row">
      <div class="cell" style="text-align:center;"><label>Federais</label><span>${data.tributosFederais}</span></div>
      <div class="cell" style="text-align:center;"><label>Estaduais</label><span>${data.tributosEstaduais}</span></div>
      <div class="cell" style="text-align:center;"><label>Municipais</label><span>${data.tributosMunicipais}</span></div>
    </div>
  </div>

  <!-- Informações Complementares -->
  <div class="section" style="border-bottom:none;">
    <div class="section-title">INFORMAÇÕES COMPLEMENTARES</div>
    <div class="info-complementar">
      <p>${data.informacoesComplementares}</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
