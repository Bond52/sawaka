/** No project-wide image limit exists. 2 MB matches a single avatar, not a product gallery. */
const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;

const ALLOWED_PROFILE_PHOTO_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function normalizeMime(mime) {
  if (mime === "image/jpg") return "image/jpeg";
  return typeof mime === "string" ? mime : "";
}

function detectImageMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Returns a field error code, or null when the file is an allowed image.
 * MIME and magic bytes must agree. The extension is ignored.
 */
function profilePhotoIssue(file) {
  if (!file || !file.buffer || file.buffer.length === 0) return "PHOTO_REQUIRED";
  const size = typeof file.size === "number" ? file.size : file.buffer.length;
  if (size > MAX_PROFILE_PHOTO_BYTES || file.buffer.length > MAX_PROFILE_PHOTO_BYTES) {
    return "IMAGE_TOO_LARGE";
  }
  const declared = normalizeMime(file.mimetype);
  const detected = detectImageMime(file.buffer);
  if (!ALLOWED_PROFILE_PHOTO_MIME.has(declared) || detected !== declared) {
    return "UNSUPPORTED_IMAGE_TYPE";
  }
  return null;
}

module.exports = {
  MAX_PROFILE_PHOTO_BYTES,
  ALLOWED_PROFILE_PHOTO_MIME,
  normalizeMime,
  detectImageMime,
  profilePhotoIssue,
};
