import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Check,
  Loader2,
  X,
} from 'lucide-react';
import {
  computeSuggestedSubtournamentRanks,
  getPointsForRank,
  isSubtournamentNaturallyFinished,
} from '../utils/customTournamentEngine';

export default function FinalizeSubtournamentModal({
  isOpen,
  subtournament,
  entries,
  entryMembers,
  participantMap,
  matches,
  eliminations,
  manualRanks,
  onClose,
  onConfirm,
}) {
  const [draftRows, setDraftRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !subtournament) return;

    setError('');
    setSaving(false);

    if (subtournament.status === 'completed') {
      const existingRows = [...entries]
        .sort((a, b) => (a.final_rank ?? 999) - (b.final_rank ?? 999))
        .map((entry, idx) => ({
          entry,
          rank: entry.final_rank ?? idx + 1,
          points: String(entry.points_awarded ?? 0),
          detail: 'Puntos guardados',
        }));
      setDraftRows(existingRows);
    } else {
      const suggested = computeSuggestedSubtournamentRanks(
        subtournament,
        entries,
        matches,
        eliminations,
        manualRanks,
        participantMap,
        entryMembers
      );
      setDraftRows(
        suggested.map((item) => ({
          ...item,
          points: String(item.points),
        }))
      );
    }
  }, [
    isOpen,
    subtournament,
    entries,
    entryMembers,
    participantMap,
    matches,
    eliminations,
    manualRanks,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saving, onClose]);

  if (!isOpen || !subtournament) return null;

  const isTeamBased = Boolean(subtournament.config?.is_team_based);
  const pointsScale = Array.isArray(subtournament.points_scale)
    ? subtournament.points_scale
    : [];
  const naturallyFinished = isSubtournamentNaturallyFinished(
    subtournament,
    entries,
    matches,
    eliminations
  );

  const membersByEntry = new Map();
  entryMembers.forEach((em) => {
    if (!membersByEntry.has(em.entry_id)) {
      membersByEntry.set(em.entry_id, []);
    }
    const pName = participantMap.get(em.participant_id)?.name;
    if (pName) membersByEntry.get(em.entry_id).push(pName);
  });

  function handleRankChange(entryId, newRankRaw) {
    const newRank = Number.parseInt(newRankRaw, 10);
    if (Number.isNaN(newRank)) return;

    const autoPoints = getPointsForRank(pointsScale, newRank);
    setDraftRows((prev) =>
      prev.map((row) =>
        row.entry.id === entryId
          ? { ...row, rank: newRank, points: String(autoPoints) }
          : row
      )
    );
  }

  function handlePointsChange(entryId, value) {
    setDraftRows((prev) =>
      prev.map((row) =>
        row.entry.id === entryId ? { ...row, points: value } : row
      )
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const payload = [];
    for (const row of draftRows) {
      const pts = Number(String(row.points ?? 0).trim() || 0);
      if (Number.isNaN(pts) || pts < 0) {
        setError(
          `El puntaje de "${row.entry.entry_name}" debe ser un número válido (>= 0).`
        );
        return;
      }
      payload.push({
        entryId: row.entry.id,
        finalRank: row.rank,
        pointsAwarded: pts,
      });
    }

    setSaving(true);
    try {
      await onConfirm(payload);
      onClose();
    } catch (err) {
      setError(err?.message || 'No se pudo finalizar el subtorneo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {subtournament.status === 'completed'
                  ? 'Editar puestos y puntos'
                  : 'Finalizar Subtorneo y Repartir Puntos'}
              </h2>
              <p className="text-xs text-slate-500">
                {subtournament.name} · Revisa los puestos y puntos antes de confirmar.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
          {!naturallyFinished && subtournament.status !== 'completed' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                El subtorneo todavía tiene partidos pendientes o más de 1 jugador en
                pie. Puedes ajustar manualmente los puestos debajo si igualmente
                deseas finalizarlo ahora.
              </span>
            </div>
          )}

          {isTeamBased && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs text-sky-900">
              Cada jugador integrante de un equipo recibirá el puntaje asignado a su
              equipo en la Tabla General del torneo.
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Competidor</th>
                  <th className="w-32 px-3 py-3 text-center">Puesto</th>
                  <th className="w-32 px-3 py-3 text-center">Puntos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {draftRows.map((row) => {
                  const members = membersByEntry.get(row.entry.id) || [];
                  return (
                    <tr key={row.entry.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">
                          {row.entry.entry_name}
                        </p>
                        {isTeamBased && members.length > 0 ? (
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {members.join(', ')}
                          </p>
                        ) : (
                          row.detail && (
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {row.detail}
                            </p>
                          )
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <select
                          value={row.rank}
                          onChange={(e) =>
                            handleRankChange(row.entry.id, e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-center text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                        >
                          {entries.map((_, idx) => (
                            <option key={idx + 1} value={idx + 1}>
                              {idx + 1}.º puesto
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          step="any"
                          min={0}
                          value={row.points}
                          onChange={(e) =>
                            handlePointsChange(row.entry.id, e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center text-sm font-extrabold text-emerald-700 focus:border-emerald-500 focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>
                {saving ? 'Guardando...' : 'Confirmar y Repartir Puntos'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}