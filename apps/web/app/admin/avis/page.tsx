'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  AdminSurveyEntry,
  adminSurveyExportUrl,
  fetchAdminSurveys,
} from '../../../lib/api';
import { answerLabel, budgetLabel } from '../../../lib/survey/labels';
import { computeIntentStats, rankAtouts } from '../../../lib/survey/intent-stats';
import { ATOUTS_LABELS } from '../../../lib/survey/atouts-labels';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function topCount(values: string[]): { value: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  let best: { value: string; count: number } | null = null;
  for (const [value, count] of Array.from(counts.entries())) {
    if (!best || count > best.count) best = { value, count };
  }
  return best;
}

function formatAverage(value: number | null): string {
  if (value === null) return '—';
  return value.toFixed(2).replace('.', ',');
}

function formatDelta(value: number | null): string {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2).replace('.', ',')}`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-paper/15 bg-ink-card p-4">
      <p className="text-[10px] uppercase tracking-wide text-paper/50">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-paper">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-paper/45">{hint}</p>}
    </div>
  );
}

export default function AdminAvisPage() {
  const [entries, setEntries] = useState<AdminSurveyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEntries(await fetchAdminSurveys());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger les réponses au questionnaire.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sources = useMemo(
    () =>
      Array.from(
        new Set(
          entries
            .map((entry) => entry.source)
            .filter((value): value is string => value !== null && value.length > 0),
        ),
      ).sort(),
    [entries],
  );

  const hasNoSource = useMemo(() => entries.some((entry) => entry.source === null), [entries]);

  const filtered = useMemo(() => {
    if (source === 'ALL') return entries;
    if (source === '__none__') return entries.filter((entry) => entry.source === null);
    return entries.filter((entry) => entry.source === source);
  }, [entries, source]);

  const stats = useMemo(() => {
    const withContact = entries.filter((entry) => entry.contact !== null).length;
    const topResidence = topCount(entries.map((entry) => entry.residence));
    const topBudget = topCount(
      entries.map((entry) => `${entry.budgetCurrency}:${entry.budget}`),
    );

    return {
      total: entries.length,
      withContact,
      sources: sources.length,
      topResidence,
      topBudget,
      intent: computeIntentStats(entries),
      atoutRanks: rankAtouts(entries),
    };
  }, [entries, sources]);

  const exportHref = adminSurveyExportUrl(
    source === 'ALL' || source === '__none__' ? undefined : source,
  );

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-sand">
              <MessageSquareText className="h-4 w-4" />
              Étude de marché
            </div>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-paper">
              Réponses au questionnaire
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-paper/60">
              Les réponses sont anonymes. Le contact est facultatif et stocké
              séparément ; il n&apos;apparaît ici qu&apos;avec le consentement
              du répondant.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-lg border border-paper/20 px-3 py-2.5 text-xs text-paper/80 transition-colors hover:bg-paper/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <a
              href={exportHref}
              className="inline-flex items-center gap-2 rounded-lg border border-laterite/40 bg-laterite/15 px-3 py-2.5 text-xs font-medium text-laterite-light transition-colors hover:bg-laterite/25"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Intention avant (moy.)"
            value={formatAverage(stats.intent.averageBefore)}
            hint={`${stats.intent.countBefore} note(s)`}
          />
          <StatCard
            label="Intention après (moy.)"
            value={formatAverage(stats.intent.averageAfter)}
            hint={`${stats.intent.countAfter} note(s)`}
          />
          <StatCard
            label="Écart moyen"
            value={formatDelta(stats.intent.delta)}
            hint="Après − avant"
          />
          <StatCard
            label="Évolution"
            value={`${stats.intent.up} ↑ · ${stats.intent.stable} = · ${stats.intent.down} ↓`}
            hint="Hausse · stable · baisse"
          />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Réponses" value={String(stats.total)} />
          <StatCard
            label="Avec contact"
            value={String(stats.withContact)}
            hint={stats.total > 0 ? `${Math.round((stats.withContact / stats.total) * 100)} % des réponses` : undefined}
          />
          <StatCard
            label="Résidence la plus citée"
            value={
              stats.topResidence
                ? answerLabel('residence', stats.topResidence.value)
                : '—'
            }
            hint={stats.topResidence ? `${stats.topResidence.count} réponse(s)` : undefined}
          />
          <StatCard
            label="Budget le plus cité"
            value={
              stats.topBudget
                ? budgetLabel(
                    stats.topBudget.value.split(':')[1],
                    stats.topBudget.value.split(':')[0],
                  )
                : '—'
            }
            hint={
              stats.topBudget
                ? `${stats.topBudget.count} réponse(s)`
                : undefined
            }
          />
        </div>

        {stats.atoutRanks.length > 0 && (
          <div className="mt-6 rounded-xl border border-paper/15 bg-ink-card p-4">
            <p className="text-[10px] uppercase tracking-wide text-paper/50">
              Atouts les plus choisis
            </p>
            <ol className="mt-3 space-y-2">
              {stats.atoutRanks.map((rank) => (
                <li
                  key={rank.key}
                  className="flex items-center justify-between gap-3 text-xs text-paper/80"
                >
                  <span>{ATOUTS_LABELS[rank.key] ?? rank.key}</span>
                  <span className="font-mono text-paper/50">{rank.count}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <label htmlFor="source-filter" className="text-xs text-paper/50">
              Source
            </label>
            <select
              id="source-filter"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="rounded-lg border border-paper/20 bg-ink-card px-3 py-2 text-xs text-paper focus:border-sand focus:outline-none"
            >
              <option value="ALL">Toutes les sources</option>
              {sources.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
              {hasNoSource && <option value="__none__">Sans source</option>}
            </select>
          </div>
          <p className="text-xs text-paper/40">
            {filtered.length} réponse{filtered.length > 1 ? 's' : ''} affichée
            {filtered.length > 1 ? 's' : ''}
          </p>
        </div>

        {loading && (
          <div className="mt-8 flex items-center gap-3 text-xs text-paper/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement des réponses…
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-laterite/30 bg-laterite/10 p-4 text-sm text-laterite-light">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>{error}</p>
              <button
                onClick={() => void load()}
                className="mt-2 text-xs underline underline-offset-4"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="mt-8 rounded-xl border border-paper/15 bg-ink-card p-10 text-center text-sm text-paper/50">
            Aucune réponse pour le moment.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <ul className="mt-4 space-y-3">
            {filtered.map((entry) => {
              const expanded = expandedId === entry.id;
              return (
                <li
                  key={entry.id}
                  className="overflow-hidden rounded-xl border border-paper/15 bg-ink-card"
                >
                  <button
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                    className="flex w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-paper/5 sm:flex-row sm:items-center sm:justify-between"
                    aria-expanded={expanded}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-paper/45">{formatDate(entry.createdAt)}</span>
                      <span className="rounded border border-paper/20 bg-paper/5 px-2 py-0.5 text-paper/60">
                        {entry.source ?? 'direct'}
                      </span>
                      <span className="text-paper/80">
                        {answerLabel('residence', entry.residence)}
                      </span>
                      <span className="text-paper/40">·</span>
                      <span className="text-paper/80">{answerLabel('size', entry.size)}</span>
                      <span className="text-paper/40">·</span>
                      <span className="text-sand">
                        {budgetLabel(entry.budget, entry.budgetCurrency)}
                      </span>
                      {entry.contact && (
                        <span className="inline-flex items-center gap-1 rounded border border-lagoon/40 bg-lagoon/15 px-2 py-0.5 text-lagoon-light">
                          <Users className="h-3 w-3" /> Contact
                        </span>
                      )}
                    </div>
                    {expanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-paper/40" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-paper/40" />
                    )}
                  </button>

                  {expanded && (
                    <div className="space-y-4 border-t border-paper/10 p-4 text-xs">
                      <dl className="grid gap-3 sm:grid-cols-2">
                        {[
                          ['Lien avec le Togo', answerLabel('togoLink', entry.togoLink)],
                          ['Projet', answerLabel('projectGoal', entry.projectGoal)],
                          ['Préférence', answerLabel('preference', entry.preference)],
                          ['Taille', answerLabel('size', entry.size)],
                          [
                            'Décision',
                            entry.decisionMakers
                              .map((value) => answerLabel('decisionMakers', value))
                              .join(', '),
                          ],
                          [
                            'Freins',
                            entry.blockers
                              .map((value) => answerLabel('blockers', value))
                              .join(', '),
                          ],
                          [
                            'Rassurances',
                            entry.reassurances
                              .map((value) => answerLabel('reassurances', value))
                              .join(', '),
                          ],
                          ['Budget', budgetLabel(entry.budget, entry.budgetCurrency)],
                          [
                            'Intention avant / après',
                            entry.intentBefore === null && entry.intentAfter === null
                              ? '—'
                              : `${entry.intentBefore ?? '—'} → ${entry.intentAfter ?? '—'}`,
                          ],
                          [
                            'Atouts choisis',
                            entry.topAtouts.length > 0
                              ? entry.topAtouts
                                  .map((key) => ATOUTS_LABELS[key] ?? key)
                                  .join(', ')
                              : '—',
                          ],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-paper/40">{label}</dt>
                            <dd className="mt-0.5 text-paper/85">{value}</dd>
                          </div>
                        ))}
                      </dl>

                      {entry.whyText && (
                        <div>
                          <p className="text-paper/40">Pourquoi ce projet à prix égal</p>
                          <p className="mt-1 whitespace-pre-wrap text-paper/85">{entry.whyText}</p>
                        </div>
                      )}

                      {entry.experienceText && (
                        <div>
                          <p className="text-paper/40">Expérience d&apos;achat au Togo</p>
                          <p className="mt-1 whitespace-pre-wrap text-paper/85">
                            {entry.experienceText}
                          </p>
                        </div>
                      )}

                      {entry.remainingBlockers && (
                        <div>
                          <p className="text-paper/40">Ce qui retiendrait encore</p>
                          <p className="mt-1 whitespace-pre-wrap text-paper/85">
                            {entry.remainingBlockers}
                          </p>
                        </div>
                      )}

                      {entry.contact && (
                        <div className="rounded-lg border border-lagoon/25 bg-lagoon/10 p-3">
                          <p className="font-medium text-lagoon-light">Contact (consentement recueilli)</p>
                          <p className="mt-1 text-paper/80">
                            {entry.contact.email ?? '—'}
                            {entry.contact.email && entry.contact.whatsapp ? ' · ' : ''}
                            {entry.contact.whatsapp ?? ''}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
