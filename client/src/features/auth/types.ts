export type AuthMode = "login" | "register";

export interface AuthFormState {
  name: string;
  email: string;
  password: string;
}
