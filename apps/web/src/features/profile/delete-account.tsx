"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/button";
import { deleteAccount, type FormState } from "./actions";

export function DeleteAccount() {
  const t = useTranslations("Account");
  const tProfile = useTranslations("Profile");
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<FormState>(deleteAccount, {});

  return (
    <section className="flex w-full max-w-md flex-col gap-3 border-t-2 border-surface-2 pt-6">
      <h2 className="font-display text-lg font-bold">{t("deleteTitle")}</h2>
      {confirming ? (
        <form action={formAction} className="flex flex-col gap-3">
          <p>{t("deleteWarning")}</p>
          <div className="flex gap-3">
            <button type="submit" disabled={pending} className={buttonClassName("danger")}>
              {t("confirmButton")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={buttonClassName("secondary")}
            >
              {t("cancel")}
            </button>
          </div>
          {state.error && (
            <p role="alert" className="font-bold text-ko">
              {tProfile(`errors.${state.error}`)}
            </p>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={buttonClassName("danger", "self-start")}
        >
          {t("deleteButton")}
        </button>
      )}
    </section>
  );
}
