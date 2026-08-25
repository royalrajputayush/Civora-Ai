/**
 * Civora AI — Screenshot Upload Module
 * Handles drag-and-drop, file picker, and clipboard paste for screenshot uploads.
 */

export class ScreenshotUpload {
  constructor() {
    this.currentImage = null;
    this.onImageReady = null; // callback(base64, file)
  }

  /**
   * Initialize upload zone with event listeners
   * @param {HTMLElement} dropZone - The drop zone element
   * @param {HTMLInputElement} fileInput - Hidden file input element
   */
  init(dropZone, fileInput) {
    this.dropZone = dropZone;
    this.fileInput = fileInput;

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.querySelector('.upload-area')?.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.querySelector('.upload-area')?.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.querySelector('.upload-area')?.classList.remove('drag-over');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.processFile(files[0]);
      }
    });

    // Click to upload
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.processFile(e.target.files[0]);
      }
    });

    // Paste from clipboard
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            this.processFile(file);
          }
          break;
        }
      }
    });
  }

  /**
   * Process an uploaded file
   * @param {File} file
   */
  processFile(file) {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
      this.showError('Please upload an image file (PNG, JPG, WebP, BMP)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.showError('Image too large. Maximum size is 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      this.currentImage = {
        base64,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        timestamp: Date.now()
      };

      if (this.onImageReady) {
        this.onImageReady(this.currentImage);
      }
    };

    reader.onerror = () => {
      this.showError('Failed to read the image file.');
    };

    reader.readAsDataURL(file);
  }

  /**
   * Get the current image as base64 (without data URL prefix)
   */
  getBase64Data() {
    if (!this.currentImage) return null;
    // Strip the data:image/...;base64, prefix
    return this.currentImage.base64.split(',')[1];
  }

  /**
   * Get the MIME type of the current image
   */
  getMimeType() {
    if (!this.currentImage) return null;
    return this.currentImage.type;
  }

  /**
   * Clear the current image
   */
  clear() {
    this.currentImage = null;
    if (this.fileInput) {
      this.fileInput.value = '';
    }
  }

  /**
   * Show an error (dispatches a custom event)
   */
  showError(message) {
    window.dispatchEvent(new CustomEvent('civora-toast', {
      detail: { message, type: 'error' }
    }));
  }
}
