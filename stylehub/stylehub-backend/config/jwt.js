import dotenv from 'dotenv';
dotenv.config();

export const getJwtSecret = () => process.env.JWT_SECRET || 'stylehub_secure_jwt_secret_key_2026';
