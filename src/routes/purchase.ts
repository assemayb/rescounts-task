import { Router } from "express";
import { z } from "zod";
import { errorResponse } from "../http.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { ticketService } from "../services/ticket.js";

export const purchaseRouter = Router();

const purchaseBodySchema = z.object({
  userId: z.string().trim().min(1),
  seatId: z.string().trim().min(1),
});

purchaseRouter.post(
  "/:id/purchase",
  asyncHandler(async (request, response) => {
    const idempotencyKey = request.header("Idempotency-Key")?.trim();

    if (!idempotencyKey) {
      const result = errorResponse(
        400,
        "missing_idempotency_key",
        "The Idempotency-Key header is required.",
      );
      response.status(result.status).json(result.body);
      return;
    }

    const body = purchaseBodySchema.safeParse(request.body);

    if (!body.success) {
      const result = errorResponse(
        400,
        "invalid_request",
        "The request body must include non-empty userId and seatId strings.",
        { issues: body.error.issues },
      );
      response.status(result.status).json(result.body);
      return;
    }

    const result = await ticketService.purchase({
      eventId: request.params.id,
      userId: body.data.userId,
      seatId: body.data.seatId,
      idempotencyKey,
    });

    response.status(result.status).json(result.body);
  }),
);
