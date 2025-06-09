class SimpleConverter {
    constructor() {
        this.files = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupDropZone();
        this.updateQualityDisplay();
        this.setStatus('Converter ready!', 'success');
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
        this.files = Array.from(files).filter(file => file.type.startsWith('image/'));
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
            fileItem.innerHTML = `
                <div class="file-info">
                    <h3>${file.name}</h3>
                    <p>Size: ${this.formatFileSize(file.size)} | Type: ${file.type}</p>
                </div>
                <button onclick="converter.convertFile(${index})" id="convert-btn-${index}">
                    Convert
                </button>
            `;
            fileList.appendChild(fileItem);
        });
    }

    async convertFile(index) {
    console.log('convertFile called with index:', index);
    console.log('Available files:', this.files);
    
    const file = this.files[index];
    if (!file) {
        console.error('No file found at index:', index);
        return;
    }
    
    const outputFormat = document.getElementById('output-format').value;
    const quality = document.getElementById('quality').value;
    
    console.log('Converting:', file.name, 'to:', outputFormat);
    
    const button = document.getElementById(`convert-btn-${index}`);
    if (!button) {
        console.error('Button not found for index:', index);
        return;
    }
    
    button.disabled = true;
    button.textContent = 'Converting...';

    try {
        this.setStatus(`Converting ${file.name} to ${outputFormat.toUpperCase()}...`, 'processing');

        const result = await this.convertWithCanvas(file, outputFormat, quality);
        
        if (result) {
            this.downloadFile(result, `${file.name.split('.')[0]}.${outputFormat}`, outputFormat);
            this.setStatus(`✅ ${file.name} converted successfully!`, 'success');
            button.textContent = '✅ Done';
            button.style.background = '#28a745';
        } else {
            throw new Error('Conversion failed');
        }

    } catch (error) {
        console.error('Conversion failed:', error);
        this.setStatus(`❌ Failed to convert ${file.name}`, 'error');
        button.textContent = '❌ Failed';
        button.style.background = '#dc3545';
        button.disabled = false;
    }
}

    async convertWithCanvas(file, format, quality) {
        if (format === 'avif') {
            this.setStatus('AVIF conversion coming soon! Converting to WebP instead...', 'processing');
            format = 'webp';
        }

        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                const mimeType = format === 'jpeg' ? 'image/jpeg' : 
                               format === 'png' ? 'image/png' : 
                               format === 'webp' ? 'image/webp' : 'image/jpeg';
                
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
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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

class UnifiedConverter extends SimpleConverter {
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
    }

    setupBulkControls() {
    // Target the container instead of trying to insert after file-list
    const container = document.getElementById('bulk-controls-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="bulk-controls">
            <div class="bulk-actions" style="display: none;">
                <button id="convert-all-btn" class="bulk-btn primary">
                    Convert All Files
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
        
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.innerHTML = `
            <h3>${file.name}</h3>
            <p>Size: ${this.formatFileSize(file.size)} | Type: ${file.type}</p>
        `;
        
        const button = document.createElement('button');
        button.id = `convert-btn-${index}`;
        button.className = 'convert-single-btn';
        button.textContent = 'Convert';
        
        // Add click event directly to the created button
        button.addEventListener('click', (e) => {
            console.log('Button clicked for index:', index);
            e.stopPropagation();
            e.preventDefault();
            this.convertFile(index);
        });
        
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(button);
        fileList.appendChild(fileItem);
        
        console.log('Added button for index:', index, button);
    });

    // Show/hide bulk controls
    const bulkActions = document.querySelector('.bulk-actions');
    if (bulkActions) {
        bulkActions.style.display = this.files.length > 1 ? 'block' : 'none';
    }
}

    handleFiles(files) {
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            this.setStatus('No valid image files found', 'error');
            return;
        }

        if (imageFiles.length > 50) {
            this.setStatus('Maximum 50 files allowed at once', 'error');
            return;
        }

        this.files = imageFiles;
        this.displayFiles();
        this.setStatus(`${imageFiles.length} files ready for conversion`, 'success');
    }

    async convertAllFiles() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.completedFiles = [];
        
        const convertBtn = document.getElementById('convert-all-btn');
        const downloadBtn = document.getElementById('download-all-btn');
        
        convertBtn.disabled = true;
        convertBtn.textContent = 'Processing...';
        downloadBtn.style.display = 'none';

        const outputFormat = document.getElementById('output-format').value;
        const quality = document.getElementById('quality').value;

        this.updateProgress(0, this.files.length);

        for (let i = 0; i < this.files.length; i += this.maxConcurrent) {
            const batch = this.files.slice(i, i + this.maxConcurrent);
            const promises = batch.map((file, index) => 
                this.convertFileInBulk(file, i + index, outputFormat, quality)
            );
            
            await Promise.allSettled(promises);
        }

        this.isProcessing = false;
        convertBtn.textContent = 'Convert All Files';
        convertBtn.disabled = false;

        if (this.completedFiles.length > 0) {
            downloadBtn.style.display = 'block';
            this.setStatus(`✅ ${this.completedFiles.length} files converted successfully!`, 'success');
        }
    }

    async convertFileInBulk(file, index, outputFormat, quality) {
        try {
            const button = document.getElementById(`convert-btn-${index}`);
            if (button) {
                button.disabled = true;
                button.textContent = 'Converting...';
            }

            const result = await this.convertWithCanvas(file, outputFormat, quality);
            
            if (result) {
                const filename = `${file.name.split('.')[0]}.${outputFormat}`;
                this.completedFiles.push({
                    blob: result,
                    filename: filename,
                    originalName: file.name
                });

                if (button) {
                    button.textContent = '✅ Done';
                    button.style.background = '#28a745';
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

        this.setStatus('Creating ZIP file...', 'processing');

        try {
            const zip = new JSZip();
            
            this.completedFiles.forEach(file => {
                zip.file(file.filename, file.blob);
            });

            const zipBlob = await zip.generateAsync({type: "blob"});
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const zipFilename = `converted-images-${timestamp}.zip`;
            
            this.downloadFile(zipBlob, zipFilename, 'zip');
            this.setStatus(`✅ ZIP file downloaded with ${this.completedFiles.length} images!`, 'success');

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