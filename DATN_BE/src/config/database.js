const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "DATN";

let client;
let db;

async function connectToDatabase() {
  if (db) {
    return db;
  }

  if (!uri) {
    throw new Error("Missing MONGODB_URI in environment variables.");
  }

  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  db = client.db(dbName);

  // Ensure users email is unique for authentication.
  await db.collection("users").createIndex({ email: 1 }, { unique: true });

  console.log(`Connected to MongoDB database: ${dbName}`);
  return db;
}

function getDatabase() {
  if (!db) {
    throw new Error("Database is not connected. Call connectToDatabase() first.");
  }

  return db;
}

async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = {
  connectToDatabase,
  getDatabase,
  closeDatabase,
};
