-- AlterTable: Adicionar campos de redefinição de senha (esqueci minha senha)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordExpires" TIMESTAMP(3);
