import { io } from "socket.io-client";

// In dev, Vite proxy handles /socket.io → localhost:3000.
// In prod, Express serves both frontend and socket.io on the same origin.
// So we connect to the current page origin (empty string = same origin).
export const socket = io(undefined as any, {
  withCredentials: true,
  autoConnect: false, // We will explicitly connect when needed
});

