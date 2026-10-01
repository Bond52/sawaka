const { detectImageMime, profilePhotoIssue } = require("../../services/profilePhoto");

function jpegBuffer() {
  const buffer = Buffer.alloc(16, 0);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return buffer;
}

describe("profile photo validation", () => {
  it("recognizes jpeg, png and webp magic bytes", () => {
    expect(detectImageMime(jpegBuffer())).toBe("image/jpeg");
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectImageMime(png)).toBe("image/png");
    const webp = Buffer.alloc(12, 0);
    webp.write("RIFF", 0, "ascii");
    webp.write("WEBP", 8, "ascii");
    expect(detectImageMime(webp)).toBe("image/webp");
    expect(detectImageMime(Buffer.from("<svg></svg>"))).toBeNull();
  });

  it("rejects a missing file, a spoofed mime and an oversized buffer", () => {
    expect(profilePhotoIssue(null)).toBe("PHOTO_REQUIRED");
    expect(
      profilePhotoIssue({
        mimetype: "image/png",
        size: 8,
        buffer: Buffer.from("not-image"),
      })
    ).toBe("UNSUPPORTED_IMAGE_TYPE");
    expect(
      profilePhotoIssue({
        mimetype: "image/svg+xml",
        size: jpegBuffer().length,
        buffer: jpegBuffer(),
      })
    ).toBe("UNSUPPORTED_IMAGE_TYPE");
    const big = jpegBuffer();
    expect(
      profilePhotoIssue({
        mimetype: "image/jpeg",
        size: 2 * 1024 * 1024 + 1,
        buffer: big,
      })
    ).toBe("IMAGE_TOO_LARGE");
    expect(
      profilePhotoIssue({
        mimetype: "image/jpg",
        size: jpegBuffer().length,
        buffer: jpegBuffer(),
      })
    ).toBeNull();
  });
});
