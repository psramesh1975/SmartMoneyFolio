"use client";

import { useRef, useState } from "react";
import type { ImportMode, ValidateRowResult } from "@/lib/import/types";

type Step = "mode" | "upload" | "validating" | "review" | "importing" | "done";

export default function ImportExcelModal({
  open,
  onClose,
  title,
  resourceLabelPlural,
  templateHref,
  validateUrl,
  importUrl,
  hideModeChoice = false,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  resourceLabelPlural: string;
  templateHref: string;
  validateUrl: string;
  importUrl: string;
  hideModeChoice?: boolean;
  onImported: (result: unknown, mode: ImportMode) => void;
}) {
  const [step, setStep] = useState<Step>(hideModeChoice ? "upload" : "mode");
  const [mode, setMode] = useState<ImportMode>("append");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ValidateRowResult[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  // Bumped on every reset and every new validate/import request. A fetch's
  // continuation only applies its result if this hasn't moved on since it
  // started — otherwise a slow response from a request the user has already
  // abandoned (closed the modal, picked a different file) can't clobber
  // whatever's on screen now.
  const requestId = useRef(0);

  function reset() {
    requestId.current += 1;
    setStep(hideModeChoice ? "upload" : "mode");
    setMode("append");
    setFileName(null);
    setRows([]);
    setWarning(null);
    setValidateError(null);
    setImportError(null);
    setImportedCount(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const thisRequest = ++requestId.current;
    setFileName(file.name);
    setValidateError(null);
    setStep("validating");

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(validateUrl, { method: "POST", body: form });
      const data = await res.json();
      if (requestId.current !== thisRequest) return; // abandoned since this started
      if (!res.ok) {
        setValidateError(data.error ?? "Couldn't read that file. Try again.");
        setStep("upload");
        return;
      }
      setRows(data.rows ?? []);
      setWarning(data.warning ?? null);
      setStep("review");
    } catch {
      if (requestId.current !== thisRequest) return;
      setValidateError("Couldn't reach the server. Try again.");
      setStep("upload");
    }
  }

  const okRows = rows.filter((r) => r.status === "ok");

  async function handleConfirm() {
    const thisRequest = ++requestId.current;
    setImportError(null);
    setStep("importing");
    try {
      const res = await fetch(importUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, rows: okRows.map((r) => r.data) }),
      });
      const data = await res.json();
      if (requestId.current !== thisRequest) return; // abandoned since this started
      if (!res.ok) {
        setImportError(data.error ?? "The import failed. No changes were made.");
        setStep("review");
        return;
      }
      setImportedCount(okRows.length);
      onImported(data, mode);
      setStep("done");
    } catch {
      if (requestId.current !== thisRequest) return;
      setImportError("Couldn't reach the server. No changes were made.");
      setStep("review");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">{title}</h2>
          <button
            onClick={handleClose}
            className="focus-ring text-sm text-ink-2 hover:text-folio"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        {step === "mode" && (
          <div className="mt-5 space-y-4">
            <p className="text-base text-ink-2">How should this file be applied?</p>
            <label className="flex cursor-pointer items-start gap-2 border border-line p-3">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "append"}
                onChange={() => setMode("append")}
                className="mt-1"
              />
              <span>
                <span className="block text-base font-medium text-ink">Append to existing data</span>
                <span className="block text-sm text-ink-2">
                  Every row in the file is added as a new record. Nothing existing is touched.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 border border-line p-3">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
                className="mt-1"
              />
              <span>
                <span className="block text-base font-medium text-ink">Replace all existing data</span>
                <span className="block text-sm text-coral">
                  All existing {resourceLabelPlural} for your household are deleted first, then the
                  file is imported. This can't be undone.
                </span>
              </span>
            </label>
            <div className="flex justify-end">
              <button
                onClick={() => setStep("upload")}
                className="focus-ring bg-ink px-4 py-2 text-base text-paper hover:bg-ink-2"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {(step === "upload" || step === "validating") && (
          <div className="mt-5 space-y-4">
            <a
              href={templateHref}
              download
              className="focus-ring inline-block text-sm text-folio hover:underline"
            >
              Download template
            </a>
            <div>
              <label className="block text-sm font-medium text-ink-2">Excel file (.xlsx)</label>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                disabled={step === "validating"}
                className="focus-ring mt-1 w-full border border-line bg-white px-2 py-2 text-base text-ink disabled:opacity-60"
              />
            </div>
            {step === "validating" && (
              <p className="text-base text-ink-2">Validating {fileName}…</p>
            )}
            {validateError && <p className="text-base text-coral">{validateError}</p>}
          </div>
        )}

        {(step === "review" || step === "importing") && (
          <div className="mt-5 space-y-4">
            {warning && (
              <p className="border border-amber bg-paper-2 px-3 py-2 text-sm text-ink">{warning}</p>
            )}
            <p className="text-sm text-ink-2">
              {okRows.length} of {rows.length} rows valid.{" "}
              {rows.length - okRows.length > 0 &&
                `${rows.length - okRows.length} row${rows.length - okRows.length === 1 ? "" : "s"} will be skipped.`}
            </p>
            <div className="max-h-64 divide-y divide-line overflow-y-auto border border-line">
              {rows.map((r) => (
                <div key={r.row} className="flex items-start gap-2 px-3 py-2 text-sm">
                  {r.status === "ok" ? (
                    <>
                      <span className="text-growth">✓</span>
                      <span className="text-ink">{r.summary}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-coral">✕</span>
                      <span className="text-coral">{r.error}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            {importError && <p className="text-base text-coral">{importError}</p>}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  requestId.current += 1;
                  setStep(hideModeChoice ? "upload" : "mode");
                  setFileName(null);
                  setRows([]);
                  setWarning(null);
                  setValidateError(null);
                  setImportError(null);
                }}
                className="focus-ring text-sm text-ink-2 hover:text-folio"
              >
                Choose a different file
              </button>
              <button
                onClick={handleConfirm}
                disabled={okRows.length === 0 || step === "importing"}
                className="focus-ring bg-folio px-4 py-2 text-base text-paper hover:bg-folio-light disabled:opacity-60"
              >
                {step === "importing"
                  ? "Importing…"
                  : mode === "replace" && !hideModeChoice
                    ? `Delete existing data and import ${okRows.length} row${okRows.length === 1 ? "" : "s"}`
                    : "Confirm import"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="mt-5 space-y-4">
            <p className="text-base text-ink">
              Imported {importedCount} {resourceLabelPlural}.
            </p>
            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="focus-ring bg-ink px-4 py-2 text-base text-paper hover:bg-ink-2"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
