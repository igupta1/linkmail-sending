const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

/**
 * POST /api/upload
 * Upload a file and return the URL
 */
router.post('/', authenticateToken, upload.single('file'), (req, res) => {
  try {
    console.log('Upload request received:', {
      origin: req.get('origin'),
      userAgent: req.get('user-agent'),
      hasFile: !!req.file
    });

    if (!req.file) {
      console.log('No file provided in upload request');
      return res.status(400).json({
        error: 'BadRequest',
        message: 'No file provided'
      });
    }

    console.log('File uploaded successfully:', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // In a production environment, you'd upload to cloud storage (AWS S3, Google Cloud Storage, etc.)
    // For now, we'll serve files statically from the uploads directory
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      file: {
        url: fileUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      error: 'UploadFailed',
      message: 'Failed to upload file'
    });
  }
});

/**
 * Error handling middleware for multer
 */
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'FileTooLarge',
        message: 'File size exceeds 10MB limit'
      });
    }
  }
  
  if (error.message === 'File type not allowed') {
    return res.status(400).json({
      error: 'InvalidFileType',
      message: 'File type not allowed. Please upload PDF, Word, text, or image files.'
    });
  }
  
  next(error);
});

module.exports = router;
