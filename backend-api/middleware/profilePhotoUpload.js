const multer = require("multer");
const {
  MAX_PROFILE_PHOTO_BYTES,
  normalizeMime,
  ALLOWED_PROFILE_PHOTO_MIME,
} = require("../services/profilePhoto");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROFILE_PHOTO_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    const mime = normalizeMime(file.mimetype);
    if (ALLOWED_PROFILE_PHOTO_MIME.has(mime)) {
      file.mimetype = mime;
      return cb(null, true);
    }
    const error = new Error("UNSUPPORTED_IMAGE_TYPE");
    error.code = "UNSUPPORTED_IMAGE_TYPE";
    return cb(error);
  },
});

function profilePhotoUpload(req, res, next) {
  upload.single("photo")(req, res, (err) => {
    if (!err) return next();
    const code =
      err.code === "LIMIT_FILE_SIZE"
        ? "IMAGE_TOO_LARGE"
        : err.code === "UNSUPPORTED_IMAGE_TYPE"
          ? "UNSUPPORTED_IMAGE_TYPE"
          : "INVALID_IMAGE";
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", fields: { photo: code } },
    });
  });
}

module.exports = { profilePhotoUpload };
