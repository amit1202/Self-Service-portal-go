// File: internal/services/sdo.go
// Updated to align with JavaScript frontend logic

package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

type SDOService struct {
	BaseURL string
	Token   string
	Client  *http.Client
}

// Aligned with JavaScript auth request structure
type SDOAuthRequest struct {
	Email string `json:"email"`
	OA    string `json:"oa"` // Changed from Password to OA to match JS
}

type SDOAuthResponse struct {
	Token   string `json:"token"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

type SDOUser struct {
	ID             string `json:"id"`
	DisplayName    string `json:"displayName"`
	Username       string `json:"username"`
	Email          string `json:"email"`
	FirstName      string `json:"firstName"`
	LastName       string `json:"lastName"`
	DirectoryName  string `json:"directoryName"`
	OrganizationID string `json:"organizationId"`
}

type SDOSearchResponse struct {
	Content   []SDOUser `json:"content"`
	UserCount int       `json:"userCount"`
	PageSize  int       `json:"pageSize"`
	Page      int       `json:"page"`
}

type SDOInvitationRequest struct {
	Invite          bool     `json:"invite"`
	InvitationTypes []string `json:"invitationTypes"`
}

// Enhanced invitation response to match JavaScript expectations
type SDOInvitationDetails struct {
	ID            string `json:"id"`
	InvitationID  string `json:"invitationId"`
	InvitationURL string `json:"invitationUrl"`
	URL           string `json:"url"` // Alternative URL field
	Status        string `json:"status"`
	CreatedAt     string `json:"createdAt"`
}

// InitializeFromSession initializes the SDO service from session data
func (s *SDOService) InitializeFromSession(session interface{}) error {
	// You'll need to cast this to your session type
	// This is a generic example - adjust based on your session implementation

	if sessionData, ok := session.(map[string]interface{}); ok {
		if baseURL, exists := sessionData["sdo_base_url"].(string); exists {
			s.BaseURL = baseURL
		}
		if token, exists := sessionData["sdo_token"].(string); exists {
			s.Token = token
		}
	}

	return nil
}

// SaveToSession saves the SDO service state to session
func (s *SDOService) SaveToSession(session interface{}) error {
	// You'll need to cast this to your session type and save the data
	// This is a generic example - adjust based on your session implementation

	if sessionData, ok := session.(map[string]interface{}); ok {
		sessionData["sdo_base_url"] = s.BaseURL
		sessionData["sdo_token"] = s.Token
		sessionData["sdo_authenticated"] = (s.Token != "")
	}

	return nil
}

// IsAuthenticated checks if the service is authenticated (can also check session)
func (s *SDOService) IsAuthenticated() bool {
	return s.Token != ""
}

// Main response structure that matches JavaScript parsing logic
type SDOInvitationResponse struct {
	ID                string                `json:"id"`
	InvitationID      string                `json:"invitationId"`
	InvitationDetails *SDOInvitationDetails `json:"invitationDetails,omitempty"`
	RawResponse       interface{}           `json:"rawResponse,omitempty"`
	Error             string                `json:"error,omitempty"`
	Success           bool                  `json:"success"`
	Message           string                `json:"message,omitempty"`
}

// Enhanced error response
type SDOErrorResponse struct {
	Error   string      `json:"error"`
	Details interface{} `json:"details,omitempty"`
	Status  int         `json:"status,omitempty"`
}

func NewSDOService() *SDOService {
	return &SDOService{
		Client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// NormalizeURL ensures the SDO URL is properly formatted (aligned with JS validation)
func (s *SDOService) NormalizeURL(rawURL string) string {
	if rawURL == "" {
		return ""
	}

	// Handle default URL case (aligned with JS logic)
	if strings.Contains(rawURL, "amitmt.doubleoctopus.io") {
		return "https://" + strings.TrimPrefix(strings.TrimPrefix(rawURL, "http://"), "https://")
	}

	// Remove protocol if present
	url := strings.TrimPrefix(rawURL, "http://")
	url = strings.TrimPrefix(url, "https://")

	// Remove trailing slashes
	url = strings.TrimSuffix(url, "/")

	// Basic domain validation (aligned with JS regex)
	domainRegex := regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+`)
	if !domainRegex.MatchString(url) {
		return ""
	}

	// Add https protocol
	url = "https://" + url

	// Ensure /admin path
	if !strings.Contains(url, "/admin") {
		url = url + "/admin"
	}

	return url
}

// Authenticate performs SDO authentication (aligned with working browser test)
func (s *SDOService) Authenticate(baseURL, email, password string) (*SDOAuthResponse, error) {
	s.BaseURL = s.NormalizeURL(baseURL)
	if s.BaseURL == "" {
		return nil, fmt.Errorf("invalid SDO URL format")
	}

	authURL := s.BaseURL + "/api/auth/login"
	log.Printf("SDO Service: Authenticating to URL: %s", authURL)
	log.Printf("SDO Service: Email: %s", email)

	// Use exact same payload as working browser test
	authReq := SDOAuthRequest{
		Email: email,
		OA:    password,
	}

	jsonData, err := json.Marshal(authReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal auth request: %v", err)
	}

	log.Printf("SDO Service: Request payload: %s", string(jsonData))

	req, err := http.NewRequest("POST", authURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create auth request: %v", err)
	}

	// Use same headers as working browser test
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Self-Service-Portal/1.0")

	log.Printf("SDO Service: Sending request to: %s", authURL)
	log.Printf("SDO Service: Request headers: %v", req.Header)

	resp, err := s.Client.Do(req)
	if err != nil {
		log.Printf("SDO Service: HTTP request failed: %v", err)
		return nil, fmt.Errorf("authentication request failed: %v", err)
	}
	defer resp.Body.Close()

	log.Printf("SDO Service: Response status: %d", resp.StatusCode)
	log.Printf("SDO Service: Response headers: %v", resp.Header)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	log.Printf("SDO Service: Response body (first 500 chars): %s", string(body)[:min(len(string(body)), 500)])
	log.Printf("SDO Service: Response Content-Type: %s", resp.Header.Get("Content-Type"))

	// Check if response is HTML instead of JSON
	if strings.Contains(strings.ToLower(string(body)), "<html") || strings.Contains(strings.ToLower(string(body)), "<!doctype") {
		log.Printf("SDO Service: ERROR - Server returned HTML instead of JSON")
		log.Printf("SDO Service: Full HTML response: %s", string(body))

		// Try to extract error message from HTML if possible
		if strings.Contains(string(body), "404") || strings.Contains(string(body), "Not Found") {
			return nil, fmt.Errorf("SDO API endpoint not found (404) - check URL: %s", authURL)
		} else if strings.Contains(string(body), "500") || strings.Contains(string(body), "Internal Server Error") {
			return nil, fmt.Errorf("SDO server internal error (500)")
		} else {
			return nil, fmt.Errorf("SDO server returned HTML instead of JSON - URL may be incorrect: %s", authURL)
		}
	}

	// Ensure we have a JSON response
	if !strings.Contains(resp.Header.Get("Content-Type"), "application/json") {
		log.Printf("SDO Service: WARNING - Response Content-Type is not JSON: %s", resp.Header.Get("Content-Type"))
		log.Printf("SDO Service: Response body: %s", string(body))
		return nil, fmt.Errorf("SDO server returned non-JSON response (Content-Type: %s)", resp.Header.Get("Content-Type"))
	}

	var authResp SDOAuthResponse
	if err := json.Unmarshal(body, &authResp); err != nil {
		log.Printf("SDO Service: Failed to parse JSON response: %v", err)
		log.Printf("SDO Service: Raw response causing parse error: %s", string(body))
		return nil, fmt.Errorf("failed to parse auth response: %v - Response was: %s", err, string(body)[:min(len(string(body)), 200)])
	}

	if resp.StatusCode != http.StatusOK {
		if authResp.Error != "" {
			return nil, fmt.Errorf("authentication failed: %s", authResp.Error)
		}
		return nil, fmt.Errorf("authentication failed with status %d: %s", resp.StatusCode, string(body))
	}

	if authResp.Token == "" {
		return nil, fmt.Errorf("authentication succeeded but no token received")
	}

	s.Token = authResp.Token
	log.Printf("SDO Service: Successfully authenticated, token length: %d", len(authResp.Token))
	return &authResp, nil
}

// TestConnection tests the SDO connection without full authentication
func (s *SDOService) TestConnection(baseURL, email, password string) error {
	_, err := s.Authenticate(baseURL, email, password)
	return err
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// SearchUsers searches for users in SDO directory (matching Flask implementation)
func (s *SDOService) SearchUsers(query string, pageSize int) (*SDOSearchResponse, error) {
	if s.Token == "" {
		return nil, fmt.Errorf("not authenticated with SDO")
	}

	if len(query) < 2 {
		return nil, fmt.Errorf("search query must be at least 2 characters")
	}

	searchURL := s.BaseURL + "/api/directories/explorer/members/search"

	// Use same parameters as Flask app
	params := url.Values{}
	params.Set("path", "cm9vdA") // Base64 for "root" - matching Flask exactly
	params.Set("pageSize", fmt.Sprintf("%d", pageSize))
	params.Set("search", query)

	log.Printf("Searching SDO users: URL=%s, query=%s, pageSize=%d", searchURL, query, pageSize)

	req, err := http.NewRequest("GET", searchURL+"?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create search request: %v", err)
	}

	// Same headers as Flask
	req.Header.Set("Authorization", "Bearer "+s.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("search request failed: %v", err)
	}
	defer resp.Body.Close()

	log.Printf("SDO search response status: %d", resp.StatusCode)

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("authentication expired, please re-authenticate")
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("SDO search error response: %s", string(body))
		return nil, fmt.Errorf("search failed with status %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read search response: %v", err)
	}

	log.Printf("SDO search response body: %s", string(body)[:min(len(string(body)), 500)])

	var searchResp SDOSearchResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, fmt.Errorf("failed to parse search response: %v", err)
	}

	log.Printf("Found %d users matching query '%s'", len(searchResp.Content), query)
	return &searchResp, nil
}

// SendInvitation sends an invitation to a user (matching Flask implementation exactly)
func (s *SDOService) SendInvitation(userID string, invitationTypes []string) (*SDOInvitationResponse, error) {
	if s.Token == "" {
		return nil, fmt.Errorf("not authenticated with SDO")
	}

	if len(invitationTypes) == 0 {
		return nil, fmt.Errorf("at least one invitation type must be specified")
	}

	invitationURL := fmt.Sprintf("%s/api/users/%s/invitations", s.BaseURL, userID)

	// Match Flask exactly: {"invite": true, "invitationTypes": ["MOBILE", "WEB"]}
	invReq := SDOInvitationRequest{
		Invite:          true,
		InvitationTypes: invitationTypes,
	}

	jsonData, err := json.Marshal(invReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal invitation request: %v", err)
	}

	log.Printf("Sending invitation to user %s with types: %v", userID, invitationTypes)
	log.Printf("Invitation URL: %s", invitationURL)
	log.Printf("Invitation payload: %s", string(jsonData))

	req, err := http.NewRequest("POST", invitationURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create invitation request: %v", err)
	}

	// Same headers as Flask
	req.Header.Set("Authorization", "Bearer "+s.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("invitation request failed: %v", err)
	}
	defer resp.Body.Close()

	log.Printf("Invitation response status: %d", resp.StatusCode)

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("authentication expired, please re-authenticate")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read invitation response: %v", err)
	}

	log.Printf("Invitation response body: %s", string(body))

	// Enhanced response parsing aligned with Flask logic
	return s.parseInvitationResponse(body, resp.StatusCode)
}

// parseInvitationResponse handles complex response parsing like the JavaScript
func (s *SDOService) parseInvitationResponse(body []byte, statusCode int) (*SDOInvitationResponse, error) {
	log.Printf("Parsing invitation response: %s", string(body))

	// Initialize response structure
	response := &SDOInvitationResponse{
		Success: statusCode >= 200 && statusCode < 300,
	}

	// Store raw response for JavaScript compatibility
	var rawResponse interface{}
	if err := json.Unmarshal(body, &rawResponse); err != nil {
		response.Error = fmt.Sprintf("failed to parse response: %v", err)
		return response, nil
	}
	response.RawResponse = rawResponse

	// Try to extract invitation ID using the same logic as JavaScript
	invitationID := s.extractInvitationID(rawResponse)
	if invitationID != "" {
		response.ID = invitationID
		response.InvitationID = invitationID
		log.Printf("Extracted invitation ID: %s", invitationID)
	}

	// Try to parse as single invitation details
	var details SDOInvitationDetails
	if err := json.Unmarshal(body, &details); err == nil {
		response.InvitationDetails = &details
		if response.ID == "" && details.ID != "" {
			response.ID = details.ID
			response.InvitationID = details.ID
		}
	} else {
		// Try parsing as array (sometimes SDO returns array)
		var detailsArray []SDOInvitationDetails
		if err := json.Unmarshal(body, &detailsArray); err == nil && len(detailsArray) > 0 {
			response.InvitationDetails = &detailsArray[0]
			if response.ID == "" && detailsArray[0].ID != "" {
				response.ID = detailsArray[0].ID
				response.InvitationID = detailsArray[0].ID
			}
		}
	}

	if !response.Success {
		response.Error = fmt.Sprintf("invitation failed with status %d", statusCode)
	}

	return response, nil
}

// extractInvitationID mimics the JavaScript extraction logic
func (s *SDOService) extractInvitationID(response interface{}) string {
	log.Printf("Extracting invitation ID from response: %+v", response)

	// Define the expected ID pattern (aligned with JavaScript)
	idPattern := regexp.MustCompile(`^018[a-zA-Z0-9]{40,}`)

	// Helper function to search for ID in nested structures
	var searchForID func(interface{}, int) string
	searchForID = func(obj interface{}, depth int) string {
		if depth > 3 {
			return "" // Prevent infinite recursion
		}

		switch v := obj.(type) {
		case map[string]interface{}:
			// Check common ID field names
			if id, ok := v["id"].(string); ok && len(id) > 20 && idPattern.MatchString(id) {
				return id
			}
			if id, ok := v["invitationId"].(string); ok && len(id) > 20 && idPattern.MatchString(id) {
				return id
			}

			// Search nested objects
			for _, value := range v {
				if result := searchForID(value, depth+1); result != "" {
					return result
				}
			}

		case []interface{}:
			// Search in arrays
			for _, item := range v {
				if result := searchForID(item, depth+1); result != "" {
					return result
				}
			}

		case string:
			// Check if the string itself is a valid ID
			if len(v) > 20 && idPattern.MatchString(v) {
				return v
			}
		}

		return ""
	}

	invitationID := searchForID(response, 0)
	if invitationID != "" {
		log.Printf("Found invitation ID: %s", invitationID)
	} else {
		log.Printf("No valid invitation ID found in response")
	}

	return invitationID
}

// ProxyRequest proxies any request to SDO API (enhanced error handling)
func (s *SDOService) ProxyRequest(method, path string, body io.Reader, params url.Values) (*http.Response, error) {
	if s.Token == "" {
		return nil, fmt.Errorf("not authenticated with SDO")
	}

	targetURL := s.BaseURL + "/api" + path
	if params != nil {
		targetURL += "?" + params.Encode()
	}

	log.Printf("Proxying %s request to: %s", method, targetURL)

	req, err := http.NewRequest(method, targetURL, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create proxy request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.Token)
	req.Header.Set("Content-Type", "application/json")

	return s.Client.Do(req)
}

// GetConnectionStatus returns the current connection status (enhanced info)
func (s *SDOService) GetConnectionStatus() map[string]interface{} {
	status := map[string]interface{}{
		"connected": s.Token != "",
		"base_url":  s.BaseURL,
		"timestamp": time.Now().Unix(),
	}

	if s.Token != "" {
		status["token_length"] = len(s.Token)
		status["status"] = "authenticated"
		status["auth_status"] = "authenticated"
	} else {
		status["status"] = "not_authenticated"
		status["auth_status"] = "unauthenticated"
	}

	return status
}

// GetInvitationDetails retrieves invitation details by ID (new method to support JS)
func (s *SDOService) GetInvitationDetails(invitationID string) (*SDOInvitationDetails, error) {
	if s.Token == "" {
		return nil, fmt.Errorf("not authenticated with SDO")
	}

	if invitationID == "" {
		return nil, fmt.Errorf("invitation ID is required")
	}

	log.Printf("Fetching invitation details for ID: %s", invitationID)

	invitationURL := fmt.Sprintf("%s/api/invitations/%s", s.BaseURL, invitationID)

	req, err := http.NewRequest("GET", invitationURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("authentication expired, please re-authenticate")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get invitation details, status: %d", resp.StatusCode)
	}

	var details SDOInvitationDetails
	if err := json.NewDecoder(resp.Body).Decode(&details); err != nil {
		return nil, fmt.Errorf("failed to parse invitation details: %v", err)
	}

	log.Printf("Retrieved invitation details: %+v", details)
	return &details, nil
}

// ValidateInvitationID checks if an invitation ID matches the expected pattern
func (s *SDOService) ValidateInvitationID(invitationID string) bool {
	if invitationID == "" {
		return false
	}

	// Aligned with JavaScript validation pattern
	idPattern := regexp.MustCompile(`^018[a-zA-Z0-9]{40,}`)
	return idPattern.MatchString(invitationID)
}
