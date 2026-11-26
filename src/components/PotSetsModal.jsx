import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPotBadgeColor } from '../utils/potBalancer';
import { shuffleArray } from '../utils/tournamentEngine';

export default function PotSetsModal({
  isOpen,
  tournamentId,
  participants,
  potSets,
  potAssignments,
  isAdmin,
  onClose,
  onChanged,
}) {
  const [view, setView] = useState('list');
  const [editingSetId, setEditingSetId] = useState(null);
  const [setName, setSetName] = useState('');
  const [potCount, setPotCount] = useState(4);
  const [draftAssignments, setDraftAssignments] = useState({});

  const [saving, setSaving] = useState(false);
  const [deletingSetId, setDeletingSetId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setView('list');
    setEditingSetId(null);
    setConfirmDeleteId(null);
    setError('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saving, onClose]);

  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );

  if (!isOpen) return null;

  function openCreateForm() {
    setError('');
    setEditingSetId(null);
    setSetName('');
    setPotCount(Math.min(4, Math.max(2, participants.length || 4)));
    setDraftAssignments({});
    setView('form');
  }

  function openEditForm(potSet) {
    setError('');
    setEditingSetId(potSet.id);
    setSetName(potSet.name);
    setPotCount(potSet.pot_count);

    const nextAssign = {};
    potAssignments
      .filter((a) => a.pot_set_id === potSet.id)
      .forEach((a) => {
        nextAssign[a.participant_id] = a.pot_number;
      });
    setDraftAssignments(nextAssign);
    setView('form');
  }

  function handleChangePotCount(nextCount) {
    const clamped = Math.max(2, Math.min(10, nextCount));
    setPotCount(clamped);
    setDraftAssignments((prev) => {
      const cleaned = {};
      Object.entries(prev).forEach(([pId, pNum]) => {
        if (pNum >= 1 && pNum <= clamped) {
          cleaned[pId] = pNum;
        }
      });
      return cleaned;
    });
  }

  function handleRandomDistribute() {
    if (participants.length === 0) return;
    const shuffled = shuffleArray(participants);
    const next = {};
    shuffled.forEach((p, idx) => {
      next[p.id] = (idx % potCount) + 1;
    });
    setDraftAssignments(next);
  }

  async function handleSaveSet(e) {
    e.preventDefault();
    if (!isAdmin) return;
    setError('');

    const cleanName = setName.trim();
    if (!cleanName) {
      setError('Ingresa un nombre para el set de bombos (ej: Bombos FIFA).');
      return;
    }

    setSaving(true);

    try {
      let targetSetId = editingSetId;

      if (targetSetId) {
        const { error: updateError } = await supabase
          .from('tournament_pot_sets')
          .update({
            name: cleanName,
            pot_count: potCount,
          })
          .eq('id', targetSetId);

        if (updateError) throw updateError;

        const { error: clearError } = await supabase
          .from('tournament_pot_assignments')
          .delete()
          .eq('pot_set_id', targetSetId);

        if (clearError) throw clearError;
      } else {
        const { data: createdSet, error: createError } = await supabase
          .from('tournament_pot_sets')
          .insert({
            tournament_id: tournamentId,
            name: cleanName,
            pot_count: potCount,
          })
          .select()
          .single();

        if (createError) throw createError;
        targetSetId = createdSet.id;
      }

      const rowsToInsert = Object.entries(draftAssignments)
        .filter(
          ([pId, pNum]) =>
            participantMap.has(pId) && pNum >= 1 && pNum <= potCount
        )
        .map(([participant_id, pot_number]) => ({
          pot_set_id: targetSetId,
          participant_id,
          pot_number,
        }));

      if (rowsToInsert.length > 0) {
        const { error: insertAssignError } = await supabase
          .from('tournament_pot_assignments')
          .insert(rowsToInsert);

        if (insertAssignError) throw insertAssignError;
      }

      await onChanged();
      setView('list');
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el set de bombos.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSet(setId) {
    if (!isAdmin) return;
    setError('');
    setDeletingSetId(setId);

    try {
      const { error: deleteError } = await supabase
        .from('tournament_pot_sets')
        .delete()
        .eq('id', setId);

      if (deleteError) throw deleteError;
      setConfirmDeleteId(null);
      await onChanged();
    } catch (err) {
      setError(err?.message || 'No se pudo eliminar el set de bombos.');
    } finally {
      setDeletingSetId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            {view === 'form' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => setView('list')}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Volver a lista de bombos"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {view === 'list'
                  ? 'Sistema de Bombos'
                  : editingSetId
                  ? 'Editar Set de Bombos'
                  : 'Nuevo Set de Bombos'}
              </h2>
              <p className="text-xs text-slate-500">
                Agrupa a los jugadores por nivel (Bombo 1 = cabezas de serie) para
                equilibrar equipos.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {view === 'list' ? (
            <div className="space-y-4">
              {isAdmin && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={openCreateForm}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-emerald-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Crear set de bombos</span>
                  </button>
                </div>
              )}

              {potSets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
                  <Layers className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-900">
                    No hay sets de bombos guardados
                  </h3>
                  <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                    {isAdmin
                      ? 'Crea sets como "Bombos FIFA" o "Bombos Truco" divididos de 2 a 10 bombos para usarlos en cualquier subtorneo por equipos.'
                      : 'El administrador todavía no configuró bombos para este torneo.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {potSets.map((ps) => {
                    const setAssigns = potAssignments.filter(
                      (a) => a.pot_set_id === ps.id
                    );
                    const isDeleting = deletingSetId === ps.id;
                    const isConfirming = confirmDeleteId === ps.id;

                    return (
                      <div
                        key={ps.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-900">
                              {ps.name}
                            </h3>
                            <p className="text-xs text-slate-500">
                              {ps.pot_count} bombos · {setAssigns.length} de{' '}
                              {participants.length} jugadores asignados
                            </p>
                          </div>

                          {isAdmin && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditForm(ps)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Editar</span>
                              </button>

                              {!isConfirming ? (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(ps.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Eliminar</span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs">
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => handleDeleteSet(ps.id)}
                                    className="rounded bg-rose-600 px-2 py-0.5 font-semibold text-white hover:bg-rose-700"
                                  >
                                    {isDeleting ? '...' : 'Confirmar'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="rounded bg-white px-2 py-0.5 font-semibold text-slate-600"
                                  >
                                    No
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {Array.from({ length: ps.pot_count }, (_, idx) => {
                            const potNum = idx + 1;
                            const potPlayers = setAssigns
                              .filter((a) => a.pot_number === potNum)
                              .map((a) => participantMap.get(a.participant_id)?.name)
                              .filter(Boolean);

                            return (
                              <div
                                key={potNum}
                                className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5"
                              >
                                <span
                                  className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold ${getPotBadgeColor(
                                    potNum
                                  )}`}
                                >
                                  Bombo {potNum}
                                </span>
                                <p className="mt-1.5 text-xs text-slate-700">
                                  {potPlayers.length > 0 ? (
                                    potPlayers.join(', ')
                                  ) : (
                                    <span className="text-slate-400">Vacío</span>
                                  )}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveSet} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="pot-set-name"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    Nombre del set *
                  </label>
                  <input
                    id="pot-set-name"
                    type="text"
                    required
                    maxLength={60}
                    value={setName}
                    onChange={(e) => setSetName(e.target.value)}
                    placeholder="Ej: Bombos FIFA, Bombos Truco..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Cantidad de bombos (2 a 10)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleChangePotCount(num)}
                        className={`h-9 w-9 rounded-xl border text-xs font-extrabold transition ${
                          potCount === num
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                <span className="text-xs font-medium text-slate-600">
                  Asigna cada participante a su bombo (Bombo 1 = nivel más alto).
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRandomDistribute}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Shuffle className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Repartir al azar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftAssignments({})}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Limpiar</span>
                  </button>
                </div>
              </div>

              {/* Resumen visual de bombos */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                {Array.from({ length: potCount }, (_, idx) => {
                  const potNum = idx + 1;
                  const members = participants.filter(
                    (p) => draftAssignments[p.id] === potNum
                  );
                  return (
                    <div
                      key={potNum}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${getPotBadgeColor(
                            potNum
                          )}`}
                        >
                          Bombo {potNum}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {members.length}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[11px] text-slate-600">
                        {members.length > 0
                          ? members.map((m) => m.name).join(', ')
                          : 'Vacío'}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Asignación jugador por jugador */}
              {participants.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-500">
                  Agrega participantes al torneo para asignarlos a los bombos.
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {participants.map((p) => {
                    const assigned = draftAssignments[p.id] || 0;
                    return (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5"
                      >
                        <span className="text-sm font-bold text-slate-900">
                          {p.name}
                        </span>

                        {potCount <= 6 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {Array.from({ length: potCount }, (_, idx) => {
                              const potNum = idx + 1;
                              const active = assigned === potNum;
                              return (
                                <button
                                  key={potNum}
                                  type="button"
                                  onClick={() =>
                                    setDraftAssignments((prev) => ({
                                      ...prev,
                                      [p.id]: active ? 0 : potNum,
                                    }))
                                  }
                                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                                    active
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  B{potNum}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <select
                            value={assigned}
                            onChange={(e) => {
                              const val = Number.parseInt(e.target.value, 10);
                              setDraftAssignments((prev) => ({
                                ...prev,
                                [p.id]: val,
                              }));
                            }}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                          >
                            <option value={0}>Sin bombo asignado</option>
                            {Array.from({ length: potCount }, (_, idx) => (
                              <option key={idx + 1} value={idx + 1}>
                                Bombo {idx + 1}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setView('list')}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{saving ? 'Guardando...' : 'Guardar Set de Bombos'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}