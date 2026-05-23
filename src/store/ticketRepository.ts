export interface TicketRepository {
  isReady(): boolean;
}

export function createTicketRepository(): TicketRepository {
  return {
    isReady: () => true,
  };
}
