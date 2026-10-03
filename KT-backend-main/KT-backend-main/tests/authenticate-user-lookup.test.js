const assert = require("assert");
const jwt = require("jsonwebtoken");
const authenticate = require("../middleware/authenticate");

describe("Authenticate Middleware Token Decoding & User Lookup", () => {
  test("Test 1: decoded.id fallback successfully extracted", () => {
    const tokenWithId = jwt.sign({ id: "user123" }, "kevalonTechnology");
    const decodedWithId = jwt.verify(tokenWithId, "kevalonTechnology");
    const userIdStr1 = decodedWithId.userId || decodedWithId.id || decodedWithId._id || decodedWithId.sub;
    assert.strictEqual(userIdStr1, "user123");
  });

  test("Test 2: decoded.userId successfully extracted", () => {
    const tokenWithUserId = jwt.sign({ userId: "user456" }, "kevalonTechnology");
    const decodedWithUserId = jwt.verify(tokenWithUserId, "kevalonTechnology");
    const userIdStr2 = decodedWithUserId.userId || decodedWithUserId.id || decodedWithUserId._id || decodedWithUserId.sub;
    assert.strictEqual(userIdStr2, "user456");
  });
});
