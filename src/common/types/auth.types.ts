/**
 * JWT Payload structure for authentication
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  actorType: string;
  type: 'access' | 'refresh';
}

/**
 * Token pair returned from login/refresh
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Auth response returned from login
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
    actorType: string;
  };
  tokens: TokenPair;
}
