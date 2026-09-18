-- AlterTable: Codigo de tributacao municipal (3 digitos), exigido pelo SEFIN Nacional
-- para municipios que administram o ISSQN pela lista de servicos propria (erro E0312).
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "cTribMun" TEXT;
