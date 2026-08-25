/**
 * Civora AI — Guidance Display Module
 * Renders concise, action-focused guidance instructions ("Here is what you need to do right now"),
 * step progress, and visual "Tap Here" pointer overlay on screenshots.
 */

export class GuidanceDisplay {
  constructor() {
    this.guidanceCard = null;
    this.progressCard = null;
    this.pointerElement = null;
    this.currentGuidance = null;
  }

  /**
   * Initialize with DOM elements
   */
  init(guidanceCard, progressCard, pointerElement) {
    this.guidanceCard = guidanceCard;
    this.progressCard = progressCard;
    this.pointerElement = pointerElement;
  }

  /**
   * Show guidance based on AI analysis
   * @param {object} analysis - The analysis result from VisionEngine
   * @param {object} progress - Progress info from ProcessKnowledge
   */
  showGuidance(analysis, progress) {
    if (!analysis || !this.guidanceCard) return;

    this.currentGuidance = analysis;

    // Render concise action guidance card
    this.renderGuidanceCard(analysis, progress);

    // Position visual pointer on uploaded image
    if (analysis.nextAction?.targetLocation) {
      this.showPointer(analysis.nextAction.targetLocation);
    }
  }

  /**
   * Render the main guidance instruction card: "Here is what you need to do right now."
   */
  renderGuidanceCard(analysis, progress) {
    const action = analysis.nextAction;
    if (!action) {
      this.showEmpty('Could not detect a clear action. Try uploading a clearer screenshot.');
      return;
    }

    const actionIcons = {
      'tap': '👆',
      'type': '⌨️',
      'select': '☑️',
      'upload': '📎',
      'scroll': '📜',
      'wait': '⏳'
    };

    const actionIcon = actionIcons[action.actionType] || (analysis.isSecurityBoundary ? '🔒' : '👆');

    const securityHtml = analysis.isSecurityBoundary ? `
      <div class="tip-box-v1" style="background: rgba(245, 158, 11, 0.1); border-left: 3px solid #F59E0B; margin-top: 12px;">
        <span>🔒</span>
        <span>${analysis.securityNote || 'This is a security field (CAPTCHA/OTP). Please type it manually on the portal.'}</span>
      </div>
    ` : '';

    this.guidanceCard.innerHTML = `
      <div class="action-card-header">
        <span class="action-tag">ACTION DETECTED</span>
        <span class="step-time">Step ${analysis.stepNumber || 1} of ${analysis.totalStepsEstimate || 5}</span>
      </div>

      <h3 class="action-title">${analysis.screenTitle || 'Portal Screen Detected'}</h3>
      <p class="action-desc">
        ${analysis.serviceIdentified ? `Service: <strong>${analysis.serviceIdentified}</strong>` : 'Here is your immediate next step:'}
      </p>

      <!-- Main Action Callout -->
      <div class="instruction-box-v1" style="margin-bottom: 14px;">
        <div class="instruction-icon-v1">${actionIcon}</div>
        <div class="instruction-body">
          <span class="instruction-caption">Do this right now:</span>
          <div class="instruction-text-v1">${action.instruction || `Click on "${action.targetElement}"`}</div>
          ${action.targetLocation?.description ? `
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">
              📍 Location: <strong>${action.targetLocation.description}</strong>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Helpful Tip -->
      ${analysis.tip ? `
        <div class="tip-box-v1" style="margin-bottom: 16px;">
          <span class="tip-icon">💡</span>
          <span>${analysis.tip}</span>
        </div>
      ` : ''}

      ${securityHtml}

      <!-- Next Step Action Buttons -->
      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px;">
        <a href="https://myaadhaar.uidai.gov.in" target="_blank" rel="noopener" class="btn btn-primary btn-block">
          <span>Open Portal & Do This Step</span>
          <span>↗</span>
        </a>
        <button class="btn btn-secondary btn-block" id="btnUploadNextScreenshot">
          <span>📸</span>
          <span>Upload Next Screen / Step</span>
        </button>
      </div>
    `;

    // Bind "Upload Next Screen" button inside the card
    document.getElementById('btnUploadNextScreenshot')?.addEventListener('click', () => {
      document.getElementById('fileInput')?.click();
    });
  }

  /**
   * Show the pointer indicator at a position on the screen view
   * @param {object} location - {approximateX, approximateY, description}
   */
  showPointer(location) {
    if (!this.pointerElement) return;

    const x = Math.max(5, Math.min(95, location.approximateX || 50));
    const y = Math.max(5, Math.min(95, location.approximateY || 50));

    this.pointerElement.style.left = `${x}%`;
    this.pointerElement.style.top = `${y}%`;
    this.pointerElement.style.display = 'block';
    this.pointerElement.classList.add('visible');
  }

  /**
   * Hide the pointer
   */
  hidePointer() {
    if (this.pointerElement) {
      this.pointerElement.style.display = 'none';
      this.pointerElement.classList.remove('visible');
    }
  }

  /**
   * Show empty state
   */
  showEmpty(message = 'Upload or paste a screenshot from the portal to receive instant directions.') {
    if (this.guidanceCard) {
      this.guidanceCard.innerHTML = `
        <div class="empty-guidance">
          <div class="empty-icon-v1">🎯</div>
          <h4>Waiting for screenshot</h4>
          <p>${message}</p>
        </div>
      `;
    }
    this.hidePointer();
  }

  /**
   * Show analyzing state
   */
  showAnalyzing() {
    if (this.guidanceCard) {
      this.guidanceCard.innerHTML = `
        <div class="empty-guidance">
          <div class="spinner-clean"></div>
          <h4>Analyzing your screen</h4>
          <p>Gemini AI is identifying your current step and next action...</p>
        </div>
      `;
    }
    this.hidePointer();
  }

  /**
   * Show error state
   */
  showError(message) {
    if (this.guidanceCard) {
      this.guidanceCard.innerHTML = `
        <div class="empty-guidance">
          <div class="empty-icon-v1">⚠️</div>
          <h4 style="color: var(--danger);">Analysis Notice</h4>
          <p style="margin-bottom: 16px;">${message || 'Could not analyze the screenshot. Please make sure the portal screen is visible and clear.'}</p>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('fileInput').click()">
            Upload Another Screenshot
          </button>
        </div>
      `;
    }
    this.hidePointer();
  }
}
