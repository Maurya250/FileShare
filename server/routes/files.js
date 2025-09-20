const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const File = require('../models/File');
const auth = require('../middleware/auth');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now
    cb(null, true);
  }
});

// Upload file
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { password, expiresIn } = req.body;
    
    // Calculate expiration date
    let expiresAt = null;
    if (expiresIn && expiresIn !== 'never') {
      const hours = parseInt(expiresIn);
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }

    // Create file record
    const file = new File({
      originalName: req.file.originalname,
      fileName: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedBy: req.user._id,
      shareId: uuidv4(),
      password: password || null,
      expiresAt: expiresAt
    });

    await file.save();

    res.json({
      message: 'File uploaded successfully',
      file: {
        id: file._id,
        originalName: file.originalName,
        size: file.size,
        shareId: file.shareId,
        shareLink: `${req.protocol}://${req.get('host')}/api/files/download/${file.shareId}`,
        uploadedAt: file.createdAt,
        expiresAt: file.expiresAt
      }
    });
  } catch (error) {
    // Clean up uploaded file if database save fails
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ 
      message: 'Upload failed', 
      error: error.message 
    });
  }
});

// Get user's files
router.get('/my-files', auth, async (req, res) => {
  try {
    const files = await File.find({ 
      uploadedBy: req.user._id,
      isActive: true 
    })
    .sort({ createdAt: -1 })
    .select('-path');

    const filesWithLinks = files.map(file => ({
      ...file.toObject(),
      shareLink: `${req.protocol}://${req.get('host')}/api/files/download/${file.shareId}`
    }));

    res.json({ files: filesWithLinks });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to fetch files', 
      error: error.message 
    });
  }
});

// Download file
router.get('/download/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    const { password } = req.query;

    const file = await File.findOne({ 
      shareId, 
      isActive: true 
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check expiration
    if (file.expiresAt && new Date() > file.expiresAt) {
      return res.status(410).json({ message: 'File has expired' });
    }

    // Check password
    if (file.password && file.password !== password) {
      return res.status(401).json({ message: 'Password required' });
    }

    // Check if file exists
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    // Increment download count
    file.downloadCount += 1;
    await file.save();

    // Send file
    res.download(file.path, file.originalName);
  } catch (error) {
    res.status(500).json({ 
      message: 'Download failed', 
      error: error.message 
    });
  }
});

// Delete file
router.delete('/:id', auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      uploadedBy: req.user._id
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete from disk
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Delete from database
    await File.findByIdAndDelete(file._id);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ 
      message: 'Delete failed', 
      error: error.message 
    });
  }
});

// Get file info (for sharing page)
router.get('/info/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;

    const file = await File.findOne({ 
      shareId, 
      isActive: true 
    })
    .select('originalName size mimetype downloadCount createdAt expiresAt password')
    .populate('uploadedBy', 'username');

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check expiration
    if (file.expiresAt && new Date() > file.expiresAt) {
      return res.status(410).json({ message: 'File has expired' });
    }

    res.json({
      file: {
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype,
        downloadCount: file.downloadCount,
        uploadedAt: file.createdAt,
        expiresAt: file.expiresAt,
        hasPassword: !!file.password,
        uploadedBy: file.uploadedBy.username
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to get file info', 
      error: error.message 
    });
  }
});

module.exports = router;