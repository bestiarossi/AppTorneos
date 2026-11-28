import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
  Plus,
  Tag,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  getSubtournamentCategory,
  getSubtournamentFormatMeta,
} from '../utils/customTournamentEngine';
import CreateSubtournamentModal from './CreateSubtournamentModal';
import SubtournamentDetailView from './SubtournamentDetailView';

export default function CustomMatchdaysTab({
  tournament,
  participants,
  matchdays,
  subtournaments,
  subEntries,
  subEntryMembers,
  subMatches,
  subEliminations,
  potSets,
  potAssignments,
  isPotModalOpen,
  participantMap,
  isAdmin,
  currentUserId,
  selectedSubtournamentId,
  onSelectSubtournament,
  onOpenPotManager,
  onBroadcastLiveDraw,
  onRefreshCustomData,
}) {
  const [expandedMatchdays, setExpandedMatchdays] = useState({});
  const [addingMatchday, setAddingMatchday] = useState(false);
  const [deletingMatchdayId, setDeletingMatchdayId] = useState(null);
  const [createSubModalMatchday, setCreateSubModalMatchday] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    setExpandedMatchdays((prev) => {
      const next = { ...prev };
      matchdays.forEach((md) => {
        if (next[md.id] === undefined) {
          next[md.id] = true;
        }
      });
      return next;
    });
  }, [matchdays]);

  const distinctCategories = useMemo(() => {
    const map = new Map();
    subtournaments.forEach((s) => {
      const cat = getSubtournamentCategory(s);
      if (!cat) return;
      const key = cat.toLowerCase();
      if (!map.has(key)) map.set(key, cat);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [subtournaments]);

  const selectedSubtournament =
    subtournaments.find((s) => s.id === selectedSubtournamentId) || null;

  if (selectedSubtournament) {
    const subMatchday =
      matchdays.find((m) => m.id === selectedSubtournament.matchday_id) || null;
    const entries = subEntries.filter(
      (e) => e.subtournament_id === selectedSubtournament.id
    );
    const entryIdsSet = new Set(entries.map((e) => e.id));
    const entryMembers = subEntryMembers.filter((em) =>
      entryIdsSet.has(em.entry_id)
    );
    const matches = subMatches.filter(
      (m) => m.subtournament_id === selectedSubtournament.id
    );
    const eliminations = subEliminations.filter(
      (el) => el.subtournament_id === selectedSubtournament.id
    );

    return (
      <SubtournamentDetailView
        tournamentName={tournament.name}
        subtournament={selectedSubtournament}
        matchday={subMatchday}
        entries={entries}
        entryMembers={entryMembers}
        subMatches={matches}
        subEliminations={eliminations}
        participants={participants}
        potSets={potSets}
        potAssignments={potAssignments}
        participantMap={participantMap}
        existingCategories={distinctCategories}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        onOpenPotManager={onOpenPotManager}
        onBroadcastLiveDraw={onBroadcastLiveDraw}
        onBack={() => onSelectSubtournament(null)}
        onRefreshData={onRefreshCustomData}
        onSubtournamentDeleted={async () => {
          onSelectSubtournament(null);
          await onRefreshCustomData();
        }}
      />
    );
  }

  function toggleMatchday(matchdayId) {
    setExpandedMatchdays((prev) => ({
      ...prev,
      [matchdayId]: !prev[matchdayId],
    }));
  }

  async function handleAddMatchday() {
    if (!isAdmin) return;
    setError('');
    setAddingMatchday(true);

    try {
      const nextNumber =
        matchdays.reduce(
          (max, md) => Math.max(max, md.matchday_number),
          0
        ) + 1;

      const { data, error: insertError } = await supabase
        .from('custom_matchdays')
        .insert({
          tournament_id: tournament.id,
          matchday_number: nextNumber,
          name: `Jornada ${nextNumber}`,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setExpandedMatchdays((prev) => ({ ...prev, [data.id]: true }));
      await onRefreshCustomData();
    } catch (err) {
      setError(err?.message || 'No se pudo agregar la jornada.');
    } finally {
      setAddingMatchday(false);
    }
  }

  async function handleDeleteEmptyMatchday(matchdayId) {
    if (!isAdmin) return;
    setError('');
    setDeletingMatchdayId(matchdayId);

    try {
      const { error: deleteError } = await supabase
        .from('custom_matchdays')
        .delete()
        .eq('id', matchdayId);

      if (deleteError) throw deleteError;
      await onRefreshCustomData();
    } catch (err) {
      setError(err?.message || 'No se pudo eliminar la jornada.');
    } finally {
      setDeletingMatchdayId(null);
    }
  }

  const entriesBySubId = new Map();
  subEntries.forEach((entry) => {
    if (!entriesBySubId.has(entry.subtournament_id)) {
      entriesBySubId.set(entry.subtournament_id, []);
    }
    entriesBySubId.get(entry.subtournament_id).push(entry);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Jornadas y Subtorneos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Organiza cada fecha con uno o más subtorneos que suman puntos a la
            Tabla General.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenPotManager}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            <Layers className="h-4 w-4" />
            <span>Bombos ({potSets.length})</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              disabled={addingMatchday}
              onClick={handleAddMatchday}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {addingMatchday ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>Agregar Jornada</span>
            </button>
          )}
        </div>
      </div>

      {distinctCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`min-h-[36px] rounded-xl border px-3 py-1 text-xs font-bold transition ${
              categoryFilter === 'all'
                ? 'border-indigo-500 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Todas las categorías
          </button>
          {distinctCategories.map((cat) => {
            const active = categoryFilter.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl border px-3 py-1 text-xs font-bold transition ${
                  active
                    ? 'border-indigo-500 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Tag className="h-3 w-3" />
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      {matchdays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <Calendar className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Todavía no hay jornadas creadas
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            {isAdmin
              ? 'Crea la Jornada 1 para empezar a agregar subtorneos y repartir puntos.'
              : 'El administrador todavía no inicializó las jornadas de este torneo.'}
          </p>
          {isAdmin && (
            <button
              type="button"
              disabled={addingMatchday}
              onClick={handleAddMatchday}
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              <span>Crear Jornada 1</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {matchdays.map((md) => {
            const allMdSubs = subtournaments.filter(
              (s) => s.matchday_id === md.id
            );
            const mdSubs =
              categoryFilter === 'all'
                ? allMdSubs
                : allMdSubs.filter(
                    (s) =>
                      (getSubtournamentCategory(s) || '').toLowerCase() ===
                      categoryFilter.toLowerCase()
                  );
            const completedSubsCount = mdSubs.filter(
              (s) => s.status === 'completed'
            ).length;
            const isExpanded = Boolean(expandedMatchdays[md.id]);
            const canDeleteMatchday = isAdmin && allMdSubs.length === 0;

            return (
              <div
                key={md.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900/65"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/90 px-4 py-3 dark:bg-slate-900/90">
                  <button
                    type="button"
                    onClick={() => toggleMatchday(md.id)}
                    className="flex min-h-[44px] items-center gap-2 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {md.name}
                    </span>
                    <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {mdSubs.length}{' '}
                      {mdSubs.length === 1 ? 'subtorneo' : 'subtorneos'}
                    </span>
                    {mdSubs.length > 0 && (
                      <span className="hidden text-[11px] font-medium text-emerald-700 sm:inline dark:text-emerald-400">
                        ({completedSubsCount} finalizados)
                      </span>
                    )}
                  </button>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateSubModalMatchday(md)}
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Crear Subtorneo</span>
                      </button>

                      {canDeleteMatchday && (
                        <button
                          type="button"
                          disabled={deletingMatchdayId === md.id}
                          onClick={() => handleDeleteEmptyMatchday(md.id)}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          title="Eliminar jornada vacía"
                          aria-label={`Eliminar ${md.name}`}
                        >
                          {deletingMatchdayId === md.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                    {mdSubs.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                        {categoryFilter !== 'all'
                          ? `No hay subtorneos de "${categoryFilter}" en esta jornada.`
                          : isAdmin
                          ? 'No hay subtorneos en esta jornada. Haz clic en "+ Crear Subtorneo".'
                          : 'Sin subtorneos cargados en esta jornada.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {mdSubs.map((sub) => {
                          const formatMeta = getSubtournamentFormatMeta(sub.format);
                          const subCategory = getSubtournamentCategory(sub);
                          const entries = entriesBySubId.get(sub.id) || [];
                          const isTeamBased = Boolean(sub.config?.is_team_based);
                          const isDone = sub.status === 'completed';
                          const needsTeamSetup = isTeamBased && entries.length === 0;
                          const winnerEntry = isDone
                            ? entries.find((e) => e.final_rank === 1)
                            : null;

                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => onSelectSubtournament(sub.id)}
                              className="group flex min-h-[44px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/75"
                            >
                              <div>
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${formatMeta.badgeClass}`}
                                    >
                                      {formatMeta.label}
                                    </span>

                                    {subCategory && (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:border-indigo-500/35 dark:bg-indigo-500/15 dark:text-indigo-300">
                                        <Tag className="h-2.5 w-2.5" />
                                        <span>{subCategory}</span>
                                      </span>
                                    )}
                                  </div>

                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                      isDone
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : needsTeamSetup
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-sky-100 text-sky-800'
                                    }`}
                                  >
                                    {isDone && (
                                      <CheckCircle2 className="h-3 w-3" />
                                    )}
                                    <span>
                                      {isDone
                                        ? 'Finalizado'
                                        : needsTeamSetup
                                        ? 'Armar equipos'
                                        : 'En juego'}
                                    </span>
                                  </span>
                                </div>

                                <h4 className="text-sm font-extrabold text-slate-900 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                                  {sub.name}
                                </h4>

                                {winnerEntry && (
                                  <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                                    <Trophy className="h-3.5 w-3.5" />
                                    <span>
                                      1.º {winnerEntry.entry_name} (+
                                      {winnerEntry.points_awarded} pts)
                                    </span>
                                  </p>
                                )}
                              </div>

                              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5 text-slate-400" />
                                  <span>
                                    {needsTeamSetup
                                      ? 'Falta sortear equipos'
                                      : `${entries.length} ${
                                          isTeamBased ? 'equipos' : 'jugadores'
                                        }`}
                                  </span>
                                </span>

                                <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                                  <span>Abrir</span>
                                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateSubtournamentModal
        isOpen={Boolean(createSubModalMatchday)}
        matchday={createSubModalMatchday}
        tournamentId={tournament.id}
        participants={participants}
        potSets={potSets}
        potAssignments={potAssignments}
        existingCategories={distinctCategories}
        disableEscape={Boolean(isPotModalOpen)}
        onOpenPotManager={onOpenPotManager}
        onClose={() => setCreateSubModalMatchday(null)}
        onCreated={async (createdSubId) => {
          await onRefreshCustomData();
          onSelectSubtournament(createdSubId);
        }}
      />
    </div>
  );
}