const {
  changeUserPassword,
  registerUser,
  loginUser,
  getProfile,
  deleteAddress,
  logoutUser,
  refreshUserToken,
  saveAddress,
  updateUserAvatar,
  updateUserProfile,
  updateAddress,
} = require("../services/authService");
const fsp = require("fs/promises");

const PHONE_NUMBER_PATTERN = /^\+?[0-9]{8,15}$/;

async function register(req, res, next) {
  try {
    const { fullName, email, password, phoneNumber } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    const normalizedPhoneNumber = String(phoneNumber || "").trim();
    if (normalizedPhoneNumber && !PHONE_NUMBER_PATTERN.test(normalizedPhoneNumber)) {
      return res.status(400).json({
        message: "Phone number must be 8-15 digits and may start with +.",
      });
    }

    const result = await registerUser({
      fullName,
      email,
      password,
      phoneNumber: normalizedPhoneNumber,
    });

    return res.status(201).json({
      message: "Register successful.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const result = await loginUser({ email, password });

    return res.status(200).json({
      message: "Login successful.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

async function refreshToken(req, res, next) {
  try {
    const normalizedRefreshToken = String(req.body.refreshToken || "").trim();

    if (!normalizedRefreshToken) {
      return res.status(400).json({
        message: "Refresh token is required.",
      });
    }

    const result = await refreshUserToken(normalizedRefreshToken);

    return res.status(200).json({
      message: "Token refreshed successfully.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    const normalizedRefreshToken = String(req.body.refreshToken || "").trim();

    if (!normalizedRefreshToken) {
      return res.status(400).json({
        message: "Refresh token is required.",
      });
    }

    await logoutUser(normalizedRefreshToken);

    return res.status(200).json({
      message: "Logout successful.",
    });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await getProfile(req.auth.userId);

    return res.status(200).json({
      user,
    });
  } catch (error) {
    return next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters.",
      });
    }

    await changeUserPassword(req.auth.userId, {
      currentPassword,
      newPassword,
    });

    return res.status(200).json({
      message: "Password changed successfully.",
    });
  } catch (error) {
    return next(error);
  }
}

async function patchProfile(req, res, next) {
  try {
    const updates = {};

    if (req.body.fullName !== undefined) {
      const normalizedFullName = String(req.body.fullName || "").trim();

      if (!normalizedFullName) {
        return res.status(400).json({
          message: "Full name cannot be empty.",
        });
      }

      updates.fullName = normalizedFullName;
    }

    if (req.body.email !== undefined) {
      const normalizedEmail = String(req.body.email || "").trim().toLowerCase();

      if (!normalizedEmail) {
        return res.status(400).json({
          message: "Email cannot be empty.",
        });
      }

      updates.email = normalizedEmail;
    }

    if (req.body.phoneNumber !== undefined) {
      const normalizedPhoneNumber = String(req.body.phoneNumber || "").trim();

      if (normalizedPhoneNumber && !PHONE_NUMBER_PATTERN.test(normalizedPhoneNumber)) {
        return res.status(400).json({
          message: "Phone number must be 8-15 digits and may start with +.",
        });
      }

      updates.phoneNumber = normalizedPhoneNumber;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "At least one field (fullName, email, phoneNumber) is required.",
      });
    }

    const user = await updateUserProfile(req.auth.userId, updates);

    return res.status(200).json({
      message: "Profile updated successfully.",
      user,
    });
  } catch (error) {
    return next(error);
  }
}

async function patchAvatar(req, res, next) {
  try {
    const shouldRemove = String(req.body.remove || "").toLowerCase() === "true";

    if (shouldRemove) {
      const user = await updateUserAvatar(req.auth.userId, "");

      return res.status(200).json({
        message: "Avatar removed successfully.",
        user,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Avatar image file is required. Use form-data field 'avatar'.",
      });
    }

    const normalizedAvatarUrl = `/uploads/avatars/${req.file.filename}`;

    const user = await updateUserAvatar(req.auth.userId, normalizedAvatarUrl);

    return res.status(200).json({
      message: "Avatar updated successfully.",
      user,
    });
  } catch (error) {
    if (req.file && req.file.path) {
      try {
        await fsp.unlink(req.file.path);
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") {
          console.error("Unable to clean up failed avatar upload:", cleanupError);
        }
      }
    }

    return next(error);
  }
}

async function addAddress(req, res, next) {
  try {
    const { label, address } = req.body;
    const normalizedLabel = String(label || "").trim();
    const normalizedAddress = String(address || "").trim();

    if (!normalizedLabel || !normalizedAddress) {
      return res.status(400).json({
        message: "Label and address are required.",
      });
    }

    const user = await saveAddress(req.auth.userId, {
      label: normalizedLabel,
      address: normalizedAddress,
    });

    return res.status(201).json({
      message: "Address saved successfully.",
      user,
    });
  } catch (error) {
    return next(error);
  }
}

async function patchAddress(req, res, next) {
  try {
    const normalizedAddressId = String(req.params.addressId || "").trim();

    if (!normalizedAddressId) {
      return res.status(400).json({
        message: "Address ID is required.",
      });
    }

    const updates = {};

    if (req.body.label !== undefined) {
      const normalizedLabel = String(req.body.label || "").trim();
      if (!normalizedLabel) {
        return res.status(400).json({
          message: "Label cannot be empty.",
        });
      }
      updates.label = normalizedLabel;
    }

    if (req.body.address !== undefined) {
      const normalizedAddress = String(req.body.address || "").trim();
      if (!normalizedAddress) {
        return res.status(400).json({
          message: "Address cannot be empty.",
        });
      }
      updates.address = normalizedAddress;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "At least one field (label or address) is required.",
      });
    }

    const user = await updateAddress(req.auth.userId, normalizedAddressId, updates);

    return res.status(200).json({
      message: "Address updated successfully.",
      user,
    });
  } catch (error) {
    return next(error);
  }
}

async function removeAddress(req, res, next) {
  try {
    const normalizedAddressId = String(req.params.addressId || "").trim();

    if (!normalizedAddressId) {
      return res.status(400).json({
        message: "Address ID is required.",
      });
    }

    const user = await deleteAddress(req.auth.userId, normalizedAddressId);

    return res.status(200).json({
      message: "Address deleted successfully.",
      user,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  changePassword,
  patchProfile,
  patchAvatar,
  patchAddress,
  register,
  login,
  logout,
  refreshToken,
  me,
  addAddress,
  removeAddress,
};
