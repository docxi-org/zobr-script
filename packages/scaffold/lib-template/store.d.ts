// Typed collection schemas for the ZS store (doc 12 §4.1).
// Each exported interface defines a collection. The interface name
// becomes the collection name used in this.db.collection<T>(name)
// and standalone zs_store_* tools.
//
// Example:
//   export interface Analysis {
//     topic: string;
//     summary: string;
//     findings: { fact: string; source: string }[];
//     meta: { confidence: "low" | "medium" | "high"; runDate: string };
//   }
