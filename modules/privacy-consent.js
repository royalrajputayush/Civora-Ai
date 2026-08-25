/**
 * Civora AI — Privacy & Consent Module
 * Handles user consent flows, privacy explanations, and permission management.
 */

export class PrivacyConsent {
  constructor() {
    this.consentKey = 'civora_consent';
    this.screenAccessKey = 'civora_screen_access_consent';
  }

  /**
   * Check if user has given general consent
   */
  hasGeneralConsent() {
    return localStorage.getItem(this.consentKey) === 'true';
  }

  /**
   * Check if user has given screen access consent
   */
  hasScreenAccessConsent() {
    return localStorage.getItem(this.screenAccessKey) === 'true';
  }

  /**
   * Save general consent
   */
  grantGeneralConsent() {
    localStorage.setItem(this.consentKey, 'true');
  }

  /**
   * Save screen access consent
   */
  grantScreenAccessConsent() {
    localStorage.setItem(this.screenAccessKey, 'true');
  }

  /**
   * Revoke screen access consent
   */
  revokeScreenAccessConsent() {
    localStorage.removeItem(this.screenAccessKey);
  }

  /**
   * Revoke all consent
   */
  revokeAllConsent() {
    localStorage.removeItem(this.consentKey);
    localStorage.removeItem(this.screenAccessKey);
  }

  /**
   * Get consent explanation items for the UI
   */
  getConsentExplanation() {
    return [
      {
        icon: '🔍',
        title: 'Why screen access is needed',
        description: 'Civora needs to see your current screen to understand which step you are on and guide you to the next action.'
      },
      {
        icon: '🧠',
        title: 'What Civora does with it',
        description: 'Your screen is analyzed by AI to identify UI elements and determine the next step. The analysis happens in real-time.'
      },
      {
        icon: '🔒',
        title: 'Privacy-first approach',
        description: 'Screen frames are processed temporarily and never stored permanently. No screenshots are saved to any server.'
      },
      {
        icon: '⚠️',
        title: 'Sensitive information',
        description: 'Government screens may show Aadhaar, PAN, bank details, or OTPs. Civora does not extract, store, or transmit this data.'
      },
      {
        icon: '🛑',
        title: 'You are in control',
        description: 'You can stop screen sharing at any time by clicking the "Stop Sharing" button or revoking the browser permission.'
      }
    ];
  }

  /**
   * Render the consent modal content
   */
  renderConsentModal(container) {
    const items = this.getConsentExplanation();
    
    container.innerHTML = `
      <div class="consent-flow active">
        <p class="body-text" style="margin-bottom: var(--space-4);">
          Before Civora can guide you in Live Mode, we need to explain how screen access works.
        </p>
        
        <div class="consent-items">
          ${items.map(item => `
            <div class="consent-item">
              <span class="consent-icon">${item.icon}</span>
              <div>
                <h4>${item.title}</h4>
                <p>${item.description}</p>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="privacy-badge">
          <span>🛡️</span>
          <span>Privacy-First — No data stored</span>
        </div>
      </div>
    `;
  }

  /**
   * Security boundaries that Civora respects
   */
  getSecurityBoundaries() {
    return [
      'Civora will NOT solve CAPTCHAs',
      'Civora will NOT bypass OS security restrictions',
      'Civora will NOT bypass government security mechanisms',
      'Civora will NOT auto-fill authentication credentials',
      'Civora will NOT store sensitive personal data'
    ];
  }
}
