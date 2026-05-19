declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    avatarUrl: string | null
    mustChangePassword?: boolean
    mustSetupMfa?: boolean
    /** Epoch ms of the last authenticated activity — drives the idle timeout. */
    lastActivityAt?: number
  }
}

export {}
