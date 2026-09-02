-- AlterTable: Adicionar campos do Sistema Nacional NFS-e (obrigatorio p/ BH desde 01/01/2026)
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "cTribNac" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "chaveAcesso" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "idDps" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_chaveAcesso_key" ON "invoices"("chaveAcesso");
