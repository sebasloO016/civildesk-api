const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage para imagenes (fotos de reportes)
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'civildesk/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto' }],
  },
});

// Storage para documentos (PDFs, contratos, facturas)
const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'civildesk/documents',
    allowed_formats: ['pdf'],
    resource_type:   'raw',
  },
});

const uploadImage    = multer({ storage: imageStorage,    limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB
const uploadDocument = multer({ storage: documentStorage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB
const uploadMultiple = multer({ storage: imageStorage,    limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { cloudinary, uploadImage, uploadDocument, uploadMultiple };
