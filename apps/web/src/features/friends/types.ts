// Forma de lo que devuelven las RPC de amigos (los tipos generados solo dicen `Json`).

export type Player = { id: string; username: string; avatarId: string };

export type FriendLists = { friends: Player[]; incoming: Player[]; outgoing: Player[] };

export type SearchResult = Player & { relation: "friend" | "outgoing" | "incoming" | null };
