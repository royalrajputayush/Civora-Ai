/**
 * Civora AI — Vision Engine Module
 * Integrates with Google Gemini Vision API to analyze screen captures.
 * Handles prompt engineering, API calls, and response parsing.
 */

export class VisionEngine {
  constructor() {
    this.apiKey = null;
    this.model = 'gemini-3.6-flash';
    this.apiBase = 'https://generativelanguage.googleapis.com/v1beta';
    this.isProcessing = false;
    this.lastAnalysis = null;
  }

  /**
   * Set the API key
   */
  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Check if API key is configured
   */
  isConfigured() {
    return !!(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Analyze a screen image and get guidance
   * @param {string} base64Image - Base64 encoded image (without data URL prefix)
   * @param {string} mimeType - MIME type of the image (e.g., 'image/jpeg')
   * @param {object} workflowContext - Current workflow context from ProcessKnowledge
   * @returns {Promise<object>} Analysis result
   */
  async analyzeScreen(base64Image, mimeType = 'image/jpeg', workflowContext = null) {
    if (!this.isConfigured()) {
      throw new Error('API key not configured. Please set your Gemini API key in Settings.');
    }

    if (this.isProcessing) {
      return null; // Skip if already processing
    }

    this.isProcessing = true;

    try {
      const prompt = this.buildPrompt(workflowContext);
      const result = await this.callGeminiVision(base64Image, mimeType, prompt);
      this.lastAnalysis = result;
      return result;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Build the analysis prompt with workflow context
   */
  buildPrompt(workflowContext) {
    let contextSection = '';
    
    if (workflowContext) {
      contextSection = `
WORKFLOW CONTEXT:
Service: ${workflowContext.serviceName || 'Unknown'}
Known Steps: ${workflowContext.steps ? workflowContext.steps.map(s => s.name).join(' → ') : 'None'}
${workflowContext.currentStep ? `Current Expected Step: ${workflowContext.currentStep.name}` : ''}
${workflowContext.expectedElements ? `Expected Elements: ${workflowContext.expectedElements.join(', ')}` : ''}
`;
    }

    return `You are Civora AI, a visual assistant that guides users through Indian government service websites and apps. Analyze this screenshot and provide step-by-step guidance.

${contextSection}

INSTRUCTIONS:
1. Identify what screen/page the user is currently viewing
2. Detect all interactive elements (buttons, links, input fields, menus, dropdowns)
3. Determine which step of the government service process this represents
4. Identify the SINGLE most important next action the user should take
5. Locate where on the screen the target element is (approximate position)
6. Check for any security elements (CAPTCHA, OTP) that the user must handle themselves

RESPOND IN THIS EXACT JSON FORMAT:
{
  "screenTitle": "Brief title of what this screen shows",
  "currentStep": "Name of the current process step",
  "stepNumber": 1,
  "totalStepsEstimate": 5,
  "detectedElements": ["element1", "element2", "element3"],
  "nextAction": {
    "instruction": "The simple instruction (e.g., 'Tap Online Services')",
    "targetElement": "Name of the button/link/field to interact with",
    "targetLocation": {
      "description": "Where on the screen (e.g., 'top menu bar', 'center of page', 'bottom right')",
      "approximateX": 50,
      "approximateY": 30
    },
    "actionType": "tap|type|select|scroll|upload"
  },
  "tip": "A helpful tip for this step",
  "isSecurityBoundary": false,
  "securityNote": null,
  "serviceIdentified": "Name of the government service if identifiable",
  "confidence": 0.85
}

IMPORTANT RULES:
- Give ONE clear instruction at a time, not multiple steps
- Use simple, non-technical language
- If you see a CAPTCHA, tell the user to solve it themselves
- If you see an OTP field, tell the user to enter their OTP
- approximateX and approximateY should be percentages (0-100) from top-left of the screen
- Be specific about which button/link to tap
- If unsure about the government service, still provide useful UI navigation guidance
- ALWAYS respond with valid JSON only, no other text`;
  }

  /**
   * Call the Gemini Vision API
   */
  async callGeminiVision(base64Image, mimeType, prompt) {
    const url = `${this.apiBase}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 400) {
          throw new Error('Invalid request. Please check your API key.');
        }
        if (response.status === 403) {
          throw new Error('API key not authorized. Please verify your Gemini API key.');
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract the text response
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textContent) {
        throw new Error('No response from AI model.');
      }

      // Parse JSON response
      try {
        return JSON.parse(textContent);
      } catch (parseErr) {
        // Try to extract JSON from the response if it's wrapped in markdown
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Failed to parse AI response.');
      }
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw err;
    }
  }

  /**
   * Validate the API key by making a simple request
   */
  async validateApiKey(apiKey) {
    const url = `${this.apiBase}/models?key=${apiKey}`;
    
    try {
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get the last analysis result
   */
  getLastAnalysis() {
    return this.lastAnalysis;
  }
}
