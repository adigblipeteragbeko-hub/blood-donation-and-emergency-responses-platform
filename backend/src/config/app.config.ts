export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '4000', 10),
    env: process.env.NODE_ENV ?? 'development',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'replace-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'replace-me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? '7', 10),
  },
  security: {
    resetTokenTtlMinutes: parseInt(process.env.RESET_TOKEN_TTL_MINUTES ?? '30', 10),
    emailVerificationTtlMinutes: parseInt(process.env.EMAIL_VERIFICATION_TTL_MINUTES ?? '10', 10),
  },
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'no-reply@bloodresponse.local',
  },
});
