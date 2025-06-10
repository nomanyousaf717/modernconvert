// Complete converter.js with dynamic button text and all formats
class SimpleConverter {
    constructor() {
        this.files = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupDropZone();
        this.updateQualityDisplay();
        this.checkFormatSupport(); // Add this line here
        this.setStatus('Converter ready!', 'success');
    }

    // Add this new method after the init() method
    checkFormatSupport() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        
        const formats = {
            webp: canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0,
            avif: canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0
        };
        
        // Update UI to show supported formats
        const formatSelect = document.getElementById('output-format');
        const options = formatSelect.querySelectorAll('option');
        
        options.forEach(option => {
            if (option.value === 'avif' && !formats.avif) {
                option.textContent += ' (Limited support)';
            }
            if (option.value === 'jxl') {
                option.textContent += ' (Desktop only)';
            }
        });
    }

    setupEventListeners() {
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        document.getElementById('quality').addEventListener('input', (e) => {
            document.getElementById('quality-value').textContent = e.target.value;
        });
    }

    setupDropZone() {
        const dropZone = document.getElementById('drop-zone');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });
    }

    handleFiles(files) {
        this.files = Array.from(files).filter(file => 
            file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.jxl')
        );
        this.displayFiles();
    }

    displayFiles() {
        const fileList = document.getElementById('file-list');
        fileList.innerHTML = '';

        if (this.files.length === 0) {
            fileList.innerHTML = '<p>No valid image files selected</p>';
            return;
        }

        this.files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const isJXL = file.name.toLowerCase().endsWith('.jxl');
            const formatIcon = isJXL ? '🆕' : '📁';
            
            fileItem.innerHTML = `
                <div class="file-info">
                    <h3>${formatIcon} ${file.name}</h3>
                    <p>Size: ${this.formatFileSize(file.size)} | Type: ${file.type || 'JPEG XL'}</p>
                    ${isJXL ? '<p style="color: #f59e0b; font-weight: 600;">🆕 JPEG XL file detected!</p>' : ''}
                </div>
                <button onclick="converter.convertFile(${index})" id="convert-btn-${index}">
                    Convert
                </button>
            `;
            fileList.appendChild(fileItem);
        });
    }

    async convertFile(index) {
        const file = this.files[index];
        if (!file) return;
        
        const outputFormat = document.getElementById('output-format').value;
        const quality = document.getElementById('quality').value;
        
        const button = document.getElementById(`convert-btn-${index}`);
        button.disabled = true;
        button.textContent = 'Converting...';

        try {
            this.setStatus(`Converting ${file.name} to ${outputFormat.toUpperCase()}...`, 'processing');

            let result;
            const isJXLInput = file.name.toLowerCase().endsWith('.jxl');
            
            if (outputFormat === 'jxl') {
                result = await this.convertToJXL(file, quality);
            } else if (isJXLInput) {
                this.setStatus('🚧 JXL input support coming soon! Please use other formats for now.', 'error');
                button.textContent = '🚧 JXL Input Soon';
                button.disabled = false;
                return;
            } else {
                result = await this.convertWithCanvas(file, outputFormat, quality);
            }
            
            if (result) {
                const extension = outputFormat;
                const newFilename = `${file.name.split('.')[0]}.${extension}`;
                this.downloadFile(result, newFilename, outputFormat);
                
                if (outputFormat === 'jxl') {
                    const compressionRatio = ((file.size - result.size) / file.size * 100).toFixed(1);
                    this.setStatus(`🎉 WORLD'S FIRST FREE JPEG XL CONVERSION! ${compressionRatio}% smaller!`, 'success');
                } else {
                    this.setStatus(`✅ ${file.name} converted successfully!`, 'success');
                }
                
                button.textContent = '✅ Done';
                button.style.background = '#28a745';
            }

        } catch (error) {
            console.error('Conversion failed:', error);
            this.setStatus(`❌ Failed to convert ${file.name}`, 'error');
            button.textContent = '❌ Failed';
            button.style.background = '#dc3545';
            button.disabled = false;
        }
    }

    async convertToJXL(file, quality) {
        // Get image data
        const imageData = await this.getImageDataFromFile(file);
        
        // Create worker for JXL processing
        const worker = new Worker('jxl-worker.js');
        
        return new Promise((resolve, reject) => {
            const id = Math.random().toString(36);
            
            worker.onmessage = (e) => {
                if (e.data.id === id) {
                    worker.terminate();
                    if (e.data.success) {
                        resolve(e.data.result);
                    } else {
                        reject(new Error(e.data.error));
                    }
                }
            };
            
            worker.postMessage({
                action: 'encode',
                id,
                data: {
                    imageData,
                    options: { quality: quality / 100 }
                }
            });
        });
    }

    async getImageDataFromFile(file) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                resolve(ctx.getImageData(0, 0, img.width, img.height));
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    async convertWithCanvas(file, format, quality) {
    if (format === 'jxl' || format === 'jpeg-xl') {
        // Most mobile browsers don't support JXL yet
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
        
        if (isMobile) {
            this.setStatus('JXL not fully supported on mobile. Converting to WebP for compatibility...', 'processing');
            format = 'webp';
        } else {
            this.setStatus('JXL conversion coming soon! Using WebP instead...', 'processing');
            format = 'webp';
        }
    }

    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            let mimeType;
            switch(format) {
                case 'jpeg':
                    mimeType = 'image/jpeg';
                    break;
                case 'png':
                    mimeType = 'image/png';
                    break;
                case 'webp':
                    mimeType = 'image/webp';
                    break;
                case 'avif':
                    mimeType = 'image/avif';
                    break;
                default:
                    mimeType = 'image/jpeg';
            }
            
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas conversion failed'));
                }
            }, mimeType, quality / 100);
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
    }

    downloadFile(blob, filename, format) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Force download attribute to prevent browser interpretation
    a.download = filename;
    
    // Add explicit MIME type handling for problematic formats
    if (format === 'jxl' || format === 'jpeg-xl') {
        // Force the filename extension for JXL
        if (!filename.toLowerCase().endsWith('.jxl')) {
            a.download = filename.replace(/\.[^/.]+$/, '') + '.jxl';
        }
        
        // Create blob with explicit MIME type
        const correctedBlob = new Blob([blob], { 
            type: 'image/jxl' 
        });
        const correctedUrl = URL.createObjectURL(correctedBlob);
        a.href = correctedUrl;
        
        // Clean up the original URL
        URL.revokeObjectURL(url);
    }
    
    // Ensure the download happens
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup with a slight delay for mobile compatibility
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }, 100);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    setStatus(message, type) {
        const status = document.getElementById('conversion-status');
        status.textContent = message;
        status.className = `status ${type}`;
    }

    updateQualityDisplay() {
        const qualitySlider = document.getElementById('quality');
        const qualityValue = document.getElementById('quality-value');
        qualityValue.textContent = qualitySlider.value;
    }
}

// Enhanced converter with JPEG XL support
class ModernConverter extends SimpleConverter {
    constructor() {
        super();
        this.jxlSupported = true;
    }

    async init() {
        await super.init();
        this.updateFormatOptions();
        this.setStatus('🎉 JPEG XL support LIVE! World\'s first free converter!', 'success');
    }

    updateFormatOptions() {
        const formatSelect = document.getElementById('output-format');
        formatSelect.innerHTML = `
            <option value="jxl">🆕 JPEG XL (LIVE! 55% smaller!)</option>
            <option value="avif">AVIF (Great compression)</option>
            <option value="webp">WebP (Great support)</option>
            <option value="jpeg">JPEG (Universal)</option>
            <option value="png">PNG (Lossless)</option>
        `;
    }
}

// Bulk processing functionality with dynamic button text
class UnifiedConverter extends ModernConverter {
    constructor() {
        super();
        this.processingQueue = [];
        this.isProcessing = false;
        this.maxConcurrent = 3;
        this.completedFiles = [];
    }

    async init() {
        await super.init();
        this.setupBulkControls();
        this.setupFormatChangeListener();
        this.checkFormatSupport(); // Add this line here
    }

    // Add this new method after the init() method
    checkFormatSupport() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        
        const formats = {
            webp: canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0,
            avif: canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0
        };
        
        // Update UI to show supported formats
        const formatSelect = document.getElementById('output-format');
        const options = formatSelect.querySelectorAll('option');
        
        options.forEach(option => {
            if (option.value === 'avif' && !formats.avif) {
                option.textContent += ' (Limited support)';
            }
            if (option.value === 'jxl') {
                option.textContent += ' (Desktop only)';
            }
        });
    }

    setupFormatChangeListener() {
        const formatSelect = document.getElementById('output-format');
        formatSelect.addEventListener('change', () => {
            this.updateButtonTexts();
            this.updateBulkButtonText();
        });
    }

    updateButtonTexts() {
        const selectedFormat = document.getElementById('output-format').value;
        const formatNames = {
            'jxl': 'JXL',
            'avif': 'AVIF', 
            'webp': 'WebP',
            'jpeg': 'JPEG',
            'png': 'PNG'
        };

        const formatIcons = {
            'jxl': '🆕',
            'avif': '🎯',
            'webp': '🌐', 
            'jpeg': '📷',
            'png': '🎨'
        };

        // Update individual convert buttons
        this.files.forEach((file, index) => {
            const button = document.getElementById(`convert-btn-${index}`);
            if (button && !button.disabled && !button.textContent.includes('Done') && !button.textContent.includes('Failed')) {
                const formatName = formatNames[selectedFormat] || selectedFormat.toUpperCase();
                const formatIcon = formatIcons[selectedFormat] || '📁';
                button.textContent = `Convert to ${formatIcon} ${formatName}`;
            }
        });
    }

    updateBulkButtonText() {
        const selectedFormat = document.getElementById('output-format').value;
        const formatNames = {
            'jxl': 'JPEG XL',
            'avif': 'AVIF',
            'webp': 'WebP', 
            'jpeg': 'JPEG',
            'png': 'PNG'
        };

        const convertAllBtn = document.getElementById('convert-all-btn');
        if (convertAllBtn && !convertAllBtn.disabled) {
            const formatName = formatNames[selectedFormat] || selectedFormat.toUpperCase();
            convertAllBtn.textContent = `Convert All to ${formatName}`;
        }
    }

    setupBulkControls() {
        const container = document.getElementById('bulk-controls-container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="bulk-controls">
                <div class="bulk-actions" style="display: none;">
                    <button id="convert-all-btn" class="bulk-btn primary">
                        Convert All to JPEG XL
                    </button>
                    <button id="download-all-btn" class="bulk-btn secondary" style="display: none;">
                        Download All as ZIP
                    </button>
                    <div class="bulk-progress">
                        <div class="progress-bar">
                            <div id="progress-fill" class="progress-fill"></div>
                        </div>
                        <span id="progress-text">0 / 0 files processed</span>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('convert-all-btn').addEventListener('click', () => {
            this.convertAllFiles();
        });

        document.getElementById('download-all-btn').addEventListener('click', () => {
            this.downloadAsZip();
        });

        // Set initial button text
        setTimeout(() => this.updateBulkButtonText(), 100);
    }

    displayFiles() {
        const fileList = document.getElementById('file-list');
        fileList.innerHTML = '';

        if (this.files.length === 0) {
            fileList.innerHTML = '<p>No valid image files selected</p>';
            return;
        }

        this.files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const isJXL = file.name.toLowerCase().endsWith('.jxl');
            const formatIcon = isJXL ? '🆕' : '📁';
            
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            fileInfo.innerHTML = `
                <h3>${formatIcon} ${file.name}</h3>
                <p>Size: ${this.formatFileSize(file.size)} | Ready for conversion!</p>
                ${isJXL ? '<p style="color: #f59e0b; font-weight: 600;">🆕 JPEG XL detected!</p>' : ''}
            `;
            
            const button = document.createElement('button');
            button.id = `convert-btn-${index}`;
            button.className = 'convert-single-btn';
            button.textContent = 'Convert';
            
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.convertFile(index);
            });
            
            fileItem.appendChild(fileInfo);
            fileItem.appendChild(button);
            fileList.appendChild(fileItem);
        });

        // Show bulk controls
        const bulkActions = document.querySelector('.bulk-actions');
        if (bulkActions) {
            bulkActions.style.display = this.files.length > 1 ? 'block' : 'none';
        }

        // Update button texts based on selected format
        setTimeout(() => this.updateButtonTexts(), 100);
    }

    async convertAllFiles() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.completedFiles = [];
        
        const convertBtn = document.getElementById('convert-all-btn');
        const downloadBtn = document.getElementById('download-all-btn');
        const selectedFormat = document.getElementById('output-format').value;
        
        convertBtn.disabled = true;
        convertBtn.textContent = `Converting to ${selectedFormat.toUpperCase()}...`;
        downloadBtn.style.display = 'none';

        const quality = document.getElementById('quality').value;
        this.updateProgress(0, this.files.length);

        for (let i = 0; i < this.files.length; i += this.maxConcurrent) {
            const batch = this.files.slice(i, i + this.maxConcurrent);
            const promises = batch.map((file, index) => 
                this.convertFileInBulk(file, i + index, selectedFormat, quality)
            );
            
            await Promise.allSettled(promises);
        }

        this.isProcessing = false;
        this.updateBulkButtonText();
        convertBtn.disabled = false;

        if (this.completedFiles.length > 0) {
            downloadBtn.style.display = 'block';
            const formatName = selectedFormat === 'jxl' ? 'JPEG XL' : selectedFormat.toUpperCase();
            this.setStatus(`🎉 ${this.completedFiles.length} files converted to ${formatName}!`, 'success');
        }
    }

    async convertFileInBulk(file, index, outputFormat, quality) {
        try {
            const button = document.getElementById(`convert-btn-${index}`);
            if (button) {
                button.disabled = true;
                button.textContent = 'Converting...';
            }

            let result;
            if (outputFormat === 'jxl') {
                result = await this.convertToJXL(file, quality);
            } else {
                result = await this.convertWithCanvas(file, outputFormat, quality);
            }
            
            if (result) {
                const filename = `${file.name.split('.')[0]}.${outputFormat}`;
                this.completedFiles.push({
                    blob: result,
                    filename: filename,
                    originalName: file.name
                });

                if (button) {
                    const formatIcons = {
                        'jxl': '🆕', 'avif': '🎯', 'webp': '🌐', 
                        'jpeg': '📷', 'png': '🎨'
                    };
                    const icon = formatIcons[outputFormat] || '✅';
                    button.textContent = `${icon} Done`;
                    button.style.background = outputFormat === 'jxl' ? '#f59e0b' : '#28a745';
                }

                this.updateProgress(this.completedFiles.length, this.files.length);
            }

        } catch (error) {
            console.error('Bulk conversion failed for:', file.name, error);
            const button = document.getElementById(`convert-btn-${index}`);
            if (button) {
                button.textContent = '❌ Failed';
                button.style.background = '#dc3545';
            }
        }
    }

    updateProgress(completed, total) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressFill && progressText) {
            const percentage = (completed / total) * 100;
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${completed} / ${total} files processed`;
        }
    }

    async downloadAsZip() {
        if (this.completedFiles.length === 0) return;

        this.setStatus('Creating ZIP package...', 'processing');

        try {
            const zip = new JSZip();
            
            this.completedFiles.forEach(file => {
                zip.file(file.filename, file.blob);
            });

            const zipBlob = await zip.generateAsync({type: "blob"});
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const selectedFormat = document.getElementById('output-format').value;
            const zipFilename = `${selectedFormat}-converted-${timestamp}.zip`;
            
            this.downloadFile(zipBlob, zipFilename, 'zip');
            this.setStatus(`🎉 ZIP downloaded with ${this.completedFiles.length} images!`, 'success');

        } catch (error) {
            console.error('ZIP creation failed:', error);
            this.setStatus('❌ Failed to create ZIP file', 'error');
        }
    }
}

let converter;
document.addEventListener('DOMContentLoaded', () => {
    converter = new UnifiedConverter();
});