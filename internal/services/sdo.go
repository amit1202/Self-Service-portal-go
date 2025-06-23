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
	Email    string `json:"email"`
	Password string `json:"password"`
	OA       bool   `json:"oa"` // Changed from Password to OA to match JS
}

type SDOAuthResponse struct {
	Token   string `json:"token"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

type SDOUser struct {
	ID             json.Number `json:"id"`
	DisplayName    string      `json:"displayName"`
	Username       string      `json:"username"`
	Email          string      `json:"email"`
	FirstName      string      `json:"firstName"`
	LastName       string      `json:"lastName"`
	DirectoryName  string      `json:"directoryName"`
	OrganizationID string      `json:"organizationId"`
}

type SDOSearchResponse struct {
	Content   []SDOUser `json:"content"`
	UserCount int       `json:"userCount"`
	PageSize  int       `json:"pageSize"`
	Page      int       `json:"page"`
}

type SDOInvitationPayload struct {
	Type string `json:"type"`
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
	EnrollmentURL string `json:"enrollmentUrl"`
	URL           string `json:"url"` // Alternative URL field
	QRCodeURL     string `json:"qr_code_url"`
	Status        string `json:"status"`
	CreatedAt     string `json:"createdAt"`
	Message       string `json:"message,omitempty"`
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

// NewSDOServiceWithAuth creates a new SDOService with pre-configured authentication
func NewSDOServiceWithAuth(baseURL, token string) *SDOService {
	return &SDOService{
		BaseURL: baseURL,
		Token:   token,
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

	// Remove protocol if present
	url := strings.TrimPrefix(rawURL, "http://")
	url = strings.TrimPrefix(url, "https://")

	// Remove trailing slashes
	url = strings.TrimSuffix(url, "/")

	// Split URL into domain and path
	parts := strings.SplitN(url, "/", 2)
	domain := parts[0]
	path := ""
	if len(parts) > 1 {
		path = parts[1]
	}

	// Basic domain validation (aligned with JS regex)
	domainRegex := regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+`)
	if !domainRegex.MatchString(domain) {
		return ""
	}

	// Add https protocol
	url = "https://" + domain

	// Ensure /admin path
	if path == "" || !strings.Contains(path, "admin") {
		url = url + "/admin"
	} else {
		// If path already contains admin, use it as is
		url = url + "/" + path
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
		Email:    email,
		Password: password,
		OA:       false,
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

// SendInvitation sends an invitation to a user
func (s *SDOService) SendInvitation(userID, invitationType string) (*SDOInvitationDetails, error) {
	// Use the correct API endpoint as specified by the user
	inviteURL := s.BaseURL + "/api/users/" + userID + "/invitations"

	// Use the exact payload format specified by the user
	payload := map[string]string{
		"type": invitationType,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal invitation request: %v", err)
	}

	log.Printf("SDO Service: Sending invitation to user %s with type %s", userID, invitationType)
	log.Printf("SDO Service: Request URL: %s", inviteURL)
	log.Printf("SDO Service: Request payload: %s", string(jsonData))

	req, err := http.NewRequest("POST", inviteURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create invitation request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.Token)

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("invitation request failed: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	log.Printf("SDO Service: Invitation response status: %d", resp.StatusCode)
	log.Printf("SDO Service: Invitation response body: %s", string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("invitation failed with status %d: %s", resp.StatusCode, string(body))
	}

	var invitationResp map[string]interface{}
	if err := json.Unmarshal(body, &invitationResp); err != nil {
		return nil, fmt.Errorf("failed to parse invitation response: %v", err)
	}

	// Extract invitation ID from response
	// The SDO API returns the invitation ID nested inside an "invitation" object
	invitationObj, ok := invitationResp["invitation"].(map[string]interface{})
	if !ok {
		log.Printf("SDO Service: Full invitation response: %+v", invitationResp)
		log.Printf("SDO Service: Response keys: %v", getMapKeys(invitationResp))
		return nil, fmt.Errorf("no invitation object found in response")
	}

	invitationID, ok := invitationObj["invitationId"].(string)
	if !ok || invitationID == "" {
		log.Printf("SDO Service: Invitation object: %+v", invitationObj)
		log.Printf("SDO Service: Invitation object keys: %v", getMapKeys(invitationObj))
		return nil, fmt.Errorf("no invitationId found in invitation object")
	}

	// Extract additional invitation details
	invType, _ := invitationObj["type"].(string)
	status, _ := invitationObj["invitationStatus"].(string)
	createdAt, _ := invitationObj["createdAt"].(string)
	expiredAt, _ := invitationObj["expiredAt"].(string)

	log.Printf("SDO Service: Successfully extracted invitation ID: %s", invitationID)

	return &SDOInvitationDetails{
		ID:           invitationID,
		InvitationID: invitationID,
		Status:       status,
		CreatedAt:    createdAt,
		Message:      fmt.Sprintf("Invitation sent successfully. Type: %s, Expires: %s", invType, expiredAt),
	}, nil
}

// GetInvitationDetails retrieves the details of a specific invitation from SDO.
func (s *SDOService) GetInvitationDetails(invitationID string) (*SDOInvitationDetails, error) {
	if s.Token == "" {
		return nil, fmt.Errorf("not authenticated with SDO")
	}

	// This is the standard endpoint for fetching invitation details.
	detailsURL := fmt.Sprintf("%s/api/invitations/%s", s.BaseURL, invitationID)
	log.Printf("SDO Service: Getting invitation details from URL: %s", detailsURL)

	req, err := http.NewRequest("GET", detailsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create invitation details request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.Token)
	req.Header.Set("Accept", "application/json")

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("invitation details request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read invitation details response body: %w", err)
	}

	log.Printf("SDO Service: Invitation details response status: %d", resp.StatusCode)
	log.Printf("SDO Service: Invitation details response body: %s", string(body))

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("invitation details request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse the response as a generic map to extract the enrollment URL
	var responseMap map[string]interface{}
	if err := json.Unmarshal(body, &responseMap); err != nil {
		return nil, fmt.Errorf("failed to unmarshal invitation details: %w", err)
	}

	// Extract the enrollment URL from various possible fields
	var enrollmentURL string
	if url, ok := responseMap["enrollmentUrl"].(string); ok && url != "" {
		enrollmentURL = url
	} else if url, ok := responseMap["enrollment_url"].(string); ok && url != "" {
		enrollmentURL = url
	} else if url, ok := responseMap["url"].(string); ok && url != "" {
		enrollmentURL = url
	} else if url, ok := responseMap["invitationUrl"].(string); ok && url != "" {
		enrollmentURL = url
	} else if url, ok := responseMap["invitation_url"].(string); ok && url != "" {
		enrollmentURL = url
	}

	if enrollmentURL == "" {
		return nil, fmt.Errorf("no enrollment URL found in invitation details response")
	}

	log.Printf("SDO Service: Found enrollment URL: %s", enrollmentURL)

	// Create the invitation details with the enrollment URL
	invitationDetails := &SDOInvitationDetails{
		ID:            invitationID,
		InvitationID:  invitationID,
		EnrollmentURL: enrollmentURL,
	}

	return invitationDetails, nil
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

// Helper function to get map keys for debugging
func getMapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// Publish triggers the SDO publications API after invitation
func (s *SDOService) Publish() error {
	if s.Token == "" {
		return fmt.Errorf("not authenticated with SDO")
	}

	publishURL := s.BaseURL + "/api/publications"
	log.Printf("SDO Service: Publishing to URL: %s", publishURL)

	req, err := http.NewRequest("POST", publishURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create publication request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.Client.Do(req)
	if err != nil {
		return fmt.Errorf("publication request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("publication failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("SDO Service: Publication successful (status: %d)", resp.StatusCode)
	return nil
}
