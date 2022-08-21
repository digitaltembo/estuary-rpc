import { Duplex } from "stream";
import { TextEncoder } from "util";

/**
 * Data Frame Parsing
 *
 * Data passed in WebSockets takes place within a data frame containing
 * - fin: a boolean indicating that the data frameis the end of a complete message
 * - opCode: one of 5 reserved operations
 * - hasMask: a boolean containing whether the payload should be masked by being
 *      XOR'd with a 4-byte repeating mask. The server does not need to transmit
 *      masked payloads, and the client is required to do so.
 * - payloadLength: 7, 16, or 64-bit number indicating the length of the payload
 * - mask: 4-byte number for masking payload, provided by client
 * - payload: the good stuff
 *
 * This section deals with reading and writing the data frames
 *
 */
export type DataFrame = {
  fin: boolean;
  opCode: WsOpCode;
  hasMask?: boolean;
  payload: Uint8Array;
};
export enum WsOpCode {
  CONTINUATION = 0,
  TEXT = 1,
  BINARY = 2,
  CONNECTION_CLOSE = 8,
  PING = 9,
  PONG = 10,
  UNDEFINED = 0xff,
}

function findPayloadLen(data: Buffer, offset: number): [number, number] {
  const first = data[offset] & 0x7f;
  if (first === 126) {
    return [data.readUInt16BE(offset + 1), 2];
  } else if (first === 127) {
    const val = data.readBigUInt64BE(offset + 1);
    if (val > Number.MAX_SAFE_INTEGER) {
      throw new Error("Can't handle that kind of payload");
    }
    return [Number(val), 4];
  }
  return [first, 1];
}

export function parseDataFrame(data: Buffer) {
  let offset = 0;
  const fin = Boolean((data[offset] >> 7) & 1);
  const opCodeInt = data[offset] & 0xf;
  const opCode: WsOpCode | null =
    opCodeInt in WsOpCode ? opCodeInt : WsOpCode.UNDEFINED;

  offset++;

  const hasMask = Boolean((data[offset] >> 7) & 1);

  const [payloadLen, payloadWidth] = findPayloadLen(data, offset);
  offset += payloadWidth;
  const mask: Uint8Array | null = hasMask
    ? data.subarray(offset, offset + 4)
    : null;
  offset += hasMask ? 4 : 0;

  const payload =
    mask !== null
      ? Uint8Array.from(
          data.subarray(offset, offset + payloadLen),
          (maskedByte, index) => maskedByte ^ mask[index % 4]
        )
      : Uint8Array.from(data.subarray(offset, offset + payloadLen));

  return { fin, opCode, hasMask, payloadLen, mask, payload };
}

export function sendDataFrame(socket: Duplex, df: DataFrame) {
  // payload length is encoded in 1, 2, or 4 byte values depending on size
  const sizeBytes =
    df.payload.length < 126
      ? [df.payload.length]
      : df.payload.length < 65536
      ? [126, df.payload.length >> 8, df.payload.length & 0xff]
      : [
          127,
          df.payload.length >> 24,
          (df.payload.length >> 16) & 0xff,
          (df.payload.length >> 8) & 0xff,
        ];
  const out = new Uint8Array(1 + sizeBytes.length + df.payload.length);
  out[0] = (Number(df.fin) << 7) | df.opCode;
  out.set(sizeBytes, 1);
  out.set(df.payload, sizeBytes.length + 1);
  socket.write(out);
}

// the PONG message is the PING message with a PONG opcode
export function sendPongFrame(socket: Duplex, ping: DataFrame) {
  sendDataFrame(socket, { ...ping, opCode: WsOpCode.PONG });
}

export function sendCloseFrame(
  socket: Duplex,
  payload: Uint8Array = new Uint8Array()
) {
  sendDataFrame(socket, {
    fin: true,
    opCode: WsOpCode.CONNECTION_CLOSE,
    payload,
  });
}

export function sendBinaryFrame(
  socket: Duplex,
  payload: Uint8Array = new Uint8Array()
) {
  sendDataFrame(socket, {
    fin: true,
    opCode: WsOpCode.BINARY,
    payload,
  });
}
const encoder = new TextEncoder();

export function sendTextFrame(socket: Duplex, payload: string) {
  sendDataFrame(socket, {
    fin: true,
    opCode: WsOpCode.TEXT,
    payload: encoder.encode(payload),
  });
}
