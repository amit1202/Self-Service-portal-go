# Self-Service Portal

A production-ready Go-based self-service portal that integrates with Secret Double Octopus (SDO) authentication and Au10tix identity verification services.

## 🚀 Features

- **Multi-step Authentication Flow**: Complete user onboarding with identity verification
- **SDO Integration**: Support for both OCTOPUS and FIDO enrollment types
- **Au10tix Verification**: Identity document verification and validation
- **Conditional Authentication**: Smart routing based on enrollment type
- **Modern UI**: Responsive web interface with dark/light themes
- **Production Ready**: Docker support, health checks, and monitoring

## 📋 Prerequisites

- Go 1.21 or higher
- Docker and Docker Compose (for containerized deployment)
- SDO (Secret Double Octopus) account and credentials
- Au10tix API access and token

## 🛠️ Installation

### Option 1: Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd self-service-portal
   ```

2. **Install dependencies**
   ```bash
   go mod download
   ```

3. **Configure the application**
   ```bash
   cp portal-config.template.json portal-config.json
   # Edit portal-config.json with your credentials
   ```

4. **Run the application**
   ```bash
   go run cmd/server/main.go
   ```

### Option 2: Docker Deployment

1. **Clone and configure**
   ```bash
   git clone <repository-url>
   cd self-service-portal
   cp portal-config.template.json portal-config.json
   # Edit portal-config.json with your credentials
   ```

2. **Build and run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Or build manually**
   ```bash
   docker build -t self-service-portal .
   docker run -p 8080:8080 -v $(pwd)/portal-config.json:/app/portal-config.json self-service-portal
   ```

## ⚙️ Configuration

### Configuration File (`portal-config.json`)

```json
{
  "general": {
    "theme": "dark",
    "default_view": "verification",
    "email_notifications": true,
    "browser_notifications": false
  },
  "auth": {
    "au10tix_token": "YOUR_AU10TIX_TOKEN",
    "sdo_url": "YOUR_SDO_URL/admin",
    "sdo_email": "YOUR_SDO_EMAIL",
    "sdo_password": "YOUR_SDO_PASSWORD"
  },
  "api": {
    "au10tix_base_url": "https://eus-api.au10tixservicesstaging.com",
    "sdo_api_url": "https://YOUR_SDO_URL/api",
    "api_timeout": 30,
    "api_retries": 3
  }
}
```

### Environment Variables

Copy `env.production.template` to `.env` and configure:

```bash
# Application Settings
GIN_MODE=release
PORT=8080
SESSION_SECRET=your-super-secret-session-key

# SDO Configuration
SDO_URL=your-sdo-url.com/admin
SDO_EMAIL=your-sdo-email@domain.com
SDO_PASSWORD=your-sdo-password

# Au10tix Configuration
AU10TIX_TOKEN=your-au10tix-token
AU10TIX_BASE_URL=https://eus-api.au10tixservicesstaging.com
```

## 🔐 Security Considerations

### Production Security Checklist

- [ ] Change default session secret
- [ ] Use HTTPS in production
- [ ] Configure proper CORS origins
- [ ] Set up firewall rules
- [ ] Use environment variables for sensitive data
- [ ] Enable CSRF protection
- [ ] Implement rate limiting
- [ ] Set up monitoring and logging

### SSL/TLS Configuration

For production, configure SSL/TLS termination:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📊 Monitoring and Health Checks

### Health Endpoint

The application provides a health check endpoint:

```bash
curl http://localhost:8080/health
```

### Docker Health Check

The Docker container includes automatic health checks:

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Logging

Application logs are written to stdout/stderr and can be collected by your logging system:

```bash
# View logs
docker-compose logs -f self-service-portal

# Or for local deployment
tail -f logs/portal.log
```

## 🔄 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/check` - Check authentication status

### SDO Integration
- `POST /api/sdo/auth` - SDO authentication
- `GET /api/sdo/status` - SDO connection status
- `GET /api/sdo/search` - Search SDO users
- `POST /api/sdo/invite` - Send SDO invitation
- `POST /api/sdo/qr` - Generate QR code
- `POST /api/sdo/verify-user` - Verify user state

### Verification
- `POST /api/verification/start` - Start Au10tix verification
- `GET /api/verification/:id/status` - Check verification status

### Configuration
- `GET /config` - Configuration page
- `POST /save-config` - Save configuration
- `GET /get-config` - Get configuration
- `POST /test-sdo-connection` - Test SDO connection
- `POST /test-au10tix-connection` - Test Au10tix connection

## 🚀 Deployment

### Production Deployment Steps

1. **Prepare the environment**
   ```bash
   # Set production environment
   export GIN_MODE=release
   export SESSION_SECRET=your-production-secret
   ```

2. **Build the application**
   ```bash
   go build -o main cmd/server/main.go
   ```

3. **Configure reverse proxy (nginx)**
   ```bash
   # Copy nginx configuration
   sudo cp nginx.conf /etc/nginx/sites-available/self-service-portal
   sudo ln -s /etc/nginx/sites-available/self-service-portal /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. **Set up systemd service**
   ```bash
   sudo cp self-service-portal.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable self-service-portal
   sudo systemctl start self-service-portal
   ```

### Docker Production Deployment

```bash
# Build production image
docker build -t self-service-portal:latest .

# Run with production settings
docker run -d \
  --name self-service-portal \
  --restart unless-stopped \
  -p 8080:8080 \
  -v $(pwd)/portal-config.json:/app/portal-config.json:ro \
  -v $(pwd)/logs:/app/logs \
  -e GIN_MODE=release \
  -e SESSION_SECRET=your-production-secret \
  self-service-portal:latest
```

## 🧪 Testing

### Run Tests
```bash
go test ./...
```

### Integration Tests
```bash
# Test SDO connection
curl -X POST http://localhost:8080/test-sdo-connection

# Test Au10tix connection
curl -X POST http://localhost:8080/test-au10tix-connection
```

## 📝 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   lsof -ti:8080 | xargs kill -9
   ```

2. **Configuration not loading**
   - Check file permissions
   - Verify JSON syntax
   - Ensure file path is correct

3. **SDO authentication fails**
   - Verify credentials in portal-config.json
   - Check network connectivity
   - Ensure SDO service is accessible

4. **Au10tix verification issues**
   - Verify API token
   - Check API endpoint accessibility
   - Review token expiration

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=debug
go run cmd/server/main.go
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the troubleshooting section

---

**Version**: 1.0.0  
**Last Updated**: 2025-06-29 