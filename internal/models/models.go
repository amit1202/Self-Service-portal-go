// File: internal/models/models.go
// Copy this entire content into: internal/models/models.go

package models

import (
	"time"
)

// User represents a user in the system
type User struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	Email     string     `gorm:"uniqueIndex;not null" json:"email"`
	FirstName string     `gorm:"not null" json:"first_name"`
	LastName  string     `gorm:"not null" json:"last_name"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	LastLogin *time.Time `json:"last_login,omitempty"`
}

// Verification represents an identity verification session
type Verification struct {
	ID              uint       `gorm:"primaryKey" json:"id"`
	UserID          uint       `gorm:"not null" json:"user_id"`
	SessionID       string     `gorm:"uniqueIndex;not null" json:"session_id"`
	Type            string     `gorm:"not null" json:"type"`
	Status          string     `gorm:"not null;default:'PENDING'" json:"status"`
	VerificationURL string     `json:"verification_url,omitempty"`
	Result          string     `gorm:"type:text" json:"result,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
	User            User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// ConfigSetting represents configuration settings
type ConfigSetting struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	Section   string    `gorm:"not null" json:"section"`
	Key       string    `gorm:"not null" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Helper methods for User
func (u *User) FullName() string {
	return u.FirstName + " " + u.LastName
}

func (u *User) UpdateLastLogin() {
	now := time.Now()
	u.LastLogin = &now
}

// Verification status constants
const (
	VerificationStatusPending    = "PENDING"
	VerificationStatusInProgress = "IN_PROGRESS"
	VerificationStatusCompleted  = "COMPLETED"
	VerificationStatusFailed     = "FAILED"
	VerificationStatusExpired    = "EXPIRED"
	VerificationStatusRejected   = "REJECTED"
)

// Verification type constants
const (
	VerificationTypeDocs   = "docs"
	VerificationTypeFace   = "face"
	VerificationTypeCustom = "custom"
)
