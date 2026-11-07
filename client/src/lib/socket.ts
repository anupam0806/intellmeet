import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./api.js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    const token = getAccessToken();
    socketInstance = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      transports: ["websocket", "polling"],
    });

    // Update token before reconnecting if refreshed
    socketInstance.on("connect_error", (err) => {
      if (err.message === "UNAUTHENTICATED") {
        const latestToken = getAccessToken();
        if (latestToken && socketInstance) {
          socketInstance.auth = { token: latestToken };
        }
      }
    });
  } else {
    // Keep auth up to date
    const latestToken = getAccessToken();
    socketInstance.auth = { token: latestToken };
  }

  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
