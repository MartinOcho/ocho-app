# Solution: Correction du AccountSwitcher - Affichage Multiple des Comptes

## Problème identifié
- Le AccountSwitcher affichait plusieurs fois le compte connecté
- Plusieurs sessions du même device s'affichaient en doublons
- Les sessions n'étaient pas correctement filtrées par device
- Le localStorage n'est pas sécurisé et peut être effacé

## Objectif
Le AccountSwitcher doit permettre de **switcher rapidement entre plusieurs sessions du MÊME device**.

## Changes implémentées

### 1. Modification de l'endpoint `/api/auth/sessions` 
**Fichier:** `ochoapp-client/src/app/api/auth/sessions/route.ts`

**Changements:**
- Récupère le deviceId de la session courante
- **Filtre SEULEMENT** les autres sessions qui partagent le même deviceId
- Exclut la session courante
- Retourne les comptes (sessions) du même device avec leurs infos utilisateur

**Logique:**
```
Session courante → Récupère ses deviceIds
                ↓
Cherche toutes les sessions du user qui ont ces deviceIds
                ↓
Exclut la session courante
                ↓
Retourne les autres comptes du même device
```

**Bénéfices:**
- ✅ Élimine l'affichage multiple (filtre au serveur)
- ✅ Retourne uniquement les sessions du même device
- ✅ Pas de doubles affichages

### 2. Refonte du composant `AccountSwitcher`
**Fichier:** `ochoapp-client/src/components/AccountSwitcher.tsx`

**Changements:**
- Restructuré pour afficher les comptes du même device
- Affiche le nom d'utilisateur, display name et avatar
- Supprimé la complexité des devices
- Interface simple et claire

**Affichage:**
```
Switch Account
├─ [@alice] Alice Martin
├─ [@bob] Bob Johnson
├─ ────────────────────
├─ 🔧 Gérer les comptes
└─ ➕ Ajouter un compte
```

**Bénéfices:**
- ✅ Simple et intuitif
- ✅ Aucune duplication
- ✅ UX claire pour switcher entre comptes

### 3. Endpoint sécurisé `/api/auth/device-id`
**Fichier:** `ochoapp-client/src/app/api/auth/device-id/route.ts`

**Fonctionnalité:**
- Génère un `deviceId` unique côté serveur (UUID v4)
- Stocke le device dans la BD avec la session
- Retourne le deviceId dans un **cookie HTTP-only** (pas localStorage)
- Le cookie persiste pour 1 an

**Sécurité:**
- ✅ Impossible à modifier/effacer depuis JavaScript (HttpOnly)
- ✅ Automatiquement envoyé dans chaque requête
- ✅ Sécurisé en production (Secure flag)
- ✅ Identifie de manière unique le device

### 4. Hook `useDeviceId`
**Fichier:** `ochoapp-client/src/hooks/useDeviceId.ts`

**Fonctionnalité:**
- Initialise le deviceId au chargement
- Gère le state et loading
- Permet au serveur d'associer le deviceId à la session

### 5. DeviceInitializer
**Fichiers:** 
- `ochoapp-client/src/components/DeviceInitializer.tsx` (nouveau)
- `ochoapp-client/src/app/ReactQueryProvider.tsx` (modifié)

**Fonctionnalité:**
- Initialise le deviceId globalement au chargement de l'app
- Appelé une seule fois au démarrage
- Assure que le deviceId est associé à la session

## Architecture finale

```
┌─ Session A (User: Alice, Device: UUID-123)
├─ Session B (User: Bob, Device: UUID-123)
└─ Session C (User: Charlie, Device: UUID-456)

Utilisateur connecté à Session A (Device UUID-123):
    Clique sur "Switch Account"
        ↓
    Endpoint récupère deviceId = UUID-123
        ↓
    Cherche sessions avec deviceId = UUID-123
        ↓
    Retourne Session B (Bob) uniquement
        ↓
    AccountSwitcher affiche Bob pour switcher rapidement
```

## Test de la solution

### Scénario 1: Deux comptes sur le même device
1. Deux onglets du même navigateur (même device)
2. Onglet 1: connecté comme @alice
3. Onglet 2: connecté comme @bob (en login avec switching=true)
4. Dans le menu du compte d'Onglet 1, le AccountSwitcher affiche Bob
5. ✅ Pas de duplication

### Scénario 2: Comptes sur différents devices
1. Device 1 (laptop): Session Alice sur Device-Laptop-UUID
2. Device 2 (phone): Session Bob sur Device-Phone-UUID
3. Dans le AccountSwitcher d'Alice (laptop), Bob n'apparaît PAS
4. ✅ Isolation par device correcte

## Points clés

- ✅ Filtre par **device** (pas par utilisateur global)
- ✅ Exclut la **session courante**
- ✅ DeviceId **persisté côté serveur** en cookie HTTP-only
- ✅ Aucune dépendance au localStorage
- ✅ Schéma Prisma **n'a pas changé** (utilise Device existant)

## Sécurité renforcée

| Aspect | Avant | Après |
|--------|-------|-------|
| DeviceId | localStorage (peut être effacé) | Cookie HTTP-only (sécurisé) |
| Filtre sessions | Client (fragile) | Serveur (robuste) |
| Identification device | Pas de tracking | UUID unique persistent |
| Données retournées | Toutes les sessions | Seulement device courant |
