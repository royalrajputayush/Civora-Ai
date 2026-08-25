/**
 * Civora AI — Auto-Pilot Background Service Worker
 * Orchestrates vision reasoning, workflow progression, and tab automation.
 */

let activeSession = null;
let workflows = null;

// Load Workflows
async function loadWorkflows() {
  if (workflows) return workflows;
  try {
    const url = chrome.runtime.getURL('data/workflows.json');
    const res = await fetch(url);
    workflows = await res.json();
    return workflows;
  } catch (err) {
    console.error('Failed to load workflows:', err);
    return {};
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'CIVORA_START_SESSION':
      startSession(message.serviceId, message.apiKey).then(sendResponse);
      return true;
    case 'CIVORA_STEP_READY':
      handleStepReady(sender.tab.id, message.context).then(sendResponse);
      return true;
    case 'CIVORA_AGENT_STOPPED':
      activeSession = null;
      sendResponse({ status: 'stopped' });
      break;
    case 'CIVORA_GET_STATUS':
      sendResponse({ active: !!activeSession, session: activeSession });
      break;
  }
});

/**
 * Start an Auto-Pilot session
 */
async function startSession(serviceId, apiKey) {
  const allWorkflows = await loadWorkflows();
  const service = allWorkflows[serviceId] || Object.values(allWorkflows)[0];

  activeSession = {
    serviceId,
    service,
    apiKey,
    step: 0,
    startTime: Date.now()
  };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return { success: false, error: 'No active tab found' };

  // If service has a specific URL and we are not on it, optionally navigate
  if (service?.service_url && !tab.url.includes(new URL(service.service_url).hostname)) {
    await chrome.tabs.update(tab.id, { url: service.service_url });
    return { success: true, navigated: true };
  }

  // Inject content script and start Auto-Pilot
  await chrome.tabs.sendMessage(tab.id, {
    type: 'CIVORA_START_AUTOPILOT',
    workflow: service,
    targetService: service
  });

  return { success: true };
}

/**
 * Handle Step Progression
 */
async function handleStepReady(tabId, context) {
  if (!activeSession) return;

  try {
    // 1. Capture current visible tab screenshot
    const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    
    // 2. Reason next action using Gemini Vision / Workflow rules
    const nextAction = await reasonNextAction(screenshot, context, activeSession);

    // 3. Send action to tab for execution
    chrome.tabs.sendMessage(tabId, {
      type: 'CIVORA_EXECUTE_ACTION',
      actionData: nextAction
    });

  } catch (err) {
    console.error('Error during step progression:', err);
  }
}

/**
 * Gemini Vision Reasoning Engine
 */
async function reasonNextAction(screenshotBase64, context, session) {
  const { apiKey, service, step } = session;

  // Fallback heuristic based on workflow if API key not provided
  if (!apiKey) {
    const subWorkflow = service?.subWorkflows?.[0];
    const definedStep = subWorkflow?.steps?.[step] || {
      target: 'Next / Continue',
      action: 'click',
      instruction: 'Proceed to next step'
    };

    session.step++;

    return {
      actionType: definedStep.action === 'pause' ? 'click' : definedStep.action,
      targetText: definedStep.target,
      instruction: definedStep.instruction,
      isSecurityBoundary: !!definedStep.securityBoundary
    };
  }

  // Call Gemini Vision API
  try {
    const prompt = `You are Civora AI Auto-Pilot browser agent.
The user wants to accomplish: ${service.name}.
Page Title: ${context.title}.
Current visible inputs: ${JSON.stringify(context.inputs)}.
Buttons: ${JSON.stringify(context.buttons)}.

Determine the single next action to take.
Return STRICT JSON format:
{
  "actionType": "click" | "type" | "select" | "scroll" | "pause",
  "targetText": "Text of the button/link/field to target",
  "targetSelector": "CSS selector if obvious",
  "value": "text to type if actionType is type",
  "instruction": "Short human friendly description",
  "isSecurityBoundary": boolean (true if OTP, password, CAPTCHA, or payment)
}`;

    const base64Data = screenshotBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/png', data: base64Data } }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.warn('Vision reasoning fallback to heuristic:', err);
    return {
      actionType: 'click',
      targetText: 'Submit',
      instruction: 'Proceeding to next action...'
    };
  }
}
