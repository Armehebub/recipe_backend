import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import express from "express";
import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import adminRouter from "./routes/adminRoutes.js";
import userRouter from "./routes/userRoutes.js";
import recipeRouter from "./routes/recipeRoutes.js";
import uploadRouter from "./routes/uploadRoutes.js";

const app = express();
const port = process.env.PORT || 3000;

connectDB();

// Pull allowed CORS origins from .env
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];
// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (!origin) return callback(null, true);
//       if (
//         allowedOrigins.includes(origin) ||
//         allowedOrigins.includes("*") ||
//         (allowedOrigins.length === 0 && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
//       ) {
//         callback(null, true);
//       } else {
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     credentials: true,
//   })
// );

if (process.env.CORS_ORIGIN) {
  const envOrigins = process.env.CORS_ORIGIN
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  allowedOrigins.push(...envOrigins);
}

if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL.trim());
}

// Remove duplicate origins
const uniqueOrigins = [...new Set(allowedOrigins)];

console.log("Allowed CORS Origins:", uniqueOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin
      // Example: Postman, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (uniqueOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Blocked CORS Origin:", origin);

      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));


// Health check
app.get("/health", (req, res) => {
  res.send({ status: "healthy", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/admin", adminRouter);
app.use("/api/user", userRouter);
app.use("/api/recipes", recipeRouter);
app.use("/api/upload", uploadRouter);

app.get("/", (req, res) => {
  res.send("Recipe Management API.");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on http://localhost:${port}`);
});
