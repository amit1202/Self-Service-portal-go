/* Dashboard JavaScript */

// Define verification status constants
const VERIFICATION_STATUSES = {
    PENDING: "PENDING",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    EXPIRED: "EXPIRED",
    REJECTED: "REJECTED"
};

// Enhanced verification ID extraction function that prioritizes sessionId
function extractVerificationId(response) {
  if (!response) return null;

  console.log("Extracting verification ID from response:", JSON.stringify(response, null, 2));

  // Direct check for sessionId at the root level (from GET API)
  if (response.sessionId) {
    console.log("Found direct 'sessionId' field:", response.sessionId);
    return response.sessionId;
  }

  // Check session object if it exists
  if (response.session && response.session.id) {
    console.log("Found 'session.id' field:", response.session.id);
    return response.session.id;
  }

  // Check nested properties for sessionId
  if (response.data && response.data.sessionId) {
    console.log("Found sessionId in data object:", response.data.sessionId);
    return response.data.sessionId;
  }

  if (response.result && response.result.sessionId) {
    console.log("Found sessionId in result object:", response.result.sessionId);
    return response.result.sessionId;
  }

  if (response.workflow && response.workflow.sessionId) {
    console.log("Found sessionId in workflow object:", response.workflow.sessionId);
    return response.workflow.sessionId;
  }

  if (response.serviceDetails && response.serviceDetails.secureme && response.serviceDetails.secureme.sessionId) {
    console.log("Found sessionId in serviceDetails.secureme:", response.serviceDetails.secureme.sessionId);
    return response.serviceDetails.secureme.sessionId;
  }

  // Deep scan for any property named sessionId
  function deepScanForSessionId(obj, prefix = '') {
    if (!obj || typeof obj !== 'object') return null;

    for (const key in obj) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      const keyLower = key.toLowerCase();

      // If the property name is sessionId or contains both session and id
      if (key === 'sessionId' || (keyLower.includes('session') && keyLower.includes('id'))) {
        if (typeof obj[key] === 'string' || typeof obj[key] === 'number') {
          console.log(`Deep scan found sessionId at ${fullPath}:`, obj[key]);
          return String(obj[key]);
        }
      }

      // If it's an object, recurse (but avoid circular structures)
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        const nestedResult = deepScanForSessionId(obj[key], fullPath);
        if (nestedResult) return nestedResult;
      }
    }

    return null;
  }

  // Try a deep scan for sessionId first
  const sessionIdScanResult = deepScanForSessionId(response);
  if (sessionIdScanResult) return sessionIdScanResult;

  // If no sessionId found, fall back to id fields
  if (response.id) {
    console.log("No sessionId found, falling back to 'id' field:", response.id);
    return response.id;
  }

  if (response.verificationId) {
    console.log("No sessionId found, falling back to verificationId field:", response.verificationId);
    return response.verificationId;
  }

  if (response.workflowId) {
    console.log("No sessionId found, falling back to workflowId field:", response.workflowId);
    return response.workflowId;
  }

  // Continue checking nested properties for id fields as a fallback
  if (response.data && response.data.id) {
    console.log("No sessionId found, falling back to data.id:", response.data.id);
    return response.data.id;
  }

  if (response.result && response.result.id) {
    console.log("No sessionId found, falling back to result.id:", response.result.id);
    return response.result.id;
  }

  if (response.serviceDetails && response.serviceDetails.secureme && response.serviceDetails.secureme.id) {
    console.log("No sessionId found, falling back to serviceDetails.secureme.id:", response.serviceDetails.secureme.id);
    return response.serviceDetails.secureme.id;
  }

  // If no ID is found, generate a timestamp-based ID
  const fallbackId = "session-" + new Date().getTime();
  console.log("No sessionId or id found in response, using fallback ID:", fallbackId);
  return fallbackId;
}

// Enhanced verification URL extraction function
function extractVerificationUrl(response) {
    if (!response) return null;

    console.log("Examining Au10tix response structure:", JSON.stringify(response, null, 2));

    // Check direct properties first (most common)
    if (response.securemeLink) {
        console.log("Found securemeLink directly in response");
        return response.securemeLink;
    }
    if (response.workflowUrl) {
        console.log("Found workflowUrl directly in response");
        return response.workflowUrl;
    }
    if (response.url) {
        console.log("Found url directly in response");
        return response.url;
    }
    if (response.link) {
        console.log("Found link directly in response");
        return response.link;
    }

    // Check first level nested objects
    if (response.data) {
        if (response.data.securemeLink) return response.data.securemeLink;
        if (response.data.url) return response.data.url;
        if (response.data.workflowUrl) return response.data.workflowUrl;
    }

    if (response.result) {
        if (response.result.securemeLink) return response.result.securemeLink;
        if (response.result.url) return response.result.url;
        if (response.result.workflowUrl) return response.result.workflowUrl;
    }

    // IMPORTANT: Check serviceDetails - most likely location based on testing
    if (response.serviceDetails && response.serviceDetails.secureme) {
        console.log("Found serviceDetails.secureme in response");
        if (response.serviceDetails.secureme.shortUrl) {
            console.log("Found shortUrl in serviceDetails");
            return response.serviceDetails.secureme.shortUrl;
        }
        if (response.serviceDetails.secureme.workflowUrl) {
            console.log("Found workflowUrl in serviceDetails");
            return response.serviceDetails.secureme.workflowUrl;
        }
        if (response.serviceDetails.secureme.url) {
            console.log("Found url in serviceDetails");
            return response.serviceDetails.secureme.url;
        }
    }

    // Check services
    if (response.services && response.services.secureme) {
        console.log("Found services.secureme in response");
        if (response.services.secureme.url) return response.services.secureme.url;
        if (response.services.secureme.workflowUrl) return response.services.secureme.workflowUrl;
        if (response.services.secureme.shortUrl) return response.services.secureme.shortUrl;
    }

    // Check links array
    if (Array.isArray(response.links)) {
        const securemeLink = response.links.find(link => link.rel === 'secureme');
        if (securemeLink && securemeLink.href) return securemeLink.href;

        // If no secureme link is found, try any link
        const anyLink = response.links.find(link => link.href);
        if (anyLink && anyLink.href) return anyLink.href;
    }

    // Check _links object (common in HAL/hypermedia APIs)
    if (response._links) {
        if (response._links.secureme && response._links.secureme.href) return response._links.secureme.href;
        if (response._links.self && response._links.self.href) return response._links.self.href;
    }

    // Deep scan for any property containing relevant keywords
    const urlKeywords = ['url', 'link', 'href', 'secureme', 'workflow'];

    function deepScan(obj, prefix = '') {
        if (!obj || typeof obj !== 'object') return null;

        for (const key in obj) {
            const fullPath = prefix ? `${prefix}.${key}` : key;
            const keyLower = key.toLowerCase();

            // If the property name suggests it's a URL and it's a string starting with http
            if (urlKeywords.some(keyword => keyLower.includes(keyword)) &&
                typeof obj[key] === 'string' &&
                obj[key].startsWith('http')) {
                console.log(`Deep scan found URL at ${fullPath}:`, obj[key]);
                return obj[key];
            }

            // If it's an object, recurse (but avoid circular structures)
            if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                const nestedResult = deepScan(obj[key], fullPath);
                if (nestedResult) return nestedResult;
            }
        }

        return null;
    }

    // Try a deep scan as a last resort
    return deepScan(response);
}

// Function to check if verification has passed
function isVerificationPassed(verification) {
    // First check if verification is completed
    if (!verification) {
        console.log("Verification not completed yet");
        return false;
    }

    // Handle the session result format
    if (verification.sessionResult) {
        console.log("Checking sessionResult format");

        const isCompleted = verification.sessionResult.completionStatus === "COMPLETED";
        const isPassed = verification.sessionResult.primaryResult === "PASSED";

        if (isCompleted && isPassed) {
            console.log("Verification PASSED: Session result is completed and passed");
            return true;
        } else {
            console.log("Verification FAILED or PENDING:",
                        isCompleted ? "Completed but not passed" : "Not completed");
            return false;
        }
    }

    // Handle the standard status format
    if (verification.status !== VERIFICATION_STATUSES.COMPLETED) {
        console.log("Verification not completed yet");
        return false;
    }

    console.log("Verification completed, checking result details");

    // Check if it passed all required checks based on the result object
    if (verification.result) {
        // Check document authentication and face match results
        const isDocumentAuthentic = verification.result.isDocumentAuthentic === true;
        const isFaceMatch = verification.result.isFaceMatch === true;

        if (isDocumentAuthentic && isFaceMatch) {
            console.log("Verification PASSED: Document authentic and face matched");
            return true;
        } else {
            console.log("Verification FAILED:",
                    isDocumentAuthentic ? "Document authenticated" : "Document not authenticated",
                    isFaceMatch ? "Face matched" : "Face didn't match");
            return false;
        }
    }

    // If there's no result object, check for overall verification result
    if (verification.overallResult === "PASS") {
        console.log("Verification PASSED based on overall result");
        return true;
    }

    // Default to not passed if we can't determine
    console.log("Verification status indeterminate, defaulting to NOT PASSED");
    return false;
}

// Function to update UI based on verification status
function updateInvitationSectionVisibility(verification) {
    const isPassed = isVerificationPassed(verification);

    console.log("Updating invitation section visibility based on verification status:", isPassed);

    // Get the invitation section and related elements
    const invitationCard = $('#invitation-section');
    const invitationForm = $('#direct-invitation-form');
    const invitationStatusMessage = $('#invitation-status-message');

    if (isPassed) {
        // Show invitation section and enable form
        invitationCard.removeClass('d-none');
        invitationForm.removeClass('d-none');
        invitationStatusMessage.html(
            '<div class="alert alert-success mb-3">' +
            '<i class="bi bi-check-circle-fill me-2"></i> ' +
            'Identity verification passed. You can now send invitations.' +
            '</div>'
        ).removeClass('d-none');
    } else {
        // Hide form but show section with status message
        invitationCard.removeClass('d-none');
        invitationForm.addClass('d-none');

        if (!verification) {
            // No verification exists
            invitationStatusMessage.html(
                '<div class="alert alert-warning mb-3">' +
                '<i class="bi bi-exclamation-triangle-fill me-2"></i> ' +
                'You need to complete identity verification before sending invitations.' +
                '</div>'
            ).removeClass('d-none');
        } else if (verification.status === VERIFICATION_STATUSES.PENDING ||
                  (verification.sessionResult && verification.sessionResult.completionStatus !== "COMPLETED")) {
            // Verification in progress
            invitationStatusMessage.html(
                '<div class="alert alert-info mb-3">' +
                '<i class="bi bi-hourglass-split me-2"></i> ' +
                'Your identity verification is pending. Once approved, you can send invitations.' +
                '</div>'
            ).removeClass('d-none');
        } else if (verification.status === VERIFICATION_STATUSES.COMPLETED ||
                  (verification.sessionResult && verification.sessionResult.completionStatus === "COMPLETED")) {
            // Verification completed but failed
            invitationStatusMessage.html(
                '<div class="alert alert-danger mb-3">' +
                '<i class="bi bi-x-circle-fill me-2"></i> ' +
                'Your identity verification failed. Please try again with valid documents.' +
                '</div>'
            ).removeClass('d-none');
        } else {
            // Other status
            invitationStatusMessage.html(
                '<div class="alert alert-warning mb-3">' +
                '<i class="bi bi-exclamation-triangle-fill me-2"></i> ' +
                'Identity verification status: ' + (verification.status || verification.sessionResult?.completionStatus || 'Unknown') + '. ' +
                'You cannot send invitations until verification is approved.' +
                '</div>'
            ).removeClass('d-none');
        }
    }

    // Also update search results section if it exists
    if ($('#user-search-section').length) {
        const searchSection = $('#user-search-section');
        if (isPassed) {
            searchSection.removeClass('d-none');
            $('#search-disabled-message').addClass('d-none');
        } else {
            searchSection.addClass('d-none');
            $('#search-disabled-message').removeClass('d-none')
                .html('<div class="alert alert-warning">' +
                    '<i class="bi bi-exclamation-triangle-fill me-2"></i> ' +
                    'User search is disabled until your identity is verified.' +
                    '</div>');
        } 
    }
}

// Function to check verification status by ID
function checkVerificationStatus(verificationId) {
  if (!verificationId) {
    console.log("No verification ID provided");
    updateInvitationSectionVisibility(null);
    return;
  }

  // Get the Au10tix token
  const au10tixToken = localStorage.getItem('au10tixToken');
  if (!au10tixToken) {
    console.error("Au10tix token not found");
    return;
  }

  console.log("Checking verification status for ID:", verificationId);
  $('#verification-status-id').text(verificationId);

  // Make API request to get verification result
  $.ajax({
    url: '/au10tix-proxy/result/v2/results/person/' + encodeURIComponent(verificationId),
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + au10tixToken
    },
    data: {
      includeDetailed: true
    },
    success: function(response) {
      console.log("Verification status response:", response);

      // Extract session ID from response
      const sessionId = extractVerificationId(response);

      // Ensure the verification ID is preserved in the response
      if (!response.id && verificationId) {
        response.id = verificationId;
      }

      // Ensure the sessionId is set in the response
      if (sessionId) {
        response.sessionId = sessionId;
      }

      // Handle the specific response format with sessionResult
      if (response.sessionResult) {
        const sessionResult = response.sessionResult;

        // Set status based on completionStatus
        response.status = sessionResult.completionStatus || "PENDING";

        // Determine if verification passed based on primaryResult
        response.result = {
          isDocumentAuthentic: sessionResult.primaryResult === "PASSED",
          isFaceMatch: sessionResult.primaryResult === "PASSED"
        };

        // Extract identity information if available
        if (sessionResult.identity) {
          response.result.extractedData = {
            fullName: [sessionResult.identity.firstName, sessionResult.identity.lastName].filter(Boolean).join(' '),
            firstName: sessionResult.identity.firstName,
            lastName: sessionResult.identity.lastName,
            dateOfBirth: sessionResult.identity.dateOfBirth,
            documentType: sessionResult.identity.idType,
            expiryDate: sessionResult.identity.documentDateOfExpiry
          };

          // Add address if available
          if (sessionResult.identity.Addresses) {
            response.result.extractedData.country = sessionResult.identity.Addresses.countryIso3;
            response.result.extractedData.address = sessionResult.identity.Addresses.addressLine1;
          }
        }
      }

      // Store the verification result for later reference
      localStorage.setItem('lastVerificationResult', JSON.stringify(response));

      // Update UI based on verification status
      updateInvitationSectionVisibility(response);

      // If verification is completed, update verification status display
      if (response.status === VERIFICATION_STATUSES.COMPLETED ||
          (response.sessionResult && response.sessionResult.completionStatus === "COMPLETED")) {
        const resultHtml = formatVerificationResult(response, true);
        $('#verification-results').html(resultHtml);

        // Update stats based on verification result
        if (isVerificationPassed(response)) {
          updateStats(1, -1, 0); // Increment completed, decrement pending

          // Update Octopus invitation QR code after successful verification
          const sessionId = response.sessionId || verificationId;
          const userId = $('#user-id').val().trim() || 'default-user';

          // Generate QR code with Octopus invitation info
          $('#qrcode').empty(); // Clear existing QR code

          // Create data for QR code - include both session ID and user ID
          const qrData = JSON.stringify({
              sessionId: sessionId,
              userId: userId,
              type: 'octopus-invitation',
              timestamp: new Date().getTime()
          });

          // Generate new Octopus QR code
          new QRCode(document.getElementById("qrcode"), {
              text: qrData,
              width: 200,
              height: 200
          });

          // Update invitation ID display
          $('#invitation-id').html(`
              <div class="verification-id-badge">
                  <span class="fw-bold">Octopus Invitation:</span> 
                  <span class="font-monospace">${sessionId}</span>
                  <button class="btn btn-sm btn-outline-secondary ms-2 copy-id-btn" data-id="${sessionId}">
                      <i class="bi bi-clipboard"></i>
                  </button>
              </div>
          `);

          // Hide the identity verification QR code once verification is complete
          $('#verification-qr-container').addClass('d-none');
        } else {
          updateStats(0, -1, 1); // Increment failed, decrement pending
        }
      }
    },
    error: function(xhr, status, error) {
      console.error("Error fetching verification status:", error);
      // If error occurs, default to hiding invitation options
      updateInvitationSectionVisibility(null);

      // Show error in verification results
      $('#verification-results').html(
        '<div class="alert alert-danger">' +
        '<i class="bi bi-x-circle-fill me-2"></i> ' +
        'Error checking verification status: ' + (error || 'Unknown error') +
        '</div>'
      );
    }
  });
}

function formatVerificationResult(result, detailed = false) {
    let statusClass = 'status-pending';
    let statusText = 'Pending';
    let verificationId = result.sessionId || result.id || 'Unknown';

    // Handle session result format
    if (result.sessionResult) {
        if (result.sessionResult.completionStatus === 'COMPLETED') {
            if (result.sessionResult.primaryResult === 'PASSED') {
                statusClass = 'status-completed';
                statusText = 'Completed & Passed';
            } else {
                statusClass = 'status-failed';
                statusText = 'Failed';
            }
        }
    } else if (result.status === 'COMPLETED') {
        // Handle standard format
        if (isVerificationPassed(result)) {
            statusClass = 'status-completed';
            statusText = 'Completed & Passed';
        } else {
            statusClass = 'status-failed';
            statusText = 'Failed';
        }
    } else if (result.status === 'FAILED') {
        statusClass = 'status-failed';
        statusText = 'Failed';
    }

    let createdDate = 'N/A';
    if (result.createdAt) {
        createdDate = new Date(result.createdAt).toLocaleString();
    }

    // Add a highlighted section for the verification ID
    let html = `
        <div class="result-item">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <h5 class="mb-0">Verification Result</h5>
                <span class="badge ${statusClass}">${statusText}</span>
            </div>
            <div class="verification-id-container bg-light p-2 mb-3 rounded border">
                <div class="d-flex justify-content-between align-items-center">
                    <span><strong>Session ID:</strong></span>
                    <span class="verification-id-value font-monospace">${verificationId}</span>
                    <button class="btn btn-sm btn-outline-secondary copy-id-btn" data-id="${verificationId}">
                        <i class="bi bi-clipboard"></i> Copy
                    </button>
                </div>
            </div>
            <p class="text-muted mb-1">Created: ${createdDate}</p>
    `;

    // Display identity information from sessionResult if available
    if (detailed && result.sessionResult && result.sessionResult.identity) {
        const identity = result.sessionResult.identity;

        html += '<hr><div class="result-details">';
        html += '<h6 class="mb-3">Identity Information:</h6>';
        html += '<ul class="list-group mb-3">';

        if (identity.firstName || identity.lastName) {
            const name = [identity.firstName, identity.lastName].filter(Boolean).join(' ');
            html += `<li class="list-group-item">Name: <strong>${name}</strong></li>`;
        }

        if (identity.dateOfBirth) {
            // Format the date of birth
            let dob = identity.dateOfBirth;
            try {
                dob = new Date(identity.dateOfBirth).toLocaleDateString();
            } catch (e) {}
            html += `<li class="list-group-item">Date of Birth: <strong>${dob}</strong></li>`;
        }

        if (identity.idType) {
            html += `<li class="list-group-item">ID Type: <strong>${identity.idType}</strong></li>`;
        }

        if (identity.documentDateOfExpiry) {
            // Format the expiry date
            let expiry = identity.documentDateOfExpiry;
            try {
                expiry = new Date(identity.documentDateOfExpiry).toLocaleDateString();
            } catch (e) {}
            html += `<li class="list-group-item">Expiry Date: <strong>${expiry}</strong></li>`;
        }

        if (identity.Addresses) {
            if (identity.Addresses.countryIso3) {
                html += `<li class="list-group-item">Country: <strong>${identity.Addresses.countryIso3}</strong></li>`;
            }
            if (identity.Addresses.addressLine1) {
                html += `<li class="list-group-item">Address: <strong>${identity.Addresses.addressLine1}</strong></li>`;
            }
        }

        html += '</ul>';

        // Add result summary
        html += `
            <div class="alert ${result.sessionResult.primaryResult === 'PASSED' ? 'alert-success' : 'alert-danger'}">
                <i class="bi ${result.sessionResult.primaryResult === 'PASSED' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-2"></i>
                Verification ${result.sessionResult.primaryResult === 'PASSED' ? 'passed' : 'failed'} with result: <strong>${result.sessionResult.primaryResult}</strong>
            </div>
        `;

        html += '</div>';
    }
    // Display standard verification result information
    else if (detailed && result.result) {
        html += '<hr><div class="result-details">';

        // Document Authentication
        if (typeof result.result.isDocumentAuthentic !== 'undefined') {
            const docAuthClass = result.result.isDocumentAuthentic ? 'text-success' : 'text-danger';
            const docAuthIcon = result.result.isDocumentAuthentic ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
            html += `
                <p class="${docAuthClass}">
                    <i class="bi ${docAuthIcon} me-1"></i>
                    Document Authentication: <strong>${result.result.isDocumentAuthentic ? 'Authentic' : 'Not Authentic'}</strong>
                </p>
            `;
        }

        // Face Match
        if (typeof result.result.isFaceMatch !== 'undefined') {
            const faceMatchClass = result.result.isFaceMatch ? 'text-success' : 'text-danger';
            const faceMatchIcon = result.result.isFaceMatch ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
            html += `
                <p class="${faceMatchClass}">
                    <i class="bi ${faceMatchIcon} me-1"></i>
                    Face Match: <strong>${result.result.isFaceMatch ? 'Match' : 'No Match'}</strong>
                </p>
            `;
        }

        // Extracted Data (if available)
        if (result.result.extractedData) {
            html += '<div class="mt-3"><h6>Extracted Data:</h6><ul class="list-group">';

            if (result.result.extractedData.fullName) {
                html += `<li class="list-group-item">Name: ${result.result.extractedData.fullName}</li>`;
            }

            if (result.result.extractedData.documentNumber) {
                html += `<li class="list-group-item">Document Number: ${result.result.extractedData.documentNumber}</li>`;
            }

            if (result.result.extractedData.dateOfBirth) {
                html += `<li class="list-group-item">Date of Birth: ${result.result.extractedData.dateOfBirth}</li>`;
            }

            if (result.result.extractedData.expiryDate) {
                html += `<li class="list-group-item">Expiry Date: ${result.result.extractedData.expiryDate}</li>`;
            }

            html += '</ul></div>';
        }

        html += '</div>';
    }

    html += `
            <div class="mt-2">
                <button class="btn btn-sm btn-outline-primary view-result-btn" data-id="${verificationId}">
                    View Details
                </button>
            </div>
        </div>
    `;

    return html;
}

function loadVerificationResults() {
    // Show loading
    $('#verification-results').html(
        '<div class="d-flex justify-content-center my-5">' +
        '<div class="spinner-border text-primary" role="status">' +
        '<span class="visually-hidden">Loading...</span>' +
        '</div>' +
        '</div>'
    );

    // Check if we have a verification ID
    const lastVerificationId = localStorage.getItem('lastVerificationId');
    if (lastVerificationId) {
        // Check the status of this verification
        checkVerificationStatus(lastVerificationId);
    } else {
        // If no verification ID, show empty state after a delay
        setTimeout(function() {
            $('#verification-results').html(
                '<div class="alert alert-info">' +
                '<i class="bi bi-info-circle me-2"></i> No recent verification records found. Start a new verification to see results here.' +
                '</div>'
            );
        }, 1000);
    }
}

function updateStats(completed, pending, failed) {
    // Get current values
    let currentCompleted = parseInt($('#stats-completed').text()) || 0;
    let currentPending = parseInt($('#stats-pending').text()) || 0;
    let currentFailed = parseInt($('#stats-failed').text()) || 0;

    // Update values
    currentCompleted += completed;
    currentPending += pending;
    currentFailed += failed;

    // Ensure no negative values
    currentCompleted = Math.max(0, currentCompleted);
    currentPending = Math.max(0, currentPending);
    currentFailed = Math.max(0, currentFailed);

    // Update display
    $('#stats-completed').text(currentCompleted);
    $('#stats-pending').text(currentPending);
    $('#stats-failed').text(currentFailed);

    // Update chart
    if (window.verificationStatsChart) {
        window.verificationStatsChart.data.datasets[0].data = [currentCompleted, currentPending, currentFailed];
        window.verificationStatsChart.update();
    }
}

// Function to initialize the copy verification ID buttons
function initCopyButtons() {
    // Use event delegation for dynamically added copy buttons
    $(document).on('click', '.copy-id-btn', function() {
        const verificationId = $(this).data('id');
        console.log("Copying verification ID:", verificationId);

        // Use clipboard API if available
        if (navigator.clipboard) {
            navigator.clipboard.writeText(verificationId)
                .then(() => {
                    // Success feedback
                    const originalText = $(this).html();
                    $(this).html('<i class="bi bi-check"></i> Copied!');
                    setTimeout(() => {
                        $(this).html(originalText);
                    }, 2000);
                })
                .catch(err => {
                    console.error('Could not copy text: ', err);
                    fallbackCopy(verificationId, this);
                });
        } else {
            // Fallback for browsers without clipboard API
            fallbackCopy(verificationId, this);
        }
    });

    // Fallback copy method
    function fallbackCopy(text, button) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed'; // Prevent scrolling to bottom
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                // Success feedback
                const originalText = $(button).html();
                $(button).html('<i class="bi bi-check"></i> Copied!');
                setTimeout(() => {
                    $(button).html(originalText);
                }, 2000);
            } else {
                console.error('Fallback: Copying text command was unsuccessful');
            }
        } catch (err) {
            console.error('Fallback: Could not copy text: ', err);
        }

        document.body.removeChild(textarea);
    }
}

// Define startVerification function in global scope to ensure it's accessible
function startVerification(type) {
    console.log("Starting verification with type:", type);

    // Show loading overlay
    $('#loading-overlay').show();

    // Configure the payload based on verification type
    let payload;

    if (type === 'docs') {
        payload = {
            workflowOptions: {},
            serviceOptions: {
                secureme: {
                    shortUrl: true,
                    requestTypes: {
                        idFront: ['file', 'camera'],
                        idBack: ['file', 'camera'],
                        faceCompare: ['camera']
                    }
                }
            }
        };
    } else if (type === 'face') {
        payload = {
            workflowOptions: {},
            serviceOptions: {
                secureme: {
                    shortUrl: true,
                    requestTypes: {
                        faceCompare: ['camera'],
                        voiceConsent: ['camera']
                    }
                }
            }
        };
    } else if (type === 'custom') {
        // Get custom verification settings from the modal
        const requestTypes = {};

        if ($('#idv-option-front').is(':checked')) {
            const methods = [];
            if ($('#idv-method-file').is(':checked')) methods.push('file');
            if ($('#idv-method-camera').is(':checked')) methods.push('camera');
            if (methods.length > 0) requestTypes.idFront = methods;
        }

        if ($('#idv-option-back').is(':checked')) {
            const methods = [];
            if ($('#idv-method-file').is(':checked')) methods.push('file');
            if ($('#idv-method-camera').is(':checked')) methods.push('camera');
            if (methods.length > 0) requestTypes.idBack = methods;
        }

        if ($('#idv-option-face').is(':checked')) {
            requestTypes.faceCompare = ['camera'];
        }

        if ($('#idv-option-voice').is(':checked')) {
            requestTypes.voiceConsent = ['camera'];
        }

        const shortUrl = $('#idv-short-url').is(':checked');

        payload = {
            workflowOptions: {},
            serviceOptions: {
                secureme: {
                    shortUrl: shortUrl,
                    requestTypes: requestTypes
                }
            }
        };
    }

    // Ensure we have at least one request type
    const reqTypes = payload.serviceOptions.secureme.requestTypes;
    if (Object.keys(reqTypes).length === 0) {
        $('#loading-overlay').hide();

        // For custom verification, show error in the modal
        if (type === 'custom') {
            $('#idv-loading').addClass('d-none');
            $('#idv-error').removeClass('d-none');
            $('#idv-error-message').text('Please select at least one verification option.');
            $('#start-verification-btn').prop('disabled', false);
        } else {
            alert('Please select at least one verification option');
        }
        return;
    }

    // Get the Au10tix token from localStorage
    const au10tixToken = localStorage.getItem('au10tixToken');
    if (!au10tixToken) {
        $('#loading-overlay').hide();
        alert('Authentication token not found. Please refresh the page and try again.');
        return;
    }

    // Make the API request to create a workflow
    $.ajax({
        url: '/au10tix-proxy/workflow/v1/workflows/person/Au10tix201',
        method: 'POST',
        contentType: 'application/json',
        headers: {
            'Authorization': 'Bearer ' + au10tixToken
        },
        data: JSON.stringify(payload),
        success: function(response) {
            console.log("Verification workflow created successfully:", response);

            // Hide loading overlay
            $('#loading-overlay').hide();

            // For custom verification, update the modal
            if (type === 'custom') {
                $('#idv-loading').addClass('d-none');
                $('#idv-link-result').removeClass('d-none');
                $('#start-verification-btn').addClass('d-none');
                $('#new-verification-btn').removeClass('d-none');
            }

            // Process the response to find the verification URL and session ID
            let verificationId = extractVerificationId(response);
            let verificationUrl = extractVerificationUrl(response);

            // Log the full response and extracted details
            console.log("Full response:", JSON.stringify(response, null, 2));
            console.log("Extracted verification URL:", verificationUrl);
            console.log("Extracted session ID:", verificationId);

            // Store verification ID in localStorage for status checking
            localStorage.setItem('lastVerificationId', verificationId);

            // For immediate status check (even though it's likely pending at this point)
            checkVerificationStatus(verificationId);

            // Set up periodic checking of verification status (every 10 seconds)
            const statusCheckInterval = setInterval(function() {
                const lastId = localStorage.getItem('lastVerificationId');
                if (lastId) {
                    checkVerificationStatus(lastId);
                } else {
                    clearInterval(statusCheckInterval); // Stop checking if ID is removed
                }
            }, 10000); // Check every 10 seconds

            // If we have a URL, display it in the secure link container and handle redirection
            if (verificationUrl) {
                // Update the secure link container
                $('#secureme-link-text').text(verificationUrl);
                $('#secureme-link-btn').attr('href', verificationUrl);
                $('#secureme-link-container').removeClass('d-none');

                // For custom verification, update the modal with the link and QR code
                if (type === 'custom') {
                    $('#verification-link').val(verificationUrl);
                    $('#verification-id').text(verificationId);

                    // Generate QR code for verification link
                    $('#verification-qrcode').empty();
                    new QRCode(document.getElementById("verification-qrcode"), {
                        text: verificationUrl,
                        width: 200,
                        height: 200
                    });
                } else {
                    // Scroll to the secure link container
                    $('html, body').animate({
                        scrollTop: $('#secureme-link-container').offset().top - 100
                    }, 500);
                }

                // Update the verification created section with better formatting
                const verificationInfo = `
                    <h5><i class="bi bi-check-circle-fill text-success me-2"></i> Verification Created</h5>
                    <div class="verification-id-container bg-light p-2 mb-3 rounded border">
                        <div class="d-flex justify-content-between align-items-center">
                            <span><strong>Session ID:</strong></span>
                            <span class="verification-id-value font-monospace">${verificationId}</span>
                            <button class="btn btn-sm btn-outline-secondary copy-id-btn" data-id="${verificationId}">
                                <i class="bi bi-clipboard"></i> Copy
                            </button>
                        </div>
                    </div>
                    <p><strong>Type:</strong> ${type === 'docs' ? 'ID Document & Selfie' :
                                        type === 'face' ? 'Face & Voice Verification' : 'Custom Verification'}</p>
                    <p class="mb-0"><strong>Status:</strong> <span class="badge bg-warning">Pending</span></p>
                `;
                $('#verification-created').html(verificationInfo).removeClass('d-none');

                // Generate QR code
                $('#qrcode').empty();
                new QRCode(document.getElementById("qrcode"), {
                    text: verificationUrl,
                    width: 200,
                    height: 200
                });

                // Update the invitation ID with better formatting
                $('#invitation-id').html(`
                    <div class="verification-id-badge">
                        <span class="fw-bold">Session ID:</span> 
                        <span class="font-monospace">${verificationId}</span>
                        <button class="btn btn-sm btn-outline-secondary ms-2 copy-id-btn" data-id="${verificationId}">
                            <i class="bi bi-clipboard"></i>
                        </button>
                    </div>
                `);

                // Update stats
                updateStats(0, 1, 0);

                // FIXED: Auto-redirect to the securemeLink after a short delay (1.5 seconds)
                // This allows users to see that the link was created before being redirected
                // UPDATED: Open in a new tab instead of redirecting current page
                setTimeout(function() {
                    window.open(verificationUrl, '_blank');
                    // No redirect of current page, so the dashboard stays visible
                }, 1500);
            } else {
                // No valid URL found, show an error
                if (type === 'custom') {
                    // For custom verification, update the modal with error
                    $('#idv-loading').addClass('d-none');
                    $('#idv-error').removeClass('d-none');
                    $('#idv-error-message').text('Verification process created, but no valid URL was found in the response.');
                    $('#start-verification-btn').removeClass('d-none');
                    $('#start-verification-btn').prop('disabled', false);
                } else {
                    alert('Verification process created, but no valid URL was found in the response.');
                }
                console.error("No valid URL found in response:", response);

                // Show the response in the verification results section
                let resultHtml = `
                    <div class="alert alert-warning">
                        <h5><i class="bi bi-exclamation-triangle me-2"></i> Verification Created!</h5>
                        <p>Session ID: <strong>${verificationId || 'N/A'}</strong></p>
                        <p>No verification URL returned. See console for details.</p>
                    </div>
                `;

                // Display result
                $('#verification-results').html(resultHtml);
            }
        },
        error: function(xhr, status, error) {
            console.error("Verification workflow error:", error);

            // Hide loading overlay
            $('#loading-overlay').hide();

            try {
                // Try to parse the error response
                const errorResponse = xhr.responseText ? JSON.parse(xhr.responseText) : null;
                console.error("Error response:", errorResponse);

                let errorMessage = 'Failed to create verification workflow';
                if (errorResponse) {
                    if (errorResponse.error) {
                        errorMessage = errorResponse.error;
                    } else if (errorResponse.message) {
                        errorMessage = errorResponse.message;
                    } else if (errorResponse.detail) {
                        errorMessage = errorResponse.detail;
                    }
                }

                // For custom verification, update the modal with error
                if (type === 'custom') {
                    $('#idv-loading').addClass('d-none');
                    $('#idv-error').removeClass('d-none');
                    $('#idv-error-message').text(errorMessage);
                    $('#start-verification-btn').removeClass('d-none');
                    $('#start-verification-btn').prop('disabled', false);
                } else {
                    alert('Error: ' + errorMessage);
                }

                $('#verification-results').html(`
                    <div class="alert alert-danger">
                        <p><i class="bi bi-x-circle me-2"></i> Error creating verification: ${errorMessage}</p>
                    </div>
                `);
            } catch (e) {
                // If we can't parse the response, show a generic error
                console.error("Error parsing error response:", e);

                // For custom verification, update the modal with error
                if (type === 'custom') {
                    $('#idv-loading').addClass('d-none');
                    $('#idv-error').removeClass('d-none');
                    $('#idv-error-message').text('An unexpected error occurred. Please try again.');
                    $('#start-verification-btn').removeClass('d-none');
                    $('#start-verification-btn').prop('disabled', false);
                } else {
                    alert('An error occurred while creating the verification workflow. See console for details.');
                }

                $('#verification-results').html(`
                    <div class="alert alert-danger">
                        <p><i class="bi bi-x-circle me-2"></i> Error creating verification: ${error || 'Unknown error'}</p>
                    </div>
                `);
            }
        }
    });
}

function performSearch() {
    const searchTerm = $('#search-input').val().trim();
    if (searchTerm.length < 2) {
        $('#search-results').html('<div class="alert alert-warning">Please enter at least 2 characters</div>');
        return;
    }

    $('#search-results').html('<div class="d-flex justify-content-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>');

    // Get the SDO URL from the server or use a default value
    let sdoUrl = '';
    if ($('#url').val()) {
        sdoUrl = $('#url').val();
        // Make sure it doesn't have /admin at the end
        sdoUrl = sdoUrl.replace(/\/admin\/?$/, '');
    } else if ($('#authenticated-sdo-url').length) {
        sdoUrl = $('#authenticated-sdo-url').data('url');
        sdoUrl = sdoUrl.replace(/\/admin\/?$/, '');
    } else {
        // Default fallback
        sdoUrl = 'amitmt.doubleoctopus.io';
    }

    // Ensure URL has https:// prefix and valid hostname
    if (!sdoUrl) {
        // Default fallback
        sdoUrl = 'amitmt.doubleoctopus.io';
    }

    if (!sdoUrl.startsWith('http')) {
        sdoUrl = 'https://' + sdoUrl;
    }

    // Remove any trailing slash
    sdoUrl = sdoUrl.replace(/\/+$/, '');

    // Add /admin if not present
    if (!sdoUrl.includes('/admin')) {
        sdoUrl = sdoUrl + '/admin';
    }

    $.ajax({
        url: '/sdo-api/directories/explorer/members/search',
        method: 'GET',
        data: { search: searchTerm },
        success: function(response) {
            if (response && response.content) {
                let userCount = response.userCount || response.content.length || 0;
                displaySearchResults(response.content, userCount);
            } else {
                $('#search-results').html('<div class="alert alert-info">No users found</div>');
            }
        },
        error: function(xhr) {
            let errorMessage = 'An error occurred while searching';
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.error) {
                    errorMessage = response.error;
                }
            } catch(e) {}

            $('#search-results').html('<div class="alert alert-danger">' + errorMessage + '</div>');
        }
    });
}

function displaySearchResults(users, count) {
    if (!users || users.length === 0) {
        $('#search-results').html('<div class="alert alert-info">No users found matching your search criteria.</div>');
        return;
    }

    let resultsHtml = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0">Search Results (${count})</h5>
        </div>
    `;

    resultsHtml += '<div class="list-group">';

    users.forEach(user => {
        const userName = user.displayName || user.username || user.email || 'Unknown User';
        const userEmail = user.email || 'No email available';
        const userId = user.id || '';
        const directoryName = user.directoryName || 'Unknown Directory';

        resultsHtml += `
            <div class="list-group-item">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">${userName}</h5>
                    <small class="text-muted">${directoryName}</small>
                </div>
                <p class="mb-1 text-muted">${userEmail}</p>
                <p class="mb-1 small">User ID: ${userId}</p>
                <div class="d-flex mt-2">
                    <button type="button" class="btn btn-sm btn-primary send-invitation-btn"
                            data-user-id="${userId}"
                            data-user-name="${userName}">
                        <i class="bi bi-envelope-fill me-1"></i> Send Invitation
                    </button>
                </div>
            </div>
        `;
    });

    resultsHtml += '</div>';

    $('#search-results').html(resultsHtml);

    // Add event listeners to the invitation buttons
    $('.send-invitation-btn').click(function() {
        const userId = $(this).data('user-id');
        const userName = $(this).data('user-name');

        // Auto-fill the invitation form with this user
        $('#user-id').val(userId);

        // Scroll to the invitation form
        $('html, body').animate({
            scrollTop: $('#direct-invitation-form').offset().top - 100
        }, 500);

        // Highlight the form briefly
        $('#direct-invitation-form').addClass('border border-primary p-3');
        setTimeout(() => {
            $('#direct-invitation-form').removeClass('border border-primary p-3');
        }, 2000);

        // Show a message
        $('#invitation-result').html(`
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                Ready to send invitation to <strong>${userName}</strong>. Click "Send Invitation" to proceed.
            </div>
        `);
    });
}

// Document ready function to initialize everything
$(document).ready(function() {
    console.log("Dashboard JavaScript initialized");

    // Set the Au10tix token
    const au10tixToken = "eyJraWQiOiI5RnV4RmdtNnF6NzZXMW51cEh5ODR4MFRXaWpycEdwNmlVYURacEtyajk0IiwiYWxnIjoiUlMyNTYifQ.eyJ2ZXIiOjEsImp0aSI6IkFULmhSNFB1R011Q2JKNVhtZGQyM05PZjJ4NGZpbFF3VmdRQ09JT3ZkVi0za0UiLCJpc3MiOiJodHRwczovL2xvZ2luLmF1MTB0aXguY29tL29hdXRoMi9hdXMzbWx0czVzYmU5V0Q4VjM1NyIsImF1ZCI6ImF1MTB0aXgiLCJpYXQiOjE3NDY3MDU0MDcsImV4cCI6MTc0Njc5MTgwNywiY2lkIjoiMG9hMWpneXU4YWl1dEdSMjMzNTgiLCJzY3AiOlsid29ya2Zsb3c6YXBpIiwicHJzIl0sInN1YiI6IjBvYTFqZ3l1OGFpdXRHUjIzMzU4IiwiYXBpVXJsIjoiaHR0cHM6Ly9ldXMtYXBpLmF1MTB0aXhzZXJ2aWNlc3N0YWdpbmcuY29tIiwiYm9zVXJsIjoiaHR0cHM6Ly9ib3MtZXVzLXdlYi5hdTEwdGl4c2VydmljZXNzdGFnaW5nLmNvbSIsImNsaWVudE9yZ2FuaXphdGlvbk5hbWUiOiJTZWNyZXRfRG91YmxlX09jdG9wdXMiLCJjbGllbnRPcmdhbml6YXRpb25JZCI6MTU3OH0.hI9S3JNa3qfg0WZDg0lKiaM5WUks-jpupT7u0Sx71U-mjekezhWX0VMx0OaJRl2j541P7vCU6YGcJRYDDVcSdF8JffANJxjs3OFrGYRZQPwVt_2MTUKfblO1hhN-TjZYem6Ig7SL_9Bu6cgrxqjdebHZJFMqtCifAbW8ImnFPgg3OnNPqQqoanZF4qqjZaDF5bGmWJvnG_zEGmWK_fzQ_xGqryfZdWR7P1No3IkI7NBGui7iArg7OaAvJeAPt3iOwVnyKiPoYJ8x2qx8WRwcUv8gaoXw39zVq7vJp5YjIrmr5ud8BLncDeRoYtfpvKUUTtAoPDPdJGUD_y6CHiEuVg";
    localStorage.setItem('au10tixToken', au10tixToken);

    // Explicitly bind click events for verification buttons
    console.log("Binding click events to verification buttons");

    // Quick Start Verification - ID & Selfie Button
    $('#quick-idv-docs-btn').on('click', function() {
        console.log("ID Document & Selfie button clicked");
        startVerification('docs');
    });

    // Quick Start Verification - Face & Voice Button
    $('#quick-idv-face-btn').on('click', function() {
        console.log("Face + Voice Verification button clicked");
        startVerification('face');
    });

    // Custom verification button in modal
    $('#start-verification-btn').on('click', function() {
        console.log("Custom verification button clicked");
        // Show loading state in the modal
        $('#idv-workflow-options').addClass('d-none');
        $('#idv-loading').removeClass('d-none');
        $('#start-verification-btn').prop('disabled', true);

        // Use the startVerification function with custom type
        startVerification('custom');
    });

    // Initialize the Chart
    const ctx = document.getElementById('verification-stats-chart').getContext('2d');
    window.verificationStatsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Pending', 'Failed'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Hide the secure link container when clicking the hide button
    $('#hide-secureme-link-btn').click(function() {
        $('#secureme-link-container').addClass('d-none');
    });

    // Copy the secure link when clicking the copy button
    $('#copy-secureme-link-btn').click(function() {
        const copyText = document.getElementById("secureme-link-text");
        const textToCopy = copyText.innerText;

        navigator.clipboard.writeText(textToCopy).then(
            function() {
                // Change button text temporarily
                const originalText = $('#copy-secureme-link-btn').html();
                $('#copy-secureme-link-btn').html('<i class="bi bi-check"></i> Copied!');
                setTimeout(() => {
                    $('#copy-secureme-link-btn').html(originalText);
                }, 2000);
            },
            function() {
                // Fallback for older browsers
                const textArea = document.createElement("textarea");
                textArea.value = textToCopy;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);

                // Change button text temporarily
                const originalText = $('#copy-secureme-link-btn').html();
                $('#copy-secureme-link-btn').html('<i class="bi bi-check"></i> Copied!');
                setTimeout(() => {
                    $('#copy-secureme-link-btn').html(originalText);
                }, 2000);
            }
        );
    });

    // Handle IDV workflow modal open
    $('#idvModal').on('show.bs.modal', function (event) {
        // Reset modal state
        $('#idv-workflow-options').removeClass('d-none');
        $('#idv-link-result').addClass('d-none');
        $('#idv-loading').addClass('d-none');
        $('#idv-error').addClass('d-none');
        $('#start-verification-btn').removeClass('d-none');
        $('#new-verification-btn').addClass('d-none');
    });

    // Handle "Create Another Verification" button in modal
    $('#new-verification-btn').click(function() {
        // Reset modal state to initial form view
        $('#idv-workflow-options').removeClass('d-none');
        $('#idv-link-result').addClass('d-none');
        $('#idv-error').addClass('d-none');
        $('#start-verification-btn').removeClass('d-none');
        $('#new-verification-btn').addClass('d-none');
        $('#start-verification-btn').prop('disabled', false);
    });

    // Handle copy button in the modal
    $('#copy-link-btn').click(function() {
        const verificationLink = $('#verification-link').val();
        navigator.clipboard.writeText(verificationLink).then(
            function() {
                // Success feedback
                const originalText = $('#copy-link-btn').html();
                $('#copy-link-btn').html('<i class="bi bi-check"></i> Copied!');
                setTimeout(() => {
                    $('#copy-link-btn').html(originalText);
                }, 2000);
            },
            function() {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = verificationLink;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);

                // Success feedback
                const originalText = $('#copy-link-btn').html();
                $('#copy-link-btn').html('<i class="bi bi-check"></i> Copied!');
                setTimeout(() => {
                    $('#copy-link-btn').html(originalText);
                }, 2000);
            }
        );
    });

    // Load initial verification results
    loadVerificationResults();

    // Handle refresh results button click
    $('#refresh-results').click(function() {
        loadVerificationResults();
    });

    // Handle check specific result button click
    $('#check-result-btn').click(function() {
        const verificationId = $('#verification-id-input').val().trim();

        if (!verificationId) {
            alert('Please enter a verification ID');
            return;
        }

        // Show loading state
        $('#specific-result-container').addClass('d-none');
        $('#specific-result-loading').removeClass('d-none');
        $('#specific-result-error').addClass('d-none');

        // Make the API request to get the result
        $.ajax({
            url: '/au10tix-proxy/result/v2/results/person/' + encodeURIComponent(verificationId),
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + au10tixToken
            },
            data: {
                includeDetailed: true
            },
            success: function(response) {
                console.log("Verification result:", response);

                // Hide loading
                $('#specific-result-loading').addClass('d-none');

                // Display the result
                $('#specific-result-container').removeClass('d-none').html(
                    formatVerificationResult(response, true)
                );
            },
            error: function(xhr, status, error) {
                console.error("Result fetch error:", error);

                // Hide loading, show error
                $('#specific-result-loading').addClass('d-none');
                $('#specific-result-error').removeClass('d-none');

                try {
                    const response = JSON.parse(xhr.responseText);
                    let errorMessage = 'Failed to fetch verification result';

                    if (response.error) {
                        errorMessage = response.error;
                    } else if (response.message) {
                        errorMessage = response.message;
                    } else if (response.detail) {
                        errorMessage = response.detail;
                    }

                    $('#specific-result-error-message').text(errorMessage);
                } catch (e) {
                    $('#specific-result-error-message').text(error || 'Unknown error occurred');
                }
            }
        });
    });

    // Handle search button click
    $('#search-button').click(function() {
        performSearch();
    });

    // Handle Enter key press in search field
    $('#search-input').keypress(function(e) {
        if (e.which === 13) {
            performSearch();
            return false;
        }
    });

    // Handle direct invitation form submission
    $('#direct-invitation-form').submit(function(e) {
        e.preventDefault();
        const userId = $('#user-id').val().trim();

        if (!userId) {
            $('#invitation-result').html('<div class="alert alert-warning">Please enter a user ID</div>');
            return;
        }

        // Get selected invitation types
        const invitationTypes = [];
        if ($('#invite-mobile').is(':checked')) invitationTypes.push('MOBILE');

        if (invitationTypes.length === 0) {
            $('#invitation-result').html('<div class="alert alert-warning">Please select at least one invitation type</div>');
            return;
        }

        // Show loading message
        $('#invitation-result').html('<div class="d-flex justify-content-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>');

        console.log("Sending direct invitation to user ID:", userId);
        console.log("Invitation types:", invitationTypes);

        // Make AJAX request to server endpoint
        $.ajax({
            url: '/api/sdo/invite',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                userId: String(userId),
                invitationTypes: invitationTypes
            }),
            success: function(response) {
                console.log("=== INVITATION RESPONSE DEBUG ===");
                console.log("Full response:", response);
                console.log("Response type:", typeof response);
                console.log("Response keys:", Object.keys(response));
                
                $('#invitation-result').html('<div class="alert alert-success">Invitation sent successfully</div>');

                // Extract invitation details from the response
                let invitationId = null;
                let qrData = null;

                // Check for invitation ID in the response (matching handler format)
                if (response.id) {
                    invitationId = response.id;
                    qrData = response.id;
                    console.log("✅ Found response.id:", invitationId);
                } else if (response.invitationId) {
                    invitationId = response.invitationId;
                    qrData = response.invitationId;
                    console.log("✅ Found response.invitationId:", invitationId);
                }
                // Check if we have invitationDetails
                else if (response.invitationDetails && response.invitationDetails.id) {
                    invitationId = response.invitationDetails.id;
                    qrData = response.invitationDetails.id;
                    console.log("✅ Found invitationDetails.id:", invitationId);
                }
                // Check if we have rawResponse with nested invitation data
                else if (response.rawResponse && response.rawResponse.invitation) {
                    const invitation = response.rawResponse.invitation;
                    console.log("Found invitation data in rawResponse:", invitation);

                    // Try to get invitationId (new format) or id (old format)
                    if (invitation.invitationId) {
                        invitationId = invitation.invitationId;
                        qrData = invitation.invitationId;
                        console.log("✅ Found rawResponse.invitation.invitationId:", invitationId);
                    } else if (invitation.id) {
                        invitationId = invitation.id;
                        qrData = invitation.id;
                        console.log("✅ Found rawResponse.invitation.id:", invitationId);
                    }
                }
                // Fallback to try invitationDetails directly
                else if (response.invitationDetails && Object.keys(response.invitationDetails).length > 0) {
                    if (response.invitationDetails.id) {
                        invitationId = response.invitationDetails.id;
                        qrData = invitationId;
                        console.log("✅ Found fallback invitationDetails.id:", invitationId);
                    }
                }

                console.log("=== EXTRACTION RESULT ===");
                console.log("Final invitationId:", invitationId);
                console.log("Final qrData:", qrData);

                // If we have QR data, generate the QR code
                if (qrData) {
                    console.log("=== GENERATING QR CODE ===");
                    console.log("Calling /api/sdo/qr with invitationId:", invitationId);
                    
                    // Clear previous QR code
                    $('#qrcode').empty();

                    // Call server's QR code generation endpoint with the invitation ID
                    $.ajax({
                        url: '/api/sdo/qr',
                        method: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            invitationId: invitationId
                        }),
                        success: function(qrResponse) {
                            console.log("=== QR GENERATION RESPONSE ===");
                            console.log("QR Response:", qrResponse);
                            console.log("QR Response type:", typeof qrResponse);
                            console.log("QR Response keys:", Object.keys(qrResponse));
                            
                            if (qrResponse.success && qrResponse.qr_data) {
                                console.log("✅ QR generation successful");
                                console.log("QR Data received:", qrResponse.qr_data);
                                console.log("Invitation ID from QR response:", qrResponse.invitation_id);
                                
                                // Generate QR code with the server-provided data
                                new QRCode(document.getElementById("qrcode"), {
                                    text: qrResponse.qr_data,
                                    width: 200,
                                    height: 200,
                                    colorDark: "#000000",
                                    colorLight: "#ffffff",
                                    correctLevel: QRCode.CorrectLevel.H
                                });

                                // Display invitation ID with enhanced styling
                                $('#invitation-id').html(`
                                    <span class="badge bg-primary p-2">Invitation ID: ${invitationId}</span>
                                `);
                            } else {
                                console.log("❌ QR generation failed in response");
                                $('#qrcode').html('<div class="alert alert-warning">Failed to generate QR code from server</div>');
                                $('#invitation-id').text('');
                            }
                        },
                        error: function(xhr, status, error) {
                            console.log("=== QR GENERATION ERROR ===");
                            console.log("Status:", xhr.status);
                            console.log("Error:", error);
                            console.log("Response text:", xhr.responseText);
                            
                            $('#qrcode').html('<div class="alert alert-warning">Failed to generate QR code from server</div>');
                            $('#invitation-id').text('');
                        }
                    });
                } else {
                    // No data available for QR code - this shouldn't happen with the provided response format
                    $('#qrcode').html('<div class="alert alert-warning">Unable to generate QR code: No valid data found in response</div>');
                    $('#invitation-id').text('');

                    // Show detailed technical info for debugging
                    $('#invitation-result').append(`
                        <div class="alert alert-info mt-3">
                            <strong>Technical details:</strong>
                            <p>QR code generation failed. Unable to extract invitation ID from server response.</p>
                            <button class="btn btn-sm btn-outline-secondary mt-2" type="button" data-bs-toggle="collapse" data-bs-target="#responseDetails">
                                Show Response Details
                            </button>
                            <div class="collapse mt-2" id="responseDetails">
                                <div class="card card-body">
                                    <pre>${JSON.stringify(response, null, 2)}</pre>
                                </div>
                            </div>
                        </div>
                    `);
                }
            },
            error: function(xhr, status, error) {
                console.error("Invitation error:", error);
                console.error("Response:", xhr.responseText);

                let errorMessage = 'Failed to send invitation';

                try {
                    const errorResponse = JSON.parse(xhr.responseText);
                    if (errorResponse.error) {
                        errorMessage = errorResponse.error;
                    } else if (errorResponse.message) {
                        errorMessage = errorResponse.message;
                    }
                } catch (e) {
                    // If parsing fails, use the raw error
                    errorMessage = error || 'Unknown error occurred';
                }

                $('#invitation-result').html(`
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i> ${errorMessage}</div>
                    <div class="mt-3">
                        <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#errorDetails">
                            Show Technical Details
                        </button>
                        <div class="collapse mt-2" id="errorDetails">
                            <div class="card card-body">
                                <p><strong>Status:</strong> ${status}</p>
                                <p><strong>Error:</strong> ${error}</p>
                                <p><strong>Response Text:</strong></p>
                                <pre class="bg-light p-2">${xhr.responseText || 'No response text'}</pre>
                            </div>
                        </div>
                    </div>
                `);

                // Clear QR code area
                $('#qrcode').html('');
                $('#invitation-id').text('');
            }
        });
    });

    // Initialize copy buttons for verification IDs
    initCopyButtons();

    // Check if we have a previous verification result on page load
    const lastVerificationResult = localStorage.getItem('lastVerificationResult');
    if (lastVerificationResult) {
        try {
            const verification = JSON.parse(lastVerificationResult);
            console.log("Found previous verification result:", verification);
            updateInvitationSectionVisibility(verification);
        } catch (e) {
            console.error("Error parsing stored verification result:", e);
            updateInvitationSectionVisibility(null);
        }
    } else {
        // Check if we have a verification ID but no result
        const lastVerificationId = localStorage.getItem('lastVerificationId');
        if (lastVerificationId) {
            checkVerificationStatus(lastVerificationId);
        } else {
            // No verification ID, default to hiding invitation
            updateInvitationSectionVisibility(null);
        }
    }
});