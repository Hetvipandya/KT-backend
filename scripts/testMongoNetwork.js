const net = require("node:net");

const defaultHost = "ac-rvdjzew-shard-00-00.umyenl1.mongodb.net";
const host = process.argv[2] || defaultHost;
const port = 27017;
const timeout = 7000;

console.log(`Testing TCP connection to ${host}:${port}...`);

function testMongoNetwork() {
  const socket = net.createConnection({
    host,
    port,
    timeout
  });

  socket.on("connect", () => {
    console.log("✅ MONGO NETWORK: TCP CONNECTED");
    socket.destroy();
    process.exit(0);
  });

  socket.on("error", (error) => {
    console.error("❌ MONGO NETWORK:", error.code, error.message);
    if (error.code === "EACCES") {
      console.error("💡 DIAGNOSIS: Outbound port 27017 is blocked by your hosting/server firewall (EACCES).");
    } else if (error.code === "ETIMEDOUT") {
      console.error("💡 DIAGNOSIS: Connection timed out. Make sure your IP is whitelisted in MongoDB Atlas Network Access.");
    }
    process.exit(1);
  });

  socket.on("timeout", () => {
    console.error("⏰ MONGO NETWORK: TIMEOUT");
    socket.destroy();
    process.exit(1);
  });
}

testMongoNetwork();
