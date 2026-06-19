# 🧾 Gestão Fiscal - NFS-e para Eventos (Sympla + Prefeitura BH)

SaaS para gestão fiscal de tickets/eventos. Importa vendas da Sympla e emite Nota Fiscal de Serviço Eletrônica (NFS-e) pela Prefeitura de Belo Horizonte.

## 📋 Funcionalidades MVP

- ✅ Autenticação (login, cadastro, JWT, multitenant)
- ✅ Cadastro da empresa com dados fiscais
- ✅ Integração Sympla (token, importação de eventos e vendas)
- ✅ Gestão de eventos importados
- ✅ Gestão de vendas/tickets com filtros
- ✅ Emissão de NFS-e manual e em lote
- ✅ Emissão automática para novas vendas
- ✅ Envio de nota por e-mail ao comprador
- ✅ Dashboard com estatísticas
- ✅ Logs e auditoria
- ✅ Deploy via Docker / EasyPanel

## 🛠️ Stack

| Camada    | Tecnologia                            |
|-----------|---------------------------------------|
| Frontend  | React + Vite + TypeScript + Tailwind  |
| Backend   | Node.js + Express + TypeScript        |
| ORM       | Prisma                                |
| Banco     | PostgreSQL 16                         |
| Auth      | JWT + bcrypt                          |
| E-mail    | Nodemailer                            |
| Deploy    | Docker + docker-compose + EasyPanel   |

## 🚀 Deploy no EasyPanel

### 1. Criar o projeto no EasyPanel

1. Acesse seu EasyPanel
2. Crie um novo projeto chamado `nfse-sympla`
3. Adicione 3 serviços:

### 2. Serviço PostgreSQL
- Tipo: PostgreSQL
- Versão: 16
- Database: `nfse_sympla`
- User: `postgres`
- Password: (defina uma senha forte)

### 3. Serviço Backend
- Tipo: App (Dockerfile)
- Contexto: `/backend`
- Dockerfile: `Dockerfile`
- Porta: `3001`
- Variáveis de ambiente:
```env
NODE_ENV=production
BACKEND_PORT=3001
DATABASE_URL=postgresql://postgres:SENHA@postgres:5432/nfse_sympla?schema=public
JWT_SECRET=sua-chave-secreta-jwt-minimo-32-caracteres
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=chave-de-32-caracteres-para-aes!
FRONTEND_URL=https://seu-dominio.com
SYMPLA_BASE_URL=https://api.sympla.com.br/public/v4
PBH_NFSE_ENV=homologacao
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@gmail.com
SMTP_PASS=app-password
SMTP_FROM=noreply@dominio.com
SMTP_FROM_NAME=Gestão Fiscal
```

### 4. Serviço Frontend
- Tipo: App (Dockerfile)
- Contexto: `/frontend`
- Dockerfile: `Dockerfile`
- Porta: `80`
- Domínio: Configure o domínio desejado

### 5. Networking
- O nginx do frontend faz proxy de `/api/*` para `backend:3001`
- Certifique-se de que os serviços estão na mesma rede

## 💻 Desenvolvimento Local

### Pré-requisitos
- Node.js 20+
- PostgreSQL 16
- npm ou yarn

### Backend

```bash
cd backend
cp .env.example .env
# Edite o .env com suas configurações
npm install
npx prisma migrate dev
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Com Docker Compose

```bash
cp .env.example .env
# Edite o .env
docker-compose up --build
```

Acesse: http://localhost

## 📁 Estrutura do Projeto

```
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Schema do banco
│   ├── src/
│   │   ├── main.ts                # Entry point
│   │   ├── common/
│   │   │   ├── filters/           # Error handlers
│   │   │   ├── guards/            # Auth guards
│   │   │   └── utils/             # Prisma, encryption
│   │   └── modules/
│   │       ├── auth/              # Login, register
│   │       ├── company/           # Empresa, fiscal settings
│   │       ├── sympla/            # Integração Sympla
│   │       ├── events/            # Gestão de eventos
│   │       ├── orders/            # Vendas/tickets
│   │       ├── invoices/          # NFS-e (emissão, lote)
│   │       ├── email/             # Envio de e-mail
│   │       ├── dashboard/         # Estatísticas
│   │       └── audit/             # Logs
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Telas
│   │   ├── components/            # UI components
│   │   ├── contexts/              # Auth context
│   │   └── services/              # API client
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🔐 Segurança

- Senhas hash com bcrypt (12 rounds)
- Tokens e credenciais criptografados com AES
- JWT com expiração configurável
- Rate limiting no backend
- CORS restrito ao frontend
- Separação por tenant (company_id) em todas as queries
- Helmet para headers HTTP seguros

## ⚠️ NFS-e - Notas Importantes

- **Homologação**: Notas são simuladas localmente (não comunicam com a Prefeitura)
- **Produção**: Requer:
  - Certificado Digital A1 (e-CNPJ)
  - Credenciais do BHISS Digital
  - Inscrição Municipal válida em BH
  - Configuração completa dos dados fiscais

A camada de NFS-e está isolada (`nfse-bh.service.ts`) para facilitar adaptação a outras prefeituras no futuro.

## 📝 Roadmap

### Fase 2 (Futuro)
- [ ] Eventos próprios (criação interna)
- [ ] Venda própria de tickets
- [ ] Gateway de pagamento (PIX, cartão)
- [ ] Página pública do evento
- [ ] Check-in por QR Code
- [ ] Relatórios avançados
- [ ] Multi-prefeituras
- [ ] Webhooks
- [ ] BullMQ para fila de emissão
