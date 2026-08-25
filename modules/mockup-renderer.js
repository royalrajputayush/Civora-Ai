/**
 * Civora AI — Visual Mockup Renderer Module
 * Generates clean, high-contrast, focused visual diagrams of government portal screens
 * with pinpoint highlighted click targets for zero-permission visual guidance.
 * Flow: See → Understand → Do → Next
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
    const isSecurity = !!step?.securityBoundary;
    const instruction = step?.nextAction || step?.instruction || `Click on "${targetElement}"`;

    // Generate specific visual screen mockup based on step
    const screenVisual = this.generateScreenDiagram(stepId, stepName, targetElement, isSecurity, serviceId);

    return `
      <div class="visual-mockup-wrapper">
        <!-- Action Callout Banner: See → Understand → Do -->
        <div class="visual-action-callout ${isSecurity ? 'security-warning' : ''}">
          <div class="callout-step-badge">${isSecurity ? '🔒 MANUAL STEP' : '🎯 ACTION'}</div>
          <div class="callout-instruction">${instruction}</div>
          <div class="callout-subtext">Tap the highlighted button below to continue</div>
        </div>

        <!-- Simulated Browser Viewport -->
        <div class="mockup-viewport-inner">
          ${screenVisual}
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
  generateScreenDiagram(stepId, stepName, targetElement, isSecurity, serviceId) {
    if (stepId.includes('address') && (stepId.includes('form') || stepId.includes('field'))) {
      return this.renderAddressFormDiagram(targetElement);
    } else if (stepId.includes('upload') || stepId.includes('proof')) {
      return this.renderUploadDiagram(targetElement);
    } else if (stepId.includes('review')) {
      return this.renderReviewDiagram(targetElement);
    } else if (stepId.includes('confirmation') || stepId.includes('urn')) {
      return this.renderConfirmationDiagram(targetElement);
    } else if (stepId.includes('captcha') || stepId.includes('otp')) {
      return this.renderOtpCaptchaDiagram(targetElement);
    } else if (stepId.includes('download')) {
      return this.renderDownloadDiagram(targetElement);
    } else if (stepId.includes('status') || stepId.includes('track')) {
      return this.renderStatusDiagram(targetElement);
    } else if (stepId.includes('appointment') || stepId.includes('centre')) {
      return this.renderAppointmentDiagram(targetElement);
    } else {
      return this.renderDashboardDiagram(stepName, targetElement, serviceId);
    }
  }

  renderDashboardDiagram(stepName, targetElement, serviceId) {
    const isAddress = serviceId?.includes('address') || targetElement.toLowerCase().includes('address');
    const isDownload = serviceId?.includes('download') || targetElement.toLowerCase().includes('download');
    const isMobile = serviceId?.includes('mobile') || targetElement.toLowerCase().includes('mobile');
    const isStatus = serviceId?.includes('status') || targetElement.toLowerCase().includes('status');

    return `
      <div class="portal-mockup portal-dashboard">
        <div class="portal-header-bar">
          <div class="portal-emblem">🇮🇳</div>
          <div class="portal-brand-text">
            <span class="gov-title">Unique Identification Authority of India</span>
            <span class="portal-name">myAadhaar — Resident Portal</span>
          </div>
          <div class="portal-login-badge ${targetElement.toLowerCase().includes('login') ? 'target-hotspot clickable-target' : ''}" data-action="next-step">
            Login
          </div>
        </div>

        <div class="portal-hero-banner">
          <h2>Welcome to myAadhaar Portal</h2>
          <p>Official Government of India Identity Services</p>
        </div>

        <div class="portal-service-grid">
          <div class="portal-card ${isDownload ? 'target-hotspot clickable-target' : 'interactive-card'}" data-action="next-step">
            <div class="card-icon">📥</div>
            <h4>Download Aadhaar</h4>
            <p>Get password-protected electronic copy</p>
            ${isDownload ? '<div class="hotspot-badge">👆 Tap Here</div>' : ''}
          </div>

          <div class="portal-card ${isAddress ? 'target-hotspot clickable-target' : 'interactive-card'}" data-action="next-step">
            <div class="card-icon">📍</div>
            <h4>Update Address</h4>
            <p>Update residential address with document</p>
            ${isAddress ? '<div class="hotspot-badge">👆 Tap Here</div>' : ''}
          </div>

          <div class="portal-card ${isStatus ? 'target-hotspot clickable-target' : 'interactive-card'}" data-action="next-step">
            <div class="card-icon">🔍</div>
            <h4>Check Status</h4>
            <p>Track request using SRN or URN</p>
            ${isStatus ? '<div class="hotspot-badge">👆 Tap Here</div>' : ''}
          </div>

          <div class="portal-card ${isMobile ? 'target-hotspot clickable-target' : 'interactive-card'}" data-action="next-step">
            <div class="card-icon">📱</div>
            <h4>Book Appointment</h4>
            <p>For Mobile, Name, Biometrics update</p>
            ${isMobile ? '<div class="hotspot-badge">👆 Tap Here</div>' : ''}
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
              <label>House / Flat / Building No. *</label>
              <div class="fake-input filled">Flat 402, Lotus Heights</div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-field half">
              <label>Street / Road / Lane *</label>
              <div class="fake-input filled">MG Road</div>
            </div>
            <div class="form-field half">
              <label>PIN Code *</label>
              <div class="fake-input filled">110001</div>
            </div>
          </div>

          <div class="form-actions">
            <button class="portal-btn primary target-hotspot clickable-target" data-action="next-step">
              Next (Proceed to Document Upload) →
              <div class="hotspot-badge">👆 Click Next</div>
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
            <div class="fake-select">
              <span>Electricity Bill (not older than 3 months)</span>
              <span class="arrow">▼</span>
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

  renderReviewDiagram(targetElement) {
    return `
      <div class="portal-mockup portal-review-view">
        <div class="portal-header-bar">
          <div class="portal-emblem">🇮🇳</div>
          <div class="portal-name">Review & Final Confirmation</div>
        </div>

        <div class="portal-review-box">
          <div class="review-row">
            <span class="review-label">Updated Address:</span>
            <span class="review-value">Flat 402, Lotus Heights, MG Road, New Delhi — 110001</span>
          </div>
          <div class="review-row">
            <span class="review-label">Uploaded Document:</span>
            <span class="review-value">Electricity_Bill.pdf (Verified ✓)</span>
          </div>

          <div class="form-actions" style="margin-top: 20px;">
            <button class="portal-btn primary target-hotspot clickable-target" data-action="next-step">
              Submit Update Request →
              <div class="hotspot-badge">👆 Click to Submit</div>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderConfirmationDiagram(targetElement) {
    return `
      <div class="portal-mockup portal-confirm-view">
        <div class="portal-header-bar">
          <div class="portal-emblem">🇮🇳</div>
          <div class="portal-name">Request Submitted Successfully</div>
        </div>

        <div class="confirm-box target-hotspot clickable-target" data-action="next-step">
          <div class="confirm-icon">🎉</div>
          <h3>Your Request is Successfully Registered!</h3>
          <p>Please note down your Service Request Number (SRN):</p>
          <div class="srn-pill">SRN: <strong>S10098271892</strong></div>
          <p style="font-size: 0.75rem; color: #6B7280; margin-top: 8px;">Address updates take 3-7 working days. You will receive an SMS confirmation.</p>
          <div class="hotspot-badge">👆 Complete!</div>
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
            <label>12-Digit Aadhaar Number</label>
            <div class="fake-input filled">XXXX XXXX 8912</div>
          </div>

          <div class="form-row captcha-row">
            <div class="form-field half">
              <label>Enter CAPTCHA *</label>
              <div class="fake-input">K 8 9 W X</div>
            </div>
          </div>

          <div class="form-field">
            <label>6-Digit Mobile OTP *</label>
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
          <h3>Your e-Aadhaar is ready for download</h3>
          <p>Password is First 4 letters of name in CAPITAL + Birth Year (e.g. ANIS1995)</p>
          
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

        <div class="status-tracker-card target-hotspot clickable-target" data-action="next-step">
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
              <span>Verification</span>
            </div>
            <div class="tracker-step">
              <span class="step-circle">○</span>
              <span>Completed</span>
            </div>
          </div>

          <div class="status-summary">
            <div class="status-pill in-progress">In Progress</div>
            <p>Your update request is under UIDAI verification. Status updates will be sent via SMS.</p>
          </div>
          <div class="hotspot-badge">👆 Tap to Continue</div>
        </div>
      </div>
    `;
  }

  renderAppointmentDiagram(targetElement) {
    return `
      <div class="portal-mockup portal-appointment-view">
        <div class="portal-header-bar">
          <div class="portal-emblem">🇮🇳</div>
          <div class="portal-name">Book Appointment at Aadhaar Seva Kendra</div>
        </div>

        <div class="appointment-card">
          <div class="form-row">
            <div class="form-field half">
              <label>Select City / Location *</label>
              <div class="fake-select">
                <span>New Delhi — Connaught Place ASK</span>
                <span class="arrow">▼</span>
              </div>
            </div>
            <div class="form-field half">
              <label>Select Date & Time Slot *</label>
              <div class="fake-input filled">Tomorrow at 10:30 AM</div>
            </div>
          </div>

          <div class="form-actions">
            <button class="portal-btn primary target-hotspot clickable-target" data-action="next-step">
              Confirm Appointment Booking →
              <div class="hotspot-badge">👆 Book Slot</div>
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
