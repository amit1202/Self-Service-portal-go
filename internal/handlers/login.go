package handlers

import (
	"log"
	"net/http"
	"self-service-portal/internal/config"
	"strings"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type LoginHandler struct {
	// Add any dependencies you need
}

func NewLoginHandler() *LoginHandler {
	return &LoginHandler{}
}

func (h *LoginHandler) LoginPage(c *gin.Context) {
	// Check if already logged in
	session := sessions.Default(c)
	if authenticated := session.Get("authenticated"); authenticated != nil && authenticated.(bool) {
		log.Printf("User already authenticated, redirecting to dashboard")
		c.Redirect(http.StatusFound, "/dashboard")
		return
	}

	html := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Self Service Portal</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css">
    <style>
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .login-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.18);
            width: 100%;
            max-width: 450px;
        }
        .login-header {
            background: linear-gradient(135deg, #667eea 0%, #408CFF 100%);
            color: white;
            border-radius: 20px 20px 0 0;
            text-align: center;
            padding: 2rem;
        }
        .login-body {
            padding: 2.5rem;
        }
        .form-control-lg {
            border-radius: 10px;
            border: 2px solid #e9ecef;
            transition: all 0.3s ease;
        }
        .form-control-lg:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 10px;
            padding: 12px;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .demo-credentials {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 1rem;
            margin-top: 1.5rem;
            border-left: 4px solid #667eea;
        }
        .alert {
            border-radius: 10px;
            margin-bottom: 1.5rem;
        }
        .form-label {
            font-weight: 600;
            color: #495057;
            margin-bottom: 0.5rem;
        }
        .text-muted {
            font-size: 0.9rem;
        }
        .spinner-border-sm {
            width: 1rem;
            height: 1rem;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-card">
            <div class="login-header">
                <h2><i class="bi bi-shield-lock me-2"></i>Self Service Portal</h2>
                <p class="mb-0 opacity-90">Secure Identity Management & Verification</p>
            </div>
            <div class="login-body">
                <div id="alert-container"></div>
                
                <form id="login-form">
                    <div class="mb-4">
                        <label for="username" class="form-label">
                            <i class="bi bi-person me-2"></i>Username
                        </label>
                        <input type="text" class="form-control form-control-lg" id="username" name="username" 
                               placeholder="Enter your username" required autocomplete="username">
                    </div>
                    <div class="mb-4">
                        <label for="password" class="form-label">
                            <i class="bi bi-lock me-2"></i>Password
                        </label>
                        <div class="input-group">
                            <input type="password" class="form-control form-control-lg" id="password" name="password" 
                                   placeholder="Enter your password" required autocomplete="current-password">
                            <button class="btn btn-outline-secondary" type="button" id="toggle-password">
                                <i class="bi bi-eye" id="toggle-icon"></i>
                            </button>
                        </div>
                    </div>
                    <div class="d-grid mb-3">
                        <button type="submit" class="btn btn-primary btn-lg" id="login-btn">
                            <i class="bi bi-box-arrow-in-right me-2"></i>Sign In
                        </button>
                    </div>
                </form>

                <div class="demo-credentials">
                    <h6 class="mb-2"><i class="bi bi-info-circle me-2"></i>Demo Credentials</h6>
                    <div class="row">
                        <div class="col-6">
                            <small class="text-muted d-block">Username:</small>
                            <code>admin</code>
                        </div>
                        <div class="col-6">
                            <small class="text-muted d-block">Password:</small>
                            <code>admin</code>
                        </div>
                    </div>
                    <small class="text-muted d-block mt-2">
                        <i class="bi bi-lightbulb me-1"></i>Click the credentials above to auto-fill
                    </small>
                </div>

                <div class="text-center mt-4">
                    <small class="text-muted">
                        <i class="bi bi-shield-check me-1"></i>
                        Access your identity verification and enrollment services
                    </small>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        $(document).ready(function() {
            // Auto-fill demo credentials when clicked
            $('.demo-credentials code').on('click', function() {
                const text = $(this).text();
                if (text === 'admin') {
                    if ($(this).parent().find('small').text().includes('Username')) {
                        $('#username').val(text).focus();
                    } else {
                        $('#password').val(text).focus();
                    }
                }
            });

            // Toggle password visibility
            $('#toggle-password').on('click', function() {
                const passwordField = $('#password');
                const toggleIcon = $('#toggle-icon');
                
                if (passwordField.attr('type') === 'password') {
                    passwordField.attr('type', 'text');
                    toggleIcon.removeClass('bi-eye').addClass('bi-eye-slash');
                } else {
                    passwordField.attr('type', 'password');
                    toggleIcon.removeClass('bi-eye-slash').addClass('bi-eye');
                }
            });

            // Handle login form submission
            $('#login-form').on('submit', function(e) {
                e.preventDefault();
                
                const username = $('#username').val().trim();
                const password = $('#password').val();
                
                // Basic validation
                if (!username || !password) {
                    showAlert('danger', 'Please enter both username and password');
                    return;
                }
                
                // Show loading state
                const loginBtn = $('#login-btn');
                const originalText = loginBtn.html();
                loginBtn.html('<span class="spinner-border spinner-border-sm me-2"></span>Signing in...').prop('disabled', true);
                
                // Clear any existing alerts
                $('#alert-container').empty();
                
                // Make login request
                $.ajax({
                    url: '/api/auth/login',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        username: username,
                        password: password
                    }),
                    timeout: 10000, // 10 second timeout
                    success: function(response) {
                        console.log('Login response:', response);
                        
                        if (response.success) {
                            showAlert('success', 'Login successful! Redirecting to dashboard...');
                            
                            // Redirect after a short delay
                            setTimeout(() => {
                                window.location.href = '/dashboard';
                            }, 1500);
                        } else {
                            showAlert('danger', response.error || 'Login failed. Please check your credentials.');
                            resetLoginButton(loginBtn, originalText);
                        }
                    },
                    error: function(xhr, status, error) {
                        console.error('Login error:', xhr.responseText);
                        
                        let errorMessage = 'Login failed. Please try again.';
                        
                        if (xhr.status === 401) {
                            errorMessage = 'Invalid username or password';
                        } else if (xhr.status === 0 || status === 'timeout') {
                            errorMessage = 'Connection failed. Please check your internet connection.';
                        } else if (xhr.status === 500) {
                            errorMessage = 'Server error. Please try again later.';
                        }
                        
                        showAlert('danger', errorMessage);
                        resetLoginButton(loginBtn, originalText);
                    }
                });
            });

            // Utility functions
            function showAlert(type, message) {
                const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
                const icon = type === 'success' ? 'bi-check-circle' : 'bi-exclamation-triangle';
                
                const alertHtml = 
                    '<div class="alert ' + alertClass + ' alert-dismissible fade show" role="alert">' +
                        '<i class="bi ' + icon + ' me-2"></i>' + message +
                        '<button type="button" class="btn-close" data-bs-dismiss="alert"></button>' +
                    '</div>';
                
                $('#alert-container').html(alertHtml);
                
                // Auto-dismiss success alerts
                if (type === 'success') {
                    setTimeout(() => {
                        $('.alert').fadeOut();
                    }, 3000);
                }
            }

            function resetLoginButton(button, originalText) {
                button.html(originalText).prop('disabled', false);
            }

            // Focus username field on page load
            $('#username').focus();
        });
    </script>
</body>
</html>`

	c.Header("Content-Type", "text/html")
	c.String(200, html)
}

func (h *LoginHandler) ProcessLogin(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request format"})
		return
	}

	// For the portal, we use hardcoded admin credentials
	if req.Username != "admin" || req.Password != "admin" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Invalid portal credentials"})
		return
	}

	// Authenticate with SDO using config credentials
	cfg := config.Load()
	authHandler := NewAuthHandler() // NewAuthHandler now takes no arguments

	// Load portal config for SDO credentials
	portalConfig := config.LoadPortalConfig()
	if portalConfig == nil {
		log.Printf("❌ Failed to load portal config")
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Configuration error"})
		return
	}

	// Use the SDO credentials from the config for the main login
	// The config should have the full URL with protocol
	sdoURL := cfg.SDODefaultURL
	if sdoURL != "" && !strings.HasPrefix(sdoURL, "http") {
		sdoURL = "https://" + sdoURL
	}
	log.Printf("🔍 Debug: SDO URL from config: %s", cfg.SDODefaultURL)
	log.Printf("🔍 Debug: Final SDO URL: %s", sdoURL)
	sdoAuthSuccessful := authHandler.performSDOAuth(c, sdoURL, portalConfig.Auth.SDOEmail, portalConfig.Auth.SDOPassword)

	if !sdoAuthSuccessful {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "SDO Authentication failed"})
		return
	}

	// Portal login is successful, and SDO auth is now stored in the session
	session := sessions.Default(c)
	session.Set("username", "admin")
	session.Set("authenticated", true)
	if err := session.Save(); err != nil {
		log.Printf("❌ Failed to save session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to save portal session"})
		return
	}

	log.Printf("🔐 Login attempt for user: %s", req.Username)
	log.Printf("✅ Login successful for user: %s", req.Username)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Login successful"})
}

func (h *LoginHandler) validateCredentials(username, password string) bool {
	// Enhanced validation logic
	// For demo purposes, we support multiple valid combinations
	validCredentials := map[string]string{
		"admin":    "admin",
		"user":     "user",
		"demo":     "demo",
		"test":     "test",
		"manager":  "manager",
		"operator": "operator",
	}

	// Check if username exists and password matches
	if validPassword, exists := validCredentials[username]; exists {
		return password == validPassword
	}

	// Also accept any non-empty credentials for flexibility (remove in production)
	return len(username) > 0 && len(password) > 0
}

func (h *LoginHandler) Logout(c *gin.Context) {
	session := sessions.Default(c)

	// Log the logout
	if username := session.Get("username"); username != nil {
		log.Printf("🚪 User logout: %s", username)
	}

	// Clear session
	session.Clear()
	if err := session.Save(); err != nil {
		log.Printf("⚠️ Failed to clear session: %v", err)
	}

	// Check if it's an AJAX request
	if c.GetHeader("Accept") == "application/json" || c.GetHeader("Content-Type") == "application/json" {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Logged out successfully",
		})
	} else {
		c.Redirect(http.StatusFound, "/login")
	}
}

func (h *LoginHandler) CheckAuth(c *gin.Context) {
	session := sessions.Default(c)
	authenticated := session.Get("authenticated")
	username := session.Get("username")

	if authenticated != nil && authenticated.(bool) {
		c.JSON(http.StatusOK, gin.H{
			"authenticated": true,
			"user":          username,
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"authenticated": false,
		})
	}
}
