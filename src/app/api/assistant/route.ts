import { NextRequest, NextResponse } from "next/server";
import {
  buildSystemPromptContext,
  generateLocalAssistantResponse,
  type AssistantContext,
} from "@/lib/services/bnaAssistantService";

const LLM_TIMEOUT_MS = 18_000;

async function callMistralLlm(systemPrompt: string, userMessage: string, apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const model = process.env.MISTRAL_MODEL || "mistral-small-latest";
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
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
        max_tokens: 1400,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn("Erreur Mistral API:", res.status, err);
      return null;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn("Exception appel Mistral:", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const DEFAULT_GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
];

async function callGroqLlm(
  systemPrompt: string,
  userMessage: string,
  apiKey: string
): Promise<{ text: string; modelUsed: string } | null> {
  const modelsToTry = [
    ...(process.env.GROQ_MODEL ? [process.env.GROQ_MODEL] : []),
    ...DEFAULT_GROQ_MODELS,
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  for (const model of modelsToTry) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
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
          max_completion_tokens: 1800,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn(`Erreur Groq API (${model}):`, res.status, err);
        continue;
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) {
        return { text, modelUsed: model };
      }
    } catch (e) {
      console.warn(`Exception appel Groq (${model}):`, e);
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
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
          temperature: 0.2,
          maxOutputTokens: 1400,
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

/**
 * Détermine si la question nécessite le relais vers le Cloud LLM (Mistral / Gemini)
 * ou si elle peut être traitée instantanément et à 100% en local.
 */
function isComplexOrConversationalQuery(message: string, localResponse: ReturnType<typeof generateLocalAssistantResponse>): boolean {
  const lower = message.toLowerCase();

  // 1. Si le moteur local est tombé sur sa réponse par défaut (aucun pattern exact trouvé)
  if (localResponse.tags.includes("Copilote BNA")) {
    return true;
  }

  // 2. Discussions naturelles, politesse ou questions conversationnelles
  if (
    lower.includes("ça va") ||
    lower.includes("ca va") ||
    lower.includes("comment vas-tu") ||
    lower.includes("comment tu vas") ||
    lower.includes("qui es-tu") ||
    lower.includes("merci") ||
    lower.includes("raconte") ||
    lower.includes("avis")
  ) {
    return true;
  }

  // 3. Demandes d'études techniques détaillées, rédactions complexes ou calculs sur mesure
  if (
    message.length > 90 ||
    lower.includes("étude technique") ||
    lower.includes("etude technique") ||
    lower.includes("calepinage des lames") ||
    lower.includes("prescription") ||
    lower.includes("rédige") ||
    lower.includes("redige") ||
    lower.includes("courrier") ||
    lower.includes("pourquoi") ||
    lower.includes("explique")
  ) {
    return true;
  }

  return false;
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

    // 1. Analyse locale déterministe BNA (détection des actions : RDV, avancement, calepinage, devis)
    const localResponse = generateLocalAssistantResponse(message, context);

    // 2. Vérification des clés Cloud disponibles (Priorité Mistral AI -> Cloud Français RGPD)
    const mistralKey = process.env.MISTRAL_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const hasAnyLlmKey = Boolean(mistralKey || geminiKey || groqKey);

    // 3. Routage intelligent :
    // - Si la requête est simple et parfaitement couverte en local, on répond en local (0ms, 0€, 100% privé).
    // - Si la requête est complexe/technique/ouverte ET qu'une clé est disponible, on sollicite le Cloud LLM.
    const needsCloudLlm = isComplexOrConversationalQuery(message, localResponse);

    if (hasAnyLlmKey && needsCloudLlm) {
      const systemPrompt = buildSystemPromptContext(context);
      let llmText: string | null = null;
      let providerName = "";

      if (mistralKey) {
        llmText = await callMistralLlm(systemPrompt, message, mistralKey);
        if (llmText) providerName = "Mistral AI (Cloud Français RGPD)";
      }
      if (!llmText && geminiKey) {
        llmText = await callGeminiLlm(systemPrompt, message, geminiKey);
        if (llmText) providerName = "Gemini Cloud";
      }
      if (!llmText && groqKey) {
        const groqResult = await callGroqLlm(systemPrompt, message, groqKey);
        if (groqResult) {
          llmText = groqResult.text;
          providerName = `Groq (${groqResult.modelUsed})`;
        }
      }

      if (llmText) {
        return NextResponse.json({
          content: llmText,
          actions: localResponse.actions,
          tags: [providerName, "Étude Approfondie"],
          source: "cloud_llm",
        });
      }
    }

    // 4. Réponse instantanée par le Moteur Local BNA (0 données transmises à l'extérieur)
    return NextResponse.json({
      content: localResponse.content,
      actions: localResponse.actions,
      tags: ["🟢 Moteur Local BNA", ...(localResponse.tags || [])],
      source: "bna_expert_engine",
    });
  } catch (err) {
    console.error("Erreur API Assistant BNA :", err);
    return NextResponse.json(
      { error: "Erreur lors du traitement de la requête par l'Assistant BNA" },
      { status: 500 }
    );
  }
}
