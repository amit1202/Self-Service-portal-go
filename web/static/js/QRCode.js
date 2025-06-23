/**
 * QR Manager - Complete QR Code Generation Solution
 * Handles library loading, multiple fallbacks, and error handling
 */

class QRManager {
    constructor() {
        this.libraryLoaded = false;
        this.loadingPromise = null;
        this.fallbackMethods = [
            'qrcodejs',
            'googleCharts',
            'qrServer',
            'canvas'
        ];
    }

    /**
     * Initialize QR Manager and load required libraries
     */
    async initialize() {
        if (this.libraryLoaded) {
            return Promise.resolve();
        }

        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = this.loadQRLibrary();
        return this.loadingPromise;
    }

    /**
     * Load QRCode.js library from CDN with multiple fallbacks
     */
    loadQRLibrary() {
        return new Promise((resolve, reject) => {
            // Check if already available
            if (typeof QRCode !== 'undefined') {
                console.log('✅ QRCode library already available');
                this.libraryLoaded = true;
                resolve();
                return;
            }

            console.log('🔄 Loading QRCode library...');

            const cdnUrls = [
                'https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js',
                'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
                'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js'
            ];

            let currentIndex = 0;

            const tryLoadScript = () => {
                if (currentIndex >= cdnUrls.length) {
                    console.log('❌ All CDN URLs failed, will use image-based fallbacks');
                    this.libraryLoaded = false;
                    resolve(); // Still resolve, we have fallbacks
                    return;
                }

                const script = document.createElement('script');
                script.src = cdnUrls[currentIndex];
                script.async = true;

                script.onload = () => {
                    if (typeof QRCode !== 'undefined') {
                        console.log(`✅ QRCode library loaded from: ${cdnUrls[currentIndex]}`);
                        this.libraryLoaded = true;
                        resolve();
                    } else {
                        console.log(`⚠️ Script loaded but QRCode not available from: ${cdnUrls[currentIndex]}`);
                        currentIndex++;
                        tryLoadScript();
                    }
                };

                script.onerror = () => {
                    console.log(`❌ Failed to load from: ${cdnUrls[currentIndex]}`);
                    currentIndex++;
                    tryLoadScript();
                };

                document.head.appendChild(script);
            };

            tryLoadScript();

            // Timeout after 15 seconds
            setTimeout(() => {
                if (!this.libraryLoaded) {
                    console.log('⏰ Library loading timeout, using fallbacks');
                    resolve(); // Still resolve, we have fallbacks
                }
            }, 15000);
        });
    }

    /**
     * Generate QR code with automatic fallback methods
     */
    async generateQR(data, options = {}) {
        const config = {
            size: 300,
            margin: 4,
            errorCorrectionLevel: 'H',
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            ...options
        };

        console.log('🔄 Starting QR generation with data:', data.substring(0, 100) + '...');

        // Ensure library is initialized
        await this.initialize();

        // Try each method in order
        for (const method of this.fallbackMethods) {
            try {
                console.log(`🔄 Trying method: ${method}`);
                const result = await this.tryMethod(method, data, config);
                if (result) {
                    console.log(`✅ QR generated successfully with method: ${method}`);
                    return result;
                }
            } catch (error) {
                console.log(`❌ Method ${method} failed:`, error.message);
            }
        }

        throw new Error('All QR generation methods failed');
    }

    /**
     * Try a specific QR generation method
     */
    async tryMethod(method, data, config) {
        switch (method) {
            case 'qrcodejs':
                return this.generateWithQRCodeJS(data, config);
            case 'googleCharts':
                return this.generateWithGoogleCharts(data, config);
            case 'qrServer':
                return this.generateWithQRServer(data, config);
            case 'canvas':
                return this.generateWithCanvas(data, config);
            default:
                throw new Error(`Unknown method: ${method}`);
        }
    }

    /**
     * Generate QR using QRCode.js library
     */
    generateWithQRCodeJS(data, config) {
        return new Promise((resolve, reject) => {
            if (typeof QRCode === 'undefined') {
                reject(new Error('QRCode library not available'));
                return;
            }

            try {
                QRCode.toCanvas(data, {
                    width: config.size,
                    height: config.size,
                    margin: config.margin,
                    color: config.color,
                    errorCorrectionLevel: config.errorCorrectionLevel
                }, (error, canvas) => {
                    if (error) {
                        reject(error);
                    } else {
                        // Style the canvas
                        canvas.style.cssText = `
                            width: ${config.size}px; 
                            height: ${config.size}px; 
                            border: 2px solid #fff; 
                            border-radius: 8px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                            image-rendering: pixelated;
                            image-rendering: -webkit-crisp-edges;
                            image-rendering: crisp-edges;
                        `;
                        resolve({ element: canvas, method: 'qrcodejs' });
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Generate QR using Google Charts API
     */
    generateWithGoogleCharts(data, config) {
        return new Promise((resolve, reject) => {
            const encodedData = encodeURIComponent(data);
            const errorLevel = config.errorCorrectionLevel || 'H';
            const url = `https://chart.googleapis.com/chart?chs=${config.size}x${config.size}&cht=qr&chl=${encodedData}&choe=UTF-8&chld=${errorLevel}|${config.margin}`;

            const img = new Image();
            img.crossOrigin = 'anonymous';

            let resolved = false;

            img.onload = () => {
                if (resolved) return;
                resolved = true;

                img.style.cssText = `
                    width: ${config.size}px; 
                    height: ${config.size}px; 
                    border: 2px solid #fff; 
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    image-rendering: pixelated;
                    image-rendering: -webkit-crisp-edges;
                    image-rendering: crisp-edges;
                `;

                resolve({ element: img, method: 'googleCharts', url });
            };

            img.onerror = () => {
                if (resolved) return;
                resolved = true;
                reject(new Error('Google Charts API failed'));
            };

            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error('Google Charts API timeout'));
                }
            }, 8000);

            img.src = url;
        });
    }

    /**
     * Generate QR using QR-Server API
     */
    generateWithQRServer(data, config) {
        return new Promise((resolve, reject) => {
            const encodedData = encodeURIComponent(data);
            const errorLevel = config.errorCorrectionLevel || 'H';
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=${config.size}x${config.size}&data=${encodedData}&ecc=${errorLevel}&margin=${config.margin}`;

            const img = new Image();
            img.crossOrigin = 'anonymous';

            let resolved = false;

            img.onload = () => {
                if (resolved) return;
                resolved = true;

                img.style.cssText = `
                    width: ${config.size}px; 
                    height: ${config.size}px; 
                    border: 2px solid #fff; 
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    image-rendering: pixelated;
                    image-rendering: -webkit-crisp-edges;
                    image-rendering: crisp-edges;
                `;

                resolve({ element: img, method: 'qrServer', url });
            };

            img.onerror = () => {
                if (resolved) return;
                resolved = true;
                reject(new Error('QR-Server API failed'));
            };

            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error('QR-Server API timeout'));
                }
            }, 8000);

            img.src = url;
        });
    }

    /**
     * Generate simple QR pattern using Canvas (last resort)
     */
    generateWithCanvas(data, config) {
        return new Promise((resolve, reject) => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = config.size;
                canvas.height = config.size;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    throw new Error('Canvas not supported');
                }

                // White background
                ctx.fillStyle = config.color.light;
                ctx.fillRect(0, 0, config.size, config.size);

                // Create a simple pattern to indicate QR code placeholder
                ctx.fillStyle = config.color.dark;
                
                // Border
                const borderWidth = Math.floor(config.size * 0.05);
                ctx.fillRect(0, 0, config.size, borderWidth);
                ctx.fillRect(0, 0, borderWidth, config.size);
                ctx.fillRect(config.size - borderWidth, 0, borderWidth, config.size);
                ctx.fillRect(0, config.size - borderWidth, config.size, borderWidth);

                // Corner markers
                const markerSize = Math.floor(config.size * 0.15);
                this.drawCornerMarker(ctx, borderWidth * 2, borderWidth * 2, markerSize, config.color);
                this.drawCornerMarker(ctx, config.size - markerSize - borderWidth * 2, borderWidth * 2, markerSize, config.color);
                this.drawCornerMarker(ctx, borderWidth * 2, config.size - markerSize - borderWidth * 2, markerSize, config.color);

                // Central pattern
                const centerSize = Math.floor(config.size * 0.1);
                const centerX = (config.size - centerSize) / 2;
                const centerY = (config.size - centerSize) / 2;
                ctx.fillRect(centerX, centerY, centerSize, centerSize);

                // Style canvas
                canvas.style.cssText = `
                    width: ${config.size}px; 
                    height: ${config.size}px; 
                    border: 2px solid #fff; 
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    image-rendering: pixelated;
                    image-rendering: -webkit-crisp-edges;
                    image-rendering: crisp-edges;
                `;

                resolve({ 
                    element: canvas, 
                    method: 'canvas', 
                    isPlaceholder: true,
                    warning: 'This is a placeholder pattern, not a functional QR code'
                });

            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Draw corner marker for canvas QR placeholder
     */
    drawCornerMarker(ctx, x, y, size, colors) {
        // Outer square
        ctx.fillStyle = colors.dark;
        ctx.fillRect(x, y, size, size);
        
        // Inner white
        const innerPadding = Math.floor(size * 0.15);
        ctx.fillStyle = colors.light;
        ctx.fillRect(x + innerPadding, y + innerPadding, size - 2 * innerPadding, size - 2 * innerPadding);
        
        // Center square
        const centerPadding = Math.floor(size * 0.35);
        ctx.fillStyle = colors.dark;
        ctx.fillRect(x + centerPadding, y + centerPadding, size - 2 * centerPadding, size - 2 * centerPadding);
    }
}

// Create global QR manager instance
const qrManager = new QRManager();

// Enhanced QR generation function for your existing code
async function displayQRCodeFixed(qrData, invitationId, response = {}) {
    console.log('=== QR Manager Display ===');
    console.log('QR Data:', qrData);
    console.log('Invitation ID:', invitationId);
    
    if (!qrData || qrData.trim() === '') {
        console.error('❌ No QR data provided');
        showQRError('No QR data received from server', qrData, invitationId, response);
        return;
    }

    // Clear previous QR code
    $('#qrcode').empty();
    
    // Create container
    const qrContainer = $(`
        <div class="text-center">
            <div class="qr-container-optimized d-inline-block p-4 bg-white rounded shadow-sm border">
                <div id="qr-display-area" class="qr-generation-area">
                    <div class="qr-loading text-center p-4">
                        <div class="spinner-border text-primary mb-3" role="status"></div>
                        <div>Initializing QR generation...</div>
                        <small class="text-muted">Loading libraries and testing methods...</small>
                    </div>
                </div>
            </div>
            <div class="qr-info mt-3"></div>
        </div>
    `);
    
    $('#qrcode').html(qrContainer);

    try {
        // Generate QR code using QR Manager
        const result = await qrManager.generateQR(qrData, {
            size: 300,
            margin: 4,
            errorCorrectionLevel: 'H'
        });

        // Clear loading and display QR code
        $('#qr-display-area').empty().append(result.element);

        // Show warning if it's a placeholder
        if (result.isPlaceholder) {
            $('#qr-display-area').append(`
                <div class="alert alert-warning mt-2 small">
                    <i class="bi bi-exclamation-triangle me-1"></i>
                    ${result.warning}
                </div>
            `);
        }

        // Success handlers
        onQRGenerationSuccess(invitationId, response);
        
        console.log(`✅ QR code displayed using method: ${result.method}`);

    } catch (error) {
        console.error('❌ All QR generation methods failed:', error);
        showQRError('All QR generation methods failed', qrData, invitationId, response);
    }
}

// Quick test functions
window.testQRManager = async function() {
    console.log('=== Testing QR Manager ===');
    
    const testData = 'https://portal.example.com/enroll?id=test123';
    console.log('Testing with:', testData);
    
    try {
        await displayQRCodeFixed(testData, 'test-123', { test_mode: true });
    } catch (error) {
        console.error('Test failed:', error);
    }
};

window.testQRManagerWithReal = async function() {
    console.log('=== Testing QR Manager with Real Data ===');
    
    const invitationId = "018fc8bbcD5SLtUzkD33ykrzXpYaEYGWbw1ksgukLVNGniSpQhQR6p6tcSo5WNDqq21bPjeU";
    const enrollmentUrl = `https://amitmt.doubleoctopus.io/enroll?invitation=${invitationId}`;
    
    try {
        await displayQRCodeFixed(enrollmentUrl, invitationId, {
            invitation_id: invitationId,
            enrollment_url: enrollmentUrl
        });
    } catch (error) {
        console.error('Test failed:', error);
    }
};

// Make QR Manager available globally
window.qrManager = qrManager;

console.log('🚀 QR Manager loaded successfully!');
console.log('📋 Available test functions:');
console.log('- testQRManager() - Test with sample data');
console.log('- testQRManagerWithReal() - Test with real invitation data');
console.log('- qrManager.generateQR(data) - Direct QR generation');