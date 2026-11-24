"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { Order } from "@/lib/types";

type PaypalButtonsInstance = {
  render: (container: HTMLElement) => Promise<void>;
  close: () => Promise<void>;
};

type PaypalNamespace = {
  Buttons: (options: {
    style?: { layout?: string; shape?: string; label?: string };
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (error: unknown) => void;
  }) => PaypalButtonsInstance;
};

declare global {
  interface Window {
    paypal?: PaypalNamespace;
  }
}

let sdkPromise: Promise<PaypalNamespace> | null = null;

/** El SDK de PayPal solo se descarga cuando se muestra este componente (en /checkout). */
function loadSdk(clientId: string, currency: string): Promise<PaypalNamespace> {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<PaypalNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`;
    script.async = true;
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal no cargó")));
    script.onerror = () => reject(new Error("No se pudo cargar PayPal"));
    document.head.appendChild(script);
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });

  return sdkPromise;
}

type Props = {
  orderId: string;
  token: string;
  onPaid: (order: Order) => void;
  onMessage: (message: string) => void;
};

export function PaypalButton({ orderId, token, onPaid, onMessage }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let buttons: PaypalButtonsInstance | null = null;

    async function start() {
      try {
        const config = await api<{ clientId: string; currency: string }>("/api/payments/config");
        const paypal = await loadSdk(config.clientId, config.currency);
        if (cancelled || !container.current) return;

        buttons = paypal.Buttons({
          style: { layout: "vertical", shape: "pill", label: "pay" },
          // El backend entrega la orden de PayPal con el total que él mismo calculó.
          async createOrder() {
            try {
              const data = await api<{ paypalOrderId: string }>(`/api/orders/${orderId}/paypal-order`, {
                method: "POST",
                token,
              });
              return data.paypalOrderId;
            } catch (caught) {
              onMessage(caught instanceof ApiError ? caught.message : "No se pudo preparar el pago");
              throw caught;
            }
          },
          // Solo el backend captura y verifica. El navegador no marca nada como pagado.
          async onApprove(data) {
            try {
              const result = await api<{ order: Order }>(`/api/orders/${orderId}/capture`, {
                method: "POST",
                token,
                body: JSON.stringify({ paypalOrderId: data.orderID }),
              });
              onPaid(result.order);
            } catch (caught) {
              onMessage(
                caught instanceof ApiError
                  ? caught.message
                  : "No se pudo confirmar el pago. Puedes intentarlo otra vez.",
              );
            }
          },
          onCancel() {
            onMessage("Cerraste PayPal sin pagar. El pedido sigue pendiente y puedes intentarlo otra vez.");
          },
          onError() {
            onMessage("PayPal tuvo un problema. Puedes intentarlo otra vez.");
          },
        });
        await buttons.render(container.current);
        if (!cancelled) setLoading(false);
      } catch (caught) {
        if (!cancelled) {
          setLoading(false);
          onMessage(caught instanceof ApiError ? caught.message : "No se pudo cargar el botón de PayPal");
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      buttons?.close().catch(() => undefined);
    };
    // onPaid y onMessage cambian en cada render; el botón solo debe crearse una vez por pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, token]);

  return (
    <div>
      {loading ? <p className="text-sm text-stone-600">Cargando PayPal…</p> : null}
      <div ref={container} />
    </div>
  );
}
