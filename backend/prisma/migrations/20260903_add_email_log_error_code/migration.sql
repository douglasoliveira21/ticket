-- AlterTable: Adicionar tipo de erro estruturado ao historico de envio de e-mails
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "errorCode" TEXT;
