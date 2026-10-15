"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
        <span className="font-semibold">{t("username")}</span>
        <input
          name="username"
          defaultValue={initial.username}
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]{3,20}"
          autoComplete="off"
          aria-describedby="username-hint"
          className="rounded-xl border px-3 py-2"
        />
        <span id="username-hint" className="text-sm opacity-70">
          {t("usernameHint")}
        </span>
      </label>

      <fieldset>
        <legend className="mb-2 font-semibold">{t("avatar")}</legend>
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
                className="rounded-full ring-offset-2 peer-checked:ring-4 peer-checked:ring-current peer-focus-visible:ring-4"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold">{t("language")}</legend>
        <div className="flex gap-4">
          {locales.map((locale) => (
            <label key={locale} className="flex items-center gap-2">
              <input
                type="radio"
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
        <p role="alert" className="text-red-600">
          {t(`errors.${state.error}`)}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border px-4 py-3 font-semibold"
      >
        {pending ? t("saving") : mode === "create" ? t("create") : t("save")}
      </button>
    </form>
  );
}
