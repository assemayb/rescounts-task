import {
  createTicketRepository,
  type TicketRepository,
} from "../store/ticketRepository.js";

interface PurchaseInput {
  eventId: string;
  body: unknown;
  idempotencyKey: string | undefined;
}

interface PurchaseResult {
  status: number;
  body: unknown;
}

interface TicketService {
  purchase(input: PurchaseInput): Promise<PurchaseResult>;
}

function createTicketService(ticketRepository: TicketRepository): TicketService {
  return {
    async purchase(_input: PurchaseInput): Promise<PurchaseResult> {
      ticketRepository.isReady();

      return {
        status: 501,
        body: {
          error: "not_implemented",
        },
      };
    },
  };
}

export const ticketService = createTicketService(createTicketRepository());
