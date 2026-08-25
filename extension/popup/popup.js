/**
 * Civora AI — Extension Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  let selectedServiceId = 'aadhaar';

  // DOM Elements
  const servicesList = document.getElementById('servicesList');
  const btnStartAutoPilot = document.getElementById('btnStartAutoPilot');
  const btnSettingsToggle = document.getElementById('btnSettingsToggle');
  const mainView = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnBackToMain = document.getElementById('btnBackToMain');

  // Load saved API key
  const data = await chrome.storage.local.get(['civora_api_key']);
  if (data.civora_api_key) {
    apiKeyInput.value = data.civora_api_key;
  }

  // Service Selection
  servicesList.querySelectorAll('.service-option').forEach(opt => {
    opt.addEventListener('click', () => {
      servicesList.querySelectorAll('.service-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedServiceId = opt.dataset.id;
    });
  });

  // Start Auto-Pilot
  btnStartAutoPilot.addEventListener('click', async () => {
    btnStartAutoPilot.disabled = true;
    btnStartAutoPilot.innerText = 'Initializing Auto-Pilot...';

    const apiKey = apiKeyInput.value.trim();

    chrome.runtime.sendMessage({
      type: 'CIVORA_START_SESSION',
      serviceId: selectedServiceId,
      apiKey: apiKey
    }, (res) => {
      window.close(); // Close popup once HUD takes over in page
    });
  });

  // Toggle Settings View
  btnSettingsToggle.addEventListener('click', () => {
    mainView.style.display = 'none';
    settingsView.style.display = 'block';
  });

  btnBackToMain.addEventListener('click', () => {
    settingsView.style.display = 'none';
    mainView.style.display = 'block';
  });

  // Save Settings
  btnSaveSettings.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    await chrome.storage.local.set({ civora_api_key: key });
    settingsView.style.display = 'none';
    mainView.style.display = 'block';
  });
});
