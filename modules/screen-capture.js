/**
 * Civora AI — Screen Capture Module
 * Handles live screen capture using the Screen Capture API (getDisplayMedia).
 * Includes frame sampling for efficient processing.
 */

export class ScreenCapture {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
    this.isCapturing = false;
    this.samplingInterval = null;
    this.samplingRateMs = 3000; // Sample a frame every 3 seconds
    this.onFrameCaptured = null; // callback(base64, canvas)
    this.onStreamEnded = null; // callback when user stops sharing
  }

  /**
   * Check if Screen Capture API is supported
   */
  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  /**
   * Start screen capture
   * Requests the user's permission via the browser's native dialog
   */
  async startCapture() {
    if (!this.isSupported()) {
      throw new Error('Screen capture is not supported in this browser.');
    }

    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          cursor: 'always'
        },
        audio: false
      });

      // Set up video element to render the stream
      if (!this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.setAttribute('autoplay', '');
        this.videoElement.setAttribute('playsinline', '');
        this.videoElement.muted = true;
      }

      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      // Set up canvas for frame extraction
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');

      this.isCapturing = true;

      // Listen for stream end (user clicks "Stop sharing" in browser)
      this.stream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopCapture();
        if (this.onStreamEnded) {
          this.onStreamEnded();
        }
      });

      // Start frame sampling
      this.startSampling();

      return true;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Screen sharing permission was denied.');
      }
      throw new Error(`Failed to start screen capture: ${err.message}`);
    }
  }

  /**
   * Stop screen capture
   */
  stopCapture() {
    this.isCapturing = false;
    this.stopSampling();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  /**
   * Start periodic frame sampling
   */
  startSampling() {
    this.stopSampling();
    
    // Capture first frame immediately
    setTimeout(() => this.captureFrame(), 500);
    
    this.samplingInterval = setInterval(() => {
      if (this.isCapturing) {
        this.captureFrame();
      }
    }, this.samplingRateMs);
  }

  /**
   * Stop frame sampling
   */
  stopSampling() {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = null;
    }
  }

  /**
   * Capture a single frame from the video stream
   * @returns {string|null} Base64 encoded frame
   */
  captureFrame() {
    if (!this.isCapturing || !this.videoElement || !this.canvas) return null;

    const video = this.videoElement;
    
    if (video.readyState < 2) return null; // Not ready

    // Set canvas to video dimensions
    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;

    // Draw current frame
    this.ctx.drawImage(video, 0, 0);

    // Convert to base64
    const base64 = this.canvas.toDataURL('image/jpeg', 0.8);

    if (this.onFrameCaptured) {
      this.onFrameCaptured(base64, this.canvas);
    }

    return base64;
  }

  /**
   * Get current frame as base64 data (without data URL prefix)
   */
  getBase64Data() {
    if (!this.isCapturing) return null;
    const dataUrl = this.captureFrame();
    if (!dataUrl) return null;
    return dataUrl.split(',')[1];
  }

  /**
   * Force capture a frame now (on-demand)
   */
  captureNow() {
    return this.captureFrame();
  }

  /**
   * Set the sampling rate
   * @param {number} ms - Milliseconds between samples
   */
  setSamplingRate(ms) {
    this.samplingRateMs = Math.max(1000, ms); // Minimum 1 second
    if (this.isCapturing) {
      this.startSampling();
    }
  }

  /**
   * Get video dimensions
   */
  getDimensions() {
    if (!this.videoElement) return null;
    return {
      width: this.videoElement.videoWidth,
      height: this.videoElement.videoHeight
    };
  }

  /**
   * Render the video to a target canvas element in the DOM
   * @param {HTMLCanvasElement} targetCanvas
   */
  renderToCanvas(targetCanvas) {
    if (!this.isCapturing || !this.videoElement) return;

    const ctx = targetCanvas.getContext('2d');
    const video = this.videoElement;

    const render = () => {
      if (!this.isCapturing) return;

      targetCanvas.width = targetCanvas.clientWidth;
      targetCanvas.height = targetCanvas.clientHeight;

      // Maintain aspect ratio
      const videoRatio = video.videoWidth / video.videoHeight;
      const canvasRatio = targetCanvas.width / targetCanvas.height;

      let drawWidth, drawHeight, offsetX, offsetY;

      if (videoRatio > canvasRatio) {
        drawWidth = targetCanvas.width;
        drawHeight = targetCanvas.width / videoRatio;
        offsetX = 0;
        offsetY = (targetCanvas.height - drawHeight) / 2;
      } else {
        drawHeight = targetCanvas.height;
        drawWidth = targetCanvas.height * videoRatio;
        offsetX = (targetCanvas.width - drawWidth) / 2;
        offsetY = 0;
      }

      ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

      if (this.isCapturing) {
        requestAnimationFrame(render);
      }
    };

    render();
  }
}
