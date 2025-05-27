package handlers

import (
	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	// Add any dependencies you need
}

func NewDashboardHandler() *DashboardHandler {
	return &DashboardHandler{}
}

func (h *DashboardHandler) Dashboard(c *gin.Context) {
	// Return enhanced dashboard HTML
	html := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Self Service Portal</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css">
    <style>
        body {
            background-color: #f8f9fa;
        }
        .navbar-brand {
            font-weight: 600;
        }
        .card {
            border: none;
            border-radius: 15px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 15px rgba(0, 0, 0, 0.15);
        }
        .card-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 15px 15px 0 0 !important;
            border: none;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .stat-number {
            font-size: 2.5rem;
            font-weight: 700;
        }
        .welcome-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 2rem;
        }
        .status-badge {
            font-size: 0.9rem;
            padding: 0.5rem 1rem;
            border-radius: 20px;
        }
        .btn-custom {
            border-radius: 10px;
            padding: 0.75rem 1.5rem;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        .btn-custom:hover {
            transform: translateY(-1px);
        }
        #qrcode canvas {
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
        <div class="container">
            <a class="navbar-brand" href="/dashboard">
                <i class="bi bi-shield-lock me-2"></i>Self Service Portal
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <div class="navbar-nav me-auto">
                    <a class="nav-link active" href="/dashboard">
                        <i class="bi bi-speedometer2 me-1"></i>Dashboard
                    </a>
                    <a class="nav-link" href="/config">
                        <i class="bi bi-gear me-1"></i>Configuration
                    </a>
                </div>
                <div class="navbar-nav">
                    <span class="nav-link text-light">
                        <i class="bi bi-person-circle me-1"></i>Welcome, Admin
                    </span>
                    <a class="nav-link" href="/logout">
                        <i class="bi bi-box-arrow-right"></i>Logout
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <div class="container mt-4">
        <!-- Welcome Header -->
        <div class="welcome-header text-center">
            <h1><i class="bi bi-house-door me-3"></i>Dashboard</h1>
            <p class="lead mb-0">Manage your Secret Double Octopus integrations and user enrollments</p>
        </div>

        <!-- Status Cards -->
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card stat-card text-center">
                    <div class="card-body">
                        <i class="bi bi-shield-check" style="font-size: 2rem;"></i>
                        <div class="stat-number">1</div>
                        <div>Active Connections</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stat-card text-center">
                    <div class="card-body">
                        <i class="bi bi-people" style="font-size: 2rem;"></i>
                        <div class="stat-number" id="users-count">0</div>
                        <div>Users Found</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stat-card text-center">
                    <div class="card-body">
                        <i class="bi bi-envelope" style="font-size: 2rem;"></i>
                        <div class="stat-number" id="invitations-sent">0</div>
                        <div>Invitations Sent</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stat-card text-center">
                    <div class="card-body">
                        <i class="bi bi-qr-code" style="font-size: 2rem;"></i>
                        <div class="stat-number" id="qr-generated">0</div>
                        <div>QR Codes Generated</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <!-- SDO Authentication Card -->
            <div class="col-lg-6 mb-4">
                <div class="card h-100">
                    <div class="card-header">
                        <h4 class="mb-0"><i class="bi bi-shield-lock me-2"></i>SDO Authentication</h4>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <span id="auth-status-badge" class="badge bg-warning status-badge">
                                <i class="bi bi-exclamation-triangle me-1"></i>Not Authenticated
                            </span>
                        </div>
                        
                        <form id="sdo-login-form">
                            <div class="mb-3">
                                <label for="sdo-url" class="form-label fw-semibold">
                                    <i class="bi bi-link-45deg me-1"></i>SDO Instance URL
                                </label>
                                <input type="text" class="form-control" id="sdo-url" name="url" 
                                       placeholder="amitmt.doubleoctopus.io" required>
                            </div>
                            <div class="mb-3">
                                <label for="sdo-email" class="form-label fw-semibold">
                                    <i class="bi bi-envelope me-1"></i>Email
                                </label>
                                <input type="email" class="form-control" id="sdo-email" name="email" required>
                            </div>
                            <div class="mb-4">
                                <label for="sdo-password" class="form-label fw-semibold">
                                    <i class="bi bi-lock me-1"></i>Password
                                </label>
                                <input type="password" class="form-control" id="sdo-password" name="password" required>
                            </div>
                            <button type="submit" class="btn btn-primary btn-custom w-100">
                                <i class="bi bi-box-arrow-in-right me-2"></i>Authenticate with SDO
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <!-- User Search Card -->
            <div class="col-lg-6 mb-4">
                <div class="card h-100">
                    <div class="card-header">
                        <h4 class="mb-0"><i class="bi bi-search me-2"></i>User Search & Enrollment</h4>
                    </div>
                    <div class="card-body">
                        <form id="user-search-form">
                            <div class="mb-3">
                                <label for="user-search-input" class="form-label fw-semibold">
                                    <i class="bi bi-person-search me-1"></i>Search Users
                                </label>
                                <div class="input-group">
                                    <input type="text" class="form-control" id="user-search-input" 
                                           placeholder="Enter name or email (min 2 characters)" required>
                                    <button class="btn btn-outline-primary btn-custom" type="submit">
                                        <i class="bi bi-search"></i>
                                    </button>
                                </div>
                                <div class="form-text">Search for users in your directory to send enrollment invitations</div>
                            </div>
                        </form>
                        <div id="user-search-results"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- QR Code Generation Card -->
        <div class="row">
            <div class="col-12 mb-4">
                <div class="card">
                    <div class="card-header">
                        <h4 class="mb-0"><i class="bi bi-qr-code me-2"></i>QR Code for Mobile Enrollment</h4>
                    </div>
                    <div class="card-body" id="qrcode-container">
                        <div class="row">
                            <div class="col-md-6">
                                <div id="qrcode" class="text-center mb-3"></div>
                                <div id="invitation-id" class="text-muted text-center"></div>
                            </div>
                            <div class="col-md-6">
                                <h5>How to use the QR Code:</h5>
                                <ol class="list-group list-group-numbered">
                                    <li class="list-group-item">Open the Secret Double Octopus mobile app</li>
                                    <li class="list-group-item">Tap "Scan QR Code" or the camera icon</li>
                                    <li class="list-group-item">Point your camera at the QR code</li>
                                    <li class="list-group-item">Follow the enrollment instructions</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Invitation Modal -->
    <div class="modal fade" id="invitationModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="bi bi-envelope-plus me-2"></i>Send Enrollment Invitation
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="invitation-form">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-2"></i>
                            Send invitation to: <strong id="invitation-user-name"></strong>
                        </div>
                        <input type="hidden" id="invitation-user-id">
                        
                        <div class="mb-3">
                            <label class="form-label fw-semibold">Select Invitation Types:</label>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="invitationTypes" value="MOBILE" id="mobile-invite" checked>
                                <label class="form-check-label" for="mobile-invite">
                                    <i class="bi bi-phone me-1"></i>Mobile App Enrollment
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="invitationTypes" value="WEB" id="web-invite">
                                <label class="form-check-label" for="web-invite">
                                    <i class="bi bi-browser-chrome me-1"></i>Web Browser Enrollment
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="send-invitation-btn">
                        <i class="bi bi-send me-1"></i>Send Invitation
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
    <script src="/static/js/sdo-auth-js.js"></script>
</body>
</html>`

	c.Header("Content-Type", "text/html")
	c.String(200, html)
}
