/**
 * Civora AI — Guidance Display Module
 * Renders visual guidance instructions, step progress, and "Tap Here" indicators.
 */

export class GuidanceDisplay {
  constructor() {
    this.guidanceCard = null;
    this.progressCard = null;
    this.historyCard = null;
    this.pointerElement = null;
    this.currentGuidance = null;
    this.history = [];
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

    // Add to history if different from last
    if (this.history.length === 0 || 
        this.history[this.history.length - 1].nextAction?.instruction !== analysis.nextAction?.instruction) {
      this.history.push({
        ...analysis,
        timestamp: Date.now()
      });
    }

    // Render guidance card
    this.renderGuidanceCard(analysis);
    
    // Render progress
    if (progress) {
      this.renderProgressCard(progress, analysis);
    }

    // Show pointer on screen
    if (analysis.nextAction?.targetLocation) {
      this.showPointer(analysis.nextAction.targetLocation);
    }
  }

  /**
   * Render the main guidance instruction card
   */
  renderGuidanceCard(analysis) {
    const action = analysis.nextAction;
    if (!action) {
      this.guidanceCard.innerHTML = `
        <div class="empty-guidance">
          <div class="empty-icon">🤔</div>
          <p>Analyzing the screen...</p>
        </div>
      `;
      return;
    }

    const securityHtml = analysis.isSecurityBoundary ? `
      <div class="security-notice" style="margin-top: var(--space-4);">
        <span>🔒</span>
        <div>
          <strong>Security Step</strong><br>
          ${analysis.securityNote || 'This step requires your manual input for security. Civora cannot and will not bypass this.'}
        </div>
      </div>
    ` : '';

    const actionIcon = this.getActionIcon(action.actionType);
    const confidenceColor = analysis.confidence >= 0.8 ? 'var(--success)' : 
                            analysis.confidence >= 0.5 ? 'var(--warning)' : 'var(--error)';

    this.guidanceCard.innerHTML = `
      <div class="guidance-step-indicator">
        <div class="step-number">${analysis.stepNumber || '?'}</div>
        <div class="step-label">${analysis.screenTitle || 'Current Screen'}</div>
      </div>
      
      <div class="guidance-instruction">
        <span class="instruction-icon">${actionIcon}</span>
        <div>
          <div class="instruction-text">${action.instruction}</div>
          <div class="instruction-detail">
            Target: <strong>${action.targetElement}</strong>
            ${action.targetLocation?.description ? `<br>Location: ${action.targetLocation.description}` : ''}
          </div>
        </div>
      </div>
      
      ${analysis.tip ? `
        <div class="guidance-tip">
          <span class="tip-icon">💡</span>
          <span>${analysis.tip}</span>
        </div>
      ` : ''}
      
      ${securityHtml}
      
      <div style="display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-4);">
        <span style="font-size: var(--text-xs); color: var(--text-tertiary);">Confidence:</span>
        <div style="flex: 1; height: 3px; background: var(--surface-2); border-radius: var(--radius-full); overflow: hidden;">
          <div style="height: 100%; width: ${(analysis.confidence || 0) * 100}%; background: ${confidenceColor}; border-radius: var(--radius-full); transition: width 0.3s;"></div>
        </div>
        <span style="font-size: var(--text-xs); color: ${confidenceColor}; font-weight: 600;">${Math.round((analysis.confidence || 0) * 100)}%</span>
      </div>
    `;
  }

  /**
   * Render the step progress card
   */
  renderProgressCard(progress, analysis) {
    if (!this.progressCard) return;

    const stepsHtml = analysis?.steps || [];
    const workflowSteps = progress.steps || [];

    this.progressCard.innerHTML = `
      <div class="progress-header">
        <span class="heading-3" style="font-size: var(--text-sm);">Progress</span>
        <span class="caption">${progress.current} of ${progress.total}</span>
      </div>
      
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width: ${progress.percentage}%;"></div>
      </div>
      
      ${workflowSteps.length > 0 ? `
        <ul class="step-list">
          ${workflowSteps.map(step => `
            <li class="step-item ${step.status}">
              <span class="step-check">
                ${step.status === 'completed' ? '✓' : step.status === 'current' ? '→' : ''}
              </span>
              <span>${step.name}</span>
            </li>
          `).join('')}
        </ul>
      ` : `
        <p class="caption" style="text-align: center; padding: var(--space-4);">
          ${progress.total > 0 ? `Step ${progress.current} of ${progress.total}` : 'Analyzing workflow...'}
        </p>
      `}
    `;
  }

  /**
   * Show the pointer indicator at a position on the screen view
   * @param {object} location - {approximateX, approximateY, description}
   */
  showPointer(location) {
    if (!this.pointerElement) return;

    const x = location.approximateX || 50;
    const y = location.approximateY || 50;

    this.pointerElement.style.left = `${x}%`;
    this.pointerElement.style.top = `${y}%`;
    this.pointerElement.style.transform = 'translate(-50%, -50%)';
    this.pointerElement.classList.add('visible');
  }

  /**
   * Hide the pointer
   */
  hidePointer() {
    if (this.pointerElement) {
      this.pointerElement.classList.remove('visible');
    }
  }

  /**
   * Show empty state
   */
  showEmpty(message = 'Upload a screenshot or start live capture to get guidance.') {
    if (this.guidanceCard) {
      this.guidanceCard.innerHTML = `
        <div class="empty-guidance">
          <div class="empty-icon">🎯</div>
          <p>${message}</p>
        </div>
      `;
    }
  }

  /**
   * Show analyzing state
   */
  showAnalyzing() {
    if (this.guidanceCard) {
      this.guidanceCard.innerHTML = `
        <div class="empty-guidance">
          <div class="analyzing-spinner"></div>
          <p class="analyzing-text">Analyzing your screen...</p>
        </div>
      `;
    }
  }

  /**
   * Show error state
   */
  showError(message) {
    if (this.guidanceCard) {
      this.guidanceCard.innerHTML = `
        <div class="empty-guidance">
          <div class="empty-icon">⚠️</div>
          <p style="color: var(--error);">${message}</p>
        </div>
      `;
    }
  }

  /**
   * Show completion state
   */
  showComplete() {
    if (this.guidanceCard) {
      this.guidanceCard.innerHTML = `
        <div class="empty-guidance" style="padding: var(--space-6);">
          <div class="empty-icon" style="font-size: 4rem; opacity: 1;">🎉</div>
          <h3 style="margin: var(--space-3) 0;">Process Complete!</h3>
          <p>You've successfully completed all the steps. Great job!</p>
        </div>
      `;
    }
  }

  /**
   * Get the appropriate action icon
   */
  getActionIcon(actionType) {
    const icons = {
      'tap': '👆',
      'type': '⌨️',
      'select': '☑️',
      'scroll': '📜',
      'upload': '📎',
      'wait': '⏳'
    };
    return icons[actionType] || '👆';
  }

  /**
   * Get guidance history
   */
  getHistory() {
    return this.history;
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
  }
}
