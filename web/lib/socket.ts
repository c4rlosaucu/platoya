"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

/**
 * Conexión en tiempo real con el backend (Socket.IO sobre el mismo servidor de la API).
 * El token viaja en el handshake. El servidor decide a qué salas entra el usuario.
 * El evento solo trae { orderId, status, updatedAt }, así que la pantalla vuelve a pedir
 * los datos por REST. Al reconectarse también se sincroniza.
 */
export function useOrderEvents(token: string | null, onChange: () => void) {
  const handler = useRef(onChange);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!token || !base) return;

    const socket = io(base, { auth: { token } });
    let firstConnection = true;

    socket.on("connect", () => {
      setConnected(true);
      if (!firstConnection) handler.current();
      firstConnection = false;
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("order:status", () => handler.current());

    return () => {
      socket.close();
      setConnected(false);
    };
  }, [token]);

  return { connected };
}
