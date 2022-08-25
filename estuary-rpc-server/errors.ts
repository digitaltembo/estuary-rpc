import { HTTP_STATUS_CODES } from "estuary-rpc";

export const DEFAULT_BAD_REQUEST = "Bad Request";
export const DEFAULT_INTERNAL_SERVER_ERROR = "Internal Server Error";
export const DEFAULT_NOT_FOUND = "Page Not Found";
export const DEFAULT_UNAUTHORIZED = "Unauthorized";

export type ErrorResponse = {
  status: "error";
  message: string;
};

export function errorResponse(message: string) {
  return JSON.stringify({
    status: "error",
    message,
  });
}

export function createErrorHandlers(
  respond: (status: number, message?: string) => void
) {
  return {
    badRequest: (message?: string) =>
      respond(
        HTTP_STATUS_CODES.BAD_REQUEST,
        errorResponse(message || DEFAULT_BAD_REQUEST)
      ),
    internalServerError: (message?: string) =>
      respond(
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        errorResponse(message ?? DEFAULT_INTERNAL_SERVER_ERROR)
      ),
  };
}
