/**
 * Civora AI — Process Knowledge Module
 * Manages structured workflow definitions for Indian government citizen portals.
 * Fully synchronous with built-in verified workflows for instant, offline-capable execution.
 */

const BUILTIN_AADHAAR_WORKFLOW = {
  "id": "aadhaar-services",
  "name": "Aadhaar Online Services",
  "description": "Navigate myAadhaar portal for address updates, downloads, appointments, and status checks.",
  "service_url": "https://myaadhaar.uidai.gov.in",
  "commonSteps": [
    {
      "id": "landing",
      "name": "myAadhaar Portal Dashboard",
      "description": "The resident service portal home screen",
      "expectedElements": ["Login", "Download Aadhaar", "Update Address", "Check Status", "Book Appointment"],
      "nextAction": "Click on the service you want to start",
      "targetElement": "Service Card",
      "tips": "Look for the prominent card on the portal home page."
    }
  ],
  "subWorkflows": [
    {
      "id": "update-address",
      "name": "Update Address",
      "icon": "📍",
      "description": "Update residential address with valid proof",
      "estimatedTime": "~5-10 min",
      "requiredDocuments": ["Passport", "Electricity Bill", "Bank Passbook", "Rent Agreement"],
      "steps": [
        {
          "id": "landing",
          "name": "1. Portal Dashboard",
          "description": "Select the Address Update service from the main portal dashboard",
          "nextAction": "Click on 'Update Address' card",
          "targetElement": "Update Address",
          "actionType": "tap",
          "tips": "This opens the Self Service Update Portal (SSUP)."
        },
        {
          "id": "address-form",
          "name": "2. Fill New Address",
          "description": "Enter your new residential address details carefully",
          "nextAction": "Fill in your House No, Street, and PIN Code, then click Next",
          "targetElement": "Next Button",
          "actionType": "type",
          "tips": "Enter the address exactly as written on your supporting document."
        },
        {
          "id": "upload-proof",
          "name": "3. Upload Proof Document",
          "description": "Upload a valid scan or photo of your address proof",
          "nextAction": "Select document type and upload your file (under 2MB)",
          "targetElement": "Upload Document",
          "actionType": "upload",
          "tips": "Accepted: Electricity Bill (≤3 months old), Passport, or Bank Passbook."
        },
        {
          "id": "review-address",
          "name": "4. Review Details",
          "description": "Review your updated address before submitting",
          "nextAction": "Check the preview and click 'Submit Update Request'",
          "targetElement": "Submit Button",
          "actionType": "tap",
          "tips": "Double check PIN code and building number."
        },
        {
          "id": "confirmation",
          "name": "5. Save Request Number (SRN)",
          "description": "Registration successful with tracking number",
          "nextAction": "Save or screenshot your Service Request Number (SRN)",
          "targetElement": "SRN Number",
          "actionType": "tap",
          "tips": "You will need this SRN to track update progress."
        }
      ]
    },
    {
      "id": "download-aadhaar",
      "name": "Download e-Aadhaar",
      "icon": "📥",
      "description": "Download electronic copy of Aadhaar card PDF",
      "estimatedTime": "~3 min",
      "requiredDocuments": ["Aadhaar Number & Registered Mobile"],
      "steps": [
        {
          "id": "landing",
          "name": "1. Portal Dashboard",
          "description": "Select Download Aadhaar on myAadhaar homepage",
          "nextAction": "Click on 'Download Aadhaar' card",
          "targetElement": "Download Aadhaar",
          "actionType": "tap",
          "tips": "You will need your 12-digit Aadhaar number."
        },
        {
          "id": "download-otp",
          "name": "2. Verify Mobile OTP",
          "description": "Enter OTP sent to your registered mobile number",
          "nextAction": "Type the 6-digit OTP received via SMS and tap Verify",
          "targetElement": "Verify OTP",
          "actionType": "type",
          "securityBoundary": true,
          "tips": "🔒 Civora will never ask for your OTP. Enter it directly on UIDAI."
        },
        {
          "id": "download-file",
          "name": "3. Download & Open PDF",
          "description": "Save the password-protected digital Aadhaar PDF",
          "nextAction": "Click 'Download e-Aadhaar PDF'",
          "targetElement": "Download PDF",
          "actionType": "tap",
          "tips": "PDF Password = First 4 letters of name in CAPITAL + Birth Year (e.g. ANIS1995)."
        }
      ]
    },
    {
      "id": "update-mobile",
      "name": "Update Mobile Number",
      "icon": "📱",
      "description": "Book appointment to link new phone number",
      "estimatedTime": "~5 min (online part)",
      "requiredDocuments": ["Original Aadhaar Card & New Mobile Phone"],
      "steps": [
        {
          "id": "landing",
          "name": "1. Portal Dashboard",
          "description": "Navigate to Seva Kendra Appointment booking",
          "nextAction": "Click on 'Book Appointment' card",
          "targetElement": "Book Appointment",
          "actionType": "tap",
          "tips": "Mobile updates require physical biometric verification at a centre."
        },
        {
          "id": "select-centre",
          "name": "2. Select Centre & Time Slot",
          "description": "Pick your nearest Aadhaar Seva Kendra and date",
          "nextAction": "Select your city, date, and preferred time slot, then click Book",
          "targetElement": "Confirm Appointment",
          "actionType": "select",
          "tips": "Booking in advance avoids standing in long queues."
        },
        {
          "id": "confirmation",
          "name": "3. Save Booking Receipt",
          "description": "Save your appointment slip",
          "nextAction": "Save your Appointment Slip and visit centre with new phone",
          "targetElement": "Download Receipt",
          "actionType": "tap",
          "tips": "Carry your original Aadhaar card and new mobile phone for OTP."
        }
      ]
    },
    {
      "id": "update-name",
      "name": "Update Name",
      "icon": "✏️",
      "description": "Correct spelling or update name on Aadhaar",
      "estimatedTime": "~5-10 min",
      "requiredDocuments": ["Passport", "PAN Card", "Voter ID", "Marriage Certificate"],
      "steps": [
        {
          "id": "landing",
          "name": "1. Portal Dashboard",
          "description": "Navigate to demographic update section",
          "nextAction": "Click on 'Update Name / Demographics'",
          "targetElement": "Update Name",
          "actionType": "tap",
          "tips": "Name corrections require a valid government photo ID."
        },
        {
          "id": "name-form",
          "name": "2. Enter Correct Name",
          "description": "Enter the corrected name exactly as on identity proof",
          "nextAction": "Enter your full name and click Next",
          "targetElement": "Next Button",
          "actionType": "type",
          "tips": "Avoid abbreviations unless they are present on your proof document."
        },
        {
          "id": "upload-proof",
          "name": "3. Upload Identity Proof",
          "description": "Upload PAN card, Passport, or Voter ID",
          "nextAction": "Upload your proof document and submit",
          "targetElement": "Upload File",
          "actionType": "upload",
          "tips": "Ensure the document is clear and readable."
        },
        {
          "id": "confirmation",
          "name": "4. Save URN Tracking Number",
          "description": "Name update request registered",
          "nextAction": "Save your Update Request Number (URN)",
          "targetElement": "URN Number",
          "actionType": "tap",
          "tips": "Name updates typically process within 5-10 working days."
        }
      ]
    },
    {
      "id": "check-status",
      "name": "Track Request Status",
      "icon": "🔍",
      "description": "Check real-time progress of your Aadhaar update",
      "estimatedTime": "~2 min",
      "requiredDocuments": ["Service Request Number (SRN or URN)"],
      "steps": [
        {
          "id": "landing",
          "name": "1. Portal Dashboard",
          "description": "Select Check Status on the portal",
          "nextAction": "Click on 'Check Status' card",
          "targetElement": "Check Status",
          "actionType": "tap",
          "tips": "Have your 14 or 28-digit SRN/URN handy."
        },
        {
          "id": "status-tracker",
          "name": "2. Enter Tracking Number",
          "description": "Enter your SRN and solve CAPTCHA",
          "nextAction": "Type your SRN and click 'Submit'",
          "targetElement": "Submit Button",
          "actionType": "type",
          "tips": "The tracking number is in your SMS receipt."
        },
        {
          "id": "status-result",
          "name": "3. View Current Stage",
          "description": "See verification stage and completion status",
          "nextAction": "Check if status is 'Completed' or 'Under Verification'",
          "targetElement": "Status Result",
          "actionType": "tap",
          "tips": "If status says Completed, your e-Aadhaar is ready for download."
        }
      ]
    }
  ]
};

export class ProcessKnowledge {
  constructor() {
    this.workflows = new Map();
    this.activeWorkflow = null;
    this.activeSubWorkflow = null;
    this.currentStepIndex = 0;
    this.completedSteps = [];

    // Pre-load verified built-in workflows synchronously
    this.loadWorkflow(BUILTIN_AADHAAR_WORKFLOW);
    this.setActiveSubWorkflow('update-address');
  }

  loadWorkflow(workflowData) {
    if (!workflowData || !workflowData.id) return;
    this.workflows.set(workflowData.id, workflowData);
  }

  async loadBuiltinWorkflows() {
    // Already loaded in constructor, optionally fetch latest updates
    try {
      const response = await fetch('./data/workflows/aadhaar-services.json');
      if (response.ok) {
        const data = await response.json();
        this.loadWorkflow(data);
      }
    } catch (err) {
      // Fallback is already loaded
    }
  }

  getWorkflows() {
    return Array.from(this.workflows.values());
  }

  hasSubWorkflows(workflowId = 'aadhaar-services') {
    const wf = this.workflows.get(workflowId);
    return !!(wf && wf.subWorkflows && wf.subWorkflows.length > 0);
  }

  getSubWorkflows(workflowId = 'aadhaar-services') {
    const wf = this.workflows.get(workflowId);
    if (!wf || !wf.subWorkflows) return [];
    return wf.subWorkflows;
  }

  setActiveSubWorkflow(subWorkflowId = 'update-address') {
    return this.setActiveWorkflow('aadhaar-services', subWorkflowId);
  }

  setActiveWorkflow(workflowId = 'aadhaar-services', subWorkflowId = 'update-address') {
    let workflow = this.workflows.get(workflowId);
    if (!workflow) {
      workflow = BUILTIN_AADHAAR_WORKFLOW;
      this.loadWorkflow(workflow);
    }

    let sub = null;
    if (workflow.subWorkflows) {
      sub = workflow.subWorkflows.find(s => s.id === subWorkflowId) || workflow.subWorkflows[0];
    }

    this.activeSubWorkflow = sub;

    if (sub && sub.steps) {
      this.activeWorkflow = {
        id: `${workflow.id}:${sub.id}`,
        name: sub.name,
        description: sub.description,
        estimatedTime: sub.estimatedTime,
        steps: sub.steps,
        _subWorkflowId: sub.id,
        _parentId: workflow.id
      };
    } else {
      this.activeWorkflow = {
        ...workflow,
        steps: workflow.steps || []
      };
    }

    this.currentStepIndex = 0;
    this.completedSteps = [];
    return this.activeWorkflow;
  }

  getActiveWorkflow() {
    return this.activeWorkflow;
  }

  getActiveSubWorkflow() {
    return this.activeSubWorkflow;
  }

  getSteps() {
    return this.activeWorkflow?.steps || [];
  }

  getCurrentStep() {
    const steps = this.getSteps();
    if (this.currentStepIndex < 0 || this.currentStepIndex >= steps.length) {
      return steps[0] || null;
    }
    return steps[this.currentStepIndex] || null;
  }

  getWorkflowContext() {
    const currentStep = this.getCurrentStep();
    const steps = this.getSteps();
    return {
      serviceName: this.activeWorkflow?.name || 'Aadhaar Service',
      subWorkflowName: this.activeSubWorkflow?.name || null,
      steps,
      currentStep,
      expectedElements: currentStep?.expectedElements || [],
      currentStepIndex: this.currentStepIndex,
      totalSteps: steps.length
    };
  }

  matchStep(analysis) {
    if (!this.activeWorkflow) return null;
    const steps = this.getSteps();
    if (!steps.length) return null;

    let bestMatch = null;
    let bestScore = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      let score = 0;

      if (analysis.detectedElements && step.expectedElements) {
        for (const detected of analysis.detectedElements) {
          for (const expected of step.expectedElements) {
            if (detected.toLowerCase().includes(expected.toLowerCase())) {
              score += 2;
            }
          }
        }
      }

      if (analysis.screenTitle && step.name) {
        if (analysis.screenTitle.toLowerCase().includes(step.name.toLowerCase())) {
          score += 3;
        }
      }

      if (i === this.currentStepIndex) score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { step, index: i, score };
      }
    }

    if (bestMatch && bestMatch.score >= 2) {
      this.currentStepIndex = bestMatch.index;
      return bestMatch;
    }

    return null;
  }

  advanceStep() {
    const steps = this.getSteps();
    if (this.currentStepIndex < steps.length - 1) {
      this.currentStepIndex++;
      return { completed: false, step: this.getCurrentStep() };
    }
    return { completed: true, step: null };
  }

  getProgress() {
    const steps = this.getSteps();
    const total = steps.length || 1;
    const current = Math.min(this.currentStepIndex + 1, total);
    return {
      current,
      total,
      percentage: Math.round((current / total) * 100),
      isComplete: this.currentStepIndex >= total - 1
    };
  }

  getStepsWithStatus() {
    const steps = this.getSteps();
    return steps.map((step, index) => ({
      ...step,
      status: index < this.currentStepIndex ? 'completed' :
              index === this.currentStepIndex ? 'current' : 'upcoming',
      index
    }));
  }

  resetProgress() {
    this.currentStepIndex = 0;
    this.completedSteps = [];
  }
}
