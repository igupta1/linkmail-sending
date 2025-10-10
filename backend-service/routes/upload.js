const express = require('express');
const multer = require('multer');
const { put, del } = require('@vercel/blob');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Use memory storage for multer - we'll upload to Vercel Blob from memory
const upload = multer({
  storage: multer.memoryStorage(),
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
 * Upload a file to Vercel Blob Storage and return the URL
 */
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log('Upload request received:', {
      origin: req.get('origin'),
      userAgent: req.get('user-agent'),
      hasFile: !!req.file,
      userId: req.user?.id
    });

    if (!req.file) {
      console.log('No file provided in upload request');
      return res.status(400).json({
        error: 'BadRequest',
        message: 'No file provided'
      });
    }

    console.log('File uploaded successfully to memory:', {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Upload to Vercel Blob Storage
    const blob = await put(req.file.originalname, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
      addRandomSuffix: true, // Adds random suffix to prevent filename collisions
    });

    console.log('File uploaded to Vercel Blob:', {
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType
    });

    res.json({
      success: true,
      file: {
        url: blob.url,
        originalName: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        pathname: blob.pathname // Store pathname for potential deletion
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      error: 'UploadFailed',
      message: 'Failed to upload file: ' + error.message
    });
  }
});

/**
 * DELETE /api/upload/:pathname
 * Delete a file from Vercel Blob Storage
 */
router.delete('/:pathname(*)', authenticateToken, async (req, res) => {
  try {
    const pathname = req.params.pathname;
    
    if (!pathname) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'File pathname is required'
      });
    }

    console.log('Deleting file from Vercel Blob:', pathname);

    // Delete from Vercel Blob
    await del(pathname);

    console.log('File deleted successfully:', pathname);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      error: 'DeletionFailed',
      message: 'Failed to delete file: ' + error.message
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
