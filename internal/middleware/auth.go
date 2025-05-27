package middleware

import (
	"log"
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// RequireAuth checks if user is authenticated with the portal
func RequireAuth() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		session := sessions.Default(c)

		// Check for basic portal authentication
		userID := session.Get("user_id")
		authenticated := session.Get("authenticated")

		log.Printf("🔒 Auth middleware: checking session - userID: %v, authenticated: %v", userID, authenticated)

		if userID == nil || authenticated == nil || !authenticated.(bool) {
			log.Printf("❌ Auth middleware: User not authenticated, redirecting to login")
			log.Printf("📊 Session data: userID=%v, authenticated=%v", userID, authenticated)

			// Check if this is an AJAX request
			if c.GetHeader("Content-Type") == "application/json" || c.GetHeader("Accept") == "application/json" {
				c.JSON(http.StatusUnauthorized, gin.H{
					"error":    "Authentication required",
					"redirect": "/login",
				})
				c.Abort()
				return
			}

			// Regular request - redirect to login
			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}

		log.Printf("✅ Auth middleware: User authenticated as %v", userID)
		// User is authenticated, continue
		c.Next()
	})
}

// Optional: More specific SDO auth middleware
func RequireSDOAuth() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		session := sessions.Default(c)

		sdoAuth := session.Get("sdo_authenticated")
		if sdoAuth == nil || !sdoAuth.(bool) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "SDO authentication required",
			})
			c.Abort()
			return
		}

		c.Next()
	})
}
