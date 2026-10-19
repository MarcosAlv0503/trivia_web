"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { buttonClassName } from "@/components/button";
import { LEGAL } from "@/features/legal/legal";
import { LOCALE_NAMES, locales } from "@/i18n/config";
import { saveProfile, type FormState } from "./actions";
import { AvatarPicker } from "./avatar-picker";

type Props = {
  mode: "create" | "edit";
  avatarIds: string[];
  initial: { username: string; avatarId: string; locale?: string };
};

export function ProfileForm({ mode, avatarIds, initial }: Props) {
  const t = useTranslations("Profile");
  const tLegal = useTranslations("Legal");
  const currentLocale = useLocale();
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveProfile, {});

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-6">
      <label className="flex flex-col gap-1">
        <span className="font-display text-lg font-bold">{t("username")}</span>
        <input
          name="username"
          defaultValue={initial.username}
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]{3,20}"
          autoComplete="off"
          aria-describedby="username-hint"
          className="rounded-2xl bg-surface-2 px-4 py-2.5 text-lg font-bold sticker"
        />
        <span id="username-hint" className="text-sm text-fg-muted">
          {t("usernameHint")}
        </span>
      </label>

      <fieldset>
        <legend className="mb-2 font-display text-lg font-bold">{t("avatar")}</legend>
        <AvatarPicker name="avatarId" avatarIds={avatarIds} defaultValue={initial.avatarId} />
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-display text-lg font-bold">{t("language")}</legend>
        <div className="flex gap-4">
          {locales.map((locale) => (
            <label key={locale} className="flex items-center gap-2">
              <input
                type="radio"
                className="size-5 accent-accent"
                name="locale"
                value={locale}
                defaultChecked={locale === (initial.locale ?? currentLocale)}
              />
              <span lang={locale}>{LOCALE_NAMES[locale]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "create" && (
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            className="mt-1 size-5 shrink-0 accent-accent"
          />
          <span>
            {tLegal.rich("accept", {
              age: LEGAL.minAge,
              terms: (chunks) => (
                <Link href="/legal/terms" target="_blank" className="font-bold underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/legal/privacy" target="_blank" className="font-bold underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
      )}

      {state.error && (
        <p role="alert" className="font-bold text-ko">
          {t(`errors.${state.error}`)}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClassName("play", "w-full")}>
        {pending ? t("saving") : mode === "create" ? t("create") : t("save")}
      </button>
    </form>
  );
}
