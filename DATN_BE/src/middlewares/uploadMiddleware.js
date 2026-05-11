const fs = require("fs");
const path = require("path");
const multer = require("multer");

const AVATAR_UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "avatars");
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function ensureAvatarUploadDir() {
  fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    try {
      ensureAvatarUploadDir();
      callback(null, AVATAR_UPLOAD_DIR);
    } catch (error) {
      callback(error);
    }
  },
  filename: (req, file, callback) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = ext.length > 10 ? ".jpg" : ext;
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

function avatarFileFilter(req, file, callback) {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
    const error = new Error("Avatar must be an image file (jpeg, png, webp, gif).");
    error.statusCode = 400;
    callback(error);
    return;
  }

  callback(null, true);
}

const avatarUpload = multer({
  storage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

function avatarUploadSingle(req, res, next) {
  const handler = avatarUpload.single("avatar");

  handler(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Avatar file size must be less than or equal to 2MB.",
      });
    }

    return next(error);
  });
}

module.exports = {
  avatarUploadSingle,
};