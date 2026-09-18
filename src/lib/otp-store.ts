interface StoredOtp {
  otp: string;
  hashedToken?: string;
  verificationType: 'signup' | 'magiclink' | 'email' | 'reset_password';
  name?: string;
  password?: string;
  expiresAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var _nuviaOtpStore: Map<string, StoredOtp> | undefined;
}

const store = globalThis._nuviaOtpStore ?? new Map<string, StoredOtp>();
globalThis._nuviaOtpStore = store;

export const OtpStore = {
  save(
    email: string,
    otp: string,
    hashedToken: string | undefined,
    verificationType: 'signup' | 'magiclink' | 'email' | 'reset_password',
    name?: string,
    password?: string
  ) {
    store.set(email.toLowerCase().trim(), {
      otp: otp.trim(),
      hashedToken,
      verificationType,
      name,
      password,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
  },

  get(email: string): StoredOtp | null {
    const item = store.get(email.toLowerCase().trim());
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      store.delete(email.toLowerCase().trim());
      return null;
    }
    return item;
  },

  consume(email: string, inputOtp: string): StoredOtp | null {
    const item = this.get(email);
    if (!item) return null;
    if (item.otp === inputOtp.trim()) {
      store.delete(email.toLowerCase().trim());
      return item;
    }
    return null;
  },
};
