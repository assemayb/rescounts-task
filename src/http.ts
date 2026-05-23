export interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

export function ok(status: number, body: any): ApiResponse {
  return {
    status,
    body,
  };
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ApiResponse {
  return {
    status,
    body: {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
  };
}
