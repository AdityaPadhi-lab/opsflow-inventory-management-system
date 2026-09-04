import { createContext, useContext, useState, type ReactNode } from 'react';
import type { SessionUser } from '../types';
type AuthContextValue = { user: SessionUser | null; token: string | null; signIn: (token: string, user: SessionUser) => void; signOut: () => void };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const loadUser = () => { try { const raw = localStorage.getItem('opsflow_user'); return raw ? JSON.parse(raw) as SessionUser : null; } catch { return null; } };
export function AuthProvider({ children }: { children: ReactNode }) { const [user, setUser] = useState<SessionUser | null>(loadUser); const [token, setToken] = useState<string | null>(() => localStorage.getItem('opsflow_token')); const signIn = (nextToken: string, nextUser: SessionUser) => { localStorage.setItem('opsflow_token', nextToken); localStorage.setItem('opsflow_user', JSON.stringify(nextUser)); setToken(nextToken); setUser(nextUser); }; const signOut = () => { localStorage.removeItem('opsflow_token'); localStorage.removeItem('opsflow_user'); setToken(null); setUser(null); }; return <AuthContext.Provider value={{ user, token, signIn, signOut }}>{children}</AuthContext.Provider>; }
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; };
