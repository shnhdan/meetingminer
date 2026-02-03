require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Check API key exists
if (!process.env.GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY not found in .env file!');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Main analysis endpoint
app.post('/analyze', upload.single('file'), async (req, res) => {
  console.log('\n=== NEW ANALYSIS REQUEST ===');
  
  try {
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', req.file.originalname);
    console.log('File size:', req.file.size, 'bytes');
    console.log('Mime type:', req.file.mimetype);

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    
   // Determine mime type
    let mimeType = req.file.mimetype;
    if (!mimeType || mimeType === 'application/octet-stream') {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const mimeMap = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.rtf': 'text/plain'  // Treat RTF as plain text
      };
      mimeType = mimeMap[ext] || 'text/plain';
    }

    console.log('Final mime type:', mimeType);

    // Use Gemini 2.0 Flash - THIS IS THE IMPORTANT CHANGE
    console.log('Initializing Gemini model...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `You are MeetingMiner, an AI that extracts actionable intelligence from meeting content.

Analyze this meeting content and provide:

1. **ACTION ITEMS** - List each action item with:
   - What needs to be done
   - Who is responsible (if mentioned)
   - Deadline (if mentioned)
   - Priority level (High/Medium/Low based on context)

2. **KEY DECISIONS** - What decisions were made and the rationale

3. **IMPORTANT TOPICS** - Main discussion points

4. **CONFLICTS/RISKS** - Any disagreements, blockers, or potential issues

5. **FOLLOW-UP NEEDED** - Questions left unanswered or topics needing more discussion

6. **CONTEXT BRIEF** - A 2-3 sentence summary for someone who missed the meeting

Format your response in clear sections with markdown. Be specific and actionable.`;

    console.log('Sending request to Gemini API...');
    
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      },
      { text: prompt }
    ]);

    console.log('Received response from Gemini');

    const response = await result.response;
    const analysis = response.text();

    console.log('Analysis length:', analysis.length, 'characters');
    console.log('First 100 chars:', analysis.substring(0, 100));

    // Clean up uploaded file
    fs.unlinkSync(filePath);
    console.log('Cleaned up uploaded file');

    res.json({ analysis });
    console.log('=== ANALYSIS COMPLETE ===\n');

  } catch (error) {
    console.error('\n!!! ERROR !!!');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: error.message,
      details: error.toString()
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    apiKeyConfigured: !!process.env.GEMINI_API_KEY
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 MeetingMiner running on port ${PORT}`);
  console.log(`📂 Open: http://localhost:${PORT}`);
  console.log(`🔑 API Key configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'NO - CHECK .env FILE!'}\n`);
});