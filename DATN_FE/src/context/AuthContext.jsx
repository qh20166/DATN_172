import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  deleteAddressRequest,
  loginRequest,
  logoutRequest,
  meRequest,
  registerRequest,
  saveAddressRequest,
  updateAddressRequest,
} from '../utils/api';

const AuthContext = createContext(null);

const SESSION_STORAGE_KEY = 'traffic_web_session';

function readSession() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(readSession());
  const [bootstrapping, setBootstrapping] = useState(Boolean(readSession()?.accessToken));

  function writeSession(nextSession) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    setCurrentUser(nextSession);
  }

  function patchSessionUser(patch) {
    const session = readSession();
    if (!session) {
      return null;
    }

    const nextSession = {
      ...session,
      ...patch,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };

    writeSession(nextSession);
    return nextSession;
  }

  useEffect(() => {
    const session = readSession();

    if (!session?.accessToken) {
      setBootstrapping(false);
      return;
    }

    // Dev helper: skip backend verification if DEV_BYPASS_AUTH is set
    if (localStorage.getItem('DEV_BYPASS_AUTH') === 'true') {
      setCurrentUser(session);
      setBootstrapping(false);
      return;
    }

    let active = true;

    async function verifySession() {
      try {
        const response = await meRequest(session.accessToken);
        if (!active) {
          return;
        }

        const nextSession = {
          ...session,
          ...response.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
        };
        writeSession(nextSession);
      } catch {
        if (!active) {
          return;
        }

        localStorage.removeItem(SESSION_STORAGE_KEY);
        setCurrentUser(null);
      } finally {
        if (active) {
          setBootstrapping(false);
        }
      }
    }

    verifySession();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      bootstrapping,
      register: async ({ fullName, email, password, phoneNumber }) => {
        try {
          const response = await registerRequest({ fullName, email, password, phoneNumber });
          const session = {
            ...response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          };
          writeSession(session);
          return { ok: true, user: session };
        } catch (error) {
          return { ok: false, message: error.message };
        }
      },
      login: async ({ email, password }) => {
        try {
          const response = await loginRequest({ email, password });
          const session = {
            ...response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          };
          writeSession(session);

          return { ok: true, user: session };
        } catch (error) {
          return { ok: false, message: error.message };
        }
      },
      logout: async () => {
        const session = readSession();

        if (session?.refreshToken) {
          try {
            await logoutRequest(session.refreshToken);
          } catch {
            // Ignore logout network errors and clear local session anyway.
          }
        }

        localStorage.removeItem(SESSION_STORAGE_KEY);
        setCurrentUser(null);
      },
      saveAddress: async ({ label, address }) => {
        const session = readSession();
        if (!session?.accessToken) {
          return { ok: false, message: 'Bạn cần đăng nhập lại để lưu địa chỉ.' };
        }

        try {
          const response = await saveAddressRequest(session.accessToken, { label, address });
          const nextSession = patchSessionUser({ addresses: response.addresses || [] });
          return { ok: true, user: nextSession };
        } catch (error) {
          return { ok: false, message: error.message };
        }
      },
      updateAddress: async ({ addressId, label, address }) => {
        const session = readSession();
        if (!session?.accessToken) {
          return { ok: false, message: 'Bạn cần đăng nhập lại để cập nhật địa chỉ.' };
        }

        try {
          const response = await updateAddressRequest(session.accessToken, addressId, { label, address });
          const nextSession = patchSessionUser({ addresses: response.addresses || [] });
          return { ok: true, user: nextSession };
        } catch (error) {
          return { ok: false, message: error.message };
        }
      },
      deleteAddress: async (addressId) => {
        const session = readSession();
        if (!session?.accessToken) {
          return { ok: false, message: 'Bạn cần đăng nhập lại để xóa địa chỉ.' };
        }

        try {
          const response = await deleteAddressRequest(session.accessToken, addressId);
          const nextSession = patchSessionUser({ addresses: response.addresses || [] });
          return { ok: true, user: nextSession };
        } catch (error) {
          return { ok: false, message: error.message };
        }
      },
    }),
    [bootstrapping, currentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
