import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/button";
import { signInWithProvider } from "./actions";
import { enabledProviders } from "./providers";

export function LoginButtons() {
  const t = useTranslations("Auth");
  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      {enabledProviders.map((provider) => (
        <form key={provider.id} action={signInWithProvider.bind(null, provider.id)}>
          <button type="submit" className={buttonClassName("primary", "w-full")}>
            {t("signInWith", { provider: provider.label })}
          </button>
        </form>
      ))}
    </div>
  );
}
