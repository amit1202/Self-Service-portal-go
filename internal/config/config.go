// File: internal/config/config.go
// Copy this entire content into: internal/config/config.go

package config

import (
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

func Load() *Config {
	return &Config{
		Environment:    getEnv("ENVIRONMENT", "development"),
		Port:           getEnv("PORT", "8080"),
		DatabaseURL:    getEnv("DATABASE_URL", "portal.db"),
		SessionSecret:  getEnv("SESSION_SECRET", generateSessionSecret()),
		SDODefaultURL:  getEnv("SDO_DEFAULT_URL", "amitmt.doubleoctopus.io"),
		Au10tixBaseURL: getEnv("AU10TIX_BASE_URL", "https://eus-api.au10tixservicesstaging.com"),
		APITimeout:     30,
		APIRetries:     3,
	}
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
