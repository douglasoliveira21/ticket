-- AlterTable: Adicionar campos do certificado digital A1 na tabela fiscal_settings
ALTER TABLE "fiscal_settings" ADD COLUMN IF NOT EXISTS "certificadoBase64" TEXT;
ALTER TABLE "fiscal_settings" ADD COLUMN IF NOT EXISTS "certificadoNome" TEXT;
ALTER TABLE "fiscal_settings" ADD COLUMN IF NOT EXISTS "certificadoValidade" TIMESTAMP(3);

-- Remover coluna antiga (certificadoPath) se existir
ALTER TABLE "fiscal_settings" DROP COLUMN IF EXISTS "certificadoPath";
