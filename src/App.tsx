import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import "./App.css";

const SERVER_URL = "http://localhost:3001";
const ROOM_ID = "flam-room";

interface DrawData {
  roomId: string;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  color: string;
  brushSize: number;
  tool: "brush" | "eraser";
}

interface CursorData {
  userId: string;
  x: number;
  y: number;
}

interface RemoteCursor {
  x: number;
  y: number;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);

  const [tool, setTool] =
    useState<"brush" | "eraser">("brush");

  const [isDrawing, setIsDrawing] =
    useState(false);

  const [connected, setConnected] =
    useState(false);

  const [users, setUsers] =
    useState(1);

  const [cursors, setCursors] =
    useState<Record<string, RemoteCursor>>({});

  const lastPosition = useRef({
    x: 0,
    y: 0,
  });

  // -----------------------------
  // SOCKET CONNECTION
  // -----------------------------

  useEffect(() => {
    const socket = io(SERVER_URL);

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(
        "Connected:",
        socket.id
      );

      setConnected(true);

      socket.emit(
        "join-room",
        ROOM_ID
      );
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    // Another user joined
    socket.on("user-joined", () => {
      setUsers((current) => current + 1);
    });

    // Another user left
    socket.on(
      "user-left",
      (userId: string) => {
        setUsers((current) =>
          Math.max(1, current - 1)
        );

        setCursors((current) => {
          const updated = { ...current };

          delete updated[userId];

          return updated;
        });
      }
    );

    // Receive drawing
    socket.on(
      "draw",
      (data: DrawData) => {
        drawLine(
          data.previousX,
          data.previousY,
          data.x,
          data.y,
          data.color,
          data.brushSize,
          data.tool
        );
      }
    );

    // Receive cursor
    socket.on(
      "cursor-move",
      (data: CursorData) => {
        setCursors((current) => ({
          ...current,
          [data.userId]: {
            x: data.x,
            y: data.y,
          },
        }));
      }
    );

    // Receive clear
    socket.on(
      "clear-canvas",
      () => {
        clearCanvas();
      }
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  // -----------------------------
  // CANVAS SETUP
  // -----------------------------

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    canvas.width =
      window.innerWidth;

    canvas.height =
      window.innerHeight - 70;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  // -----------------------------
  // DRAW LINE
  // -----------------------------

  function drawLine(
    previousX: number,
    previousY: number,
    x: number,
    y: number,
    lineColor: string,
    size: number,
    drawingTool: "brush" | "eraser"
  ) {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;

    ctx.beginPath();

    ctx.moveTo(
      previousX,
      previousY
    );

    ctx.lineTo(x, y);

    ctx.strokeStyle =
      drawingTool === "eraser"
        ? "#ffffff"
        : lineColor;

    ctx.lineWidth = size;

    ctx.stroke();

    ctx.closePath();
  }

  // -----------------------------
  // POSITION
  // -----------------------------

  function getPosition(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        e.clientX -
        rect.left,

      y:
        e.clientY -
        rect.top,
    };
  }

  // -----------------------------
  // START DRAWING
  // -----------------------------

  function startDrawing(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    lastPosition.current =
      getPosition(e);

    setIsDrawing(true);
  }

  // -----------------------------
  // DRAW
  // -----------------------------

  function draw(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    const position =
      getPosition(e);

    // Send cursor position
    socketRef.current?.emit(
      "cursor-move",
      {
        roomId: ROOM_ID,
        userId:
          socketRef.current.id,
        x: position.x,
        y: position.y,
      }
    );

    if (!isDrawing) return;

    const previous =
      lastPosition.current;

    // Draw locally
    drawLine(
      previous.x,
      previous.y,
      position.x,
      position.y,
      color,
      brushSize,
      tool
    );

    // Send drawing
    socketRef.current?.emit(
      "draw",
      {
        roomId: ROOM_ID,
        x: position.x,
        y: position.y,
        previousX: previous.x,
        previousY: previous.y,
        color,
        brushSize,
        tool,
      }
    );

    lastPosition.current =
      position;
  }

  // -----------------------------
  // STOP DRAWING
  // -----------------------------

  function stopDrawing() {
    setIsDrawing(false);
  }

  // -----------------------------
  // CLEAR CANVAS
  // -----------------------------

  function clearCanvas() {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
  }

  function handleClear() {
    clearCanvas();

    socketRef.current?.emit(
      "clear-canvas",
      ROOM_ID
    );
  }

  return (
    <div className="app">

      <header className="toolbar">

        <div className="logo">
          FlamBoard
        </div>

        <button
          className={
            tool === "brush"
              ? "active"
              : ""
          }
          onClick={() =>
            setTool("brush")
          }
        >
          🖌 Brush
        </button>

        <button
          className={
            tool === "eraser"
              ? "active"
              : ""
          }
          onClick={() =>
            setTool("eraser")
          }
        >
          🧹 Eraser
        </button>

        <div className="control">
          <span>Color</span>

          <input
            type="color"
            value={color}
            onChange={(e) =>
              setColor(
                e.target.value
              )
            }
          />
        </div>

        <div className="control">
          <span>Size</span>

          <input
            type="range"
            min="1"
            max="30"
            value={brushSize}
            onChange={(e) =>
              setBrushSize(
                Number(
                  e.target.value
                )
              )
            }
          />

          <span>
            {brushSize}
          </span>
        </div>

        <button
          className="clear"
          onClick={handleClear}
        >
          Clear
        </button>

        <div className="users">
          👥 {users}
        </div>

        <div className="room">
          Room: {ROOM_ID}
        </div>

        <div className="connection">

          <span
            className={
              connected
                ? "online-dot"
                : "offline-dot"
            }
          />

          {connected
            ? "Connected"
            : "Connecting..."}

        </div>

      </header>

      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        onPointerDown={
          startDrawing
        }
        onPointerMove={draw}
        onPointerUp={
          stopDrawing
        }
        onPointerLeave={
          stopDrawing
        }
      />

      {/* Remote cursors */}

      {Object.entries(
        cursors
      ).map(
        ([
          userId,
          cursor,
        ]) => (
          <div
            key={userId}
            className="remote-cursor"
            style={{
              left: cursor.x,
              top:
                cursor.y + 70,
            }}
          >
            <div className="cursor-arrow">
              ➤
            </div>

            <span>
              User
            </span>
          </div>
        )
      )}

    </div>
  );
}

export default App;