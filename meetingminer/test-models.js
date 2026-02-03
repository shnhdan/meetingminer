require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const modelsToTry = [
  'gemini-2.0-flash-exp',
  'gemini-flash-2.0',
  'gemini-2.5-flash-latest-exp',
  'gemini-2.5-flash-preview-exp',
  'gemini-3-flash-preview-exp',
  'gemini-pro',
  'gemini-1.5-pro',
  'gemini-1.5-flash-latest',
  'gemini-exp-1206'
];

async function testModel(modelName) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Say hi');
    const response = await result.response;
    console.log(`✅ SUCCESS: ${modelName}`);
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${modelName}`);
    return false;
  }
}

async function findWorkingModel() {
  console.log('Testing models...\n');
  
  for (const modelName of modelsToTry) {
    const works = await testModel(modelName);
    if (works) {
      console.log(`\n🎉 USE THIS MODEL: "${modelName}"\n`);
      break;
    }
  }
}

findWorkingModel();