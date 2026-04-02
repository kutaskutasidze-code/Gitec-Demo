require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5500',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  databaseUrl: process.env.DATABASE_URL,
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'GITEC <noreply@gitec.ge>'
  },
  bog: {
    clientId: process.env.BOG_CLIENT_ID,
    clientSecret: process.env.BOG_CLIENT_SECRET,
    redirectUrl: process.env.BOG_REDIRECT_URL,
    callbackUrl: process.env.BOG_CALLBACK_URL
  }
};
