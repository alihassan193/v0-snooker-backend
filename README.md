# 🎱 Snooker Management System API

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![API Documentation](https://img.shields.io/badge/API-Documentation-blue)](http://localhost:5000/api-docs)

A comprehensive **Snooker Club Management System** API built with Node.js, Express, and MySQL. This system provides complete management capabilities for snooker clubs including multi-club support, player tracking, real-time session management, canteen operations, and detailed reporting.

## 🚀 Features

### 🏢 **Multi-Club Management**
- Create and manage multiple snooker clubs
- Club-specific settings and configurations
- Manager assignment with granular permissions

### 👥 **User Management & Authentication**
- Role-based access control (Super Admin, Sub Admin, Manager)
- JWT-based authentication with refresh tokens
- Granular permissions system

### 🎯 **Player Management**
- Player registration and profile management
- Membership types and tracking
- Player preferences and history
- Visit tracking and analytics

### 🎮 **Game & Session Management**
- Real-time session tracking with accurate time calculations
- Multiple game types (Frames, Century) with flexible pricing
- Session pause/resume functionality
- Live session monitoring

### 🍽️ **Canteen Operations**
- Complete canteen item management
- Session-based ordering system
- Stock management and low-stock alerts
- Standalone canteen sales

### 🧾 **Invoicing & Billing**
- Combined invoicing (games + canteen)
- Multiple payment methods
- Tax calculations and discounts
- Invoice status tracking

### 📊 **Comprehensive Reporting**
- Revenue reports with breakdowns
- Table utilization analytics
- Player behavior analysis
- Canteen performance metrics
- Real-time dashboard

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL with Sequelize ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Documentation**: Swagger/OpenAPI 3.0
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Express Validator
- **Logging**: Winston
- **Testing**: Jest, Supertest

## 📋 Prerequisites

- **Node.js** >= 16.0.0
- **npm** >= 8.0.0
- **MySQL** >= 8.0
- **Git**

## 🚀 Quick Start

### 1. Clone the Repository
\`\`\`bash
git clone https://github.com/yourusername/snooker-management-api.git
cd snooker-management-api
\`\`\`

### 2. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 3. Environment Setup
\`\`\`bash
# Copy environment template
cp .env.example .env

# Edit the .env file with your configuration
nano .env
\`\`\`

### 4. Database Setup
\`\`\`bash
# Create database
mysql -u root -p -e "CREATE DATABASE snooker;"

# The application will automatically sync the database on first run
\`\`\`

### 5. Start the Server
\`\`\`bash
# Development mode
npm run dev

# Production mode
npm start
\`\`\`

### 6. Access the API
- **API Base URL**: \`http://localhost:5000\`
- **API Documentation**: \`http://localhost:5000/api-docs\`
- **Health Check**: \`http://localhost:5000/health\`

## 📁 Project Structure

\`\`\`
snooker-management-api/
├── 📁 config/              # Configuration files
│   ├── auth.config.js      # JWT configuration
│   └── db.config.js        # Database configuration
├── 📁 controllers/         # Route controllers
│   ├── auth.controller.js
│   ├── admin.controller.js
│   ├── club.controller.js
│   ├── player.controller.js
│   ├── session.controller.js
│   ├── canteen.controller.js
│   ├── invoice.controller.js
│   └── report.controller.js
├── 📁 middleware/          # Custom middleware
│   ├── auth.js            # Authentication middleware
│   ├── validation.js      # Input validation
│   └── errorHandler.js    # Error handling
├── 📁 models/             # Sequelize models
│   ├── index.js
│   ├── user.model.js
│   ├── club.model.js
│   ├── player.model.js
│   └── ...
├── 📁 routes/             # API routes
│   ├── index.js
│   ├── auth.routes.js
│   ├── club.routes.js
│   └── ...
├── 📁 utils/              # Utility functions
│   ├── responseHelper.js
│   └── logger.js
├── 📁 tests/              # Test files
├── .env.example           # Environment template
├── .gitignore
├── package.json
├── server.js              # Main server file
└── README.md
\`\`\`

## 🔧 Configuration

### Environment Variables

Create a \`.env\` file in the root directory:

\`\`\`env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=snooker

# JWT Configuration
JWT_SECRET=your_very_long_and_secure_jwt_secret_key_at_least_32_characters
JWT_REFRESH_SECRET=your_very_long_and_secure_refresh_secret_key_at_least_32_characters
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# Security Configuration
BCRYPT_ROUNDS=12
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
\`\`\`

## 📚 API Documentation

### Interactive Documentation
Visit \`http://localhost:5000/api-docs\` for the complete Swagger UI documentation.

### Key Endpoints

#### Authentication
- \`POST /api/auth/signin\` - User login
- \`POST /api/auth/signup\` - User registration
- \`POST /api/auth/refresh-token\` - Refresh access token
- \`GET /api/auth/me\` - Get current user

#### Club Management
- \`GET /api/clubs\` - List clubs
- \`POST /api/clubs\` - Create club
- \`PUT /api/clubs/:id\` - Update club
- \`POST /api/clubs/:id/assign-manager\` - Assign manager

#### Player Management
- \`GET /api/players/search\` - Search players
- \`POST /api/players\` - Register player
- \`GET /api/players/:id\` - Get player details
- \`GET /api/players/:id/history\` - Player history

#### Session Management
- \`POST /api/sessions/start\` - Start game session
- \`GET /api/sessions/active\` - Get active sessions
- \`GET /api/sessions/:id/realtime\` - Real-time session data
- \`PUT /api/sessions/:id/end\` - End session

#### Canteen Operations
- \`GET /api/canteen/items\` - List canteen items
- \`POST /api/canteen/items\` - Add canteen item
- \`POST /api/sessions/canteen-order\` - Add order to session
- \`POST /api/canteen/quick-sale\` - Quick canteen sale

#### Invoicing
- \`POST /api/invoices/from-session\` - Create invoice from session
- \`GET /api/invoices/club/:id\` - Get club invoices
- \`PUT /api/invoices/:id/payment-status\` - Update payment status

#### Reporting
- \`GET /api/reports/club/:id/dashboard\` - Club dashboard
- \`GET /api/reports/club/:id/revenue\` - Revenue report
- \`GET /api/reports/club/:id/table-utilization\` - Table utilization

## 🧪 Testing

### Run Tests
\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
\`\`\`

## 🚀 Deployment

### Using PM2 (Recommended)
\`\`\`bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start server.js --name "snooker-api"

# Monitor
pm2 monit

# View logs
pm2 logs
\`\`\`

### Using Docker
\`\`\`bash
# Build image
docker build -t snooker-api .

# Run container
docker run -p 5000:5000 --env-file .env snooker-api
\`\`\`

## 🔒 Security Features

- **JWT Authentication** with refresh tokens
- **Rate Limiting** to prevent abuse
- **Input Validation** on all endpoints
- **SQL Injection Protection** via Sequelize ORM
- **CORS Configuration** for cross-origin requests
- **Helmet.js** for security headers
- **Password Hashing** with bcrypt

## 📊 Monitoring & Logging

- **Winston Logger** for structured logging
- **Health Check Endpoint** for monitoring
- **Error Tracking** with detailed stack traces
- **Performance Metrics** via middleware

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [API Docs](http://localhost:5000/api-docs)
- **Issues**: [GitHub Issues](https://github.com/yourusername/snooker-management-api/issues)
- **Email**: support@snookermanagement.com

## 🙏 Acknowledgments

- Express.js team for the excellent framework
- Sequelize team for the robust ORM
- All contributors and testers

---

**Made with ❤️ for the Snooker Community**
\`\`\`

```text file="LICENSE"
MIT License

Copyright (c) 2024 Snooker Management System

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
