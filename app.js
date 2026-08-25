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
import { MockupRenderer } from './modules/mockup-renderer.js';

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
    this.mockupRenderer = new MockupRenderer();

    // State
    this.currentView = 'landing'; // landing | modes | services | live | screenshot | visual
    this.isLiveActive = false;
    this.liveAnalysisLoop = null;
    this.pendingMode = 'visual'; // 'visual' | 'live' | 'screenshot'
    this.visualStepIndex = 0;

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
    
    // Show landing
    this.showView('landing');

    // Listen for toast events
    window.addEventListener('civora-toast', (e) => {
      this.showToast(e.detail.message, e.detail.type);
    });

    // Listen for popup ready and navigation signals
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'civora:popup-ready') {
        this.popupReady = true;
        if (this.currentView === 'visual') {
          this.renderVisualStep(this.visualStepIndex);
        } else if (this.isLiveActive) {
          this.sendToPopup({ type: 'civora:ping' });
        }
      } else if (e.data?.type === 'civora:request-next-step') {
        this.nextVisualStep();
      } else if (e.data?.type === 'civora:request-prev-step') {
        this.prevVisualStep();
      }
    });
  }

  // ========================
  //  Navigation & Views
  // ========================

  selectMode(mode) {
    this.pendingMode = mode;
    
    // Default to address update workflow if none selected
    if (!this.processKnowledge.getActiveSubWorkflow()) {
      this.processKnowledge.setActiveSubWorkflow('update-address');
    }

    this.enterSelectedMode();
  }

  bindEvents() {
    // Logo returns to home/landing
    document.getElementById('logoHome')?.addEventListener('click', () => {
      this.showView('landing');
    });

    // Mode launch cards
    document.getElementById('cardVisualMode')?.addEventListener('click', () => {
      this.selectMode('visual');
    });

    document.getElementById('cardScreenshotMode')?.addEventListener('click', () => {
      this.selectMode('screenshot');
    });

    document.getElementById('cardVisualModeAlt')?.addEventListener('click', () => {
      this.selectMode('visual');
    });

    document.getElementById('cardScreenshotModeAlt')?.addEventListener('click', () => {
      this.selectMode('screenshot');
    });

    // Quick workflow chips
    document.querySelectorAll('.service-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const wf = chip.getAttribute('data-workflow');
        if (wf) {
          this.processKnowledge.setActiveSubWorkflow(wf);
          this.startVisualGuideMode();
          this.showToast(`Starting ${chip.textContent.trim()} guide`, 'info');
        }
      });
    });

    // Visual mode controls
    document.getElementById('btnVisualNextStep')?.addEventListener('click', () => this.nextVisualStep());
    document.getElementById('btnVisualPrevStep')?.addEventListener('click', () => this.prevVisualStep());
    document.getElementById('btnPopoutVisualGuide')?.addEventListener('click', () => this.openGuidancePopup());

    // Back button — return to home
    document.getElementById('btnBackToModes')?.addEventListener('click', () => {
      if (this.currentView === 'live') {
        this.stopLiveCapture();
      }
      this.showView('landing');
    });

    // Settings
    document.getElementById('btnSettings')?.addEventListener('click', () => this.openSettings());
    document.getElementById('btnCloseSettings')?.addEventListener('click', () => this.closeSettings());
    document.getElementById('btnCancelSettings')?.addEventListener('click', () => this.closeSettings());
    document.getElementById('btnSaveSettings')?.addEventListener('click', () => this.saveSettings());

    // Close settings on overlay click
    document.getElementById('settingsModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeSettings();
    });

    // Consent modal
    document.getElementById('btnCloseConsent')?.addEventListener('click', () => this.closeConsent());
    document.getElementById('btnDenyConsent')?.addEventListener('click', () => this.closeConsent());
    document.getElementById('btnGrantConsent')?.addEventListener('click', () => this.grantConsent());
    document.getElementById('consentModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeConsent();
    });

    // Live mode controls
    document.getElementById('btnStartCapture')?.addEventListener('click', () => this.startLiveCapture());
    document.getElementById('btnStopCapture')?.addEventListener('click', () => this.stopLiveCapture());
    document.getElementById('btnAnalyzeNow')?.addEventListener('click', () => this.analyzeLiveFrame());

    // Screenshot mode controls
    document.getElementById('btnNewScreenshot')?.addEventListener('click', () => this.clearScreenshot());
    document.getElementById('btnReanalyze')?.addEventListener('click', () => this.analyzeScreenshot());
    document.getElementById('btnClearScreenshot')?.addEventListener('click', () => this.clearScreenshot());

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

    // Safely hide all sections
    const landing = document.getElementById('landingSection');
    const modes = document.getElementById('modeSelection');
    const visual = document.getElementById('visualModeWorkspace');
    const live = document.getElementById('liveModeWorkspace');
    const screenshot = document.getElementById('screenshotModeWorkspace');

    if (landing) landing.style.display = 'none';
    if (modes) modes.classList.remove('active');
    if (visual) visual.classList.remove('active');
    if (live) live.classList.remove('active');
    if (screenshot) screenshot.classList.remove('active');

    // Show/hide back button and privacy badge
    const backBtn = document.getElementById('btnBackToModes');
    const privacyBadge = document.getElementById('privacyBadge');

    switch (view) {
      case 'landing':
        if (landing) landing.style.display = '';
        if (backBtn) backBtn.style.display = 'none';
        if (privacyBadge) privacyBadge.style.display = 'none';
        break;
      case 'modes':
        if (modes) modes.classList.add('active');
        if (backBtn) backBtn.style.display = 'none';
        if (privacyBadge) privacyBadge.style.display = 'none';
        break;
      case 'visual':
        if (visual) visual.classList.add('active');
        if (backBtn) backBtn.style.display = '';
        if (privacyBadge) privacyBadge.style.display = '';
        break;
      case 'live':
        if (live) live.classList.add('active');
        if (backBtn) backBtn.style.display = '';
        if (privacyBadge) privacyBadge.style.display = '';
        this.initLiveGuidance();
        break;
      case 'screenshot':
        if (screenshot) screenshot.classList.add('active');
        if (backBtn) backBtn.style.display = '';
        if (privacyBadge) privacyBadge.style.display = '';
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
   * User picked a mode (visual, live, or screenshot). Directly start guidance.
   */
  selectMode(mode) {
    this.pendingMode = mode;

    // Activate the main workflow (Aadhaar Services)
    const workflows = this.processKnowledge.getWorkflows();
    const mainWorkflow = workflows[0];
    if (mainWorkflow) {
      this.processKnowledge.setActiveWorkflow(mainWorkflow.id, 'update-address');
    }

    if (mode === 'visual') {
      this.startVisualGuideMode();
    } else if (mode === 'live') {
      this.startLiveMode();
    } else {
      this.showView('screenshot');
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
   * Enter the mode (visual, live or screenshot) that was pending
   */
  enterSelectedMode() {
    const mode = this.pendingMode || 'visual';
    this.pendingMode = null;

    if (mode === 'visual') {
      this.startVisualGuideMode();
    } else if (mode === 'live') {
      this.startLiveMode();
    } else {
      this.showView('screenshot');
    }
  }

  // ============================================
  //  Visual Step-by-Step Guide Mode (100% Private)
  // ============================================

  startVisualGuideMode() {
    this.visualStepIndex = 0;
    this.showView('visual');
    this.renderVisualStep(0);
  }

  renderVisualStep(index) {
    const subWorkflow = this.processKnowledge.getActiveSubWorkflow();
    const steps = subWorkflow?.steps || this.processKnowledge.getSteps() || [];

    if (steps.length === 0) {
      this.showToast('No steps available for this service.', 'info');
      return;
    }

    // Clamp index
    this.visualStepIndex = Math.max(0, Math.min(index, steps.length - 1));
    const step = steps[this.visualStepIndex];
    const total = steps.length;
    const currentNum = this.visualStepIndex + 1;

    // Render mockup diagram using MockupRenderer
    const mockupContainer = document.getElementById('visualMockupContainer');
    if (mockupContainer) {
      mockupContainer.innerHTML = this.mockupRenderer.renderMockupHTML(step, subWorkflow?.id || 'update-address');

      // Bind interactive click handlers to targets inside the visual mockup
      mockupContainer.querySelectorAll('.clickable-target, .target-hotspot, [data-action="next-step"], .portal-card').forEach((el) => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          el.classList.add('hotspot-clicked');
          this.showToast(`Simulated: Clicked "${step.targetElement || step.name}"`, 'success');
          setTimeout(() => {
            this.nextVisualStep();
          }, 350);
        });
      });
    }

    // Update Step Controls Panel
    document.getElementById('visualPanelTitle').textContent = `${subWorkflow?.name || 'Aadhaar Service'} — Step ${currentNum} of ${total}`;
    document.getElementById('visualStepBadge').textContent = `Step ${currentNum} of ${total}`;
    document.getElementById('visualTimeBadge').textContent = subWorkflow?.estimatedTime || '~10 min';
    document.getElementById('visualStepTitle').textContent = step.name || `Step ${currentNum}`;
    document.getElementById('visualStepDesc').textContent = step.description || 'Follow the highlighted area on the screen mockup.';
    document.getElementById('visualInstructionText').textContent = step.nextAction || step.instruction || `Click on "${step.targetElement}"`;
    document.getElementById('visualTipText').textContent = step.tips || step.tip || 'You can do this directly on the official portal.';

    // Action Icon
    const actionIcons = { 'tap': '👆', 'type': '⌨️', 'select': '☑️', 'upload': '📎', 'scroll': '📜' };
    document.getElementById('visualActionIcon').textContent = actionIcons[step.actionType] || (step.securityBoundary ? '🔒' : '👆');

    // Progress
    const percent = Math.round((currentNum / total) * 100);
    document.getElementById('visualProgressPercent').textContent = `${percent}%`;
    document.getElementById('visualProgressFill').style.width = `${percent}%`;

    // Step List
    const stepListEl = document.getElementById('visualStepList');
    if (stepListEl) {
      stepListEl.innerHTML = steps.map((s, idx) => {
        const isDone = idx < this.visualStepIndex;
        const isCurrent = idx === this.visualStepIndex;
        const statusClass = isDone ? 'completed' : isCurrent ? 'current' : 'upcoming';
        return `
          <li class="step-item ${statusClass}" style="cursor:pointer;" onclick="window.civora.renderVisualStep(${idx})">
            <span class="step-check">${isDone ? '✓' : idx + 1}</span>
            <span>${s.name}</span>
          </li>
        `;
      }).join('');
    }

    // Update Nav buttons
    const prevBtn = document.getElementById('btnVisualPrevStep');
    const nextBtn = document.getElementById('btnVisualNextStep');
    prevBtn.disabled = this.visualStepIndex === 0;
    prevBtn.style.opacity = this.visualStepIndex === 0 ? '0.5' : '1';

    if (this.visualStepIndex === total - 1) {
      nextBtn.innerHTML = `<span>✓</span><span>Complete!</span>`;
    } else {
      nextBtn.innerHTML = `<span>Next Step</span><span>→</span>`;
    }

    // Sync to floating popup window if open
    if (this.guidancePopup && !this.guidancePopup.closed) {
      this.sendToPopup({
        type: 'civora:guidance',
        payload: {
          analysis: {
            screenTitle: step.name,
            stepNumber: currentNum,
            totalStepsEstimate: total,
            nextAction: {
              instruction: step.nextAction || `Click on "${step.targetElement}"`,
              actionType: step.actionType || 'tap',
              targetElement: step.targetElement
            },
            tip: step.tips || step.tip,
            isSecurityBoundary: !!step.securityBoundary
          },
          progress: {
            percentage: percent,
            current: currentNum,
            total: total
          }
        }
      });
    }
  }

  nextVisualStep() {
    const subWorkflow = this.processKnowledge.getActiveSubWorkflow();
    const steps = subWorkflow?.steps || this.processKnowledge.getSteps() || [];

    if (this.visualStepIndex < steps.length - 1) {
      this.renderVisualStep(this.visualStepIndex + 1);
    } else {
      this.showToast('🎉 Congratulations! You have completed all steps.', 'success');
    }
  }

  prevVisualStep() {
    if (this.visualStepIndex > 0) {
      this.renderVisualStep(this.visualStepIndex - 1);
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

  // ========================
  //  Toast Notifications
  // ========================

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
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

    // Auto-remove after 3.5 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.25s ease-out';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }
}

// ========================
//  Initialize App
// ========================
document.addEventListener('DOMContentLoaded', () => {
  window.civora = new CivoraApp();
});

