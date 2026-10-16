"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "./avatar";

type Props = {
  name: string;
  avatarIds: string[];
  defaultValue?: string;
  onChange?: (id: string) => void;
};

/** Rejilla de avatares como grupo de radios (navegable con teclado). */
export function AvatarPicker({ name, avatarIds, defaultValue, onChange }: Props) {
  const t = useTranslations("Profile");
  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
      {avatarIds.map((id, index) => (
        <label key={id} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={id}
            defaultChecked={id === defaultValue}
            onChange={() => onChange?.(id)}
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
  );
}
