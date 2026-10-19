"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { QUICK, type Difficulty } from "@trivia/game-core";
import { buttonClassName } from "@/components/button";
import { DifficultyPicker } from "@/features/game/difficulty-picker";
import { Avatar } from "@/features/profile/avatar";
import { AvatarPicker } from "@/features/profile/avatar-picker";
import { startQuickMatch, type StartState } from "./actions";
import { CloseIcon } from "@/components/icons";

type Guest = { name: string; avatarId: string };

type Props = {
  host: { username: string; avatarId: string };
  recentGuests: Guest[];
  avatarIds: string[];
};

export function SetupForm({ host, recentGuests, avatarIds }: Props) {
  const t = useTranslations("Quick");
  const [state, formAction, pending] = useActionState<StartState, FormData>(startQuickMatch, {});
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState(avatarIds[0] ?? "");

  const isFull = guests.length >= QUICK.maxPlayers - 1;
  const taken = (name: string) =>
    guests.some((g) => g.name.toLowerCase() === name.trim().toLowerCase());
  const recent = recentGuests.filter((g) => !taken(g.name));

  function addGuest(guest: Guest) {
    if (isFull || !guest.name.trim() || taken(guest.name)) return;
    setGuests([...guests, { ...guest, name: guest.name.trim() }]);
  }

  return (
    <form action={formAction} className="flex w-full max-w-md flex-1 flex-col gap-6">
      <fieldset>
        <legend className="mb-2 font-display text-lg font-bold">{t("difficulty")}</legend>
        <DifficultyPicker name="difficulty" value={difficulty} onChange={setDifficulty} />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-display text-lg font-bold">
          {t("players", { count: guests.length + 1, max: QUICK.maxPlayers })}
        </legend>
        <PlayerRow name={host.username} avatarId={host.avatarId} note={t("you")} />
        {guests.map((guest) => (
          <PlayerRow key={guest.name} name={guest.name} avatarId={guest.avatarId}>
            <input type="hidden" name="guestName" value={guest.name} />
            <input type="hidden" name="guestAvatar" value={guest.avatarId} />
            <button
              type="button"
              onClick={() => setGuests(guests.filter((g) => g !== guest))}
              aria-label={t("remove", { name: guest.name })}
              className="ml-auto grid size-9 place-items-center rounded-full bg-surface-2 text-lg font-bold"
            >
              <CloseIcon size={18} />
            </button>
          </PlayerRow>
        ))}

        {!isFull && adding && (
          <div className="flex flex-col gap-3 rounded-card bg-surface p-4 sticker">
            <label className="flex flex-col gap-1">
              <span className="font-bold">{t("guestName")}</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={20}
                autoComplete="off"
                autoFocus
                className="rounded-2xl bg-surface-2 px-4 py-2.5 text-lg font-bold sticker"
              />
            </label>
            <AvatarPicker
              name="newGuestAvatar"
              avatarIds={avatarIds}
              defaultValue={newAvatar}
              onChange={setNewAvatar}
            />
            {taken(newName) && (
              <p role="alert" className="font-bold text-ko">
                {t("errors.nameTaken")}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!newName.trim() || taken(newName)}
                onClick={() => {
                  addGuest({ name: newName, avatarId: newAvatar });
                  setNewName("");
                  setAdding(false);
                }}
                className={buttonClassName("primary")}
              >
                {t("add")}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className={buttonClassName("secondary")}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}

        {!isFull && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={buttonClassName("secondary", "self-start")}
          >
            + {t("addPlayer")}
          </button>
        )}

        {!isFull && recent.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-fg-muted">{t("recent")}</span>
            {recent.map((guest) => (
              <button
                key={guest.name}
                type="button"
                onClick={() => addGuest(guest)}
                className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pr-3 pl-1 font-bold sticker"
              >
                <Avatar id={guest.avatarId} size={28} />
                {guest.name}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      {state.error && (
        <p role="alert" className="font-bold text-ko">
          {t(`errors.${state.error}`)}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={buttonClassName("play", "mt-auto w-full")}
      >
        {pending ? t("starting") : t("start")}
      </button>
    </form>
  );
}

function PlayerRow({
  name,
  avatarId,
  note,
  children,
}: {
  name: string;
  avatarId: string;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-2 pr-3 sticker">
      <Avatar id={avatarId} size={44} />
      <span className="font-display text-lg font-bold">{name}</span>
      {note && <span className="text-sm text-fg-muted">({note})</span>}
      {children}
    </div>
  );
}
