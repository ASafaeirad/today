export interface RouterAuthContext {
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface RouterContext {
  auth: RouterAuthContext;
}
