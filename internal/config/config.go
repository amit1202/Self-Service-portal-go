// File: internal/config/config.go
// Copy this entire content into: internal/config/config.go

package config

import (
	"encoding/json"
	"log"
	"os"
)

type Config struct {
	Environment    string
	Port           string
	DatabaseURL    string
	SessionSecret  string
	SDODefaultURL  string
	Au10tixBaseURL string
	APITimeout     int
	APIRetries     int
}

type PortalConfig struct {
	Auth struct {
		SDOURL       string `json:"sdo_url"`
		SDOEmail     string `json:"sdo_email"`
		SDOPassword  string `json:"sdo_password"`
		Au10tixToken string `json:"au10tix_token"`
	} `json:"auth"`
	Updated string `json:"updated"`
}

func Load() *Config {
	// Try to load from portal-config.json first
	portalConfig := loadPortalConfig()

	config := &Config{
		Environment:    getEnv("ENVIRONMENT", "development"),
		Port:           getEnv("PORT", "8080"),
		DatabaseURL:    getEnv("DATABASE_URL", "portal.db"),
		SessionSecret:  getEnv("SESSION_SECRET", generateSessionSecret()),
		SDODefaultURL:  getEnv("SDO_DEFAULT_URL", "amitmt.doubleoctopus.io"),
		Au10tixBaseURL: getEnv("AU10TIX_BASE_URL", "https://eus-api.au10tixservicesstaging.com"),
		APITimeout:     30,
		APIRetries:     3,
	}

	// Override with portal config if available
	if portalConfig != nil {
		if portalConfig.Auth.SDOURL != "" {
			config.SDODefaultURL = portalConfig.Auth.SDOURL
		}
	}

	return config
}

func loadPortalConfig() *PortalConfig {
	data, err := os.ReadFile("portal-config.json")
	if err != nil {
		log.Printf("📥 Could not read portal-config.json: %v", err)
		return nil
	}

	var config PortalConfig
	if err := json.Unmarshal(data, &config); err != nil {
		log.Printf("📥 Could not parse portal-config.json: %v", err)
		return nil
	}

	log.Printf("📥 Loaded configuration from portal-config.json")
	return &config
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func generateSessionSecret() string {
	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		log.Println("Warning: Using default session secret. Set SESSION_SECRET environment variable for production.")
		return "your-secret-key-change-this-in-production"
	}
	return secret
}
