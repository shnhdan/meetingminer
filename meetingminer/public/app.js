const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const analysisContent = document.getElementById('analysisContent');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const copyBtn = document.getElementById('copyBtn');

let selectedFile = null;
let currentAnalysis = '';

// Click to upload
uploadBox.addEventListener('click', () => {
  fileInput.click();
});

// File selection
fileInput.addEventListener('change', (e) => {
  handleFile(e.target.files[0]);
});

// Drag and drop
uploadBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadBox.classList.add('drag-over');
});

uploadBox.addEventListener('dragleave', () => {
  uploadBox.classList.remove('drag-over');
});

uploadBox.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadBox.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
  if (!file) return;

  selectedFile = file;
  uploadBox.classList.add('file-selected');
  uploadBox.querySelector('.upload-text').textContent = `Selected: ${file.name}`;
  uploadBox.querySelector('.upload-hint').textContent = 'Click "Analyze Meeting" to proceed';
  analyzeBtn.disabled = false;
}

// Analyze button
analyzeBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  // Show loading
  document.querySelector('.upload-section').style.display = 'none';
  loadingSection.style.display = 'block';
  resultsSection.style.display = 'none';
  document.getElementById('dashboardSection').style.display = 'none';

  try {
    const formData = new FormData();
    formData.append('file', selectedFile);

    const response = await fetch('/analyze', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();

    // Store current analysis
    currentAnalysis = data.analysis;

    // Show results
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'block';
    
    // Convert markdown to HTML
    analysisContent.innerHTML = formatMarkdown(data.analysis);
    
    // Parse and show dashboard
    parseActionItems(data.analysis);

  } catch (error) {
    loadingSection.style.display = 'none';
    alert('Error analyzing meeting: ' + error.message);
    resetUpload();
  }
});

// Parse and display action items dashboard
function parseActionItems(analysisText) {
  const actionItemsSection = analysisText.match(/## 1\. ACTION ITEMS([\s\S]*?)(?=## |$)/i);
  if (!actionItemsSection) {
    document.getElementById('dashboardSection').style.display = 'none';
    return;
  }
  
  const items = [];
  const lines = actionItemsSection[1].split('\n');
  
  lines.forEach(line => {
    if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
      const taskMatch = line.match(/\*\*Task:\*\*\s*(.+?)(?:\||$)/i);
      const ownerMatch = line.match(/\*\*Owner:\*\*\s*(.+?)(?:\||$)/i);
      const deadlineMatch = line.match(/\*\*Deadline:\*\*\s*(.+?)(?:\||$)/i);
      const priorityMatch = line.match(/\*\*Priority:\*\*\s*(High|Medium|Low)/i);
      
      if (taskMatch) {
        items.push({
          task: taskMatch[1].trim(),
          owner: ownerMatch ? ownerMatch[1].trim() : 'Unassigned',
          deadline: deadlineMatch ? deadlineMatch[1].trim() : 'No deadline',
          priority: priorityMatch ? priorityMatch[1].trim() : 'Medium'
        });
      }
    }
  });
  
  if (items.length === 0) {
    document.getElementById('dashboardSection').style.display = 'none';
    return;
  }
  
  // Update stats
  document.getElementById('totalItems').textContent = items.length;
  document.getElementById('highPriority').textContent = items.filter(i => i.priority === 'High').length;
  document.getElementById('mediumPriority').textContent = items.filter(i => i.priority === 'Medium').length;
  document.getElementById('lowPriority').textContent = items.filter(i => i.priority === 'Low').length;
  
  // Display items
  const itemsList = document.getElementById('actionItemsList');
  itemsList.innerHTML = items.map(item => `
    <div class="action-item ${item.priority.toLowerCase()}">
      <div class="action-item-header">
        <div class="action-item-task">${item.task}</div>
        <span class="action-item-priority priority-${item.priority.toLowerCase()}">${item.priority}</span>
      </div>
      <div class="action-item-details">
        <span>👤 ${item.owner}</span>
        <span>📅 ${item.deadline}</span>
      </div>
    </div>
  `).join('');
  
  document.getElementById('dashboardSection').style.display = 'block';
}

// Export PDF
exportPdfBtn.addEventListener('click', async () => {
  try {
    const response = await fetch('/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis: currentAnalysis,
        filename: `meeting-analysis-${Date.now()}`
      })
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-analysis-${Date.now()}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    alert('Failed to export PDF: ' + error.message);
  }
});

// Copy to clipboard
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(currentAnalysis).then(() => {
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  }).catch(() => {
    alert('Failed to copy to clipboard');
  });
});

// New analysis button
newAnalysisBtn.addEventListener('click', resetUpload);

function resetUpload() {
  selectedFile = null;
  currentAnalysis = '';
  fileInput.value = '';
  uploadBox.classList.remove('file-selected');
  uploadBox.querySelector('.upload-text').textContent = 'Click to upload or drag & drop';
  uploadBox.querySelector('.upload-hint').textContent = 'Screenshots, PDFs, or text files';
  analyzeBtn.disabled = true;
  
  document.querySelector('.upload-section').style.display = 'block';
  loadingSection.style.display = 'none';
  resultsSection.style.display = 'none';
  document.getElementById('dashboardSection').style.display = 'none';
}

// Better markdown to HTML converter
function formatMarkdown(text) {
  let html = text;
  
  // Escape HTML first to prevent injection
  html = html.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');
  
  // Headers (must come before other formatting)
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Lists - improved handling
  let lines = html.split('\n');
  let inList = false;
  let processedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Check if this is a list item
    if (line.match(/^[\*\-]\s+(.+)/)) {
      if (!inList) {
        processedLines.push('<ul>');
        inList = true;
      }
      let content = line.replace(/^[\*\-]\s+/, '');
      processedLines.push(`<li>${content}</li>`);
    } 
    // Check if this is a numbered list item
    else if (line.match(/^\d+\.\s+(.+)/)) {
      if (!inList) {
        processedLines.push('<ol>');
        inList = true;
      }
      let content = line.replace(/^\d+\.\s+/, '');
      processedLines.push(`<li>${content}</li>`);
    }
    // Not a list item
    else {
      if (inList && line.length > 0) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(line);
    }
  }
  
  // Close list if still open
  if (inList) {
    processedLines.push('</ul>');
  }
  
  html = processedLines.join('\n');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // Line breaks and paragraphs
  html = html.replace(/\n\n+/g, '</p><p>');
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*<h/g, '<h');
  html = html.replace(/<\/h(\d)>\s*<\/p>/g, '</h$1>');
  html = html.replace(/<p>\s*<ul>/g, '<ul>');
  html = html.replace(/<\/ul>\s*<\/p>/g, '</ul>');
  html = html.replace(/<p>\s*<ol>/g, '<ol>');
  html = html.replace(/<\/ol>\s*<\/p>/g, '</ol>');
  html = html.replace(/<p>\s*<pre>/g, '<pre>');
  html = html.replace(/<\/pre>\s*<\/p>/g, '</pre>');
  
  return html;
}