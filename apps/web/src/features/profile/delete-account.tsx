"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteAccount, type FormState } from "./actions";

export function DeleteAccount() {
  const t = useTranslations("Account");
  const tProfile = useTranslations("Profile");
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<FormState>(deleteAccount, {});

  return (
    <section className="flex w-full max-w-md flex-col gap-3 border-t pt-6">
      <h2 className="font-semibold">{t("deleteTitle")}</h2>
      {confirming ? (
        <form action={formAction} className="flex flex-col gap-3">
          <p>{t("deleteWarning")}</p>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl border border-red-600 px-4 py-2 text-red-600"
            >
              {t("confirmButton")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-xl border px-4 py-2"
            >
              {t("cancel")}
            </button>
          </div>
          {state.error && (
            <p role="alert" className="text-red-600">
              {tProfile(`errors.${state.error}`)}
            </p>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="self-start rounded-xl border border-red-600 px-4 py-2 text-red-600"
        >
          {t("deleteButton")}
        </button>
      )}
    </section>
  );
}
