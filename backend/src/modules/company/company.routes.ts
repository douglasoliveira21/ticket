import { Router } from 'express';
import multer from 'multer';
import { getCompany, updateCompany, updateFiscalSettings, getFiscalSettings } from './company.controller';
import { uploadCertificate, getCertificateInfo, deleteCertificate } from './certificate.controller';
import { authGuard, adminGuard } from '../../common/guards/auth.guard';

export const companyRouter = Router();

// Multer config para upload do certificado (in-memory, max 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.pfx') || ext.endsWith('.p12')) {
      cb(null, true);
    } else {
      cb(new Error('Formato inválido. Envie um arquivo .pfx ou .p12'));
    }
  },
});

companyRouter.use(authGuard);
companyRouter.get('/me', getCompany);
companyRouter.put('/me', adminGuard, updateCompany);
companyRouter.get('/fiscal-settings', getFiscalSettings);
companyRouter.put('/fiscal-settings', adminGuard, updateFiscalSettings);

// Certificado Digital A1
companyRouter.get('/certificate', getCertificateInfo);
companyRouter.post('/certificate', adminGuard, upload.single('certificado'), uploadCertificate);
companyRouter.delete('/certificate', adminGuard, deleteCertificate);
