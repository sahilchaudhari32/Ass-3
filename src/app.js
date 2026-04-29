import express from "express";
import noteRoutes from "./routes/note.routes.js";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Notes API is running",
    data: null
  });
});

app.use("/api/notes", noteRoutes);

export default app;