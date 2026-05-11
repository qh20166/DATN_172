const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const fsp = require("fs/promises");
const path = require("path");
const {
  addAddressToUser,
  createUser,
  deleteAddressFromUser,
  findUserByEmail,
  findUserById,
  updateUserPasswordById,
  updateUserProfileById,
  updateUserRefreshToken,
  updateAddressForUser,
} = require("../models/userModel");

const SALT_ROUNDS = 10;
const PROJECT_ROOT = path.join(__dirname, "..", "..");

function isManagedAvatarPath(avatarUrl) {
  return typeof avatarUrl === "string" && avatarUrl.startsWith("/uploads/avatars/");
}

async function removeLocalAvatarIfManaged(avatarUrl) {
  if (!isManagedAvatarPath(avatarUrl)) {
    return;
  }

  const absoluteFilePath = path.join(PROJECT_ROOT, avatarUrl.replace(/^\//, ""));

  try {
    await fsp.unlink(absoluteFilePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Unable to remove old avatar file:", error);
    }
  }
}

function toPublicUser(user) {
  const addresses = Array.isArray(user.addresses)
    ? user.addresses.map((item) => ({
        id: item.id,
        label: item.label,
        address: item.address,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }))
    : [];

  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber || null,
    avatarUrl: user.avatarUrl || null,
    addresses,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function getAccessTokenSecret() {
  if (!process.env.JWT_SECRET) {
    const error = new Error("Missing JWT_SECRET in environment variables.");
    error.statusCode = 500;
    throw error;
  }

  return process.env.JWT_SECRET;
}

function getRefreshTokenSecret() {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

  if (!refreshSecret) {
    const error = new Error(
      "Missing JWT_REFRESH_SECRET (or JWT_SECRET) in environment variables."
    );
    error.statusCode = 500;
    throw error;
  }

  return refreshSecret;
}

function buildAccessToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      tokenType: "access",
    },
    getAccessTokenSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );
}

function buildRefreshToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      tokenType: "refresh",
      tokenId: crypto.randomUUID(),
    },
    getRefreshTokenSecret(),
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    }
  );
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function getTokenExpiresAt(token) {
  const decodedToken = jwt.decode(token);

  if (!decodedToken || typeof decodedToken !== "object" || !decodedToken.exp) {
    return null;
  }

  return new Date(decodedToken.exp * 1000);
}

async function issueAuthTokens(user) {
  const accessToken = buildAccessToken(user);
  const refreshToken = buildRefreshToken(user);
  const refreshTokenHash = hashToken(refreshToken);
  const refreshTokenExpiresAt = getTokenExpiresAt(refreshToken);

  await updateUserRefreshToken(user._id.toString(), {
    refreshTokenHash,
    refreshTokenExpiresAt,
  });

  return {
    accessToken,
    refreshToken,
  };
}

async function registerUser({ fullName, email, password, phoneNumber }) {
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    const error = new Error("Email already exists.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const newUser = await createUser({
    fullName,
    email,
    passwordHash,
    phoneNumber,
  });
  const tokens = await issueAuthTokens(newUser);

  return {
    user: toPublicUser(newUser),
    ...tokens,
  };
}

async function loginUser({ email, password }) {
  const existingUser = await findUserByEmail(email);

  if (!existingUser) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, existingUser.passwordHash);

  if (!isPasswordValid) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const tokens = await issueAuthTokens(existingUser);

  return {
    user: toPublicUser(existingUser),
    ...tokens,
  };
}

async function refreshUserToken(refreshToken) {
  let payload;

  try {
    payload = jwt.verify(String(refreshToken || ""), getRefreshTokenSecret());
  } catch (error) {
    const unauthorizedError = new Error("Invalid or expired refresh token.");
    unauthorizedError.statusCode = 401;
    throw unauthorizedError;
  }

  if (!payload || payload.tokenType !== "refresh" || !payload.userId) {
    const unauthorizedError = new Error("Invalid or expired refresh token.");
    unauthorizedError.statusCode = 401;
    throw unauthorizedError;
  }

  const user = await findUserById(payload.userId);

  if (!user) {
    const unauthorizedError = new Error("Invalid or expired refresh token.");
    unauthorizedError.statusCode = 401;
    throw unauthorizedError;
  }

  const incomingRefreshTokenHash = hashToken(refreshToken);
  if (!user.refreshTokenHash || user.refreshTokenHash !== incomingRefreshTokenHash) {
    const unauthorizedError = new Error("Invalid or expired refresh token.");
    unauthorizedError.statusCode = 401;
    throw unauthorizedError;
  }

  if (
    user.refreshTokenExpiresAt &&
    new Date(user.refreshTokenExpiresAt).getTime() <= Date.now()
  ) {
    const unauthorizedError = new Error("Invalid or expired refresh token.");
    unauthorizedError.statusCode = 401;
    throw unauthorizedError;
  }

  const tokens = await issueAuthTokens(user);

  return {
    user: toPublicUser(user),
    ...tokens,
  };
}

async function logoutUser(refreshToken) {
  let payload;

  try {
    payload = jwt.verify(String(refreshToken || ""), getRefreshTokenSecret());
  } catch (error) {
    const unauthorizedError = new Error("Invalid or expired refresh token.");
    unauthorizedError.statusCode = 401;
    throw unauthorizedError;
  }

  if (!payload || payload.tokenType !== "refresh" || !payload.userId) {
    const unauthorizedError = new Error("Invalid or expired refresh token.");
    unauthorizedError.statusCode = 401;
    throw unauthorizedError;
  }

  const user = await findUserById(payload.userId);

  if (!user) {
    const unauthorizedError = new Error("Invalid or expired refresh token.");
    unauthorizedError.statusCode = 401;
    throw unauthorizedError;
  }

  const incomingRefreshTokenHash = hashToken(refreshToken);
  if (!user.refreshTokenHash || user.refreshTokenHash !== incomingRefreshTokenHash) {
    const unauthorizedError = new Error("Invalid or expired refresh token.");
    unauthorizedError.statusCode = 401;
    throw unauthorizedError;
  }

  await updateUserRefreshToken(user._id.toString(), {
    refreshTokenHash: null,
    refreshTokenExpiresAt: null,
  });
}

async function getProfile(userId) {
  const user = await findUserById(userId);

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  return toPublicUser(user);
}

async function changeUserPassword(userId, { currentPassword, newPassword }) {
  const existingUser = await findUserById(userId);

  if (!existingUser) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    existingUser.passwordHash
  );

  if (!isCurrentPasswordValid) {
    const error = new Error("Current password is incorrect.");
    error.statusCode = 400;
    throw error;
  }

  const isSamePassword = await bcrypt.compare(newPassword, existingUser.passwordHash);

  if (isSamePassword) {
    const error = new Error("New password must be different from current password.");
    error.statusCode = 400;
    throw error;
  }

  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await updateUserPasswordById(userId, newPasswordHash);

  return true;
}

async function updateUserProfile(userId, { fullName, email, phoneNumber, avatarUrl }) {
  const existingUser = await findUserById(userId);

  if (!existingUser) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  const updates = {};

  if (fullName !== undefined) {
    updates.fullName = String(fullName || "").trim();
  }

  if (email !== undefined) {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (normalizedEmail !== existingUser.email) {
      const userWithSameEmail = await findUserByEmail(normalizedEmail);

      if (userWithSameEmail && userWithSameEmail._id.toString() !== userId) {
        const error = new Error("Email already exists.");
        error.statusCode = 409;
        throw error;
      }
    }

    updates.email = normalizedEmail;
  }

  if (phoneNumber !== undefined) {
    updates.phoneNumber = String(phoneNumber || "").trim();
  }

  if (avatarUrl !== undefined) {
    updates.avatarUrl = String(avatarUrl || "").trim();
  }

  if (Object.keys(updates).length === 0) {
    const error = new Error(
      "At least one field (fullName, email, phoneNumber, avatarUrl) is required."
    );
    error.statusCode = 400;
    throw error;
  }

  const updatedUser = await updateUserProfileById(userId, updates);

  if (!updatedUser) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  return toPublicUser(updatedUser);
}

async function updateUserAvatar(userId, avatarUrl) {
  const existingUser = await findUserById(userId);

  if (!existingUser) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  const updatedUser = await updateUserProfile(userId, { avatarUrl });

  if (existingUser.avatarUrl && existingUser.avatarUrl !== avatarUrl) {
    await removeLocalAvatarIfManaged(existingUser.avatarUrl);
  }

  return updatedUser;
}

async function saveAddress(userId, { label, address }) {
  const user = await addAddressToUser(userId, { label, address });

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  return toPublicUser(user);
}

async function updateAddress(userId, addressId, updates) {
  const existingUser = await findUserById(userId);

  if (!existingUser) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  const updatedUser = await updateAddressForUser(userId, addressId, updates);

  if (!updatedUser) {
    const error = new Error("Address not found.");
    error.statusCode = 404;
    throw error;
  }

  return toPublicUser(updatedUser);
}

async function deleteAddress(userId, addressId) {
  const existingUser = await findUserById(userId);

  if (!existingUser) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  const updatedUser = await deleteAddressFromUser(userId, addressId);

  if (!updatedUser) {
    const error = new Error("Address not found.");
    error.statusCode = 404;
    throw error;
  }

  return toPublicUser(updatedUser);
}

module.exports = {
  changeUserPassword,
  deleteAddress,
  registerUser,
  loginUser,
  getProfile,
  logoutUser,
  refreshUserToken,
  saveAddress,
  updateUserAvatar,
  updateUserProfile,
  updateAddress,
};
