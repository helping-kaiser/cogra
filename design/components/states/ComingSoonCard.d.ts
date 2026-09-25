/**
 * The coming-soon door: a card on the brand wash (`WashCard`, no ghost) — a
 * headline and one line — that a slot or icon opens while the surface behind
 * it is drawn after V1.0 (readme §13, *The V1.0 scope cut*). A door belongs to
 * a slot, never to a list; one face for every door and every reader state.
 */
export interface ComingSoonCardProps {
  /** What is behind the door, as the headline names it: "Chats", "Wallet". The master adds " — coming soon". */
  thing: string;
  /** One sentence of what will be there: "Your conversations will be here." */
  line: string;
}

export declare function ComingSoonCard(props: ComingSoonCardProps): JSX.Element;
