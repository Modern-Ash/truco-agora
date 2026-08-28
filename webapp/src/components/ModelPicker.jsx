import React, { useEffect, useId, useState } from "react";
import { getLLMModels } from "../api.js";

const EMPTY_MODELS = [];

// Respaldo inmediato para los CLIs presentes en el entorno de desarrollo.
// El catálogo entregado por la API siempre tiene prioridad porque refleja la
// cuenta y la versión realmente activas al iniciar la app.
const KNOWN_MODELS = {
  claude: ["sonnet", "opus", "haiku", "fable"],
  codex: [
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.3-codex-spark",
  ],
};

export default function ModelPicker({ provider, value, onChange, testid, catalog: liveCatalog }) {
  const inputId = useId().replaceAll(":", "");
  const [catalogState, setCatalogState] = useState(null);
  const [errorState, setErrorState] = useState(null);
  const [customProvider, setCustomProvider] = useState("");

  useEffect(() => {
    if (liveCatalog !== undefined) return undefined;
    let active = true;
    getLLMModels(provider)
      .then((next) => {
        if (active) setCatalogState({ provider, value: next });
      })
      .catch((reason) => {
        if (active) {
          setErrorState({
            provider,
            value: reason.message || "No se pudo consultar el catálogo",
          });
        }
      });
    return () => { active = false; };
  }, [liveCatalog, provider]);

  const catalog = liveCatalog !== undefined
    ? liveCatalog
    : (catalogState?.provider === provider ? catalogState.value : null);
  const error = liveCatalog !== undefined
    ? ""
    : (errorState?.provider === provider ? errorState.value : "");
  const discoveredModels = catalog?.models || EMPTY_MODELS;
  const models = discoveredModels.length > 0
    ? discoveredModels
    : (KNOWN_MODELS[provider] || []);
  const loading = !catalog && !error;
  const isOllama = provider === "ollama";
  const ollamaUnavailable = isOllama
    && Boolean(catalog && (!catalog.available || discoveredModels.length === 0));
  const allowCustomModel = !isOllama && catalog?.allow_custom_model !== false;
  const status = error
    ? `${error}${models.length ? " · Mostrando opciones conocidas." : ""}`
    : catalog?.message || "Consultando modelos disponibles…";
  const usesCustomModel = !isOllama && (
    customProvider === provider
    || models.length === 0
    || Boolean(value && !models.includes(value))
  );

  useEffect(() => {
    if (!isOllama || discoveredModels.length === 0) return;
    if (!value || !discoveredModels.includes(value)) {
      onChange(discoveredModels[0]);
    }
  }, [discoveredModels, isOllama, onChange, value]);

  const manualInput = (
    <input
      id={inputId}
      data-testid={`${testid}-custom`}
      aria-label={`Modelo personalizado de ${provider}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Nombre completo del modelo"
      className="lobby-input"
      autoComplete="off"
    />
  );

  return (
    <div className="model-picker">
      <label className="sr-only" htmlFor={testid}>
        Modelo de {provider}
      </label>
      <select
        id={testid}
        data-testid={testid}
        value={usesCustomModel ? "__custom" : value}
        disabled={(loading && models.length === 0) || ollamaUnavailable}
        onChange={(event) => {
          const next = event.target.value;
          setCustomProvider(next === "__custom" ? provider : "");
          onChange(next === "__custom" ? "" : next);
        }}
        className="lobby-input"
      >
        <option value="" disabled={isOllama}>
          {isOllama ? "Elegí un modelo instalado" : "Modelo predeterminado"}
        </option>
        {models.map((model) => <option key={model} value={model}>{model}</option>)}
        {allowCustomModel && (
          <option value="__custom">
            {models.length ? "Otro modelo…" : "Escribir modelo manualmente…"}
          </option>
        )}
      </select>
      {usesCustomModel && manualInput}
      <p
        className={
          "model-picker__status " +
          (error || (catalog && !catalog.available)
            ? "model-picker__status--warning"
            : "")
        }
        data-testid={`${testid}-status`}
        aria-live="polite"
      >
        {status}
      </p>
    </div>
  );
}
