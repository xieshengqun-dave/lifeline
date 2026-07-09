import { Server } from "socket.io";
import { verifyToken } from "./auth.js";
import { prisma } from "./prisma.js";

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: "*" } });

  io.use((socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth?.token || "");
      socket.data.role = payload.role;
      socket.data.userId = payload.userId;
      socket.data.operatorId = payload.operatorId;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    if (socket.data.role === "operator" && socket.data.operatorId) {
      socket.join(`operator:${socket.data.operatorId}`);
    }

    socket.on("join_booking", async ({ bookingId }, ack) => {
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (!booking) return ack?.({ error: "not_found" });

      const isOwner = socket.data.role === "patient" && booking.userId === socket.data.userId;
      const isAssignedOperator =
        socket.data.role === "operator" && booking.operatorId === socket.data.operatorId;
      if (!isOwner && !isAssignedOperator) return ack?.({ error: "forbidden" });

      socket.join(`booking:${bookingId}`);
      ack?.({ booking });
    });

    socket.on("leave_booking", ({ bookingId }) => {
      socket.leave(`booking:${bookingId}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error("Socket.IO not initialized — call initSocket() first");
  return io;
}

export function emitToBooking(bookingId, event, payload) {
  io?.to(`booking:${bookingId}`).emit(event, payload);
}

export function emitToOperator(operatorId, event, payload) {
  io?.to(`operator:${operatorId}`).emit(event, payload);
}
