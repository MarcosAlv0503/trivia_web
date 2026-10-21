// Forma de lo que devuelven las RPC de amigos (los tipos generados solo dicen `Json`).

export type Player = { id: string; username: string; avatarId: string; xp: number };

/** Solo de los amigos; el resto sale siempre "offline". */
export type Presence = "online" | "busy" | "offline";

export type Friend = Player & { presence: Presence };

export type FriendLists = { friends: Friend[]; incoming: Player[]; outgoing: Player[] };

export type SearchResult = Player & { relation: "friend" | "outgoing" | "incoming" | null };
