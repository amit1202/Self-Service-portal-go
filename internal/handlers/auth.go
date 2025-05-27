// File: internal/handlers/auth.go
package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"self-service-portal/internal/services"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// AuthHandler handles all SDO authentication and user management
type AuthHandler struct {
	// Add any dependencies you need here, like database connections
}

// NewAuthHandler creates a new AuthHandler instance
func NewAuthHandler() *AuthHandler {
	return &AuthHandler{}
}

// SDOAuth handles SDO authentication requests (matching Flask implementation)
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

	log.Printf("SDO Auth: Attempting authentication to URL: %s, Email: %s", req.URL, req.Email)

	// Create SDO service and authenticate
	sdoService := services.NewSDOService()

	log.Printf("SDO Auth: Calling SDO service authenticate...")
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

	// Store authentication in session (matching Flask exactly)
	session := sessions.Default(c)
	session.Set("sdo_token", authResp.Token)
	session.Set("sdo_url", sdoService.BaseURL)
	session.Set("sdo_authenticated", true)
	session.Set("sdo_email", req.Email) // Store email like Flask

	if err := session.Save(); err != nil {
		log.Printf("❌ SDO Auth: Failed to save session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to save session",
		})
		return
	} else {
		log.Println("✅ SDO Auth: Session saved successfully")

		// Verify session was saved
		log.Printf("Session verification:")
		log.Printf("  sdo_authenticated: %v", session.Get("sdo_authenticated"))
		log.Printf("  sdo_token length: %d", len(session.Get("sdo_token").(string)))
		log.Printf("  sdo_url: %v", session.Get("sdo_url"))
	}

	log.Println("=== SDO Authentication Request Completed Successfully ===")

	// Return response matching Flask format
	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"message":      "Successfully authenticated with Secret Double Octopus",
		"status":       "authenticated",
		"base_url":     sdoService.BaseURL,
		"token_length": len(authResp.Token),
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

// LogoutSDO handles SDO logout (matching Flask)
func (h *AuthHandler) LogoutSDO(c *gin.Context) {
	session := sessions.Default(c)

	// Clear SDO-related session data (matching Flask exactly)
	session.Delete("sdo_token")
	session.Delete("sdo_url")
	session.Delete("sdo_authenticated")
	session.Delete("sdo_email")
	session.Save()

	log.Println("SDO logout: Cleared session data")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Disconnected from Secret Double Octopus",
		"status":  "unauthenticated",
	})
}

// GetSDOStatus returns current SDO authentication status (matching Flask)
func (h *AuthHandler) GetSDOStatus(c *gin.Context) {
	log.Println("=== SDO Status Check ===")

	session := sessions.Default(c)
	isAuthenticated := session.Get("sdo_authenticated")
	token := session.Get("sdo_token")
	baseURL := session.Get("sdo_url") // Use sdo_url like Flask
	email := session.Get("sdo_email")

	status := gin.H{
		"authenticated": isAuthenticated != nil && isAuthenticated.(bool),
		"status":        "unauthenticated",
	}

	if isAuthenticated != nil && isAuthenticated.(bool) {
		status["status"] = "authenticated"
		if baseURL != nil {
			status["base_url"] = baseURL.(string)
		}
		if email != nil {
			status["email"] = email.(string)
		}
		if token != nil {
			status["token_length"] = len(token.(string))
		}
		log.Printf("SDO Status: Authenticated, Base URL: %v, Email: %v", baseURL, email)
	} else {
		log.Println("SDO Status: Not authenticated")
	}

	c.JSON(http.StatusOK, status)
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

// SearchUsers searches for users in SDO directory (matching Python implementation exactly)
func (h *AuthHandler) SearchUsers(c *gin.Context) {
	log.Println("=== User Search API Called ===")

	// Get the search query (matching Python: request.args.get('q', ''))
	searchTerm := c.Query("q")
	if searchTerm == "" || len(searchTerm) < 2 {
		log.Printf("Search validation failed: term='%s', length=%d", searchTerm, len(searchTerm))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Search term must be at least 2 characters",
		})
		return
	}

	// Log the search request (matching Python)
	log.Printf("User search: term='%s'", searchTerm)

	// Get session
	session := sessions.Default(c)

	// Add debugging
	log.Printf("=== SEARCH DEBUG ===")
	log.Printf("sdo_authenticated: %v", session.Get("sdo_authenticated"))
	log.Printf("sdo_token exists: %v", session.Get("sdo_token") != nil)
	log.Printf("sdo_url: %v", session.Get("sdo_url"))
	log.Printf("==================")

	// Check for SDO authentication (matching Python exactly)
	sdoToken := session.Get("sdo_token")
	sdoURL := session.Get("sdo_url")

	if sdoToken == nil || sdoURL == nil {
		log.Printf("❌ User search: No SDO authentication found in session")
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Not authenticated with Secret Double Octopus. Please authenticate first.",
		})
		return
	}

	// Convert session values to strings
	token := sdoToken.(string)
	baseURL := sdoURL.(string)

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
			"error": "Failed to create search request",
		})
		return
	}

	// Set up headers (matching Python exactly)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	// Make the request with timeout (matching Python timeout=15)
	client := &http.Client{
		Timeout: 15 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ SDO API request error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Search request failed: " + err.Error(),
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
			"error": "Failed to read search response",
		})
		return
	}

	// Log response for debugging (first 500 chars)
	responsePreview := string(body)
	if len(responsePreview) > 500 {
		responsePreview = responsePreview[:500] + "..."
	}
	log.Printf("SDO API response body: %s", responsePreview)

	// Check response status (matching Python logic)
	if resp.StatusCode == 200 {
		// Parse response (matching Python logic)
		var searchResults interface{}
		if err := json.Unmarshal(body, &searchResults); err != nil {
			log.Printf("❌ Failed to parse JSON response: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to parse search response",
			})
			return
		}

		// Extract users from the response (matching Python extraction logic)
		var users []interface{}

		// Check if response is a dict with 'content' field
		if searchMap, ok := searchResults.(map[string]interface{}); ok {
			if content, exists := searchMap["content"]; exists {
				if contentArray, ok := content.([]interface{}); ok {
					users = contentArray
					log.Printf("✅ Found users in 'content' field: %d users", len(users))
				}
			} else {
				// Try to find users in any array field (matching Python fallback)
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

		// Return the users (matching Python: return jsonify(users))
		log.Printf("✅ Returning %d users for search term '%s'", len(users), searchTerm)
		c.JSON(http.StatusOK, users)

	} else if resp.StatusCode == 401 {
		log.Printf("❌ SDO API unauthorized - token may be expired")

		// Clear the expired session data
		session.Delete("sdo_token")
		session.Delete("sdo_url")
		session.Delete("sdo_authenticated")
		session.Save()

		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authentication failed. Please re-authenticate.",
		})
	} else {
		log.Printf("❌ SDO API error: status=%d, response=%s", resp.StatusCode, string(body)[:200])
		c.JSON(resp.StatusCode, gin.H{
			"error": fmt.Sprintf("Search failed with status %d", resp.StatusCode),
		})
	}
}

// SendInvitation sends an invitation to a user (matching Flask exactly)
func (h *AuthHandler) SendInvitation(c *gin.Context) {
	var req struct {
		UserID          string   `json:"userId" binding:"required"`
		InvitationTypes []string `json:"invitationTypes" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	sdoService := h.getSDOService(c)
	if sdoService == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Not authenticated with Secret Double Octopus. Please authenticate first.",
		})
		return
	}

	log.Printf("Sending invitation to user %s with types: %v", req.UserID, req.InvitationTypes)

	invitationResp, err := sdoService.SendInvitation(req.UserID, req.InvitationTypes)
	if err != nil {
		log.Printf("Invitation error: %v", err)
		if strings.Contains(err.Error(), "authentication expired") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication expired. Please re-authenticate.",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
		}
		return
	}

	// Return response matching Flask format exactly
	response := gin.H{
		"success": invitationResp.Success,
		"message": "Invitation sent successfully",
	}

	// Include invitation details if available
	if invitationResp.InvitationDetails != nil {
		response["invitationDetails"] = invitationResp.InvitationDetails
	}

	// Include raw response for JavaScript parsing
	if invitationResp.RawResponse != nil {
		response["rawResponse"] = invitationResp.RawResponse
	}

	// Include ID for QR code generation
	if invitationResp.ID != "" {
		response["id"] = invitationResp.ID
		response["invitationId"] = invitationResp.ID
	}

	log.Printf("Returning invitation response: success=%t, id=%s", invitationResp.Success, invitationResp.ID)

	if invitationResp.Success {
		c.JSON(http.StatusOK, response)
	} else {
		response["error"] = invitationResp.Error
		c.JSON(http.StatusInternalServerError, response)
	}
}

// GetInvitationDetails retrieves invitation details by ID (for QR code functionality)
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

// SearchSDOUsers handles user search requests (alternative endpoint for JS compatibility)
func (h *AuthHandler) SearchSDOUsers(c *gin.Context) {
	// This can call the same logic as SearchUsers
	h.SearchUsers(c)
}

// demoSearchUsers provides demo search results for testing
func (h *AuthHandler) demoSearchUsers(c *gin.Context, searchTerm string) {
	log.Printf("Using demo search for term: '%s'", searchTerm)

	// Create demo users that match the search term
	demoUsers := []map[string]interface{}{}

	allDemoUsers := []map[string]interface{}{
		{
			"id":             "demo-user-1",
			"displayName":    "John Doe",
			"username":       "john.doe",
			"email":          "john.doe@example.com",
			"firstName":      "John",
			"lastName":       "Doe",
			"directoryName":  "Demo Directory",
			"organizationId": "demo-org-1",
		},
		{
			"id":             "demo-user-2",
			"displayName":    "Jane Smith",
			"username":       "jane.smith",
			"email":          "jane.smith@example.com",
			"firstName":      "Jane",
			"lastName":       "Smith",
			"directoryName":  "Demo Directory",
			"organizationId": "demo-org-1",
		},
		{
			"id":             "demo-user-3",
			"displayName":    "Mike Johnson",
			"username":       "mike.johnson",
			"email":          "mike.johnson@example.com",
			"firstName":      "Mike",
			"lastName":       "Johnson",
			"directoryName":  "Demo Directory",
			"organizationId": "demo-org-1",
		},
		{
			"id":             "demo-user-4",
			"displayName":    "Sarah Wilson",
			"username":       "sarah.wilson",
			"email":          "sarah.wilson@example.com",
			"firstName":      "Sarah",
			"lastName":       "Wilson",
			"directoryName":  "Demo Directory",
			"organizationId": "demo-org-1",
		},
	}

	// Filter demo users based on search term
	searchLower := strings.ToLower(searchTerm)
	for _, user := range allDemoUsers {
		if strings.Contains(strings.ToLower(user["displayName"].(string)), searchLower) ||
			strings.Contains(strings.ToLower(user["username"].(string)), searchLower) ||
			strings.Contains(strings.ToLower(user["email"].(string)), searchLower) ||
			strings.Contains(strings.ToLower(user["firstName"].(string)), searchLower) ||
			strings.Contains(strings.ToLower(user["lastName"].(string)), searchLower) {
			demoUsers = append(demoUsers, user)
		}
	}

	log.Printf("Demo search returning %d users for term '%s'", len(demoUsers), searchTerm)
	c.JSON(http.StatusOK, demoUsers)
}

// Helper method to get SDO service from session (matching Flask session keys)
func (h *AuthHandler) getSDOService(c *gin.Context) *services.SDOService {
	session := sessions.Default(c)

	// Check if user is authenticated (matching Flask session keys)
	if auth := session.Get("sdo_authenticated"); auth == nil || !auth.(bool) {
		log.Println("SDO service: Not authenticated")
		return nil
	}

	// Get token and base URL from session (matching Flask keys)
	token := session.Get("sdo_token")
	baseURL := session.Get("sdo_url") // Flask uses sdo_url, not sdo_base_url

	if token == nil || baseURL == nil {
		log.Println("SDO service: Missing token or base URL in session")
		return nil
	}

	// Create and configure SDO service
	service := services.NewSDOService()
	service.Token = token.(string)
	service.BaseURL = baseURL.(string)

	log.Printf("SDO service: Retrieved from session - URL: %s, Token length: %d",
		service.BaseURL, len(service.Token))

	return service
}
