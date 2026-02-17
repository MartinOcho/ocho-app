// Gestion des comptes multiples
export interface StoredAccount {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

const ACCOUNTS_STORAGE_KEY = "ochoo_accounts";

export function getStoredAccounts(): StoredAccount[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveAccount(account: StoredAccount): void {
  if (typeof window === "undefined") return;
  
  try {
    const accounts = getStoredAccounts();
    const exists = accounts.find(a => a.userId === account.userId);
    
    if (!exists) {
      accounts.push(account);
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    }
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du compte:", error);
  }
}

export function removeAccount(userId: string): void {
  if (typeof window === "undefined") return;
  
  try {
    const accounts = getStoredAccounts();
    const filtered = accounts.filter(a => a.userId !== userId);
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Erreur lors de la suppression du compte:", error);
  }
}

export function clearAllAccounts(): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
  } catch (error) {
    console.error("Erreur lors de la suppression des comptes:", error);
  }
}
