import { useTranslations } from "next-intl";
import { signInWithProvider } from "./actions";
import { enabledProviders } from "./providers";

export function LoginButtons() {
  const t = useTranslations("Auth");
  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      {enabledProviders.map((provider) => (
        <form key={provider.id} action={signInWithProvider.bind(null, provider.id)}>
          <button type="submit" className="w-full rounded-xl border px-4 py-3 font-semibold">
            {t("signInWith", { provider: provider.label })}
          </button>
        </form>
      ))}
    </div>
  );
}
