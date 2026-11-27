import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  ListOrdered,
  Loader2,
  LockOpen,
  Pencil,
  Swords,
  Table2,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import {
  SUBTOURNAMENT_CATEGORY_PRESETS,
  adaptEntriesToParticipants,
  adaptSubEliminationsToEliminations,
  adaptSubMatchesToMatches,
  buildDefaultPointsScale,
  generateSubtournamentMatches,
  getPointsForRank,
  getSubtournamentCategory,
  getSubtournamentFormatMeta,
} from '../utils/customTournamentEngine';
import {
  buildGroupStageProgressionPatches,
  getKnockoutSeriesStatus,
} from '../utils/tournamentEngine';
import { buildSubtournamentWhatsAppText } from '../utils/whatsappShare';
import Avatar from './Avatar';
import FinalizeSubtournamentModal from './FinalizeSubtournamentModal';
import MatchResultModal from './MatchResultModal';
import TeamManagerPanel from './TeamManagerPanel';
import TournamentMatchesTab from './TournamentMatchesTab';
import TournamentStandingsTab from './TournamentStandingsTab';
import WhatsAppShareButton from './WhatsAppShareButton';

export default function SubtournamentDetailView({
  tournamentName,
  subtournament,
  matchday,
  entries,
  entryMembers,
  subMatches,
  subEliminations,
  participants = [],
  potSets = [],
  potAssignments = [],
  participantMap,
  existingCategories = [],
  isAdmin,
  currentUserId,
  onOpenPotManager,
  onBack,
  onRefreshData,
  onSubtournamentDeleted,
}) {
  const isCompleted = subtournament.status === 'completed';
  const canEdit = isAdmin && !isCompleted;
  const isTeamBased = Boolean(subtournament.config?.is_team_based);

  const [innerTab, setInnerTab] = useState(() => {
    if (isTeamBased && entries.length === 0) return 'teams';
    return subtournament.format === 'manual' ? 'manual' : 'matches';
  });
  const [savingTeams, setSavingTeams] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [mutatingElimination, setMutatingElimination] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');

  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState(
    getSubtournamentCategory(subtournament) || ''
  );
  const [savingCategory, setSavingCategory] = useState(false);

  const [manualRanks, setManualRanks] = useState(() => {
    const initial = {};
    entries.forEach((entry, idx) => {
      initial[entry.id] = entry.final_rank ?? idx + 1;
    });
    return initial;
  });

  const [matchModalState, setMatchModalState] = useState({
    isOpen: false,
    match: null,
    siblingLeg: null,
  });

  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);

  const formatMeta = getSubtournamentFormatMeta(subtournament.format);
  const currentCategory = getSubtournamentCategory(subtournament);
  const pointsScale = Array.isArray(subtournament.points_scale)
    ? subtournament.points_scale
    : [];

  const suggestedCategories = useMemo(() => {
    const set = new Set([
      ...existingCategories,
      ...SUBTOURNAMENT_CATEGORY_PRESETS,
    ]);
    return Array.from(set).filter(Boolean);
  }, [existingCategories]);

  // Participantes disponibles para armar/sortear equipos en este subtorneo
  const eligibleParticipants = useMemo(() => {
    const selectedIds = subtournament.config?.selected_participant_ids;
    if (Array.isArray(selectedIds) && selectedIds.length > 0) {
      const idSet = new Set(selectedIds);
      const filtered = participants.filter((p) => idSet.has(p.id));
      if (filtered.length >= 2) return filtered;
    }
    return participants;
  }, [participants, subtournament.config]);

  // Equipos ya guardados en formato para TeamManagerPanel
  const savedTeams = useMemo(() => {
    if (!isTeamBased) return [];
    const membersById = new Map();
    entryMembers.forEach((em) => {
      if (!membersById.has(em.entry_id)) membersById.set(em.entry_id, []);
      membersById.get(em.entry_id).push(em.participant_id);
    });
    return entries.map((entry) => ({
      id: entry.id,
      name: entry.entry_name,
      memberIds: membersById.get(entry.id) || [],
    }));
  }, [isTeamBased, entries, entryMembers]);

  const adaptedEntries = useMemo(() => {
    const base = adaptEntriesToParticipants(
      entries,
      entryMembers,
      currentUserId,
      participantMap
    );

    const membersMap = new Map();
    entryMembers.forEach((em) => {
      if (!membersMap.has(em.entry_id)) membersMap.set(em.entry_id, []);
      membersMap.get(em.entry_id).push(em.participant_id);
    });

    const entryById = new Map(entries.map((e) => [e.id, e]));

    return base.map((item) => {
      const mIds = membersMap.get(item.id) || [];
      const singleId =
        mIds.length === 1
          ? mIds[0]
          : mIds.length === 0
          ? entryById.get(item.id)?.participant_id
          : null;
      const p = singleId ? participantMap.get(singleId) : null;
      return {
        ...item,
        effective_avatar_url: p ? resolveParticipantAvatar(p) : null,
        avatar_url: p?.avatar_url || null,
        profile: p?.profile || null,
      };
    });
  }, [entries, entryMembers, currentUserId, participantMap]);

  const entryMap = useMemo(
    () => new Map(adaptedEntries.map((e) => [e.id, e])),
    [adaptedEntries]
  );

  const adaptedMatches = useMemo(
    () => adaptSubMatchesToMatches(subMatches),
    [subMatches]
  );

  const adaptedEliminations = useMemo(
    () => adaptSubEliminationsToEliminations(subEliminations),
    [subEliminations]
  );

  const membersByEntryId = useMemo(() => {
    const map = new Map();
    entryMembers.forEach((em) => {
      if (!map.has(em.entry_id)) map.set(em.entry_id, []);
      const pName = participantMap.get(em.participant_id)?.name;
      if (pName) map.get(em.entry_id).push(pName);
    });
    return map;
  }, [entryMembers, participantMap]);

  async function handleSaveSubTeams(teamsPayload) {
    if (!canEdit) return;
    setActionError('');
    setSavingTeams(true);

    try {
      // Limpiar partidos y entradas previas
      await supabase
        .from('subtournament_matches')
        .delete()
        .eq('subtournament_id', subtournament.id);
      await supabase
        .from('subtournament_eliminations')
        .delete()
        .eq('subtournament_id', subtournament.id);
      await supabase
        .from('subtournament_entries')
        .delete()
        .eq('subtournament_id', subtournament.id);

      const entryPayloads = teamsPayload.map((team) => ({
        subtournament_id: subtournament.id,
        entry_name: team.name,
        participant_id: null,
      }));

      const { data: createdEntries, error: entriesError } = await supabase
        .from('subtournament_entries')
        .insert(entryPayloads)
        .select();

      if (entriesError) throw entriesError;

      const memberPayloads = [];
      createdEntries.forEach((entry, idx) => {
        const team = teamsPayload[idx];
        (team?.memberIds || []).forEach((pId) => {
          memberPayloads.push({
            entry_id: entry.id,
            participant_id: pId,
          });
        });
      });

      if (memberPayloads.length > 0) {
        const { error: membersError } = await supabase
          .from('subtournament_entry_members')
          .insert(memberPayloads);

        if (membersError) throw membersError;
      }

      // Ajustar escala de puntos a la cantidad real de equipos
      const nextPointsScale = buildDefaultPointsScale(
        createdEntries.length,
        subtournament.points_scale
      );
      await supabase
        .from('subtournaments')
        .update({ points_scale: nextPointsScale })
        .eq('id', subtournament.id);

      // Generar partidos automáticamente si corresponde
      if (
        subtournament.format === 'league' ||
        subtournament.format === 'knockout' ||
        subtournament.format === 'group_stage'
      ) {
        const matchPayloads = generateSubtournamentMatches(
          subtournament,
          createdEntries
        );
        if (matchPayloads.length > 0) {
          const { error: matchesError } = await supabase
            .from('subtournament_matches')
            .insert(matchPayloads);

          if (matchesError) throw matchesError;
        }
      }

      await onRefreshData();
    } catch (err) {
      setActionError(err?.message || 'No se pudieron guardar los equipos.');
    } finally {
      setSavingTeams(false);
    }
  }

  async function handleSaveCategory(e) {
    e?.preventDefault?.();
    if (!isAdmin) return;
    setSavingCategory(true);
    setActionError('');

    const cleanCat = categoryDraft.trim() || null;
    try {
      const nextConfig = { ...(subtournament.config || {}) };
      if (cleanCat) nextConfig.category = cleanCat;
      else delete nextConfig.category;

      const { error: updErr } = await supabase
        .from('subtournaments')
        .update({ category: cleanCat, config: nextConfig })
        .eq('id', subtournament.id);

      if (updErr) throw updErr;
      setIsEditingCategory(false);
      await onRefreshData();
    } catch (err) {
      setActionError(err?.message || 'No se pudo actualizar la categoría.');
    } finally {
      setSavingCategory(false);
    }
  }

  async function syncSubKnockoutProgression(latestRows) {
    if (subtournament.format === 'knockout') {
      const regularMaxRound = latestRows
        .filter((m) => m.round_name !== 'Tercer puesto')
        .reduce((max, m) => Math.max(max, m.round_number), 0);

      if (regularMaxRound < 2) return;

      const adapted = adaptSubMatchesToMatches(latestRows);
      const updatesById = new Map();

      for (let r = 1; r < regularMaxRound; r += 1) {
        const roundMatches = adapted.filter(
          (m) => m.round_number === r && m.round_name !== 'Tercer puesto'
        );
        const matchOrders = Array.from(
          new Set(roundMatches.map((m) => m.match_order))
        ).sort((a, b) => a - b);

        matchOrders.forEach((order) => {
          const tieMatches = roundMatches.filter((m) => m.match_order === order);
          const series = getKnockoutSeriesStatus(tieMatches);
          const nextRound = r + 1;
          const nextOrder = Math.ceil(order / 2);
          const isTopSlot = order % 2 === 1;
          const nextWinnerId = series.isCompleted ? series.winnerId : null;

          const targetMatches = adapted.filter(
            (m) =>
              m.round_number === nextRound &&
              m.match_order === nextOrder &&
              m.round_name !== 'Tercer puesto'
          );

          targetMatches.forEach((target) => {
            let fieldToSet = null;
            let adaptedField = null;
            if (target.leg === 1) {
              fieldToSet = isTopSlot ? 'entry_a_id' : 'entry_b_id';
              adaptedField = isTopSlot ? 'participant_a_id' : 'participant_b_id';
            } else {
              fieldToSet = isTopSlot ? 'entry_b_id' : 'entry_a_id';
              adaptedField = isTopSlot ? 'participant_b_id' : 'participant_a_id';
            }

            if (target[adaptedField] !== nextWinnerId) {
              target[adaptedField] = nextWinnerId;
              target.score_a = null;
              target.score_b = null;
              target.winner_id = null;
              target.is_draw = false;
              target.status = 'pending';

              updatesById.set(target.id, {
                id: target.id,
                [fieldToSet]: nextWinnerId,
                score_a: null,
                score_b: null,
                winner_entry_id: null,
                is_draw: false,
                status: 'pending',
              });
            }
          });

          const isSemifinalRound = r === regularMaxRound - 1;
          if (isSemifinalRound) {
            const thirdPlaceMatch = adapted.find(
              (m) => m.round_name === 'Tercer puesto'
            );
            if (thirdPlaceMatch) {
              const loserId = series.isCompleted ? series.loserId : null;
              const fieldToSet = isTopSlot ? 'entry_a_id' : 'entry_b_id';
              const adaptedField = isTopSlot
                ? 'participant_a_id'
                : 'participant_b_id';

              if (thirdPlaceMatch[adaptedField] !== loserId) {
                thirdPlaceMatch[adaptedField] = loserId;
                thirdPlaceMatch.score_a = null;
                thirdPlaceMatch.score_b = null;
                thirdPlaceMatch.winner_id = null;
                thirdPlaceMatch.is_draw = false;
                thirdPlaceMatch.status = 'pending';

                updatesById.set(thirdPlaceMatch.id, {
                  id: thirdPlaceMatch.id,
                  [fieldToSet]: loserId,
                  score_a: null,
                  score_b: null,
                  winner_entry_id: null,
                  is_draw: false,
                  status: 'pending',
                });
              }
            }
          }
        });
      }

      if (updatesById.size > 0) {
        await Promise.all(
          Array.from(updatesById.values()).map(({ id, ...patch }) =>
            supabase.from('subtournament_matches').update(patch).eq('id', id)
          )
        );
      }
    } else if (subtournament.format === 'group_stage') {
      const adapted = adaptSubMatchesToMatches(latestRows);
      const patches = buildGroupStageProgressionPatches(
        pseudoTournament,
        adaptedEntries,
        adapted
      );

      if (patches.length > 0) {
        await Promise.all(
          patches.map(({ id, ...patch }) => {
            const mappedPatch = { ...patch };
            if ('participant_a_id' in mappedPatch) {
              mappedPatch.entry_a_id = mappedPatch.participant_a_id;
              delete mappedPatch.participant_a_id;
            }
            if ('participant_b_id' in mappedPatch) {
              mappedPatch.entry_b_id = mappedPatch.participant_b_id;
              delete mappedPatch.participant_b_id;
            }
            if ('winner_id' in mappedPatch) {
              mappedPatch.winner_entry_id = mappedPatch.winner_id;
              delete mappedPatch.winner_id;
            }
            return supabase
              .from('subtournament_matches')
              .update(mappedPatch)
              .eq('id', id);
          })
        );
      }
    }
  }

  async function handleGenerateMatches() {
    if (!canEdit) return;
    setActionError('');
    setGenerating(true);

    try {
      const generatedRows = generateSubtournamentMatches(subtournament, entries);
      const { error: deleteError } = await supabase
        .from('subtournament_matches')
        .delete()
        .eq('subtournament_id', subtournament.id);

      if (deleteError) throw deleteError;

      if (generatedRows.length > 0) {
        const { error: insertError } = await supabase
          .from('subtournament_matches')
          .insert(generatedRows);

        if (insertError) throw insertError;
      }

      await onRefreshData();
    } catch (err) {
      setActionError(err?.message || 'No se pudieron generar los cruces.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveMatchResult({ primaryUpdate, siblingUpdate }) {
    if (!canEdit || !matchModalState.match) return;
    const target = matchModalState.match;

    const mappedPrimary = {
      score_a: primaryUpdate.score_a,
      score_b: primaryUpdate.score_b,
      is_draw: primaryUpdate.is_draw,
      winner_entry_id: primaryUpdate.winner_id,
      status: primaryUpdate.status,
    };

    const { error: updateError } = await supabase
      .from('subtournament_matches')
      .update(mappedPrimary)
      .eq('id', target.id);

    if (updateError) throw updateError;

    if (siblingUpdate) {
      const mappedSibling = { ...siblingUpdate.patch };
      if ('winner_id' in mappedSibling) {
        mappedSibling.winner_entry_id = mappedSibling.winner_id;
        delete mappedSibling.winner_id;
      }

      const { error: sibError } = await supabase
        .from('subtournament_matches')
        .update(mappedSibling)
        .eq('id', siblingUpdate.id);

      if (sibError) throw sibError;
    }

    const { data: latestRows, error: fetchError } = await supabase
      .from('subtournament_matches')
      .select('*')
      .eq('subtournament_id', subtournament.id)
      .order('round_number', { ascending: true })
      .order('match_order', { ascending: true })
      .order('leg', { ascending: true });

    if (fetchError) throw fetchError;
    await syncSubKnockoutProgression(latestRows || []);
    await onRefreshData();
  }

  async function handleResetMatchResult(targetMatch) {
    if (!canEdit || !targetMatch) return;

    const { error: resetError } = await supabase
      .from('subtournament_matches')
      .update({
        score_a: null,
        score_b: null,
        winner_entry_id: null,
        is_draw: false,
        status: 'pending',
      })
      .eq('id', targetMatch.id);

    if (resetError) throw resetError;

    const { data: latestRows, error: fetchError } = await supabase
      .from('subtournament_matches')
      .select('*')
      .eq('subtournament_id', subtournament.id)
      .order('round_number', { ascending: true })
      .order('match_order', { ascending: true })
      .order('leg', { ascending: true });

    if (fetchError) throw fetchError;
    await syncSubKnockoutProgression(latestRows || []);
    await onRefreshData();
  }

  async function handleEliminateEntry(entryId) {
    if (!canEdit) return;
    setActionError('');
    setMutatingElimination(true);

    try {
      const nextOrder =
        subEliminations.reduce(
          (max, item) => Math.max(max, item.elimination_order),
          0
        ) + 1;

      const { error: insertError } = await supabase
        .from('subtournament_eliminations')
        .insert({
          subtournament_id: subtournament.id,
          entry_id: entryId,
          elimination_order: nextOrder,
        });

      if (insertError) throw insertError;
      await onRefreshData();
    } catch (err) {
      setActionError(err?.message || 'No se pudo registrar la eliminación.');
    } finally {
      setMutatingElimination(false);
    }
  }

  async function handleRevertElimination(eliminationRow) {
    if (!canEdit || !eliminationRow) return;
    setActionError('');
    setMutatingElimination(true);

    try {
      const { error: deleteError } = await supabase
        .from('subtournament_eliminations')
        .delete()
        .eq('id', eliminationRow.id);

      if (deleteError) throw deleteError;
      await onRefreshData();
    } catch (err) {
      setActionError(err?.message || 'No se pudo revertir la eliminación.');
    } finally {
      setMutatingElimination(false);
    }
  }

  async function handleResetAllEliminations() {
    if (!canEdit) return;
    setActionError('');
    setMutatingElimination(true);

    try {
      const { error: deleteError } = await supabase
        .from('subtournament_eliminations')
        .delete()
        .eq('subtournament_id', subtournament.id);

      if (deleteError) throw deleteError;
      await onRefreshData();
    } catch (err) {
      setActionError(
        err?.message || 'No se pudieron reiniciar las eliminaciones.'
      );
    } finally {
      setMutatingElimination(false);
    }
  }

  async function handleConfirmFinalize(rankPayloads) {
    if (!isAdmin) return;

    await Promise.all(
      rankPayloads.map((item) =>
        supabase
          .from('subtournament_entries')
          .update({
            final_rank: item.finalRank,
            points_awarded: item.pointsAwarded,
          })
          .eq('id', item.entryId)
      )
    );

    const { error: statusError } = await supabase
      .from('subtournaments')
      .update({ status: 'completed' })
      .eq('id', subtournament.id);

    if (statusError) throw statusError;
    await onRefreshData();
  }

  async function handleReopenSubtournament() {
    if (!isAdmin) return;
    setActionError('');
    setReopening(true);

    try {
      const { error: updateError } = await supabase
        .from('subtournaments')
        .update({ status: 'active' })
        .eq('id', subtournament.id);

      if (updateError) throw updateError;
      await onRefreshData();
    } catch (err) {
      setActionError(err?.message || 'No se pudo reabrir el subtorneo.');
    } finally {
      setReopening(false);
    }
  }

  async function handleDeleteSubtournament() {
    if (!isAdmin) return;
    setDeleting(true);
    setActionError('');

    try {
      const { error: deleteError } = await supabase
        .from('subtournaments')
        .delete()
        .eq('id', subtournament.id);

      if (deleteError) throw deleteError;
      onSubtournamentDeleted();
    } catch (err) {
      setActionError(err?.message || 'No se pudo eliminar el subtorneo.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const pseudoTournament = {
    id: subtournament.id,
    name: subtournament.name,
    format: subtournament.format,
    config: subtournament.config || {},
  };

  const finalizedEntries = [...entries].sort(
    (a, b) => (a.final_rank ?? 999) - (b.final_rank ?? 999)
  );

  const matchModalFormat =
    subtournament.format === 'group_stage'
      ? matchModalState.match?.stage === 'group'
        ? 'league'
        : 'knockout'
      : subtournament.format;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver a {matchday?.name || 'las Jornadas'}</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <WhatsAppShareButton
            compact
            label="WhatsApp"
            getText={() =>
              buildSubtournamentWhatsAppText(
                tournamentName,
                matchday,
                subtournament,
                entries,
                entryMembers,
                subMatches,
                subEliminations,
                participantMap
              )
            }
          />

          {isAdmin && (
            <>
              {!isCompleted ? (
                <button
                  type="button"
                  disabled={entries.length === 0}
                  onClick={() => setIsFinalizeModalOpen(true)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Award className="h-4 w-4" />
                  <span>Finalizar Subtorneo y Repartir Puntos</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsFinalizeModalOpen(true)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Editar puestos / puntos</span>
                  </button>
                  <button
                    type="button"
                    disabled={reopening}
                    onClick={handleReopenSubtournament}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                  >
                    {reopening ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LockOpen className="h-3.5 w-3.5" />
                    )}
                    <span>Reabrir</span>
                  </button>
                </>
              )}

              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs">
                  <span className="font-semibold text-rose-700">¿Eliminar?</span>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDeleteSubtournament}
                    className="min-h-[44px] rounded bg-rose-600 px-3 py-1 font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {deleting ? '...' : 'Sí'}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setConfirmDelete(false)}
                    className="min-h-[44px] rounded bg-white px-3 py-1 font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    No
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {/* Tarjeta resumen del Subtorneo + Categoría */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/55">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${formatMeta.badgeClass}`}
              >
                {formatMeta.label}
              </span>
              {currentCategory && (
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:border-indigo-500/35 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <Tag className="h-3 w-3" />
                  <span>{currentCategory}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Users className="h-3 w-3 text-slate-400" />
                <span>
                  {isTeamBased
                    ? `Por equipos (${entries.length})`
                    : `Individual (${entries.length})`}
                </span>
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  isCompleted
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-sky-100 text-sky-800'
                }`}
              >
                {isCompleted ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Finalizado · Puntos repartidos</span>
                  </>
                ) : (
                  <span>En juego</span>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {subtournament.name}
              </h2>

              {isAdmin && !isEditingCategory && (
                <button
                  type="button"
                  onClick={() => {
                    setCategoryDraft(currentCategory || '');
                    setIsEditingCategory(true);
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <Tag className="h-3 w-3" />
                  <span>{currentCategory ? 'Cambiar categoría' : '+ Categoría'}</span>
                </button>
              )}
            </div>

            {isAdmin && isEditingCategory && (
              <form
                onSubmit={handleSaveCategory}
                className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    maxLength={40}
                    value={categoryDraft}
                    onChange={(e) => setCategoryDraft(e.target.value)}
                    placeholder="Ej: FIFA, Truco, Pádel..."
                    className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-base font-medium text-slate-900 focus:border-indigo-500 focus:outline-none sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={savingCategory}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {savingCategory ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span>Guardar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingCategory(false)}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                    aria-label="Cancelar edición de categoría"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {suggestedCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryDraft(cat)}
                      className={`min-h-[34px] rounded-lg border px-2 py-1 text-[11px] font-bold ${
                        categoryDraft.trim().toLowerCase() === cat.toLowerCase()
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </form>
            )}
          </div>

          {pointsScale.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pointsScale.slice(0, 5).map((pts, idx) => (
                <span
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {idx + 1}.º:{' '}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {pts}
                  </strong>{' '}
                  pts
                </span>
              ))}
              {pointsScale.length > 5 && (
                <span className="rounded-lg bg-slate-200/70 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  +{pointsScale.length - 5} puestos
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isCompleted && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-500/35 dark:bg-emerald-500/10">
          <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
            <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Posiciones finales y puntos repartidos</span>
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {finalizedEntries.map((entry) => {
              const members = membersByEntryId.get(entry.id) || [];
              const adapted = entryMap.get(entry.id);
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-white px-3.5 py-2.5 dark:border-emerald-500/30 dark:bg-slate-900/80"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-extrabold text-emerald-800">
                      {entry.final_rank ?? '-'}°
                    </span>
                    <Avatar
                      name={entry.entry_name}
                      url={adapted?.effective_avatar_url || null}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                        {entry.entry_name}
                      </span>
                      {isTeamBased && members.length > 0 && (
                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {members.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="ml-2 shrink-0 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
                    +{entry.points_awarded} pts
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contenedor con pestañas internas (incluye Equipos si es por equipos) */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex overflow-x-auto border-b border-slate-200 px-2 pt-1 dark:border-slate-800">
          {isTeamBased && (
            <button
              type="button"
              onClick={() => setInnerTab('teams')}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
                innerTab === 'teams'
                  ? 'border-emerald-600 text-emerald-700 dark:border-[#CCFF00] dark:text-[#CCFF00]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Equipos ({entries.length})</span>
            </button>
          )}

          {subtournament.format === 'manual' ? (
            <button
              type="button"
              onClick={() => setInnerTab('manual')}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
                innerTab === 'manual'
                  ? 'border-emerald-600 text-emerald-700 dark:border-[#CCFF00] dark:text-[#CCFF00]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <ListOrdered className="h-4 w-4" />
              <span>Posiciones manuales</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setInnerTab('matches')}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
                  innerTab === 'matches'
                    ? 'border-emerald-600 text-emerald-700 dark:border-[#CCFF00] dark:text-[#CCFF00]'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Swords className="h-4 w-4" />
                <span>
                  {subtournament.format === 'last_standing'
                    ? 'Eliminaciones'
                    : subtournament.format === 'group_stage'
                    ? 'Grupos y Cruces'
                    : 'Cruces / Partidos'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setInnerTab('standings')}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
                  innerTab === 'standings'
                    ? 'border-emerald-600 text-emerald-700 dark:border-[#CCFF00] dark:text-[#CCFF00]'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Table2 className="h-4 w-4" />
                <span>Tabla interna</span>
              </button>
            </>
          )}
        </div>

        <div className="p-4 sm:p-5">
          {innerTab === 'teams' && isTeamBased ? (
            <TeamManagerPanel
              participants={eligibleParticipants}
              potSets={potSets}
              potAssignments={potAssignments}
              savedTeams={savedTeams}
              isAdmin={canEdit}
              saving={savingTeams}
              hasMatchesGenerated={subMatches.length > 0}
              generatingMatches={generating}
              onOpenPotManager={onOpenPotManager}
              onSaveTeams={handleSaveSubTeams}
              onGenerateMatches={
                subtournament.format !== 'manual' &&
                subtournament.format !== 'last_standing'
                  ? handleGenerateMatches
                  : undefined
              }
            />
          ) : innerTab === 'manual' && subtournament.format === 'manual' ? (
            <div>
              <div className="mb-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <ListOrdered className="h-4 w-4 text-indigo-600" />
                  <span>Posiciones manuales</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {canEdit
                    ? 'Asigna el puesto de cada competidor y luego presiona "Finalizar Subtorneo y Repartir Puntos".'
                    : 'Las posiciones serán confirmadas al finalizar el subtorneo.'}
                </p>
              </div>

              {adaptedEntries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                  Primero armá o sorteá los equipos en la pestaña <strong>Equipos</strong>.
                </p>
              ) : (
                <div className="space-y-2">
                  {adaptedEntries.map((entry) => {
                    const members = membersByEntryId.get(entry.id) || [];
                    const assignedRank = manualRanks[entry.id] ?? 1;
                    const previewPts = getPointsForRank(pointsScale, assignedRank);

                    return (
                      <div
                        key={entry.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-950/40"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar
                            name={entry.name}
                            url={entry.effective_avatar_url}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                              {entry.name}
                            </p>
                            {isTeamBased && members.length > 0 && (
                              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                {members.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>

                        {canEdit ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={assignedRank}
                              onChange={(e) => {
                                const nextRank = Number.parseInt(e.target.value, 10);
                                setManualRanks((prev) => ({
                                  ...prev,
                                  [entry.id]: nextRank,
                                }));
                              }}
                              className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                              {entries.map((_, idx) => (
                                <option key={idx + 1} value={idx + 1}>
                                  {idx + 1}.º puesto
                                </option>
                              ))}
                            </select>
                            <span className="min-w-[60px] text-right text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              {previewPts} pts
                            </span>
                          </div>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {isCompleted
                              ? `${entry.final_rank}.º · +${entry.points_awarded} pts`
                              : 'En juego'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : innerTab === 'matches' ? (
            <TournamentMatchesTab
              tournament={pseudoTournament}
              participants={adaptedEntries}
              matches={adaptedMatches}
              eliminations={adaptedEliminations}
              isAdmin={canEdit}
              currentUserId={currentUserId}
              participantMap={entryMap}
              generating={generating}
              mutatingElimination={mutatingElimination}
              onGenerateMatches={handleGenerateMatches}
              onOpenMatchModal={(match, siblingLeg) =>
                setMatchModalState({
                  isOpen: true,
                  match,
                  siblingLeg: siblingLeg || null,
                })
              }
              onEliminateParticipant={handleEliminateEntry}
              onRevertElimination={handleRevertElimination}
              onResetAllEliminations={handleResetAllEliminations}
            />
          ) : (
            <TournamentStandingsTab
              tournament={pseudoTournament}
              participants={adaptedEntries}
              matches={adaptedMatches}
              eliminations={adaptedEliminations}
              currentUserId={currentUserId}
            />
          )}
        </div>
      </div>

      <MatchResultModal
        isOpen={matchModalState.isOpen}
        match={matchModalState.match}
        siblingLeg={matchModalState.siblingLeg}
        tournamentFormat={matchModalFormat}
        participantMap={entryMap}
        onClose={() =>
          setMatchModalState({ isOpen: false, match: null, siblingLeg: null })
        }
        onSave={handleSaveMatchResult}
        onReset={handleResetMatchResult}
      />

      <FinalizeSubtournamentModal
        isOpen={isFinalizeModalOpen}
        subtournament={subtournament}
        entries={entries}
        entryMembers={entryMembers}
        participantMap={participantMap}
        matches={subMatches}
        eliminations={subEliminations}
        manualRanks={manualRanks}
        onClose={() => setIsFinalizeModalOpen(false)}
        onConfirm={handleConfirmFinalize}
      />
    </div>
  );
}