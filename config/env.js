const dotenv = require('dotenv');
const path = require('path');
const { z } = require('zod');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().optional(),
  MONGO_URI: z.string().optional(),
  
  JWT_SECRET: z.string().default('kevalonTechnology'),
  JWT_ACCESS_SECRET: z.string().default('kevalonTechnology'),
  JWT_REFRESH_SECRET: z.string().default('your_jwt_refresh_secret_minimum_32_characters_long'),
  INVITE_TOKEN_EXPIRY_HOURS: z.coerce.number().default(48),

  EMAIL_USER: z.string().optional().or(z.literal('')),
  EMAIL_PASS: z.string().optional().or(z.literal('')),
  SMTP_HOST: z.string().optional().or(z.literal('')),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().or(z.literal('')),
  SMTP_PASS: z.string().optional().or(z.literal('')),
  SMTP_FROM: z.string().default('Kevalon ERP <tilak.kevalon@gmail.com>'),
  
  BREVO_API_KEY: z.string().optional().or(z.literal('')),
  BREVO_REGISTRATION_TEMPLATE_ID: z.coerce.number().optional(),
  BREVO_FORGOT_PASSWORD_TEMPLATE_ID: z.coerce.number().optional(),
  BREVO_SENDER_EMAIL: z.string().default('hr@kevalontechnology.in'),
  BREVO_SENDER_NAME: z.string().default('Kevalon Technology'),

  EMAILJS_SERVICE_ID: z.string().optional().or(z.literal('')),
  EMAILJS_TEMPLATE_ID: z.string().optional().or(z.literal('')),
  EMAILJS_PUBLIC_KEY: z.string().optional().or(z.literal('')),
  EMAILJS_PRIVATE_KEY: z.string().optional().or(z.literal('')),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),

  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173,http://localhost:5000'),
  CLIENT_URL: z.string().default('http://localhost:3000')
}).transform((data) => {
  const uri = data.MONGODB_URI || data.MONGO_URI || 'mongodb://localhost:27017/kt_app';
  return {
    ...data,
    MONGODB_URI: uri,
    MONGO_URI: uri
  };
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Environment configuration validation failed:', result.error.format());
  process.exit(1);
}

module.exports = result.data;
