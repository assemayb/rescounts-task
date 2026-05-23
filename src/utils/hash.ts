import crypto from "node:crypto";

interface PurchaseRequestPayload {
  eventId: string;
  userId: string;
  seatId: string;
}

export function hashPurchaseRequest(input: PurchaseRequestPayload): string {
  const payload = JSON.stringify({
    eventId: input.eventId,
    userId: input.userId,
    seatId: input.seatId,
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
}
