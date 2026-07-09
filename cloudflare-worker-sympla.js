/**
 * Cloudflare Worker - Proxy para API Sympla
 * 
 * Este worker repassa as requisições do seu servidor para a API do Sympla,
 * evitando bloqueio da Cloudflare por IP de datacenter.
 * 
 * Cole este código no editor de Workers da Cloudflare.
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Construir a URL de destino (API Sympla)
    const targetUrl = 'https://api.sympla.com.br/public/v1.5.1' + url.pathname + url.search;

    // Copiar headers da requisição original
    const headers = new Headers(request.headers);
    headers.set('Host', 'api.sympla.com.br');
    
    // Fazer a requisição para a API Sympla
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' ? request.body : undefined,
    });

    // Retornar a resposta com CORS habilitado
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  }
};
