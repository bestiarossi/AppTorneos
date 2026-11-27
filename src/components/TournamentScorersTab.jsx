import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Award,
  Check,
  Edit3,
  Flame,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import Avatar from './Avatar';
import { useToast } from './ToastProvider';
import WhatsAppShareButton from './WhatsAppShareButton';

const STAT_VIEWS = [
  {
    id: 'goals',
    label: 'Goleadores',
    shortLabel: 'Goles',
    field: 'goals',
    quickLabel: '+1 Gol',
    emoji: '⚽',
  },
  {
    id: 'assists',
    label: 'Asistencias',
    shortLabel: 'Asist.',
    field: 'assists',
    quickLabel: '+1 Asist.',
    emoji: '👟',
  },
  {
    id: 'yellow_cards',
    label: 'Tarj. Amarillas',
    shortLabel: 'TA',
    field: 'yellow_cards',
    quickLabel: '+1 TA',
    emoji: '🟨',
  },
  {
    id: 'red_cards',
    label: 'Tarj. Rojas',
    shortLabel: 'TR',
    field: 'red_cards',
    quickLabel: '+1 TR',
    emoji: '🟥',
  },
  {
    id: 'clean_sheets',
    label: 'Arcos en 0 (PI)',
    shortLabel: 'PI',
    field: 'clean_sheets',
    quickLabel: '+1 PI',
    emoji: '🧤',
  },
  {
    id: 'all',
    label: 'Tabla completa',
    shortLabel: 'Todos',
    field: 'goals',
    quickLabel: '+1 Gol',
    emoji: '📊',
  },
];

export default function TournamentScorersTab({
  tournament,
  participants = [],
  participantMap = new Map(),
  isAdmin = false,
  currentUserId,
  onTournamentUpdated,
}) {
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeView, setActiveView] = useState('goals');
  const [searchQuery, setSearchQuery] = useState('');
  const [choosingMode, setChoosingMode] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Formulario manual (agregar jugador nuevo)
  const [newName, setNewName] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [newGoals, setNewGoals] = useState('0');
  const [newAssists, setNewAssists] = useState('0');
  const [newYellow, setNewYellow] = useState('0');
  const [newRed, setNewRed] = useState('0');
  const [newCleanSheets, setNewCleanSheets] = useState('0');
  const [addingRow, setAddingRow] = useState(false);

  // Edición manual por fila
  const [editingRowId, setEditingRowId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyRowId, setBusyRowId] = useState(null);

  const statsMode = tournament?.config?.player_stats_mode || null;

  const fetchStats = useCallback(async () => {
    if (!supabase || !tournament?.id) return;
    setError('');
    try {
      const { data, error: fetchErr } = await supabase
        .from('tournament_player_stats')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('goals', { ascending: false })
        .order('assists', { ascending: false })
        .order('player_name', { ascending: true });

      if (fetchErr) throw fetchErr;
      setRows(data || []);
    } catch (err) {
      setError(
        err?.message || 'No se pudieron cargar las estadísticas de jugadores.'
      );
    } finally {
      setLoading(false);
    }
  }, [tournament?.id]);

  useEffect(() => {
    setLoading(true);
    fetchStats();
  }, [fetchStats]);

  // Realtime para actualizaciones en vivo
  useEffect(() => {
    if (!supabase || !tournament?.id) return;

    const channel = supabase
      .channel(`player-stats-${tournament.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_player_stats',
          filter: `tournament_id=eq.${tournament.id}`,
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournament?.id, fetchStats]);

  async function handleSelectMode(nextMode) {
    if (!isAdmin || !tournament) return;
    setChoosingMode(true);
    setError('');

    try {
      const nextConfig = {
        ...(tournament.config || {}),
        player_stats_mode: nextMode,
      };

      const { data: updatedT, error: updErr } = await supabase
        .from('tournaments')
        .update({ config: nextConfig })
        .eq('id', tournament.id)
        .select()
        .single();

      if (updErr) throw updErr;
      if (onTournamentUpdated) onTournamentUpdated(updatedT);

      if (nextMode === 'all_participants') {
        const { data: syncedRows, error: syncErr } = await supabase.rpc(
          'sync_tournament_player_stats',
          { p_tournament_id: tournament.id }
        );
        if (syncErr) throw syncErr;
        setRows(syncedRows || []);
        toast.success('Participantes cargados en 0');
      } else {
        toast.success('Modo lista libre activado');
      }
    } catch (err) {
      setError(err?.message || 'No se pudo configurar la modalidad.');
    } finally {
      setChoosingMode(false);
    }
  }

  async function handleSyncParticipants() {
    if (!isAdmin || !tournament) return;
    setSyncing(true);
    setError('');
    try {
      const { data, error: syncErr } = await supabase.rpc(
        'sync_tournament_player_stats',
        { p_tournament_id: tournament.id }
      );
      if (syncErr) throw syncErr;
      setRows(data || []);
      toast.success('Participantes sincronizados');
    } catch (err) {
      setError(err?.message || 'No se pudo sincronizar la lista.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleQuickIncrement(row, field, delta = 1) {
    if (!isAdmin || !row) return;
    setBusyRowId(row.id);

    // Actualización optimista inmediata
    const previousValue = Number(row[field] || 0);
    const optimisticValue = Math.max(0, previousValue + delta);
    setRows((prev) =>
      prev.map((item) =>
        item.id === row.id ? { ...item, [field]: optimisticValue } : item
      )
    );

    try {
      const { data, error: rpcErr } = await supabase.rpc(
        'increment_player_stat',
        {
          p_stat_id: row.id,
          p_field: field,
          p_delta: delta,
        }
      );

      if (rpcErr) throw rpcErr;
      setRows((prev) =>
        prev.map((item) => (item.id === row.id ? data : item))
      );
    } catch (err) {
      // Revertir si falla
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id ? { ...item, [field]: previousValue } : item
        )
      );
      toast.error(err?.message || 'No se pudo actualizar el contador.');
    } finally {
      setBusyRowId(null);
    }
  }

  async function handleAddManualPlayer(e) {
    e.preventDefault();
    if (!isAdmin || !tournament) return;

    const cleanName = newName.trim();
    if (!cleanName) {
      setError('Ingresa el nombre del jugador.');
      return;
    }

    const parseNonNeg = (val) =>
      Math.max(0, Number.parseInt(String(val || '0'), 10) || 0);

    setAddingRow(true);
    setError('');

    try {
      const payload = {
        tournament_id: tournament.id,
        participant_id: null,
        player_name: cleanName,
        team_name: newTeam.trim() || null,
        goals: parseNonNeg(newGoals),
        assists: parseNonNeg(newAssists),
        yellow_cards: parseNonNeg(newYellow),
        red_cards: parseNonNeg(newRed),
        clean_sheets: parseNonNeg(newCleanSheets),
      };

      const { data, error: insErr } = await supabase
        .from('tournament_player_stats')
        .insert(payload)
        .select()
        .single();

      if (insErr) throw insErr;

      setRows((prev) => [data, ...prev]);
      setNewName('');
      setNewTeam('');
      setNewGoals('0');
      setNewAssists('0');
      setNewYellow('0');
      setNewRed('0');
      setNewCleanSheets('0');
      toast.success(`"${cleanName}" agregado a la tabla`);
    } catch (err) {
      setError(err?.message || 'No se pudo agregar al jugador.');
    } finally {
      setAddingRow(false);
    }
  }

  function startEditingRow(row) {
    if (!isAdmin) return;
    setEditingRowId(row.id);
    setEditDraft({
      player_name: row.player_name,
      team_name: row.team_name || '',
      goals: String(row.goals ?? 0),
      assists: String(row.assists ?? 0),
      yellow_cards: String(row.yellow_cards ?? 0),
      red_cards: String(row.red_cards ?? 0),
      clean_sheets: String(row.clean_sheets ?? 0),
    });
  }

  async function handleSaveRowEdit(rowId) {
    if (!isAdmin || !editDraft) return;
    const cleanName = editDraft.player_name.trim();
    if (!cleanName) {
      toast.error('El nombre no puede estar vacío.');
      return;
    }

    const parseNonNeg = (val) =>
      Math.max(0, Number.parseInt(String(val || '0'), 10) || 0);

    setSavingEdit(true);
    setError('');

    try {
      const { data, error: updErr } = await supabase
        .from('tournament_player_stats')
        .update({
          player_name: cleanName,
          team_name: editDraft.team_name.trim() || null,
          goals: parseNonNeg(editDraft.goals),
          assists: parseNonNeg(editDraft.assists),
          yellow_cards: parseNonNeg(editDraft.yellow_cards),
          red_cards: parseNonNeg(editDraft.red_cards),
          clean_sheets: parseNonNeg(editDraft.clean_sheets),
        })
        .eq('id', rowId)
        .select()
        .single();

      if (updErr) throw updErr;

      setRows((prev) => prev.map((r) => (r.id === rowId ? data : r)));
      setEditingRowId(null);
      setEditDraft(null);
      toast.success('Estadísticas guardadas');
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la edición.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteRow(row) {
    if (!isAdmin || !row) return;
    setBusyRowId(row.id);
    try {
      const { error: delErr } = await supabase
        .from('tournament_player_stats')
        .delete()
        .eq('id', row.id);
      if (delErr) throw delErr;
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.info(`"${row.player_name}" quitado de la tabla`);
    } catch (err) {
      toast.error(err?.message || 'No se pudo eliminar el registro.');
    } finally {
      setBusyRowId(null);
    }
  }

  const activeViewMeta =
    STAT_VIEWS.find((v) => v.id === activeView) || STAT_VIEWS[0];

  const sortedAndFilteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.player_name.toLowerCase().includes(q) ||
            (r.team_name || '').toLowerCase().includes(q)
        )
      : [...rows];

    const primaryField = activeViewMeta.field;
    filtered.sort((a, b) => {
      const diff = Number(b[primaryField] || 0) - Number(a[primaryField] || 0);
      if (diff !== 0) return diff;
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return a.player_name.localeCompare(b.player_name, 'es');
    });

    return filtered;
  }, [rows, searchQuery, activeViewMeta.field]);

  // Verificar si faltan participantes por sincronizar en modo all_participants
  const missingParticipantsCount = useMemo(() => {
    if (statsMode !== 'all_participants') return 0;
    const existingPIds = new Set(
      rows.map((r) => r.participant_id).filter(Boolean)
    );
    return participants.filter((p) => !existingPIds.has(p.id)).length;
  }, [statsMode, rows, participants]);

  function buildWhatsAppText() {
    const lines = [
      `⚽ *${tournament?.name || 'Torneo'}* — Tabla de ${activeViewMeta.label}`,
      '',
    ];

    const topScorers = [...rows]
      .filter((r) => r[activeViewMeta.field] > 0)
      .sort((a, b) => b[activeViewMeta.field] - a[activeViewMeta.field])
      .slice(0, 10);

    if (topScorers.length === 0) {
      lines.push('Todavía no hay registros cargados.');
    } else {
      topScorers.forEach((r, idx) => {
        const medal =
          idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : `${idx + 1}. `;
        const teamText = r.team_name ? ` (${r.team_name})` : '';
        lines.push(
          `${medal}*${r.player_name}*${teamText} — *${r[activeViewMeta.field]}* ${activeViewMeta.shortLabel}`
        );
      });
    }

    return lines.join('\n');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14 text-sm font-semibold text-slate-500 dark:text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-500" />
        <span>Cargando tabla de jugadores...</span>
      </div>
    );
  }

  // Selector inicial de modalidad si todavía no se eligió
  if (!statsMode) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
            <Award className="h-4 w-4 text-emerald-500" />
            <span>Goleadores, Asistencias, TA, TR y Arcos en 0 (PI)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Elige cómo quieres gestionar las estadísticas individuales de este torneo.
          </p>
        </div>

        {!isAdmin ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            El administrador todavía no habilitó la modalidad de tabla de goleadores y tarjetas.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              type="button"
              disabled={choosingMode}
              onClick={() => handleSelectMode('manual_roster')}
              className="glass-card flex min-h-[140px] flex-col justify-between rounded-2xl border-2 border-slate-200/90 p-5 text-left transition hover:border-emerald-400 dark:border-slate-700"
            >
              <div>
                <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <UserPlus className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Tabla vacía (Carga manual)
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Ideal para torneos de muchos equipos con planteles grandes. Empezás con la tabla vacía y vas agregando jugador por jugador (nombre, equipo y stats).
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                {choosingMode ? 'Configurando...' : 'Elegir tabla vacía →'}
              </span>
            </button>

            <button
              type="button"
              disabled={choosingMode}
              onClick={() => handleSelectMode('all_participants')}
              className="glass-card flex min-h-[140px] flex-col justify-between rounded-2xl border-2 border-slate-200/90 p-5 text-left transition hover:border-emerald-400 dark:border-slate-700"
            >
              <div>
                <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Todos los participantes en 0
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Carga automáticamente los {participants.length} participantes actuales del torneo ya inicializados en 0 para empezar a sumar goles, asistencias y tarjetas al instante.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                {choosingMode ? 'Cargando...' : 'Cargar todos en 0 →'}
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
            <Award className="h-4 w-4 text-emerald-500" />
            <span>Goleadores, Asistencias &amp; Tarjetas</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {statsMode === 'all_participants'
              ? 'Modalidad: Participantes del torneo en 0'
              : 'Modalidad: Lista manual libre (equipos / planteles)'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && statsMode === 'all_participants' && (
            <button
              type="button"
              disabled={syncing}
              onClick={handleSyncParticipants}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                missingParticipantsCount > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`}
              />
              <span>
                {missingParticipantsCount > 0
                  ? `Sincronizar (+${missingParticipantsCount})`
                  : 'Sincronizar'}
              </span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              disabled={choosingMode}
              onClick={() =>
                handleSelectMode(
                  statsMode === 'manual_roster'
                    ? 'all_participants'
                    : 'manual_roster'
                )
              }
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <span>
                {statsMode === 'manual_roster'
                  ? 'Incluir participantes en 0'
                  : 'Cambiar a lista manual'}
              </span>
            </button>
          )}

          {rows.length > 0 && (
            <WhatsAppShareButton
              compact
              label="Compartir"
              getText={buildWhatsAppText}
            />
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Formulario rápido para agregar jugador (visible en lista manual o siempre para admin) */}
      {isAdmin && statsMode === 'manual_roster' && (
        <form
          onSubmit={handleAddManualPlayer}
          className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
        >
          <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            <UserPlus className="h-3.5 w-3.5 text-emerald-500" />
            <span>Agregar jugador a la tabla</span>
          </p>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <input
              type="text"
              required
              maxLength={50}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del jugador *"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="text"
              maxLength={40}
              list="tournament-teams-datalist"
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              placeholder="Equipo / Club (opcional)"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <datalist id="tournament-teams-datalist">
              {participants.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>

          <div className="mt-2.5 grid grid-cols-5 gap-2">
            <div>
              <label className="mb-1 block text-center text-[10px] font-bold text-slate-500">
                ⚽ Goles
              </label>
              <input
                type="number"
                min={0}
                value={newGoals}
                onChange={(e) => setNewGoals(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-1 text-center font-mono text-base font-bold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-center text-[10px] font-bold text-slate-500">
                👟 Asist.
              </label>
              <input
                type="number"
                min={0}
                value={newAssists}
                onChange={(e) => setNewAssists(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-1 text-center font-mono text-base font-bold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-center text-[10px] font-bold text-slate-500">
                🟨 TA
              </label>
              <input
                type="number"
                min={0}
                value={newYellow}
                onChange={(e) => setNewYellow(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-1 text-center font-mono text-base font-bold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-center text-[10px] font-bold text-slate-500">
                🟥 TR
              </label>
              <input
                type="number"
                min={0}
                value={newRed}
                onChange={(e) => setNewRed(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-1 text-center font-mono text-base font-bold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label
                title="Portería Invicta / Arcos en 0"
                className="mb-1 block text-center text-[10px] font-bold text-slate-500"
              >
                🧤 PI
              </label>
              <input
                type="number"
                min={0}
                value={newCleanSheets}
                onChange={(e) => setNewCleanSheets(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-1 text-center font-mono text-base font-bold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="submit"
              disabled={addingRow}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
            >
              {addingRow ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>Agregar a la tabla</span>
            </motion.button>
          </div>
        </form>
      )}

      {/* Pestañas por Estadística + Buscador */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STAT_VIEWS.map((view) => {
            const active = activeView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`inline-flex min-h-[40px] items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span>{view.emoji}</span>
                <span>{view.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {rows.length > 0 && (
          <div className="relative sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar jugador o equipo..."
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Lista / Tabla de Jugadores */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
          Todavía no hay jugadores cargados. Usa el formulario de arriba para agregar goleadores, asistentes o arqueros.
        </div>
      ) : sortedAndFilteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
          No encontramos jugadores que coincidan con "{searchQuery}".
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {sortedAndFilteredRows.map((row, idx) => {
              const linkedParticipant = row.participant_id
                ? participantMap.get(row.participant_id)
                : null;
              const isMine =
                Boolean(currentUserId) &&
                linkedParticipant?.user_id === currentUserId;
              const isEditingThis = isAdmin && editingRowId === row.id;
              const isBusy = busyRowId === row.id;
              const primaryStatValue = Number(row[activeViewMeta.field] || 0);

              return (
                <motion.div
                  layout
                  key={row.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className={`rounded-2xl border p-3.5 transition ${
                    isMine
                      ? 'border-emerald-300/80 bg-emerald-50/50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                      : 'border-slate-200/80 bg-white/85 dark:border-slate-800 dark:bg-slate-900/70'
                  }`}
                >
                  {isEditingThis && editDraft ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          maxLength={50}
                          value={editDraft.player_name}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              player_name: e.target.value,
                            }))
                          }
                          placeholder="Nombre *"
                          className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-base font-bold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        <input
                          type="text"
                          maxLength={40}
                          value={editDraft.team_name}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              team_name: e.target.value,
                            }))
                          }
                          placeholder="Equipo (opcional)"
                          className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-base text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {[
                          { key: 'goals', label: '⚽ Goles' },
                          { key: 'assists', label: '👟 Asist.' },
                          { key: 'yellow_cards', label: '🟨 TA' },
                          { key: 'red_cards', label: '🟥 TR' },
                          { key: 'clean_sheets', label: '🧤 PI (Arco 0)' },
                        ].map((f) => {
                          const currentVal = Number.parseInt(
                            editDraft[f.key] || '0',
                            10
                          ) || 0;
                          return (
                            <div
                              key={f.key}
                              className="rounded-xl border border-slate-200 bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-950/50"
                            >
                              <span className="mb-1 block text-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                {f.label}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditDraft((prev) => ({
                                      ...prev,
                                      [f.key]: String(Math.max(0, currentVal - 1)),
                                    }))
                                  }
                                  className="flex min-h-[40px] min-w-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  value={editDraft[f.key]}
                                  onChange={(e) =>
                                    setEditDraft((prev) => ({
                                      ...prev,
                                      [f.key]: e.target.value,
                                    }))
                                  }
                                  className="min-h-[40px] w-full min-w-0 rounded-lg border border-slate-200 bg-white text-center font-mono text-base font-extrabold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditDraft((prev) => ({
                                      ...prev,
                                      [f.key]: String(currentVal + 1),
                                    }))
                                  }
                                  className="flex min-h-[40px] min-w-[34px] items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/20 dark:text-emerald-300"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          disabled={savingEdit}
                          onClick={() => handleDeleteRow(row)}
                          className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Quitar</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={() => {
                              setEditingRowId(null);
                              setEditDraft(null);
                            }}
                            className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Cancelar</span>
                          </button>
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={() => handleSaveRowEdit(row.id)}
                            className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {savingEdit ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            <span>Guardar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {/* Info del jugador */}
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black tabular-nums ${
                            idx === 0 && primaryStatValue > 0
                              ? 'podium-gold text-amber-900 dark:text-amber-200'
                              : idx === 1 && primaryStatValue > 0
                              ? 'podium-silver text-slate-800 dark:text-slate-200'
                              : idx === 2 && primaryStatValue > 0
                              ? 'podium-bronze text-orange-900 dark:text-orange-200'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>

                        <Avatar
                          name={row.player_name}
                          url={
                            linkedParticipant
                              ? resolveParticipantAvatar(linkedParticipant)
                              : null
                          }
                          size="sm"
                          highlight={isMine}
                        />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                              {row.player_name}
                            </p>
                            {row.team_name && (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {row.team_name}
                              </span>
                            )}
                          </div>

                          {/* Resumen de las 5 métricas */}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold tabular-nums">
                            <span className="text-emerald-700 dark:text-emerald-400">
                              ⚽ {row.goals}
                            </span>
                            <span className="text-sky-700 dark:text-sky-400">
                              👟 {row.assists}
                            </span>
                            <span className="text-amber-700 dark:text-amber-300">
                              🟨 {row.yellow_cards}
                            </span>
                            <span className="text-rose-700 dark:text-rose-400">
                              🟥 {row.red_cards}
                            </span>
                            <span
                              title="Porterías invictas / Arcos en 0"
                              className="text-indigo-700 dark:text-indigo-300"
                            >
                              🧤 {row.clean_sheets}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Acciones rápidas + Editar manual */}
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {isAdmin && (
                          <>
                            <motion.button
                              whileTap={{ scale: 0.94 }}
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleQuickIncrement(row, 'goals', 1)}
                              className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white shadow-2xs transition hover:bg-emerald-700 disabled:opacity-60"
                              title="Sumar 1 gol rápido"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>1 Gol</span>
                            </motion.button>

                            {activeView !== 'goals' &&
                              activeView !== 'all' && (
                                <motion.button
                                  whileTap={{ scale: 0.94 }}
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleQuickIncrement(
                                      row,
                                      activeViewMeta.field,
                                      1
                                    )
                                  }
                                  className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-extrabold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-500/35 dark:bg-indigo-500/20 dark:text-indigo-200"
                                >
                                  <span>{activeViewMeta.quickLabel}</span>
                                </motion.button>
                              )}

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => startEditingRow(row)}
                              className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              title="Setear números manualmente"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Editar</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}