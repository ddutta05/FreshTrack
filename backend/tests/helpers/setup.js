const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

let replset;

jest.setTimeout(300000);

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret";
  process.env.JWT_EXPIRES_IN = "1d";
  process.env.CLIENT_URL = "http://localhost:5173";

  replset = await MongoMemoryReplSet.create({
    replSet: { count: 1 }
  });

  const uri = replset.getUri();
  await mongoose.connect(uri);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  const deletions = Object.keys(collections).map((key) => collections[key].deleteMany({}));
  await Promise.all(deletions);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replset) {
    await replset.stop();
  }
});
