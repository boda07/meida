// Dados: exportar (JSON/CSV) e importar (JSON/CSV).
//
// O CSV e' gerado aqui no browser a partir do JSON da API (sem dependencias
// extra no servidor). Importar e' um merge: o servidor junta ao que ja la esta.
import { useState } from "react";
import { useT } from "../i18n/I18nContext.jsx";
import { api } from "../api/client.js";

export function useDados() {
  const t = useT();
  const [exporting, setExporting] = useState(null); // "json" | "csv" | null
  const [exportMsg, setExportMsg] = useState(null);
  const [importFile, setImportFile] = useState(null); // File ou null
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [importError, setImportError] = useState(false);

  // Descarrega a biblioteca + diario em JSON ou CSV.
  async function exportData(format) {
    setExportMsg(null);
    setExporting(format);
    try {
      const { library, diary, exportedAt } = await api.exportData();
      const stamp = (exportedAt || new Date().toISOString()).slice(0, 10);
      let blob;
      let filename;
      if (format === "csv") {
        const cell = (v) => {
          if (v == null) return "";
          const s = String(v);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = (header, rows) =>
          [header.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n");
        const libCsv = csv(
          ["type", "tmdbId", "title", "titleEn", "titleRomaji", "generos", "nota", "media_comunidade", "visto", "watchlist", "atualizado_em", "visto_em"],
          library.map((i) => [
            i.type,
            i.tmdbId,
            i.title,
            i.titleEn,
            i.titleRomaji,
            (i.genres || []).join(" | "),
            i.score,
            i.rating,
            i.watched ? "sim" : "",
            i.watchlist ? "sim" : "",
            i.updatedAt,
            // Vazio = "nao se sabe quando foi visto". **Nunca** se escreve
            // aqui o `updatedAt`: a data do ultimo toque nao e' a data em que a
            // pessoa o viu, e um export/import que as trocasse punha meses e anos
            // errados na timeline do outro PC sem ninguem ter como saber.
            i.watchedAt || "",
          ])
        );
        const diaryCsv = csv(
          ["type", "tmdbId", "title", "temporada", "episodio", "estado", "comecou", "acabou", "atualizado_em"],
          diary.map((d) => [
            d.type,
            d.tmdbId,
            d.title,
            d.season,
            d.episode,
            d.status,
            d.startedAt,
            d.finishedAt,
            d.updatedAt,
          ])
        );
        blob = new Blob(
          [`# biblioteca\r\n${libCsv}\r\n# diario\r\n${diaryCsv}`],
          { type: "text/csv;charset=utf-8" }
        );
        filename = `meida-export-${stamp}.csv`; // i18n: nome de ficheiro, igual nos dois idiomas
      } else {
        blob = new Blob([JSON.stringify({ exportedAt, library, diary }, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        filename = `meida-export-${stamp}.json`; // i18n: nome de ficheiro, igual nos dois idiomas
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMsg(t("Ficheiro descarregado. Vai à pasta de downloads do teu sistema."));
    } catch (e) {
      setExportMsg(e.message || t("Não foi possível exportar."));
    } finally {
      setExporting(null);
    }
  }

  // Le o ficheiro escolhido (JSON ou CSV) como texto para enviar ao backend.
  function onImportPick(e) {
    setImportMsg(null);
    const f = e.target.files?.[0] || null;
    setImportFile(f);
    e.target.value = "";
  }

  // Envia o ficheiro para o backend fazer o merge da library + diario.
  async function runImport() {
    if (!importFile) return;
    setImporting(true);
    setImportMsg(null);
    setImportError(false);
    try {
      const text = await importFile.text();
      let payload;
      const isCsv = importFile.name.toLowerCase().endsWith(".csv") || text.includes("# biblioteca");
      if (isCsv) {
        payload = { format: "csv", text };
      } else {
        const parsed = JSON.parse(text);
        payload = { format: "json", library: parsed.library || [], diary: parsed.diary || [] };
      }
      const d = await api.importData(payload);
      setImportMsg(
        t("Importados {n} títulos e {d} entradas do diário.", {
          n: d.imported.library,
          d: d.imported.diary,
        })
      );
      setImportFile(null);
    } catch (e) {
      setImportMsg(e.message || t("Não foi possível importar."));
      setImportError(true);
    } finally {
      setImporting(false);
    }
  }

  return {
    exporting,
    exportMsg,
    exportData,
    importFile,
    importing,
    importMsg,
    importError,
    onImportPick,
    runImport,
  };
}