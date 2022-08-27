import { HTTP_STATUS_CODES } from "estuary-rpc";

export const DEFAULT_BAD_REQUEST = "Bad Request";
export const DEFAULT_INTERNAL_SERVER_ERROR = "Internal Server Error";
export const DEFAULT_NOT_FOUND = "Page Not Found";
export const DEFAULT_UNAUTHORIZED = "Unauthorized";

/**
 * Errors sent from client to server should be of this type, encoded in JSON
 * @group Server
 */
export type ErrorResponse = {
  status: "error";
  message: string;
};

/**
 * @param message Error Message
 * @returns Common JSON representation used for an error for transmission to the client
 * @group Server
 */
export function errorResponse(message: string) {
  return JSON.stringify({
    status: "error",
    message,
  });
}

/**
 *
 * @param respond Method allowing for a response to the client, obfuscating the underlying transport
 * @returns An object with two methods to be used for returning common errors to the client
 * @group Server
 */
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
