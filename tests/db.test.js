const mongoose = require('mongoose');
require('dotenv').config();

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI.replace(/^"|"$/g, ''));
});

afterAll(async () => {
  await mongoose.connection.close();
});

test('Database connection works', async () => {
  expect(mongoose.connection.readyState).toBe(1);
}); 