import { localDev, none, vercelOidc } from "eve/channels/auth";

/**
 * Who may talk to the agent. The deployed demo is public: anyone with the link can chat and create
 * charges, so judges can try it without an account. That is safe because the agent never moves
 * money; the worst case is someone spending the Groq free tier. `none()` must stay last.
 */
export const chatAuth = [vercelOidc(), localDev(), none()];
