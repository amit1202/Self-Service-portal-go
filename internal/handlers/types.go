// File: internal/handlers/types.go - Complete type definitions for the portal
package handlers

import "time"

// VerificationStartRequest represents the request to start verification
type VerificationStartRequest struct {
	FirstName   string `json:"firstName" binding:"required"`
	LastName    string `json:"lastName" binding:"required"`
	Email       string `json:"email" binding:"required"`
	PhoneNumber string `json:"phoneNumber,omitempty"`
	DateOfBirth string `json:"dateOfBirth,omitempty"`
}

// Au10tixSessionResponse represents a successful Au10tix session creation response
type Au10tixSessionResponse struct {
	SessionID  string `json:"session_id"`
	SessionURL string `json:"session_url"`
	Status     string `json:"status"`
}

// VerificationStatusResponse represents the response for verification status
type VerificationStatusResponse struct {
	Success bool                   `json:"success"`
	Status  string                 `json:"status"`
	Result  string                 `json:"result,omitempty"`
	Score   float64                `json:"score,omitempty"`
	Data    map[string]interface{} `json:"data,omitempty"`
}

// Au10tixJWTPayload represents the decoded JWT payload from Au10tix
type Au10tixJWTPayload struct {
	VER                    int      `json:"ver"`
	JTI                    string   `json:"jti"`
	ISS                    string   `json:"iss"`
	AUD                    string   `json:"aud"`
	IAT                    int64    `json:"iat"`
	EXP                    int64    `json:"exp"`
	CID                    string   `json:"cid"`
	SCP                    []string `json:"scp"`
	SUB                    string   `json:"sub"`
	APIUrl                 string   `json:"apiUrl"`
	BOSUrl                 string   `json:"bosUrl"`
	ClientOrganizationName string   `json:"clientOrganizationName"`
	ClientOrganizationID   int      `json:"clientOrganizationId"`
}

// PortalConfig represents the complete portal configuration
type PortalConfig struct {
	General GeneralConfig `json:"general"`
	Auth    AuthConfig    `json:"auth"`
	API     APIConfig     `json:"api"`
	Updated time.Time     `json:"updated"`
}

// GeneralConfig represents general display and notification settings
type GeneralConfig struct {
	Theme                string `json:"theme"`
	DefaultView          string `json:"default_view"`
	EmailNotifications   bool   `json:"email_notifications"`
	BrowserNotifications bool   `json:"browser_notifications"`
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	Au10tixToken string `json:"au10tix_token"`
	SDOUrl       string `json:"sdo_url"`
	SDOEmail     string `json:"sdo_email"`
	SDOPassword  string `json:"sdo_password"`
}

// APIConfig represents API configuration
type APIConfig struct {
	Au10tixBaseURL string `json:"au10tix_base_url"`
	SDOApiURL      string `json:"sdo_api_url"`
	APITimeout     int    `json:"api_timeout"`
	APIRetries     int    `json:"api_retries"`
}

// Au10tixTestRequest represents a request to test Au10tix connection
type Au10tixTestRequest struct {
	Token   string `json:"token"`
	BaseURL string `json:"base_url"`
}

// Au10tixWorkflowRequest represents the request structure for Au10tix workflow creation
type Au10tixWorkflowRequest struct {
	WorkflowOptions map[string]interface{} `json:"workflowOptions"`
	ServiceOptions  ServiceOptions         `json:"serviceOptions"`
}

// ServiceOptions represents the service options for Au10tix workflow
type ServiceOptions struct {
	Secureme SecuremeOptions `json:"secureme"`
}

// SecuremeOptions represents the secureme options
type SecuremeOptions struct {
	ShortURL     bool                `json:"shortUrl"`
	RequestTypes map[string][]string `json:"requestTypes"`
}

// Au10tixWorkflowResponse represents the response from Au10tix workflow creation
type Au10tixWorkflowResponse struct {
	ID           string                 `json:"id"`
	SecuremeLink string                 `json:"securemeLink,omitempty"`
	WorkflowURL  string                 `json:"workflowUrl,omitempty"`
	URL          string                 `json:"url,omitempty"`
	Link         string                 `json:"link,omitempty"`
	Status       string                 `json:"status"`
	Data         map[string]interface{} `json:"data,omitempty"`
}

// Au10tixResultResponse represents the response from Au10tix result API
type Au10tixResultResponse struct {
	ID                  string                    `json:"id"`
	Status              string                    `json:"status"`
	Result              Au10tixVerificationResult `json:"result,omitempty"`
	Score               float64                   `json:"score,omitempty"`
	IsDocumentAuthentic bool                      `json:"isDocumentAuthentic,omitempty"`
	IsFaceMatch         bool                      `json:"isFaceMatch,omitempty"`
	Data                map[string]interface{}    `json:"data,omitempty"`
}

// Au10tixVerificationResult represents the detailed verification result
type Au10tixVerificationResult struct {
	IsDocumentAuthentic bool                   `json:"isDocumentAuthentic"`
	IsFaceMatch         bool                   `json:"isFaceMatch"`
	DocumentType        string                 `json:"documentType,omitempty"`
	Confidence          string                 `json:"confidence,omitempty"`
	Details             map[string]interface{} `json:"details,omitempty"`
}

// SDOAuthRequest represents the SDO authentication request
type SDOAuthRequest struct {
	URL      string `json:"url" binding:"required"`
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// SDOAuthResponse represents the SDO authentication response
type SDOAuthResponse struct {
	Success bool   `json:"success"`
	Token   string `json:"token,omitempty"`
	TokenID string `json:"tokenId,omitempty"`
	DataID  string `json:"dataId,omitempty"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// QRCodeRequest represents the request for QR code generation
type QRCodeRequest struct {
	Email        string `json:"email,omitempty"`
	InviteData   string `json:"inviteData,omitempty"`
	UserSpecific bool   `json:"userSpecific,omitempty"`
}

// QRCodeResponse represents the response for QR code generation
type QRCodeResponse struct {
	Success      bool   `json:"success"`
	QRData       string `json:"qr_data"`
	InvitationID string `json:"invitation_id"`
	Message      string `json:"message,omitempty"`
	Error        string `json:"error,omitempty"`
	TestMode     bool   `json:"test_mode,omitempty"`
}

// InvitationStatusResponse represents the response for invitation status
type InvitationStatusResponse struct {
	Status  string `json:"status"`
	Valid   bool   `json:"valid"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// ConfigTestResponse represents the response for configuration tests
type ConfigTestResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

// SessionDebugInfo represents debug information about the current session
type SessionDebugInfo struct {
	SessionID        string                 `json:"session_id"`
	SDOAuthenticated bool                   `json:"sdo_authenticated"`
	SessionData      map[string]interface{} `json:"session_data"`
}

// VerificationListResponse represents the response for listing verification sessions
type VerificationListResponse struct {
	Success  bool                   `json:"success"`
	Count    int                    `json:"count"`
	Sessions []*VerificationSession `json:"sessions"`
}

// HealthCheckResponse represents the health check response
type HealthCheckResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

// APIError represents a generic API error response
type APIError struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
	Code    int    `json:"code,omitempty"`
}

// SuccessResponse represents a generic success response
type SuccessResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}
