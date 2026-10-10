/** Same rules as backend-api/services/profilePhoto.js. 2 MB is the only enforced image limit. */
export const MAX_PORTFOLIO_PHOTO_BYTES = 2 * 1024 * 1024;

export const PORTFOLIO_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

export type PhotoIssueCode = "UNSUPPORTED_IMAGE_TYPE" | "IMAGE_TOO_LARGE" | "PHOTO_REQUIRED";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

function declaredMime(type: string): string {
  if (type === "image/jpg") return "image/jpeg";
  return type;
}

/** Local check mirroring profilePhotoIssue. Does not upload the file. */
export async function inspectLocalImage(file: File): Promise<PhotoIssueCode | null> {
  if (!file || file.size === 0) return "PHOTO_REQUIRED";
  if (file.size > MAX_PORTFOLIO_PHOTO_BYTES) return "IMAGE_TOO_LARGE";
  const declared = declaredMime(file.type);
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const detected = detectImageMime(header);
  if (!ALLOWED.has(declared) || detected !== declared) return "UNSUPPORTED_IMAGE_TYPE";
  return null;
}
