#!/bin/bash

# Self Service Portal Production Deployment Script
# Usage: ./scripts/deploy.sh [production|staging]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
APP_NAME="self-service-portal"
APP_DIR="/opt/self-service-portal"
SERVICE_NAME="self-service-portal"
BACKUP_DIR="/opt/backups/self-service-portal"

# Logging
LOG_FILE="/var/log/self-service-portal/deploy.log"
mkdir -p /var/log/self-service-portal

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root"
fi

# Check if user has sudo privileges
if ! sudo -n true 2>/dev/null; then
    error "This script requires sudo privileges"
fi

log "Starting deployment for environment: $ENVIRONMENT"

# Create backup
log "Creating backup of current installation..."
sudo mkdir -p "$BACKUP_DIR"
if [ -d "$APP_DIR" ]; then
    sudo cp -r "$APP_DIR" "$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"
    success "Backup created successfully"
else
    warning "No existing installation found, skipping backup"
fi

# Stop service if running
log "Stopping service if running..."
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    sudo systemctl stop "$SERVICE_NAME"
    success "Service stopped"
else
    log "Service was not running"
fi

# Build application
log "Building application..."
if ! command -v go &> /dev/null; then
    error "Go is not installed"
fi

go build -o main cmd/server/main.go
if [ $? -eq 0 ]; then
    success "Application built successfully"
else
    error "Failed to build application"
fi

# Create application directory
log "Creating application directory..."
sudo mkdir -p "$APP_DIR"
sudo mkdir -p "$APP_DIR/logs"

# Copy files
log "Copying application files..."
sudo cp main "$APP_DIR/"
sudo cp -r web "$APP_DIR/"
sudo cp portal-config.template.json "$APP_DIR/"
sudo cp self-service-portal.service /etc/systemd/system/

# Set permissions
log "Setting permissions..."
sudo chown -R portal:portal "$APP_DIR"
sudo chmod +x "$APP_DIR/main"

# Create portal user if it doesn't exist
if ! id "portal" &>/dev/null; then
    log "Creating portal user..."
    sudo useradd -r -s /bin/false -d "$APP_DIR" portal
    sudo usermod -aG portal $USER
fi

# Reload systemd
log "Reloading systemd..."
sudo systemctl daemon-reload

# Enable and start service
log "Starting service..."
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"

# Wait for service to start
log "Waiting for service to start..."
sleep 5

# Check service status
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    success "Service started successfully"
else
    error "Failed to start service"
fi

# Health check
log "Performing health check..."
for i in {1..30}; do
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        success "Health check passed"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Health check failed after 30 attempts"
    fi
    sleep 2
done

# Show service status
log "Service status:"
sudo systemctl status "$SERVICE_NAME" --no-pager

success "Deployment completed successfully!"
log "Application is now running at http://localhost:8080"
log "Service logs: sudo journalctl -u $SERVICE_NAME -f" 