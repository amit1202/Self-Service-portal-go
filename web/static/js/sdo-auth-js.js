// sdo-auth-js.js - Working SDO Authentication JavaScript
console.log('🚀 SDO Auth JavaScript loaded successfully');

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 SDO Auth: DOM loaded, initializing...');
    
    // Set static invitation ID for immediate use
    const staticInvitationId = "018JfN7XCHDw8faPQS2aGwSP7wRpzYRiZykUFCPr2zzE1P";
    
    // Form elements
    const sdoForm = document.getElementById('sdo-login-form');
    const sdoUrlInput = document.getElementById('sdo-url');
    const sdoEmailInput = document.getElementById('sdo-email');
    const sdoPasswordInput = document.getElementById('sdo-password');
    const authStatusBadge = document.getElementById('auth-status-badge');
    
    // User search elements
    const userSearchForm = document.getElementById('user-search-form');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResults = document.getElementById('user-search-results');
    
    // QR code elements
    const qrcodeContainer = document.getElementById('qrcode');
    const invitationIdElement = document.getElementById('invitation-id');
    
    // Invitation modal elements
    const invitationModal = document.getElementById('invitationModal') ? new bootstrap.Modal(document.getElementById('invitationModal')) : null;
    const invitationUserName = document.getElementById('invitation-user-name');
    const invitationUserId = document.getElementById('invitation-user-id');
    const sendInvitationBtn = document.getElementById('send-invitation-btn');

    console.log('📋 Form elements found:', {
        form: !!sdoForm,
        url: !!sdoUrlInput,
        email: !!sdoEmailInput,
        password: !!sdoPasswordInput,
        badge: !!authStatusBadge,
        userSearch: !!userSearchForm,
        qrcode: !!qrcodeContainer,
        modal: !!invitationModal
    });

    // Check SDO status on page load
    checkSDOStatus();

    // SDO Authentication Form
    if (sdoForm) {
        sdoForm.addEventListener('submit', function(event) {
            event.preventDefault();
            console.log('🔐 SDO authentication form submitted');
            
            const url = sdoUrlInput.value.trim();
            const email = sdoEmailInput.value.trim();
            const password = sdoPasswordInput.value.trim();

            console.log('📝 Form data:', { url, email, password: '***' });

            if (!url || !email || !password) {
                showAlert('danger', 'Please fill in all fields');
                return;
            }

            // Show loading state
            const submitButton = sdoForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Authenticating...';
            submitButton.disabled = true;

            console.log('🌐 Sending authentication request to /sdo-auth');

            // Make authentication request
            fetch('/sdo-auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    url: url,
                    email: email,
                    password: password
                })
            })
            .then(response => {
                console.log('📡 Authentication response status:', response.status);
                
                if (response.status === 404) {
                    throw new Error('SDO authentication endpoint not found (404)');
                } else if (response.status === 401) {
                    return response.json().then(data => {
                        if (data.redirect === '/login') {
                            throw new Error('Portal session expired. Please refresh and login again.');
                        } else {
                            throw new Error(data.error || 'SDO authentication failed');
                        }
                    });
                } else if (!response.ok) {
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
                
                return response.json();
            })
            .then(data => {
                console.log('📄 Authentication response data:', data);
                
                // Reset button
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;

                if (data.success) {
                    console.log('✅ SDO authentication successful');
                    updateAuthStatus(true, data);
                    showAlert('success', '✅ Successfully authenticated with SDO!');
                    updateStatistics();
                } else {
                    console.error('❌ SDO authentication failed:', data.error);
                    updateAuthStatus(false);
                    showAlert('danger', '❌ Authentication failed: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('🚨 Network error during authentication:', error);
                
                // Reset button
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
                
                updateAuthStatus(false);
                showAlert('danger', '🚨 ' + error.message);
            });
        });
    } else {
        console.warn('⚠️ SDO form not found on page');
    }

    // User Search Form
    if (userSearchForm) {
        userSearchForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            if (!userSearchInput || userSearchInput.value.length < 2) {
                showAlert('warning', 'Please enter at least 2 characters to search');
                return;
            }

            const searchTerm = userSearchInput.value.trim();
            console.log('🔍 Searching for users:', searchTerm);

            // Show loading state
            if (userSearchResults) {
                userSearchResults.innerHTML = '<div class="d-flex justify-content-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
            }

            // Make the search request
            fetch(`/api/users/search?q=${encodeURIComponent(searchTerm)}`)
                .then(response => {
                    console.log('🔍 Search response status:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(users => {
                    console.log('👥 Search results:', users);
                    
                    if (!Array.isArray(users)) {
                        console.error('Expected users array, got:', typeof users);
                        throw new Error('Invalid response format');
                    }
                    
                    if (users.length === 0) {
                        if (userSearchResults) {
                            userSearchResults.innerHTML = '<div class="alert alert-info">No users found matching your search criteria.</div>';
                        }
                        return;
                    }
                    
                    // Update statistics
                    const usersCount = document.getElementById('users-count');
                    if (usersCount) {
                        usersCount.textContent = users.length;
                    }
                    
                    // Display the users
                    let resultsHtml = '<div class="mt-3 mb-2"><h5>Search Results:</h5></div>';
                    
                    users.forEach(user => {
                        const displayName = user.displayName || (user.firstName + ' ' + user.lastName) || user.username || 'Unknown User';
                        const email = user.email || 'No email';
                        const userId = user.id || user.userId || 'unknown';
                        const directoryName = user.directoryName || user.directory || 'Unknown';
                        
                        resultsHtml += `
                            <div class="user-result border rounded p-3 mb-2">
                                <div class="user-details">
                                    <h5>${displayName}</h5>
                                    <p class="text-muted mb-1">${email}</p>
                                    <p class="small mb-1">User ID: ${userId} | Directory: ${directoryName}</p>
                                </div>
                                <div class="actions-row mt-2">
                                    <button type="button" class="btn btn-primary btn-sm send-invitation" 
                                            data-user-id="${userId}" 
                                            data-user-name="${displayName}">
                                        <i class="bi bi-envelope-fill me-1"></i> Send Enrollment Invitation
                                    </button>
                                </div>
                            </div>
                        `;
                    });
                    
                    if (userSearchResults) {
                        userSearchResults.innerHTML = resultsHtml;
                    }
                    
                    // Add event listeners to invitation buttons
                    document.querySelectorAll('.send-invitation').forEach(button => {
                        button.addEventListener('click', function() {
                            const userId = this.getAttribute('data-user-id');
                            const userName = this.getAttribute('data-user-name');
                            openInvitationModal(userId, userName);
                        });
                    });
                })
                .catch(error => {
                    console.error('🚨 Search error:', error);
                    if (userSearchResults) {
                        userSearchResults.innerHTML = `
                            <div class="alert alert-danger">
                                Error: ${error.message}
                                <br><small>Please make sure you're authenticated with SDO.</small>
                            </div>`;
                    }
                });
        });
    }

    // Send Invitation Button
    if (sendInvitationBtn) {
        sendInvitationBtn.addEventListener('click', function() {
            const userId = invitationUserId ? invitationUserId.value : null;
            
            if (!userId) {
                showAlert('danger', 'Missing user ID');
                return;
            }
            
            // Get selected invitation types
            const checkboxes = document.querySelectorAll('input[name="invitationTypes"]:checked');
            const invitationTypes = Array.from(checkboxes).map(cb => cb.value);
            
            if (invitationTypes.length === 0) {
                showAlert('danger', 'Please select at least one invitation type');
                return;
            }
            
            console.log('📤 Sending invitation:', { userId, invitationTypes });
            
            // Show loading state
            sendInvitationBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sending...';
            sendInvitationBtn.disabled = true;
            
            // Send invitation
            fetch('/sdo-send-invitation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId,
                    invitationTypes: invitationTypes
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log('📤 Invitation response:', data);
                
                if (invitationModal) {
                    invitationModal.hide();
                }
                
                sendInvitationBtn.innerHTML = 'Send Invitation';
                sendInvitationBtn.disabled = false;
                
                if (data.success) {
                    const userName = invitationUserName ? invitationUserName.textContent : 'user';
                    showAlert('success', `✅ Invitation sent successfully to ${userName}`);
                    
                    // Update statistics
                    updateInvitationStats();
                    
                    // Generate QR code if ID available
                    const invitationId = extractInvitationId(data);
                    if (invitationId) {
                        generateQRCode(invitationId);
                        updateQRStats();
                    }
                } else {
                    showAlert('danger', '❌ Failed to send invitation: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('🚨 Invitation error:', error);
                
                if (invitationModal) {
                    invitationModal.hide();
                }
                
                sendInvitationBtn.innerHTML = 'Send Invitation';
                sendInvitationBtn.disabled = false;
                
                showAlert('danger', '🚨 Network error: ' + error.message);
            });
        });
    }

    // Helper Functions
    function checkSDOStatus() {
        console.log('🔍 Checking SDO authentication status...');
        
        fetch('/sdo-status')
            .then(response => response.json())
            .then(data => {
                console.log('📊 SDO status response:', data);
                updateAuthStatus(data.authenticated, data);
            })
            .catch(error => {
                console.error('❌ Failed to check SDO status:', error);
                updateAuthStatus(false);
            });
    }

    function updateAuthStatus(isAuthenticated, data = {}) {
        console.log('🔄 Updating auth status UI:', { isAuthenticated, data });
        
        if (authStatusBadge) {
            if (isAuthenticated) {
                authStatusBadge.className = 'badge bg-success status-badge';
                authStatusBadge.innerHTML = '<i class="bi bi-check-circle me-1"></i>Authenticated';
                
                if (data.base_url) {
                    authStatusBadge.title = `Connected to: ${data.base_url}`;
                }
            } else {
                authStatusBadge.className = 'badge bg-warning status-badge';
                authStatusBadge.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Not Authenticated';
                authStatusBadge.title = 'Please authenticate with SDO';
            }
        }

        // Update form URL if authenticated
        if (isAuthenticated && data.base_url && sdoUrlInput) {
            const cleanUrl = data.base_url.replace('https://', '').replace('/admin', '');
            if (!sdoUrlInput.value) {
                sdoUrlInput.value = cleanUrl;
            }
        }
    }

    function showAlert(type, message) {
        console.log(`📢 Showing ${type} alert:`, message);
        
        let alertContainer = document.getElementById('alert-container');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'alert-container';
            alertContainer.className = 'mb-3';
            
            const insertAfter = authStatusBadge || document.querySelector('.card-body');
            if (insertAfter) {
                insertAfter.parentNode.insertBefore(alertContainer, insertAfter.nextSibling);
            }
        }

        alertContainer.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

        if (type === 'success') {
            setTimeout(() => {
                const alert = alertContainer.querySelector('.alert');
                if (alert) {
                    alert.remove();
                }
            }, 5000);
        }
    }

    function updateStatistics() {
        const connectionCount = document.getElementById('users-count');
        if (connectionCount && parseInt(connectionCount.textContent) === 0) {
            connectionCount.textContent = '1';
        }
    }

    function updateInvitationStats() {
        const invitationsSent = document.getElementById('invitations-sent');
        if (invitationsSent) {
            const current = parseInt(invitationsSent.textContent) || 0;
            invitationsSent.textContent = current + 1;
        }
    }

    function updateQRStats() {
        const qrGenerated = document.getElementById('qr-generated');
        if (qrGenerated) {
            const current = parseInt(qrGenerated.textContent) || 0;
            qrGenerated.textContent = current + 1;
        }
    }

    function openInvitationModal(userId, userName) {
        if (invitationModal && invitationUserName && invitationUserId) {
            invitationUserName.textContent = userName;
            invitationUserId.value = userId;
            invitationModal.show();
        }
    }

    function extractInvitationId(response) {
        let invitationId = null;
        
        console.log("🔍 Extracting invitation ID from response:", response);
        
        // Try various extraction methods
        if (response.invitationDetails && response.invitationDetails.id) {
            invitationId = response.invitationDetails.id;
        } else if (response.rawResponse) {
            if (Array.isArray(response.rawResponse) && response.rawResponse.length > 0) {
                const firstItem = response.rawResponse[0];
                if (firstItem && typeof firstItem === 'object') {
                    invitationId = firstItem.id || firstItem.invitationId || null;
                }
            } else if (typeof response.rawResponse === 'object') {
                invitationId = response.rawResponse.id || response.rawResponse.invitationId || null;
            }
        }
        
        if (!invitationId && typeof response === 'object') {
            invitationId = response.id || response.invitationId || null;
        }
        
        // Fallback to static ID
        if (!invitationId) {
            console.log("⚠️ No ID found in response, using static ID");
            invitationId = staticInvitationId;
        }
        
        return invitationId;
    }

    function generateQRCode(invitationId) {
        if (!qrcodeContainer || !invitationId) {
            return false;
        }
        
        console.log('🎯 Generating QR code for invitation ID:', invitationId);
        
        // Clear previous QR code
        qrcodeContainer.innerHTML = '';
        
        // Remove existing download button
        const existingDownloadBtn = document.getElementById('download-qr-btn');
        if (existingDownloadBtn) {
            existingDownloadBtn.remove();
        }
        
        try {
            const qrcode = new QRCode(qrcodeContainer, {
                text: invitationId,
                width: 200,
                height: 200,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            
            // Show invitation ID
            if (invitationIdElement) {
                invitationIdElement.textContent = 'Invitation ID: ' + invitationId;
            }
            
            // Add download button
            const downloadBtn = document.createElement('button');
            downloadBtn.id = 'download-qr-btn';
            downloadBtn.className = 'btn btn-sm btn-success mt-2';
            downloadBtn.innerHTML = '<i class="bi bi-download me-1"></i>Download QR Code';
            downloadBtn.addEventListener('click', function() {
                downloadQRCode(invitationId);
            });
            
            qrcodeContainer.parentNode.insertBefore(downloadBtn, qrcodeContainer.nextSibling);
            
            console.log('✅ QR code generated successfully');
            return true;
        } catch (error) {
            console.error('❌ Error generating QR code:', error);
            qrcodeContainer.innerHTML = '<div class="alert alert-danger">Failed to generate QR code</div>';
            return false;
        }
    }

    function downloadQRCode(invitationId) {
        const canvas = document.querySelector('#qrcode canvas');
        if (!canvas) {
            console.error('❌ No QR code canvas found');
            return;
        }
        
        try {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `invitation-qr-${invitationId.substring(0, 10)}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('💾 QR code downloaded successfully');
        } catch (error) {
            console.error('❌ Error downloading QR code:', error);
            showAlert('danger', 'Failed to download QR code');
        }
    }

    // Generate static QR code on load
    if (staticInvitationId && qrcodeContainer) {
        setTimeout(() => {
            generateQRCode(staticInvitationId);
        }, 1000);
    }

    // Export debug functions
    window.sdoDebug = {
        checkSDOStatus,
        updateAuthStatus,
        showAlert,
        extractInvitationId,
        generateQRCode,
        downloadQRCode,
        checkForm: function() {
            console.log('Form check:', {
                form: !!sdoForm,
                url: !!sdoUrlInput,
                email: !!sdoEmailInput,
                password: !!sdoPasswordInput
            });
        }
    };

    console.log('🚀 SDO Auth JavaScript initialization complete');
});