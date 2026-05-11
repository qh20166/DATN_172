const { ObjectId } = require("mongodb");
const { getDatabase } = require("../config/database");

const COLLECTION_NAME = "users";

function getUsersCollection() {
  return getDatabase().collection(COLLECTION_NAME);
}

async function findUserByEmail(email) {
  const normalizedEmail = email.toLowerCase().trim();
  return getUsersCollection().findOne({ email: normalizedEmail });
}

async function createUser({ fullName, email, passwordHash, phoneNumber, avatarUrl }) {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedPhoneNumber = String(phoneNumber || "").trim();
  const normalizedAvatarUrl = String(avatarUrl || "").trim();

  const userDocument = {
    fullName: (fullName || "").trim(),
    email: normalizedEmail,
    phoneNumber: normalizedPhoneNumber || null,
    avatarUrl: normalizedAvatarUrl || null,
    passwordHash,
    addresses: [],
    refreshTokenHash: null,
    refreshTokenExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await getUsersCollection().insertOne(userDocument);

  return {
    _id: result.insertedId,
    ...userDocument,
  };
}

async function findUserById(id) {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return getUsersCollection().findOne({ _id: new ObjectId(id) });
}

async function addAddressToUser(userId, { label, address }) {
  if (!ObjectId.isValid(userId)) {
    return null;
  }

  const normalizedLabel = String(label || "").trim().toLowerCase();
  const normalizedAddress = String(address || "").trim();
  const addressDocument = {
    id: new ObjectId().toString(),
    label: normalizedLabel,
    address: normalizedAddress,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await getUsersCollection().updateOne(
    { _id: new ObjectId(userId) },
    {
      $push: {
        addresses: addressDocument,
      },
      $set: {
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) {
    return null;
  }

  return findUserById(userId);
}

async function updateAddressForUser(userId, addressId, { label, address }) {
  if (!ObjectId.isValid(userId)) {
    return null;
  }

  const normalizedAddressId = String(addressId || "").trim();

  if (!normalizedAddressId) {
    return null;
  }

  const now = new Date();
  const setPayload = {
    "addresses.$.updatedAt": now,
    updatedAt: now,
  };

  if (label !== undefined) {
    setPayload["addresses.$.label"] = String(label).trim().toLowerCase();
  }

  if (address !== undefined) {
    setPayload["addresses.$.address"] = String(address).trim();
  }

  const result = await getUsersCollection().updateOne(
    {
      _id: new ObjectId(userId),
      "addresses.id": normalizedAddressId,
    },
    {
      $set: setPayload,
    }
  );

  if (result.matchedCount === 0) {
    return null;
  }

  return findUserById(userId);
}

async function deleteAddressFromUser(userId, addressId) {
  if (!ObjectId.isValid(userId)) {
    return null;
  }

  const normalizedAddressId = String(addressId || "").trim();

  if (!normalizedAddressId) {
    return null;
  }

  const result = await getUsersCollection().updateOne(
    {
      _id: new ObjectId(userId),
      "addresses.id": normalizedAddressId,
    },
    {
      $pull: {
        addresses: {
          id: normalizedAddressId,
        },
      },
      $set: {
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) {
    return null;
  }

  return findUserById(userId);
}

async function updateUserRefreshToken(userId, { refreshTokenHash, refreshTokenExpiresAt }) {
  if (!ObjectId.isValid(userId)) {
    return null;
  }

  const now = new Date();

  const result = await getUsersCollection().updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        refreshTokenHash: refreshTokenHash || null,
        refreshTokenExpiresAt: refreshTokenExpiresAt || null,
        updatedAt: now,
      },
    }
  );

  if (result.matchedCount === 0) {
    return null;
  }

  return true;
}

async function updateUserProfileById(userId, { fullName, email, phoneNumber, avatarUrl }) {
  if (!ObjectId.isValid(userId)) {
    return null;
  }

  const now = new Date();
  const setPayload = {
    updatedAt: now,
  };

  if (fullName !== undefined) {
    setPayload.fullName = String(fullName || "").trim();
  }

  if (email !== undefined) {
    setPayload.email = String(email || "").trim().toLowerCase();
  }

  if (phoneNumber !== undefined) {
    const normalizedPhoneNumber = String(phoneNumber || "").trim();
    setPayload.phoneNumber = normalizedPhoneNumber || null;
  }

  if (avatarUrl !== undefined) {
    const normalizedAvatarUrl = String(avatarUrl || "").trim();
    setPayload.avatarUrl = normalizedAvatarUrl || null;
  }

  const result = await getUsersCollection().updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: setPayload,
    }
  );

  if (result.matchedCount === 0) {
    return null;
  }

  return findUserById(userId);
}

async function updateUserPasswordById(userId, passwordHash) {
  if (!ObjectId.isValid(userId)) {
    return null;
  }

  const result = await getUsersCollection().updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        passwordHash,
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) {
    return null;
  }

  return true;
}

module.exports = {
  addAddressToUser,
  createUser,
  deleteAddressFromUser,
  findUserByEmail,
  findUserById,
  updateUserPasswordById,
  updateUserProfileById,
  updateUserRefreshToken,
  updateAddressForUser,
};
