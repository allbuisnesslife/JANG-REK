import { useMemo, useRef, useState } from "react";
import { useApp, useActions } from "../store/store";
import { formatDate } from "../lib/format";
import { todayISO } from "../lib/id";
import { Badge, Card, EmptyState, Field, Modal, PageHeader } from "../components/ui";
import type { CourseDoc, DocKind, SemesterId } from "../types";

const KINDS: { id: DocKind; label: string }[] = [
  { id: "cours", label: "Cours" },
  { id: "fiche", label: "Fiche de révision" },
  { id: "formule", label: "Formules" },
  { id: "definition", label: "Définitions" },
  { id: "pdf", label: "PDF" },
];

type FormState = Omit<CourseDoc, "id" | "createdAt"> & { id?: string };

const emptyForm = (subjectId: string, semester: SemesterId = "S3"): FormState => ({
  id: undefined,
  title: "",
  kind: "cours",
  semester,
  subjectId,
  chapter: "",
  content: "",
  pdfData: undefined,
  pdfName: undefined,
});

export default function Cours() {
  const { data } = useApp();
  const actions = useActions();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(data.subjects[0]?.id ?? ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [fSemester, setFSemester] = useState<"all" | SemesterId>("all");
  const [fSubject, setFSubject] = useState("all");
  const [fKind, setFKind] = useState<"all" | DocKind>("all");
  const [hideAll, setHideAll] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const subjectOf = (id: string) => data.subjects.find((s) => s.id === id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.documents
      .filter((d) => (fSemester === "all" ? true : d.semester === fSemester))
      .filter((d) => (fSubject === "all" ? true : d.subjectId === fSubject))
      .filter((d) => (fKind === "all" ? true : d.kind === fKind))
      .filter((d) =>
        !q
          ? true
          : [d.title, d.chapter, d.content, d.pdfName ?? "", subjectOf(d.subjectId)?.code ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(q)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data.documents, query, fSemester, fSubject, fKind, data.subjects]);

  function openNew() {
    const first = data.subjects[0];
    setForm({ ...emptyForm(first?.id ?? ""), semester: first?.semester ?? "S3" });
    setErrors({});
    setOpen(true);
  }

  function openEdit(d: CourseDoc) {
    setForm({ ...d });
    setErrors({});
    setOpen(true);
  }

  function submit() {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Titre requis.";
    if (!form.subjectId) e.subjectId = "Choisis une matière.";
    if (form.kind !== "pdf" && !form.content.trim()) e.content = "Ajoute le contenu du document.";
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = {
      title: form.title.trim(),
      kind: form.kind,
      semester: form.semester,
      subjectId: form.subjectId,
      chapter: form.chapter.trim(),
      content: form.content.trim(),
      pdfData: form.pdfData,
      pdfName: form.pdfName,
    };

    if (form.id) actions.updateDocument(form.id, payload);
    else actions.addDocument(payload);
    setOpen(false);
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_500_000) {
      setErrors((p) => ({ ...p, pdf: "PDF trop lourd (max 1,5 Mo) pour le stockage local." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, pdfData: String(reader.result), pdfName: file.name, kind: "pdf" }));
      setErrors((p) => ({ ...p, pdf: "" }));
    };
    reader.readAsDataURL(file);
  }

  function relatedSessions(doc: CourseDoc) {
    return data.sessions.filter(
      (s) => s.subjectId === doc.subjectId && s.documentId === doc.id
    );
  }

  const revealedCount = Object.values(revealed).filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title="Mes cours et documents"
        subtitle="Cours, fiches, formules et définitions — classés, recherchables et révisables."
        actions={
          <>
            <button className="btn-ghost" onClick={() => setHideAll((v) => !v)}>
              {hideAll ? "Révéler toutes les réponses" : "Mode révision : masquer les réponses"}
            </button>
            <button className="btn-primary" onClick={openNew}>
              + Ajouter un document
            </button>
          </>
        }
      />

      <div className="card mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Recherche">
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titre, chapitre, mot-clé…" />
        </Field>
        <Field label="Semestre">
          <select className="input" value={fSemester} onChange={(e) => setFSemester(e.target.value as never)}>
            <option value="all">Tous</option>
            <option value="S3">Semestre 3</option>
            <option value="S4">Semestre 4</option>
          </select>
        </Field>
        <Field label="Matière">
          <select className="input" value={fSubject} onChange={(e) => setFSubject(e.target.value)}>
            <option value="all">Toutes</option>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select className="input" value={fKind} onChange={(e) => setFKind(e.target.value as never)}>
            <option value="all">Tous</option>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Aucun document"
          description="Crée ton premier cours, ta première fiche de révision ou importe un PDF pour constituer ta bibliothèque."
          action={
            <button className="btn-primary" onClick={openNew}>
              Ajouter un document
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => {
            const s = subjectOf(d.subjectId);
            const isOpen = !hideAll && revealed[d.id];
            const sessions = relatedSessions(d);
            return (
              <Card key={d.id} className="flex flex-col">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="blue">{KINDS.find((k) => k.id === d.kind)?.label}</Badge>
                      <Badge tone="slate">{d.semester}</Badge>
                    </div>
                    <h3 className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">{d.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {s?.code} {d.chapter ? `· ${d.chapter}` : ""}
                    </p>
                  </div>
                </div>

                {d.kind === "pdf" && d.pdfData ? (
                  <div className="flex-1">
                    <p className="mb-2 text-xs text-slate-500">📎 {d.pdfName}</p>
                    <iframe
                      title={d.title}
                      src={d.pdfData}
                      className="h-56 w-full rounded-xl border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                ) : (
                  <div className="flex-1">
                    {hideAll || !isOpen ? (
                      <div className="flex h-full min-h-[110px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800/50">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Réponse masquée — teste ta mémoire avant d'afficher.
                        </p>
                        <button
                          className="btn-ghost mt-2 !py-1.5 text-xs"
                          onClick={() => setRevealed((r) => ({ ...r, [d.id]: true }))}
                        >
                          Afficher
                        </button>
                      </div>
                    ) : (
                      <>
                        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                          {d.content || "(vide)"}
                        </pre>
                        <button
                          className="mt-1 text-xs text-brand-600 hover:underline"
                          onClick={() => setRevealed((r) => ({ ...r, [d.id]: false }))}
                        >
                          Masquer
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>{formatDate(d.createdAt)}</span>
                  <div className="flex gap-2">
                    <button className="text-brand-600 hover:underline" onClick={() => openEdit(d)}>
                      Modifier
                    </button>
                    <button
                      className="text-rose-600 hover:underline"
                      onClick={() => {
                        if (window.confirm("Supprimer ce document ?")) actions.removeDocument(d.id);
                      }}
                    >
                      Suppr.
                    </button>
                  </div>
                </div>

                {sessions.length > 0 && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <strong>Séances liées :</strong>{" "}
                    {sessions.map((x) => `${formatDate(x.date)} (${x.chapter})`).join(" · ")}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {hideAll && revealedCount === 0 && filtered.length > 0 && (
        <p className="mt-4 text-center text-xs text-slate-400">
          Mode révision actif : toutes les réponses sont masquées.
        </p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Modifier le document" : "Ajouter un document"}
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Titre" error={errors.title}>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex. Loi de Bayes — fiche" />
            </Field>
          </div>
          <Field label="Type de document">
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as DocKind })}>
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Matière" error={errors.subjectId}>
            <select
              className="input"
              value={form.subjectId}
              onChange={(e) => {
                const s = subjectOf(e.target.value);
                setForm({ ...form, subjectId: e.target.value, semester: s?.semester ?? form.semester });
              }}
            >
              {data.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name.slice(0, 40)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Semestre">
            <select className="input" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value as SemesterId })}>
              <option value="S3">Semestre 3</option>
              <option value="S4">Semestre 4</option>
            </select>
          </Field>
          <Field label="Chapitre">
            <input className="input" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} placeholder="Ex. Chapitre 4 — SIG et analyse spatiale" />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Contenu (texte)" error={errors.content} hint="Cours, fiche, formules ou définitions">
              <textarea className="input" rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Document PDF (facultatif)" error={errors.pdf} hint="Stockage local limité à 1,5 Mo">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="input"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </Field>
            {form.pdfName && (
              <p className="mt-1 text-xs text-slate-500">
                PDF sélectionné : {form.pdfName}{" "}
                <button className="text-rose-600 underline" onClick={() => setForm({ ...form, pdfData: undefined, pdfName: undefined })}>
                  retirer
                </button>
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>
            Annuler
          </button>
          <button className="btn-primary" onClick={submit}>
            Enregistrer
          </button>
        </div>
      </Modal>
    </div>
  );
}
