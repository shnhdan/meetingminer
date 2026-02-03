const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const analysisContent = document.getElementById('analysisContent');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');

let selectedFile = null;

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

    // Show results
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'block';
    
    // Convert markdown to HTML (basic)
    analysisContent.innerHTML = formatMarkdown(data.analysis);

  } catch (error) {
    loadingSection.style.display = 'none';
    alert('Error analyzing meeting: ' + error.message);
    resetUpload();
  }
});

// New analysis button
newAnalysisBtn.addEventListener('click', resetUpload);

function resetUpload() {
  selectedFile = null;
  fileInput.value = '';
  uploadBox.classList.remove('file-selected');
  uploadBox.querySelector('.upload-text').textContent = 'Click to upload or drag & drop';
  uploadBox.querySelector('.upload-hint').textContent = 'Screenshots, PDFs, or text files';
  analyzeBtn.disabled = true;
  
  document.querySelector('.upload-section').style.display = 'block';
  loadingSection.style.display = 'none';
  resultsSection.style.display = 'none';
}

// Basic markdown to HTML converter
function formatMarkdown(text) {
  let html = text;
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Lists
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>\s*<h/g, '<h');
  html = html.replace(/<\/h(\d)>\s*<\/p>/g, '</h$1>');
  html = html.replace(/<p>\s*<ul>/g, '<ul>');
  html = html.replace(/<\/ul>\s*<\/p>/g, '</ul>');
  
  return html;
}