// File: internal/handlers/verification.go - Identity verification workflow handlers
package handlers

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type VerificationHandler struct {
	configHandler *ConfigHandler
	sessions      map[string]*VerificationSession // In-memory session storage
}

type VerificationSession struct {
	ID             string                   `json:"id"`
	UserData       VerificationStartRequest `json:"user_data"`
	Status         string                   `json:"status"`           // pending, in_progress, completed, failed
	Result         string                   `json:"result,omitempty"` // verified, failed
	Au10tixSession *Au10tixSessionResponse  `json:"au10tix_session,omitempty"`
	CreatedAt      time.Time                `json:"created_at"`
	UpdatedAt      time.Time                `json:"updated_at"`
	Score          float64                  `json:"score,omitempty"`
	Data           map[string]interface{}   `json:"data,omitempty"`
}

func NewVerificationHandler(configHandler *ConfigHandler) *VerificationHandler {
	return &VerificationHandler{
		configHandler: configHandler,
		sessions:      make(map[string]*VerificationSession),
	}
}

// Update the StartVerification method in verification.go
func (h *VerificationHandler) StartVerification(c *gin.Context) {
	var request VerificationStartRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		log.Printf("❌ Invalid verification start request: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request format",
		})
		return
	}

	log.Printf("🚀 Starting verification for: %s %s (%s)", request.FirstName, request.LastName, request.Email)

	// Get Au10tix token with fallback
	au10tixToken, tokenSource, err := h.configHandler.GetAu10tixTokenWithFallback()
	if err != nil {
		log.Printf("❌ Failed to get Au10tix token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Au10tix token error",
		})
		return
	}

	log.Printf("🔑 Using Au10tix token from: %s", tokenSource)

	// Create a demo session for testing if using fallback
	sessionID := uuid.New().String()
	session := &VerificationSession{
		ID:        sessionID,
		UserData:  request,
		Status:    "pending",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if tokenSource == "static_fallback" {
		log.Printf("⚠️ Using static fallback token - demo mode")
		h.sessions[sessionID] = session
		c.JSON(http.StatusOK, gin.H{
			"success":        true,
			"verificationId": sessionID,
			"sessionUrl":     "", // Empty for demo mode
			"message":        "Demo mode - using static fallback token",
		})
		return
	}

	// Load full configuration for other settings
	config, err := h.configHandler.LoadConfig()
	if err != nil {
		log.Printf("❌ Failed to load config: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration error",
		})
		return
	}

	// Use the token we got from fallback method
	config.Auth.Au10tixToken = au10tixToken

	// Decode JWT token to get organization info
	jwtPayload, err := h.configHandler.DecodeAu10tixToken(au10tixToken)
	if err != nil {
		log.Printf("❌ Failed to decode Au10tix token: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid Au10tix token configuration",
		})
		return
	}

	// Check token expiration
	if time.Now().Unix() > jwtPayload.EXP {
		log.Printf("⏰ Au10tix token has expired")
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Au10tix token has expired",
		})
		return
	}

	// Create Au10tix session
	sessionURL, au10tixSession, err := h.createAu10tixSession(config, jwtPayload, request)
	if err != nil {
		log.Printf("❌ Failed to create Au10tix session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   fmt.Sprintf("Failed to create verification session: %v", err),
		})
		return
	}

	// Update session with Au10tix info
	session.Au10tixSession = au10tixSession
	h.sessions[sessionID] = session

	log.Printf("✅ Verification session created: %s (token source: %s)", sessionID, tokenSource)
	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"verificationId": sessionID,
		"sessionUrl":     sessionURL,
		"tokenSource":    tokenSource,
	})
}

// Update the CheckVerificationResult method in verification.go
func (h *VerificationHandler) CheckVerificationResult(c *gin.Context) {
	verificationID := c.Param("id")
	if verificationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Verification ID is required",
		})
		return
	}

	log.Printf("🔍 Checking Au10tix verification result for ID: %s", verificationID)

	// Get Au10tix token with fallback
	au10tixToken, tokenSource, err := h.configHandler.GetAu10tixTokenWithFallback()
	if err != nil {
		log.Printf("❌ Failed to get Au10tix token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Au10tix token error",
		})
		return
	}

	log.Printf("🔑 Using Au10tix token from: %s", tokenSource)

	// Decode JWT token to get API URL
	jwtPayload, err := h.configHandler.DecodeAu10tixToken(au10tixToken)
	if err != nil {
		log.Printf("❌ Failed to decode Au10tix token: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid Au10tix token",
		})
		return
	}

	// Load configuration for other settings
	config, err := h.configHandler.LoadConfig()
	if err != nil {
		log.Printf("❌ Failed to load config: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration error",
		})
		return
	}

	baseURL := jwtPayload.APIUrl
	if baseURL == "" {
		baseURL = config.API.Au10tixBaseURL
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	// Create HTTP client
	client := &http.Client{
		Timeout: time.Duration(config.API.APITimeout) * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	// Use the correct Au10tix result endpoint
	resultURL := fmt.Sprintf("%s/result/v2/results/person/%s", baseURL, verificationID)
	log.Printf("🔗 Checking Au10tix result: %s", resultURL)

	req, err := http.NewRequest("GET", resultURL, nil)
	if err != nil {
		log.Printf("❌ Failed to create result request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create request",
		})
		return
	}

	// Add query parameter for detailed results
	q := req.URL.Query()
	q.Add("includeDetailed", "true")
	req.URL.RawQuery = q.Encode()

	req.Header.Set("Authorization", "Bearer "+au10tixToken)
	req.Header.Set("User-Agent", "SelfServicePortal/1.0")
	req.Header.Set("Accept", "application/json")

	// Rest of the method remains the same...
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Result request failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Request failed",
		})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("❌ Failed to read result response: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to read response",
		})
		return
	}

	log.Printf("📡 Au10tix Result Response Status: %d, Body: %s", resp.StatusCode, string(body))

	if resp.StatusCode != 200 {
		c.JSON(resp.StatusCode, gin.H{
			"success": false,
			"error":   fmt.Sprintf("Au10tix result API error (status: %d): %s", resp.StatusCode, string(body)),
		})
		return
	}

	// Parse and return the result
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		log.Printf("❌ Failed to parse result response: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to parse result",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"result":      result,
		"tokenSource": tokenSource,
	})
}

/// Quick fixes to try in your verification.go createAu10tixSession method

// FIX 1: Try a simpler request format first
// Update your createAu10tixSession method in verification.go

func (h *VerificationHandler) createAu10tixSession(config *PortalConfig, jwtPayload *Au10tixJWTPayload, userData VerificationStartRequest) (string, *Au10tixSessionResponse, error) {
	baseURL := jwtPayload.APIUrl
	if baseURL == "" {
		baseURL = config.API.Au10tixBaseURL
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	// Get the token with fallback
	token, tokenSource, err := h.configHandler.GetAu10tixTokenWithFallback()
	if err != nil {
		return "", nil, fmt.Errorf("failed to get token: %w", err)
	}

	log.Printf("🔑 Using Au10tix token from: %s", tokenSource)
	log.Printf("🏢 Organization: %s (ID: %d)", jwtPayload.ClientOrganizationName, jwtPayload.ClientOrganizationID)

	// Check token expiration
	if time.Now().Unix() > jwtPayload.EXP {
		return "", nil, fmt.Errorf("JWT token expired at %s", time.Unix(jwtPayload.EXP, 0).Format("2006-01-02 15:04:05"))
	}

	// Create Au10tix workflow request (use the working format)
	workflowRequest := map[string]interface{}{
		"workflowOptions": map[string]interface{}{},
		"serviceOptions": map[string]interface{}{
			"secureme": map[string]interface{}{
				"shortUrl": true,
				"requestTypes": map[string]interface{}{
					"idFront":     []string{"file", "camera"},
					"idBack":      []string{"file", "camera"},
					"faceCompare": []string{"camera"},
				},
			},
		},
	}

	// Add user data if present
	userDataMap := map[string]interface{}{}
	if userData.FirstName != "" {
		userDataMap["firstName"] = userData.FirstName
	}
	if userData.LastName != "" {
		userDataMap["lastName"] = userData.LastName
	}
	if userData.Email != "" {
		userDataMap["email"] = userData.Email
	}
	if userData.PhoneNumber != "" {
		userDataMap["phoneNumber"] = userData.PhoneNumber
	}
	if userData.DateOfBirth != "" {
		userDataMap["dateOfBirth"] = userData.DateOfBirth
	}
	if len(userDataMap) > 0 {
		workflowRequest["userData"] = userDataMap
	}

	jsonData, err := json.Marshal(workflowRequest)
	if err != nil {
		return "", nil, fmt.Errorf("failed to marshal workflow request: %w", err)
	}

	// Create HTTP client
	client := &http.Client{
		Timeout: time.Duration(config.API.APITimeout) * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	// Use the working endpoint
	workflowURL := baseURL + "/workflow/v1/workflows/person/Au10tix201"
	log.Printf("🔗 Creating Au10tix workflow: %s", workflowURL)

	req, err := http.NewRequest("POST", workflowURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "SelfServicePortal/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return "", nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, fmt.Errorf("failed to read response: %w", err)
	}

	log.Printf("📡 Au10tix Response Status: %d, Body: %s", resp.StatusCode, string(body))

	// Check for success
	if resp.StatusCode != 201 && resp.StatusCode != 200 {
		return "", nil, fmt.Errorf("Au10tix API error (status: %d): %s", resp.StatusCode, string(body))
	}

	// Parse the successful response
	var workflowResp map[string]interface{}
	if err := json.Unmarshal(body, &workflowResp); err != nil {
		return "", nil, fmt.Errorf("failed to parse workflow response: %w", err)
	}

	// Extract session ID and verification URL
	var sessionID, verificationURL string

	// Get session ID
	if id, ok := workflowResp["sessionId"].(string); ok {
		sessionID = id
	}

	// Get verification URL from response.securemeLink
	if response, ok := workflowResp["response"].(map[string]interface{}); ok {
		if link, ok := response["securemeLink"].(string); ok {
			verificationURL = link
		}
	}

	if verificationURL == "" {
		return "", nil, fmt.Errorf("no verification URL found in Au10tix response")
	}

	// Create session response
	sessionResp := &Au10tixSessionResponse{
		SessionID:  sessionID,
		SessionURL: verificationURL,
		Status:     "created",
	}

	log.Printf("✅ Au10tix session created successfully:")
	log.Printf("   Session ID: %s", sessionID)
	log.Printf("   Verification URL: %s", verificationURL)

	return verificationURL, sessionResp, nil
}

// Helper method to try creating a session
func (h *VerificationHandler) tryCreateSession(client *http.Client, url, token string, requestBody map[string]interface{}) (string, *Au10tixSessionResponse, error) {
	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", nil, err
	}

	// FIX 3: Make sure headers are exactly right
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "SelfServicePortal/1.0")

	log.Printf("📤 Request to: %s", url)
	log.Printf("📤 Body: %s", string(jsonData))

	resp, err := client.Do(req)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, err
	}

	log.Printf("📡 Response %d: %s", resp.StatusCode, string(body))

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		return "", nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	// Parse successful response
	var workflowResp map[string]interface{}
	if err := json.Unmarshal(body, &workflowResp); err != nil {
		return "", nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Extract URL and ID
	var sessionURL, sessionID string

	// Look for session URL
	urlFields := []string{"securemeLink", "workflowUrl", "url", "link", "sessionUrl", "verificationUrl"}
	for _, field := range urlFields {
		if url, ok := workflowResp[field].(string); ok && url != "" {
			sessionURL = url
			break
		}
	}

	// Look for session ID
	idFields := []string{"id", "workflowId", "sessionId"}
	for _, field := range idFields {
		if id, ok := workflowResp[field].(string); ok && id != "" {
			sessionID = id
			break
		}
	}

	if sessionURL == "" {
		return "", nil, fmt.Errorf("no session URL found in response")
	}

	sessionResp := &Au10tixSessionResponse{
		SessionID:  sessionID,
		SessionURL: sessionURL,
		Status:     "created",
	}

	return sessionURL, sessionResp, nil
}

// Au10tixProxy provides a proxy to Au10tix API (matching Python Flask functionality)
func (h *VerificationHandler) Au10tixProxy(c *gin.Context) {
	// Get the endpoint path
	endpoint := c.Param("path")
	if endpoint == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "API endpoint is required",
		})
		return
	}

	// Get the auth token from the request headers
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Missing or invalid Authorization header",
		})
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")

	// Build the full API URL
	baseURL := "https://eus-api.au10tixservicesstaging.com" // Default staging environment
	apiURL := fmt.Sprintf("%s/%s", baseURL, endpoint)

	log.Printf("🔄 Au10tix API Proxy: %s %s", c.Request.Method, apiURL)

	// Create HTTP client
	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	// Prepare the request
	var reqBody io.Reader
	if c.Request.Method == "POST" || c.Request.Method == "PUT" {
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Failed to read request body",
			})
			return
		}
		reqBody = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequest(c.Request.Method, apiURL, reqBody)
	if err != nil {
		log.Printf("❌ Failed to create proxy request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create request",
		})
		return
	}

	// Set headers
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "SelfServicePortal/1.0")
	req.Header.Set("Accept", "application/json")

	// Add query parameters
	req.URL.RawQuery = c.Request.URL.RawQuery

	// Make the request
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Au10tix proxy request failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Proxy request failed",
		})
		return
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("❌ Failed to read proxy response: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to read response",
		})
		return
	}

	log.Printf("📡 Au10tix Proxy Response: %d", resp.StatusCode)

	// Set response headers
	c.Header("Content-Type", "application/json")

	// Try to return JSON response
	var jsonResponse interface{}
	if err := json.Unmarshal(body, &jsonResponse); err == nil {
		c.JSON(resp.StatusCode, jsonResponse)
	} else {
		// For non-JSON responses, return as text
		c.Data(resp.StatusCode, "text/plain", body)
	}
}

// Add these helper methods to your VerificationHandler in verification.go

// GetSession retrieves a verification session by ID
func (h *VerificationHandler) GetSession(sessionID string) (*VerificationSession, bool) {
	session, exists := h.sessions[sessionID]
	return session, exists
}

// UpdateSession updates a verification session
func (h *VerificationHandler) UpdateSession(sessionID string, session *VerificationSession) {
	h.sessions[sessionID] = session
}

// GetSessionByAu10tixID finds a session by Au10tix session ID
func (h *VerificationHandler) GetSessionByAu10tixID(au10tixSessionID string) (*VerificationSession, string, bool) {
	for id, session := range h.sessions {
		if session.Au10tixSession != nil && session.Au10tixSession.SessionID == au10tixSessionID {
			return session, id, true
		}
	}
	return nil, "", false
}

// Replace the GetVerificationStatus method in verification.go with this version:

func (h *VerificationHandler) GetVerificationStatus(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Session ID is required",
		})
		return
	}

	log.Printf("📊 Checking verification status for session: %s", sessionID)

	session, exists := h.GetSession(sessionID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Verification session not found",
		})
		return
	}

	// Try to update status from Au10tix if we have a session
	if session.Au10tixSession != nil {
		// Get Au10tix token with fallback
		au10tixToken, tokenSource, err := h.configHandler.GetAu10tixTokenWithFallback()
		if err == nil && au10tixToken != "" {
			log.Printf("🔑 Checking Au10tix status using token from: %s", tokenSource)

			// Load configuration for other settings
			config, err := h.configHandler.LoadConfig()
			if err == nil {
				// Try to check Au10tix session status (won't fail if endpoints don't work)
				if updatedSession, err := h.checkAu10tixSessionStatus(config, session); err == nil {
					session = updatedSession
					h.UpdateSession(sessionID, session)
					log.Printf("✅ Successfully updated session status from Au10tix")
				} else {
					log.Printf("⚠️ Au10tix status check failed (continuing anyway): %v", err)
				}
			} else {
				log.Printf("⚠️ Failed to load config for Au10tix check: %v", err)
			}
		} else {
			log.Printf("⚠️ No Au10tix token available for status check")
		}
	} else {
		log.Printf("📊 No Au10tix session to check - returning current status")
	}

	// Prepare response with enhanced information
	responseData := map[string]interface{}{
		"success":    true,
		"status":     session.Status,
		"result":     session.Result,
		"score":      session.Score,
		"data":       session.Data,
		"created_at": session.CreatedAt,
		"updated_at": session.UpdatedAt,
		"user_data":  session.UserData,
	}

	// Add Au10tix session info if available
	if session.Au10tixSession != nil {
		responseData["au10tix_session"] = map[string]interface{}{
			"session_id":  session.Au10tixSession.SessionID,
			"session_url": session.Au10tixSession.SessionURL,
			"status":      session.Au10tixSession.Status,
		}
	}

	// Enhanced logging: print full Au10tix verification data as pretty JSON
	if session.Data != nil {
		if pretty, err := json.MarshalIndent(session.Data, "", "  "); err == nil {
			log.Printf("\n========== Au10tix Verification Data for session %s =========\n%s\n============================================================", sessionID, string(pretty))
		}
	}

	// Add helpful status messages
	switch session.Status {
	case "pending":
		responseData["message"] = "Verification is pending - waiting for user to complete Au10tix workflow"
		if session.Au10tixSession != nil {
			responseData["next_step"] = "User should complete verification at the provided session URL"
		}
	case "in_progress":
		responseData["message"] = "Verification is in progress - Au10tix is processing the submission"
	case "completed":
		if session.Result == "verified" {
			responseData["message"] = "Verification completed successfully"
		} else {
			responseData["message"] = "Verification completed but failed validation"
		}
	case "failed":
		responseData["message"] = "Verification failed"
	default:
		responseData["message"] = "Unknown verification status"
	}

	log.Printf("📊 Returning status for session %s: %s (result: %s)", sessionID, session.Status, session.Result)

	c.JSON(http.StatusOK, responseData)
}

// PollForResults automatically checks Au10tix for results and updates session
func (h *VerificationHandler) PollForResults(sessionID string) error {
	session, exists := h.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session not found")
	}

	if session.Au10tixSession == nil {
		return fmt.Errorf("no Au10tix session")
	}

	// Skip if already completed
	if session.Status == "completed" {
		return nil
	}

	log.Printf("🔄 Polling Au10tix results for session: %s", sessionID)

	// Get Au10tix token
	au10tixToken, _, err := h.configHandler.GetAu10tixTokenWithFallback()
	if err != nil {
		return fmt.Errorf("failed to get token: %w", err)
	}

	// Decode token
	jwtPayload, err := h.configHandler.DecodeAu10tixToken(au10tixToken)
	if err != nil {
		return fmt.Errorf("failed to decode token: %w", err)
	}

	baseURL := jwtPayload.APIUrl
	if baseURL == "" {
		baseURL = "https://eus-api.au10tixservicesstaging.com"
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	// Try to get results
	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	// Try the most likely result endpoint
	resultURL := fmt.Sprintf("%s/result/v2/results/person/%s", baseURL, session.Au10tixSession.SessionID)

	req, err := http.NewRequest("GET", resultURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Add query parameters
	q := req.URL.Query()
	q.Add("includeDetailed", "true")
	req.URL.RawQuery = q.Encode()

	req.Header.Set("Authorization", "Bearer "+au10tixToken)
	req.Header.Set("User-Agent", "SelfServicePortal/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	log.Printf("📡 Au10tix Result Response: Status %d, Body: %s", resp.StatusCode, string(body))

	if resp.StatusCode != 200 {
		// If 404, verification might still be in progress
		if resp.StatusCode == 404 {
			log.Printf("⏳ Verification results not ready yet for session: %s", sessionID)
			return nil // Not an error, just not ready
		}
		return fmt.Errorf("Au10tix result API error (status: %d): %s", resp.StatusCode, string(body))
	}

	// Parse results
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("failed to parse result: %w", err)
	}

	// Update session with results
	session.Status = "completed"
	session.UpdatedAt = time.Now()
	session.Data = result

	// Extract specific result fields
	if status, ok := result["status"].(string); ok {
		switch strings.ToLower(status) {
		case "verified", "passed", "approved", "success":
			session.Result = "verified"
		case "failed", "rejected", "denied":
			session.Result = "failed"
		default:
			session.Result = status
		}
	}

	if score, ok := result["score"].(float64); ok {
		session.Score = score
	}

	// Save updated session
	h.sessions[sessionID] = session

	log.Printf("✅ Updated verification session %s with results: %s", sessionID, session.Result)
	return nil
}

// Add this to your VerificationHandler in verification.go

// StartResultPolling starts background polling for pending verifications
func (h *VerificationHandler) StartResultPolling() {
	go func() {
		ticker := time.NewTicker(30 * time.Second) // Poll every 30 seconds
		defer ticker.Stop()

		log.Printf("🔄 Started Au10tix result polling service")

		for range ticker.C {
			h.pollPendingVerifications()
		}
	}()
}

// pollPendingVerifications checks all pending verifications for results
func (h *VerificationHandler) pollPendingVerifications() {
	pendingCount := 0

	for sessionID, session := range h.sessions {
		// Only poll sessions that are pending and have Au10tix session
		if session.Status == "pending" && session.Au10tixSession != nil {
			// Don't poll sessions that are too old (older than 1 hour)
			if time.Since(session.CreatedAt) > time.Hour {
				continue
			}

			pendingCount++

			// Poll for results
			if err := h.PollForResults(sessionID); err != nil {
				log.Printf("⚠️ Failed to poll results for session %s: %v", sessionID, err)
			}
		}
	}

	if pendingCount > 0 {
		log.Printf("🔄 Polled %d pending verification sessions", pendingCount)
	}
}

// Add this method to manually trigger result checking
func (h *VerificationHandler) CheckAllPendingResults(c *gin.Context) {
	log.Printf("🔍 Manual check of all pending results")

	results := make([]map[string]interface{}, 0)

	for sessionID, session := range h.sessions {
		if session.Status == "pending" && session.Au10tixSession != nil {
			result := map[string]interface{}{
				"session_id": sessionID,
				"created_at": session.CreatedAt,
				"user_data":  session.UserData,
			}

			if err := h.PollForResults(sessionID); err != nil {
				result["error"] = err.Error()
				result["status"] = "error"
			} else {
				// Get updated session
				updatedSession := h.sessions[sessionID]
				result["status"] = updatedSession.Status
				result["result"] = updatedSession.Result
				result["score"] = updatedSession.Score
			}

			results = append(results, result)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Checked %d pending verifications", len(results)),
		"results": results,
	})
}

// GetAllSessions returns all verification sessions for debugging/admin purposes
func (h *VerificationHandler) GetAllSessions() map[string]*VerificationSession {
	// Return a copy to prevent external modification
	sessionsCopy := make(map[string]*VerificationSession)
	for id, session := range h.sessions {
		sessionsCopy[id] = session
	}
	return sessionsCopy
}

// Alternative: GetAllSessionsData returns formatted session data
func (h *VerificationHandler) GetAllSessionsData() []map[string]interface{} {
	sessions := make([]map[string]interface{}, 0, len(h.sessions))

	for id, session := range h.sessions {
		sessionData := map[string]interface{}{
			"id":         id,
			"status":     session.Status,
			"result":     session.Result,
			"score":      session.Score,
			"user_data":  session.UserData,
			"created_at": session.CreatedAt,
			"updated_at": session.UpdatedAt,
		}

		if session.Au10tixSession != nil {
			sessionData["au10tix_session_id"] = session.Au10tixSession.SessionID
			sessionData["au10tix_session_url"] = session.Au10tixSession.SessionURL
		}

		sessions = append(sessions, sessionData)
	}

	return sessions
}

// checkAu10tixSessionStatus checks the status of an Au10tix session
// Replace the checkAu10tixSessionStatus method in verification.go with this improved version:

func (h *VerificationHandler) checkAu10tixSessionStatus(config *PortalConfig, session *VerificationSession) (*VerificationSession, error) {
	if session.Au10tixSession == nil {
		return session, fmt.Errorf("no Au10tix session available")
	}

	// Get token with fallback
	au10tixToken, tokenSource, err := h.configHandler.GetAu10tixTokenWithFallback()
	if err != nil {
		return session, fmt.Errorf("failed to get Au10tix token: %w", err)
	}

	log.Printf("🔑 Checking Au10tix status using token from: %s", tokenSource)

	jwtPayload, err := h.configHandler.DecodeAu10tixToken(au10tixToken)
	if err != nil {
		return session, fmt.Errorf("failed to decode token: %w", err)
	}

	baseURL := jwtPayload.APIUrl
	if baseURL == "" {
		baseURL = config.API.Au10tixBaseURL
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	// Create HTTP client
	client := &http.Client{
		Timeout: time.Duration(config.API.APITimeout) * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	au10tixSessionID := session.Au10tixSession.SessionID

	// Try multiple endpoints to check status/results
	statusEndpoints := []string{
		// Result endpoints (more likely to work)
		"/result/v2/results/person/" + au10tixSessionID,
		"/api/v2/results/" + au10tixSessionID,
		"/api/v1/results/" + au10tixSessionID,
		"/results/" + au10tixSessionID,
		"/workflow/v1/results/" + au10tixSessionID,
		"/secure-me/v2/results/" + au10tixSessionID,
		// Status endpoints (less likely to work based on 404 error)
		"/api/v1/sessions/" + au10tixSessionID,
		"/v1/sessions/" + au10tixSessionID,
		"/sessions/" + au10tixSessionID,
		"/workflow/v1/sessions/" + au10tixSessionID,
	}

	var lastError error
	var workingResponse map[string]interface{}

	for _, endpoint := range statusEndpoints {
		statusURL := baseURL + endpoint
		log.Printf("🔍 Trying Au10tix endpoint: %s", statusURL)

		req, err := http.NewRequest("GET", statusURL, nil)
		if err != nil {
			lastError = err
			continue
		}

		// Add query parameters for result endpoints
		if strings.Contains(endpoint, "result") {
			q := req.URL.Query()
			q.Add("includeDetailed", "true")
			req.URL.RawQuery = q.Encode()
		}

		req.Header.Set("Authorization", "Bearer "+au10tixToken)
		req.Header.Set("User-Agent", "SelfServicePortal/1.0")
		req.Header.Set("Accept", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			lastError = err
			log.Printf("⚠️ Request failed for %s: %v", endpoint, err)
			continue
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			lastError = err
			log.Printf("⚠️ Failed to read response for %s: %v", endpoint, err)
			continue
		}

		log.Printf("📡 Au10tix Response from %s: Status %d, Body: %s", endpoint, resp.StatusCode, string(body))

		if resp.StatusCode == 200 {
			// Parse successful response
			var statusResp map[string]interface{}
			if err := json.Unmarshal(body, &statusResp); err != nil {
				log.Printf("⚠️ Failed to parse JSON response from %s: %v", endpoint, err)
				continue
			}

			workingResponse = statusResp
			log.Printf("✅ Found working Au10tix endpoint: %s", endpoint)
			break

		} else if resp.StatusCode == 404 {
			log.Printf("🔍 Endpoint %s not found (404) - trying next", endpoint)
			lastError = fmt.Errorf("endpoint not found: %s", endpoint)
			continue

		} else if resp.StatusCode == 401 {
			lastError = fmt.Errorf("authentication failed (401)")
			log.Printf("🔑 Authentication failed for %s", endpoint)
			break // No point trying other endpoints if auth fails

		} else {
			lastError = fmt.Errorf("HTTP error %d: %s", resp.StatusCode, string(body))
			log.Printf("⚠️ HTTP error %d from %s: %s", resp.StatusCode, endpoint, string(body))
		}
	}

	// If no endpoint worked, handle gracefully
	if workingResponse == nil {
		log.Printf("⚠️ No Au10tix endpoint worked, keeping session as pending")
		if lastError != nil {
			log.Printf("⚠️ Last error: %v", lastError)
		}

		// Don't return an error - just log and keep session as is
		// This allows the verification to continue working even if status checking fails
		return session, nil
	}

	// Update session based on successful Au10tix response
	session.UpdatedAt = time.Now()
	session.Data = workingResponse

	// Extract status information from response
	if status, ok := workingResponse["status"].(string); ok {
		switch strings.ToLower(status) {
		case "completed", "success", "verified", "passed", "approved":
			session.Status = "completed"
			session.Result = "verified"
		case "failed", "rejected", "denied":
			session.Status = "completed"
			session.Result = "failed"
		case "in_progress", "processing", "pending":
			session.Status = "in_progress"
		default:
			log.Printf("📊 Unknown Au10tix status: %s", status)
			session.Status = "pending"
		}
	}

	// Extract score if available
	if score, ok := workingResponse["score"].(float64); ok {
		session.Score = score
	}

	// Extract result if available
	if result, ok := workingResponse["result"].(string); ok {
		switch strings.ToLower(result) {
		case "verified", "passed", "approved", "success":
			session.Result = "verified"
		case "failed", "rejected", "denied":
			session.Result = "failed"
		}
	}

	log.Printf("✅ Updated session status: %s, result: %s, score: %.2f",
		session.Status, session.Result, session.Score)

	return session, nil
}

// SimulateVerificationComplete simulates completion for demo/testing purposes
func (h *VerificationHandler) SimulateVerificationComplete(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Session ID is required",
		})
		return
	}

	log.Printf("🎭 Simulating verification completion for session: %s", sessionID)

	session, exists := h.sessions[sessionID]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Verification session not found",
		})
		return
	}

	// Simulate successful verification
	session.Status = "completed"
	session.Result = "verified"
	session.Score = 0.95
	session.UpdatedAt = time.Now()
	session.Data = map[string]interface{}{
		"simulated":     true,
		"document_type": "passport",
		"confidence":    "high",
	}

	h.sessions[sessionID] = session

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Verification simulated successfully",
		"session": session,
	})
}

// CheckSimulatedVerification checks if there's a simulated verification success
func (h *VerificationHandler) CheckSimulatedVerification(c *gin.Context) {
	log.Printf("🔍 Checking for simulated verification success")

	// Check if there are any completed verification sessions
	hasCompletedVerification := false
	var lastCompletedSession *VerificationSession

	for _, session := range h.sessions {
		if session.Status == "completed" && session.Result == "verified" {
			hasCompletedVerification = true
			if lastCompletedSession == nil || session.UpdatedAt.After(lastCompletedSession.UpdatedAt) {
				lastCompletedSession = session
			}
		}
	}

	if hasCompletedVerification && lastCompletedSession != nil {
		log.Printf("✅ Found completed verification session: %s", lastCompletedSession.ID)
		c.JSON(http.StatusOK, gin.H{
			"success":         true,
			"hasVerification": true,
			"session":         lastCompletedSession,
			"message":         "Verification completed successfully",
		})
	} else {
		log.Printf("❌ No completed verification found")
		c.JSON(http.StatusOK, gin.H{
			"success":         true,
			"hasVerification": false,
			"message":         "No verification completed",
		})
	}
}

// CreateSimulatedVerification creates a simulated verification session for bypassing verification
func (h *VerificationHandler) CreateSimulatedVerification(c *gin.Context) {
	log.Printf("🎭 Creating simulated verification session")

	sessionID := "simulated-" + uuid.New().String()
	session := &VerificationSession{
		ID:     sessionID,
		Status: "completed",
		Result: "verified",
		Score:  95.0,
		Data: map[string]interface{}{
			"simulated":          true,
			"verification_score": 95.0,
			"response_json": map[string]interface{}{
				"status":       "success",
				"verification": "passed",
			},
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	h.sessions[sessionID] = session

	log.Printf("✅ Created simulated verification session: %s", sessionID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Simulated verification created successfully",
		"session": session,
	})
}

// ListVerificationSessions returns all verification sessions (for admin/debug purposes)
func (h *VerificationHandler) ListVerificationSessions(c *gin.Context) {
	log.Printf("📋 Listing all verification sessions")

	sessions := make([]*VerificationSession, 0, len(h.sessions))
	for _, session := range h.sessions {
		sessions = append(sessions, session)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"count":    len(sessions),
		"sessions": sessions,
	})
}

// CleanupExpiredSessions removes old verification sessions
func (h *VerificationHandler) CleanupExpiredSessions() {
	log.Printf("🧹 Cleaning up expired verification sessions")

	now := time.Now()
	expiry := 24 * time.Hour // Sessions expire after 24 hours

	for id, session := range h.sessions {
		if now.Sub(session.CreatedAt) > expiry {
			log.Printf("🗑️ Removing expired session: %s", id)
			delete(h.sessions, id)
		}
	}
}

// StartSessionCleanup starts a background goroutine to periodically clean up expired sessions
func (h *VerificationHandler) StartSessionCleanup() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour) // Clean up every hour
		defer ticker.Stop()

		for range ticker.C {
			h.CleanupExpiredSessions()
		}
	}()

	log.Printf("🔄 Started verification session cleanup background task")
}

// GetVerificationURL returns the verification URL for a given session ID
func (h *VerificationHandler) GetVerificationURL(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Session ID is required",
		})
		return
	}

	session, exists := h.GetSession(sessionID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Verification session not found",
		})
		return
	}

	if session.Au10tixSession == nil || session.Au10tixSession.SessionURL == "" {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Verification URL not available",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"sessionUrl": session.Au10tixSession.SessionURL,
		"sessionId":  sessionID,
		"status":     session.Status,
		"createdAt":  session.CreatedAt,
	})
}
