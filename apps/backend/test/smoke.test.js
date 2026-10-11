const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const backendDir = path.join(__dirname, "..");
const modelDir = path.join(backendDir, "model");

describe("backend smoke", () => {
  it("server.js passes node syntax check", () => {
    execFileSync(process.execPath, ["--check", path.join(backendDir, "server.js")], {
      stdio: "pipe",
    });
  });

  it("model artifacts exist and declare 784-input weights", () => {
    const modelJsonPath = path.join(modelDir, "model.json");
    const shardPath = path.join(modelDir, "group1-shard1of1.bin");
    assert.ok(fs.existsSync(modelJsonPath), "model.json missing");
    assert.ok(fs.existsSync(shardPath), "weights shard missing");

    const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, "utf8"));
    const weights = modelJson.weightsManifest?.[0]?.weights;
    assert.ok(Array.isArray(weights) && weights.length > 0, "weightsManifest empty");
    // First dense kernel must map 784 inputs -> 128 units.
    assert.deepEqual(weights[0].shape, [784, 128]);
  });

  it("predict/raw validation rejects non-784 input", () => {
    const serverSrc = fs.readFileSync(path.join(backendDir, "server.js"), "utf8");
    assert.match(serverSrc, /data\.length !== 784/);
    assert.match(serverSrc, /predict\/raw/);
  });

  it("health endpoint reports model status and version", () => {
    const serverSrc = fs.readFileSync(path.join(backendDir, "server.js"), "utf8");
    assert.match(serverSrc, /app\.get\(["']\/health["']/);
    assert.match(serverSrc, /modelLoaded/);
    const pkg = JSON.parse(fs.readFileSync(path.join(backendDir, "package.json"), "utf8"));
    assert.ok(pkg.version, "backend version missing");
  });
});
