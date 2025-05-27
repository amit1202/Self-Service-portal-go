package handlers

import (
	"net/http"

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
	if userID := session.Get("user_id"); userID != nil {
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
        }
        .login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .login-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 20px 20px 0 0;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="col-md-6 col-lg-4">
            <div class="card login-card">
                <div class="card-header login-header text-center py-4">
                    <h2><i class="bi bi-shield-lock me-2"></i>Self Service Portal</h2>
                    <p class="mb-0">Secure Identity Management</p>
                </div>
                <div class="card-body p-5">
                    <div id="alert-container"></div>
                    <form id="login-form">
                        <div class="mb-4">
                            <label for="username" class="form-label">
                                <i class="bi bi-person me-2"></i>Username
                            </label>
                            <input type="text" class="form-control form-control-lg" id="username" name="username" required>
                        </div>
                        <div class="mb-4">
                            <label for="password" class="form-label">
                                <i class="bi bi-lock me-2"></i>Password
                            </label>
                            <input type="password" class="form-control form-control-lg" id="password" name="password" required>
                        </div>
                        <div class="d-grid">
                            <button type="submit" class="btn btn-primary btn-lg">
                                <i class="bi bi-box-arrow-in-right me-2"></i>Sign In
                            </button>
                        </div>
                    </form>
                    <div class="text-center mt-4">
                        <small class="text-muted">Access your identity verification services</small>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        $(document).ready(function() {
            $('#login-form').on('submit', function(e) {
                e.preventDefault();
                
                const username = $('#username').val();
                const password = $('#password').val();
                
                // Show loading state
                const submitBtn = $(this).find('button[type="submit"]');
                const originalText = submitBtn.html();
                submitBtn.html('<span class="spinner-border spinner-border-sm me-2"></span>Signing in...').prop('disabled', true);
                
                // Simple authentication (you can enhance this)
                $.ajax({
                    url: '/login',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        username: username,
                        password: password
                    }),
                    success: function(response) {
                        if (response.success) {
                            $('#alert-container').html('<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>Login successful! Redirecting...</div>');
                            setTimeout(() => {
                                window.location.href = '/dashboard';
                            }, 1000);
                        } else {
                            $('#alert-container').html('<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>' + (response.error || 'Login failed') + '</div>');
                            submitBtn.html(originalText).prop('disabled', false);
                        }
                    },
                    error: function() {
                        $('#alert-container').html('<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>Login failed. Please try again.</div>');
                        submitBtn.html(originalText).prop('disabled', false);
                    }
                });
            });
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
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request format",
		})
		return
	}

	// Simple authentication logic (enhance as needed)
	// For demo purposes, accept any non-empty credentials
	if req.Username != "" && req.Password != "" {
		session := sessions.Default(c)
		session.Set("user_id", req.Username)
		session.Set("user_name", req.Username)
		session.Set("authenticated", true)
		session.Save()

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Login successful",
		})
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Invalid credentials",
		})
	}
}

func (h *LoginHandler) Logout(c *gin.Context) {
	session := sessions.Default(c)
	session.Clear()
	session.Save()

	c.Redirect(http.StatusFound, "/login")
}
