import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./lib/http.js";
import { adminCatalogRouter } from "./routes/admin-catalog.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { brandRouter } from "./routes/brand.routes.js";
import { cartRouter } from "./routes/cart.routes.js";
import { categoryRouter } from "./routes/category.routes.js";
import { adminOrderRouter, myOrderRouter, orderRouter } from "./routes/order.routes.js";
import { myProductRouter, productRouter } from "./routes/product.routes.js";
import { profileRouter } from "./routes/profile.routes.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/products", productRouter);
  app.use("/orders", orderRouter);
  app.use("/me", myProductRouter);
  app.use("/me", profileRouter);
  app.use("/me", myOrderRouter);
  app.use("/categories", categoryRouter);
  app.use("/brands", brandRouter);
  app.use("/cart", cartRouter);
  app.use("/admin", adminCatalogRouter);
  app.use("/admin", adminOrderRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
