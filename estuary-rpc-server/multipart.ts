import { IncomingMessage } from "http";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

import { SimpleFile } from "estuary-rpc";

const DISPOS_RX =
  /Content-Disposition: form-data; name="(\w+)"(?:; filename="([\w\.]+)")?/i;
const TYPE_RX = /Content-Type: ([\w\/-]+)/i;

async function openTempFile(name: string) {
  const tempPath = path.join(os.tmpdir(), "estuary-");
  const folder = await fs.mkdtemp(tempPath);
  return await fs.open(path.join(folder, name), "w");
}

/**
 * Class for parsing multipart/form-data encoded data
 *
 * @group Server
 */
export class MultiPartParser {
  private multipartData: Record<string, unknown> = {};

  private readingHeader: boolean = true;
  private boundary: string = "";
  private precedingPartialPart: string = "";
  private buffer: string = "";
  private file: fs.FileHandle | null;
  private simpleFile: SimpleFile = { content: "" };
  private terminus: string = "";

  private error: boolean;

  /**
   * @param req IncomingMessage that will be parsed in a series of chunks
   * @param persistence If true, files will be directly written to disk and returned with a file path.
   * Otherwise, files will be accumulated in memory into strings
   * @param rawStrings If true, non-file formdata will be returned as raw strings instead of parsed as JSON objects
   */
  constructor(
    req: IncomingMessage,
    public persistence?: boolean,
    public rawStrings?: boolean
  ) {
    const [_, boundary] = req.headers["content-type"]?.split("boundary=") ?? [];
    if (!boundary) {
      this.error = true;
    }
    this.boundary = `--${boundary}\r\n`;
    this.terminus = `--${boundary}--\r\n`;
  }

  private async parseHeaderLine(line: string) {
    const dispMatch = DISPOS_RX.exec(line);
    if (dispMatch) {
      this.simpleFile.name = dispMatch[1];
      this.simpleFile.contentType = dispMatch[2] && "application/text";
      return;
    }
    const contentTypeMatch = TYPE_RX.exec(line);
    if (contentTypeMatch) {
      this.simpleFile.contentType = contentTypeMatch[1];
    }
  }
  private async parseHeader(data: string) {
    let offset = -this.precedingPartialPart.length;
    this.precedingPartialPart += data;
    const lines = this.precedingPartialPart.split("\r\n");
    const allignedLines = lines[lines.length - 1] === "";

    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i] == "" && i < lines.length - 1) {
        offset += 2;
        this.readingHeader = false;
        this.precedingPartialPart = "";
        break;
      } else {
        offset += lines[i].length + 2;
        await this.parseHeaderLine(lines[i]);
      }
    }

    if (!this.readingHeader) {
      if (this.simpleFile.contentType && this.persistence) {
        this.file = await openTempFile(this.simpleFile.name ?? "wow");
      }
      return offset;
    }
    if (!allignedLines) {
      this.precedingPartialPart = lines[lines.length - 1];
    }
  }
  private async writePart(data: string) {
    const offset = this.readingHeader ? await this.parseHeader(data) : 0;
    const restOfContent = data.endsWith(this.terminus)
      ? data.slice(offset, -this.terminus.length)
      : data.slice(offset);
    if (this.simpleFile.name !== undefined) {
      if (this.persistence && this.simpleFile.contentType) {
        this.file?.write(restOfContent);
        this.file?.close();
        this.multipartData[this.simpleFile.name ?? ""] = this.simpleFile
          .contentType
          ? this.simpleFile
          : this.simpleFile.content;
      } else {
        try {
          this.simpleFile.content += restOfContent;
          this.simpleFile.content = this.simpleFile.content.trim();
          this.multipartData[this.simpleFile.name ?? ""] = this.simpleFile
            .contentType
            ? this.simpleFile
            : this.rawStrings
            ? this.simpleFile.content
            : JSON.parse(this.simpleFile.content || "null");
        } catch {
          // don't do anything
        }
      }
    }
    this.readingHeader = true;
    this.simpleFile = { content: "" };
    this.file = null;
    this.precedingPartialPart = "";
  }

  /** Parses a packet of information */
  async parse(data: string) {
    if (this.error) {
      return;
    }
    this.buffer += data;
    let currentParts = this.buffer.split(this.boundary);
    const allignedParts = currentParts[currentParts.length - 1] === "";
    for (let i = 0; i < currentParts.length; i++) {
      await this.writePart(currentParts[i]);
    }

    this.buffer = allignedParts ? "" : currentParts[currentParts.length - 1];
  }

  /** Returns the current Record<string, unknown> representing data-parsed so far */
  get() {
    return this.multipartData;
  }
}
