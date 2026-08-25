/**
 * Civora AI — Process Knowledge Module
 * Manages structured workflow definitions and matches screen state to process steps.
 * Supports sub-workflows: a parent workflow can have commonSteps + subWorkflows,
 * and the user picks a sub-workflow to merge into a single active step list.
 */

export class ProcessKnowledge {
  constructor() {
    this.workflows = new Map();
    this.activeWorkflow = null;
    this.activeSubWorkflow = null;
    this.currentStepIndex = -1;
    this.completedSteps = [];
  }

  /**
   * Load a workflow from a JSON object
   * @param {object} workflowData - The workflow JSON data
   */
  loadWorkflow(workflowData) {
    this.workflows.set(workflowData.id, workflowData);
  }

  /**
   * Load the built-in workflows
   */
  async loadBuiltinWorkflows() {
    try {
      const response = await fetch('./data/workflows/aadhaar-services.json');
      if (response.ok) {
        const data = await response.json();
        this.loadWorkflow(data);
      }
    } catch (err) {
      console.warn('Failed to load built-in workflows:', err);
    }
  }

  /**
   * Get all loaded workflows
   */
  getWorkflows() {
    return Array.from(this.workflows.values());
  }

  /**
   * Check if a workflow has sub-workflows
   * @param {string} workflowId
   * @returns {boolean}
   */
  hasSubWorkflows(workflowId) {
    const workflow = this.workflows.get(workflowId);
    return !!(workflow && workflow.subWorkflows && workflow.subWorkflows.length > 0);
  }

  /**
   * Get the sub-workflows for a given workflow
   * @param {string} workflowId
   * @returns {Array} list of sub-workflow summaries
   */
  getSubWorkflows(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || !workflow.subWorkflows) return [];
    return workflow.subWorkflows.map(sw => ({
      id: sw.id,
      name: sw.name,
      icon: sw.icon || '📋',
      description: sw.description || '',
      requiredDocuments: sw.requiredDocuments || [],
      estimatedTime: sw.estimatedTime || ''
    }));
  }

  /**
   * Set the active workflow. If it has sub-workflows and no subWorkflowId
   * is given, it just sets the parent — caller should then show sub-workflow picker.
   * @param {string} workflowId
   * @param {string} [subWorkflowId] - Optional sub-workflow to activate
   */
  setActiveWorkflow(workflowId, subWorkflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    this.activeSubWorkflow = null;

    // If the workflow has sub-workflows and a specific one is selected,
    // merge commonSteps + subWorkflow.steps into a flat step list
    if (workflow.subWorkflows && subWorkflowId) {
      const sub = workflow.subWorkflows.find(sw => sw.id === subWorkflowId);
      if (!sub) {
        throw new Error(`Sub-workflow not found: ${subWorkflowId}`);
      }

      this.activeSubWorkflow = sub;

      // Build merged workflow
      const mergedSteps = [
        ...(workflow.commonSteps || []),
        ...sub.steps
      ];

      this.activeWorkflow = {
        ...workflow,
        name: `${workflow.name} — ${sub.name}`,
        steps: mergedSteps,
        _subWorkflowId: sub.id,
        _originalId: workflow.id
      };
    } else if (workflow.steps) {
      // Legacy: workflow has flat steps array
      this.activeWorkflow = workflow;
    } else {
      // Workflow only has sub-workflows — set parent but no active steps yet
      this.activeWorkflow = {
        ...workflow,
        steps: workflow.commonSteps || [],
        _needsSubSelection: true
      };
    }

    this.currentStepIndex = 0;
    this.completedSteps = [];
    return this.activeWorkflow;
  }

  /**
   * Check if we need sub-workflow selection before guidance can start
   */
  needsSubWorkflowSelection() {
    return !!(this.activeWorkflow && this.activeWorkflow._needsSubSelection);
  }

  /**
   * Get the active workflow
   */
  getActiveWorkflow() {
    return this.activeWorkflow;
  }

  /**
   * Get the active sub-workflow (if any)
   */
  getActiveSubWorkflow() {
    return this.activeSubWorkflow;
  }

  /**
   * Get the current step
   */
  getCurrentStep() {
    if (!this.activeWorkflow || this.currentStepIndex < 0) return null;
    return this.activeWorkflow.steps[this.currentStepIndex] || null;
  }

  /**
   * Get workflow context for the Vision Engine
   */
  getWorkflowContext() {
    if (!this.activeWorkflow) {
      return {
        serviceName: 'Unknown Service',
        steps: [],
        currentStep: null,
        expectedElements: []
      };
    }

    const currentStep = this.getCurrentStep();
    return {
      serviceName: this.activeWorkflow.name,
      subWorkflowName: this.activeSubWorkflow?.name || null,
      steps: this.activeWorkflow.steps,
      currentStep,
      expectedElements: currentStep?.expectedElements || [],
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.activeWorkflow.steps.length
    };
  }

  /**
   * Try to match the AI analysis to a workflow step
   * @param {object} analysis - The analysis result from VisionEngine
   * @returns {object|null} Matched step info
   */
  matchStep(analysis) {
    if (!this.activeWorkflow) return null;

    const steps = this.activeWorkflow.steps;
    
    // Try to match based on detected elements and screen title
    let bestMatch = null;
    let bestScore = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      let score = 0;

      // Check if detected elements match expected elements
      if (analysis.detectedElements && step.expectedElements) {
        for (const detected of analysis.detectedElements) {
          for (const expected of step.expectedElements) {
            if (detected.toLowerCase().includes(expected.toLowerCase()) ||
                expected.toLowerCase().includes(detected.toLowerCase())) {
              score += 2;
            }
          }
        }
      }

      // Check if screen title matches step name/description
      if (analysis.screenTitle) {
        const title = analysis.screenTitle.toLowerCase();
        if (title.includes(step.name.toLowerCase()) || 
            step.name.toLowerCase().includes(title)) {
          score += 3;
        }
        if (step.description && title.includes(step.description.toLowerCase())) {
          score += 2;
        }
      }

      // Slight preference for sequential steps
      if (i === this.currentStepIndex || i === this.currentStepIndex + 1) {
        score += 1;
      }

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

  /**
   * Mark the current step as completed and advance
   */
  advanceStep() {
    if (!this.activeWorkflow) return null;

    const currentStep = this.getCurrentStep();
    if (currentStep) {
      this.completedSteps.push({
        step: currentStep,
        completedAt: Date.now()
      });
    }

    this.currentStepIndex++;
    
    if (this.currentStepIndex >= this.activeWorkflow.steps.length) {
      return { completed: true, step: null };
    }

    return { completed: false, step: this.getCurrentStep() };
  }

  /**
   * Get progress information
   */
  getProgress() {
    if (!this.activeWorkflow) {
      return { current: 0, total: 0, percentage: 0, completedSteps: [] };
    }

    const total = this.activeWorkflow.steps.length;
    const current = Math.min(this.currentStepIndex + 1, total);
    
    return {
      current,
      total,
      percentage: Math.round((current / total) * 100),
      completedSteps: this.completedSteps,
      isComplete: this.currentStepIndex >= total
    };
  }

  /**
   * Get all steps with their status
   */
  getStepsWithStatus() {
    if (!this.activeWorkflow) return [];

    return this.activeWorkflow.steps.map((step, index) => ({
      ...step,
      status: index < this.currentStepIndex ? 'completed' :
              index === this.currentStepIndex ? 'current' : 'upcoming',
      index
    }));
  }

  /**
   * Reset the current workflow progress
   */
  resetProgress() {
    this.currentStepIndex = 0;
    this.completedSteps = [];
  }
}
