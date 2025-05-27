// File: internal/database/database.go
// Copy this entire content into: internal/database/database.go

package database

import (
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"self-service-portal/internal/models"
)

// Initialize creates and configures the database connection
func Initialize(databaseURL string) (*gorm.DB, error) {
	var db *gorm.DB
	var err error

	// Configure GORM logger
	gormLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Silent, // Change to logger.Info for development debugging
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)

	// Determine database type and connect
	if isPostgresURL(databaseURL) {
		// PostgreSQL connection (for production)
		db, err = gorm.Open(postgres.Open(databaseURL), &gorm.Config{
			Logger: gormLogger,
		})
	} else {
		// SQLite connection (for development)
		db, err = gorm.Open(sqlite.Open(databaseURL), &gorm.Config{
			Logger: gormLogger,
		})
	}

	if err != nil {
		return nil, err
	}

	// Configure connection pool for PostgreSQL
	if isPostgresURL(databaseURL) {
		sqlDB, err := db.DB()
		if err != nil {
			return nil, err
		}

		// Connection pool settings
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetMaxOpenConns(100)
		sqlDB.SetConnMaxLifetime(time.Hour)
	}

	// Run auto-migration
	if err := runMigrations(db); err != nil {
		return nil, err
	}

	log.Println("✅ Database initialized successfully")
	return db, nil
}

// runMigrations performs automatic database migrations
func runMigrations(db *gorm.DB) error {
	log.Println("🔄 Running database migrations...")

	return db.AutoMigrate(
		&models.User{},
		&models.Verification{},
		&models.ConfigSetting{},
	)
}

// isPostgresURL checks if the database URL is for PostgreSQL
func isPostgresURL(url string) bool {
	return len(url) > 10 && (url[:10] == "postgres://" || url[:11] == "postgresql://")
}

// Helper functions for common database operations

// GetUserByEmail retrieves a user by email
func GetUserByEmail(db *gorm.DB, email string) (*models.User, error) {
	var user models.User
	err := db.Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// CreateUser creates a new user
func CreateUser(db *gorm.DB, email, firstName, lastName string) (*models.User, error) {
	user := models.User{
		Email:     email,
		FirstName: firstName,
		LastName:  lastName,
	}

	if err := db.Create(&user).Error; err != nil {
		return nil, err
	}

	log.Printf("✅ Created new user: %s (%s)", user.FullName(), user.Email)
	return &user, nil
}

// GetUserVerifications retrieves all verifications for a user
func GetUserVerifications(db *gorm.DB, userID uint) ([]models.Verification, error) {
	var verifications []models.Verification
	err := db.Where("user_id = ?", userID).Order("created_at DESC").Find(&verifications).Error
	return verifications, err
}

// GetUserConfig retrieves user configuration settings
func GetUserConfig(db *gorm.DB, userID uint, section string) (map[string]string, error) {
	var settings []models.ConfigSetting
	err := db.Where("user_id = ? AND section = ?", userID, section).Find(&settings).Error
	if err != nil {
		return nil, err
	}

	config := make(map[string]string)
	for _, setting := range settings {
		config[setting.Key] = setting.Value
	}

	return config, nil
}

// SaveUserConfig saves user configuration settings
func SaveUserConfig(db *gorm.DB, userID uint, section string, config map[string]string) error {
	// Begin transaction
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Delete existing settings for this section
	if err := tx.Where("user_id = ? AND section = ?", userID, section).Delete(&models.ConfigSetting{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Insert new settings
	for key, value := range config {
		setting := models.ConfigSetting{
			UserID:  userID,
			Section: section,
			Key:     key,
			Value:   value,
		}
		if err := tx.Create(&setting).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit().Error
}
