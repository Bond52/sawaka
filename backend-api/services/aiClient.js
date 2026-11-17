const axios = require("axios");

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 1;

class AiClientError extends Error {
  constructor(code, status = 502, message = code) {
    super(message);
    this.name = "AiClientError";
    this.code = code;
    this.status = status;
  }
}

function providerMode() {
  if (process.env.NODE_ENV === "test" || process.env.CI === "true") {
    return process.env.AI_PROVIDER || "mock";
  }
  return process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "mock");
}

/**
 * Calls an OpenAI-compatible chat completions endpoint and returns parsed JSON content.
 * Keys stay server-side. Retries once on transient failures.
 */
async function chatJson({ system, user, maxTokens = 3500 }) {
  const mode = providerMode();
  if (mode === "mock") {
    throw new AiClientError("AI_MOCK_REQUIRES_INJECTOR", 500);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiClientError("AI_NOT_CONFIGURED", 503);
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const timeout = Number(process.env.AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model,
          temperature: 0.4,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        {
          timeout,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      const content = response.data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new AiClientError("AI_EMPTY_RESPONSE", 502);
      }
      try {
        return JSON.parse(content);
      } catch {
        throw new AiClientError("AI_INVALID_JSON", 502);
      }
    } catch (err) {
      if (err instanceof AiClientError) throw err;
      lastError = err;
      const status = err.response?.status;
      const retryable =
        !status || status === 429 || status >= 500 || err.code === "ECONNABORTED";
      if (!retryable || attempt === MAX_RETRIES) {
        if (err.code === "ECONNABORTED") {
          throw new AiClientError("AI_TIMEOUT", 504);
        }
        throw new AiClientError("AI_PROVIDER_FAILED", 502);
      }
    }
  }
  throw lastError || new AiClientError("AI_PROVIDER_FAILED", 502);
}

module.exports = {
  AiClientError,
  chatJson,
  providerMode,
};
