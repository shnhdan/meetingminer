require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Check API key exists
if (!process.env.GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY not found in .env file!');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// In-memory storage for meeting history
const meetingHistory = [];

// Helper function to add to history
function addToHistory(filename, analysis, timestamp) {
  meetingHistory.unshift({
    id: Date.now(),
    filename: filename,
    timestamp: timestamp,
    analysis: analysis,
    summary: analysis.substring(0, 300) + '...'
  });
  
  // Keep only last 10 meetings
  if (meetingHistory.length > 10) {
    meetingHistory.pop();
  }
}

// Helper to get context from history
function getHistoricalContext() {
  if (meetingHistory.length === 0) return '';
  
  return `\n\n**PREVIOUS MEETINGS CONTEXT:**
${meetingHistory.slice(0, 3).map((m, i) => 
  `Meeting ${i+1} (${m.filename}): ${m.summary}`
).join('\n\n')}`;
}

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
        '.rtf': 'text/plain'
      };
      mimeType = mimeMap[ext] || 'text/plain';
    }

    console.log('Final mime type:', mimeType);

    // Use Gemini 3 Flash
    console.log('Initializing Gemini model...');
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const historicalContext = getHistoricalContext();

    const prompt = `You are MeetingMiner, an AI that extracts actionable intelligence from meeting content.
${historicalContext}

Analyze this NEW meeting content and provide a structured response.

**IMPORTANT:**
- If topics from previous meetings appear again, note this under "RECURRING TOPICS"
- If action items from previous meetings are mentioned, track their status
- Identify if decisions conflict with previous decisions
- Use markdown lists (start lines with * or -)
- Use **bold** for labels like Task, Owner, Deadline, Priority

Format your response in markdown with clear sections:

## 1. ACTION ITEMS
List each as a bullet:
* **Task:** [description] | **Owner:** [name] | **Deadline:** [date] | **Priority:** [High/Medium/Low]

## 2. KEY DECISIONS
* **Decision:** [what was decided]
* **Rationale:** [why]

## 3. IMPORTANT TOPICS
* Topic 1: Brief description
* Topic 2: Brief description

## 4. CONFLICTS/RISKS
* Any blockers or disagreements

## 5. RECURRING TOPICS
${historicalContext ? '* Topics that appeared in previous meetings' : '* (First meeting - no history yet)'}

## 6. FOLLOW-UP NEEDED
* Unanswered questions

## 7. CONTEXT BRIEF
2-3 sentence summary for someone who missed the meeting.

Use markdown formatting throughout!`;

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

    // Add to history
    addToHistory(req.file.originalname, analysis, new Date().toISOString());

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

// Get meeting history
app.get('/history', (req, res) => {
  res.json({ 
    meetings: meetingHistory.map(m => ({
      id: m.id,
      filename: m.filename,
      timestamp: m.timestamp,
      summary: m.summary
    }))
  });
});

// Export analysis as PDF
app.post('/export-pdf', express.json(), (req, res) => {
  try {
    const { analysis, filename } = req.body;
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'meeting-analysis'}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add content
    doc.fontSize(24).text('MeetingMiner Analysis', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(new Date().toLocaleString(), { align: 'center' });
    doc.moveDown(2);
    
    // Add analysis (strip markdown for simple PDF)
    const plainText = analysis
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '');
    
    doc.fontSize(11).text(plainText, {
      align: 'left',
      lineGap: 5
    });
    
    doc.end();
    
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    apiKeyConfigured: !!process.env.GEMINI_API_KEY,
    meetingsInHistory: meetingHistory.length
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 MeetingMiner running on port ${PORT}`);
  console.log(`📂 Open: http://localhost:${PORT}`);
  console.log(`🔑 API Key configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'NO - CHECK .env FILE!'}\n`);
});