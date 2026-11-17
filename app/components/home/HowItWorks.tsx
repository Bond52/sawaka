"use client";

import Link from "next/link";
import { Lightbulb, Sparkles, Users } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STEPS = [
  { key: "1", icon: Lightbulb, titleKey: "step1Title", textKey: "step1Text" },
  { key: "2", icon: Sparkles, titleKey: "step2Title", textKey: "step2Text" },
  { key: "3", icon: Users, titleKey: "step3Title", textKey: "step3Text" },
] as const;

export default function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section
      className="border-t border-border bg-gradient-to-b from-background to-secondary/40 py-16 lg:py-20"
      data-testid="how-it-works"
      aria-labelledby="how-it-works-title"
    >
      <div className="wrap">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2
              id="how-it-works-title"
              className="font-display text-3xl text-foreground lg:text-4xl"
            >
              {t("home.howItWorks.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
              {t("home.howItWorks.subtitle")}
            </p>
          </div>

          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.key} className="relative text-center md:text-left">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground md:mx-0">
                    <span className="sr-only">{index + 1}</span>
                    <Icon className="h-5 w-5" aria-hidden strokeWidth={2} />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-foreground">
                    {t(`home.howItWorks.${step.titleKey}`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(`home.howItWorks.${step.textKey}`)}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="mt-12 rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
            <h3 className="text-2xl font-semibold text-foreground">
              {t("home.howItWorks.ctaTitle")}
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              {t("home.howItWorks.ctaText")}
            </p>
            <Link
              href="/projets/creer"
              data-testid="how-it-works-cta"
              className={`mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground ${focusRing}`}
            >
              <Lightbulb className="h-4 w-4" aria-hidden strokeWidth={2} />
              {t("home.howItWorks.cta")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
