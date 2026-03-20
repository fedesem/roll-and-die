export const queryKeys = {
  campaigns(token: string) {
    return ["campaigns", token] as const;
  },
  campaignSourceBooks(token: string) {
    return ["campaignSourceBooks", token] as const;
  },
  adminOverview(token: string) {
    return ["adminOverview", token] as const;
  }
};
