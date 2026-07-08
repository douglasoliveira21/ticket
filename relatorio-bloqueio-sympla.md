# Relatório Técnico — Bloqueio de Acesso à API Pública Sympla

**Data:** 02/07/2026  
**Solicitante:** Douglas Oliveira  
**Assunto:** IP de servidor bloqueado pela Cloudflare ao acessar a API Pública do Sympla

---

## Resumo do Problema

Estamos desenvolvendo uma integração com a **API Pública do Sympla** (endpoint `https://api.sympla.com.br/public/v4/`) para importar eventos e participantes em nosso sistema de gestão fiscal. O token de acesso foi gerado corretamente pelo painel do Sympla, porém as requisições realizadas a partir do nosso servidor de produção estão sendo **bloqueadas pela proteção Cloudflare** antes de chegarem à API.

---

## Evidências

### Teste 1 — Requisição a partir de máquina local (funciona)

```
curl -H "s_token: [TOKEN_VÁLIDO]" "https://api.sympla.com.br/public/v4/events?page_size=1"
```

**Resultado:** ✅ Sucesso — Retorna JSON com os eventos corretamente.

### Teste 2 — Mesma requisição a partir do servidor de produção (bloqueado)

```
curl -H "s_token: [TOKEN_VÁLIDO]" "https://api.sympla.com.br/public/v4/events?page_size=1"
```

**Resultado:** ❌ Bloqueado — Retorna página HTML da Cloudflare com a mensagem:

> "Sorry, you have been blocked. You are unable to access sympla.com.br."

**Cloudflare Ray ID:** a147f023d9d3a0f4

---

## Dados do Servidor

| Informação | Valor |
|---|---|
| **IP do servidor** | 217.216.82.52 |
| **Provedor** | EasyPanel (hospedagem cloud) |
| **Localização** | Datacenter Europa |
| **Uso** | Sistema SaaS de gestão fiscal para eventos |

---

## Análise Técnica

1. O **token de autenticação está correto** — confirmado pelo teste bem-sucedido a partir de IP residencial.
2. O **código da aplicação está correto** — envia o header `s_token` conforme documentação da API Pública.
3. O bloqueio ocorre na **camada WAF (Web Application Firewall) da Cloudflare**, antes da requisição chegar à API do Sympla.
4. O IP `217.216.82.52` provavelmente está em um range de IPs marcados como suspeitos pela Cloudflare, possivelmente por uso anterior de outros clientes do mesmo provedor.
5. Adicionamos headers como `User-Agent` e `Accept` para simular requisição de navegador, sem sucesso — o bloqueio é por IP.

---

## Impacto

- Não conseguimos importar eventos do Sympla automaticamente
- Não conseguimos sincronizar vendas/participantes
- A integração funciona 100% em ambiente local mas não em produção
- Estamos impossibilitados de operar o sistema em produção

---

## Solicitação

Solicitamos gentilmente a **liberação do IP `217.216.82.52`** (ou do range associado) na proteção Cloudflare/WAF do Sympla para acesso à API Pública (`api.sympla.com.br`).

Alternativamente, caso haja um processo específico para whitelist de IPs de integrações via API, gostaríamos de ser orientados sobre como proceder.

---

## Dados da Conta

- **E-mail da conta Sympla:** [seu email do Sympla]
- **Token utilizado:** Gerado via "Minha Conta" → "Integrações" → "API Pública"
- **Endpoint acessado:** `https://api.sympla.com.br/public/v4/events`

---

## Contato

Douglas Oliveira  
[seu email]  
[seu telefone]
