const multer = require("multer");
const { MAX_PROFILE_PHOTO_BYTES } = require("../services/profilePhoto");

/** Guard for one commit. Not a portfolio business maximum. */
const REALIZATION_BATCH_FILES = 60;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROFILE_PHOTO_BYTES, files: REALIZATION_BATCH_FILES },
});

function realizationBatchUpload(req, res, next) {
  upload.array("photos", REALIZATION_BATCH_FILES)(req, res, (err) => {
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

module.exports = { realizationBatchUpload, REALIZATION_BATCH_FILES };
