"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { buttonClassName } from "@/components/button";
import { LOCALE_NAMES, locales } from "@/i18n/config";
import { saveProfile, type FormState } from "./actions";
import { Avatar } from "./avatar";

type Props = {
  mode: "create" | "edit";
  avatarIds: string[];
  initial: { username: string; avatarId: string; locale?: string };
};

export function ProfileForm({ mode, avatarIds, initial }: Props) {
  const t = useTranslations("Profile");
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
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {avatarIds.map((id, index) => (
            <label key={id} className="cursor-pointer">
              <input
                type="radio"
                name="avatarId"
                value={id}
                defaultChecked={id === initial.avatarId}
                required
                className="peer sr-only"
                aria-label={t("avatarOption", { number: index + 1 })}
              />
              <Avatar
                id={id}
                size={56}
                className="rounded-full ring-offset-2 ring-offset-bg peer-checked:ring-4 peer-checked:ring-accent peer-focus-visible:ring-4 peer-focus-visible:ring-fg"
              />
            </label>
          ))}
        </div>
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
