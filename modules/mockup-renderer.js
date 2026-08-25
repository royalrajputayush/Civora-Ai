/**
 * Civora AI — Visual Mockup Renderer Module
 * Generates realistic, high-fidelity visual diagrams and mockups of government portal screens
 * with animated glowing click targets for zero-permission visual guidance.
 */

export class MockupRenderer {
  constructor() {
    this.container = null;
  }

  /**
   * Render a realistic visual screen mockup with highlighted action hotspot
   * @param {object} step - Workflow step object
   * @param {string} serviceId - Service ID (e.g., 'update-address', 'download-aadhaar')
   * @returns {string} HTML string containing the interactive visual mockup
   */
  renderMockupHTML(step, serviceId = 'update-address') {
    const stepId = step?.id || 'landing';
    const stepName = step?.name || 'Portal Step';
    const targetElement = step?.targetElement || step?.nextAction || 'Continue';
    const tip = step?.tips || step?.tip || 'Follow the highlighted section on screen.';
    const isSecurity = !!step?.securityBoundary;

    // Generate specific visual screen mockup based on step
    const screenVisual = this.generateScreenDiagram(stepId, stepName, targetElement, isSecurity);

    return `
      <div class="visual-mockup-wrapper">
        <!-- Browser Window Frame Simulation -->
        <div class="mockup-browser-frame">
          <div class="browser-topbar">
            <div class="browser-dots">
              <span class="dot red"></span>
              <span class="dot yellow"></span>
              <span class="dot green"></span>
            </div>
            <div class="browser-address-bar">
              <span class="lock-icon">🔒</span>
              <span class="url-text">${this.getPortalURL(serviceId, stepId)}</span>
            </div>
          </div>
          
          <div class="browser-viewport">
            ${screenVisual}
          </div>
        </div>

        <!-- Visual Action Callout Bar -->
        <div class="mockup-action-bar ${isSecurity ? 'security-warning' : ''}">
          <div class="action-bar-icon">${isSecurity ? '🔒' : '👆'}</div>
          <div class="action-bar-content">
            <div class="action-bar-title">${isSecurity ? 'User Security Step (Manual Input)' : 'Action on this Screen'}</div>
            <div class="action-bar-instruction">${step?.nextAction || step?.instruction || `Click on "${targetElement}"`}</div>
          </div>
        </div>
      </div>
    `;
  }

  getPortalURL(serviceId, stepId) {
    if (serviceId.includes('aadhaar')) return 'https://myaadhaar.uidai.gov.in';
    if (serviceId.includes('pan')) return 'https://onlineservices.nsdl.com';
    return 'https://services.india.gov.in';
  }

  /**
   * Generate visual diagram representing the government portal screen layout
   */
  generateScreenDiagram(stepId, stepName, targetElement, isSecurity) {
    // Custom tailored visual diagrams for different government workflow stages
    if (stepId.includes('address') && stepId.includes('form')) {
      return this.renderAddressFormDiagram(targetElement);
    } else if (stepId.includes('upload') || stepId.includes('proof')) {
      return this.renderUploadDiagram(targetElement);
    } else if (stepId.includes('captcha') || stepId.includes('otp')) {
      return this.renderOtpCaptchaDiagram(targetElement);
    } else if (stepId.includes('download')) {
      return this.renderDownloadDiagram(targetElement);
    } else if (stepId.includes('status') || stepId.includes('track')) {
      return this.renderStatusDiagram(targetElement);
    } else {
      return this.renderDashboardDiagram(stepName, targetElement);
    }
  }

  renderDashboardDiagram(stepName, targetElement) {
    return `
      <div class="portal-mockup portal-dashboard">
        <div class="portal-header-bar">
          <div class="portal-emblem">🇮🇳</div>
          <div class="portal-brand-text">
            <span class="gov-title">Unique Identification Authority of India</span>
            <span class="portal-name">myAadhaar — Resident Portal</span>
          </div>
          <div class="portal-login-badge ${targetElement.toLowerCase().includes('login') ? 'target-hotspot clickable-target' : ''}" data-action="next-step">
            ${targetElement.toLowerCase().includes('login') ? '<span class="spotlight-pulse"></span>' : ''} Login
          </div>
        </div>

        <div class="portal-hero-banner">
          <h2>Welcome to myAadhaar Portal</h2>
          <p>Official Government of India Identity Services</p>
        </div>

        <div class="portal-service-grid">
          <div class="portal-card ${targetElement.toLowerCase().includes('download') ? 'target-hotspot clickable-target' : 'interactive-card'}" data-action="next-step">
            <div class="card-icon">📥</div>
            <h4>Download Aadhaar</h4>
            <p>Get password-protected electronic copy</p>
            ${targetElement.toLowerCase().includes('download') ? '<div class="hotspot-badge">👆 Tap Here to Continue</div>' : ''}
          </div>

          <div class="portal-card ${targetElement.toLowerCase().includes('address') || targetElement.toLowerCase().includes('update') ? 'target-hotspot clickable-target' : 'interactive-card'}" data-action="next-step">
            <div class="card-icon">📍</div>
            <h4>Update Address</h4>
            <p>Update residential address with document</p>
            ${targetElement.toLowerCase().includes('address') || targetElement.toLowerCase().includes('update') ? '<div class="hotspot-badge">👆 Tap Here to Continue</div>' : ''}
          </div>

          <div class="portal-card ${targetElement.toLowerCase().includes('status') ? 'target-hotspot clickable-target' : 'interactive-card'}" data-action="next-step">
            <div class="card-icon">🔍</div>
            <h4>Check Status</h4>
            <p>Track request using SRN or URN</p>
            ${targetElement.toLowerCase().includes('status') ? '<div class="hotspot-badge">👆 Tap Here to Continue</div>' : ''}
          </div>

          <div class="portal-card ${targetElement.toLowerCase().includes('mobile') ? 'target-hotspot clickable-target' : 'interactive-card'}" data-action="next-step">
            <div class="card-icon">📱</div>
            <h4>Book Appointment</h4>
            <p>For Mobile, Name, Biometrics update</p>
            ${targetElement.toLowerCase().includes('mobile') ? '<div class="hotspot-badge">👆 Tap Here to Continue</div>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderAddressFormDiagram(targetElement) {
    return `
      <div class="portal-mockup portal-form-view">
        <div class="portal-header-bar">
          <div class="portal-emblem">🇮🇳</div>
          <div class="portal-brand-text">
            <span class="portal-name">Online Address Update Form</span>
          </div>
        </div>

        <div class="portal-form-container">
          <div class="form-step-nav">
            <span class="step active">1. Address Details</span>
            <span class="step">2. Upload Proof</span>
            <span class="step">3. Preview & Submit</span>
          </div>

          <div class="form-row">
            <div class="form-field half">
              <label>Care Of (Father / Husband Name) *</label>
              <div class="fake-input filled">C/O Rajesh Sharma</div>
            </div>
            <div class="form-field half">
              <label>House / Building / Apartment No. *</label>
              <div class="fake-input target-hotspot">
                <span class="fake-placeholder">e.g. Flat 402, Lotus Heights</span>
                <div class="hotspot-badge">👆 Fill Here</div>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-field half">
              <label>Street / Road / Lane *</label>
              <div class="fake-input">MG Road</div>
            </div>
            <div class="form-field half">
              <label>PIN Code *</label>
              <div class="fake-input">110001</div>
            </div>
          </div>

          <div class="form-actions">
            <button class="portal-btn">Back</button>
            <button class="portal-btn primary target-hotspot clickable-target" data-action="next-step">
              Next Step (Upload Document) →
              <div class="hotspot-badge">👆 Click to Proceed</div>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderUploadDiagram(targetElement) {
    return `
      <div class="portal-mockup portal-upload-view">
        <div class="portal-header-bar">
          <div class="portal-emblem">🇮🇳</div>
          <div class="portal-name">Supporting Document Upload</div>
        </div>

        <div class="portal-upload-box">
          <div class="upload-dropdown-section">
            <label>Select Valid Supporting Document Type *</label>
            <div class="fake-select target-hotspot clickable-target" data-action="next-step">
              <span>Electricity Bill (not older than 3 months)</span>
              <span class="arrow">▼</span>
              <div class="hotspot-badge">👆 Select Document</div>
            </div>
          </div>

          <div class="upload-dropzone target-hotspot clickable-target" data-action="next-step">
            <div class="drop-icon">📎</div>
            <h4>Upload Document (Max 2MB - PDF/JPG/PNG)</h4>
            <p>Ensure your name and address are clearly visible</p>
            <div class="fake-upload-btn">Upload File</div>
            <div class="hotspot-badge">👆 Tap to Upload & Continue</div>
          </div>
        </div>
      </div>
    `;
  }

  renderOtpCaptchaDiagram(targetElement) {
    return `
      <div class="portal-mockup portal-security-view">
        <div class="portal-header-bar">
          <div class="portal-emblem">🇮🇳</div>
          <div class="portal-name">Resident Identity Authentication</div>
        </div>

        <div class="portal-security-box">
          <div class="form-field">
            <label>Enter 12-Digit Aadhaar Number</label>
            <div class="fake-input filled">XXXX XXXX 8912</div>
          </div>

          <div class="form-row captcha-row">
            <div class="form-field half">
              <label>Enter CAPTCHA *</label>
              <div class="fake-input security-target">
                <span class="fake-placeholder">Enter letters shown</span>
              </div>
            </div>
            <div class="captcha-preview">
              <span class="captcha-chars">K 8 9 W X</span>
              <span class="refresh-icon">🔄</span>
            </div>
          </div>

          <div class="form-field">
            <label>Enter 6-Digit Mobile OTP *</label>
            <div class="fake-input security-target">
              <span class="fake-placeholder">• • • • • •</span>
              <div class="security-badge">🔒 Manual Entry</div>
            </div>
          </div>

          <div class="form-actions">
            <button class="portal-btn primary target-hotspot clickable-target" data-action="next-step">
              Login / Verify OTP →
              <div class="hotspot-badge">👆 Tap to Verify</div>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderDownloadDiagram(targetElement) {
    return `
      <div class="portal-mockup portal-download-view">
        <div class="portal-header-bar">
          <div class="portal-emblem">🇮🇳</div>
          <div class="portal-name">Download Digital e-Aadhaar</div>
        </div>

        <div class="download-success-card">
          <div class="success-icon">🎉</div>
          <h3>Congratulations! Your e-Aadhaar is ready</h3>
          <p>The PDF is password protected (First 4 letters of name in CAPITAL + Birth Year, e.g. ANIS1995)</p>
          
          <div class="download-action target-hotspot clickable-target" data-action="next-step">
            <button class="portal-btn download-large">
              <span>📥</span> Download e-Aadhaar PDF
            </button>
            <div class="hotspot-badge">👆 Tap to Download</div>
          </div>
        </div>
      </div>
    `;
  }

  renderStatusDiagram(targetElement) {
    return `
      <div class="portal-mockup portal-status-view">
        <div class="portal-header-bar">
          <div class="portal-emblem">🇮🇳</div>
          <div class="portal-name">Track Request Status</div>
        </div>

        <div class="status-tracker-card">
          <div class="tracker-steps">
            <div class="tracker-step done">
              <span class="step-circle">✓</span>
              <span>Draft</span>
            </div>
            <div class="tracker-step done">
              <span class="step-circle">✓</span>
              <span>Payment</span>
            </div>
            <div class="tracker-step current">
              <span class="step-circle active">●</span>
              <span>Verification Stage</span>
            </div>
            <div class="tracker-step">
              <span class="step-circle">○</span>
              <span>Completed</span>
            </div>
          </div>

          <div class="status-summary">
            <div class="status-pill in-progress">In Progress</div>
            <p>Your update request is under verification by UIDAI back-office. Usually takes 3-7 working days.</p>
          </div>
        </div>
      </div>
    `;
  }
}
