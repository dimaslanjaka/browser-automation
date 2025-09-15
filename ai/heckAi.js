import '../chunk-BUSYA2B4.js';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';
import { writefile } from 'sbg-utility';
import { extractRelatedQuestions, extractAnswerCodeblock } from './hexkAi-SSE.js';

const SESSION_FILE = path.resolve(".cache/ai/heckAi.session");
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.5",
  "Content-Type": "application/json",
  Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjU5NDBkZGZiLTI0MzYtNGY2MC1iYjU2LTk0ZWNhZDExMjU3YiIsImVtYWlsIjoiZGltYXNsYW5qYWthQGdtYWlsLmNvbSIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3NTAzNzQ1NTEsImV4cCI6MTc1MDk3OTM1MX0.3C4yS65SWCUQBxPfiajX9N6e3LNP9xeyTMBplkcBUTk",
  "Alt-Used": "api.heckai.weight-wave.com",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site",
  Priority: "u=0",
  Pragma: "no-cache",
  "Cache-Control": "no-cache"
};
async function createSession(chat_title = "Hello") {
  const sessionUrl = "https://api.heckai.weight-wave.com/api/ha/v1/session/create";
  const res = await fetch(sessionUrl, {
    credentials: "include",
    headers: DEFAULT_HEADERS,
    referrer: "https://heck.ai/",
    body: JSON.stringify({ title: chat_title }),
    method: "POST",
    mode: "cors"
  });
  if (!res.ok) {
    console.error("\u274C Error:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  console.log("\u2705 Response:", data);
  await fs.mkdir(path.dirname(SESSION_FILE), { recursive: true });
  await fs.writeFile(SESSION_FILE, JSON.stringify(data, null, 2), "utf-8");
  fetch(sessionUrl, {
    method: "OPTIONS",
    mode: "cors",
    headers: {
      ...DEFAULT_HEADERS,
      Priority: "u=4"
    },
    credentials: "omit",
    referrer: "https://heck.ai/"
  }).then((res2) => {
    if (res2.ok) console.log("Session connected");
  });
  return data;
}
async function getSavedSession() {
  try {
    const data = await fs.readFile(SESSION_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    console.warn("\u26A0\uFE0F No saved session found.");
    return null;
  }
}
async function getOrCreateSession(chat_title = "Hello") {
  const saved = await getSavedSession();
  if (saved) {
    console.log("\u{1F4E6} Loaded saved session.");
    return saved;
  }
  console.log("\u{1F504} No saved session found. Creating a new one...");
  return await createSession(chat_title);
}
async function sendMessage(sessionId, message, echo = false) {
  const url = "https://api.heckai.weight-wave.com/api/ha/v1/chat";
  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: DEFAULT_HEADERS,
      referrer: "https://heck.ai/",
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        question: message,
        language: "English",
        sessionId,
        previousQuestion: null,
        previousAnswer: null,
        imgUrls: [],
        superSmartMode: false
      }),
      method: "POST",
      mode: "cors"
    });
    const raw = await res.text();
    writefile(".cache/ai/lines.json", raw.split(/\r?\n/));
    if (!res.ok) {
      const error = `HTTP ${res.status} ${res.statusText}`;
      if (echo) console.error("\u274C", error);
      return { status: "error", error, data: raw };
    }
    writefile(".cache/ai/heckAi.response.json", raw);
    const parsed = {
      answer: extractAnswerCodeblock(raw),
      relatedQuestions: extractRelatedQuestions(raw)
    };
    if (echo) {
      console.group("\u{1F9E0} AI Response");
      console.log(`\u{1F4AC} Answer: ${parsed.answer || "(none)"}`);
      if (parsed.relatedQuestions.length) {
        console.log("\u{1F4CE} Related Questions:");
        parsed.relatedQuestions.forEach((q) => console.log("\u2022 \u2729", q));
      }
      console.groupEnd();
    }
    return {
      status: "success",
      data: {
        ...parsed,
        raw
      }
    };
  } catch (err) {
    if (echo) console.error("\u274C Exception:", err.message);
    return { status: "error", error: err.message };
  }
}

export { createSession, getOrCreateSession, getSavedSession, sendMessage };
//# sourceMappingURL=heckAi.js.map
//# sourceMappingURL=heckAi.js.map