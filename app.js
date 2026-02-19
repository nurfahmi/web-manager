require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const csrf = require('csurf');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const url = require('url');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdn.tailwindcss.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdn.tailwindcss.com", "fonts.googleapis.com"],
      fontSrc: ["'self'", "cdn.jsdelivr.net", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "ws:", "wss:", "cdn.jsdelivr.net", "cdn.tailwindcss.com"]
    }
  }
}));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Sessions
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
});
app.use(sessionMiddleware);

// CSRF protection
const csrfProtection = csrf();
app.use(csrfProtection);

// Routes
app.use('/', authRoutes);
app.use('/admin', adminRoutes);

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Not Found',
    message: 'The page you are looking for does not exist.',
    user: req.session ? req.session.user : null
  });
});

// Error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', {
      title: 'Forbidden',
      message: 'Invalid CSRF token. Please refresh the page and try again.',
      user: req.session ? req.session.user : null
    });
  }

  console.error('Server error:', err);
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong. Please try again.',
    user: req.session ? req.session.user : null
  });
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for interactive terminal
const wss = new WebSocketServer({ noServer: true });

// Session parser for WebSocket auth
server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  if (pathname !== '/ws/terminal') {
    socket.destroy();
    return;
  }

  // Parse session to check auth — need a mock res with setHeader/getHeader for express-session
  const mockRes = {
    setHeader: () => {},
    getHeader: () => {},
    writeHead: () => {},
    end: () => {}
  };
  sessionMiddleware(request, mockRes, () => {
    if (!request.session || !request.session.user || request.session.user.role !== 'SUPER_ADMIN') {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});

wss.on('connection', (ws, request) => {
  const shell = process.env.SHELL || '/bin/zsh';
  const homeDir = require('os').homedir();

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: homeDir,
    env: { ...process.env, TERM: 'xterm-256color' }
  });

  ptyProcess.onData((data) => {
    try { ws.send(data); } catch (e) {}
  });

  ws.on('message', (msg) => {
    const data = msg.toString();
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
        ptyProcess.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch (e) {}
    ptyProcess.write(data);
  });

  ws.on('close', () => {
    ptyProcess.kill();
  });

  ptyProcess.onExit(() => {
    try { ws.close(); } catch (e) {}
  });
});

// Auto-start cloudflare tunnel if config exists
(async () => {
  try {
    const tunnelService = require('./services/tunnelService');
    const installed = await tunnelService.isInstalled();
    if (!installed) return;

    const config = tunnelService.getConfig();
    if (!config || !config.trim()) return;

    const status = await tunnelService.getStatus();
    if (status.running) {
      console.log('Cloudflare tunnel already running');
      return;
    }

    await tunnelService.startTunnel();
    console.log('Cloudflare tunnel auto-started');
  } catch (err) {
    console.log('Tunnel auto-start skipped:', err.message);
  }
})();

// Start server
server.listen(PORT, () => {
  console.log(`Web Manager running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
