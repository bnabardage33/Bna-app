import { NextRequest, NextResponse } from "next/server";
import {
  buildSystemPromptContext,
  generateLocalAssistantResponse,
  type AssistantContext,
} from "@/lib/services/bnaAssistantService";

const LLM_TIMEOUT_MS = 12_000;

async function callGroqLlm(systemPrompt: string, userMessage: string, apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_completion_tokens: 700,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiLlm(systemPrompt: string, userMessage: string, apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 700,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      return parts.map((p: { text?: string }) => p.text || "").join("").trim() || null;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const context = body?.context as AssistantContext | undefined;

    if (!message || !context) {
      return NextResponse.json(
        { error: "Message ou contexte manquant" },
        { status: 400 }
      );
    }

    // 1. Générer l'analyse déterministe BNA (intentions d'actions, règles DTU exactes, chiffrage)
    const localResponse = generateLocalAssistantResponse(message, context);

    // 2. Si une clé LLM (Gemini ou Groq) est configurée sur l'environnement et qu'aucune action directe ne suffit
    const geminiKey =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    let llmText: string | null = null;
    const systemPrompt = buildSystemPromptContext(context);

    if (geminiKey) {
      llmText = await callGeminiLlm(systemPrompt, message, geminiKey);
    }
    if (!llmText && groqKey) {
      llmText = await callGroqLlm(systemPrompt, message, groqKey);
    }

    return NextResponse.json({
      content: llmText || localResponse.content,
      actions: localResponse.actions,
      tags: localResponse.tags,
      source: llmText ? "cloud_llm" : "bna_expert_engine",
    });
  } catch (err) {
    console.error("Erreur API Assistant BNA :", err);
    return NextResponse.json(
      { error: "Erreur lors du traitement de la requête par l'Assistant BNA" },
      { status: 500 }
    );
  }
}
