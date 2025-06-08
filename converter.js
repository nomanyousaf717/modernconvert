class ModernConverter {
    constructor() {
        this.ffmpeg = null;
        this.loaded = false;
        this.files = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupDropZone();
        this.updateQualityDisplay();
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

    async loadFFmpeg() {
        if (this.loaded) return;
        
        this.setStatus('Loading converter...', 'processing');
        
        try {
            // Use a more stable version and configuration
            const { FFmpeg } = FFmpegWASM;
            this.ffmpeg = new FFmpeg();
            
            // Use jsdelivr CDN instead of unpkg for better reliability
            await this.ffmpeg.load({
                coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
                wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
            });
            
            this.loaded = true;
            this.setStatus('Converter ready!', 'success');
        } catch (error) {
            console.error('Failed to load FFmpeg:', error);
            this.setStatus('Loading converter failed. Falling back to basic conversion...', 'error');
            // Fall back to Canvas-based conversion for basic formats
            this.loadCanvasConverter();
        }
    }

    // Fallback converter using Canvas API (more reliable)
    loadCanvasConverter() {
        this.loaded = true;
        this.useCanvasConverter = true;
        this.setStatus('Basic converter ready!', 'success');
    }

    async convertFile(index) {
        const file = this.files[index];
        const outputFormat = document.getElementById('output-format').value;
        const quality = document.getElementById('quality').value;
        
        const button = document.getElementById(`convert-btn-${index}`);
        button.disabled = true;
        button.textContent = 'Converting...';

        try {
            await this.loadFFmpeg();
            
            this.setStatus(`Converting ${file.name} to ${outputFormat.toUpperCase()}...`, 'processing');

            let result;
            
            // Use Canvas converter for basic formats if FFmpeg fails
            if (this.useCanvasConverter && (outputFormat === 'jpeg' || outputFormat === 'png' || outputFormat === 'webp')) {
                result = await this.convertWithCanvas(file, outputFormat, quality);
            } else {
                result = await this.convertWithFFmpeg(file, outputFormat, quality);
            }
            
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
            this.setStatus(`❌ Failed to convert ${file.name}. Try a different format.`, 'error');
            button.textContent = '❌ Failed';
            button.style.background = '#dc3545';
            button.disabled = false;
        }
    }

    // Canvas-based converter (fallback)
    async convertWithCanvas(file, format, quality) {
        return new Promise((resolve) => {
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
                    resolve(blob);
                }, mimeType, quality / 100);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    // FFmpeg converter (for advanced formats)
    async convertWithFFmpeg(file, outputFormat, quality) {
        const inputName = `input.${file.name.split('.').pop()}`;
        const outputName = `output.${outputFormat}`;

        await this.ffmpeg.writeFile(inputName, await this.fetchFile(file));

        const commands = {
            avif: ['-i', inputName, '-c:v', 'libaom-av1', '-crf', quality, '-strict', 'experimental', outputName],
            webp: ['-i', inputName, '-c:v', 'libwebp', '-quality', quality, outputName],
            jpeg: ['-i', inputName, '-c:v', 'mjpeg', '-q:v', Math.floor(quality/10), outputName],
            png: ['-i', inputName, '-c:v', 'png', outputName]
        };

        await this.ffmpeg.exec(commands[outputFormat] || commands.webp);
        const data = await this.ffmpeg.readFile(outputName);
        
        return new Blob([data.buffer], { 
            type: outputFormat === 'avif' ? 'image/avif' : 
                  outputFormat === 'webp' ? 'image/webp' : 
                  outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
        });
    }

    async fetchFile(file) {
        return new Uint8Array(await file.arrayBuffer());
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
    converter = new ModernConverter();
});