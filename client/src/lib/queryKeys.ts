export const queryKeys = {
  campaigns(token: string) {
    return ["campaigns", token] as const;
  },
  adminOverview(token: string) {
    return ["adminOverview", token] as const;
  }
};
