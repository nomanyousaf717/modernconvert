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

    // Add this to your existing converter.js file
setupFormatSelection() {
    const formatOptions = document.querySelectorAll('input[name="format"]');
    formatOptions.forEach(option => {
        option.addEventListener('change', (e) => {
            // Update the output format in your existing logic
            if (document.getElementById('output-format')) {
                document.getElementById('output-format').value = e.target.value;
            }
        });
    });
}

// Add this to your init() method
async init() {
    this.setupEventListeners();
    this.setupDropZone();
    this.setupFormatSelection(); // Add this line
    this.updateQualityDisplay();
    this.setStatus('Converter ready!', 'success');
}

    async convertFile(index) {
        const file = this.files[index];
        const outputFormat = document.getElementById('output-format').value;
        const quality = document.getElementById('quality').value;
        
        const button = document.getElementById(`convert-btn-${index}`);
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
        // Handle AVIF format limitation
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

// Initialize the converter when page loads
let converter;
document.addEventListener('DOMContentLoaded', () => {
    converter = new SimpleConverter();
});