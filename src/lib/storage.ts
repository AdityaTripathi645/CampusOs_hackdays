import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Storage adapter contract. Swap the local adapter for S3 / GCS / R2 by
 * implementing this interface and selecting it via STORAGE_DRIVER.
 */
export interface StorageAdapter {
  readonly driver: string;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getDownloadUrl?(key: string, fileName: string, mimeType: string): Promise<string | null>;
  exists?(key: string): Promise<boolean>;
  close?(): void;
}

class LocalStorageAdapter implements StorageAdapter {
  readonly driver = "local";
  private readonly root: string;

  constructor(dir: string) {
    this.root = path.resolve(process.cwd(), dir);
  }

  /** Keys are generated server-side, but still guard against path traversal. */
  private resolve(key: string) {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return target;
  }

  async put(key: string, data: Buffer) {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
  }

  async get(key: string) {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }

  async getDownloadUrl() {
    return null;
  }

  async exists(key: string) {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
      throw error;
    }
  }

  close() {}
}

class S3StorageAdapter implements StorageAdapter {
  readonly driver = "s3";
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET is required when STORAGE_DRIVER is s3.");
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
      throw new Error("Set both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
    }
    this.bucket = bucket;
    this.client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  async put(key: string, data: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!response.Body) throw new Error(`S3 object "${key}" has no body.`);
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getDownloadUrl(key: string, fileName: string, mimeType: string) {
    const disposition = mimeType === "application/pdf" ? "inline" : "attachment";
    const encodedFileName = encodeURIComponent(fileName).replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: mimeType,
        ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodedFileName}`,
      }),
      { expiresIn: 300 },
    );
  }

  async exists(key: string) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (typeof error === "object" && error !== null && "$metadata" in error) {
        const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (statusCode === 404) return false;
      }
      throw error;
    }
  }

  close() {
    this.client.destroy();
  }
}

let instance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  switch (driver) {
    case "local":
      instance = new LocalStorageAdapter(process.env.STORAGE_DIR ?? "./storage/uploads");
      return instance;
    case "s3":
      instance = new S3StorageAdapter();
      return instance;
    default:
      throw new Error(`Storage driver "${driver}" is not implemented. See src/lib/storage.ts.`);
  }
}

export function createLocalStorageAdapter(dir = process.env.STORAGE_DIR ?? "./storage/uploads"): StorageAdapter {
  return new LocalStorageAdapter(dir);
}

export function createS3StorageAdapter(): StorageAdapter {
  return new S3StorageAdapter();
}

export function maxUploadBytes() {
  const mb = Number(process.env.MAX_UPLOAD_MB ?? "20");
  return (Number.isFinite(mb) && mb > 0 ? mb : 20) * 1024 * 1024;
}
