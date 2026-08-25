/**
 * Civora AI — Auto-Pilot Content Execution Engine
 * Injected into active pages to perceive DOM, execute actions, and manage HUD.
 */

(function () {
  if (window.__civoraAutoPilotInjected) return;
  window.__civoraAutoPilotInjected = true;

  class CivoraContentAgent {
    constructor() {
      this.hudEl = null;
      this.cursorEl = null;
      this.isExecuting = false;
      this.isPaused = false;
      this.currentWorkflow = null;
      this.currentStepIndex = 0;

      this.initMessageListener();
    }

    initMessageListener() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
          case 'CIVORA_START_AUTOPILOT':
            this.startAutoPilot(message.workflow, message.targetService);
            sendResponse({ status: 'started' });
            break;
          case 'CIVORA_EXECUTE_ACTION':
            this.executeAction(message.actionData).then(sendResponse);
            return true;
          case 'CIVORA_STOP_AUTOPILOT':
            this.stopAutoPilot();
            sendResponse({ status: 'stopped' });
            break;
          case 'CIVORA_GET_PAGE_CONTEXT':
            sendResponse(this.extractPageContext());
            break;
        }
      });
    }

    /**
     * Start the Auto-Pilot Flow
     */
    startAutoPilot(workflow, service) {
      this.isExecuting = true;
      this.isPaused = false;
      this.currentWorkflow = workflow;
      this.currentStepIndex = 0;

      this.createHUD();
      this.updateHUD({
        title: service?.name || 'Civora Auto-Pilot',
        status: 'Active',
        instruction: 'Analyzing page structure and preparing automated execution...',
        isAlert: false
      });

      // Notify background to evaluate first step
      chrome.runtime.sendMessage({
        type: 'CIVORA_STEP_READY',
        url: window.location.href,
        context: this.extractPageContext()
      });
    }

    /**
     * Create In-Page HUD
     */
    createHUD() {
      if (document.getElementById('civora-hud-root')) return;

      const root = document.createElement('div');
      root.id = 'civora-hud-root';
      root.innerHTML = `
        <div class="civora-hud-card">
          <div class="civora-hud-header">
            <div class="civora-hud-brand">
              <span class="civora-hud-logo">🎯</span>
              <span class="civora-hud-title" id="civora-hud-title">Civora AI</span>
              <span class="civora-hud-badge">Auto-Pilot</span>
            </div>
            <div class="civora-hud-status-pill" id="civora-hud-pill">
              <span class="civora-hud-status-dot"></span>
              <span id="civora-hud-status">Running</span>
            </div>
          </div>
          <div class="civora-hud-instruction" id="civora-hud-instruction">
            Initializing AI Auto-Pilot...
          </div>
          <div id="civora-hud-alert-container"></div>
          <div class="civora-hud-controls">
            <button class="civora-hud-btn civora-hud-btn-primary" id="civora-hud-resume" style="display:none;">
              ▶️ Resume Auto-Pilot
            </button>
            <button class="civora-hud-btn civora-hud-btn-danger" id="civora-hud-stop">
              🛑 Stop
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(root);
      this.hudEl = root;

      document.getElementById('civora-hud-stop').addEventListener('click', () => {
        this.stopAutoPilot();
        chrome.runtime.sendMessage({ type: 'CIVORA_AGENT_STOPPED' });
      });

      document.getElementById('civora-hud-resume').addEventListener('click', () => {
        this.resumeAutoPilot();
      });
    }

    /**
     * Update HUD UI State
     */
    updateHUD({ title, status, instruction, isAlert, alertMsg, showResume }) {
      if (!this.hudEl) this.createHUD();

      if (title) document.getElementById('civora-hud-title').textContent = title;
      
      const statusEl = document.getElementById('civora-hud-status');
      const pillEl = document.getElementById('civora-hud-pill');
      if (status) {
        statusEl.textContent = status;
        if (status.toLowerCase().includes('paused')) {
          pillEl.classList.add('paused');
        } else {
          pillEl.classList.remove('paused');
        }
      }

      if (instruction) {
        document.getElementById('civora-hud-instruction').textContent = instruction;
      }

      const alertContainer = document.getElementById('civora-hud-alert-container');
      if (isAlert && alertMsg) {
        alertContainer.innerHTML = `<div class="civora-hud-alert">🛡️ <strong>Safety Shield</strong>: ${alertMsg}</div>`;
      } else {
        alertContainer.innerHTML = '';
      }

      const resumeBtn = document.getElementById('civora-hud-resume');
      resumeBtn.style.display = showResume ? 'flex' : 'none';
    }

    /**
     * Pause for Sensitive Input (OTP, CAPTCHA, Passwords)
     */
    pauseForHumanInput(targetElement, reason = 'Please complete this verification step manually.') {
      this.isPaused = true;

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.classList.add('civora-highlight-sensitive');
        targetElement.focus();
      }

      this.updateHUD({
        status: 'Paused (Human-in-the-Loop)',
        instruction: 'Waiting for your manual input on the highlighted field.',
        isAlert: true,
        alertMsg: reason,
        showResume: true
      });
    }

    /**
     * Resume after Human-in-the-Loop input
     */
    resumeAutoPilot() {
      this.isPaused = false;
      document.querySelectorAll('.civora-highlight-sensitive').forEach(el => el.classList.remove('civora-highlight-sensitive'));

      this.updateHUD({
        status: 'Running',
        instruction: 'Resuming auto-pilot navigation...',
        isAlert: false,
        showResume: false
      });

      chrome.runtime.sendMessage({
        type: 'CIVORA_STEP_READY',
        url: window.location.href,
        context: this.extractPageContext()
      });
    }

    /**
     * Execute an action requested by the Background Agent
     */
    async executeAction(action) {
      if (!action) return { success: false, error: 'No action' };

      const { actionType, targetSelector, targetText, value, instruction, isSecurityBoundary } = action;

      // 1. Locate Target Element
      const el = this.findElement(targetSelector, targetText);

      // Check security boundary (OTP, Captcha, Password)
      if (isSecurityBoundary || (el && this.isSensitiveField(el))) {
        this.pauseForHumanInput(el, instruction || 'Sensitive step detected. Please input manually.');
        return { success: true, paused: true };
      }

      if (!el) {
        return { success: false, error: `Could not locate element: ${targetSelector || targetText}` };
      }

      // 2. Scroll into view and show pointer
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(400);
      this.showActionCursor(el);
      el.classList.add('civora-highlight-target');

      this.updateHUD({
        instruction: instruction || `Executing: ${actionType} on ${el.innerText || el.placeholder || el.tagName}`,
        status: 'Executing'
      });

      await this.sleep(600);

      // 3. Execute Action Type
      try {
        switch (actionType) {
          case 'click':
            this.simulateClick(el);
            break;
          case 'type':
            await this.simulateType(el, value || '');
            break;
          case 'select':
            this.simulateSelect(el, value);
            break;
          case 'scroll':
            window.scrollBy({ top: 300, behavior: 'smooth' });
            break;
        }

        await this.sleep(500);
        el.classList.remove('civora-highlight-target');
        this.hideActionCursor();

        return { success: true };
      } catch (err) {
        el.classList.remove('civora-highlight-target');
        this.hideActionCursor();
        return { success: false, error: err.message };
      }
    }

    /**
     * Natural Simulated Click
     */
    simulateClick(el) {
      const opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.click();
    }

    /**
     * Natural Simulated Typing
     */
    async simulateType(el, text) {
      el.focus();
      el.value = '';

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        el.value += char;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        await this.sleep(30 + Math.random() * 40); // Natural human cadence
      }
    }

    /**
     * Dropdown selection
     */
    simulateSelect(el, value) {
      if (el.tagName === 'SELECT') {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    /**
     * Element Finder (Selector + Fuzzy Text Search)
     */
    findElement(selector, text) {
      if (selector) {
        try {
          const el = document.querySelector(selector);
          if (el) return el;
        } catch (e) {}
      }

      if (text) {
        const lower = text.toLowerCase().trim();
        const candidates = document.querySelectorAll('button, a, input, [role="button"], label, h1, h2, h3, p, span');
        for (const c of candidates) {
          if (c.innerText && c.innerText.toLowerCase().includes(lower)) {
            return c;
          }
          if (c.placeholder && c.placeholder.toLowerCase().includes(lower)) {
            return c;
          }
          if (c.getAttribute('aria-label') && c.getAttribute('aria-label').toLowerCase().includes(lower)) {
            return c;
          }
        }
      }

      return null;
    }

    /**
     * Detect OTP, Password, or CAPTCHA elements
     */
    isSensitiveField(el) {
      const type = (el.getAttribute('type') || '').toLowerCase();
      const name = (el.getAttribute('name') || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();

      const sensitiveKeywords = ['otp', 'password', 'captcha', 'security_code', 'pin', 'cvv'];

      if (type === 'password') return true;

      return sensitiveKeywords.some(k => name.includes(k) || id.includes(k) || placeholder.includes(k));
    }

    /**
     * Visual Cursor Overlay
     */
    showActionCursor(targetEl) {
      if (!this.cursorEl) {
        this.cursorEl = document.createElement('div');
        this.cursorEl.id = 'civora-action-cursor';
        document.body.appendChild(this.cursorEl);
      }

      const rect = targetEl.getBoundingClientRect();
      const x = rect.left + rect.width / 2 + window.scrollX;
      const y = rect.top + rect.height / 2 + window.scrollY;

      this.cursorEl.style.left = `${x}px`;
      this.cursorEl.style.top = `${y}px`;
      this.cursorEl.style.display = 'block';
    }

    hideActionCursor() {
      if (this.cursorEl) this.cursorEl.style.display = 'none';
    }

    /**
     * Stop and Remove HUD
     */
    stopAutoPilot() {
      this.isExecuting = false;
      this.isPaused = false;
      this.hideActionCursor();
      document.querySelectorAll('.civora-highlight-target, .civora-highlight-sensitive').forEach(el => {
        el.classList.remove('civora-highlight-target', 'civora-highlight-sensitive');
      });
      if (this.hudEl) {
        this.hudEl.remove();
        this.hudEl = null;
      }
    }

    /**
     * Extract Page Context for Background AI
     */
    extractPageContext() {
      return {
        title: document.title,
        url: window.location.href,
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText).slice(0, 8),
        buttons: Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]')).map(b => b.innerText || b.value).filter(Boolean).slice(0, 15),
        inputs: Array.from(document.querySelectorAll('input, select, textarea')).map(i => ({
          name: i.name,
          type: i.type,
          placeholder: i.placeholder,
          id: i.id
        })).slice(0, 15)
      };
    }

    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  window.civoraAgent = new CivoraContentAgent();
})();
