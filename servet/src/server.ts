import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();

app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = 3001;

// Test route
app.get("/", (_req, res) => {
  res.json({
    message: "FlamBoard server is running",
  });
});

// Socket.IO
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // -----------------------------
  // JOIN ROOM
  // -----------------------------

  socket.on("join-room", (roomId: string) => {
    socket.join(roomId);

    console.log(
      `${socket.id} joined room ${roomId}`
    );

    // Tell other users that someone joined
    socket.to(roomId).emit("user-joined", {
      userId: socket.id,
    });
  });

  // -----------------------------
  // DRAWING
  // -----------------------------

  socket.on("draw", (data) => {
    socket
      .to(data.roomId)
      .emit("draw", data);
  });

  // -----------------------------
  // CURSOR
  // -----------------------------

  socket.on("cursor-move", (data) => {
    socket
      .to(data.roomId)
      .emit("cursor-move", data);
  });

  // -----------------------------
  // CLEAR CANVAS
  // -----------------------------

  socket.on(
    "clear-canvas",
    (roomId: string) => {
      socket
        .to(roomId)
        .emit("clear-canvas");
    }
  );

  // -----------------------------
  // DISCONNECT
  // -----------------------------

  socket.on("disconnect", () => {
    console.log(
      "User disconnected:",
      socket.id
    );

    // Tell everyone that this user left
    socket.broadcast.emit(
      "user-left",
      socket.id
    );
  });
});

// -----------------------------
// START SERVER
// -----------------------------

httpServer.listen(PORT, () => {
  console.log(
    `FlamBoard server running on port ${PORT}`
  );
});