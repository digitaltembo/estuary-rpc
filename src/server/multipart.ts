import { IncomingMessage } from "http";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

import { SimpleFile } from "../common/api";

const DISPOS_RX =
  /Content-Disposition: form-data; name="(\w+)"(?:; filename="([\w\.]+)")?/i;
const TYPE_RX = /Content-Type: ([\w\/-]+)/i;

async function openTempFile(name: string) {
  const tempPath = path.join(os.tmpdir(), "estuary-");
  const folder = await fs.mkdtemp(tempPath);
  return await fs.open(path.join(folder, name), "w");
}

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

  async parseHeaderLine(line: string) {
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
  async parseHeader(data: string) {
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
  async completePart(data: string) {
    const offset = this.readingHeader ? await this.parseHeader(data) : 0;
    const restOfContent = data.endsWith(this.terminus)
      ? data.slice(offset, -this.terminus.length)
      : data.slice(offset);
    if (this.simpleFile.name !== undefined) {
      if (this.persistence) {
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
          console.log(`Failed to parse "${this.simpleFile.content}"`);
        }
      }
    }
    this.readingHeader = true;
    this.simpleFile = { content: "" };
    this.file = null;
    this.precedingPartialPart = "";
  }

  async writePart(data: string) {
    const offset = this.readingHeader ? await this.parseHeader(data) : 0;
    if (!this.readingHeader) {
      if (this.persistence && this.simpleFile.contentType) {
        this.file?.write(data.slice(offset));
      } else {
        this.simpleFile.content += data.slice(offset);
      }
    }
  }

  async parse(data: string) {
    if (this.error) {
      return;
    }
    this.buffer += data;
    let currentParts = this.buffer.split(this.boundary);
    const allignedParts = currentParts[currentParts.length - 1] === "";
    for (let i = 0; i < currentParts.length; i++) {
      if (i < currentParts.length + 1 || allignedParts) {
        await this.completePart(currentParts[i]);
      } else {
        await this.writePart(currentParts[i]);
      }
    }

    this.buffer = allignedParts ? "" : currentParts[currentParts.length - 1];
  }

  get() {
    return this.multipartData;
  }
}
