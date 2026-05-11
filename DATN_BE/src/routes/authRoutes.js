const express = require("express");
const {
	register,
	login,
	logout,
	refreshToken,
	me,
	changePassword,
	patchProfile,
	patchAvatar,
	addAddress,
	patchAddress,
	removeAddress,
} = require("../controllers/authController");
const { authenticateToken } = require("../middlewares/authMiddleware");
const { avatarUploadSingle } = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);
router.get("/me", authenticateToken, me);
router.patch("/profile", authenticateToken, patchProfile);
router.patch("/change-password", authenticateToken, changePassword);
router.patch("/profile/password", authenticateToken, changePassword);
router.patch("/profile/avatar", authenticateToken, avatarUploadSingle, patchAvatar);
router.post("/addresses", authenticateToken, addAddress);
router.patch("/addresses/:addressId", authenticateToken, patchAddress);
router.delete("/addresses/:addressId", authenticateToken, removeAddress);

module.exports = router;
