/**
 * Civora AI — Change Detection Module
 * Detects significant visual changes between consecutive frames 
 * to trigger re-analysis only when needed.
 */

export class ChangeDetector {
  constructor() {
    this.previousFrame = null;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.threshold = 0.05; // 5% pixel difference = significant change
    this.sampleSize = 100; // Sample NxN grid for fast comparison
  }

  /**
   * Compare a new frame against the previous one
   * @param {string} base64Frame - Base64 data URL of the new frame
   * @returns {Promise<{changed: boolean, similarity: number}>}
   */
  async detectChange(base64Frame) {
    if (!this.previousFrame) {
      this.previousFrame = base64Frame;
      return { changed: true, similarity: 0 };
    }

    try {
      const similarity = await this.compareFrames(this.previousFrame, base64Frame);
      const changed = (1 - similarity) > this.threshold;

      if (changed) {
        this.previousFrame = base64Frame;
      }

      return { changed, similarity };
    } catch (err) {
      console.warn('Change detection error:', err);
      this.previousFrame = base64Frame;
      return { changed: true, similarity: 0 };
    }
  }

  /**
   * Compare two frames using sampled pixel comparison
   * @returns {Promise<number>} Similarity ratio (0.0 to 1.0)
   */
  async compareFrames(frame1Base64, frame2Base64) {
    const [img1, img2] = await Promise.all([
      this.loadImage(frame1Base64),
      this.loadImage(frame2Base64)
    ]);

    const size = this.sampleSize;
    this.canvas.width = size;
    this.canvas.height = size;

    // Draw and sample frame 1
    this.ctx.drawImage(img1, 0, 0, size, size);
    const data1 = this.ctx.getImageData(0, 0, size, size).data;

    // Draw and sample frame 2
    this.ctx.drawImage(img2, 0, 0, size, size);
    const data2 = this.ctx.getImageData(0, 0, size, size).data;

    // Compare pixels
    let matchCount = 0;
    const totalPixels = size * size;
    const pixelThreshold = 30; // Individual pixel color difference threshold

    for (let i = 0; i < data1.length; i += 4) {
      const rDiff = Math.abs(data1[i] - data2[i]);
      const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
      const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
      const avgDiff = (rDiff + gDiff + bDiff) / 3;

      if (avgDiff < pixelThreshold) {
        matchCount++;
      }
    }

    return matchCount / totalPixels;
  }

  /**
   * Load a base64 image string into an Image element
   * @param {string} base64 - Base64 data URL
   * @returns {Promise<HTMLImageElement>}
   */
  loadImage(base64) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = base64;
    });
  }

  /**
   * Reset the detector (clear previous frame)
   */
  reset() {
    this.previousFrame = null;
  }

  /**
   * Set the change threshold
   * @param {number} threshold - Value between 0 and 1
   */
  setThreshold(threshold) {
    this.threshold = Math.max(0.01, Math.min(0.5, threshold));
  }
}
