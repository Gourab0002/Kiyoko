export type Bencode =
  | number
  | Uint8Array
  | Bencode[]
  | { [key: string]: Bencode };

class BencodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BencodeError";
  }
}

class Reader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  read(): Bencode {
    const marker = this.bytes[this.offset];
    if (marker === undefined) {
      throw new BencodeError("Unexpected end");
    }
    if (marker === 0x64) {
      return this.readDict();
    }
    if (marker === 0x6c) {
      return this.readList();
    }
    if (marker === 0x69) {
      return this.readInt();
    }
    if (marker >= 0x30 && marker <= 0x39) {
      return this.readBytes();
    }
    throw new BencodeError("Invalid marker");
  }

  private readInt(): number {
    this.offset += 1;
    const start = this.offset;
    if (this.offset >= this.bytes.length) {
      throw new BencodeError("Unterminated int");
    }
    if (this.bytes[this.offset] === 0x2d) {
      this.offset += 1;
    }
    const digitsStart = this.offset;
    while (this.bytes[this.offset] !== 0x65) {
      const digit = this.bytes[this.offset];
      if (digit === undefined || digit < 0x30 || digit > 0x39) {
        throw new BencodeError("Bad int");
      }
      this.offset += 1;
    }
    if (this.offset === digitsStart) {
      throw new BencodeError("Bad int");
    }
    const text = new TextDecoder().decode(this.bytes.subarray(start, this.offset));
    this.offset += 1;
    if (!/^-?(?:0|[1-9]\d*)$/.test(text)) {
      throw new BencodeError("Bad int");
    }
    const value = Number(text);
    if (!Number.isSafeInteger(value)) {
      throw new BencodeError("Int too large");
    }
    return value;
  }

  private readBytes(): Uint8Array {
    const start = this.offset;
    while (this.bytes[this.offset] !== 0x3a) {
      const digit = this.bytes[this.offset];
      if (digit === undefined || digit < 0x30 || digit > 0x39) {
        throw new BencodeError("Bad string length");
      }
      this.offset += 1;
    }
    const lengthText = new TextDecoder().decode(this.bytes.subarray(start, this.offset));
    if (!/^(?:0|[1-9]\d*)$/.test(lengthText)) {
      throw new BencodeError("Bad string length");
    }
    const length = Number(lengthText);
    this.offset += 1;
    const end = this.offset + length;
    if (end > this.bytes.length) {
      throw new BencodeError("Short string");
    }
    const slice = this.bytes.subarray(this.offset, end);
    this.offset = end;
    return slice;
  }

  private readList(): Bencode[] {
    this.offset += 1;
    const list: Bencode[] = [];
    while (this.bytes[this.offset] !== 0x65) {
      if (this.offset >= this.bytes.length) {
        throw new BencodeError("Unterminated list");
      }
      list.push(this.read());
    }
    this.offset += 1;
    return list;
  }

  private readDict(): { [key: string]: Bencode } {
    this.offset += 1;
    const dict: { [key: string]: Bencode } = {};
    while (this.bytes[this.offset] !== 0x65) {
      if (this.offset >= this.bytes.length) {
        throw new BencodeError("Unterminated dict");
      }
      const key = new TextDecoder("utf-8").decode(this.readBytes());
      dict[key] = this.read();
    }
    this.offset += 1;
    return dict;
  }
}

export function decodeBencode(bytes: Uint8Array): Bencode {
  return new Reader(bytes).read();
}

function isDict(value: Bencode | undefined): value is { [key: string]: Bencode } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Uint8Array)
  );
}

function textOf(value: Bencode | undefined): string {
  if (!(value instanceof Uint8Array)) {
    return "";
  }
  return new TextDecoder("utf-8").decode(value);
}

function partsOf(value: string): string[] {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..");
}

function asSize(value: Bencode | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

export function torrentEntries(bytes: Uint8Array): { path: string[]; sizeBytes: number }[] | null {
  try {
    const root = decodeBencode(bytes);
    if (!isDict(root) || !isDict(root.info)) {
      return null;
    }

    const info = root.info;
    const nameParts = partsOf(textOf(info.name));
    const entries: { path: string[]; sizeBytes: number }[] = [];

    if (Array.isArray(info.files)) {
      for (const file of info.files) {
        if (!isDict(file) || !Array.isArray(file.path)) {
          continue;
        }
        const path = [
          ...nameParts,
          ...file.path.flatMap((part) => partsOf(textOf(part))),
        ];
        if (path.length === 0) {
          continue;
        }
        entries.push({ path, sizeBytes: asSize(file.length) });
      }
    } else if (nameParts.length > 0) {
      entries.push({ path: nameParts, sizeBytes: asSize(info.length) });
    }

    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
}
