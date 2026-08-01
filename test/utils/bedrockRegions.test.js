const test = require("node:test");
const assert = require("node:assert/strict");

// Requires Node's native TypeScript type-stripping (Node >= 22.6 with
// --experimental-strip-types, on by default in Node 23.6+/24). CI runs Node 24.

test("adjustBedrockModelForRegion maps regions to inference profile geographies", async () => {
  const { adjustBedrockModelForRegion } = await import("../../src/utils/bedrockRegions.ts");

  const id = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
  assert.equal(
    adjustBedrockModelForRegion(id, "us-east-1"),
    "us.anthropic.claude-haiku-4-5-20251001-v1:0"
  );
  assert.equal(
    adjustBedrockModelForRegion(id, "us-west-2"),
    "us.anthropic.claude-haiku-4-5-20251001-v1:0"
  );
  assert.equal(
    adjustBedrockModelForRegion(id, "ca-central-1"),
    "us.anthropic.claude-haiku-4-5-20251001-v1:0"
  );
  assert.equal(
    adjustBedrockModelForRegion(id, "eu-west-2"),
    "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
  );
  assert.equal(
    adjustBedrockModelForRegion(id, "eu-central-1"),
    "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
  );
  assert.equal(
    adjustBedrockModelForRegion(id, "ap-southeast-1"),
    "apac.anthropic.claude-haiku-4-5-20251001-v1:0"
  );
  assert.equal(
    adjustBedrockModelForRegion(id, "ap-northeast-1"),
    "apac.anthropic.claude-haiku-4-5-20251001-v1:0"
  );
});

test("adjustBedrockModelForRegion rewrites geo-prefixed profile IDs", async () => {
  const { adjustBedrockModelForRegion } = await import("../../src/utils/bedrockRegions.ts");

  assert.equal(
    adjustBedrockModelForRegion("us.anthropic.claude-haiku-4-5-20251001-v1:0", "eu-west-2"),
    "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
  );
  assert.equal(
    adjustBedrockModelForRegion("eu.anthropic.claude-sonnet-4-6", "us-east-1"),
    "us.anthropic.claude-sonnet-4-6"
  );
  assert.equal(
    adjustBedrockModelForRegion("apac.anthropic.claude-opus-4-7", "ap-southeast-2"),
    "apac.anthropic.claude-opus-4-7"
  );
});

test("adjustBedrockModelForRegion leaves on-demand and custom IDs untouched", async () => {
  const { adjustBedrockModelForRegion } = await import("../../src/utils/bedrockRegions.ts");

  assert.equal(
    adjustBedrockModelForRegion("openai.gpt-oss-120b-1:0", "eu-west-2"),
    "openai.gpt-oss-120b-1:0"
  );
  assert.equal(adjustBedrockModelForRegion("deepseek.v3.2", "ap-south-1"), "deepseek.v3.2");
  assert.equal(
    adjustBedrockModelForRegion("amazon.nova-lite-v1:0", "eu-west-2"),
    "amazon.nova-lite-v1:0"
  );
  assert.equal(adjustBedrockModelForRegion("", "eu-west-2"), "");
  assert.equal(
    adjustBedrockModelForRegion("arn:aws:bedrock:eu-west-2:123:inference-profile/x", "eu-west-2"),
    "arn:aws:bedrock:eu-west-2:123:inference-profile/x"
  );
});
