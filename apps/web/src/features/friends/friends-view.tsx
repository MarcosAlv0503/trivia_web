"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DUEL, type Difficulty, type DuelRounds } from "@trivia/game-core";
import { buttonClassName } from "@/components/button";
import { startDuel, type StartDuelError } from "@/features/duel/start-duel";
import { DifficultyPicker, SegmentedPicker } from "@/features/game/difficulty-picker";
import { Avatar } from "@/features/profile/avatar";
import { LevelBadge } from "@/features/progress/level-badge";
import { createClient } from "@/lib/supabase/client";
import type { FriendLists, Player, SearchResult } from "./types";
import { CloseIcon } from "@/components/icons";

const SEARCH_DELAY_MS = 300;

export function FriendsView({ lists }: { lists: FriendLists }) {
  const t = useTranslations("Friends");
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (query.trim().length < 3) return;
    // Espera a que se deje de escribir; descarta respuestas de búsquedas anteriores.
    let current = true;
    const id = setTimeout(async () => {
      const { data } = await supabase.rpc("search_players", { query });
      if (current) setResults((data as unknown as SearchResult[] | null) ?? []);
    }, SEARCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(id);
    };
  }, [query, supabase]);

  /** Ejecuta una acción y recarga las listas (y la búsqueda, para actualizar los botones). */
  async function act(run: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError(false);
    const { error } = await run();
    if (error) setError(true);
    if (query.trim().length >= 3) {
      const { data } = await supabase.rpc("search_players", { query });
      setResults((data as unknown as SearchResult[] | null) ?? []);
    }
    router.refresh();
    setBusy(false);
  }

  const addFriend = (id: string) => act(() => supabase.rpc("send_friend_request", { target: id }));
  const respond = (id: string, accept: boolean) =>
    act(() => supabase.rpc("respond_friend_request", { requester: id, accept }));
  const remove = (id: string) => act(() => supabase.rpc("remove_friend", { other: id }));

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <section className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-display text-lg font-bold">{t("search")}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 3) setResults(null);
            }}
            maxLength={20}
            autoComplete="off"
            aria-describedby="search-hint"
            className="rounded-2xl bg-surface-2 px-4 py-2.5 text-lg font-bold sticker"
          />
          <span id="search-hint" className="text-sm text-fg-muted">
            {t("searchHint")}
          </span>
        </label>
        {results && results.length === 0 && <p className="text-fg-muted">{t("noResults")}</p>}
        {results?.map((player) => (
          <PlayerRow key={player.id} player={player}>
            {player.relation === null && (
              <button
                type="button"
                disabled={busy}
                onClick={() => addFriend(player.id)}
                className={buttonClassName("primary", "ml-auto px-4 py-2 text-base")}
              >
                {t("add")}
              </button>
            )}
            {player.relation === "incoming" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => respond(player.id, true)}
                className={buttonClassName("primary", "ml-auto px-4 py-2 text-base")}
              >
                {t("accept")}
              </button>
            )}
            {player.relation === "outgoing" && (
              <span className="ml-auto text-sm font-bold text-fg-muted">{t("requested")}</span>
            )}
            {player.relation === "friend" && (
              <span className="ml-auto text-sm font-bold text-fg-muted">{t("friend")}</span>
            )}
          </PlayerRow>
        ))}
      </section>

      {error && (
        <p role="alert" className="font-bold text-ko">
          {t("error")}
        </p>
      )}

      {lists.incoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">{t("incoming")}</h2>
          {lists.incoming.map((player) => (
            <PlayerRow key={player.id} player={player}>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => respond(player.id, true)}
                  className={buttonClassName("primary", "px-4 py-2 text-base")}
                >
                  {t("accept")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => respond(player.id, false)}
                  className={buttonClassName("secondary", "px-4 py-2 text-base")}
                >
                  {t("reject")}
                </button>
              </div>
            </PlayerRow>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">{t("list")}</h2>
        {lists.friends.length === 0 && <p className="text-fg-muted">{t("empty")}</p>}
        {lists.friends.map((player) => (
          <FriendRow
            key={player.id}
            player={player}
            busy={busy}
            onRemove={() => remove(player.id)}
          />
        ))}
      </section>

      {lists.outgoing.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">{t("outgoing")}</h2>
          {lists.outgoing.map((player) => (
            <PlayerRow key={player.id} player={player}>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(player.id)}
                className={buttonClassName("secondary", "ml-auto px-4 py-2 text-base")}
              >
                {t("cancel")}
              </button>
            </PlayerRow>
          ))}
        </section>
      )}
    </div>
  );
}

/** Amigo con las acciones Retar (eligiendo dificultad y rondas) y Eliminar (con confirmación). */
function FriendRow({
  player,
  busy,
  onRemove,
}: {
  player: Player;
  busy: boolean;
  onRemove: () => void;
}) {
  const t = useTranslations("Friends");
  const tDuel = useTranslations("Duel");
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [mode, setMode] = useState<"idle" | "challenge" | "remove">("idle");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [rounds, setRounds] = useState<DuelRounds>(DUEL.defaultRounds);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<StartDuelError>();

  async function challenge() {
    setStarting(true);
    const started = await startDuel(supabase, player.id, difficulty, rounds);
    if ("id" in started) {
      router.push(`/duel/${started.id}`);
      return;
    }
    setError(started.error);
    setStarting(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-2 sticker">
      <div className="flex items-center gap-3 pr-1">
        <Avatar id={player.avatarId} size={44} />
        <span className="font-display text-lg font-bold">{player.username}</span>
        <LevelBadge xp={player.xp} />
        {mode === "idle" && (
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setMode("challenge")}
              className={buttonClassName("primary", "px-4 py-2 text-base")}
            >
              {t("challenge")}
            </button>
            <button
              type="button"
              onClick={() => setMode("remove")}
              aria-label={t("remove")}
              className={buttonClassName("secondary", "px-3 py-2 text-base")}
            >
              <CloseIcon size={18} />
            </button>
          </div>
        )}
      </div>

      {mode === "challenge" && (
        <div className="flex flex-col gap-3 px-1 pb-1">
          <p className="font-bold">{t("challengeTitle")}</p>
          <DifficultyPicker
            name={`difficulty-${player.id}`}
            value={difficulty}
            onChange={setDifficulty}
          />
          <p className="font-bold">{tDuel("rounds")}</p>
          <SegmentedPicker
            name={`rounds-${player.id}`}
            value={rounds}
            onChange={setRounds}
            options={DUEL.roundOptions.map((count) => ({
              value: count,
              label: tDuel("roundsOption", { count }),
            }))}
          />
          {error && (
            <p role="alert" className="font-bold text-ko">
              {tDuel(`errors.${error}`, { max: DUEL.maxActivePerPair })}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={starting}
              onClick={challenge}
              className={buttonClassName("play", "flex-1 py-2.5 text-xl")}
            >
              {t("challengeGo")}
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              className={buttonClassName("secondary")}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {mode === "remove" && (
        <div className="flex flex-col gap-3 px-1 pb-1">
          <p>{t("removeConfirm", { name: player.username })}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className={buttonClassName("danger")}
            >
              {t("removeYes")}
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              className={buttonClassName("secondary")}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player, children }: { player: Player; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-2 pr-3 sticker">
      <Avatar id={player.avatarId} size={44} />
      <span className="font-display text-lg font-bold">{player.username}</span>
      <LevelBadge xp={player.xp} />
      {children}
    </div>
  );
}
