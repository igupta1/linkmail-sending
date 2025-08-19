# LinkMail Backend Service

This backend service handles OAuth authentication and email sending for the LinkMail Chrome extension, enabling it to avoid Tier 2 CASA assessment requirements.

## Features

- 🔐 Google OAuth 2.0 authentication
- 📧 Gmail API integration for sending emails
- 🔒 JWT-based session management
- 📊 Email history and statistics
- 🛡️ Security middleware (helmet, rate limiting)
- 🚀 Ready for deployment on Vercel, Heroku, or other platforms

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

- **Google OAuth**: Get credentials from [Google Cloud Console](https://console.cloud.google.com/)
- **JWT Secret**: Generate a secure random string
- **Redirect URI**: Set to your deployed backend URL + `/api/auth/google/callback`

### 3. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `https://your-backend-url.com/api/auth/google/callback`
   - Add your localhost URL for development: `http://localhost:3000/api/auth/google/callback`

5. Configure OAuth consent screen:
   - Add scopes: `gmail.modify`, `userinfo.email`, `userinfo.profile`
   - Add test users (for development)

### 4. Run Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 5. Test Authentication

Visit: `http://localhost:3000/api/auth/google?source=extension`

## API Endpoints

### Authentication

- `GET /api/auth/google` - Start OAuth flow
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/logout` - Logout user

### Email

- `POST /api/email/send` - Send email via Gmail
- `GET /api/email/history` - Get email history
- `GET /api/email/profile` - Get Gmail profile

### User

- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/stats` - Get user statistics
- `DELETE /api/user/account` - Delete user account

## Deployment

### Vercel (Recommended)

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Configure environment variables in Vercel dashboard
4. Update `GOOGLE_REDIRECT_URI` to your Vercel URL

### Heroku

1. Create Heroku app: `heroku create linkmail-backend`
2. Set environment variables: `heroku config:set JWT_SECRET=...`
3. Deploy: `git push heroku main`

### Railway

1. Connect your GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `GOOGLE_REDIRECT_URI` | OAuth redirect URI | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `JWT_EXPIRES_IN` | JWT expiration time | No (default: 7d) |
| `PORT` | Server port | No (default: 3000) |
| `NODE_ENV` | Environment mode | No (default: development) |
| `FRONTEND_URL` | Frontend application URL | No |

## Extension Integration

Update your extension's `backend/backend-api.js` file:

```javascript
// Update the baseURL to your deployed backend
baseURL: 'https://your-backend-url.com'
```

## Security Features

- **Helmet**: Security headers
- **Rate Limiting**: Prevents abuse
- **JWT Tokens**: Secure session management
- **Input Validation**: Request validation
- **CORS**: Controlled cross-origin access

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Project Structure

```
backend-service/
├── index.js              # Main server file
├── middleware/
│   └── auth.js           # Authentication middleware
├── routes/
│   ├── auth.js           # Authentication routes
│   ├── email.js          # Email routes
│   └── user.js           # User routes
├── package.json
├── .env.example
└── README.md
```

## Troubleshooting

### Common Issues

1. **OAuth Error**: Check redirect URI matches exactly
2. **Gmail API Error**: Ensure Gmail API is enabled in Google Cloud Console
3. **Token Issues**: Verify JWT_SECRET is set correctly
4. **CORS Issues**: Check frontend URL is in CORS whitelist

### Debug Mode

Set `NODE_ENV=development` for detailed error messages.

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## License

MIT License - see LICENSE file for details.