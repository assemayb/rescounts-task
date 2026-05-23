import { errorResponse, ok, type ApiResponse } from "../http.js";
import { hashPurchaseRequest } from "../utils/hash.js";
import { withTransaction, type DbClient } from "../store/db.js";
import {
  createTicketRepository,
  type EventState,
  type IdempotencyRecord,
  type PurchaseInput,
  type TicketRepository,
} from "../store/ticketRepository.js";

interface TicketService {
  purchase(input: PurchaseInput): Promise<ApiResponse>;
}

function createTicketService(ticketRepository: TicketRepository): TicketService {
  return {
    async purchase(input: PurchaseInput): Promise<ApiResponse> {
      const requestHash = hashPurchaseRequest(input);


      // start an atomic transaction 
      return withTransaction(async (client) => {
        // Step 1: claim this idempotency key for the request.
        const inserted = await ticketRepository.insertIdempotencyKey(
          client,
          input,
          requestHash,
        );

        // Step 2: if the key exists, return the stored result or reject reuse.
        if (!inserted) {
          return resolveIdempotencyRetry(
            client,
            ticketRepository,
            input,
            requestHash,
          );
        }

        // Step 3: complete the purchase and save its response for retries.
        const response = await completePurchase(client, ticketRepository, input);
        await ticketRepository.saveIdempotencyResponse(client, input, response);
        return response;
      });
    },
  };
}

async function resolveIdempotencyRetry(
  client: DbClient,
  ticketRepository: TicketRepository,
  input: PurchaseInput,
  requestHash: string,
): Promise<ApiResponse> {
  const record = await ticketRepository.findIdempotencyKeyForUpdate(
    client,
    input,
  );

  if (!record) {
    return errorResponse(
      404,
      "event_not_found",
      "The requested event does not exist.",
    );
  }

  if (record.requestHash !== requestHash) {
    return errorResponse(
      409,
      "idempotency_key_reused",
      "This idempotency key was already used with a different request.",
    );
  }

  if (!isCompletedIdempotencyRecord(record)) {
    return errorResponse(
      409,
      "duplicate_request_processing",
      "A matching request is already being processed.",
    );
  }

  return ok(record.responseStatus ?? 200, record.responseBody);
}

async function completePurchase(
  client: DbClient,
  ticketRepository: TicketRepository,
  input: PurchaseInput,
): Promise<ApiResponse> {
  // Step 4: lock the seat before checking or changing sale state.
  const seat = await ticketRepository.findSeatForUpdate(client, input);

  if (!seat) {
    return errorResponse(
      404,
      "seat_not_found",
      "The requested seat does not exist for this event.",
    );
  }

  if (seat.status === "sold") {
    return errorResponse(409, "seat_sold", "This seat has already been sold.");
  }

  // Step 5: increment the event count only while capacity remains.
  const eventState = await ticketRepository.incrementSoldCount(
    client,
    input.eventId,
  );

  if (!eventState) {
    return errorResponse(409, "sold_out", "This event is sold out.");
  }

  // Step 6: mark the locked seat as sold.
  await ticketRepository.sellSeat(client, input);

  return sendSuccessResponse(input, eventState);
}

function isCompletedIdempotencyRecord(
  record: IdempotencyRecord,
): boolean {
  return record.status === "completed" && record.responseStatus !== null && record.responseBody !== null;
}

const sendSuccessResponse = (
  input: PurchaseInput,
  eventState: EventState,
): ApiResponse => {

  const response = {
    purchase: {
      eventId: input.eventId,
      seatId: input.seatId,
      userId: input.userId,
      status: "sold",
    },
    event: {
      capacity: eventState.capacity,
      soldCount: eventState.soldCount,
      remaining: eventState.capacity - eventState.soldCount,
    },
  };
  return ok(201, response);
}

export const ticketService = createTicketService(createTicketRepository());
