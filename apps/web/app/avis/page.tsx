'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import Brand from '../../components/Brand';
import {
  BUDGET_OPTIONS,
  initialAnswers,
  SURVEY_STEPS,
  TOTAL_QUESTIONS,
  type SurveyAnswers,
} from '../../lib/survey/questions';
import {
  buildSubmission,
  contactError,
  isStepComplete,
  stepErrorMessage,
} from '../../lib/survey/validation';
import { readSourceCookie } from '../../lib/survey/source';
import { submitSurvey } from '../../lib/api';

type Phase = 'intro' | 'form' | 'done';

export default function AvisPage() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>(initialAnswers);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const step = SURVEY_STEPS[stepIndex];
  const progress = phase === 'done' ? 100 : ((stepIndex + 1) / TOTAL_QUESTIONS) * 100;

  useEffect(() => {
    if (phase === 'form') window.scrollTo({ top: 0, behavior: 'auto' });
  }, [phase, stepIndex]);

  function update<K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) {
    setAnswers((previous) => ({ ...previous, [key]: value }));
    setError(null);
  }

  function toggleMulti(
    key: 'decisionMakers' | 'blockers' | 'reassurances',
    value: string,
  ) {
    const current = answers[key];
    update(
      key,
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(false);
    try {
      await submitSurvey(buildSubmission(answers, readSourceCookie()));
      setPhase('done');
    } catch (cause) {
      console.warn('[avis] envoi impossible :', cause);
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  function goNext() {
    if (!step) return;
    if (!isStepComplete(step, answers)) {
      setError(
        step.kind === 'contact'
          ? (contactError(answers) ?? stepErrorMessage(step))
          : stepErrorMessage(step),
      );
      return;
    }
    if (stepIndex === TOTAL_QUESTIONS - 1) {
      void submit();
      return;
    }
    setError(null);
    setStepIndex((index) => index + 1);
  }

  function goBack() {
    setError(null);
    if (stepIndex === 0) {
      setPhase('intro');
      return;
    }
    setStepIndex((index) => index - 1);
  }

  return (
    <main className="min-h-screen bg-cream text-body">
      <header className="border-b border-line bg-cream/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <a href="/" aria-label="Accueil">
            <Brand compact />
          </a>
          <a href="/" className="text-xs font-medium text-muted hover:text-ink">
            Retour au site
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {phase === 'intro' && (
          <section className="card p-6 sm:p-10">
            <p className="eyebrow text-laterite">Étude de marché · 2 minutes</p>
            <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-ink sm:text-4xl">
              Les Terrasses de Baguida : donnez votre avis
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted">
              Projet à l&apos;étude, sans engagement ni paiement. 2 minutes,
              anonyme.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Vos réponses nous aident à décider ce qui sera construit, à quel
              prix et pour qui. Le contact est facultatif : sans lui, le
              questionnaire reste totalement anonyme.
            </p>

            <ul className="mt-7 space-y-3 text-sm text-ink/80">
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-lagoon" /> 12 questions, une par écran
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-lagoon" /> Aucune vente, aucun paiement
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-lagoon" /> Les inscrits seront prévenus en priorité
              </li>
            </ul>

            <button
              onClick={() => {
                setPhase('form');
                setStepIndex(0);
                setError(null);
              }}
              className="btn-primary mt-8 w-full sm:w-auto"
            >
              Commencer <ArrowRight className="h-4 w-4" />
            </button>

            <p className="mt-4 text-xs text-muted">
              En continuant, vous acceptez que vos réponses soient utilisées de
              façon agrégée pour l&apos;étude.{' '}
              <a href="/confidentialite" className="underline underline-offset-4 hover:text-ink">
                En savoir plus
              </a>
            </p>
          </section>
        )}

        {phase === 'form' && step && (
          <section>
            {/* Progression */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="font-medium">
                  Question {stepIndex + 1} sur {TOTAL_QUESTIONS}
                </span>
                <span>≈ 2 min</span>
              </div>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-cream-deep"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={TOTAL_QUESTIONS}
                aria-valuenow={stepIndex + 1}
                aria-label="Progression du questionnaire"
              >
                <div
                  className="h-full rounded-full bg-laterite transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="card p-6 sm:p-8">
              <p className="eyebrow text-laterite">
                {step.kind === 'contact' ? 'Dernière étape' : 'Votre avis'}
              </p>
              <h1 className="mt-2 font-serif text-2xl font-semibold leading-tight text-ink sm:text-3xl">
                {step.title}
              </h1>
              {step.hint && <p className="mt-2 text-sm text-muted">{step.hint}</p>}

              <div className="mt-6">
                {(step.kind === 'single' || step.kind === 'multi') && (
                  <fieldset>
                    <legend className="sr-only">{step.title}</legend>
                    <div className="space-y-3">
                      {step.options.map((option) => {
                        const checked =
                          step.kind === 'single'
                            ? answers[step.key] === option.value
                            : (answers[step.key] as string[]).includes(option.value);

                        return (
                          <label
                            key={option.value}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all focus-within:ring-2 focus-within:ring-laterite/30 ${
                              checked
                                ? 'border-laterite bg-laterite/5'
                                : 'border-line bg-white hover:border-ink/20'
                            }`}
                          >
                            <input
                              type={step.kind === 'single' ? 'radio' : 'checkbox'}
                              name={String(step.key)}
                              value={option.value}
                              checked={checked}
                              onChange={() => {
                                if (step.kind === 'single') {
                                  update(step.key, option.value);
                                } else {
                                  toggleMulti(step.key, option.value);
                                }
                              }}
                              className="sr-only"
                            />
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border ${
                                step.kind === 'single' ? 'rounded-full' : 'rounded'
                              } ${
                                checked
                                  ? 'border-laterite bg-laterite text-white'
                                  : 'border-line bg-white'
                              }`}
                              aria-hidden="true"
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </span>
                            <span>
                              <span className="block text-sm font-medium text-ink">
                                {option.label}
                              </span>
                              {option.description && (
                                <span className="mt-1 block text-xs leading-relaxed text-muted">
                                  {option.description}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                {step.kind === 'text' && (
                  <div>
                    <label htmlFor={`question-${String(step.key)}`} className="sr-only">
                      {step.title}
                    </label>
                    <textarea
                      id={`question-${String(step.key)}`}
                      value={answers[step.key] as string}
                      onChange={(event) => update(step.key, event.target.value)}
                      maxLength={step.maxLength}
                      rows={step.rows ?? 4}
                      placeholder={step.placeholder}
                      className="w-full rounded-xl border border-line bg-white p-4 text-sm text-ink placeholder:text-muted/60 focus:border-laterite focus:outline-none focus:ring-2 focus:ring-laterite/20"
                    />
                    <div className="mt-1 text-right text-[11px] text-muted">
                      {(answers[step.key] as string).length} / {step.maxLength}
                    </div>
                  </div>
                )}

                {step.kind === 'budget' && (
                  <div>
                    <div className="mb-4 inline-flex rounded-xl border border-line bg-white p-1">
                      {(['XOF', 'EUR'] as const).map((currency) => (
                        <button
                          key={currency}
                          onClick={() => update('budgetCurrency', currency)}
                          className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                            answers.budgetCurrency === currency
                              ? 'bg-laterite text-white'
                              : 'text-muted hover:text-ink'
                          }`}
                        >
                          {currency === 'XOF' ? 'FCFA' : '€'}
                        </button>
                      ))}
                    </div>
                    <fieldset>
                      <legend className="sr-only">{step.title}</legend>
                      <div className="space-y-3">
                        {BUDGET_OPTIONS.map((option) => {
                          const checked = answers.budget === option.value;
                          return (
                            <label
                              key={option.value}
                              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all focus-within:ring-2 focus-within:ring-laterite/30 ${
                                checked
                                  ? 'border-laterite bg-laterite/5'
                                  : 'border-line bg-white hover:border-ink/20'
                              }`}
                            >
                              <input
                                type="radio"
                                name="budget"
                                value={option.value}
                                checked={checked}
                                onChange={() => update('budget', option.value)}
                                className="sr-only"
                              />
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                  checked
                                    ? 'border-laterite bg-laterite text-white'
                                    : 'border-line bg-white'
                                }`}
                                aria-hidden="true"
                              >
                                {checked && <Check className="h-3 w-3" />}
                              </span>
                              <span className="text-sm font-medium text-ink">
                                {answers.budgetCurrency === 'XOF' ? option.xof : option.eur}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </div>
                )}

                {step.kind === 'contact' && (
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="contact-email" className="mb-1.5 block text-xs font-medium text-ink">
                          E-mail (facultatif)
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          autoComplete="email"
                          value={answers.contactEmail}
                          onChange={(event) => update('contactEmail', event.target.value)}
                          placeholder="vous@exemple.com"
                          className="w-full rounded-xl border border-line bg-white p-3 text-sm text-ink placeholder:text-muted/60 focus:border-laterite focus:outline-none focus:ring-2 focus:ring-laterite/20"
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-whatsapp" className="mb-1.5 block text-xs font-medium text-ink">
                          WhatsApp (facultatif)
                        </label>
                        <input
                          id="contact-whatsapp"
                          type="tel"
                          autoComplete="tel"
                          value={answers.contactWhatsapp}
                          onChange={(event) => update('contactWhatsapp', event.target.value)}
                          placeholder="+228 90 12 34 56"
                          className="w-full rounded-xl border border-line bg-white p-3 text-sm text-ink placeholder:text-muted/60 focus:border-laterite focus:outline-none focus:ring-2 focus:ring-laterite/20"
                        />
                      </div>
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-cream p-4">
                      <input
                        type="checkbox"
                        checked={answers.consent}
                        onChange={(event) => update('consent', event.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#B5502E]"
                      />
                      <span className="text-xs leading-relaxed text-muted">
                        J&apos;accepte que mon e-mail ou mon numéro WhatsApp soit
                        conservé pour être informé(e) du lancement du projet. Je
                        peux demander leur suppression à tout moment.{' '}
                        <a href="/confidentialite" className="underline underline-offset-2 hover:text-ink">
                          Politique de confidentialité
                        </a>
                      </span>
                    </label>

                    <p className="flex items-start gap-2 text-xs text-muted">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lagoon" />
                      Sans contact renseigné, vos réponses sont anonymes. Le
                      contact est stocké séparément des réponses.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-lg border border-laterite/20 bg-laterite/5 px-3 py-2 text-xs text-laterite">
                  {error}
                </p>
              )}

              {submitError && (
                <p role="alert" className="mt-4 rounded-lg border border-laterite/20 bg-laterite/5 px-3 py-2 text-xs text-laterite">
                  L&apos;envoi a échoué. Vos réponses sont conservées : réessayez
                  dans un instant.
                </p>
              )}

              <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-8 flex flex-col gap-3 border-t border-line bg-white/95 px-6 py-3 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                <button onClick={goBack} className="btn-outline !py-3 !text-xs" disabled={submitting}>
                  <ArrowLeft className="h-4 w-4" /> Retour
                </button>
                <button
                  onClick={goNext}
                  disabled={submitting}
                  className="btn-primary !py-3 !text-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Envoi…
                    </>
                  ) : stepIndex === TOTAL_QUESTIONS - 1 ? (
                    <>
                      Envoyer mes réponses <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Suivant <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              {step.kind !== 'contact' && (
                <p className="mt-3 text-center text-[11px] text-muted">
                  Les champs marqués comme facultatifs peuvent rester vides.
                </p>
              )}
            </div>

            <p className="mt-4 text-center text-[11px] text-muted">
              Vos réponses ne sont jamais vendues.
            </p>
          </section>
        )}

        {phase === 'done' && (
          <section className="card p-8 text-center sm:p-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lagoon/10 text-lagoon">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-5 font-serif text-3xl font-semibold text-ink">
              Merci !
            </h1>
            <p className="mt-3 text-base text-muted">
              Les inscrits seront prévenus en priorité.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a href="/catalogue" className="btn-primary">
                Voir le catalogue 3D
              </a>
              <a href="/" className="btn-outline">
                Retour à l&apos;accueil
              </a>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
