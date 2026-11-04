/* Configuration de l'IA de Sidekick (Groq). Seul fichier à modifier pour changer de clé ou de modèle. */
window.SIDEKICK_CFG = {
  apiKey: "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",
  endpoint: "https://api.groq.com/openai/v1/chat/completions",
  /* Essayés dans l'ordre : si un modèle est retiré ou indisponible, le suivant prend le relais. */
  models: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "llama-3.1-8b-instant"]
};
