export const tabs = ["Dashboard", "Providers", "Routes", "Client keys", "Usage"] as const;
export type Tab = (typeof tabs)[number];

export const CUSTOM_MODEL_VALUE = "__custom__";
export const ADMIN_TOKEN_KEY = "adminToken";
