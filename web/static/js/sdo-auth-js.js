// SDO Authentication and QR Code Management - FIXED QR Generation
let isAuthenticated = false;
let authToken = null;
let invitationsSent = 0;
let qrCodesGenerated = 0;
let usersFound = 0;
var sdoEnrollmentStarted = false;

// Enrollment tracking
let enrollmentCompleted = {
    octopus: false,
    fido: false
};

// Test invitation ID from the user
const TEST_INVITATION_ID = "018fc8bbcD5SLtUzkD33ykrzXpYaEYGWbw1ksgukLVNGniSpQhQR6p6tcSo5WNDqq21bPjeU";

$(document).ready(function() {
    console.log('🚀 Dashboard with FIXED QR Loading');
    
    // Check initial library status
    const libraryStatus = checkLibraryStatus();
    console.log('📋 Initial library status:', libraryStatus);
    
    // Wait for QRCode.js to be ready
    const maxWaitTime = 10000; // 10 seconds
    const checkInterval = 500;
    let waitTime = 0;
    
    const waitForQRCode = () => {
        if (typeof QRCode !== 'undefined') {
            console.log('✅ QRCode.js is ready!');
            // Safely call updateLibraryStatus if it exists
            if (typeof updateLibraryStatus === 'function') {
                updateLibraryStatus();
            } else {
                console.log('⚠️ updateLibraryStatus function not available, skipping...');
            }
            updateQRTestButtons(true);
            
            // If authenticated, generate QR
            if (isAuthenticated) {
                setTimeout(() => generateQRCode(), 1000);
            }
            return;
        }
        
        waitTime += checkInterval;
        if (waitTime < maxWaitTime) {
            setTimeout(waitForQRCode, checkInterval);
        } else {
            console.log('⚠️ QRCode.js loading timeout, using fallback methods');
            // Safely call updateLibraryStatus if it exists
            if (typeof updateLibraryStatus === 'function') {
                updateLibraryStatus();
            } else {
                console.log('⚠️ updateLibraryStatus function not available, skipping...');
            }
        }
    };
    
    // Start waiting for QRCode.js
    setTimeout(waitForQRCode, 1000);
    
    // Setup event handlers and other initialization
    setupEventHandlers();
    loadStoredConfiguration();
    addQRRefreshButton();
    checkRequiredElements();
    
    // Check auth status after delay
    setTimeout(() => {
        if (typeof checkAuthStatus === 'function') {
            checkAuthStatus();
        }
    }, 2000);
});

// Add the missing updateLibraryStatus function
function updateLibraryStatus() {
    console.log('📚 Updating library status...');
    
    // Update UI if library status element exists
    if ($('#library-status').length > 0) {
        const qrAvailable = typeof QRCode !== 'undefined';
        const jqueryAvailable = typeof $ !== 'undefined';
        const bootstrapAvailable = typeof bootstrap !== 'undefined';
        
        $('#library-status').html(
            'jQuery: ' + (jqueryAvailable ? '✅' : '❌') + '<br>' +
            'QRCode.js: ' + (qrAvailable ? '✅' : '❌') + '<br>' +
            'Bootstrap: ' + (bootstrapAvailable ? '✅' : '❌') + '<br>' +
            '<small class="text-muted">Ready: ' + (window.qrCodeLibraryReady ? '✅' : '❌') + '</small>'
        );
    }
    
    // Update test buttons based on QRCode availability
    updateQRTestButtons(typeof QRCode !== 'undefined');
    
    return {
        jquery: typeof $ !== 'undefined',
        bootstrap: typeof bootstrap !== 'undefined',
        qrcode: typeof QRCode !== 'undefined',
        ready: window.qrCodeLibraryReady
    };
}

function checkLibraryStatus() {
    console.log('=== Library Status Check ===');
    console.log('jQuery available:', typeof $ !== 'undefined');
    console.log('Bootstrap available:', typeof bootstrap !== 'undefined');
    console.log('QRCode.js available:', typeof QRCode !== 'undefined');
    console.log('QRCode ready flag:', window.qrCodeLibraryReady);
    console.log('QRCode loading failed:', window.qrCodeLoadingFailed);
    
    // Update UI if library status element exists
    if ($('#library-status').length > 0) {
        const qrAvailable = typeof QRCode !== 'undefined';
        const jqueryAvailable = typeof $ !== 'undefined';
        const bootstrapAvailable = typeof bootstrap !== 'undefined';
        
        $('#library-status').html(
            'jQuery: ' + (jqueryAvailable ? '✅' : '❌') + '<br>' +
            'QRCode.js: ' + (qrAvailable ? '✅' : '❌') + '<br>' +
            'Bootstrap: ' + (bootstrapAvailable ? '✅' : '❌') + '<br>' +
            '<small class="text-muted">Ready: ' + (window.qrCodeLibraryReady ? '✅' : '❌') + '</small>'
        );
    }
    
    // Update test buttons based on QRCode availability
    updateQRTestButtons(typeof QRCode !== 'undefined');
    
    return {
        jquery: typeof $ !== 'undefined',
        bootstrap: typeof bootstrap !== 'undefined',
        qrcode: typeof QRCode !== 'undefined',
        ready: window.qrCodeLibraryReady
    };
}

// Update test button states
function updateQRTestButtons(qrCodeAvailable) {
    const testButtons = $('[onclick*="testDirectQR"], [onclick*="generateTestQRCode"]');
    
    testButtons.each(function() {
        const $btn = $(this);
        if (qrCodeAvailable) {
            $btn.prop('disabled', false);
            if ($btn.text().includes('Missing') || $btn.text().includes('Loading')) {
                $btn.html('<i class="bi bi-lightning me-1"></i>Direct QR Test');
            }
        } else {
            $btn.prop('disabled', true);
            $btn.html('<i class="bi bi-hourglass-split me-1"></i>Loading QRCode.js...');
        }
    });
}

function loadQRCodeLibraryDynamic() {
    console.log('🔄 Loading QRCode.js library dynamically...');
    
    const libraries = [
        'https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js',
        'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
        'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js'
    ];
    
    let currentIndex = 0;
    
    function tryLoadScript() {
        if (currentIndex >= libraries.length) {
            console.log('❌ All QRCode.js CDN URLs failed');
            showAlert('Failed to load QRCode.js library. QR generation will use fallback methods.', 'warning');
            return;
        }
        
        const script = document.createElement('script');
        script.src = libraries[currentIndex];
        
        script.onload = () => {
            if (typeof QRCode !== 'undefined') {
                console.log(`✅ QRCode.js loaded successfully from: ${libraries[currentIndex]}`);
                showAlert('QRCode.js library loaded successfully!', 'success');
                checkLibraryStatus(); // Update status
            } else {
                console.log(`⚠️ Script loaded but QRCode not available from: ${libraries[currentIndex]}`);
                currentIndex++;
                tryLoadScript();
            }
        };
        
        script.onerror = () => {
            console.log(`❌ Failed to load from: ${libraries[currentIndex]}`);
            currentIndex++;
            tryLoadScript();
        };
        
        document.head.appendChild(script);
    }
    
    tryLoadScript();
}

function displayQRCodeFixed(qrData, invitationId, response = {}) {
    console.log('=== QR Code Display ===');
    console.log('QR Data:', qrData);
    console.log('Invitation ID:', invitationId);
    console.log('QRCode.js available:', typeof QRCode !== 'undefined');
    
    if (!qrData || qrData.trim() === '') {
        console.error('❌ No QR data provided');
        showQRError('No QR data received from server', qrData, invitationId, response);
        return;
    }

    // Clear and setup container
    $('#qrcode').html(`
        <div class="text-center">
            <div class="qr-container-optimized d-inline-block p-4 bg-white rounded shadow-sm border">
                <div id="qr-display-area">
                    <div class="qr-loading text-center p-4">
                        <div class="spinner-border text-primary mb-3" role="status"></div>
                        <div>Generating QR code...</div>
                        <small class="text-muted">Checking available methods...</small>
                    </div>
                </div>
            </div>
            <div class="qr-info mt-3"></div>
        </div>
    `);

    // Try QRCode.js first - with additional verification
    if (typeof QRCode !== 'undefined' && typeof QRCode.toCanvas === 'function') {
        try {
            console.log('✅ Using QRCode.js library');
            
            $('#qr-display-area .qr-loading div:nth-child(2)').text('Generating with QRCode.js...');
            
            QRCode.toCanvas(qrData, {
                width: 300,
                height: 300,
                margin: 4,
                color: { dark: '#000000', light: '#FFFFFF' },
                errorCorrectionLevel: 'H'
            }, (error, canvas) => {
                if (error) {
                    console.error('QRCode.js generation failed:', error);
                    tryImageFallback(qrData, invitationId, response);
                } else {
                    console.log('✅ QR Generated successfully with QRCode.js!');
                    
                    // Apply optimized styling
                    canvas.style.cssText = `
                        width: 300px; 
                        height: 300px; 
                        border: 2px solid #fff; 
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                        image-rendering: pixelated;
                        image-rendering: -webkit-crisp-edges;
                        image-rendering: crisp-edges;
                        background: white;
                        display: block;
                        margin: 0 auto;
                    `;
                    
                    $('#qr-display-area').html('').append(canvas);
                    onQRGenerationSuccess(invitationId, response);
                    addScanningGuides();
                }
            });
            return;
        } catch (err) {
            console.error('QRCode.js exception:', err);
        }
    }

    console.log('⚠️ QRCode.js not available or not functional, trying image fallback...');
    $('#qr-display-area .qr-loading div:nth-child(2)').text('Trying image-based generation...');
    tryImageFallback(qrData, invitationId, response);
}

// FIXED: Enhanced image fallback method with multiple services
function tryImageFallback(qrData, invitationId, response) {
    console.log('🔄 Trying image-based QR generation...');
    
    const encodedData = encodeURIComponent(qrData);
    const googleChartsUrl = `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodedData}&choe=UTF-8&chld=H|4`;
    
    console.log('Google Charts URL:', googleChartsUrl);
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    let imageLoaded = false;
    
    img.onload = function() {
        if (imageLoaded) return;
        imageLoaded = true;
        
        console.log('✅ QR Generated successfully with Google Charts!');
        
        // Apply optimized styling
        img.style.cssText = `
            width: 300px; 
            height: 300px; 
            border: 2px solid #fff; 
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            image-rendering: pixelated;
            image-rendering: -webkit-crisp-edges;
            image-rendering: crisp-edges;
            background: white;
            display: block;
            margin: 0 auto;
        `;
        
        $('#qr-display-area').html('').append(img);
        onQRGenerationSuccess(invitationId, response);
        
        // Add scanning guides
        addScanningGuides();
    };
    
    img.onerror = function() {
        if (imageLoaded) return;
        imageLoaded = true;
        
        console.log('❌ Google Charts failed, trying QR-Server...');
        tryQRServerAPI(qrData, invitationId, response);
    };
    
    // Timeout fallback
    setTimeout(() => {
        if (!imageLoaded) {
            imageLoaded = true;
            console.log('⏰ Google Charts timeout, trying QR-Server...');
            tryQRServerAPI(qrData, invitationId, response);
        }
    }, 10000);
    
    img.src = googleChartsUrl;
}


// FIXED: Enhanced error display with better manual options
function showQRError(errorMessage, qrData, invitationId, response) {
    console.log('=== Showing QR Error ===');
    console.log('Error:', errorMessage);
    
    const errorHTML = `
        <div class="qr-error-container p-4 border rounded bg-light">
            <div class="text-center mb-3">
                <i class="bi bi-exclamation-triangle text-warning" style="font-size: 2rem;"></i>
                <h6 class="mt-2 text-danger">QR Code Generation Failed</h6>
                <small class="text-muted">${errorMessage}</small>
            </div>
            
            <div class="alert alert-info">
                <strong><i class="bi bi-info-circle me-2"></i>Manual Enrollment Options:</strong>
                <div class="mt-3 d-grid gap-2">
                    <button class="btn btn-primary" onclick="copyToClipboard('${qrData}')">
                        <i class="bi bi-clipboard me-2"></i>Copy Enrollment Data
                    </button>
                    <a href="${qrData}" target="_blank" class="btn btn-outline-primary">
                        <i class="bi bi-box-arrow-up-right me-2"></i>Open Enrollment Link
                    </a>
                    <button class="btn btn-outline-secondary" onclick="generateQRCode()">
                        <i class="bi bi-arrow-clockwise me-2"></i>Try QR Again
                    </button>
                    <button class="btn btn-outline-info" onclick="checkLibraryStatus()">
                        <i class="bi bi-gear me-2"></i>Check Libraries
                    </button>
                    <button class="btn btn-outline-success" onclick="testDirectQR()">
                        <i class="bi bi-lightning me-2"></i>Direct Test
                    </button>
                </div>
            </div>
            
            <details class="mt-3">
                <summary class="text-muted" style="cursor: pointer;">
                    <i class="bi bi-code me-1"></i>Show Raw Enrollment Data
                </summary>
                <div class="mt-2 p-3 bg-white border rounded" style="
                    word-break: break-all; 
                    font-family: 'Courier New', monospace; 
                    font-size: 0.75em; 
                    max-height: 150px; 
                    overflow-y: auto;
                    line-height: 1.4;
                ">
                    ${qrData}
                </div>
            </details>
        </div>
    `;
    
    $('#qr-display-area').html(errorHTML);
    
    // Still show invitation info even on error
    displayQRInfo(invitationId, response);
}

// FIXED: Add visual guides for optimal scanning
function addScanningGuides() {
    if ($('#scanning-guides').length > 0) {
        return; // Already added
    }
    
    const guidesHTML = `
        <div id="scanning-guides" class="mt-3">
            <div class="row text-center">
                <div class="col-4">
                    <div class="scan-tip">
                        <i class="bi bi-phone text-primary" style="font-size: 1.5rem;"></i>
                        <br><small class="text-muted">6-12 inches<br>away</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="scan-tip">
                        <i class="bi bi-brightness-high text-warning" style="font-size: 1.5rem;"></i>
                        <br><small class="text-muted">Good<br>lighting</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="scan-tip">
                        <i class="bi bi-fullscreen text-success" style="font-size: 1.5rem;"></i>
                        <br><small class="text-muted">Center in<br>frame</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('.qr-container-optimized').after(guidesHTML);
}

// Success handler for QR generation
function onQRGenerationSuccess(invitationId, response) {
    console.log('✅ QR Code generation successful');
    
    // Display info
    displayQRInfo(invitationId, response);
    
    // Add instructions
    addQRInstructions();
    
    // Track generation
    trackQRGeneration();
    
    // Update stats
    qrCodesGenerated++;
    updateStats();
}

// FIXED: Copy to clipboard with better error handling
function copyToClipboard(text) {
    console.log('Copying to clipboard:', text.substring(0, 100) + '...');
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showAlert('✅ Enrollment data copied to clipboard!', 'success');
            console.log('✅ Clipboard copy successful');
        }).catch((err) => {
            console.error('❌ Clipboard copy failed:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

// Fallback copy method for older browsers
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showAlert('✅ Enrollment data copied to clipboard!', 'success');
            console.log('✅ Fallback copy successful');
        } else {
            throw new Error('execCommand failed');
        }
    } catch (err) {
        console.error('❌ Fallback copy failed:', err);
        showAlert('❌ Failed to copy. Please copy the data manually.', 'warning');
        
        // Select the text for manual copying
        textArea.style.opacity = '1';
        textArea.style.position = 'static';
        textArea.style.left = 'auto';
        textArea.style.width = '100%';
        textArea.style.height = '100px';
        textArea.select();
    }
    
    // Clean up after a delay
    setTimeout(() => {
        if (document.body.contains(textArea)) {
            document.body.removeChild(textArea);
        }
    }, 1000);
}

// INCLUDE ALL OTHER EXISTING FUNCTIONS FROM YOUR ORIGINAL FILE...
// (I'm keeping this shorter to focus on the QR fixes, but you should include all your other functions)

function setupEventHandlers() {
    // SDO Authentication Form
    $('#sdo-login-form').on('submit', function(e) {
        e.preventDefault();
        authenticateSDO();
    });
    
    // User Search Form
    $('#user-search-form').on('submit', function(e) {
        e.preventDefault();
        searchUsers();
    });
    
    // Send Invitation Button
    $('#send-invitation-btn').on('click', function() {
        sendInvitation();
    });
    
    // Auto-generate QR code when authenticated
    $(document).on('authStatusChanged', function() {
        if (isAuthenticated) {
            setTimeout(verifyAuthAndGenerateQR, 2000); // Use verification function
        }
    });
}

// Enhanced auth status checking with better error handling
function checkAuthStatus() {
    console.log('=== Checking SDO Authentication Status ===');
    
    // Check if we have a stored token first
    const storedToken = sessionStorage.getItem('sdo_auth_token');
    const authTime = sessionStorage.getItem('sdo_auth_time');
    
    if (storedToken && authTime) {
        const timeDiff = Date.now() - parseInt(authTime);
        const oneHour = 60 * 60 * 1000;
        
        if (timeDiff > oneHour) {
            console.log('⚠️ Stored token is old (>1 hour), clearing...');
            sessionStorage.removeItem('sdo_auth_token');
            sessionStorage.removeItem('sdo_auth_time');
        } else {
            console.log('✅ Found recent stored token, configuring requests...');
            authToken = storedToken;
            configureAuthHeaders();
        }
    }
    
    $.ajax({
        url: '/api/sdo/status',
        method: 'GET',
        timeout: 10000,
        success: function(response) {
            console.log('Auth status response:', response);
            
            if (response.authenticated) {
                console.log('✅ Server confirms authentication');
                isAuthenticated = true;
                handleAuthSuccess(response);
            } else {
                console.log('❌ Server says not authenticated');
                isAuthenticated = false;
                handleAuthStatusNotAuthenticated();
            }
        },
        error: function(xhr, status, error) {
            console.log('Auth status check failed:', {
                status: xhr.status,
                statusText: xhr.statusText,
                responseText: xhr.responseText,
                error: error
            });
            
            // Don't treat this as a hard failure since it might be a network issue
            console.log('⚠️ Could not verify auth status, assuming not authenticated');
            isAuthenticated = false;
            updateAuthStatus(false);
        }
    });
}

// Handle when status check returns not authenticated
function handleAuthStatusNotAuthenticated() {
    updateAuthStatus(false);
    // Don't show an error alert on page load, just update status
    $('#qrcode').empty();
    $('#invitation-id').empty();
}

// Enhanced authentication function with better error handling
function authenticateSDO() {
    const url = $('#sdo-url').val().trim();
    const email = $('#sdo-email').val().trim();
    const password = $('#sdo-password').val();
    
    if (!url || !email || !password) {
        showAlert('Please fill in all fields', 'warning');
        return;
    }
    
    // Validate URL format
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showAlert('SDO URL must start with http:// or https://', 'warning');
        return;
    }
    
    console.log('=== Starting SDO Authentication ===');
    console.log('URL:', url);
    console.log('Email:', email);
    
    // Clear any existing auth state
    clearAuthState();
    
    // Show loading state
    const submitBtn = $('#sdo-login-form button[type="submit"]');
    const originalText = submitBtn.html();
    submitBtn.html('<i class="bi bi-hourglass-split me-2"></i>Authenticating...').prop('disabled', true);
    
    // Clear any existing QR code
    $('#qrcode').empty();
    $('#invitation-id').empty();
    
    $.ajax({
        url: '/api/sdo/auth',  // CHANGED: Match the Go handler endpoint
        method: 'POST',
        contentType: 'application/json',
        timeout: 15000,
        data: JSON.stringify({
            url: url,      // This matches the Go struct field names
            email: email,
            password: password
        }),
        success: function(response) {
            console.log('=== Authentication Response SUCCESS ===');
            console.log('Response:', response);
            
            if (response.success) {
                handleAuthSuccess(response);
            } else {
                console.log('❌ Success=false in response');
                handleAuthFailure(response.error || 'Authentication failed - success=false');
            }
        },
        error: function(xhr, status, error) {
            console.log('=== Authentication Response ERROR ===');
            console.log('Status:', xhr.status);
            console.log('Status Text:', xhr.statusText);
            console.log('Response Text:', xhr.responseText);
            console.log('Error:', error);
            
            let errorMessage = 'Authentication failed';
            
            try {
                const response = JSON.parse(xhr.responseText);
                errorMessage = response.error || response.message || errorMessage;
            } catch (e) {
                // Use status-based error messages
                if (xhr.status === 401) {
                    errorMessage = 'Invalid credentials';
                } else if (xhr.status === 403) {
                    errorMessage = 'Access forbidden';
                } else if (xhr.status === 404) {
                    errorMessage = 'SDO server not found at this URL';
                } else if (xhr.status === 500) {
                    errorMessage = 'Server error during authentication';
                } else if (xhr.status === 0) {
                    errorMessage = 'Cannot connect to SDO server. Check the URL and network connection.';
                } else {
                    errorMessage = `Authentication failed (${xhr.status}): ${error}`;
                }
            }
            
            handleAuthFailure(errorMessage);
        },
        complete: function() {
            // Restore button state
            submitBtn.html(originalText).prop('disabled', false);
            console.log('=== Authentication Request Complete ===');
        }
    });
}


// Enhanced authentication success handler with better session management
function handleAuthSuccess(response) {
    console.log('=== Authentication Success Handler ===');
    console.log('Full response:', response);
    
    // Set authentication state
    isAuthenticated = true;
    
    // The Go handler uses session-based auth, so no token in response
    authToken = null;
    
    // Update UI immediately
    updateAuthStatus(true, response);
    
    // Clear password for security
    $('#sdo-password').val('');
    
    // Show success message with details from Go response
    const successMessage = response.message || 'Successfully authenticated with SDO!';
    showAlert(successMessage, 'success');
    
    // Store authentication info for client-side reference
    if (response.base_url) {
        sessionStorage.setItem('sdo_base_url', response.base_url);
    }
    if (response.session_info) {
        sessionStorage.setItem('sdo_session_info', JSON.stringify(response.session_info));
    }
    sessionStorage.setItem('sdo_auth_time', Date.now().toString());
    
    // Wait a bit before triggering dependent operations
    console.log('⏳ Waiting 2 seconds before triggering QR generation...');
    setTimeout(() => {
        console.log('🎯 Triggering post-auth operations...');
        $(document).trigger('authStatusChanged');
        
        // Automatically generate QR code after successful authentication
        setTimeout(() => {
            if (typeof generateQRCode === 'function') {
                generateQRCode();
            }
        }, 1000);
    }, 2000);
}

// Configure authentication headers for all AJAX requests
function configureAuthHeaders() {
    if (authToken) {
        $.ajaxSetup({
            beforeSend: function(xhr) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
            }
        });
    }
}

// Clear all authentication state
function clearAuthState() {
    isAuthenticated = false;
    authToken = null;
    sessionStorage.removeItem('sdo_base_url');
    sessionStorage.removeItem('sdo_session_info');
    sessionStorage.removeItem('sdo_auth_time');
    
    // Since we're using session-based auth, no need to clear JWT headers
    console.log('🧹 Cleared authentication state');
}

// New function to verify auth status before QR generation
function verifyAuthAndGenerateQR() {
    console.log('=== Verifying Auth Before QR Generation ===');
    
    $.ajax({
        url: '/api/sdo/status',
        method: 'GET',
        timeout: 5000,
        success: function(response) {
            console.log('Auth verification response:', response);
            
            if (response.authenticated) {
                console.log('✅ Auth verified, proceeding with QR generation');
                $('#qrcode').html('<div class="text-center text-muted"><i class="bi bi-hourglass-split"></i> Generating QR code...</div>');
                
                // Add small delay to ensure UI is ready
                setTimeout(() => {
                    generateQRCode();
                }, 500);
            } else {
                console.log('❌ Auth verification failed after successful login');
                handleAuthVerificationFailure();
            }
        },
        error: function(xhr, status, error) {
            console.log('❌ Auth verification request failed:', xhr.responseText);
            
            if (xhr.status === 401) {
                handleAuthVerificationFailure();
            } else {
                // Network error, try QR generation anyway
                console.log('⚠️ Network error during verification, attempting QR generation...');
                generateQRCode();
            }
        }
    });
}

// Handle auth verification failure
function handleAuthVerificationFailure() {
    console.log('=== Handling Auth Verification Failure ===');
    
    showAlert('Authentication verification failed. Please try logging in again.', 'warning');
    
    // Reset auth state
    clearAuthState();
    updateAuthStatus(false);
    
    // Clear QR code
    $('#qrcode').empty();
    $('#invitation-id').empty();
}

// Enhanced auth failure handler
function handleAuthFailure(errorMessage) {
    console.log('=== Handling Auth Failure ===');
    console.log('Error:', errorMessage);
    
    // Reset auth state
    clearAuthState();
    
    // Update UI
    updateAuthStatus(false);
    
    // Show error with more context
    showAlert(`Authentication failed: ${errorMessage}`, 'danger');
    
    // Clear QR code and related elements
    $('#qrcode').empty();
    $('#invitation-id').empty();
    
    // Focus back to form for retry
    $('#sdo-email').focus();
}

function updateAuthStatus(authenticated, authData = null) {
    const statusBadge = $('#auth-status-badge');
    
    if (authenticated) {
        statusBadge
            .removeClass('bg-warning bg-danger')
            .addClass('bg-success')
            .html('<i class="bi bi-check-circle me-1"></i>Authenticated');
            
        if (authData && authData.base_url) {
            statusBadge.attr('title', `Connected to: ${authData.base_url}`);
        }
    } else {
        statusBadge
            .removeClass('bg-success bg-danger')
            .addClass('bg-warning')
            .html('<i class="bi bi-exclamation-triangle me-1"></i>Not Authenticated');
    }
}

// Enhanced user search with better error handling and display
function searchUsers() {
    if (!isAuthenticated) {
        showAlert('Please authenticate with SDO first', 'warning');
        return;
    }
    
    const searchTerm = $('#user-search-input').val().trim();
    
    if (searchTerm.length < 2) {
        showAlert('Please enter at least 2 characters to search', 'warning');
        return;
    }
    
    console.log('=== Starting User Search ===');
    console.log('Search term:', searchTerm);
    
    // CRITICAL: Check if results container exists BEFORE making the request
    if ($('#user-search-results').length === 0) {
        console.error('❌ CRITICAL: #user-search-results container not found in HTML!');
        showAlert('Error: Results container missing from page. Check your HTML for <div id="user-search-results"></div>', 'danger');
        return;
    }
    
    // Show loading state
    const searchButton = $('#user-search-form button[type="submit"]');
    const originalContent = searchButton.html();
    searchButton.html('<i class="bi bi-hourglass-split"></i>').prop('disabled', true);
    
    // Clear previous results and show loading
    $('#user-search-results').html('<div class="text-center mt-3"><div class="spinner-border spinner-border-sm" role="status"></div> Searching...</div>');
    
    $.ajax({
        url: '/api/sdo/search',
        method: 'GET',
        data: { q: searchTerm },
        timeout: 10000,
        success: function(response) {
            console.log('=== Search Response SUCCESS ===');
            console.log('Full response:', response);
            console.log('Response is array:', Array.isArray(response));
            console.log('Response length:', response ? response.length : 'N/A');
            
            let users = null;
            
            if (Array.isArray(response)) {
                users = response;
                console.log('✅ Response is directly an array:', users.length);
            } else if (response.data && Array.isArray(response.data)) {
                users = response.data;
                console.log('✅ Found users in data field:', users.length);
            } else if (response.users && Array.isArray(response.users)) {
                users = response.users;
                console.log('✅ Found users in users field:', users.length);
            } else {
                console.log('❌ No users array found in response');
                console.log('Available response keys:', Object.keys(response || {}));
            }
            
            if (users) {
                console.log('📋 Users to display:', users);
                displayUserSearchResults(users);
                
                usersFound = users.length;
                updateStats();
                
                if (users.length === 0) {
                    showAlert(`No users found matching "${searchTerm}"`, 'info');
                } else {
                    showAlert(`Found ${users.length} user(s) matching "${searchTerm}"`, 'success');
                }
            } else {
                console.log('❌ Could not extract users from response');
                showAlert('Search completed but no users found in response', 'warning');
                $('#user-search-results').html('<div class="alert alert-warning mt-3">No users found in response format</div>');
            }
        },
        error: function(xhr, status, error) {
            console.log('=== Search ERROR ===');
            console.log('Status:', xhr.status);
            console.log('Response:', xhr.responseText);
            
            let errorMessage = 'User search failed';
            if (xhr.status === 401) {
                errorMessage = 'Authentication expired. Please re-authenticate.';
                handleAuthExpired();
            } else if (xhr.status === 0) {
                errorMessage = 'Network error. Check your connection.';
            }
            
            showAlert(errorMessage, 'danger');
            $('#user-search-results').html(`<div class="alert alert-danger mt-3">${errorMessage}</div>`);
        },
        complete: function() {
            searchButton.html(originalContent).prop('disabled', false);
            console.log('=== Search Complete ===');
        }
    });
}

// Handle authentication expiry during operations
function handleAuthExpired() {
    console.log('🔒 Authentication expired during operation');
    clearAuthState();
    updateAuthStatus(false);
    showAlert('Authentication expired. Please log in again.', 'warning');
}

// Enhanced user search results display
function displayUserSearchResults(users) {
    console.log('=== Displaying User Search Results ===');
    console.log('Users received:', users);
    console.log('Users count:', users ? users.length : 'null/undefined');
    
    const resultsContainer = $('#user-search-results');
    
    // Verify container exists
    if (resultsContainer.length === 0) {
        console.error('❌ Results container #user-search-results not found!');
        showAlert('Results container missing from page', 'danger');
        return;
    }
    
    if (!users || users.length === 0) {
        const noResultsHtml = `
            <div class="alert alert-info mt-3">
                <i class="bi bi-info-circle me-2"></i>No users found matching your search criteria.
            </div>
        `;
        resultsContainer.html(noResultsHtml);
        console.log('✅ No results message displayed');
        return;
    }
    
    console.log('Building HTML for', users.length, 'users');
    
    let html = `
        <div class="mt-3">
            <h6><i class="bi bi-people me-2"></i>Search Results (${users.length} found):</h6>
            <div class="list-group">
    `;
    
    users.forEach(function(user, index) {
        console.log(`Processing user ${index}:`, user);
        
        // Extract user information with multiple fallbacks
        const userId = user.id || user.userId || user.ID || user.uuid || `user_${index}`;
        const displayName = user.displayName || user.name || user.fullName || user.username || '';
        const email = user.email || user.emailAddress || user.mail || '';
        const username = user.username || user.login || '';
        const firstName = user.firstName || user.givenName || user.fname || '';
        const lastName = user.lastName || user.surname || user.familyName || user.lname || '';
        const status = user.status || '';
        
        // Build the full name with better logic
        let fullName = displayName;
        if (!fullName && firstName && lastName) {
            fullName = `${firstName} ${lastName}`.trim();
        } else if (!fullName && firstName) {
            fullName = firstName;
        } else if (!fullName && username) {
            fullName = username;
        } else if (!fullName && email) {
            fullName = email.split('@')[0]; // Use email prefix as name
        }
        
        // Final fallback
        if (!fullName) {
            fullName = `User ${index + 1}`;
        }
        
        console.log(`User ${index} processed:`, { userId, fullName, email, username });
        
        html += `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div class="flex-grow-1">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${escapeHtml(fullName)}</h6>
                        <small class="text-muted">${escapeHtml(userId)}</small>
                    </div>
                    ${email ? `<p class="mb-1 text-muted"><i class="bi bi-envelope me-1"></i>${escapeHtml(email)}</p>` : ''}
                    ${username && username !== fullName ? `<small class="text-muted">Username: ${escapeHtml(username)}</small>` : ''}
                    ${status ? `<span class="badge bg-secondary ms-2">${escapeHtml(status)}</span>` : ''}
                </div>
                <div class="ms-3">
                    <button class="btn btn-sm btn-outline-primary" 
                            onclick="openInvitationModal('${escapeHtml(userId)}', '${escapeHtml(fullName)}')"
                            title="Send invitation to ${escapeHtml(fullName)}">
                        <i class="bi bi-envelope-plus me-1"></i>Invite
                    </button>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    console.log('Setting HTML content...');
    resultsContainer.html(html);
    console.log('✅ Results displayed successfully');
    
    // Verify the HTML was actually set
    setTimeout(() => {
        const currentContent = resultsContainer.html();
        console.log('Content verification - length:', currentContent.length);
        if (currentContent.length < 100) {
            console.error('❌ HTML content seems too short, possible display issue');
        } else {
            console.log('✅ HTML content appears to be set correctly');
        }
    }, 100);
}

// Enhanced invitation modal
function openInvitationModal(userId, userName) {
    console.log(`Opening invitation modal for user: ${userName} (ID: ${userId})`);
    $('#invitation-user-id').val(userId);
    $('#invitation-user-name').text(userName);
    
    // Reset form
    $('#invitation-form')[0].reset();
    
    // Show the modal
    const invitationModal = new bootstrap.Modal($('#invitation-modal'));
    invitationModal.show();
}

// Enhanced send invitation with QR code generation options
function sendInvitation() {
    const userId = $('#invitation-user-id').val();
    const invitationTypes = [];
    $('input[name="invitationTypes"]:checked').each(function() {
        invitationTypes.push($(this).val());
    });

    if (invitationTypes.length === 0) {
        showAlert('Please select at least one invitation type', 'warning');
        return;
    }

    console.log('Sending invitation for user ID:', userId, 'with types:', invitationTypes);

    // --- Start of UI State Management ---
    $('#enrollment-error').addClass('hidden');
    $('#qr-code-container').addClass('hidden');
    $('#enrollment-container').removeClass('hidden');
    // --- End of UI State Management ---

    const sendBtn = $('#send-invitation-btn');
    const originalText = sendBtn.html();
    sendBtn.html('<i class="bi bi-arrow-repeat spin"></i> Sending...');
    sendBtn.prop('disabled', true);

    $.ajax({
        url: '/api/sdo/invite',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            userId: parseInt(userId, 10),
            invitationTypes: invitationTypes,
            email: userData.email // Pass user email from global state
        }),
        success: function(response) {
            console.log('Invitation response:', response);
            if (response.success && response.invitationId) {
                // --- Success UI ---
                $('#enrollment-container').addClass('hidden');
                $('#enrollment-error').addClass('hidden');
                $('#qr-code-container').removeClass('hidden');

                $('#invitation-id').text(response.invitationId);
                showAlert('Invitation sent successfully: ' + (response.message || ''), 'success');
                
                generateQRCode(response.invitationId);
                
                // Mark step as complete and enable next button
                stepCompletionStatus[4] = true;
                $('#step-4-next').prop('disabled', false);
                updateProgress();

            } else {
                // --- Error UI ---
                $('#enrollment-container').addClass('hidden');
                $('#qr-code-container').addClass('hidden');
                $('#enrollment-error').removeClass('hidden');
                $('#enrollment-error-message').text(response.error || 'Could not get a valid invitation ID.');
                stepCompletionStatus[4] = false;
                $('#step-4-next').prop('disabled', true);
            }
        },
        error: function(xhr) {
            console.error('Invitation error:', xhr);
            // --- Error UI ---
            $('#enrollment-container').addClass('hidden');
            $('#qr-code-container').addClass('hidden');
            $('#enrollment-error').removeClass('hidden');
            
            const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'A server error occurred.';
            $('#enrollment-error-message').text(errorMsg);
            stepCompletionStatus[4] = false;
            $('#step-4-next').prop('disabled', true);
        },
        complete: function() {
            sendBtn.html(originalText);
            sendBtn.prop('disabled', false);
            
            const invitationModal = bootstrap.Modal.getInstance($('#invitation-modal'));
            if (invitationModal) {
                invitationModal.hide();
            }
        }
    });
}

function retryEnrollment() {
    console.log('Retrying enrollment...');
    // We assume `userData` is populated from step 2
    if (userData && userData.id) {
        // Hide the error and re-trigger the main enrollment function for this step
        $('#enrollment-error').addClass('hidden');
        openInvitationModal(userData.id, userData.displayName);
    } else {
        showAlert('User data not found. Please go back to Step 2.', 'danger');
    }
}

// Generate QR code for a user
function generateQRCode(invitationId = null) {
    console.log(`Generating QR code... Invitation ID: ${invitationId}`);
    console.log('=== QR Code Generation Started ===');
    console.log('Authenticated:', isAuthenticated);
    console.log('Auth Token:', authToken ? 'Present' : 'Missing');
    console.log('Invitation ID:', invitationId);
    console.log('QRCode.js available:', typeof QRCode !== 'undefined');
    console.log('QRCode ready flag:', window.qrCodeLibraryReady);
    
    if (!isAuthenticated) {
        console.log('❌ Not authenticated, cannot generate QR code');
        showAlert('Please authenticate with SDO first', 'warning');
        return;
    }
    
    // Check if QRCode.js is available
    if (typeof QRCode === 'undefined') {
        console.log('⚠️ QRCode.js not available, showing loading message');
        $('#qrcode').html(`
            <div class="alert alert-warning text-center">
                <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                <strong>Loading QRCode.js library...</strong><br>
                <small class="text-muted">Please wait while we load the QR code generation library</small>
                <div class="mt-2">
                    <button class="btn btn-sm btn-outline-primary" onclick="checkLibraryStatus()">
                        <i class="bi bi-arrow-clockwise me-1"></i>Check Status
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="testDirectQRImmediate()">
                        <i class="bi bi-flask me-1"></i>Test Library
                    </button>
                </div>
            </div>
        `);
        
        // Try to wait for library to load
        waitForQRCodeLibrary(() => {
            console.log('🔄 QRCode.js now available, retrying generation...');
            generateQRCode(invitationId);
        });
        return;
    }
    
    // Show loading state
    $('#qrcode').html(`
        <div class="text-center p-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2">Generating QR code...</div>
            <small class="text-muted">This may take a few seconds</small>
        </div>
    `);
    
    const requestData = invitationId ? { invitationId: invitationId } : {};
    
    $.ajax({
        url: '/api/sdo/qr',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(requestData),
        timeout: 20000,
        success: function(response) {
            console.log('=== QR Generation SUCCESS ===');
            console.log('Response:', response);
            
            if (response.success && response.qr_data) {
                console.log('✅ QR Data received:', response.qr_data);
                
                // Check if backend provided a pre-generated QR code image
                if (response.qrCode) {
                    console.log('✅ Using pre-generated QR code image from backend');
                    displayPreGeneratedQRCode(response.qrCode, response.invitation_id, response);
                } else {
                    console.log('✅ Generating QR code client-side');
                    displayQRCodeFixed(response.qr_data, response.invitation_id, response);
                }
                
                qrCodesGenerated++;
                updateStats();
                
                const message = response.test_mode ? 
                    'Test QR Code generated successfully!' : 
                    'QR Code generated successfully!';
                showAlert(message, 'success');
                
            } else {
                console.log('❌ QR generation failed in response');
                const errorMsg = response.error || 'Failed to generate QR code';
                showAlert(errorMsg, 'warning');
                
                $('#qrcode').html(`
                    <div class="alert alert-warning">
                        <strong>QR Generation Failed</strong><br>
                        <small>${errorMsg}</small>
                        <br><div class="mt-2">
                            <button class="btn btn-sm btn-outline-primary me-2" onclick="generateQRCode()">
                                <i class="bi bi-arrow-clockwise me-1"></i>Try Again
                            </button>
                            <button class="btn btn-sm btn-outline-info" onclick="checkAuthStatus()">
                                <i class="bi bi-shield-check me-1"></i>Check Auth
                            </button>
                        </div>
                    </div>
                `);
            }
        },
        error: function(xhr, status, error) {
            console.log('=== QR Generation ERROR ===');
            console.log('Status:', xhr.status, 'Error:', error);
            console.log('Response:', xhr.responseText);
            
            if (xhr.status === 401) {
                console.log('🔒 Authentication expired during QR generation');
                handleAuthExpired();
                
                $('#qrcode').html(`
                    <div class="alert alert-warning">
                        <strong>Authentication Expired</strong><br>
                        <small>Please authenticate again to generate QR codes</small>
                        <br><button class="btn btn-sm btn-outline-primary mt-2" onclick="$('#sdo-email').focus()">
                            <i class="bi bi-shield-check me-1"></i>Re-authenticate
                        </button>
                    </div>
                `);
            } else {
                handleQRError(xhr, status, error);
            }
        }
    });
}

function waitForQRCodeLibrary(callback, timeout = 15000) {
    const startTime = Date.now();
    const checkInterval = 500;
    
    const checkForLibrary = () => {
        if (typeof QRCode !== 'undefined') {
            console.log('✅ QRCode.js library is now available');
            callback();
            return;
        }
        
        if (Date.now() - startTime > timeout) {
            console.log('⏰ Timeout waiting for QRCode.js library');
            showAlert('QRCode.js library loading timed out. Using fallback methods.', 'warning');
            callback(); // Still call callback to try fallback methods
            return;
        }
        
        setTimeout(checkForLibrary, checkInterval);
    };
    
    checkForLibrary();
}

// IMPROVED: Enhanced QR code display function optimized for camera scanning
// WORKING QR Code generation function
async function displayQRCodeFixed(qrData, invitationId, response = {}) {
    console.log('=== QR Code Generation ===');
    console.log('QR Data:', qrData);
    
    if (!qrData) {
        showQRError('No QR data provided', qrData, invitationId, response);
        return;
    }

    // Clear and setup container
    $('#qrcode').html(`
        <div class="text-center">
            <div class="qr-container-optimized d-inline-block p-4 bg-white rounded shadow-sm border">
                <div id="qr-display-area">
                    <div class="spinner-border text-primary mb-3"></div>
                    <div>Generating QR code...</div>
                </div>
            </div>
            <div class="qr-info mt-3"></div>
        </div>
    `);

    // Method 1: Try QRCode.js
    if (typeof QRCode !== 'undefined') {
        try {
            console.log('✅ Using QRCode.js');
            
            QRCode.toCanvas(qrData, {
                width: 300,
                height: 300,
                margin: 4,
                color: { dark: '#000000', light: '#FFFFFF' },
                errorCorrectionLevel: 'H'
            }, (error, canvas) => {
                if (error) {
                    console.error('QRCode.js failed:', error);
                    tryImageFallback(qrData, invitationId, response);
                } else {
                    console.log('✅ QR Generated with QRCode.js!');
                    canvas.style.cssText = 'width: 300px; height: 300px; border: 2px solid #fff; border-radius: 8px;';
                    $('#qr-display-area').html('').append(canvas);
                    onQRGenerationSuccess(invitationId, response);
                }
            });
            return;
        } catch (err) {
            console.error('QRCode.js exception:', err);
        }
    }

    console.log('⚠️ QRCode.js not available, trying image fallback...');
    tryImageFallback(qrData, invitationId, response);
}

// NEW: Display pre-generated QR code image from backend
function displayPreGeneratedQRCode(qrCodeDataUrl, invitationId, response = {}) {
    console.log('=== Displaying Pre-Generated QR Code ===');
    console.log('QR Code Data URL length:', qrCodeDataUrl ? qrCodeDataUrl.length : 0);
    
    if (!qrCodeDataUrl) {
        showQRError('No QR code image provided', null, invitationId, response);
        return;
    }

    // Clear and setup container
    $('#qrcode').html(`
        <div class="text-center">
            <div class="qr-container-optimized d-inline-block p-4 bg-white rounded shadow-sm border">
                <div id="qr-display-area">
                    <div class="spinner-border text-primary mb-3"></div>
                    <div>Loading QR code...</div>
                </div>
            </div>
            <div class="qr-info mt-3"></div>
        </div>
    `);

    // Create image element
    const img = new Image();
    img.onload = () => {
        console.log('✅ Pre-generated QR code image loaded successfully');
        img.style.cssText = 'width: 300px; height: 300px; border: 2px solid #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
        $('#qr-display-area').html('').append(img);
        onQRGenerationSuccess(invitationId, response);
    };
    
    img.onerror = () => {
        console.error('❌ Failed to load pre-generated QR code image');
        showQRError('Failed to load QR code image', null, invitationId, response);
    };
    
    img.src = qrCodeDataUrl;
}

// Image fallback method
function tryImageFallback(qrData, invitationId, response) {
    const encodedData = encodeURIComponent(qrData);
    const url = `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodedData}&chld=H|4`;
    
    const img = new Image();
    img.onload = () => {
        console.log('✅ QR Generated with Google Charts!');
        img.style.cssText = 'width: 300px; height: 300px; border: 2px solid #fff; border-radius: 8px;';
        $('#qr-display-area').html('').append(img);
        onQRGenerationSuccess(invitationId, response);
    };
    
    img.onerror = () => {
        console.error('❌ Image fallback failed');
        showQRError('All QR generation methods failed', qrData, invitationId, response);
    };
    
    img.src = url;
}
// IMPROVED: Optimized fallback QR display with better scanning parameters
function fallbackQRDisplayOptimized(qrData, invitationId, response = {}) {
    console.log('=== Using Optimized Fallback QR Display ===');
    console.log('QR Data for fallback:', qrData);
    
    const qrSize = 300;  // Larger size for better scanning
    const encodedData = encodeURIComponent(qrData);
    
    // Using Google Charts with optimized parameters for scanning
    const qrImageUrl = `https://chart.googleapis.com/chart?chs=${qrSize}x${qrSize}&cht=qr&chl=${encodedData}&choe=UTF-8&chld=H|4`;
    
    console.log('Generated optimized Google Charts URL:', qrImageUrl);
    
    const qrImageHTML = `
        <div class="qr-scan-container">
            <img src="${qrImageUrl}" 
                 alt="QR Code for SDO Mobile Enrollment" 
                 class="qr-code-optimized"
                 style="
                     width: ${qrSize}px; 
                     height: ${qrSize}px;
                     border: 2px solid #ffffff;
                     border-radius: 8px;
                     box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                     background: white;
                     display: block;
                     margin: 0 auto;
                 "
                 onload="console.log('✅ Optimized QR image loaded successfully'); optimizeQRForScanning();"
                 onerror="console.error('❌ QR image failed to load'); handleQRImageError(this, '${qrData}');">
        </div>
    `;
    
    $('#qr-display-area').html(qrImageHTML);
    displayQRInfo(invitationId, response);
    
    console.log('✅ Optimized fallback QR code display completed');
}

// NEW: Function to apply final optimizations for camera scanning
function optimizeQRForScanning() {
    console.log('=== Applying Final QR Optimizations ===');
    
    // Ensure the QR code container has optimal styling
    $('.qr-container-optimized').css({
        'background': '#ffffff',
        'padding': '24px',
        'border-radius': '12px',
        'box-shadow': '0 4px 12px rgba(0,0,0,0.1)',
        'border': '1px solid #e0e0e0'
    });
    
    // Apply styles to canvas if QRCode.js was used
    $('#qr-display-area canvas').css({
        'border': '2px solid #ffffff',
        'border-radius': '8px',
        'box-shadow': '0 2px 8px rgba(0,0,0,0.1)',
        'background': 'white',
        'image-rendering': 'pixelated',  // Crisp edges for QR code
        'image-rendering': '-webkit-crisp-edges',
        'image-rendering': 'crisp-edges'
    });
    
    // Add scanning optimization indicators
    addScanningGuides();
    
    console.log('✅ QR code optimized for camera scanning');
}

// NEW: Add visual guides for optimal scanning
function addScanningGuides() {
    if ($('#scanning-guides').length > 0) {
        return; // Already added
    }
    
    const guidesHTML = `
        <div id="scanning-guides" class="mt-3">
            <div class="row text-center">
                <div class="col-4">
                    <div class="scan-tip">
                        <i class="bi bi-phone text-primary" style="font-size: 1.5rem;"></i>
                        <br><small class="text-muted">6-12 inches<br>away</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="scan-tip">
                        <i class="bi bi-brightness-high text-warning" style="font-size: 1.5rem;"></i>
                        <br><small class="text-muted">Good<br>lighting</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="scan-tip">
                        <i class="bi bi-fullscreen text-success" style="font-size: 1.5rem;"></i>
                        <br><small class="text-muted">Center in<br>frame</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('.qr-container-optimized').after(guidesHTML);
}

// IMPROVED: Enhanced error handling with better fallback presentation
window.handleQRImageError = function(img, qrData) {
    console.error('❌ QR image failed to load, showing enhanced text fallback');
    
    const fallbackHTML = `
        <div class="qr-fallback-container p-4 border rounded bg-light">
            <div class="text-center mb-3">
                <i class="bi bi-exclamation-triangle text-warning" style="font-size: 2rem;"></i>
                <h6 class="mt-2">QR Code Display Failed</h6>
            </div>
            
            <div class="alert alert-info">
                <strong>Manual Enrollment Options:</strong>
                <div class="mt-2">
                    <div class="d-grid gap-2">
                        <button class="btn btn-primary btn-sm" onclick="copyToClipboard('${qrData}')">
                            <i class="bi bi-clipboard me-1"></i>Copy Enrollment Data
                        </button>
                        <a href="${qrData}" target="_blank" class="btn btn-outline-primary btn-sm">
                            <i class="bi bi-box-arrow-up-right me-1"></i>Open Enrollment Link
                        </a>
                        <button class="btn btn-outline-secondary btn-sm" onclick="generateQRCode()">
                            <i class="bi bi-arrow-clockwise me-1"></i>Try QR Again
                        </button>
                    </div>
                </div>
            </div>
            
            <details class="mt-3">
                <summary class="text-muted">Show Raw Enrollment Data</summary>
                <div class="mt-2 p-2 bg-white border rounded" style="word-break: break-all; font-family: monospace; font-size: 0.75em; max-height: 100px; overflow-y: auto;">
                    ${qrData}
                </div>
            </details>
        </div>
    `;
    
    $(img).closest('#qr-display-area').html(fallbackHTML);
};

// NEW: Copy to clipboard functionality
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showAlert('✅ Enrollment data copied to clipboard!', 'success');
        }).catch(() => {
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

// Fallback copy method for older browsers
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showAlert('✅ Enrollment data copied to clipboard!', 'success');
    } catch (err) {
        showAlert('❌ Failed to copy. Please copy manually.', 'warning');
    }
    
    document.body.removeChild(textArea);
}

// IMPROVED: Enhanced QR instructions with scanning tips
function addQRInstructions() {
    if ($('#qr-instructions').length > 0) {
        return; // Already added
    }
    
    const instructionsHtml = `
        <div class="row mt-4">
            <div class="col-12">
                <div class="card border-0 bg-light">
                    <div class="card-body">
                        <h6 class="card-title">
                            <i class="bi bi-phone me-2 text-primary"></i>
                            How to Scan this QR Code
                        </h6>
                        
                        <div class="row">
                            <div class="col-md-8">
                                <ol class="mb-2">
                                    <li>Download the <strong>Secret Double Octopus Authenticator</strong> app</li>
                                    <li>Open the app and tap <strong>"Add Account"</strong> or <strong>"Enroll"</strong></li>
                                    <li>Point your camera at the QR code above</li>
                                    <li>Keep the code centered in your camera frame</li>
                                    <li>Wait for automatic recognition and follow the prompts</li>
                                </ol>
                            </div>
                            <div class="col-md-4">
                                <div class="bg-white p-3 rounded border">
                                    <h6 class="text-success mb-2">
                                        <i class="bi bi-check-circle me-1"></i>Scanning Tips
                                    </h6>
                                    <ul class="list-unstyled small text-muted mb-0">
                                        <li>✓ Hold steady 6-12 inches away</li>
                                        <li>✓ Ensure good lighting</li>
                                        <li>✓ Keep camera perpendicular</li>
                                        <li>✓ Avoid shadows or glare</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <small class="text-muted">
                                <i class="bi bi-download me-1"></i>
                                Available for iOS and Android
                            </small>
                            <div class="btn-group" role="group">
                                <button class="btn btn-sm btn-outline-primary" onclick="checkPortalAccess()">
                                    <i class="bi bi-check-circle me-1"></i>Test Portal
                                </button>
                                <button class="btn btn-sm btn-outline-secondary" onclick="generateQRCode()">
                                    <i class="bi bi-arrow-clockwise me-1"></i>Refresh QR
                                </button>
                                <button class="btn btn-sm btn-outline-info" onclick="showQRTroubleshooting()">
                                    <i class="bi bi-question-circle me-1"></i>Help
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    if ($('#qrcode-container .card-body').length > 0) {
        $('#qrcode-container .card-body').append('<div id="qr-instructions">' + instructionsHtml + '</div>');
    }
}

// NEW: QR troubleshooting modal
function showQRTroubleshooting() {
    const troubleshootingHTML = `
        <div class="modal fade" id="qrTroubleshootingModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-question-circle me-2"></i>
                            QR Code Scanning Help
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="accordion" id="troubleshootingAccordion">
                            <div class="accordion-item">
                                <h2 class="accordion-header">
                                    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#scanning-issues">
                                        QR Code Won't Scan
                                    </button>
                                </h2>
                                <div id="scanning-issues" class="accordion-collapse collapse show" data-bs-parent="#troubleshootingAccordion">
                                    <div class="accordion-body">
                                        <ul>
                                            <li>Ensure good lighting - avoid shadows and glare</li>
                                            <li>Hold your phone steady, 6-12 inches from the screen</li>
                                            <li>Clean your camera lens</li>
                                            <li>Try rotating your phone or adjusting the angle</li>
                                            <li>Make sure the entire QR code is visible in the frame</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="accordion-item">
                                <h2 class="accordion-header">
                                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#app-issues">
                                        App Not Recognizing Code
                                    </button>
                                </h2>
                                <div id="app-issues" class="accordion-collapse collapse" data-bs-parent="#troubleshootingAccordion">
                                    <div class="accordion-body">
                                        <ul>
                                            <li>Make sure you have the latest version of the SDO Authenticator app</li>
                                            <li>Try closing and reopening the app</li>
                                            <li>Check your internet connection</li>
                                            <li>Contact your IT administrator if the issue persists</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="accordion-item">
                                <h2 class="accordion-header">
                                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#alternative-methods">
                                        Alternative Enrollment Methods
                                    </button>
                                </h2>
                                <div id="alternative-methods" class="accordion-collapse collapse" data-bs-parent="#troubleshootingAccordion">
                                    <div class="accordion-body">
                                        <p>If QR scanning continues to fail:</p>
                                        <ul>
                                            <li>Use the "Copy Enrollment Data" button to manually enter the code</li>
                                            <li>Try the "Open Enrollment Link" button to access the web portal</li>
                                            <li>Contact your system administrator for alternative enrollment methods</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="generateQRCode()" data-bs-dismiss="modal">
                            <i class="bi bi-arrow-clockwise me-1"></i>Refresh QR Code
                        </button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    $('#qrTroubleshootingModal').remove();
    
    // Add modal to body and show
    $('body').append(troubleshootingHTML);
    const modal = new bootstrap.Modal(document.getElementById('qrTroubleshootingModal'));
    modal.show();
}
// Display QR code information and instructions
function displayQRInfo(invitationId, response = {}) {
    console.log('Displaying QR info for invitation:', invitationId);
    
    let infoHTML = '';
    
    // Display invitation ID if available
    if (invitationId) {
        $('#invitation-id').html(`
            <small class="text-muted d-block mt-2">
                <i class="bi bi-info-circle me-1"></i>
                Invitation ID: <code>${invitationId}</code>
            </small>
        `);
    }
    
    // Add enrollment URL info if available
    if (response.enrollment_url || response.portal_url) {
        const enrollmentUrl = response.enrollment_url || response.portal_url;
        infoHTML += `
            <div class="mt-2">
                <small class="text-info">
                    <i class="bi bi-link-45deg me-1"></i>
                    <a href="${enrollmentUrl}" target="_blank" rel="noopener">
                        Open Enrollment Portal
                    </a>
                </small>
            </div>
        `;
    }
    
    // Add test mode indicator
    if (response.test_mode) {
        infoHTML += `
            <div class="mt-2">
                <span class="badge bg-warning text-dark">
                    <i class="bi bi-flask me-1"></i>Test Mode
                </span>
            </div>
        `;
    }
    
    // Add admin URL info for debugging
    if (response.admin_url) {
        infoHTML += `
            <div class="mt-1">
                <small class="text-muted">
                    Admin URL: ${response.admin_url}
                </small>
            </div>
        `;
    }
    
    if (infoHTML) {
        $('.qr-info').html(infoHTML);
    }
    
    // Add instructions
    addQRInstructions();
    
    // Track generation
    trackQRGeneration();
}

// Generate QR code with test invitation ID
function generateTestQRCode() {
    console.log('=== Generating Test QR Code ===');
    console.log('Test Invitation ID:', TEST_INVITATION_ID);
    console.log('QRCode.js available:', typeof QRCode !== 'undefined');
    
    if (typeof QRCode === 'undefined') {
        console.log('⚠️ QRCode.js not available for test');
        showAlert('QRCode.js library not loaded yet. Please wait...', 'warning');
        
        // Try to wait for it and retry
        waitForQRCodeLibrary(() => {
            console.log('🔄 Retrying test QR generation...');
            generateTestQRCode();
        });
        return;
    }
    
    const testEnrollmentUrl = `https://amitmt.doubleoctopus.io/enroll?invitation=${TEST_INVITATION_ID}`;
    console.log('Test Enrollment URL:', testEnrollmentUrl);
    
    // Show loading state
    $('#qrcode').html('<div class="text-center"><div class="spinner-border" role="status"></div><br>Generating test QR code...</div>');
    
    // Generate QR code directly with test data
    displayQRCodeFixed(testEnrollmentUrl, TEST_INVITATION_ID, {
        test_mode: true,
        invitation_id: TEST_INVITATION_ID,
        enrollment_url: testEnrollmentUrl,
        admin_url: "https://amitmt.doubleoctopus.io/admin"
    });
    
    showAlert('🧪 Test QR Code generated with real invitation ID!', 'success');
}

// Enhanced direct QR test function 
window.testDirectQR = function() {
    console.log('=== Direct QR Test Function ===');
    console.log('QRCode available:', typeof QRCode !== 'undefined');
    console.log('QRCode.toCanvas available:', typeof QRCode !== 'undefined' && typeof QRCode.toCanvas === 'function');
    
    if (typeof QRCode !== 'undefined' && typeof QRCode.toCanvas === 'function') {
        const testUrl = 'https://amitmt.doubleoctopus.io/enroll?invitation=018fc8bbcD5SLtUzkD33ykrzXpYaEYGWbw1ksgukLVNGniSpQhQR6p6tcSo5WNDqq21bPjeU';
        
        console.log('Generating QR with URL:', testUrl);
        
        // Clear the display area
        $('#qrcode').html('<div class="text-center"><div class="spinner-border" role="status"></div><br>Testing direct QR generation...</div>');
        
        QRCode.toCanvas(testUrl, {
            width: 300,
            height: 300,
            margin: 4,
            errorCorrectionLevel: 'H'
        }, (error, canvas) => {
            if (error) {
                console.error('Direct QR test failed:', error);
                alert('❌ Direct QR test failed: ' + error.message);
                
                // Fallback to displayQRCodeFixed
                displayQRCodeFixed(testUrl, TEST_INVITATION_ID, { test_mode: true });
            } else {
                console.log('✅ Direct QR test successful!');
                canvas.style.cssText = 'width: 300px; height: 300px; border: 2px solid #fff; border-radius: 8px;';
                $('#qrcode').html('').append(canvas);
                alert('✅ Direct QR test successful! QR code displayed.');
                
                // Add info
                displayQRInfo(TEST_INVITATION_ID, { test_mode: true, enrollment_url: testUrl });
            }
        });
    } else {
        console.log('❌ QRCode.js not available or not functional');
        
        const status = {
            defined: typeof QRCode !== 'undefined',
            toCanvas: typeof QRCode !== 'undefined' && typeof QRCode.toCanvas === 'function',
            ready: window.qrCodeLibraryReady,
            failed: window.qrCodeLoadingFailed
        };
        
        console.log('QRCode status:', status);
        alert('❌ QRCode.js library not ready. Status: ' + JSON.stringify(status, null, 2));
        
        // Try the immediate test function as fallback
        if (typeof testDirectQRImmediate === 'function') {
            console.log('🔄 Trying immediate test function...');
            testDirectQRImmediate();
        }
    }
};
// Generate QR code for specific invitation ID
function generateInvitationQRCode(invitationId) {
    console.log('Generating QR code for specific invitation:', invitationId);
    
    // Show loading state
    $('#qrcode').html('<div class="text-center"><div class="spinner-border" role="status"></div><br>Generating invitation QR code...</div>');
    
    $.ajax({
        url: `/api/sdo/qr/${invitationId}`,
        method: 'GET',
        timeout: 10000,
        success: function(response) {
            console.log('Invitation QR response:', response);
            
            if (response.success && response.qr_data) {
                displayQRCodeFixed(response.qr_data, response.invitation_id, response);
                qrCodesGenerated++;
                updateStats();
                showAlert('QR Code generated for invitation!', 'success');
                
            } else {
                console.log('Invitation QR generation failed:', response);
                // Fallback to general QR code
                generateQRCode();
            }
        },
        error: function(xhr, status, error) {
            console.log('Invitation QR generation error:', xhr.responseText);
            if (xhr.status === 401) {
                handleAuthExpired();
            } else {
                // Fallback to general QR code
                generateQRCode();
            }
        }
    });
}

// Generate user-specific enrollment QR code
function generateUserQRCode(userId, userName) {
    console.log('Generating user-specific QR code for:', userId, userName);
    
    // Show loading state
    $('#qrcode').html('<div class="text-center"><div class="spinner-border" role="status"></div><br>Generating personalized QR code...</div>');
    
    $.ajax({
        url: '/api/sdo/qr/user',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            userId: userId,
            userName: userName
        }),
        timeout: 10000,
        success: function(response) {
            console.log('User QR response:', response);
            
            if (response.success && response.qr_data) {
                displayQRCodeFixed(response.qr_data, response.invitation_id, response);
                qrCodesGenerated++;
                updateStats();
                showAlert(`Personalized QR Code generated for ${userName}!`, 'success');
                
            } else {
                console.log('User QR generation failed:', response);
                // Fallback to general QR code
                generateQRCode();
            }
        },
        error: function(xhr, status, error) {
            console.log('User QR generation error:', xhr.responseText);
            if (xhr.status === 401) {
                handleAuthExpired();
            } else {
                // Fallback to general QR code
                generateQRCode();
            }
        }
    });
}

// Validate invitation ID format
function validateInvitationID(invitationId) {
    if (!invitationId) {
        showAlert('Please enter an invitation ID', 'warning');
        return;
    }
    
    console.log('Validating invitation ID:', invitationId);
    
    $.ajax({
        url: `/api/sdo/validate?id=${encodeURIComponent(invitationId)}`,
        method: 'GET',
        success: function(response) {
            console.log('Validation response:', response);
            
            if (response.valid) {
                showAlert('✅ Invitation ID format is valid!', 'success');
                console.log('Enrollment URL:', response.enrollment_url);
                
                // Show validation details
                $('#validation-results').html(`
                    <div class="alert alert-success">
                        <strong>✅ Valid Invitation ID</strong><br>
                        <small>Length: ${response.length} characters</small><br>
                        <small>Format: Valid SDO invitation ID</small><br>
                        ${response.enrollment_url ? `<a href="${response.enrollment_url}" target="_blank" class="btn btn-sm btn-outline-success mt-2">
                            <i class="bi bi-box-arrow-up-right me-1"></i>Test Enrollment URL
                        </a>` : ''}
                    </div>
                `);
            } else {
                showAlert('❌ Invalid invitation ID format', 'danger');
                $('#validation-results').html(`
                    <div class="alert alert-danger">
                        <strong>❌ Invalid Invitation ID</strong><br>
                        <small>${response.error || 'Format validation failed'}</small>
                    </div>
                `);
            }
        },
        error: function(xhr, status, error) {
            console.log('Validation error:', xhr.responseText);
            if (xhr.status === 401) {
                handleAuthExpired();
            } else {
                showAlert('Failed to validate invitation ID', 'danger');
            }
        }
    });
}

// Check invitation status
function checkInvitationStatus(invitationId) {
    if (!invitationId) {
        showAlert('Please provide an invitation ID', 'warning');
        return;
    }
    
    console.log('Checking invitation status:', invitationId);
    
    $.ajax({
        url: `/api/sdo/invitations/${invitationId}/status`,
        method: 'GET',
        success: function(response) {
            console.log('Status response:', response);
            
            let statusMessage = '';
            let alertType = 'info';
            
            if (response.status === 'checked') {
                statusMessage = '✅ Invitation status retrieved successfully';
                alertType = 'success';
            } else if (response.status === 'unknown') {
                statusMessage = '⚠️ Could not determine invitation status';
                alertType = 'warning';
            } else {
                statusMessage = '❌ Status check failed';
                alertType = 'danger';
            }
            
            showAlert(statusMessage, alertType);
            
            // Show detailed status info
            $('#status-results').html(`
                <div class="alert alert-${alertType}">
                    <strong>Invitation Status Check</strong><br>
                    <small>ID: <code>${response.invitation_id}</code></small><br>
                    <small>Status: ${response.status}</small><br>
                    ${response.status_code ? `<small>HTTP Status: ${response.status_code}</small><br>` : ''}
                    ${response.enrollment_url ? `
                        <a href="${response.enrollment_url}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">
                            <i class="bi bi-box-arrow-up-right me-1"></i>Open Enrollment
                        </a>
                    ` : ''}
                </div>
            `);
        },
        error: function(xhr, status, error) {
            console.log('Status check error:', xhr.responseText);
            if (xhr.status === 401) {
                handleAuthExpired();
            } else {
                showAlert('Failed to check invitation status', 'danger');
            }
        }
    });
}

// Check if SDO portal is accessible
function checkPortalAccess() {
    if (!isAuthenticated) {
        showAlert('Please authenticate with SDO first', 'warning');
        return;
    }

    console.log('Checking SDO portal access...');
    
    $.ajax({
        url: '/api/sdo/portal/check',
        method: 'GET',
        success: function(response) {
            console.log('Portal check response:', response);
            
            if (response.accessible) {
                showAlert('✅ SDO Portal is accessible!', 'success');
                if (response.portal_url) {
                    console.log('Portal URL:', response.portal_url);
                }
            } else {
                showAlert(`⚠️ Portal check failed (Status: ${response.status_code || 'Unknown'})`, 'warning');
            }
        },
        error: function(xhr, status, error) {
            console.log('Portal check error:', xhr.responseText);
            if (xhr.status === 401) {
                handleAuthExpired();
            } else {
                showAlert('❌ Unable to check portal access', 'danger');
            }
        }
    });
}

// Add QR code instructions with SDO-specific information
function addQRInstructions() {
    if ($('#qr-instructions').length > 0) {
        return; // Already added
    }
    
    const instructionsHtml = `
        <div class="row mt-3">
            <div class="col-12">
                <div class="alert alert-info">
                    <h6><i class="bi bi-info-circle me-2"></i>How to use this QR Code:</h6>
                    <ol class="mb-2">
                        <li>Download the <strong>Secret Double Octopus Authenticator</strong> app on your mobile device</li>
                        <li>Open the app and tap <strong>"Add Account"</strong> or <strong>"Enroll"</strong></li>
                        <li>Scan this QR code with your mobile camera</li>
                        <li>Complete the enrollment process in the app</li>
                        <li>Use the app for passwordless authentication</li>
                    </ol>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i class="bi bi-phone me-1"></i>
                            Available for iOS and Android
                        </small>
                        <div>
                            <button class="btn btn-sm btn-outline-primary" onclick="checkPortalAccess()">
                                <i class="bi bi-check-circle me-1"></i>Test Portal
                            </button>
                            <button class="btn btn-sm btn-outline-secondary" onclick="generateQRCode()">
                                <i class="bi bi-arrow-clockwise me-1"></i>Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    if ($('#qrcode-container .card-body').length > 0) {
        $('#qrcode-container .card-body').append('<div id="qr-instructions">' + instructionsHtml + '</div>');
    }
}

// Add QR code expiration warning
function addQRExpirationWarning(expiresIn = 3600) {
    if ($('#qr-expiration').length > 0) {
        return; // Already added
    }
    
    const expirationTime = new Date(Date.now() + (expiresIn * 1000));
    const timeString = expirationTime.toLocaleTimeString();
    
    $('#qrcode').append(`
        <div id="qr-expiration" class="text-center mt-2">
            <small class="text-muted">
                <i class="bi bi-clock me-1"></i>
                QR Code expires at ${timeString}
                <button class="btn btn-link btn-sm p-0 ms-2" onclick="generateQRCode()" title="Refresh QR Code">
                    <i class="bi bi-arrow-clockwise"></i>
                </button>
            </small>
        </div>
    `);
}

// Track QR generation time
function trackQRGeneration() {
    sessionStorage.setItem('lastQRGenerated', Date.now().toString());
}

function checkQRCodeStatus() {
    const qrGenerated = $('#qrcode canvas, #qrcode img').length > 0;
    const lastGenerated = sessionStorage.getItem('lastQRGenerated');
    
    if (qrGenerated && lastGenerated) {
        const timeDiff = Date.now() - parseInt(lastGenerated);
        const thirtyMinutes = 30 * 60 * 1000;
        
        if (timeDiff > thirtyMinutes) {
            console.log('QR code is old, refreshing...');
            generateQRCode();
        }
    }
}

// Add refresh button for QR codes
function addQRRefreshButton() {
    if ($('#qr-refresh-btn').length === 0 && $('#qrcode-container .card-header').length > 0) {
        $('#qrcode-container .card-header').append(`
            <button id="qr-refresh-btn" class="btn btn-sm btn-outline-light ms-2" onclick="generateQRCode()" title="Refresh QR Code">
                <i class="bi bi-arrow-clockwise"></i>
            </button>
        `);
    }
}

// Enhanced error handling for QR operations
function handleQRError(xhr, status, error) {
    let errorMessage = 'Failed to generate QR code';
    try {
        const response = JSON.parse(xhr.responseText);
        errorMessage = response.error || errorMessage;
        
        // Handle authentication errors
        if (xhr.status === 401 || errorMessage.includes('authenticate')) {
            handleAuthExpired();
            errorMessage = 'Authentication expired. Please re-authenticate with SDO.';
        }
    } catch (e) {
        if (xhr.status === 401) {
            handleAuthExpired();
            errorMessage = 'Authentication expired. Please re-authenticate with SDO.';
        } else if (xhr.status === 0) {
            errorMessage = 'Network error. Please check your connection.';
        } else {
            errorMessage = `QR generation failed (${xhr.status}): ${error}`;
        }
    }
    
    showAlert(errorMessage, 'danger');
    $('#qrcode').html(`
        <div class="alert alert-danger">
            <strong>QR Generation Failed</strong><br>
            <small>${errorMessage}</small><br>
            <div class="mt-2">
                <button class="btn btn-sm btn-outline-primary me-2" onclick="generateQRCode()">
                    <i class="bi bi-arrow-clockwise me-1"></i>Try Again
                </button>
                <button class="btn btn-sm btn-outline-success" onclick="generateTestQRCode()">
                    <i class="bi bi-flask me-1"></i>Test QR
                </button>
            </div>
        </div>
    `);
}

function updateStats() {
    $('#users-count').text(usersFound);
    $('#invitations-sent').text(invitationsSent);
    $('#qr-generated').text(qrCodesGenerated);
}

function showAlert(message, type) {
    // Remove existing alerts
    $('.alert-floating').remove();
    
    // Create floating alert
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible alert-floating" style="
            position: fixed; 
            top: 20px; 
            right: 20px; 
            z-index: 9999; 
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        ">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    $('body').append(alertHtml);
    
    // Auto-remove after 5 seconds
    setTimeout(function() {
        $('.alert-floating').fadeOut();
    }, 5000);
}

function loadStoredConfiguration() {
    // Try to load stored configuration
    $.ajax({
        url: '/get-config?section=auth&include_sensitive=false',
        method: 'GET',
        success: function(response) {
            if (response.success && response.config) {
                if (response.config.sdo_url) {
                    $('#sdo-url').val(response.config.sdo_url);
                }
                if (response.config.sdo_email) {
                    $('#sdo-email').val(response.config.sdo_email);
                }
            }
        },
        error: function() {
            // Ignore errors when loading config
            console.log('Could not load stored configuration');
        }
    });
}

// Helper function to escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Function to check if all required elements exist
function checkRequiredElements() {
    const required = [
        '#user-search-input',
        '#user-search-form',
        '#user-search-results'
    ];
    
    console.log('=== Checking Required Elements ===');
    required.forEach(selector => {
        const exists = $(selector).length > 0;
        console.log(`${selector}: ${exists ? '✅ Found' : '❌ Missing'}`);
        if (!exists) {
            showAlert(`Required element ${selector} is missing from the page`, 'danger');
        }
    });
}

// Enhanced complete flow test
function testCompleteFlow() {
    console.log('=== Testing Complete QR Flow with Real Invitation ===');
    console.log('1. Auth status:', isAuthenticated);
    
    if (!isAuthenticated) {
        alert('Please authenticate with SDO first');
        return;
    }
    
    console.log('2. Testing with invitation ID:', TEST_INVITATION_ID);
    
    // Step 1: Validate the invitation ID
    validateInvitationID(TEST_INVITATION_ID);
    
    // Step 2: Generate QR code
    setTimeout(() => {
        console.log('3. Generating test QR code...');
        generateTestQRCode();
    }, 1000);
    
    // Step 3: Check status
    setTimeout(() => {
        console.log('4. Checking invitation status...');
        checkInvitationStatus(TEST_INVITATION_ID);
    }, 3000);
    
    // Step 4: Verify display
    setTimeout(() => {
        console.log('5. Verifying QR code display...');
        const qrExists = $('#qrcode canvas, #qrcode img').length > 0;
        console.log('QR code displayed:', qrExists);
        
        if (!qrExists) {
            console.error('QR code not displayed - check console for errors');
            alert('⚠️ QR code not displayed - check console for errors');
        } else {
            console.log('✅ Complete flow test successful');
            alert('✅ Complete flow test successful! Check the QR code above.');
        }
    }, 5000);
}

// Debug and testing functions
function debugAuthFlow() {
    console.log('=== Auth Flow Debug ===');
    console.log('1. Current auth state:', isAuthenticated);
    console.log('2. Token present:', !!authToken);
    console.log('3. Stored token:', !!sessionStorage.getItem('sdo_auth_token'));
    console.log('4. Auth time:', new Date(parseInt(sessionStorage.getItem('sdo_auth_time') || '0')));
    
    // Test auth endpoint
    $.ajax({
        url: '/api/sdo/status',
        method: 'GET',
        success: (r) => console.log('5. Server auth status:', r),
        error: (xhr) => console.log('5. Server auth error:', xhr.status, xhr.responseText)
    });
}

function debugTokens() {
    console.log('=== Token Debug ===');
    console.log('Auth Token:', authToken);
    console.log('Session Token:', sessionStorage.getItem('sdo_auth_token'));
    console.log('Auth Time:', new Date(parseInt(sessionStorage.getItem('sdo_auth_time') || '0')));
    
    // Test if headers are configured
    const testXHR = new XMLHttpRequest();
    const beforeSend = $.ajaxSettings.beforeSend;
    if (beforeSend) {
        console.log('AJAX beforeSend configured:', typeof beforeSend);
    } else {
        console.log('No AJAX beforeSend configured');
    }
}

function debugSearchIssue() {
    console.log('=== Search Debug ===');
    console.log('Is authenticated:', isAuthenticated);
    console.log('Auth token:', authToken);
    console.log('Search input value:', $('#user-search-input').val());
    
    // Test search endpoint directly
    const testSearchTerm = 'bob';
    console.log('Testing search with term:', testSearchTerm);
    
    $.ajax({
        url: '/api/sdo/search?q=' + testSearchTerm,
        method: 'GET',
        success: function(response) {
            console.log('Direct search test - SUCCESS:', response);
        },
        error: function(xhr, status, error) {
            console.log('Direct search test - ERROR:', {
                status: xhr.status,
                statusText: xhr.statusText,
                responseText: xhr.responseText,
                error: error
            });
        }
    });
}

function debugQRIssue() {
    console.log('=== QR Debug ===');
    console.log('Is authenticated:', isAuthenticated);
    console.log('Auth token:', authToken);
    console.log('QR container exists:', $('#qrcode').length > 0);
    
    // Test QR endpoint directly
    console.log('Testing QR generation endpoint...');
    
    $.ajax({
        url: '/api/sdo/qr',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({}),
        success: function(response) {
            console.log('Direct QR test - SUCCESS:', response);
        },
        error: function(xhr, status, error) {
            console.log('Direct QR test - ERROR:', {
                status: xhr.status,
                statusText: xhr.statusText,
                responseText: xhr.responseText,
                error: error
            });
        }
    });
}

function debugAuthStatus() {
    console.log('=== Auth Status Debug ===');
    
    $.ajax({
        url: '/api/sdo/status',
        method: 'GET',
        success: function(response) {
            console.log('Auth status - SUCCESS:', response);
        },
        error: function(xhr, status, error) {
            console.log('Auth status - ERROR:', {
                status: xhr.status,
                statusText: xhr.statusText,
                responseText: xhr.responseText,
                error: error
            });
        }
    });
}

function testAllEndpoints() {
    console.log('=== Testing All Endpoints ===');
    debugAuthStatus();
    setTimeout(() => debugSearchIssue(), 1000);
    setTimeout(() => debugQRIssue(), 2000);
}
// ===== ADD THESE FUNCTIONS TO YOUR EXISTING sdo-auth-js.js FILE =====
// Add these functions anywhere in your existing file (preferably at the end before the final console.log statements)

// Test SDO Authentication with form data or test credentials
// REPLACE your existing testSDOAuth function with this fixed version
// Add this to your sdo-auth-js.js file (replace the existing testSDOAuth function)

// Fixed Test SDO Authentication function with better error handling
function testSDOAuth() {
    console.log('🧪 Opening SDO Authentication Test Modal...');
    
    // Remove any existing test modal
    $('#testSDOModal').remove();
    
    // Create the test modal HTML
    const modalHTML = `
        <div class="modal fade" id="testSDOModal" tabindex="-1" aria-labelledby="testSDOModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="testSDOModalLabel">
                            <i class="bi bi-flask me-2"></i>Test SDO Authentication
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="testSDOForm">
                            <div class="mb-3">
                                <label for="testSDOUrl" class="form-label">
                                    <i class="bi bi-link-45deg me-1"></i>SDO Admin URL
                                </label>
                                <input type="text" class="form-control" id="testSDOUrl" 
                                       value="https://amitmt.doubleoctopus.io/admin" 
                                       placeholder="https://your-sdo-instance.com/admin">
                                <div class="form-text">Enter your SDO admin URL (with /admin)</div>
                            </div>
                            <div class="mb-3">
                                <label for="testSDOEmail" class="form-label">
                                    <i class="bi bi-envelope me-1"></i>Email
                                </label>
                                <input type="email" class="form-control" id="testSDOEmail" 
                                       value="amit.lavi@doubleoctopus.com"
                                       placeholder="admin@company.com">
                            </div>
                            <div class="mb-3">
                                <label for="testSDOPassword" class="form-label">
                                    <i class="bi bi-lock me-1"></i>Password
                                </label>
                                <input type="password" class="form-control" id="testSDOPassword" 
                                       placeholder="Enter your SDO password">
                                <div class="form-text text-warning">
                                    <i class="bi bi-exclamation-triangle me-1"></i>
                                    Enter your actual SDO password for testing
                                </div>
                            </div>
                            
                            <!-- Test Options -->
                            <div class="mb-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="fillMainForm" checked>
                                    <label class="form-check-label" for="fillMainForm">
                                        Auto-fill main form with these credentials
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="debugMode" checked>
                                    <label class="form-check-label" for="debugMode">
                                        Enable debug mode (detailed logging)
                                    </label>
                                </div>
                            </div>
                        </form>
                        
                        <!-- Status/Results area -->
                        <div id="testAuthStatus" class="mt-3" style="display: none;">
                            <div class="alert alert-info">
                                <div class="d-flex align-items-center">
                                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                                    <span>Testing authentication...</span>
                                </div>
                            </div>
                        </div>
                        
                        <div id="testAuthResult" class="mt-3" style="display: none;"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-outline-info" id="debugConnectionBtn">
                            <i class="bi bi-wifi me-1"></i>Test Connection Only
                        </button>
                        <button type="button" class="btn btn-primary" id="runTestAuthBtn">
                            <i class="bi bi-flask me-1"></i>Test Authentication
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    $('body').append(modalHTML);
    
    // Setup modal event handlers
    $('#runTestAuthBtn').on('click', function() {
        runSDOAuthTest();
    });
    
    $('#debugConnectionBtn').on('click', function() {
        testSDOConnectionOnly();
    });
    
    // Auto-focus password field when modal opens
    $('#testSDOModal').on('shown.bs.modal', function() {
        $('#testSDOPassword').focus();
    });
    
    // Handle Enter key in form
    $('#testSDOForm').on('submit', function(e) {
        e.preventDefault();
        runSDOAuthTest();
    });
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('testSDOModal'));
    modal.show();
    
    console.log('✅ Test modal opened');
}
function runSDOAuthTest() {
    const url = $('#testSDOUrl').val().trim();
    const email = $('#testSDOEmail').val().trim();
    const password = $('#testSDOPassword').val().trim();
    const fillMainForm = $('#fillMainForm').is(':checked');
    const debugMode = $('#debugMode').is(':checked');
    
    // Validation
    if (!url || !email || !password) {
        $('#testAuthResult').html(`
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Please fill in all fields
            </div>
        `).show();
        return;
    }
    
    if (debugMode) {
        console.log('🔧 Debug Mode Enabled');
        console.log('URL:', url);
        console.log('Email:', email);
        console.log('Password length:', password.length);
        console.log('Fill main form:', fillMainForm);
    }
    
    // Show loading state
    $('#testAuthStatus').show();
    $('#testAuthResult').hide();
    $('#runTestAuthBtn').prop('disabled', true);
    
    // Fill main form if requested
    if (fillMainForm) {
        $('#sdo-url').val(url);
        $('#sdo-email').val(email);
        $('#sdo-password').val(password);
        console.log('📝 Main form filled with test credentials');
    }
    
    // Clear any existing auth state
    if (typeof clearAuthState === 'function') {
        clearAuthState();
    }
    
    // Make the authentication request
    $.ajax({
        url: '/api/sdo/auth',
        method: 'POST',
        contentType: 'application/json',
        timeout: 20000, // Increased timeout
        data: JSON.stringify({
            url: url,
            email: email,
            password: password
        }),
        success: function(response) {
            console.log('✅ Test Authentication SUCCESS:', response);
            
            // Hide loading
            $('#testAuthStatus').hide();
            $('#runTestAuthBtn').prop('disabled', false);
            
            // Show success result
            let resultHTML = `
                <div class="alert alert-success">
                    <h6><i class="bi bi-check-circle-fill me-2"></i>Authentication Successful!</h6>
                    <hr>
                    <div class="row">
                        <div class="col-sm-3"><strong>Status:</strong></div>
                        <div class="col-sm-9">${response.status || 'authenticated'}</div>
                    </div>
                    <div class="row">
                        <div class="col-sm-3"><strong>Base URL:</strong></div>
                        <div class="col-sm-9"><code>${response.base_url || url}</code></div>
                    </div>
                    <div class="row">
                        <div class="col-sm-3"><strong>Token Length:</strong></div>
                        <div class="col-sm-9">${response.token_length || 'Session-based'} characters</div>
                    </div>
                    ${response.session_info ? `
                    <div class="row">
                        <div class="col-sm-3"><strong>Storage:</strong></div>
                        <div class="col-sm-9">${response.session_info.storage_method || 'direct'}</div>
                    </div>
                    ` : ''}
                </div>
                <div class="d-grid gap-2">
                    <button class="btn btn-outline-primary" onclick="closeTestModal(); generateQRCode();">
                        <i class="bi bi-qr-code me-1"></i>Generate QR Code Now
                    </button>
                    <button class="btn btn-outline-success" onclick="closeTestModal(); checkAuthStatus();">
                        <i class="bi bi-check-circle me-1"></i>Check Auth Status
                    </button>
                </div>
            `;
            
            $('#testAuthResult').html(resultHTML).show();
            
            // Update global state
            if (typeof handleAuthSuccess === 'function') {
                handleAuthSuccess(response);
            } else {
                // Fallback state update
                window.isAuthenticated = true;
                window.authToken = null; // Session-based
            }
            
            if (debugMode) {
                console.log('🔧 Full response details:', JSON.stringify(response, null, 2));
            }
        },
        error: function(xhr, status, error) {
            console.error('❌ Test Authentication FAILED:', {
                status: xhr.status,
                statusText: xhr.statusText,
                responseText: xhr.responseText,
                error: error
            });
            
            // Hide loading
            $('#testAuthStatus').hide();
            $('#runTestAuthBtn').prop('disabled', false);
            
            // Parse error message
            let errorMessage = 'Authentication failed';
            let errorDetails = {};
            
            try {
                const errorResponse = JSON.parse(xhr.responseText);
                errorMessage = errorResponse.error || errorResponse.message || errorMessage;
                errorDetails = errorResponse.details || {};
            } catch (e) {
                // Use status-based error messages
                if (xhr.status === 401) {
                    errorMessage = 'Invalid credentials - check email and password';
                } else if (xhr.status === 403) {
                    errorMessage = 'Access forbidden - check user permissions';
                } else if (xhr.status === 404) {
                    errorMessage = 'SDO server not found at this URL';
                } else if (xhr.status === 500) {
                    errorMessage = 'Server error during authentication';
                } else if (xhr.status === 0) {
                    errorMessage = 'Cannot connect to server - check URL and network';
                } else {
                    errorMessage = `HTTP ${xhr.status}: ${error}`;
                }
            }
            
            // Show error result
            let resultHTML = `
                <div class="alert alert-danger">
                    <h6><i class="bi bi-x-circle-fill me-2"></i>Authentication Failed</h6>
                    <hr>
                    <div class="row">
                        <div class="col-sm-3"><strong>Error:</strong></div>
                        <div class="col-sm-9">${errorMessage}</div>
                    </div>
                    <div class="row">
                        <div class="col-sm-3"><strong>HTTP Status:</strong></div>
                        <div class="col-sm-9">${xhr.status} ${xhr.statusText}</div>
                    </div>
                    ${Object.keys(errorDetails).length > 0 ? `
                    <div class="row">
                        <div class="col-sm-3"><strong>Details:</strong></div>
                        <div class="col-sm-9"><pre class="small">${JSON.stringify(errorDetails, null, 2)}</pre></div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="accordion" id="errorAccordion">
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#errorDetails">
                                <i class="bi bi-bug me-2"></i>Show Technical Details
                            </button>
                        </h2>
                        <div id="errorDetails" class="accordion-collapse collapse" data-bs-parent="#errorAccordion">
                            <div class="accordion-body">
                                <div class="row mb-2">
                                    <div class="col-sm-3"><strong>Request URL:</strong></div>
                                    <div class="col-sm-9"><code>/api/sdo/auth</code></div>
                                </div>
                                <div class="row mb-2">
                                    <div class="col-sm-3"><strong>SDO URL:</strong></div>
                                    <div class="col-sm-9"><code>${url}</code></div>
                                </div>
                                <div class="row mb-2">
                                    <div class="col-sm-3"><strong>Response:</strong></div>
                                    <div class="col-sm-9"><pre class="small bg-light p-2">${xhr.responseText || 'No response body'}</pre></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="d-grid gap-2 mt-3">
                    <button class="btn btn-outline-info" onclick="testSDOConnectionOnly()">
                        <i class="bi bi-wifi me-1"></i>Test Connection Only
                    </button>
                    <button class="btn btn-outline-secondary" onclick="$('#runTestAuthBtn').click()">
                        <i class="bi bi-arrow-clockwise me-1"></i>Try Again
                    </button>
                </div>
            `;
            
            $('#testAuthResult').html(resultHTML).show();
            
            if (debugMode) {
                console.log('🔧 Full error details:', {
                    xhr: xhr,
                    status: status,
                    error: error,
                    responseText: xhr.responseText
                });
            }
        }
    });
}

// Test connection only (without authentication)
function testSDOConnectionOnly() {
    const url = $('#testSDOUrl').val().trim();
    
    if (!url) {
        $('#testAuthResult').html(`
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Please enter SDO URL first
            </div>
        `).show();
        return;
    }
    
    console.log('🔌 Testing connection to:', url);
    
    // Show loading
    $('#testAuthStatus').show();
    $('#testAuthResult').hide();
    $('#debugConnectionBtn').prop('disabled', true);
    
    // Simple connection test - try to reach the server
    $.ajax({
        url: '/api/sdo/test-connection',
        method: 'POST',
        contentType: 'application/json',
        timeout: 10000,
        data: JSON.stringify({ url: url }),
        success: function(response) {
            $('#testAuthStatus').hide();
            $('#debugConnectionBtn').prop('disabled', false);
            
            $('#testAuthResult').html(`
                <div class="alert alert-success">
                    <h6><i class="bi bi-wifi me-2"></i>Connection Test Successful</h6>
                    <p>Server at <code>${url}</code> is reachable.</p>
                    <p>You can now try authentication with your credentials.</p>
                </div>
            `).show();
        },
        error: function(xhr, status, error) {
            $('#testAuthStatus').hide();
            $('#debugConnectionBtn').prop('disabled', false);
            
            let errorMsg = 'Connection failed';
            if (xhr.status === 0) {
                errorMsg = 'Cannot reach server - check URL and network';
            } else if (xhr.status === 404) {
                errorMsg = 'Server not found at this URL';
            } else {
                errorMsg = `Connection failed: ${error}`;
            }
            
            $('#testAuthResult').html(`
                <div class="alert alert-danger">
                    <h6><i class="bi bi-wifi-off me-2"></i>Connection Test Failed</h6>
                    <p>${errorMsg}</p>
                    <p>Please check the SDO URL and try again.</p>
                </div>
            `).show();
        }
    });
}

// Close the test modal
function closeTestModal() {
    const modalElement = document.getElementById('testSDOModal');
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
    }
}

// Clean up modal after it's hidden
$(document).on('hidden.bs.modal', '#testSDOModal', function() {
    $(this).remove();
});

// Make functions globally available
window.testSDOAuth = testSDOAuth;
window.runSDOAuthTest = runSDOAuthTest;
window.testSDOConnectionOnly = testSDOConnectionOnly;
window.closeTestModal = closeTestModal;
// Utility functions
function safeGetValue(selector, defaultValue) {
    const element = $(selector);
    if (element.length > 0) {
        return element.val() || defaultValue;
    }
    return defaultValue;
}

function safeSetValue(selector, value) {
    const element = $(selector);
    if (element.length > 0 && !element.val()) {
        element.val(value);
    }
}


function safeUpdateDebugStatus(message) {
    // Try multiple possible debug status elements
    const debugElements = ['#sdo-debug-status', '#last-action-status'];
    let updated = false;
    
    debugElements.forEach(selector => {
        const element = $(selector);
        if (element.length > 0) {
            element.text(message);
            updated = true;
        }
    });
    
    if (!updated) {
        console.log('📊 Debug status (no UI element):', message);
    }
}

// Improved Debug Session function with better error handling
function debugSDOSession() {
    console.log('🔍 Debugging SDO Session...');
    
    safeUpdateDebugStatus('Debugging session...');
    
    // Check if we can get session info
    $.ajax({
        url: '/debug/session',
        method: 'GET',
        timeout: 5000,
        success: function(response) {
            console.log('📊 Session debug info:', response);
            showDebugPopup(response);
        },
        error: function(xhr, status, error) {
            console.error('❌ Session debug failed:', error);
            
            // Show simplified debug info even if server request fails
            showSimpleDebugInfo();
            
            if (typeof showAlert === 'function') {
                showAlert('Session debug failed, showing local info instead: ' + error, 'warning');
            }
        }
    });
}

function showDebugPopup(response) {
    // Remove any existing debug popup
    $('#sdo-session-debug').remove();
    
    // Create debug popup
    const debugPopup = document.createElement('div');
    debugPopup.className = 'diagnostic-popup';
    debugPopup.id = 'sdo-session-debug';
    
    let debugHtml = '<div class="text-center">' +
        '<h6><i class="bi bi-bug me-2"></i>SDO Session Debug</h6>' +
        '<div style="text-align: left; font-size: 13px; max-height: 400px; overflow-y: auto;">';
    
    // Global state info (check if variables exist)
    debugHtml += '<div class="mb-3">' +
        '<strong>🌐 Global State:</strong><br>' +
        '• Authenticated: ' + (typeof isAuthenticated !== 'undefined' ? isAuthenticated : 'Unknown') + '<br>' +
        '• Auth Token: ' + (typeof authToken !== 'undefined' && authToken ? 'Present' : 'None') + '<br>' +
        '• jQuery Available: ' + (typeof $ !== 'undefined') + '<br>' +
        '• QRCode Available: ' + (typeof QRCode !== 'undefined') + '<br>';
    
    if (typeof window.portalState !== 'undefined') {
        debugHtml += '• Portal State: Available<br>';
    } else {
        debugHtml += '• Portal State: Not available<br>';
    }
    
    debugHtml += '</div>';
    
    // Session data from server
    if (response && response.session_data) {
        debugHtml += '<div class="mb-3">' +
            '<strong>🔐 Server Session Data:</strong><br>';
        
        Object.keys(response.session_data).forEach(key => {
            const value = response.session_data[key];
            debugHtml += '• ' + key + ': ' + JSON.stringify(value).substring(0, 50) + '<br>';
        });
        
        debugHtml += '</div>';
    }
    
    // Form data
    debugHtml += '<div class="mb-3">' +
        '<strong>📝 Form Data:</strong><br>' +
        '• URL: ' + safeGetValue('#sdo-url', 'Empty') + '<br>' +
        '• Email: ' + safeGetValue('#sdo-email', 'Empty') + '<br>' +
        '• Password: ' + (safeGetValue('#sdo-password', '') ? '***' : 'Empty') +
        '</div>';
    
    // UI State
    const authBadge = $('#auth-status-badge');
    const qrContent = $('#qrcode').children().length;
    
    debugHtml += '<div class="mb-3">' +
        '<strong>🎨 UI State:</strong><br>' +
        '• Auth Badge: ' + (authBadge.length > 0 ? authBadge.text() : 'Not found') + '<br>' +
        '• QR Content: ' + (qrContent > 0 ? 'Present (' + qrContent + ' elements)' : 'Empty') + '<br>' +
        '• Test Button: ' + ($('#test-sdo-auth-btn').length > 0 ? 'Found' : 'Not found') +
        '</div>';
    
    debugHtml += '</div>' +
        '<div class="mt-3">' +
        '<button onclick="copyDebugToConsole()" class="btn btn-primary btn-sm me-2">Log to Console</button>' +
        '<button onclick="closeSessionDebug()" class="btn btn-outline-secondary btn-sm">Close</button>' +
        '</div>' +
        '</div>';
    
    debugPopup.innerHTML = debugHtml;
    document.body.appendChild(debugPopup);
    
    safeUpdateDebugStatus('Session debug displayed');
}

function showSimpleDebugInfo() {
    const debugInfo = {
        authenticated: typeof isAuthenticated !== 'undefined' ? isAuthenticated : 'Unknown',
        authToken: typeof authToken !== 'undefined' && authToken ? 'Present' : 'None',
        jquery: typeof $ !== 'undefined',
        qrcode: typeof QRCode !== 'undefined',
        formData: {
            url: safeGetValue('#sdo-url', 'Empty'),
            email: safeGetValue('#sdo-email', 'Empty'),
            hasPassword: safeGetValue('#sdo-password', '') ? true : false
        }
    };
    
    console.log('🔍 Simple Debug Info:', debugInfo);
    
    if (typeof showAlert === 'function') {
        showAlert(
            'Debug Info (see console for details):<br>' +
            '• Authenticated: ' + debugInfo.authenticated + '<br>' +
            '• Auth Token: ' + debugInfo.authToken + '<br>' +
            '• Form URL: ' + debugInfo.formData.url,
            'info'
        );
    }
}

function copyDebugToConsole() {
    console.log('=== DEBUG INFO COPIED TO CONSOLE ===');
    console.log('Time:', new Date().toISOString());
    console.log('URL:', window.location.href);
    console.log('Global vars:', {
        isAuthenticated: typeof isAuthenticated !== 'undefined' ? isAuthenticated : 'undefined',
        authToken: typeof authToken !== 'undefined' ? (authToken ? 'present' : 'null') : 'undefined',
        portalState: typeof window.portalState !== 'undefined' ? window.portalState : 'undefined'
    });
    console.log('Form data:', {
        url: safeGetValue('#sdo-url', 'empty'),
        email: safeGetValue('#sdo-email', 'empty'),
        password: safeGetValue('#sdo-password', '') ? 'has_value' : 'empty'
    });
    console.log('=== END DEBUG INFO ===');
    
    if (typeof showAlert === 'function') {
        showAlert('Debug info logged to console!', 'success');
    }
}

function closeSessionDebug() {
    const popup = document.getElementById('sdo-session-debug');
    if (popup) {
        popup.remove();
    }
}

// Make functions globally available
window.testSDOAuth = testSDOAuth;
window.debugSDOSession = debugSDOSession;
window.closeSessionDebug = closeSessionDebug;
window.copyDebugToConsole = copyDebugToConsole;

// Test SDO connection without authentication
function testSDOConnection() {
    console.log('🔌 Testing SDO Connection...');
    
    const testUrl = 'https://amitmt.doubleoctopus.io/admin';
    updateDebugStatus('Testing connection to ' + testUrl);
    
    showAlert('Testing connection to SDO server...', 'info');
    
    // Try to reach the SDO server
    $.ajax({
        url: '/api/sdo/portal/check',
        method: 'GET',
        timeout: 10000,
        success: function(response) {
            console.log('✅ Connection test result:', response);
            
            if (response.accessible) {
                showAlert(
                    'SDO Server is accessible!<br>' +
                    '• Status Code: ' + response.status_code + '<br>' +
                    '• Portal URL: ' + response.portal_url,
                    'success'
                );
                updateDebugStatus('Connection successful');
            } else {
                showAlert(
                    'SDO Server connection failed<br>' +
                    '• Error: ' + (response.error || 'Unknown error'),
                    'warning'
                );
                updateDebugStatus('Connection failed');
            }
        },
        error: function(xhr, status, error) {
            console.error('❌ Connection test failed:', error);
            
            let errorMsg = 'Connection test failed: ';
            if (status === 'timeout') {
                errorMsg += 'Request timed out (server unreachable)';
            } else if (xhr.status === 0) {
                errorMsg += 'Network error (CORS or server down)';
            } else {
                errorMsg += error + ' (HTTP ' + xhr.status + ')';
            }
            
            showAlert(errorMsg, 'danger');
            updateDebugStatus('Connection failed: ' + error);
        }
    });
}

// Debug SDO session information
function debugSDOSession() {
    console.log('🔍 Debugging SDO Session...');
    
    updateDebugStatus('Debugging session...');
    
    // Get session debug info
    $.ajax({
        url: '/debug/session',
        method: 'GET',
        success: function(response) {
            console.log('📊 Session debug info:', response);
            
            // Create debug popup
            const debugPopup = document.createElement('div');
            debugPopup.className = 'diagnostic-popup';
            debugPopup.id = 'sdo-session-debug';
            
            let debugHtml = '<div class="text-center">' +
                '<h6><i class="bi bi-bug me-2"></i>SDO Session Debug</h6>' +
                '<div style="text-align: left; font-size: 13px; max-height: 400px; overflow-y: auto;">';
            
            // Global state info
            debugHtml += '<div class="mb-3">' +
                '<strong>🌐 Global State:</strong><br>' +
                '• Authenticated: ' + (isAuthenticated || false) + '<br>' +
                '• Auth Token: ' + (authToken ? 'Present (length: ' + authToken.length + ')' : 'None') + '<br>' +
                '• Users Found: ' + (usersFound || 0) + '<br>' +
                '• Invitations Sent: ' + (invitationsSent || 0) + '<br>' +
                '• QR Codes Generated: ' + (qrCodesGenerated || 0) +
                '</div>';
            
            // Session data from server
            if (response.session_data) {
                debugHtml += '<div class="mb-3">' +
                    '<strong>🔐 Server Session Data:</strong><br>';
                
                Object.keys(response.session_data).forEach(key => {
                    const value = response.session_data[key];
                    debugHtml += '• ' + key + ': ' + JSON.stringify(value) + '<br>';
                });
                
                debugHtml += '</div>';
            }
            
            // Form data
            debugHtml += '<div class="mb-3">' +
                '<strong>📝 Form Data:</strong><br>' +
                '• URL: ' + ($('#sdo-url').val() || 'Empty') + '<br>' +
                '• Email: ' + ($('#sdo-email').val() || 'Empty') + '<br>' +
                '• Password: ' + ($('#sdo-password').val() ? '***' : 'Empty') +
                '</div>';
            
            // UI State
            debugHtml += '<div class="mb-3">' +
                '<strong>🎨 UI State:</strong><br>' +
                '• Auth Badge: ' + $('#auth-status-badge').text() + '<br>' +
                '• QR Button: ' + ($('#generate-qr-btn').prop('disabled') ? 'Disabled' : 'Enabled') + '<br>' +
                '• QR Content: ' + ($('#qrcode').children().length > 0 ? 'Present' : 'Empty') +
                '</div>';
            
            // Library status
            debugHtml += '<div class="mb-3">' +
                '<strong>📚 Library Status:</strong><br>' +
                '• jQuery: ' + (typeof $ !== 'undefined' ? '✅' : '❌') + '<br>' +
                '• Bootstrap: ' + (typeof bootstrap !== 'undefined' ? '✅' : '❌') + '<br>' +
                '• QRCode: ' + (typeof QRCode !== 'undefined' ? '✅' : '❌') +
                '</div>';
            
            debugHtml += '</div>' +
                '<div class="mt-3">' +
                '<button onclick="copyDebugInfo()" class="btn btn-primary btn-sm me-2">Copy Info</button>' +
                '<button onclick="refreshDebugInfo()" class="btn btn-secondary btn-sm me-2">Refresh</button>' +
                '<button onclick="closeSessionDebug()" class="btn btn-outline-secondary btn-sm">Close</button>' +
                '</div>' +
                '</div>';
            
            debugPopup.innerHTML = debugHtml;
            document.body.appendChild(debugPopup);
            
            // Store debug data for copying
            window.debugData = {
                globalState: {
                    authenticated: isAuthenticated,
                    authToken: authToken ? 'Present' : 'None',
                    usersFound: usersFound,
                    invitationsSent: invitationsSent,
                    qrCodesGenerated: qrCodesGenerated
                },
                sessionData: response.session_data,
                formData: {
                    url: $('#sdo-url').val(),
                    email: $('#sdo-email').val(),
                    hasPassword: $('#sdo-password').val().length > 0
                },
                libraryStatus: {
                    jquery: typeof $ !== 'undefined',
                    bootstrap: typeof bootstrap !== 'undefined',
                    qrcode: typeof QRCode !== 'undefined'
                },
                timestamp: new Date().toISOString()
            };
            
            updateDebugStatus('Session debug displayed');
        },
        error: function(xhr, status, error) {
            console.error('❌ Session debug failed:', error);
            showAlert('Failed to get session debug info: ' + error, 'danger');
            updateDebugStatus('Debug failed: ' + error);
        }
    });
}

// Reset SDO authentication
function resetSDOAuth() {
    console.log('🔄 Resetting SDO Authentication...');
    
    updateDebugStatus('Resetting SDO authentication...');
    
    // Clear global state variables
    isAuthenticated = false;
    authToken = null;
    invitationsSent = 0;
    qrCodesGenerated = 0;
    usersFound = 0;
    
    // Clear session storage
    sessionStorage.removeItem('sdo_auth_token');
    sessionStorage.removeItem('sdo_auth_time');
    sessionStorage.removeItem('lastQRGenerated');
    
    // Remove auth headers
    $.ajaxSetup({
        beforeSend: function(xhr) {
            // Remove any auth headers by not setting them
        }
    });
    
    // Reset UI elements
    $('#auth-status-badge')
        .removeClass('bg-success bg-danger bg-info')
        .addClass('bg-warning')
        .html('<i class="bi bi-exclamation-triangle me-1"></i>Not Authenticated');
    
    // Clear form password (but keep URL and email for convenience)
    $('#sdo-password').val('');
    
    // Reset QR code area
    $('#qrcode').html(
        '<div class="text-muted text-center">' +
        '<i class="bi bi-qr-code" style="font-size: 3rem; opacity: 0.3;"></i>' +
        '<p class="mt-2">QR Code will appear here after authentication</p>' +
        '<button class="btn btn-outline-primary btn-sm" onclick="generateDirectQR()" id="generate-qr-btn" disabled>' +
        '<i class="bi bi-lightning me-1"></i>Generate Direct QR' +
        '</button>' +
        '</div>'
    );
    
    // Clear invitation info
    $('#invitation-id').html('');
    
    // Disable dependent features
    $('#generate-qr-btn').prop('disabled', true);
    $('[data-sdo-required="true"]').prop('disabled', true);
    
    // Clear search results
    $('#user-search-results').html('');
    $('#validation-results').html('');
    $('#status-results').html('');
    
    // Update stats
    updateStats();
    
    // Call logout API to clear server session
    $.ajax({
        url: '/api/sdo/logout',
        method: 'POST',
        success: function(response) {
            console.log('✅ Server session cleared');
        },
        error: function(xhr, status, error) {
            console.log('⚠️ Server session clear failed:', error);
        }
    });
    
    showAlert('SDO authentication reset successfully', 'info');
    updateDebugStatus('Authentication reset complete');
}

// Update debug status display
function updateDebugStatus(message) {
    // Try multiple possible debug status elements
    const debugElements = ['#sdo-debug-status', '#last-action-status'];
    let updated = false;
    
    debugElements.forEach(selector => {
        const element = $(selector);
        if (element.length > 0) {
            element.text(message);
            updated = true;
        }
    });
    
    if (!updated) {
        console.log('📊 Debug status (no UI element):', message);
    }
}
// Copy debug information to clipboard
function copyDebugInfo() {
    if (window.debugData) {
        const debugText = JSON.stringify(window.debugData, null, 2);
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(debugText).then(function() {
                showAlert('Debug info copied to clipboard!', 'success');
            }).catch(function() {
                fallbackCopyDebugInfo(debugText);
            });
        } else {
            fallbackCopyDebugInfo(debugText);
        }
    } else {
        showAlert('No debug data available to copy', 'warning');
    }
}

// Fallback copy method for debug info
function fallbackCopyDebugInfo(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showAlert('Debug info copied to clipboard!', 'success');
    } catch (err) {
        prompt('Copy this debug info:', text);
    }
    document.body.removeChild(textArea);
}

// Refresh debug information
function refreshDebugInfo() {
    closeSessionDebug();
    setTimeout(function() {
        debugSDOSession();
    }, 100);
}

// Close session debug popup
function closeSessionDebug() {
    const popup = document.getElementById('sdo-session-debug');
    if (popup) popup.remove();
}

// Enhanced check auth status with debug info (override existing if present)
function checkAuthStatus() {
    console.log('📊 Checking SDO authentication status...');
    
    updateDebugStatus('Checking authentication status...');
    
    $.ajax({
        url: '/api/sdo/status',
        method: 'GET',
        timeout: 10000,
        success: function(response) {
            console.log('📊 Auth status response:', response);
            
            if (response.authenticated) {
                // Update global state
                isAuthenticated = true;
                authToken = null; // Session-based auth
                
                // Update UI
                $('#auth-status-badge')
                    .removeClass('bg-warning bg-danger')
                    .addClass('bg-success')
                    .html('<i class="bi bi-check-circle me-1"></i>Authenticated');
                
                // Enable features
                $('#generate-qr-btn').prop('disabled', false);
                
                // Pre-fill form if we have the data
                if (response.base_url && !$('#sdo-url').val()) {
                    $('#sdo-url').val(response.base_url);
                }
                if (response.email && !$('#sdo-email').val()) {
                    $('#sdo-email').val(response.email);
                }
                
                // Show detailed status
                showAlert(
                    'SDO Authentication Status: ✅ Authenticated<br>' +
                    '• Base URL: ' + response.base_url + '<br>' +
                    '• Email: ' + response.email + '<br>' +
                    '• Token Length: ' + (response.token_length || 'Session-based') + ' characters',
                    'success'
                );
                
                updateDebugStatus('Authenticated to ' + response.base_url);
                
                console.log('✅ Already authenticated to:', response.base_url);
            } else {
                // Update state
                isAuthenticated = false;
                authToken = null;
                
                // Update UI
                $('#auth-status-badge')
                    .removeClass('bg-success bg-info')
                    .addClass('bg-warning')
                    .html('<i class="bi bi-exclamation-triangle me-1"></i>Not Authenticated');
                
                showAlert('SDO Authentication Status: ❌ Not Authenticated', 'warning');
                updateDebugStatus('Not authenticated');
                
                console.log('❌ Not authenticated');
            }
        },
        error: function(xhr, status, error) {
            console.error('❌ Status check failed:', error);
            
            let errorMsg = 'Status check failed: ';
            if (status === 'timeout') {
                errorMsg += 'Request timed out';
            } else if (xhr.status === 0) {
                errorMsg += 'Network error (server may be down)';
            } else {
                errorMsg += error + ' (HTTP ' + xhr.status + ')';
            }
            
            showAlert(errorMsg, 'danger');
            updateDebugStatus('Status check failed: ' + error);
            
            isAuthenticated = false;
            authToken = null;
        }
    });
}


// Make new functions globally available
window.testSDOAuth = testSDOAuth;
window.testSDOConnection = testSDOConnection;
window.debugSDOSession = debugSDOSession;
window.resetSDOAuth = resetSDOAuth;
window.updateDebugStatus = updateDebugStatus;
window.copyDebugInfo = copyDebugInfo;
window.refreshDebugInfo = refreshDebugInfo;
window.closeSessionDebug = closeSessionDebug;

// ===== UPDATE YOUR EXISTING CONSOLE.LOG SECTION AT THE END =====
// Replace or add to your existing console.log statements at the end of the file:

console.log('✅ Enhanced SDO Test functions loaded:');
console.log('- testSDOAuth() - Test authentication with form data');
console.log('- testSDOConnection() - Test server connection without auth');
console.log('- debugSDOSession() - Complete session debugging popup');
console.log('- resetSDOAuth() - Reset all authentication state');
console.log('- checkAuthStatus() - Enhanced authentication status check');
console.log('- updateDebugStatus() - Update debug status indicators');

// Add date of birth validation
function isValidDateOfBirth(dob) {
    // Accepts YYYY-MM-DD, must be in the past and reasonable (not before 1900)
    if (!dob) return false;
    const date = new Date(dob);
    const now = new Date();
    if (isNaN(date.getTime())) return false;
    if (date > now) return false;
    if (date.getFullYear() < 1900) return false;
    return true;
}

function goToStep(step) {
    // ... existing code ...
    // Show/hide steps logic
    // ... existing code ...
    if (step === 7) {
        if (!sdoEnrollmentStarted) {
            sdoEnrollmentStarted = true;
            if (typeof startEnrollment === 'function') {
                startEnrollment();
            } else if (typeof sendInvitation === 'function') {
                sendInvitation();
            } else {
                console.warn('No SDO enrollment function found for Step 7');
            }
        }
    } else {
        sdoEnrollmentStarted = false;
    }
    // ... existing code ...
}

// ... existing code ...
function toggleComparisonBlock() {
    const block = document.getElementById('comparison-block');
    const btn = document.getElementById('show-details-btn');
    if (block.style.display === 'none' || block.style.display === '') {
        block.style.display = 'flex';
        btn.innerHTML = '<i class="bi bi-eye-slash me-2"></i>Hide Details';
    } else {
        block.style.display = 'none';
        btn.innerHTML = '<i class="bi bi-eye me-2"></i>Show Details';
    }
}
// ... existing code ...

// After successful verification in Step 3, show the comparison block and next button
function showComparisonAfterVerification(au10tixData) {
    populateComparisonBlock(au10tixData);
    document.getElementById('comparison-block').style.display = 'flex';
    document.getElementById('enrollment-next-btn').style.display = 'block';
}

function showComparisonBlock() {
    // Show both comparison blocks
    $('#comparison-block').show();
    $('#comparison-analysis').show();
    
    // Populate the basic comparison
    $('#entered-firstname').text(userData.firstName || 'N/A');
    $('#entered-lastname').text(userData.lastName || 'N/A');
    $('#entered-email').text(userData.email || 'N/A');
    $('#entered-phone').text(userData.phone || 'N/A');
    $('#entered-dob').text(userData.dateOfBirth || 'N/A');
    $('#entered-idnumber').text(userData.idNumber || 'N/A');
    
    $('#verified-firstname').text(verificationData.firstName || 'N/A');
    $('#verified-lastname').text(verificationData.lastName || 'N/A');
    $('#verified-dob').text(verificationData.dateOfBirth || 'N/A');
    $('#verified-id').text(verificationData.idNumber || 'N/A');
    
    // Enhanced comparison analysis
    let matchCount = 0;
    const totalFields = 4; // firstName, lastName, dateOfBirth, idNumber
    
    // First Name comparison
    const firstNameMatch = compareStrings(userData.firstName, verificationData.firstName);
    $('#analysis-firstname-entered').text(userData.firstName || 'N/A');
    $('#analysis-firstname-verified').text(verificationData.firstName || 'N/A');
    if (firstNameMatch) {
        $('#firstname-status').html('<span class="badge bg-success"><i class="bi bi-check-circle"></i> Match</span>');
        $('#firstname-match').addClass('table-success');
        matchCount++;
    } else {
        $('#firstname-status').html('<span class="badge bg-danger"><i class="bi bi-x-circle"></i> Mismatch</span>');
        $('#firstname-match').addClass('table-danger');
    }
    
    // Last Name comparison
    const lastNameMatch = compareStrings(userData.lastName, verificationData.lastName);
    $('#analysis-lastname-entered').text(userData.lastName || 'N/A');
    $('#analysis-lastname-verified').text(verificationData.lastName || 'N/A');
    if (lastNameMatch) {
        $('#lastname-status').html('<span class="badge bg-success"><i class="bi bi-check-circle"></i> Match</span>');
        $('#lastname-match').addClass('table-success');
        matchCount++;
    } else {
        $('#lastname-status').html('<span class="badge bg-danger"><i class="bi bi-x-circle"></i> Mismatch</span>');
        $('#lastname-match').addClass('table-danger');
    }
    
    // Date of Birth comparison
    const dobMatch = compareStrings(userData.dateOfBirth, verificationData.dateOfBirth);
    $('#analysis-dob-entered').text(userData.dateOfBirth || 'N/A');
    $('#analysis-dob-verified').text(verificationData.dateOfBirth || 'N/A');
    if (dobMatch) {
        $('#dob-status').html('<span class="badge bg-success"><i class="bi bi-check-circle"></i> Match</span>');
        $('#dob-match').addClass('table-success');
        matchCount++;
    } else {
        $('#dob-status').html('<span class="badge bg-danger"><i class="bi bi-x-circle"></i> Mismatch</span>');
        $('#dob-match').addClass('table-danger');
    }
    
    // ID Number comparison
    const idNumberMatch = compareStrings(userData.idNumber, verificationData.idNumber);
    $('#analysis-idnumber-entered').text(userData.idNumber || 'N/A');
    $('#analysis-idnumber-verified').text(verificationData.idNumber || 'N/A');
    if (idNumberMatch) {
        $('#idnumber-status').html('<span class="badge bg-success"><i class="bi bi-check-circle"></i> Match</span>');
        $('#idnumber-match').addClass('table-success');
        matchCount++;
    } else {
        $('#idnumber-status').html('<span class="badge bg-danger"><i class="bi bi-x-circle"></i> Mismatch</span>');
        $('#idnumber-match').addClass('table-danger');
    }
    
    // Summary
    $('#match-count').html(`<strong>${matchCount} of ${totalFields} fields match</strong>`);
    
    if (matchCount === totalFields) {
        $('#overall-status').removeClass('alert-danger alert-warning').addClass('alert-success')
            .html('<i class="bi bi-check-circle-fill"></i> <strong>Verification Passed</strong><br>All fields match successfully');
    } else if (matchCount > 0) {
        $('#overall-status').removeClass('alert-success alert-danger').addClass('alert-warning')
            .html('<i class="bi bi-exclamation-triangle-fill"></i> <strong>Partial Match</strong><br>Some fields do not match');
    } else {
        $('#overall-status').removeClass('alert-success alert-warning').addClass('alert-danger')
            .html('<i class="bi bi-x-circle-fill"></i> <strong>Verification Failed</strong><br>No fields match');
    }
    
    // Show the next button
    $('#enrollment-next-btn').show();
}

// Helper function to compare strings (case-insensitive, trim whitespace)
function compareStrings(str1, str2) {
    if (!str1 && !str2) return true; // Both empty/null
    if (!str1 || !str2) return false; // One is empty/null
    
    return str1.toString().trim().toLowerCase() === str2.toString().trim().toLowerCase();
}

// Helper function to update Step 4 button text based on enrollment status
function updateStep4ButtonText() {
    const buttonText = $('#step-4-next-text');
    console.log('Updating Step 4 button text. Enrollment status:', enrollmentCompleted);
    
    if (enrollmentCompleted.fido && !enrollmentCompleted.octopus) {
        buttonText.text('Next: Complete Process');
        console.log('FIDO-only enrollment detected, button text set to "Next: Complete Process"');
    } else {
        buttonText.text('Next: Test Authentication');
        console.log('OCTOPUS enrollment detected, button text set to "Next: Test Authentication"');
    }
}

// Add dual enrollment functions for Step 4
function enrollOctopus() {
    $('#octopus-enrollment-area').hide();
    $('#fido-enrollment-area').hide();
    $('#step-4-alerts').html('');
    
    $.ajax({
        url: '/api/sdo/invite',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            email: userData.email,
            userId: userData.id,
            type: 'OCTOPUS'
        }),
        success: function(response) {
            console.log('OCTOPUS invitation response:', response);
            
            // Check for the new response format
            const invitationId = response.octopus_invitationId || response.invitationId;
            
            if (invitationId) {
                $('#octopus-invitation-id').text(invitationId);
                // Generate QR code for OCTOPUS
                const qrUrl = 'https://doubleoctopus.com/enroll?code=' + invitationId;
                $('#octopus-qr-code-image').attr('src', 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qrUrl));
                $('#octopus-enrollment-area').show();
                $('#fido-enrollment-area').hide();
                $('#step-4-alerts').html('<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>OCTOPUS invitation sent successfully!</div>');
                
                // Mark OCTOPUS enrollment as completed
                enrollmentCompleted.octopus = true;
                
                // Update button text and enable the button
                updateStep4ButtonText();
                $('#step-4-next').prop('disabled', false);
            } else {
                $('#step-4-alerts').html('<div class="alert alert-danger"><i class="bi bi-x-circle me-2"></i>Failed to send OCTOPUS invitation: ' + (response.octopus_error || 'No invitation ID received') + '</div>');
                $('#step-4-next').prop('disabled', true);
            }
        },
        error: function(xhr) {
            console.error('OCTOPUS invitation error:', xhr);
            $('#step-4-alerts').html('<div class="alert alert-danger"><i class="bi bi-x-circle me-2"></i>Server error sending OCTOPUS invitation.</div>');
            $('#step-4-next').prop('disabled', true);
        }
    });
}

function enrollFIDO() {
    $('#octopus-enrollment-area').hide();
    $('#fido-enrollment-area').hide();
    $('#step-4-alerts').html('');
    
    $.ajax({
        url: '/api/sdo/invite',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            email: userData.email,
            userId: userData.id,
            type: 'FIDO'
        }),
        success: function(response) {
            console.log('FIDO invitation response:', response);
            
            // Check for the new response format
            const invitationId = response.fido_invitationId || response.invitationId;
            
            if (invitationId) {
                const fidoLink = 'https://amitmt.doubleoctopus.io?invitation=' + invitationId;
                $('#fido-invitation-link').html('<a href="' + fidoLink + '" target="_blank" class="btn btn-primary">' + fidoLink + '</a>');
                $('#fido-enrollment-area').show();
                $('#octopus-enrollment-area').hide();
                $('#step-4-alerts').html('<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>FIDO invitation sent successfully!</div>');
                
                // Mark FIDO enrollment as completed
                enrollmentCompleted.fido = true;
                
                // Update button text and enable the button
                updateStep4ButtonText();
                $('#step-4-next').prop('disabled', false);
            } else {
                $('#step-4-alerts').html('<div class="alert alert-danger"><i class="bi bi-x-circle me-2"></i>Failed to send FIDO invitation: ' + (response.fido_error || 'No invitation ID received') + '</div>');
                $('#step-4-next').prop('disabled', true);
            }
        },
        error: function(xhr) {
            console.error('FIDO invitation error:', xhr);
            $('#step-4-alerts').html('<div class="alert alert-danger"><i class="bi bi-x-circle me-2"></i>Server error sending FIDO invitation.</div>');
            $('#step-4-next').prop('disabled', true);
        }
    });
}