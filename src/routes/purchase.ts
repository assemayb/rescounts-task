import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { ticketService } from "../services/ticket.js";

export const purchaseRouter = Router();

purchaseRouter.post(
  "/:id/purchase",
  asyncHandler(async (request, response) => {
    const result = await ticketService.purchase({
      eventId: request.params.id,
      body: request.body,
      idempotencyKey: request.header("Idempotency-Key"),
    });

    response.status(result.status).json(result.body);
  }),
);
