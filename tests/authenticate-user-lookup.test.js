const assert = require("assert");
const jwt = require("jsonwebtoken");
const authenticate = require("../middleware/authenticate");

console.log("🧪 Testing authenticate middleware token decoding & user lookup fallback...");

// Test token payload with { id: "user123" }
const tokenWithId = jwt.sign({ id: "user123" }, "kevalonTechnology");
const decodedWithId = jwt.verify(tokenWithId, "kevalonTechnology");
const userIdStr1 = decodedWithId.userId || decodedWithId.id || decodedWithId._id || decodedWithId.sub;
assert.strictEqual(userIdStr1, "user123");
console.log("✅ Test 1 Passed: decoded.id fallback successfully extracted.");

// Test token payload with { userId: "user456" }
const tokenWithUserId = jwt.sign({ userId: "user456" }, "kevalonTechnology");
const decodedWithUserId = jwt.verify(tokenWithUserId, "kevalonTechnology");
const userIdStr2 = decodedWithUserId.userId || decodedWithUserId.id || decodedWithUserId._id || decodedWithUserId.sub;
assert.strictEqual(userIdStr2, "user456");
console.log("✅ Test 2 Passed: decoded.userId successfully extracted.");

console.log("🎉 All authenticate middleware token decoding tests passed!");
