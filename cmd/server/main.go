package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"self-service-portal/internal/handlers"

	"self-service-portal/internal/config"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
)

func main() {
	// Set Gin mode
	gin.SetMode(gin.DebugMode)

	// Create a new Gin engine
	r := gin.Default()

	// Configure session store with valid 32-byte keys
	authKey := []byte("12345678901234567890123456789012") // 32 bytes
	encKey := []byte("abcdefghijklmnopqrstuvwxyzabcdef")  // 32 bytes
	store := cookie.NewStore(authKey, encKey)
	store.Options(sessions.Options{
		Path:     "/",
		MaxAge:   86400, // 24 hours
		HttpOnly: true,
		Secure:   false, // Set to true in production
	})
	r.Use(sessions.Sessions("session", store))

	log.Println("✅ Session store configured with proper keys")
	log.Printf("   Hash key length: %d bytes", len(authKey))
	log.Printf("   Block key length: %d bytes", len(encKey))

	// Serve static files
	r.Static("/static", "./web/static")

	// Load HTML templates
	r.LoadHTMLGlob("web/templates/*.html")

	log.Println("🚀 Starting Self Service Portal...")

	// Initialize handlers
	log.Println("Initializing handlers...")
	authHandler := &handlers.AuthHandler{}
	loginHandler := &handlers.LoginHandler{}
	configHandler := handlers.NewConfigHandler()
	verificationHandler := handlers.NewVerificationHandler(configHandler)

	// Start background task for cleaning up expired verification sessions
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			verificationHandler.CleanupExpiredSessions()
		}
	}()
	log.Println("🔄 Started verification session cleanup background task")

	// Public routes
	log.Println("Setting up public routes...")
	r.GET("/", func(c *gin.Context) {
		log.Println("Root route accessed, redirecting to /login")
		c.Redirect(http.StatusFound, "/login")
	})

	r.GET("/login", loginHandler.LoginPage)
	r.GET("/logout", loginHandler.Logout)
	r.POST("/login", func(c *gin.Context) {
		loginHandler.ProcessLogin(c)
	})

	r.GET("/health", func(c *gin.Context) {
		log.Println("Health check accessed")
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "timestamp": time.Now()})
	})

	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Test endpoint working"})
	})

	// Protected routes
	log.Println("Setting up protected routes...")
	protected := r.Group("/")
	protected.Use(authMiddleware())

	protected.GET("/dashboard", func(c *gin.Context) {
		user := c.MustGet("user").(string)
		log.Printf("✅ Authenticated access to /dashboard by user: %s", user)
		log.Println("Dashboard accessed")
		c.HTML(http.StatusOK, "dashboard.html", gin.H{
			"user": user,
		})
	})

	protected.GET("/self-service", func(c *gin.Context) {
		user := c.MustGet("user").(string)
		log.Printf("✅ Authenticated access to /self-service by user: %s", user)
		log.Println("Self-service flow accessed")

		// Load config and create SDO config JSON
		cfg := config.Load()

		// Read portal config directly for SDO credentials
		sdoConfig := map[string]string{
			"url":      cfg.SDODefaultURL,
			"email":    "",
			"password": "",
		}

		// Try to read portal-config.json for SDO credentials
		if data, err := os.ReadFile("portal-config.json"); err == nil {
			var portalConfig struct {
				Auth struct {
					SDOEmail    string `json:"sdo_email"`
					SDOPassword string `json:"sdo_password"`
				} `json:"auth"`
			}
			if json.Unmarshal(data, &portalConfig) == nil {
				sdoConfig["email"] = portalConfig.Auth.SDOEmail
				sdoConfig["password"] = portalConfig.Auth.SDOPassword
			}
		}

		sdoConfigJSON, _ := json.Marshal(sdoConfig)

		c.HTML(http.StatusOK, "self-service-flow.html", gin.H{
			"user":          user,
			"SDOConfigJSON": string(sdoConfigJSON),
		})
	})

	// Configuration routes
	protected.GET("/config", configHandler.ConfigPage)
	protected.POST("/save-config", configHandler.SaveConfig)
	protected.GET("/get-config", configHandler.GetConfig)
	protected.GET("/export-config", configHandler.ExportConfig)
	protected.POST("/import-config", configHandler.ImportConfig)
	protected.POST("/test-sdo-connection", configHandler.TestSDOConnection)
	protected.POST("/test-au10tix-connection", configHandler.TestAu10tixConnection)

	// Verification routes
	protected.POST("/start-verification", verificationHandler.StartVerification)
	protected.GET("/check-verification/:id", verificationHandler.GetVerificationStatus)

	// API routes
	api := r.Group("/api")

	// Auth API routes
	api.POST("/auth/login", loginHandler.ProcessLogin)
	api.POST("/auth/logout", loginHandler.Logout)
	api.GET("/auth/check", loginHandler.CheckAuth)

	// SDO API routes
	api.POST("/sdo/auth", authHandler.SDOAuth)
	api.GET("/sdo/status", authHandler.GetSDOStatus)
	api.POST("/sdo/logout", authHandler.LogoutSDO)
	api.POST("/sdo/test-connection", authHandler.TestSDOConnection)
	api.GET("/sdo/search", authHandler.SearchUsers)

	// SDO invitation and QR code routes
	sdo := api.Group("/sdo")
	sdo.POST("/invite", authHandler.SendInvitation)
	sdo.POST("/qr", authHandler.GenerateQRCode)
	sdo.POST("/verify-user", authHandler.VerifyUserState)

	// Portal and validation
	sdo.GET("/portal/check", authHandler.CheckSDOPortal)
	sdo.GET("/validate", authHandler.ValidateInvitationID)

	// Verification API routes
	api.POST("/verification/start", func(c *gin.Context) {
		log.Println("🛡️ Au10tix verification start API route accessed")
		verificationHandler.StartVerification(c)
	})

	api.GET("/verification/:id/status", func(c *gin.Context) {
		log.Printf("📊 Au10tix verification status check accessed")
		verificationHandler.GetVerificationStatus(c)
	})

	// Start server
	port := ":8080"
	log.Printf("🚀 Server starting on port %s", port)
	log.Printf("📱 Visit: http://localhost%s/", port)
	log.Printf("🔑 Login: http://localhost%s/login (admin/admin)", port)
	log.Printf("🏠 Dashboard: http://localhost%s/dashboard", port)
	log.Printf("⚙️ Configuration: http://localhost%s/config", port)
	log.Printf("🏥 Health: http://localhost%s/health", port)
	log.Printf("🧪 Test: http://localhost%s/test", port)
	log.Println("=====================================")
	log.Println("🔧 API Routes Available:")
	log.Println("   ✅ POST /api/sdo/auth           - SDO Authentication")
	log.Println("   ✅ GET  /api/sdo/status         - SDO Status")
	log.Println("   ✅ GET  /api/sdo/search         - Search Users")
	log.Println("   ✅ POST /api/sdo/test-connection - SDO Connection Test")
	log.Println("   ✅ GET  /api/sdo/portal/check   - SDO Portal Check")
	log.Println("   ✅ GET  /api/sdo/validate       - SDO Validation")
	log.Println("   ✅ POST /api/verification/start - Au10tix Verification")
	log.Println("   ✅ GET  /api/verification/:id/status - Check Status")
	log.Println("=====================================")

	// Create server
	srv := &http.Server{
		Addr:    port,
		Handler: r,
	}

	// Start server in a goroutine
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Give outstanding requests a deadline for completion
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting")
}

// authMiddleware checks if the user is authenticated
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		authenticated := session.Get("authenticated")
		username := session.Get("username")

		if authenticated == nil || !authenticated.(bool) || username == nil {
			log.Printf("🚫 Unauthorized access attempt to %s from IP: %s", c.Request.URL.Path, c.ClientIP())
			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}
		c.Set("user", username)
		c.Next()
	}
}
