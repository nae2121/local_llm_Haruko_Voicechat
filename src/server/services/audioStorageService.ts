import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const audioStorageDir = path.join(process.cwd(), "storage", "audio");

const extensionByMimeType: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/x-wav": "wav",
};

export function extensionForMimeType(mimeType: string) {
  return extensionByMimeType[mimeType.split(";")[0]?.trim()] ?? "bin";
}

export async function saveAudioFile(params: {
  bytes: Buffer;
  mimeType: string;
  prefix: "input" | "output";
}) {
  await mkdir(audioStorageDir, { recursive: true });
  const extension = extensionForMimeType(params.mimeType);
  const fileName = `${params.prefix}-${Date.now()}-${randomUUID()}.${extension}`;
  const filePath = path.join(audioStorageDir, fileName);
  await writeFile(filePath, params.bytes);
  return filePath;
}

export async function readAudioFile(filePath: string) {
  const resolvedPath = path.resolve(filePath);
  const resolvedStorageDir = path.resolve(audioStorageDir);
  if (!resolvedPath.startsWith(resolvedStorageDir + path.sep)) {
    throw new Error("Invalid audio file path.");
  }

  return readFile(resolvedPath);
}
