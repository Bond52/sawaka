const multer = require("multer");
const { MAX_PROFILE_PHOTO_BYTES } = require("../services/profilePhoto");

/**
 * Memory guard for one validation request. Not a portfolio business maximum.
 * The client sends further photos in another request.
 */
const IMPORT_BATCH_FILES = 30;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROFILE_PHOTO_BYTES, files: IMPORT_BATCH_FILES },
});

function importPhotoUpload(req, res, next) {
  upload.array("photos", IMPORT_BATCH_FILES)(req, res, (err) => {
    if (!err) return next();
    const code =
      err.code === "LIMIT_FILE_SIZE"
        ? "IMAGE_TOO_LARGE"
        : err.code === "LIMIT_FILE_COUNT"
          ? "TOO_MANY_FILES"
          : "INVALID_IMAGE";
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", fields: { photos: code } },
    });
  });
}

module.exports = { importPhotoUpload, IMPORT_BATCH_FILES };
