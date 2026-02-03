# meetingminer
## 🌐 Live Deployment

**Production URL:** https://meetingminer-yourname.onrender.com

Deployed on Render's free tier. Note: The app may take 30-50 seconds to wake up from sleep on first request.

## Deployment Instructions

This project is configured for easy deployment to Render:

1. Fork this repository
2. Sign up at [Render.com](https://render.com)
3. Create a new **Web Service**
4. Connect your GitHub repository
5. Use these settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment Variable:** `GEMINI_API_KEY` = your API key
6. Click **Create Web Service**

Your app will be live in minutes!
