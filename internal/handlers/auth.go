// File: internal/handlers/auth.go - Fixed Portal Address and QR Generation
package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	mathRand "math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"

	"self-service-portal/internal/services"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/skip2/go-qrcode"
)

// AuthHandler handles all SDO authentication and user management
type AuthHandler struct {
	// Add any dependencies you need here, like database connections
}

// JWT Claims structure
type JWTClaims struct {
	Email         string `json:"email"`
	SDOURL        string `json:"sdo_url"`
	SDOTokenRef   string `json:"sdo_token_ref"`
	Authenticated bool   `json:"authenticated"`
	IssuedAt      int64  `json:"iat"`
	ExpiresAt     int64  `json:"exp"`
}

// JWT secret key (use environment variable in production)
var jwtSecret = []byte("your-jwt-secret-key-at-least-32-characters-long!")

// NewAuthHandler creates a new AuthHandler instance
func NewAuthHandler() *AuthHandler {
	return &AuthHandler{}
}

// Simple in-memory token storage (use Redis/database in production)
var (
	tokenStorage     = make(map[string]string)
	tokenDataStorage = make(map[string]map[string]string)
)

// Initialize random seed
func init() {
	mathRand.Seed(time.Now().UnixNano())
}

// Helper function to get the portal base URL from admin URL
func getPortalBaseURL(adminURL string) string {
	// Remove /admin suffix if present
	baseURL := strings.TrimSuffix(adminURL, "/admin")

	// Remove trailing slash
	baseURL = strings.TrimSuffix(baseURL, "/")

	log.Printf("🌐 Portal URL conversion: %s -> %s", adminURL, baseURL)
	return baseURL
}

// Helper functions for token storage
func storeTokenReference(tokenID, token string) {
	tokenStorage[tokenID] = token
	log.Printf("📦 Stored token reference: %s (length: %d)", tokenID, len(token))
}

func storeTokenDataReference(dataID string, data map[string]string) {
	tokenDataStorage[dataID] = data
	log.Printf("📦 Stored data reference: %s", dataID)
}

func getStoredToken(tokenID string) (string, bool) {
	token, exists := tokenStorage[tokenID]
	if exists {
		log.Printf("📋 Retrieved token reference: %s (length: %d)", tokenID, len(token))
	} else {
		log.Printf("❌ Token reference not found: %s", tokenID)
	}
	return token, exists
}

func getStoredTokenData(dataID string) (map[string]string, bool) {
	data, exists := tokenDataStorage[dataID]
	if exists {
		log.Printf("📋 Retrieved data reference: %s", dataID)
	} else {
		log.Printf("❌ Data reference not found: %s", dataID)
	}
	return data, exists
}

func generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[mathRand.Intn(len(charset))]
	}
	return string(b)
}

// JWT token generation and verification functions
func generateJWT(email, sdoURL, sdoTokenRef string) (string, error) {
	claims := JWTClaims{
		Email:         email,
		SDOURL:        sdoURL,
		SDOTokenRef:   sdoTokenRef,
		Authenticated: true,
		IssuedAt:      time.Now().Unix(),
		ExpiresAt:     time.Now().Add(24 * time.Hour).Unix(),
	}

	// Create header
	header := map[string]string{
		"alg": "HS256",
		"typ": "JWT",
	}

	headerJSON, _ := json.Marshal(header)
	headerEncoded := base64.RawURLEncoding.EncodeToString(headerJSON)

	// Create payload
	payloadJSON, _ := json.Marshal(claims)
	payloadEncoded := base64.RawURLEncoding.EncodeToString(payloadJSON)

	// Create signature
	message := headerEncoded + "." + payloadEncoded
	h := hmac.New(sha256.New, jwtSecret)
	h.Write([]byte(message))
	signature := base64.RawURLEncoding.EncodeToString(h.Sum(nil))

	token := message + "." + signature
	return token, nil
}

// Verify JWT token
func verifyJWT(tokenString string) (*JWTClaims, error) {
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}

	// Verify signature
	message := parts[0] + "." + parts[1]
	h := hmac.New(sha256.New, jwtSecret)
	h.Write([]byte(message))
	expectedSignature := base64.RawURLEncoding.EncodeToString(h.Sum(nil))

	if parts[2] != expectedSignature {
		return nil, fmt.Errorf("invalid token signature")
	}

	// Decode payload
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("failed to decode payload: %v", err)
	}

	var claims JWTClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, fmt.Errorf("failed to parse claims: %v", err)
	}

	// Check expiration
	if time.Now().Unix() > claims.ExpiresAt {
		return nil, fmt.Errorf("token expired")
	}

	return &claims, nil
}

// SDOAuth handles SDO authentication requests with enhanced session management
func (h *AuthHandler) SDOAuth(c *gin.Context) {
	log.Println("=== SDO Authentication Request Started ===")

	var req struct {
		URL      string `json:"url" binding:"required"`
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("SDO Auth: Invalid request format: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request format: " + err.Error(),
		})
		return
	}

	if h.performSDOAuth(c, req.URL, req.Email, req.Password) {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "SDO authentication successful"})
	}
}

// performSDOAuth is the internal logic for SDO authentication
func (h *AuthHandler) performSDOAuth(c *gin.Context, url, email, password string) bool {
	sdoService := services.NewSDOService()

	log.Printf("SDO Auth: Attempting authentication to URL: %s, Email: %s", url, email)

	// Call the service to authenticate
	authResp, err := sdoService.Authenticate(url, email, password)
	if err != nil {
		log.Printf("SDO Auth: Authentication failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "SDO authentication failed",
			"details": err.Error(),
		})
		return false
	}

	log.Printf("SDO Auth: Authentication successful, token length: %d", len(authResp.Token))

	session := sessions.Default(c)
	session.Set("sdo_authenticated", true)
	session.Set("sdo_token", authResp.Token)
	session.Set("sdo_url", sdoService.BaseURL)
	session.Set("sdo_email", email)

	if err := session.Save(); err != nil {
		log.Printf("SDO Auth: Failed to save session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to save SDO session",
		})
		return false
	}

	log.Println("✅ SDO Auth: Session saved successfully")
	return true
}

// Modified SDOAuth function using JWT instead of sessions
func (h *AuthHandler) SDOAuthJWT(c *gin.Context) {
	log.Println("=== SDO JWT Authentication Request Started ===")

	var req struct {
		URL      string `json:"url" binding:"required"`
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("SDO Auth: Invalid request format: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request format: " + err.Error(),
		})
		return
	}

	log.Printf("SDO Auth: Attempting authentication to URL: %s, Email: %s", req.URL, req.Email)

	// Create SDO service and authenticate
	sdoService := services.NewSDOService()
	authResp, err := sdoService.Authenticate(req.URL, req.Email, req.Password)
	if err != nil {
		log.Printf("SDO Auth: Authentication failed: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "SDO Authentication failed: " + err.Error(),
		})
		return
	}

	log.Printf("SDO Auth: Authentication successful, token length: %d", len(authResp.Token))

	// Store SDO token with reference
	tokenRef := fmt.Sprintf("jwt_%d_%s", time.Now().Unix(), generateRandomString(8))
	tokenStorage[tokenRef] = authResp.Token

	log.Printf("✅ SDO Auth: Stored token with reference: %s", tokenRef)

	// Generate JWT token
	jwtToken, err := generateJWT(req.Email, sdoService.BaseURL, tokenRef)
	if err != nil {
		log.Printf("❌ SDO Auth: Failed to generate JWT: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate authentication token",
		})
		return
	}

	log.Printf("✅ SDO Auth: Generated JWT token")

	// Return response with JWT token
	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"message":      "Successfully authenticated with Secret Double Octopus",
		"status":       "authenticated",
		"base_url":     sdoService.BaseURL,
		"token_length": len(authResp.Token),
		"auth_token":   jwtToken, // Client will store this
		"auth_method":  "jwt",
	})
}

// SDOAuthFromConfig handles authentication using stored configuration
func (h *AuthHandler) SDOAuthFromConfig(c *gin.Context) {
	// This would use stored configuration from your config handler
	// For now, return a placeholder response
	c.JSON(http.StatusNotImplemented, gin.H{
		"error": "SDO auth from config not yet implemented",
	})
}

// LogoutSDO handles SDO logout with enhanced cleanup
func (h *AuthHandler) LogoutSDO(c *gin.Context) {
	session := sessions.Default(c)

	// Clean up token references before clearing session
	if tokenID := session.Get("sdo_token_id"); tokenID != nil {
		delete(tokenStorage, tokenID.(string))
		log.Printf("🗑️ Cleaned up token reference: %s", tokenID)
	}

	if dataID := session.Get("sdo_data_id"); dataID != nil {
		delete(tokenDataStorage, dataID.(string))
		log.Printf("🗑️ Cleaned up data reference: %s", dataID)
	}

	// Clear SDO-related session data (matching Flask exactly)
	session.Delete("sdo_token")
	session.Delete("sdo_token_id")
	session.Delete("sdo_data_id")
	session.Delete("sdo_url")
	session.Delete("sdo_authenticated")
	session.Delete("sdo_email")
	session.Delete("auth_time")
	session.Save()

	log.Println("SDO logout: Cleared session data and references")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Disconnected from Secret Double Octopus",
		"status":  "unauthenticated",
	})
}

// GetSDOStatus returns current SDO authentication status
func (h *AuthHandler) GetSDOStatus(c *gin.Context) {
	log.Println("=== SDO Status Check ===")

	session := sessions.Default(c)
	isAuthenticated := session.Get("sdo_authenticated")

	// Get authentication data using enhanced retrieval
	authData := h.getAuthDataFromSession(session)

	status := gin.H{
		"authenticated": isAuthenticated != nil && isAuthenticated.(bool),
		"status":        "unauthenticated",
	}

	if isAuthenticated != nil && isAuthenticated.(bool) && authData != nil {
		status["status"] = "authenticated"
		status["base_url"] = authData["url"]
		status["email"] = authData["email"]
		if token := authData["token"]; token != "" {
			status["token_length"] = len(token)
		}

		log.Printf("SDO Status: Authenticated, Base URL: %s, Email: %s", authData["url"], authData["email"])
	} else {
		log.Println("SDO Status: Not authenticated")
	}

	c.JSON(http.StatusOK, status)
}

// Helper method to get authentication data from session (handles all storage methods)
func (h *AuthHandler) getAuthDataFromSession(session sessions.Session) map[string]string {
	var authData = make(map[string]string)

	// Method 1: Direct storage
	if token := session.Get("sdo_token"); token != nil {
		authData["token"] = token.(string)
		if url := session.Get("sdo_url"); url != nil {
			authData["url"] = url.(string)
		}
		if email := session.Get("sdo_email"); email != nil {
			authData["email"] = email.(string)
		}
		log.Printf("📋 Retrieved auth data: direct storage")
		return authData
	}

	// Method 2: Token reference storage
	if tokenID := session.Get("sdo_token_id"); tokenID != nil {
		if storedToken, exists := getStoredToken(tokenID.(string)); exists {
			authData["token"] = storedToken
			if url := session.Get("sdo_url"); url != nil {
				authData["url"] = url.(string)
			}
			if email := session.Get("sdo_email"); email != nil {
				authData["email"] = email.(string)
			}
			log.Printf("📋 Retrieved auth data: token reference")
			return authData
		}
	}

	// Method 3: Full data reference storage
	if dataID := session.Get("sdo_data_id"); dataID != nil {
		if storedData, exists := getStoredTokenData(dataID.(string)); exists {
			authData["token"] = storedData["token"]
			authData["url"] = storedData["url"]
			authData["email"] = storedData["email"]
			log.Printf("📋 Retrieved auth data: full reference")
			return authData
		}
	}

	log.Printf("❌ No auth data found in session")
	return nil
}

// Middleware to verify JWT token
func (h *AuthHandler) RequireJWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header required",
			})
			c.Abort()
			return
		}

		// Remove "Bearer " prefix
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid authorization header format",
			})
			c.Abort()
			return
		}

		// Verify token
		claims, err := verifyJWT(tokenString)
		if err != nil {
			log.Printf("JWT verification failed: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid or expired token",
			})
			c.Abort()
			return
		}

		// Store claims in context for later use
		c.Set("jwt_claims", claims)
		c.Next()
	}
}

// Helper to get authentication data from JWT
func (h *AuthHandler) getAuthDataFromJWT(c *gin.Context) map[string]string {
	claims, exists := c.Get("jwt_claims")
	if !exists {
		return nil
	}

	jwtClaims := claims.(*JWTClaims)

	// Get SDO token from reference
	sdoToken, exists := tokenStorage[jwtClaims.SDOTokenRef]
	if !exists {
		log.Printf("❌ SDO token not found for reference: %s", jwtClaims.SDOTokenRef)
		return nil
	}

	return map[string]string{
		"token": sdoToken,
		"url":   jwtClaims.SDOURL,
		"email": jwtClaims.Email,
	}
}

// SDOAPIProxy proxies requests to SDO API
func (h *AuthHandler) SDOAPIProxy(c *gin.Context) {
	sdoService := h.getSDOService(c)
	if sdoService == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "not authenticated with SDO",
		})
		return
	}

	// Get the path after /sdo-api/
	path := c.Param("path")

	// Read request body
	var body io.Reader
	if c.Request.Body != nil {
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "failed to read request body",
			})
			return
		}
		body = bytes.NewReader(bodyBytes)
	}

	// Proxy the request
	resp, err := sdoService.ProxyRequest(c.Request.Method, path, body, c.Request.URL.Query())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			c.Header(key, value)
		}
	}

	// Copy response body
	c.Status(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}

// SearchUsers searches for users in SDO directory (enhanced with better session handling)
func (h *AuthHandler) SearchUsers(c *gin.Context) {
	log.Println("=== User Search API Called ===")

	// Get the search query
	searchTerm := c.Query("q")
	if searchTerm == "" || len(searchTerm) < 2 {
		log.Printf("Search validation failed: term='%s', length=%d", searchTerm, len(searchTerm))
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Search term must be at least 2 characters",
		})
		return
	}

	log.Printf("User search: term='%s'", searchTerm)

	// Get session and authentication data
	session := sessions.Default(c)
	authData := h.getAuthDataFromSession(session)

	if authData == nil || authData["token"] == "" || authData["url"] == "" {
		log.Printf("❌ User search: No SDO authentication found in session")
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Not authenticated with Secret Double Octopus. Please authenticate first.",
		})
		return
	}

	token := authData["token"]
	baseURL := authData["url"]

	log.Printf("✅ Using SDO credentials: URL=%s, Token length=%d", baseURL, len(token))

	// Build the SDO API URL (matching Python exactly)
	searchURL := baseURL + "/api/directories/explorer/members/search"

	// Set up parameters (matching Python exactly)
	params := url.Values{}
	params.Set("path", "cm9vdA")     // Base64 encoding of "root"
	params.Set("pageSize", "10")     // Fixed to 10 like Python
	params.Set("search", searchTerm) // The search term

	// Build full URL with parameters
	fullURL := searchURL + "?" + params.Encode()
	log.Printf("Making request to: %s", fullURL)

	// Create HTTP request
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		log.Printf("❌ Failed to create search request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create search request",
		})
		return
	}

	// Set up headers (matching Python exactly)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	// Make the request with timeout
	client := &http.Client{
		Timeout: 15 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ SDO API request error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Search request failed: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	log.Printf("SDO API response status: %d", resp.StatusCode)

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("❌ Failed to read response body: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to read search response",
		})
		return
	}

	// Log response for debugging (first 500 chars)
	responsePreview := string(body)
	if len(responsePreview) > 500 {
		responsePreview = responsePreview[:500] + "..."
	}
	log.Printf("SDO API response body: %s", responsePreview)

	// Check response status
	if resp.StatusCode == 200 {
		// Parse response
		var searchResults interface{}
		if err := json.Unmarshal(body, &searchResults); err != nil {
			log.Printf("❌ Failed to parse JSON response: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to parse search response",
			})
			return
		}

		// Extract users from the response
		var users []interface{}

		// Check if response is a dict with 'data' field (from logs, this is the correct field)
		if searchMap, ok := searchResults.(map[string]interface{}); ok {
			if data, exists := searchMap["data"]; exists {
				if dataArray, ok := data.([]interface{}); ok {
					users = dataArray
					log.Printf("✅ Found users in 'data' field: %d users", len(users))
				}
			} else if content, exists := searchMap["content"]; exists {
				if contentArray, ok := content.([]interface{}); ok {
					users = contentArray
					log.Printf("✅ Found users in 'content' field: %d users", len(users))
				}
			} else {
				// Try to find users in any array field
				for key, value := range searchMap {
					if valueArray, ok := value.([]interface{}); ok && len(valueArray) > 0 {
						users = valueArray
						log.Printf("✅ Found users in '%s' field: %d users", key, len(users))
						break
					}
				}
			}
		} else if searchArray, ok := searchResults.([]interface{}); ok {
			// Response is directly an array
			users = searchArray
			log.Printf("✅ Response is direct array: %d users", len(users))
		}

		// Return the users with proper structure
		log.Printf("✅ Returning %d users for search term '%s'", len(users), searchTerm)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"users":   users,
			"count":   len(users),
		})

	} else if resp.StatusCode == 401 {
		log.Printf("❌ SDO API unauthorized - token may be expired")

		// Clear the expired session data
		h.clearExpiredSession(c)

		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Authentication failed. Please re-authenticate.",
		})
	} else {
		log.Printf("❌ SDO API error: status=%d, response=%s", resp.StatusCode, string(body)[:min(200, len(body))])
		c.JSON(resp.StatusCode, gin.H{
			"success": false,
			"error":   fmt.Sprintf("Search failed with status %d", resp.StatusCode),
		})
	}
}

// Helper method to clear expired session data
func (h *AuthHandler) clearExpiredSession(c *gin.Context) {
	session := sessions.Default(c)
	session.Clear()
	session.Save()
	log.Println("🗑️ Cleared expired session data")
}

/*
// GenerateQRCodeJWT generates a QR code from a JWT for SDO authentication
func (h *AuthHandler) GenerateQRCodeJWT(c *gin.Context) {
	log.Println("Generate QR Code from JWT request")

	// Get auth data from JWT
	authData := h.getAuthDataFromJWT(c)
	if authData["sdo_token_ref"] == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Not authenticated"})
		return
	}

	// Create a payload for the QR code
	qrPayload := map[string]string{
		"sdo_url":       authData["sdo_url"],
		"sdo_token_ref": authData["sdo_token_ref"],
	}

	payloadBytes, err := json.Marshal(qrPayload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create QR payload"})
		return
	}

	// Generate QR code
	qrCode, err := qrcode.Encode(string(payloadBytes), qrcode.Medium, 256)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to generate QR code"})
		return
	}

	c.Data(http.StatusOK, "image/png", qrCode)
}
*/

/*
// GetInvitationQRCode retrieves the QR code for a given invitation ID
func (h *AuthHandler) GetInvitationQRCode(c *gin.Context) {
	invitationID := c.Param("id")
	if invitationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invitation ID is required"})
		return
	}

	log.Printf("Received request for QR code for invitation ID: %s", invitationID)

	// Get SDO service from context
	sdoService := h.getSDOService(c)
	if sdoService == nil {
		return // Error already sent by getSDOService
	}

	// Get invitation details to find the enrollment URL
	invitationDetails, err := sdoService.GetInvitationDetails(invitationID)
	if err != nil {
		log.Printf("Error getting invitation details: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get invitation details"})
		return
	}

	// Check for a valid enrollment URL
	enrollmentURL := invitationDetails.EnrollmentURL
	if enrollmentURL == "" {
		enrollmentURL = invitationDetails.URL // Fallback
	}
	if enrollmentURL == "" {
		log.Printf("No enrollment URL found for invitation %s", invitationID)
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "No enrollment URL found for this invitation"})
		return
	}

	log.Printf("Generating QR code for enrollment URL: %s", enrollmentURL)

	// Generate QR code
	qrCodeImage, err := qrcode.Encode(enrollmentURL, qrcode.Medium, 256)
	if err != nil {
		log.Printf("Error generating QR code: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to generate QR code image"})
		return
	}

	// Return the QR code as a PNG image
	c.Data(http.StatusOK, "image/png", qrCodeImage)
}
*/

/*
// TestQRCode generates a sample QR code for testing purposes
func (h *AuthHandler) TestQRCode(c *gin.Context) {
	log.Println("Received request for a test QR code")

	// Hardcoded sample data for testing
	sampleData := "https://www.doubleoctopus.com/sdo-test-enrollment/12345"

	// Generate QR code
	qrCodeImage, err := qrcode.Encode(sampleData, qrcode.Medium, 256)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to generate test QR code"})
		return
	}

	log.Println("Successfully generated a test QR code")

	// Return as a PNG image
	c.Data(http.StatusOK, "image/png", qrCodeImage)
}
*/

// ValidateInvitationID validates a given invitation ID
func (h *AuthHandler) ValidateInvitationID(c *gin.Context) {
	invitationId := c.Query("id")
	if invitationId == "" {
		invitationId = c.Param("id")
	}

	if invitationId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"valid": false,
			"error": "Invitation ID is required",
		})
		return
	}

	// Basic validation - SDO invitation IDs are typically long alphanumeric strings
	isValid := len(invitationId) > 20 && len(invitationId) < 200

	// Check if it contains only valid characters (alphanumeric)
	for _, char := range invitationId {
		if !((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9')) {
			isValid = false
			break
		}
	}

	session := sessions.Default(c)
	authData := h.getAuthDataFromSession(session)

	var enrollmentUrl string
	if authData != nil && authData["url"] != "" {
		portalBaseURL := getPortalBaseURL(authData["url"])
		enrollmentUrl = fmt.Sprintf("%s/enroll?invitation=%s", portalBaseURL, invitationId)
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":          isValid,
		"invitation_id":  invitationId,
		"length":         len(invitationId),
		"enrollment_url": enrollmentUrl,
		"format_check":   "SDO invitation ID format validation",
	})
}

/*
// GenerateUserEnrollmentQRCode generates a QR code for a given user's email
func (h *AuthHandler) GenerateUserEnrollmentQRCode(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Email is required"})
		return
	}

	log.Printf("Generating enrollment QR code for user: %s", req.Email)

	// Get SDO service from context
	sdoService := h.getSDOService(c)
	if sdoService == nil {
		return
	}

	// 1. Search for the user by email
	users, err := sdoService.SearchUser(req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to search for user"})
		return
	}
	if len(users) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "User not found"})
		return
	}
	user := users[0]

	// 2. Send an invitation to the user
	invitation, err := sdoService.SendInvitation(user.ID.String(), "OCTOPUS")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to send invitation"})
		return
	}

	// 3. Get the invitation details to find the enrollment URL
	invitationDetails, err := sdoService.GetInvitationDetails(invitation.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get invitation details"})
		return
	}

	enrollmentURL := invitationDetails.EnrollmentURL
	if enrollmentURL == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Could not retrieve enrollment URL"})
		return
	}

	// 4. Generate and return the QR code
	qrCodeImage, err := qrcode.Encode(enrollmentURL, qrcode.Medium, 256)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to generate QR code"})
		return
	}

	c.Data(http.StatusOK, "image/png", qrCodeImage)
}
*/

// TestSDOConnection handles testing the SDO connection from the config page
func (h *AuthHandler) TestSDOConnection(c *gin.Context) {
	log.Println("=== SDO Connection Test ===")

	var req struct {
		URL string `json:"url" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("Connection test: Invalid request format: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request format: " + err.Error(),
		})
		return
	}

	log.Printf("Testing connection to: %s", req.URL)

	// Simple HTTP GET to test if server is reachable
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Try to reach the admin interface
	testURL := req.URL
	if !strings.HasSuffix(testURL, "/admin") {
		testURL = strings.TrimSuffix(testURL, "/") + "/admin"
	}

	resp, err := client.Get(testURL)
	if err != nil {
		log.Printf("Connection test failed: %v", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success":    false,
			"error":      "Cannot connect to SDO server: " + err.Error(),
			"tested_url": testURL,
		})
		return
	}
	defer resp.Body.Close()

	log.Printf("Connection test successful: HTTP %d", resp.StatusCode)

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"message":     "Successfully connected to SDO server",
		"status_code": resp.StatusCode,
		"tested_url":  testURL,
	})
}

// FIXED: CheckSDOPortal checks if SDO portal is accessible
func (h *AuthHandler) CheckSDOPortal(c *gin.Context) {
	session := sessions.Default(c)
	authData := h.getAuthDataFromSession(session)

	if authData == nil || authData["url"] == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Not authenticated with SDO",
		})
		return
	}

	adminURL := authData["url"]
	portalBaseURL := getPortalBaseURL(adminURL)

	// FIXED: Check portal accessibility using the correct base URL
	resp, err := http.Get(portalBaseURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"accessible": false,
			"portal_url": portalBaseURL,
			"admin_url":  adminURL,
			"error":      err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	c.JSON(http.StatusOK, gin.H{
		"accessible":  resp.StatusCode == 200,
		"status_code": resp.StatusCode,
		"portal_url":  portalBaseURL,
		"admin_url":   adminURL,
	})
}

// GetInvitationDetails retrieves invitation details by ID
func (h *AuthHandler) GetInvitationDetails(c *gin.Context) {
	invitationID := c.Param("id")
	if invitationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invitation ID is required",
		})
		return
	}

	sdoService := h.getSDOService(c)
	if sdoService == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "not authenticated with SDO",
		})
		return
	}

	details, err := sdoService.GetInvitationDetails(invitationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, details)
}

// SearchSDOUsers handles user search requests (alternative endpoint)
func (h *AuthHandler) SearchSDOUsers(c *gin.Context) {
	// This calls the same logic as SearchUsers
	h.SearchUsers(c)
}

// Enhanced getSDOService helper method with support for all storage methods
func (h *AuthHandler) getSDOService(c *gin.Context) *services.SDOService {
	session := sessions.Default(c)

	// Check if user is authenticated
	if auth := session.Get("sdo_authenticated"); auth == nil || !auth.(bool) {
		log.Println("SDO service: Not authenticated")
		return nil
	}

	// Get authentication data using enhanced retrieval
	authData := h.getAuthDataFromSession(session)
	if authData == nil || authData["token"] == "" || authData["url"] == "" {
		log.Println("SDO service: Missing authentication data")
		return nil
	}

	// Create and configure SDO service
	service := services.NewSDOService()
	service.Token = authData["token"]
	service.BaseURL = authData["url"]

	log.Printf("SDO service: Retrieved from session - URL: %s, Token length: %d",
		service.BaseURL, len(service.Token))

	return service
}

// Helper functions for extracting user fields
func getStringField(data map[string]interface{}, fields ...string) string {
	for _, field := range fields {
		if val, exists := data[field]; exists {
			if str, ok := val.(string); ok && str != "" {
				return str
			}
		}
	}
	return ""
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// SendInvitation sends an invitation to a user (OCTOPUS, FIDO, or both)
func (h *AuthHandler) SendInvitation(c *gin.Context) {
	session := sessions.Default(c)
	authData := h.getAuthDataFromSession(session)

	if authData == nil || authData["token"] == "" || authData["url"] == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Not authenticated with SDO"})
		return
	}

	sdoService := services.NewSDOServiceWithAuth(authData["url"], authData["token"])

	var req struct {
		Email  string      `json:"email" binding:"required"`
		UserID json.Number `json:"userId" binding:"required"`
		Type   string      `json:"type"` // Optional: "OCTOPUS", "FIDO", or empty for both
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	userIDStr := req.UserID.String()
	log.Printf("✉️ Send Invitation request received for email: %s, User ID: %s, Type: %s", req.Email, userIDStr, req.Type)

	var octopusInvitation, fidoInvitation *services.SDOInvitationDetails
	var err error
	var results = gin.H{"success": true}

	if req.Type == "OCTOPUS" || req.Type == "" {
		octopusInvitation, err = sdoService.SendInvitation(userIDStr, "OCTOPUS")
		if err != nil {
			log.Printf("❌ Error sending OCTOPUS invitation: %v", err)
			results["octopus_error"] = err.Error()
		} else {
			results["octopus_invitationId"] = octopusInvitation.InvitationID
			results["octopus_status"] = octopusInvitation.Status
			results["octopus_message"] = octopusInvitation.Message
		}
	}

	if req.Type == "FIDO" || req.Type == "" {
		fidoInvitation, err = sdoService.SendInvitation(userIDStr, "FIDO")
		if err != nil {
			log.Printf("❌ Error sending FIDO invitation: %v", err)
			results["fido_error"] = err.Error()
		} else {
			results["fido_invitationId"] = fidoInvitation.InvitationID
			results["fido_status"] = fidoInvitation.Status
			results["fido_message"] = fidoInvitation.Message
		}
	}

	// Publish after sending invitations
	if err := sdoService.Publish(); err != nil {
		log.Printf("❌ Error publishing after invitation: %v", err)
		results["publish_error"] = err.Error()
	}
	time.Sleep(3 * time.Second)

	c.JSON(http.StatusOK, results)
}

// GenerateQRCode generates a QR code for enrollment
func (h *AuthHandler) GenerateQRCode(c *gin.Context) {
	session := sessions.Default(c)
	authData := h.getAuthDataFromSession(session)

	if authData == nil || authData["token"] == "" || authData["url"] == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Not authenticated with SDO"})
		return
	}

	var req struct {
		InvitationID string `json:"invitationId"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	var enrollmentURL string
	var invitationID string

	if req.InvitationID != "" {
		// Generate QR code for specific invitation
		log.Printf("🖼️ Generate QR Code request received for invitation ID: %s", req.InvitationID)

		// Construct enrollment URL directly from the invitation ID
		// The user specified this format.
		enrollmentURL = "https://doubleoctopus.com/enroll?code=" + req.InvitationID
		invitationID = req.InvitationID
		log.Printf("✅ QR Code: Generating QR code with enrollment URL: %s", enrollmentURL)
	} else {
		// Generate general QR code for portal enrollment
		log.Printf("🖼️ Generate general QR Code request (no invitation ID)")

		// Get portal base URL from admin URL
		portalBaseURL := getPortalBaseURL(authData["url"])
		enrollmentURL = portalBaseURL + "/enroll"
		invitationID = "general"
		log.Printf("✅ QR Code: Generating general QR code with portal URL: %s", enrollmentURL)
	}

	var png []byte
	png, err := qrcode.Encode(enrollmentURL, qrcode.Medium, 256)
	if err != nil {
		log.Printf("❌ QR Code Generation Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate QR code",
		})
		return
	}

	// Return the QR code as a base64 encoded string
	qrCodeBase64 := base64.StdEncoding.EncodeToString(png)
	dataURL := "data:image/png;base64," + qrCodeBase64

	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"qrCode":         dataURL,
		"qr_data":        enrollmentURL,
		"invitation_id":  invitationID,
		"enrollment_url": enrollmentURL,
	})
}

// VerifyUserState handles POST /api/sdo/verify-user
func (h *AuthHandler) VerifyUserState(c *gin.Context) {
	type verifyReq struct {
		UserID interface{} `json:"userId"`
	}
	var req verifyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"success": false, "error": "Invalid request format"})
		return
	}

	// Retrieve SDO credentials from session
	sdoToken, sdoURL, _, ok := GetSDOCredsFromSession(c)
	if !ok {
		c.JSON(401, gin.H{"success": false, "error": "Not authenticated with SDO"})
		return
	}

	// Normalize userId to string
	var userID string
	switch v := req.UserID.(type) {
	case string:
		userID = v
	case float64:
		userID = fmt.Sprintf("%.0f", v)
	case int:
		userID = fmt.Sprintf("%d", v)
	default:
		c.JSON(400, gin.H{"success": false, "error": "Invalid userId type"})
		return
	}

	// Build SDO verify user URL
	baseURL := strings.TrimSuffix(sdoURL, "/")
	verifyURL := fmt.Sprintf("%s/api/users/%s/state/verify", baseURL, userID)

	// Prepare request
	reqBody := map[string]interface{}{}
	reqBytes, _ := json.Marshal(reqBody)
	httpReq, err := http.NewRequest("POST", verifyURL, bytes.NewReader(reqBytes))
	if err != nil {
		c.JSON(500, gin.H{"success": false, "error": "Failed to create request"})
		return
	}
	httpReq.Header.Set("Authorization", "Bearer "+sdoToken)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(502, gin.H{"success": false, "error": "Failed to contact SDO API"})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		c.JSON(200, gin.H{"success": true, "result": string(body)})
	} else {
		c.JSON(502, gin.H{"success": false, "error": string(body)})
	}
}

// GetSDOCredsFromSession retrieves SDO credentials from the session
func GetSDOCredsFromSession(c *gin.Context) (token, url, email string, ok bool) {
	session := sessions.Default(c)
	tok, tokOk := session.Get("sdo_token").(string)
	sdoURL, urlOk := session.Get("sdo_url").(string)
	sdoEmail, _ := session.Get("sdo_email").(string)
	if tokOk && urlOk {
		return tok, sdoURL, sdoEmail, true
	}
	return "", "", "", false
}
