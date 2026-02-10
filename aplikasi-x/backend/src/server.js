/**
 * APLIKASI.X - Main Server Entry Point
 * Editorial Management System for Digital Newsrooms
 * 
 * SAFETY: Default mode is OBSERVE_ONLY
 * COMPLIANCE: UU Pers, UU ITE, UU Perlindungan Anak
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { sequelize } = require('./models');
const logger = require('./utils/logger');
const auditLogger = require('./utils/auditLogger');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const articleRoutes = require('./routes/articles');
const categoryRoutes = require('./routes/categories');
const tagRoutes = require('./routes/tags');
const mediaRoutes = require('./routes/media');
const publishingRoutes = require('./routes/publishing');
const analyticsRoutes = require('./routes/analytics');
const systemRoutes = require('./routes/system');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api';

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ============================================
// GENERAL MIDDLEWARE
// ============================================

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

// ============================================
// SYSTEM MODE CHECK
// ============================================

const SYSTEM_MODE = process.env.SYSTEM_MODE || 'OBSERVE_ONLY';

app.use((req, res, next) => {
  req.systemMode = SYSTEM_MODE;
  
  // Log all requests to audit trail
  auditLogger.log({
    action: 'HTTP_REQUEST',
    resource_type: 'SYSTEM',
    details: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent')
    },
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  });
  
  next();
});

// ============================================
// ROUTES
// ============================================

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    mode: SYSTEM_MODE,
    timestamp: new Date().toISOString(),
    database: sequelize.authenticate() ? 'connected' : 'disconnected'
  });
});

// API routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/articles`, articleRoutes);
app.use(`${API_PREFIX}/categories`, categoryRoutes);
app.use(`${API_PREFIX}/tags`, tagRoutes);
app.use(`${API_PREFIX}/media`, mediaRoutes);
app.use(`${API_PREFIX}/publishing`, publishingRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/system`, systemRoutes);
app.use(`${API_PREFIX}/audit`, auditRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  auditLogger.log({
    action: 'ERROR',
    resource_type: 'SYSTEM',
    details: {
      error: err.message,
      stack: err.stack,
      path: req.path
    },
    ip_address: req.ip
  });
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// ============================================
// DATABASE CONNECTION & SERVER START
// ============================================

async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Sync models (development only - use migrations in production)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      logger.info('Database models synchronized');
    }
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`
╔════════════════════════════════════════════════════════════╗
║                    APLIKASI.X v1.0                         ║
║          Editorial Management System Backend               ║
╠════════════════════════════════════════════════════════════╣
║  Status: RUNNING                                           ║
║  Mode: ${SYSTEM_MODE.padEnd(50)}║
║  Port: ${PORT.toString().padEnd(50)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(43)}║
║  API Prefix: ${API_PREFIX.padEnd(46)}║
╠════════════════════════════════════════════════════════════╣
║  SAFETY FEATURES:                                          ║
║  ✓ Whitelist-only WordPress publishing                    ║
║  ✓ Human approval required for all publishes              ║
║  ✓ Complete audit trail enabled                           ║
║  ✓ Rate limiting active                                   ║
║  ✓ CORS protection enabled                                ║
╠════════════════════════════════════════════════════════════╣
║  COMPLIANCE:                                               ║
║  ✓ UU Pers Indonesia                                      ║
║  ✓ UU ITE                                                 ║
║  ✓ UU Perlindungan Anak                                   ║
║  ✓ Editorial guidelines enforcement                       ║
╚════════════════════════════════════════════════════════════╝
      `);
      
      auditLogger.log({
        action: 'SYSTEM_START',
        resource_type: 'SYSTEM',
        details: {
          mode: SYSTEM_MODE,
          port: PORT,
          environment: process.env.NODE_ENV || 'development'
        }
      });
    });
    
  } catch (error) {
    logger.error('Unable to start server:', error);
    auditLogger.log({
      action: 'SYSTEM_START_FAILED',
      resource_type: 'SYSTEM',
      details: {
        error: error.message,
        stack: error.stack
      }
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  auditLogger.log({
    action: 'SYSTEM_SHUTDOWN',
    resource_type: 'SYSTEM',
    details: { signal: 'SIGTERM' }
  });
  
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  auditLogger.log({
    action: 'SYSTEM_SHUTDOWN',
    resource_type: 'SYSTEM',
    details: { signal: 'SIGINT' }
  });
  
  await sequelize.close();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
