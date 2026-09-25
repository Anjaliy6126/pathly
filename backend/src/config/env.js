import dotenv from "dotenv";

dotenv.config();

const env = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL || "",
};

export { env };
