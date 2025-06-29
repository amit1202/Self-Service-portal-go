# API Documentation

## Overview

The Self-Service Portal provides a RESTful API for managing user authentication, SDO integration, and Au10tix verification services.

**Base URL**: `https://your-domain.com`  
**Content-Type**: `application/json`

## Authentication

Most endpoints require authentication. Include session cookies or use the login endpoint to authenticate.

## Endpoints

### Authentication

#### POST /api/auth/login
Authenticate a user and create a session.

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

#### POST /api/auth/logout
Logout the current user and destroy the session.

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### GET /api/auth/check
Check if the current user is authenticated.

**Response:**
```json
{
  "authenticated": true,
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

### SDO Integration

#### POST /api/sdo/auth
Authenticate with SDO (Secret Double Octopus).

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "SDO authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### GET /api/sdo/status
Get the current SDO authentication status.

**Response:**
```json
{
  "authenticated": true,
  "baseUrl": "https://example.doubleoctopus.io/admin",
  "email": "user@example.com"
}
```

#### GET /api/sdo/search
Search for users in SDO.

**Query Parameters:**
- `q` (string): Search query (email or name)

**Response:**
```json
{
  "users": [
    {
      "id": 123,
      "displayName": "John Doe",
      "email": "john.doe@example.com",
      "username": "johndoe",
      "status": "ACTIVE"
    }
  ]
}
```

#### POST /api/sdo/invite
Send an SDO invitation to a user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "userId": 123,
  "type": "OCTOPUS"
}
```

**Response:**
```json
{
  "success": true,
  "invitationId": "018fc8bbWanPfJ3hn7P892KD8x4L",
  "octopus_invitationId": "018fc8bbWanPfJ3hn7P892KD8x4LWhaMUj6BYBfcFqvE9b9ZdVF2ejfRBNaL64F1CwJJQq1q",
  "fido_invitationId": "018fc8bbDeUdGjk67R3bF4WBXHkQ"
}
```

#### POST /api/sdo/qr
Generate a QR code for SDO enrollment.

**Request Body:**
```json
{
  "invitationId": "018fc8bbWanPfJ3hn7P892KD8x4LWhaMUj6BYBfcFqvE9b9ZdVF2ejfRBNaL64F1CwJJQq1q"
}
```

**Response:**
```json
{
  "success": true,
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

#### POST /api/sdo/verify-user
Verify the state of a user in SDO.

**Request Body:**
```json
{
  "invitationId": "018fc8bbWanPfJ3hn7P892KD8x4LWhaMUj6BYBfcFqvE9b9ZdVF2ejfRBNaL64F1CwJJQq1q"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "message": "User verified successfully"
}
```

#### GET /api/sdo/portal/check
Check if SDO portal is accessible.

**Response:**
```json
{
  "accessible": true,
  "url": "https://example.doubleoctopus.io"
}
```

#### GET /api/sdo/validate
Validate an SDO invitation ID.

**Query Parameters:**
- `invitationId` (string): The invitation ID to validate

**Response:**
```json
{
  "valid": true,
  "invitationId": "018fc8bbWanPfJ3hn7P892KD8x4L"
}
```

### Verification

#### POST /api/verification/start
Start an Au10tix verification session.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "dateOfBirth": "1990-01-01"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "BE6664EA6F03435A834514A707ABAFBE",
  "verificationUrl": "https://stg.10tix.me/hggZEIraSRDZ9Mh4FVfY",
  "expiresAt": "2025-07-06T10:48:13.481Z"
}
```

#### GET /api/verification/{id}/status
Get the status of a verification session.

**Path Parameters:**
- `id` (string): The verification session ID

**Response:**
```json
{
  "sessionId": "BE6664EA6F03435A834514A707ABAFBE",
  "status": "completed",
  "result": "PASSED",
  "data": {
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-01",
    "documentType": "PASSPORT",
    "documentNumber": "123456789"
  }
}
```

### Configuration

#### GET /config
Get the configuration page (HTML).

#### POST /save-config
Save application configuration.

**Request Body:**
```json
{
  "general": {
    "theme": "dark",
    "default_view": "verification"
  },
  "auth": {
    "sdo_url": "https://example.doubleoctopus.io/admin",
    "sdo_email": "admin@example.com",
    "sdo_password": "password",
    "au10tix_token": "token"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration saved successfully"
}
```

#### GET /get-config
Get current configuration.

**Query Parameters:**
- `section` (string, optional): Configuration section to retrieve
- `include_sensitive` (boolean, optional): Include sensitive data

**Response:**
```json
{
  "general": {
    "theme": "dark",
    "default_view": "verification"
  },
  "auth": {
    "sdo_url": "https://example.doubleoctopus.io/admin",
    "sdo_email": "admin@example.com"
  }
}
```

#### POST /test-sdo-connection
Test SDO connection.

**Response:**
```json
{
  "success": true,
  "message": "SDO connection successful"
}
```

#### POST /test-au10tix-connection
Test Au10tix connection.

**Response:**
```json
{
  "success": true,
  "message": "Au10tix connection successful"
}
```

### Health & Monitoring

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-29T10:00:00Z",
  "version": "1.0.0"
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": true,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API endpoints are subject to rate limiting:
- Authentication endpoints: 5 requests per minute
- SDO endpoints: 10 requests per minute
- Verification endpoints: 3 requests per minute

## Security

- All sensitive endpoints require authentication
- Use HTTPS in production
- Session cookies are used for authentication
- CSRF protection is enabled
- Input validation is performed on all endpoints

## Examples

### Complete User Onboarding Flow

1. **Start verification**
   ```bash
   curl -X POST https://your-domain.com/api/verification/start \
     -H "Content-Type: application/json" \
     -d '{"firstName":"John","lastName":"Doe","email":"john@example.com"}'
   ```

2. **Search for user in SDO**
   ```bash
   curl -X GET "https://your-domain.com/api/sdo/search?q=john@example.com" \
     -H "Cookie: session=your-session-cookie"
   ```

3. **Send SDO invitation**
   ```bash
   curl -X POST https://your-domain.com/api/sdo/invite \
     -H "Content-Type: application/json" \
     -H "Cookie: session=your-session-cookie" \
     -d '{"email":"john@example.com","userId":123,"type":"OCTOPUS"}'
   ```

4. **Verify user state**
   ```bash
   curl -X POST https://your-domain.com/api/sdo/verify-user \
     -H "Content-Type: application/json" \
     -H "Cookie: session=your-session-cookie" \
     -d '{"invitationId":"invitation-id"}'
   ```

---

**Version**: 1.0.0  
**Last Updated**: 2025-06-29 