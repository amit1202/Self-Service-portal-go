# Railway-optimized Dockerfile for Self Service Portal
FROM golang:1.24-alpine AS builder

# Set working directory
WORKDIR /app

# Install necessary packages for building
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files first for better caching
COPY go.mod go.sum ./

# Download dependencies with verbose output and retry logic
RUN go mod download -x || (echo "Retrying go mod download..." && sleep 2 && go mod download -x)

# Copy source code
COPY . .

# Build the application with specific flags for Railway
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -a -installsuffix cgo \
    -ldflags="-w -s" \
    -o main cmd/server/main.go

# Production stage
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata wget

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/main .

# Copy web assets
COPY --from=builder /app/web ./web

# Copy configuration template
COPY --from=builder /app/portal-config.template.json .

# Set proper permissions
RUN chown -R appuser:appgroup /app && \
    chmod +x /app/main

# Switch to non-root user
USER appuser

# Expose port (Railway will override this)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/health || exit 1

# Run the application
CMD ["./main"] 