package main

import (
	"log"
	"net/http"
	"os"

	"self-service-portal/internal/handlers"
	"self-service-portal/internal/middleware"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize Gin router
	router := gin.Default()

	// Setup session middleware with better configuration
	store := cookie.NewStore([]byte("your-secret-key-change-this-to-something-secure"))

	// Configure session options
	store.Options(sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 7, // 7 days
		HttpOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: http.SameSiteLaxMode,
	})

	router.Use(sessions.Sessions("self-service-portal", store))

	// Serve static files from the correct location
	router.Static("/static", "./web/static")

	log.Println("Initializing handlers...")

	// Initialize handlers
	loginHandler := handlers.NewLoginHandler()
	dashboardHandler := handlers.NewDashboardHandler()
	configHandler := handlers.NewConfigHandler()
	verificationHandler := handlers.NewVerificationHandler()
	authHandler := handlers.NewAuthHandler()

	log.Println("Setting up public routes...")

	// Public routes
	router.GET("/", func(c *gin.Context) {
		log.Println("Root route accessed, redirecting to /login")
		c.Redirect(http.StatusFound, "/login")
	})

	router.GET("/login", func(c *gin.Context) {
		log.Println("Login page accessed")
		loginHandler.LoginPage(c)
	})

	router.POST("/login", func(c *gin.Context) {
		log.Println("Login form submitted")
		loginHandler.ProcessLogin(c)
	})

	router.GET("/logout", func(c *gin.Context) {
		log.Println("Logout accessed")
		loginHandler.Logout(c)
	})

	// Health check
	router.GET("/health", func(c *gin.Context) {
		log.Println("Health check accessed")
		c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "Server is running"})
	})

	// Test route to verify server is working
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Server is working!",
			"routes":  []string{"/", "/login", "/logout", "/health", "/test", "/api/sdo/auth"},
		})
	})

	log.Println("Setting up protected routes...")

	// Protected routes (require portal login)
	protected := router.Group("/")
	protected.Use(middleware.RequireAuth())
	{
		// Dashboard and config
		protected.GET("/dashboard", func(c *gin.Context) {
			log.Println("Dashboard accessed")
			dashboardHandler.Dashboard(c)
		})

		protected.GET("/config", func(c *gin.Context) {
			log.Println("Config page accessed")
			configHandler.ConfigPage(c)
		})

		// Configuration routes
		protected.POST("/save-config", configHandler.SaveConfig)
		protected.GET("/get-config", configHandler.GetConfig)
		protected.GET("/export-config", configHandler.ExportConfig)
		protected.POST("/import-config", configHandler.ImportConfig)

		// Test connection routes
		protected.POST("/test-sdo-connection", configHandler.TestSDOConnection)
		protected.POST("/test-au10tix-connection", configHandler.TestAu10tixConnection)

		// Verification routes
		protected.POST("/start-verification", verificationHandler.StartVerification)
		protected.GET("/check-verification/:id", verificationHandler.CheckVerification)

		// Au10tix proxy routes
		protected.Any("/au10tix-proxy/*path", verificationHandler.Au10tixProxy)

		// ==== LEGACY SDO ROUTES (keeping for backward compatibility) ====
		protected.POST("/sdo-auth", func(c *gin.Context) {
			log.Println("🔐 SDO auth route accessed via protected group (legacy)")
			authHandler.SDOAuth(c)
		})

		protected.POST("/sdo-auth-from-config", func(c *gin.Context) {
			log.Println("🔐 SDO auth from config route accessed")
			authHandler.SDOAuthFromConfig(c)
		})

		protected.GET("/sdo-status", func(c *gin.Context) {
			log.Println("📊 SDO status check accessed (legacy)")
			authHandler.GetSDOStatus(c)
		})

		protected.GET("/logout-sdo", func(c *gin.Context) {
			log.Println("🚪 SDO logout accessed")
			authHandler.LogoutSDO(c)
		})

		protected.GET("/api/users/search", func(c *gin.Context) {
			log.Println("🔍 User search accessed (legacy)")
			authHandler.SearchUsers(c)
		})

		protected.GET("/sdo-search-users", func(c *gin.Context) {
			log.Println("🔍 SDO user search accessed (legacy)")
			authHandler.SearchSDOUsers(c)
		})

		protected.POST("/sdo-send-invitation", func(c *gin.Context) {
			log.Println("📤 Send invitation accessed (legacy)")
			authHandler.SendInvitation(c)
		})

		// ==== NEW API ROUTES (matching JavaScript expectations) ====
		api := protected.Group("/api")
		{
			// SDO Authentication routes
			api.POST("/sdo/auth", func(c *gin.Context) {
				log.Println("🔐 SDO auth API route accessed")
				authHandler.SDOAuth(c)
			})

			api.GET("/sdo/status", func(c *gin.Context) {
				log.Println("📊 SDO status API route accessed")
				authHandler.GetSDOStatus(c)
			})

			api.POST("/sdo/logout", func(c *gin.Context) {
				log.Println("🚪 SDO logout API route accessed")
				authHandler.LogoutSDO(c)
			})

			// SDO User Management routes
			api.GET("/sdo/search", func(c *gin.Context) {
				log.Println("🔍 SDO search API route accessed")
				authHandler.SearchUsers(c)
			})

			api.POST("/sdo/search", func(c *gin.Context) {
				log.Println("🔍 SDO search API route accessed (POST)")
				authHandler.SearchSDOUsers(c)
			})

			api.POST("/sdo/invite", func(c *gin.Context) {
				log.Println("📤 SDO invite API route accessed")
				authHandler.SendInvitation(c)
			})

			// SDO Invitation details for QR codes
			api.GET("/sdo/invitation/:id", func(c *gin.Context) {
				log.Println("🎫 SDO invitation details API route accessed")
				authHandler.GetInvitationDetails(c)
			})

			// Alternative endpoint names for compatibility
			api.GET("/invitations/:id", func(c *gin.Context) {
				log.Println("🎫 Get invitation details accessed (alt)")
				authHandler.GetInvitationDetails(c)
			})
		}

		// SDO API proxy (requires both portal login and SDO auth)
		protected.Any("/sdo-api/*path", authHandler.SDOAPIProxy)
	}

	// Debug route to list all registered routes
	router.GET("/debug/routes", func(c *gin.Context) {
		routes := gin.RoutesInfo{}
		for _, route := range router.Routes() {
			routes = append(routes, route)
		}
		c.JSON(http.StatusOK, gin.H{
			"routes": routes,
			"count":  len(routes),
		})
	})

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Server starting on port %s", port)
	log.Printf("📱 Visit: http://localhost:%s/", port)
	log.Printf("🔑 Login: http://localhost:%s/login", port)
	log.Printf("🏥 Health: http://localhost:%s/health", port)
	log.Printf("🧪 Test: http://localhost:%s/test", port)
	log.Printf("🛠️  Debug Routes: http://localhost:%s/debug/routes", port)
	log.Println("=====================================")
	log.Println("🔧 API Routes Available:")
	log.Println("   POST /api/sdo/auth     - SDO Authentication")
	log.Println("   GET  /api/sdo/status   - SDO Status Check")
	log.Println("   GET  /api/sdo/search   - Search Users")
	log.Println("   POST /api/sdo/invite   - Send Invitation")
	log.Println("=====================================")

	log.Fatal(http.ListenAndServe(":"+port, router))
}
