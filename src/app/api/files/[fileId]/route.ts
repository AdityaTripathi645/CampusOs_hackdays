import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { getFileForDownload } from "@/services/submissions";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const user = await requireUser();
    await enforceRateLimit(`files:download:user:${user.id}`, 300, 60 * 60 * 1000, "Too many file downloads.");
    const { fileId } = await params;
    const { file } = await getFileForDownload(user, fileId);
    const storage = getStorage();
    const downloadUrl = await storage.getDownloadUrl?.(file.storageKey, file.fileName, file.mimeType);
    if (downloadUrl) {
      const response = NextResponse.redirect(downloadUrl, 302);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    const data = await storage.get(file.storageKey);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": `${file.mimeType === "application/pdf" ? "inline" : "attachment"}; filename="${encodeURIComponent(file.fileName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
