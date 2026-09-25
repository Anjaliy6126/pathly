import express from "express";
import cors from "cors";

import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import matchingRoutes from "./routes/matching.routes.js";
import studentRoutes from "./routes/student.routes.js";
import skillRoutes from "./routes/skill.routes.js";
import educationRoutes from "./routes/education.routes.js";
import goalRoutes from "./routes/goal.routes.js";
import projectRoutes from "./routes/project.routes.js";

import authRoutes from "./routes/auth.routes.js";
import opportunityRoutes from "./routes/opportunity.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/opportunities", opportunityRoutes);
app.use("/api/matching", matchingRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/students", skillRoutes);
app.use("/api/students", educationRoutes);
app.use("/api", goalRoutes);
app.use("/api/students", projectRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Pathly API is running" });
});

// Basic 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export { app, env };
