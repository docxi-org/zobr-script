// Realizer and trust class (doc 00 §2, doc 05 §1). Every trace step carries both.
export type Realizer = "llm" | "sandbox" | "server" | "host" | "user" | "external";
export type TrustClass = "asserted" | "verified" | "authority" | "n/a";
