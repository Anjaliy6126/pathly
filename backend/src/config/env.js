import dotenv from "dotenv";

dotenv.config();

const env = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "fallback-secret-for-dev",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
};

export { env };
