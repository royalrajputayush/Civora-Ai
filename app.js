/**
 * Civora AI — App Orchestrator
 * Wires together all modules and manages the application state machine.
 * Core loop: See → Understand → Guide → User Acts → Repeat
 */

import { PrivacyConsent } from './modules/privacy-consent.js';
import { ScreenshotUpload } from './modules/screenshot-upload.js';
import { ScreenCapture } from './modules/screen-capture.js';
import { ChangeDetector } from './modules/change-detector.js';
import { VisionEngine } from './modules/vision-engine.js';
import { ProcessKnowledge } from './modules/process-knowledge.js';
import { GuidanceDisplay } from './modules/guidance-display.js';

class CivoraApp {
  constructor() {
    // Modules
    this.privacy = new PrivacyConsent();
    this.screenshotUpload = new ScreenshotUpload();
    this.screenCapture = new ScreenCapture();
    this.changeDetector = new ChangeDetector();
    this.visionEngine = new VisionEngine();
    this.processKnowledge = new ProcessKnowledge();
    this.guidanceDisplay = new GuidanceDisplay();

    // State
    this.currentView = 'landing'; // landing | modes | services | live | screenshot
    this.isLiveActive = false;
    this.liveAnalysisLoop = null;
    this.pendingMode = null; // 'live' or 'screenshot' — set when user picks mode before service selection

    // Popup guidance window
    this.guidancePopup = null;
    this.popupReady = false;
    this.popupPingInterval = null;

    // Initialize
    this.init();
  }

  async init() {
    // Attempt to load from local config.js first
    let defaultKey = '';
    try {
      const { CONFIG } = await import('./config.js');
      if (CONFIG?.GEMINI_API_KEY) {
        defaultKey = CONFIG.GEMINI_API_KEY;
      }
    } catch (e) {
      // config.js not found or running in production
    }

    // Load saved API key or use system default from config
    let savedKey = localStorage.getItem('civora_api_key');
    if (!savedKey && defaultKey) {
      savedKey = defaultKey;
      localStorage.setItem('civora_api_key', savedKey);
    }
    if (savedKey) {
      this.visionEngine.setApiKey(savedKey);
    }

    // Load workflows
    await this.processKnowledge.loadBuiltinWorkflows();

    // Bind DOM events
    this.bindEvents();
    
    // Setup screenshot upload
    this.setupScreenshotUpload();
    
    // Initialize 3D Visual Effects
    this.init3DVisuals();
    
    // Show landing
    this.showView('landing');

    // Listen for toast events
    window.addEventListener('civora-toast', (e) => {
      this.showToast(e.detail.message, e.detail.type);
    });

    // Listen for popup ready signal
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'civora:popup-ready') {
        this.popupReady = true;
        // Send current state if we have one
        if (this.isLiveActive) {
          this.sendToPopup({ type: 'civora:ping' });
        }
      }
    });
  }

  // ========================
  //  Navigation & Views
  // ========================

  bindEvents() {
    // Landing
    document.getElementById('btnGetStarted').addEventListener('click', () => {
      this.showView('modes');
    });

    document.getElementById('btnLearnMore').addEventListener('click', () => {
      // Smooth scroll to features
      document.querySelector('.hero-features').scrollIntoView({ behavior: 'smooth' });
    });

    // Mode selection — go through service picker first
    document.getElementById('cardLiveMode').addEventListener('click', () => {
      this.selectMode('live');
    });

    document.getElementById('cardScreenshotMode').addEventListener('click', () => {
      this.selectMode('screenshot');
    });

    // Back button — context-aware
    document.getElementById('btnBackToModes').addEventListener('click', () => {
      if (this.currentView === 'services') {
        this.showView('modes');
      } else if (this.currentView === 'live') {
        this.stopLiveCapture();
        this.showView('services');
      } else if (this.currentView === 'screenshot') {
        this.showView('services');
      } else {
        this.showView('modes');
      }
    });

    // Settings
    document.getElementById('btnSettings').addEventListener('click', () => this.openSettings());
    document.getElementById('btnCloseSettings').addEventListener('click', () => this.closeSettings());
    document.getElementById('btnCancelSettings').addEventListener('click', () => this.closeSettings());
    document.getElementById('btnSaveSettings').addEventListener('click', () => this.saveSettings());

    // Close settings on overlay click
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeSettings();
    });

    // Consent modal
    document.getElementById('btnCloseConsent').addEventListener('click', () => this.closeConsent());
    document.getElementById('btnDenyConsent').addEventListener('click', () => this.closeConsent());
    document.getElementById('btnGrantConsent').addEventListener('click', () => this.grantConsent());
    document.getElementById('consentModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeConsent();
    });

    // Live mode controls
    document.getElementById('btnStartCapture').addEventListener('click', () => this.startLiveCapture());
    document.getElementById('btnStopCapture').addEventListener('click', () => this.stopLiveCapture());
    document.getElementById('btnAnalyzeNow').addEventListener('click', () => this.analyzeLiveFrame());

    // Screenshot mode controls
    document.getElementById('btnNewScreenshot').addEventListener('click', () => this.clearScreenshot());
    document.getElementById('btnReanalyze').addEventListener('click', () => this.analyzeScreenshot());
    document.getElementById('btnClearScreenshot').addEventListener('click', () => this.clearScreenshot());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSettings();
        this.closeConsent();
      }
    });
  }

  showView(view) {
    this.currentView = view;

    // Hide all sections
    document.getElementById('landingSection').style.display = 'none';
    document.getElementById('modeSelection').classList.remove('active');
    document.getElementById('serviceSelection').classList.remove('active');
    document.getElementById('liveModeWorkspace').classList.remove('active');
    document.getElementById('screenshotModeWorkspace').classList.remove('active');

    // Show/hide back button and privacy badge
    const backBtn = document.getElementById('btnBackToModes');
    const privacyBadge = document.getElementById('privacyBadge');

    switch (view) {
      case 'landing':
        document.getElementById('landingSection').style.display = '';
        backBtn.style.display = 'none';
        privacyBadge.style.display = 'none';
        break;
      case 'modes':
        document.getElementById('modeSelection').classList.add('active');
        backBtn.style.display = 'none';
        privacyBadge.style.display = 'none';
        break;
      case 'services':
        document.getElementById('serviceSelection').classList.add('active');
        backBtn.style.display = '';
        privacyBadge.style.display = 'none';
        break;
      case 'live':
        document.getElementById('liveModeWorkspace').classList.add('active');
        backBtn.style.display = '';
        privacyBadge.style.display = '';
        this.initLiveGuidance();
        break;
      case 'screenshot':
        document.getElementById('screenshotModeWorkspace').classList.add('active');
        backBtn.style.display = '';
        privacyBadge.style.display = '';
        this.initScreenshotGuidance();
        break;
    }
  }

  // ========================
  //  Settings
  // ========================

  openSettings() {
    const modal = document.getElementById('settingsModal');
    const input = document.getElementById('apiKeyInput');
    
    // Load current key
    const savedKey = localStorage.getItem('civora_api_key') || '';
    input.value = savedKey;
    
    modal.classList.add('active');
  }

  closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
  }

  async saveSettings() {
    const input = document.getElementById('apiKeyInput');
    const key = input.value.trim();

    if (!key) {
      this.showToast('Please enter a valid API key.', 'error');
      return;
    }

    // Validate key
    this.showToast('Validating API key...', 'info');
    
    const valid = await this.visionEngine.validateApiKey(key);
    if (!valid) {
      this.showToast('Invalid API key. Please check and try again.', 'error');
      return;
    }

    localStorage.setItem('civora_api_key', key);
    this.visionEngine.setApiKey(key);
    
    this.showToast('API key saved successfully!', 'success');
    this.closeSettings();
  }

  // ========================
  //  Consent
  // ========================

  openConsent() {
    const modalBody = document.getElementById('consentModalBody');
    this.privacy.renderConsentModal(modalBody);
    document.getElementById('consentModal').classList.add('active');
  }

  closeConsent() {
    document.getElementById('consentModal').classList.remove('active');
  }

  grantConsent() {
    this.privacy.grantScreenAccessConsent();
    this.closeConsent();
    this.startLiveCapture();
  }

  // ========================
  //  Service Selection (Smart Search)
  // ========================

  /**
   * Keyword map — maps natural-language terms to sub-workflow IDs
   */
  getServiceKeywords() {
    return {
      'update-address': [
        'address', 'change address', 'update address', 'new address', 'move',
        'shifted', 'relocation', 'relocate', 'house', 'flat', 'apartment',
        'pata', 'ghar', 'residence', 'residential', 'proof of address',
        'city change', 'pin code', 'pincode', 'state change', 'district'
      ],
      'update-mobile': [
        'mobile', 'phone', 'number', 'mobile number', 'phone number',
        'sim', 'change number', 'new number', 'update mobile', 'contact',
        'telephone', 'cell', 'registered mobile', 'link mobile'
      ],
      'update-dob': [
        'dob', 'date of birth', 'birth date', 'birthday', 'birth',
        'age', 'wrong dob', 'correct dob', 'change dob', 'born',
        'janam', 'janamdin', 'wrong date', 'date correction'
      ],
      'update-name': [
        'name', 'change name', 'correct name', 'spelling', 'naam',
        'wrong name', 'update name', 'first name', 'last name',
        'surname', 'middle name', 'full name', 'married name',
        'marriage', 'after marriage', 'rename', 'misspelled'
      ],
      'update-biometric': [
        'biometric', 'fingerprint', 'finger', 'iris', 'photo',
        'face', 'retina', 'scan', 'biometrics', 'update photo',
        'change photo', 'fingers', 'thumb', 'eye scan', 'photograph'
      ],
      'update-email': [
        'email', 'e-mail', 'mail', 'email address', 'email id',
        'change email', 'update email', 'new email', 'gmail'
      ],
      'download-aadhaar': [
        'download', 'e-aadhaar', 'eaadhaar', 'pdf', 'copy',
        'print', 'digital', 'soft copy', 'download aadhaar',
        'get aadhaar', 'aadhaar card download', 'e aadhaar'
      ],
      'check-status': [
        'status', 'track', 'check', 'urn', 'update status',
        'request number', 'pending', 'progress', 'tracking',
        'where is my', 'how long', 'check update', 'check status'
      ]
    };
  }

  /**
   * User picked a mode (live/screenshot). Show the smart search screen.
   */
  selectMode(mode) {
    if (!this.visionEngine.isConfigured()) {
      this.openSettings();
      this.showToast('Please set your Gemini API key first.', 'info');
      return;
    }

    this.pendingMode = mode;

    const workflows = this.processKnowledge.getWorkflows();
    const mainWorkflow = workflows[0];

    if (mainWorkflow && this.processKnowledge.hasSubWorkflows(mainWorkflow.id)) {
      this._currentWorkflowId = mainWorkflow.id;
      this.initSmartSearch(mainWorkflow.id);
      this.showView('services');
    } else {
      if (mainWorkflow) {
        this.processKnowledge.setActiveWorkflow(mainWorkflow.id);
      }
      this.enterSelectedMode();
    }
  }

  /**
   * Initialize the smart search UI and bind events
   */
  initSmartSearch(workflowId) {
    const input = document.getElementById('smartSearchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    const suggestionsEl = document.getElementById('searchSuggestions');
    const resultsEl = document.getElementById('searchResults');
    const bestMatchEl = document.getElementById('bestMatch');

    // Reset state
    input.value = '';
    clearBtn.style.display = 'none';
    suggestionsEl.style.display = '';
    resultsEl.innerHTML = '';
    bestMatchEl.style.display = 'none';

    // Remove old listeners by cloning
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    const newClearBtn = clearBtn.cloneNode(true);
    clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);

    // Debounced search
    let searchTimeout;
    newInput.addEventListener('input', () => {
      const query = newInput.value.trim();
      newClearBtn.style.display = query ? '' : 'none';

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.performSearch(query, workflowId);
      }, 200);
    });

    // Enter key to select best match
    newInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = newInput.value.trim();
        if (query) {
          this.selectBestMatch(query, workflowId);
        }
      }
    });

    // Clear button
    newClearBtn.addEventListener('click', () => {
      newInput.value = '';
      newClearBtn.style.display = 'none';
      document.getElementById('searchSuggestions').style.display = '';
      document.getElementById('searchResults').innerHTML = '';
      document.getElementById('bestMatch').style.display = 'none';
      newInput.focus();
    });

    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      const newChip = chip.cloneNode(true);
      chip.parentNode.replaceChild(newChip, chip);

      newChip.addEventListener('click', () => {
        const query = newChip.dataset.query;
        document.getElementById('smartSearchInput').value = query;
        document.getElementById('searchClearBtn').style.display = '';
        this.selectBestMatch(query, workflowId);
      });
    });

    // "Show all services" button
    const showAllBtn = document.getElementById('btnShowAllServices');
    const newShowAll = showAllBtn.cloneNode(true);
    showAllBtn.parentNode.replaceChild(newShowAll, showAllBtn);
    newShowAll.addEventListener('click', () => {
      this.showAllServices(workflowId);
    });

    // "Start best match" button
    const startBtn = document.getElementById('btnStartBestMatch');
    const newStartBtn = startBtn.cloneNode(true);
    startBtn.parentNode.replaceChild(newStartBtn, startBtn);
    newStartBtn.addEventListener('click', () => {
      const subId = newStartBtn.dataset.subId;
      if (subId) {
        this.onServiceSelected(workflowId, subId);
      }
    });

    // Auto-focus
    setTimeout(() => newInput.focus(), 300);
  }

  /**
   * Score a query against sub-workflows using keyword matching
   */
  scoreSubWorkflows(query, workflowId) {
    const keywords = this.getServiceKeywords();
    const subWorkflows = this.processKnowledge.getSubWorkflows(workflowId);
    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/);

    return subWorkflows.map(sw => {
      let score = 0;
      const swKeywords = keywords[sw.id] || [];

      // Check each keyword
      for (const kw of swKeywords) {
        // Exact phrase match (highest weight)
        if (queryLower.includes(kw)) {
          score += 10;
        }
        // Keyword contains query word
        for (const word of queryWords) {
          if (word.length >= 2 && kw.includes(word)) {
            score += 3;
          }
        }
      }

      // Name match
      if (sw.name.toLowerCase().includes(queryLower)) {
        score += 8;
      }
      for (const word of queryWords) {
        if (word.length >= 2 && sw.name.toLowerCase().includes(word)) {
          score += 2;
        }
      }

      // Description match
      if (sw.description) {
        for (const word of queryWords) {
          if (word.length >= 2 && sw.description.toLowerCase().includes(word)) {
            score += 1;
          }
        }
      }

      return { ...sw, score };
    }).filter(sw => sw.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Perform a search and show results
   */
  performSearch(query, workflowId) {
    const suggestionsEl = document.getElementById('searchSuggestions');
    const resultsEl = document.getElementById('searchResults');
    const bestMatchEl = document.getElementById('bestMatch');

    if (!query) {
      suggestionsEl.style.display = '';
      resultsEl.innerHTML = '';
      bestMatchEl.style.display = 'none';
      return;
    }

    suggestionsEl.style.display = 'none';
    const scored = this.scoreSubWorkflows(query, workflowId);

    if (scored.length === 0) {
      resultsEl.innerHTML = `
        <div class="search-no-results">
          <div class="no-results-icon">🤔</div>
          <p>No matching service found. Try different words or click a suggestion above.</p>
        </div>
      `;
      bestMatchEl.style.display = 'none';
      return;
    }

    // If top result is strong match, show best-match card
    if (scored[0].score >= 6) {
      this.showBestMatch(scored[0], workflowId);
      // Show remaining as smaller results
      const rest = scored.slice(1, 4);
      if (rest.length > 0) {
        resultsEl.innerHTML = rest.map(sw => this.renderResultCard(sw, workflowId)).join('');
        this.bindResultCards(resultsEl, workflowId);
      } else {
        resultsEl.innerHTML = '';
      }
    } else {
      // Show all as result cards
      bestMatchEl.style.display = 'none';
      resultsEl.innerHTML = scored.slice(0, 5).map(sw => this.renderResultCard(sw, workflowId)).join('');
      this.bindResultCards(resultsEl, workflowId);
    }
  }

  /**
   * Render a search result card
   */
  renderResultCard(sw, workflowId) {
    return `
      <div class="search-result-card" data-workflow-id="${workflowId}" data-sub-id="${sw.id}">
        <div class="search-result-icon">${sw.icon}</div>
        <div class="search-result-info">
          <div class="search-result-name">${sw.name}</div>
          <div class="search-result-desc">${sw.description}</div>
        </div>
        ${sw.estimatedTime ? `<span class="search-result-badge">⏱ ${sw.estimatedTime}</span>` : ''}
        <span class="search-result-arrow">→</span>
      </div>
    `;
  }

  /**
   * Bind click events to result cards
   */
  bindResultCards(container, workflowId) {
    container.querySelectorAll('.search-result-card').forEach(card => {
      card.addEventListener('click', () => {
        this.onServiceSelected(card.dataset.workflowId, card.dataset.subId);
      });
    });
  }

  /**
   * Show the best match card
   */
  showBestMatch(sw, workflowId) {
    const bestMatchEl = document.getElementById('bestMatch');
    const cardEl = document.getElementById('bestMatchCard');
    const startBtn = document.getElementById('btnStartBestMatch');

    cardEl.innerHTML = `
      <div class="best-match-card-header">
        <span class="best-match-card-icon">${sw.icon}</span>
        <span class="best-match-card-title">${sw.name}</span>
      </div>
      <p class="best-match-card-desc">${sw.description}</p>
      <div class="best-match-card-meta">
        ${sw.estimatedTime ? `<span class="search-result-badge">⏱ ${sw.estimatedTime}</span>` : ''}
        ${sw.requiredDocuments && sw.requiredDocuments.length > 0
          ? `<span class="search-result-badge">📄 ${sw.requiredDocuments[0]}</span>`
          : ''}
      </div>
    `;

    startBtn.dataset.subId = sw.id;
    bestMatchEl.style.display = '';
  }

  /**
   * Select the best matching sub-workflow immediately (on Enter key)
   */
  selectBestMatch(query, workflowId) {
    const scored = this.scoreSubWorkflows(query, workflowId);
    if (scored.length > 0 && scored[0].score >= 3) {
      this.onServiceSelected(workflowId, scored[0].id);
    } else {
      // Show all if no good match
      this.performSearch(query, workflowId);
      this.showToast('No strong match found. Please pick from the results.', 'info');
    }
  }

  /**
   * Show all services as a flat list
   */
  showAllServices(workflowId) {
    const subWorkflows = this.processKnowledge.getSubWorkflows(workflowId);
    const resultsEl = document.getElementById('searchResults');
    const bestMatchEl = document.getElementById('bestMatch');
    const suggestionsEl = document.getElementById('searchSuggestions');

    bestMatchEl.style.display = 'none';
    suggestionsEl.style.display = 'none';
    document.getElementById('smartSearchInput').value = '';
    document.getElementById('searchClearBtn').style.display = 'none';

    resultsEl.innerHTML = subWorkflows.map(sw => this.renderResultCard(sw, workflowId)).join('');
    this.bindResultCards(resultsEl, workflowId);
  }

  /**
   * User selected a specific sub-service
   */
  onServiceSelected(workflowId, subWorkflowId) {
    this.processKnowledge.setActiveWorkflow(workflowId, subWorkflowId);

    const sub = this.processKnowledge.getActiveSubWorkflow();
    this.showToast(`Selected: ${sub?.name || 'Service'}. Let's begin!`, 'success');

    this.enterSelectedMode();
  }

  /**
   * Enter the mode (live or screenshot) that was pending
   */
  enterSelectedMode() {
    const mode = this.pendingMode || 'screenshot';
    this.pendingMode = null;

    if (mode === 'live') {
      this.startLiveMode();
    } else {
      this.showView('screenshot');
    }
  }

  // ========================
  //  Live Mode
  // ========================

  startLiveMode() {
    if (!this.visionEngine.isConfigured()) {
      this.openSettings();
      this.showToast('Please set your Gemini API key first.', 'info');
      return;
    }

    if (!this.screenCapture.isSupported()) {
      this.showToast('Screen capture is not supported in this browser. Try Screenshot mode instead.', 'error');
      return;
    }

    this.showView('live');
  }

  initLiveGuidance() {
    // For live mode, we use the floating guidance card directly (no old guidance-display init needed)
    // Bind minimize/expand
    document.getElementById('btnMinimizeGuidance').addEventListener('click', () => this.minimizeFloatingCard());
    document.getElementById('btnExpandGuidance').addEventListener('click', () => this.expandFloatingCard());
  }

  // ========================
  //  Popup Guidance Window
  // ========================

  /**
   * Open the guidance card in a separate popup window so it stays
   * visible across all browser tabs and other applications.
   */
  openGuidancePopup() {
    // If already open and not closed, focus it
    if (this.guidancePopup && !this.guidancePopup.closed) {
      this.guidancePopup.focus();
      return;
    }

    // Calculate position: bottom-right of screen
    const popupWidth = 380;
    const popupHeight = 420;
    const left = window.screen.availWidth - popupWidth - 20;
    const top = window.screen.availHeight - popupHeight - 60;

    const features = [
      `width=${popupWidth}`,
      `height=${popupHeight}`,
      `left=${left}`,
      `top=${top}`,
      'menubar=no',
      'toolbar=no',
      'location=no',
      'status=no',
      'resizable=yes',
      'scrollbars=no'
    ].join(',');

    this.popupReady = false;
    this.guidancePopup = window.open('guidance-popup.html', 'CivoraGuidance', features);

    if (!this.guidancePopup) {
      // Popup was blocked — fall back to in-page card
      this.showToast('Popup was blocked! Please allow popups for Civora, then try again. Using in-page card as fallback.', 'warning');
      return;
    }

    // Hide the in-page floating card when popup is active
    const floatingCard = document.getElementById('floatingGuidance');
    if (floatingCard) floatingCard.classList.remove('visible');

    // Start heartbeat pings
    this.startPopupPing();

    // Detect if popup is closed by the user
    const popupCloseCheck = setInterval(() => {
      if (!this.guidancePopup || this.guidancePopup.closed) {
        clearInterval(popupCloseCheck);
        this.onPopupClosed();
      }
    }, 1000);
  }

  /**
   * Send a message to the popup window
   */
  sendToPopup(message) {
    if (this.guidancePopup && !this.guidancePopup.closed) {
      try {
        this.guidancePopup.postMessage(message, '*');
      } catch (e) {
        // Popup may have been closed
      }
    }
  }

  /**
   * Start periodic pings to keep the popup's status indicator green
   */
  startPopupPing() {
    this.stopPopupPing();
    this.popupPingInterval = setInterval(() => {
      this.sendToPopup({ type: 'civora:ping' });
    }, 5000);
  }

  stopPopupPing() {
    if (this.popupPingInterval) {
      clearInterval(this.popupPingInterval);
      this.popupPingInterval = null;
    }
  }

  /**
   * Handle popup being closed by the user — restore in-page card
   */
  onPopupClosed() {
    this.guidancePopup = null;
    this.popupReady = false;
    this.stopPopupPing();

    // If still in live mode, show the in-page floating card again
    if (this.isLiveActive) {
      const floatingCard = document.getElementById('floatingGuidance');
      if (floatingCard) floatingCard.classList.add('visible');
      this.showToast('Popup closed. Showing guidance in-page.', 'info');
    }
  }

  /**
   * Close the popup if it's open
   */
  closeGuidancePopup() {
    this.stopPopupPing();
    if (this.guidancePopup && !this.guidancePopup.closed) {
      this.sendToPopup({ type: 'civora:disconnected' });
      this.guidancePopup.close();
    }
    this.guidancePopup = null;
    this.popupReady = false;
  }

  /**
   * Check if the popup is active and receiving messages
   */
  isPopupActive() {
    return this.guidancePopup && !this.guidancePopup.closed;
  }

  minimizeFloatingCard() {
    document.getElementById('floatingGuidanceBody').style.display = 'none';
    document.getElementById('floatingGuidanceHeader').style.display = 'none';
    document.getElementById('floatingMinimized').style.display = '';
  }

  expandFloatingCard() {
    document.getElementById('floatingGuidanceBody').style.display = '';
    document.getElementById('floatingGuidanceHeader').style.display = '';
    document.getElementById('floatingMinimized').style.display = 'none';
  }

  async startLiveCapture() {
    // Check consent
    if (!this.privacy.hasScreenAccessConsent()) {
      this.openConsent();
      return;
    }

    try {
      const canvas = document.getElementById('liveCanvas');
      const placeholder = document.getElementById('livePlaceholder');
      const topbar = document.getElementById('liveTopbar');
      const floatingCard = document.getElementById('floatingGuidance');

      await this.screenCapture.startCapture();
      
      this.isLiveActive = true;

      // Switch to full-screen capture view
      placeholder.style.display = 'none';
      canvas.style.display = 'block';

      // Show top bar controls
      topbar.classList.add('visible');

      // Open guidance in a separate popup window (so it's visible across tabs)
      this.openGuidancePopup();

      // Only show in-page floating card if popup failed to open
      if (!this.isPopupActive()) {
        floatingCard.classList.add('visible');
      }

      // Hide the app header during live mode
      document.getElementById('appHeader').style.display = 'none';
      document.getElementById('btnBackToModes').style.display = 'none';

      // Render stream to canvas
      this.screenCapture.renderToCanvas(canvas);

      // Set up frame analysis with change detection
      this.screenCapture.onFrameCaptured = async (base64) => {
        if (!this.isLiveActive) return;
        
        const { changed } = await this.changeDetector.detectChange(base64);
        if (changed) {
          await this.analyzeLiveFrame();
        }
      };

      // Handle stream end
      this.screenCapture.onStreamEnded = () => {
        this.stopLiveCapture();
        this.showToast('Screen sharing was stopped.', 'info');
      };

      this.showToast('Screen sharing started! Analyzing...', 'success');
      
      // Analyze first frame
      setTimeout(() => this.analyzeLiveFrame(), 1000);

    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  stopLiveCapture() {
    this.isLiveActive = false;
    this.screenCapture.stopCapture();
    this.changeDetector.reset();

    const canvas = document.getElementById('liveCanvas');
    const placeholder = document.getElementById('livePlaceholder');
    const topbar = document.getElementById('liveTopbar');
    const floatingCard = document.getElementById('floatingGuidance');

    // Reset UI
    if (canvas) canvas.style.display = 'none';
    if (placeholder) placeholder.style.display = '';
    topbar.classList.remove('visible');
    floatingCard.classList.remove('visible');

    // Close the popup guidance window
    this.closeGuidancePopup();

    // Restore app header
    document.getElementById('appHeader').style.display = '';

    // Go back to service selection
    this.showView('services');
  }

  async analyzeLiveFrame() {
    if (this.visionEngine.isProcessing) return;

    try {
      // Show processing state
      document.getElementById('liveAnalyzing').classList.add('active');

      // Notify popup that we're analyzing
      if (this.isPopupActive()) {
        this.sendToPopup({ type: 'civora:analyzing' });
      }

      const base64 = this.screenCapture.getBase64Data();
      if (!base64) return;

      const workflowContext = this.processKnowledge.getWorkflowContext();
      const analysis = await this.visionEngine.analyzeScreen(base64, 'image/jpeg', workflowContext);

      if (!analysis) return;

      // Match to workflow step
      this.processKnowledge.matchStep(analysis);

      // Get progress
      const progress = this.processKnowledge.getProgress();

      // Update guidance — send to popup if active, otherwise update in-page card
      if (this.isPopupActive()) {
        this.sendToPopup({
          type: 'civora:guidance',
          payload: { analysis, progress }
        });
      }
      // Always update in-page card too (fallback + keeps state in sync)
      this.updateFloatingCard(analysis, progress);

      // Show pointer
      if (analysis.nextAction?.targetLocation) {
        const pointer = document.getElementById('livePointer');
        const loc = analysis.nextAction.targetLocation;
        pointer.style.left = `${loc.approximateX || 50}%`;
        pointer.style.top = `${loc.approximateY || 50}%`;
        pointer.style.transform = 'translate(-50%, -50%)';
        pointer.classList.add('visible');
      }

      // Hide analyzing overlay
      document.getElementById('liveAnalyzing').classList.remove('active');

    } catch (err) {
      document.getElementById('liveAnalyzing').classList.remove('active');
      this.updateFloatingCardError(err.message);

      // Send error to popup
      if (this.isPopupActive()) {
        this.sendToPopup({
          type: 'civora:error',
          payload: { message: err.message }
        });
      }

      console.error('Live analysis error:', err);
    }
  }

  /**
   * Update the floating guidance card with analysis results
   */
  updateFloatingCard(analysis, progress) {
    const action = analysis.nextAction;
    const icons = {
      'tap': '👆', 'type': '⌨️', 'select': '☑️',
      'scroll': '📜', 'upload': '📎', 'wait': '⏳'
    };

    // Step badge
    document.getElementById('floatingStepBadge').textContent = 
      `Step ${analysis.stepNumber || '?'} of ${analysis.totalStepsEstimate || '?'}`;

    // Action icon
    document.getElementById('floatingActionIcon').textContent = 
      icons[action?.actionType] || '👆';

    // Main instruction
    document.getElementById('floatingInstructionText').textContent = 
      action?.instruction || 'Analyzing...';

    // Target element
    const targetEl = document.getElementById('floatingInstructionTarget');
    if (action?.targetElement) {
      targetEl.textContent = `Target: ${action.targetElement}`;
      if (action.targetLocation?.description) {
        targetEl.textContent += ` · ${action.targetLocation.description}`;
      }
    } else {
      targetEl.textContent = '';
    }

    // Tip
    const tipEl = document.getElementById('floatingTip');
    const tipText = document.getElementById('floatingTipText');
    if (analysis.tip) {
      tipEl.style.display = '';
      tipText.textContent = analysis.tip;
    } else {
      tipEl.style.display = 'none';
    }

    // Security
    const secEl = document.getElementById('floatingSecurity');
    const secText = document.getElementById('floatingSecurityText');
    if (analysis.isSecurityBoundary) {
      secEl.style.display = '';
      secText.textContent = analysis.securityNote || 'This step requires your manual input for security.';
    } else {
      secEl.style.display = 'none';
    }

    // Progress
    document.getElementById('floatingProgressFill').style.width = `${progress.percentage}%`;
    document.getElementById('floatingProgressLabel').textContent = 
      `${progress.current}/${progress.total}`;

    // Minimized text
    document.getElementById('floatingMiniIcon').textContent = icons[action?.actionType] || '👆';
    document.getElementById('floatingMiniText').textContent = 
      action?.instruction || 'Analyzing...';
  }

  /**
   * Show an error state on the floating card
   */
  updateFloatingCardError(message) {
    document.getElementById('floatingActionIcon').textContent = '⚠️';
    document.getElementById('floatingInstructionText').textContent = message;
    document.getElementById('floatingInstructionTarget').textContent = '';
    document.getElementById('floatingTip').style.display = 'none';
    document.getElementById('floatingSecurity').style.display = 'none';
  }

  // ========================
  //  Screenshot Mode
  // ========================

  setupScreenshotUpload() {
    const dropZone = document.getElementById('ssUploadZone');
    const fileInput = document.getElementById('fileInput');
    
    if (dropZone && fileInput) {
      this.screenshotUpload.init(dropZone, fileInput);
      
      this.screenshotUpload.onImageReady = (imageData) => {
        this.onScreenshotUploaded(imageData);
      };
    }
  }

  initScreenshotGuidance() {
    this.guidanceDisplay.init(
      document.getElementById('ssGuidanceCard'),
      document.getElementById('ssProgressCard'),
      document.getElementById('ssPointer')
    );
  }

  onScreenshotUploaded(imageData) {
    // Show the uploaded image
    const img = document.getElementById('ssScreenImage');
    const uploadZone = document.getElementById('ssUploadZone');
    
    img.src = imageData.base64;
    img.classList.add('visible');
    uploadZone.style.display = 'none';
    
    // Show action buttons
    document.getElementById('ssActions').style.display = '';
    document.getElementById('btnNewScreenshot').style.display = '';
    document.getElementById('ssStatusDot').classList.add('active');
    document.getElementById('ssPanelTitle').textContent = `Screenshot — ${imageData.name}`;

    this.showToast('Screenshot uploaded! Analyzing...', 'success');

    // Auto-analyze
    this.analyzeScreenshot();
  }

  async analyzeScreenshot() {
    if (!this.visionEngine.isConfigured()) {
      this.openSettings();
      this.showToast('Please set your Gemini API key first.', 'info');
      return;
    }

    const base64 = this.screenshotUpload.getBase64Data();
    const mimeType = this.screenshotUpload.getMimeType();

    if (!base64) {
      this.showToast('No screenshot to analyze.', 'error');
      return;
    }

    try {
      // Show processing state
      document.getElementById('ssStatusDot').classList.add('processing');
      document.getElementById('ssAnalyzing').classList.add('active');
      this.guidanceDisplay.showAnalyzing();

      const workflowContext = this.processKnowledge.getWorkflowContext();
      const analysis = await this.visionEngine.analyzeScreen(base64, mimeType, workflowContext);

      if (!analysis) return;

      // Match to workflow step
      this.processKnowledge.matchStep(analysis);

      // Get progress with step status
      const progress = this.processKnowledge.getProgress();
      progress.steps = this.processKnowledge.getStepsWithStatus();

      // Display guidance
      this.guidanceDisplay.showGuidance(analysis, progress);

      // Hide analyzing overlay
      document.getElementById('ssAnalyzing').classList.remove('active');
      document.getElementById('ssStatusDot').classList.remove('processing');

    } catch (err) {
      document.getElementById('ssAnalyzing').classList.remove('active');
      document.getElementById('ssStatusDot').classList.remove('processing');
      this.guidanceDisplay.showError(err.message);
      this.showToast(err.message, 'error');
      console.error('Screenshot analysis error:', err);
    }
  }

  clearScreenshot() {
    this.screenshotUpload.clear();
    
    const img = document.getElementById('ssScreenImage');
    const uploadZone = document.getElementById('ssUploadZone');
    
    img.src = '';
    img.classList.remove('visible');
    uploadZone.style.display = '';
    
    document.getElementById('ssActions').style.display = 'none';
    document.getElementById('btnNewScreenshot').style.display = 'none';
    document.getElementById('ssStatusDot').classList.remove('active');
    document.getElementById('ssStatusDot').classList.remove('processing');
    document.getElementById('ssPanelTitle').textContent = 'Screenshot Upload';

    this.guidanceDisplay.hidePointer();
    this.guidanceDisplay.showEmpty('Upload a screenshot to receive step-by-step guidance.');
  }

  // ============================================
  //  3D Visual Effects & Interactive 3D System
  // ============================================

  init3DVisuals() {
    this.initParticleStarfield();
    this.initCursorGlow();
    this.init3DCardTilt();
    this.initMagneticButtons();
  }

  /**
   * 3D Particle Starfield with Depth (Z-axis) & Constellation Mesh
   */
  initParticleStarfield() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const numParticles = Math.min(100, Math.floor((width * height) / 14000));
    const particles = [];

    const mouse = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
    };

    window.addEventListener('mousemove', (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    });

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: (Math.random() - 0.5) * width * 1.5,
        y: (Math.random() - 0.5) * height * 1.5,
        z: Math.random() * 1000 + 1,
        baseRadius: Math.random() * 2 + 1,
        color: i % 3 === 0 ? 'rgba(0, 240, 255,' : i % 3 === 1 ? 'rgba(121, 82, 252,' : 'rgba(255, 46, 147,',
        speedZ: Math.random() * 0.8 + 0.3,
      });
    }

    const render = () => {
      // Lerp mouse for subtle parallax
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      const offsetX = (mouse.x - width / 2) * 0.15;
      const offsetY = (mouse.y - height / 2) * 0.15;

      ctx.clearRect(0, 0, width, height);

      const fov = 400;
      const cx = width / 2;
      const cy = height / 2;

      // Project & update particles
      const projected = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move along Z
        p.z -= p.speedZ;
        if (p.z <= 0) {
          p.z = 1000;
          p.x = (Math.random() - 0.5) * width * 1.5;
          p.y = (Math.random() - 0.5) * height * 1.5;
        }

        // 3D to 2D projection
        const scale = fov / (fov + p.z);
        const projX = (p.x - offsetX) * scale + cx;
        const projY = (p.y - offsetY) * scale + cy;
        const radius = Math.max(0.5, p.baseRadius * scale * 1.8);
        const alpha = Math.min(1, Math.max(0.1, (1 - p.z / 1000) * 1.2));

        projected.push({ x: projX, y: projY, alpha, radius, color: p.color });

        // Draw particle
        ctx.beginPath();
        ctx.arc(projX, projY, radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${alpha})`;
        ctx.shadowBlur = radius > 2 ? 10 : 0;
        ctx.shadowColor = p.color.includes('240') ? '#00f0ff' : '#7952fc';
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draw constellation connections between close nodes
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const p1 = projected[i];
          const p2 = projected[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 90) {
            const lineAlpha = (1 - dist / 90) * 0.15 * Math.min(p1.alpha, p2.alpha);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(121, 82, 252, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(render);
    };

    render();
  }

  /**
   * Smooth Cursor Glow Follower
   */
  initCursorGlow() {
    const cursorGlow = document.getElementById('cursorGlow');
    if (!cursorGlow) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    window.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      cursorGlow.style.opacity = '1';
    });

    document.addEventListener('mouseleave', () => {
      cursorGlow.style.opacity = '0';
    });

    const updateCursor = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      cursorGlow.style.left = `${currentX}px`;
      cursorGlow.style.top = `${currentY}px`;

      requestAnimationFrame(updateCursor);
    };

    updateCursor();
  }

  /**
   * 3D Interactive Card Tilt with Specular Shimmer
   */
  init3DCardTilt() {
    const addTiltToElement = (el) => {
      if (el._tiltInitialized) return;
      el._tiltInitialized = true;

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -10;
        const rotateY = ((x - centerX) / centerX) * 10;

        el.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(8px)`;
        el.style.setProperty('--mouse-x', `${x}px`);
        el.style.setProperty('--mouse-y', `${y}px`);
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
        el.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
        setTimeout(() => {
          el.style.transition = '';
        }, 400);
      });
    };

    // Attach to initial cards
    document.querySelectorAll('.card, .card-glass, .mode-card, .feature-card').forEach(addTiltToElement);

    // Observer for dynamically added cards
    const observer = new MutationObserver(() => {
      document.querySelectorAll('.card, .card-glass, .mode-card, .feature-card, .search-result-card').forEach(addTiltToElement);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * 3D Tactile Buttons
   */
  initMagneticButtons() {
    document.querySelectorAll('.btn-primary, .btn-accent').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate3d(${x * 0.15}px, ${y * 0.15}px, 0) scale(1.02)`;
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  // ========================
  //  Toast Notifications
  // ========================

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-content">${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// ========================
//  Initialize App
// ========================
document.addEventListener('DOMContentLoaded', () => {
  window.civora = new CivoraApp();
});
