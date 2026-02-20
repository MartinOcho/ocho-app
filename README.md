# 🐙 OchoApp

Une application de réseau social fullstack moderne construite pour les "power nerds" avec une architecture scalable et des fonctionnalités en temps réel.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Structures des projets](#structure-des-projets)
- [Fonctionnalités](#fonctionnalités)
- [Stack technologique](#stack-technologique)
- [Installation](#installation)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [Endpoints API](#endpoints-api)
- [Base de données](#base-de-données)
- [Structure des composants](#structure-des-composants)
- [Guide de développement](#guide-de-développement)

---

## 🎯 Vue d'ensemble

**OchoApp** est une plateforme de réseau social et de messagerie en temps réel offrant une expérience complète :

- 💬 **Messaging**: Chats privés et groupe avec WebSocket temps réel
- 📱 **Posts & Feed**: Fil d'actualité personnalisé et système de contenu
- 🔔 **Notifications**: Système de notification en temps réel
- 👥 **Social**: Système de suivis, suggestions d'amis
- 🔍 **Search**: Recherche full-text intégrée
- ✅ **Verification**: Badges de vérification pour utilisateurs vérifiés
- 🛡️ **Privacy & Safety**: Gestion des confidentialités, blocages, signalements
- 🌍 **Multi-plateforme**: Support Web, Mobile (Android/iOS)
- 🌐 **Internationalisation**: Support multilingue (EN/FR)
- 🎨 **Thème**: Mode sombre/clair natif

---

## 🏗️ Architecture

### Architecture globale

```
ochoapp/
├── ochoapp-client/          # Frontend Next.js + React
│   ├── src/
│   │   ├── app/            # App Router Next.js
│   │   ├── components/     # Composants React réutilisables
│   │   ├── lib/            # Utilitaires, prisma client, types
│   │   ├── hooks/          # Hooks personnalisés
│   │   ├── context/        # Contextes React
│   │   ├── assets/         # Images, icônes
│   │   └── auth.ts         # Lucia Auth config
│   └── prisma/             # Schéma Prisma (partagé)
│
└── ochoapp-server/         # Backend Express.js + Socket.io
    ├── src/
    │   ├── index.ts        # Point d'entrée Express
    │   ├── socket-handlers.ts  # Handlers Socket.io
    │   ├── types.ts        # Types TypeScript
    │   ├── utils.ts        # Fonctions utilitaires
    │   ├── prisma.ts       # Client Prisma singleton
    │   └── scripts/        # Scripts utilitaires
    └── prisma/            # Schéma Prisma (partagé)
```

---

## 📁 Structure des projets

### Frontend (ochoapp-client)

Le frontend est une application Next.js 15+ avec React 19, utilisant l'App Router pour le routage côté serveur.

```
ochoapp-client/
├── public/
│   ├── legal/              # Pages légales (EN, FR)
│   └── logos/              # Logos et assets
│
├── src/
│   ├── app/
│   │   ├── (auth)/         # Routes d'authentification (login, signup)
│   │   ├── (main)/         # Routes principales (feed, posts, profil)
│   │   ├── (mobile)/       # Routes mobiles (Android download)
│   │   ├── api/            # Route handlers API
│   │   │   ├── auth/       # Endpoints d'authentification
│   │   │   ├── posts/      # Endpoints posts (CRUD, likes, bookmarks)
│   │   │   ├── messages/   # Endpoints messagerie (rooms, messages)
│   │   │   ├── users/      # Endpoints utilisateurs (profil, follow)
│   │   │   ├── search/     # Endpoint recherche
│   │   │   ├── notifications/  # Endpoints notifications
│   │   │   ├── upload/     # Endpoints upload (avatar, attachements)
│   │   │   └── android/    # API Android spécifique
│   │   ├── layout.tsx      # Root layout
│   │   ├── globals.css     # Styles globaux
│   │   └── gradients.css   # Dégradés CSS
│   │
│   ├── components/
│   │   ├── posts/          # Composants posts/feed
│   │   ├── comments/       # Composants commentaires
│   │   ├── messages/       # Composants messagerie
│   │   ├── settings/       # Composants paramètres
│   │   ├── search/         # Composants recherche
│   │   ├── users/          # Composants utilisateurs
│   │   ├── ui/             # Composants UI Radix + Tailwind
│   │   ├── providers/      # Providers (Theme, etc)
│   │   ├── logos/          # Composants logos
│   │   └── [autres]/       # Autres composants
│   │
│   ├── lib/
│   │   ├── prisma.ts       # Client Prisma
│   │   ├── ky.ts           # Instance HTTP (ky)
│   │   ├── types.ts        # Types TypeScript globaux
│   │   ├── validation.ts   # Schémas Zod
│   │   ├── formatters.ts   # Fonctions de formatage
│   │   ├── fileUtils.ts    # Utilitaires fichiers
│   │   ├── language.ts     # Configuration i18n
│   │   └── [autres]/       # Autres utilitaires
│   │
│   ├── hooks/
│   │   ├── useDeviceId.ts        # Identifiant unique appareil
│   │   ├── useFollowerInfo.ts    # Info suiveurs
│   │   ├── useOnline.ts          # Statut online
│   │   ├── useSafeFetch.ts       # Fetch sécurisé
│   │   ├── useMediaUpload.ts     # Upload média
│   │   └── [autres]/             # Autres hooks
│   │
│   ├── context/
│   │   ├── ChatContext.tsx      # État messagerie
│   │   ├── LanguageContext.tsx  # État langue
│   │   ├── MenuBarContext.tsx   # État menu
│   │   ├── NavigationContext.tsx # État navigation
│   │   └── [autres]/            # Autres contextes
│   │
│   ├── types/
│   │   └── [types files]        # Types spécifiques par domaine
│   │
│   ├── assets/                  # Images, icônes
│   └── auth.ts                  # Config Lucia Auth
│
├── prisma/
│   ├── schema.prisma            # Schéma de la base de données
│   └── migrations/              # Migrations Prisma
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts           # Config Tailwind CSS
├── next.config.mjs              # Config Next.js
├── postcss.config.mjs           # Config PostCSS
└── components.json              # Config shadcn/ui
```

### Backend (ochoapp-server)

Le backend est une application Express.js avec Socket.io pour la communication temps réel.

```
ochoapp-server/
├── src/
│   ├── index.ts                 # Point d'entrée Express
│   ├── prisma.ts                # Client Prisma singleton
│   ├── types.ts                 # Types TypeScript (Socket.io, etc)
│   ├── utils.ts                 # Fonctions utilitaires
│   ├── socket-handlers.ts       # Handlers Socket.io
│   ├── mention-utils.ts         # Utilitaires mentions
│   └── scripts/                 # Scripts utilitaires
│
├── prisma/
│   ├── schema.prisma            # Schéma de la base de données (partagé)
│   └── migrations/              # Migrations Prisma
│
├── package.json
├── tsconfig.json
├── nodemon.json                 # Config nodemon
└── [env files]                  # Fichiers d'environnement
```

---

## 🎯 Fonctionnalités

### 1. **Authentification & Session**
- ✅ Lucia Auth avec stratégies multiples
- ✅ OAuth: Google, GitHub, Facebook
- ✅ Email/Password avec hachage Argon2
- ✅ Gestion des sessions multi-appareils
- ✅ Support Device ID pour mobile

### 2. **Fil d'actualité & Posts**
- ✅ Création/édition/suppression de posts
- ✅ Système de likes avec décomptage en temps réel
- ✅ Commentaires imbriqués (réponses aux commentaires)
- ✅ Système de bookmarks personnes
- ✅ Score de pertinence des posts
- ✅ Full-text search in posts
- ✅ Hashtags et mentions d'utilisateurs

### 3. **Messagerie Temps Réel**
- ✅ Chats privés et groupe
- ✅ Communication WebSocket via Socket.io
- ✅ Reçus de lecture (read receipts)
- ✅ Reçus de livraison (delivery receipts)
- ✅ Réactions aux messages (emojis)
- ✅ Attachements fichiers
- ✅ Galerie média par room
- ✅ Sauvegarde de messages temporaires
- ✅ Invitation members, kick, ban
- ✅ Statut typing/uploading

### 4. **Système Social**
- ✅ Followers/Following
- ✅ Suggestions d'amis
- ✅ Profils utilisateurs détaillés
- ✅ Badges de vérification (STANDARD, GOLDEN)
- ✅ Bio avec support mentions/liens
- ✅ Avatar and cover image customizable

### 5. **Notifications**
- ✅ Notifications en temps réel
- ✅ Statut read/unread
- ✅ Types: like, comment, follow, mention, etc.
- ✅ Notifications dans-app et push (Android)
- ✅ Décompte notifications non lues

### 6. **Protection & Confidentialité**
- ✅ Système de blocage utilisateurs
- ✅ Gestion des confidentialités par utilisateur
- ✅ Signalements de contenu (flags)
- ✅ Suppression de compte
- ✅ Désactivation de compte
- ✅ Historique de recherche
- ✅ Export des données utilisateur

### 7. **Tendances & Découverte**
- ✅ Hashtags tendance
- ✅ Feed personnalisé (For You)
- ✅ Feed suivis (Following)
- ✅ Recherche textuelle avancée

### 8. **Multi-plateforme**
- ✅ Application Web (Next.js)
- ✅ API mobile dédiée (Android/iOS)
- ✅ Support device-specific endpoints
- ✅ Download Android APK

---

## 🛠️ Stack technologique

### Frontend
| Catégorie | Technologies |
|-----------|-------------|
| **Framework** | Next.js 15.5+, React 19 RC |
| **Language** | TypeScript 5+ |
| **Styling** | Tailwind CSS, Radix UI |
| **Forms** | React Hook Form, Zod |
| **Data Fetching** | TanStack React Query, ky |
| **State** | React Context, React Query |
| **Éditeur** | TipTap (Markdown + Mentions) |
| **Upload** | UploadThing, Cloudinary |
| **Animation** | Framer Motion, Embla Carousel |
| **Socket** | Socket.io Client |
| **Auth** | Lucia Auth |
| **UI Components** | shadcn/ui (Radix UI) |
| **Icônes** | Lucide React |
| **i18n** | Traductions custom (EN/FR) |
| **Thème** | next-themes (dark/light) |

### Backend
| Catégorie | Technologies |
|-----------|-------------|
| **Framework** | Express.js 5+ |
| **Language** | TypeScript 5+ |
| **WebSocket** | Socket.io 4.8+ |
| **Database** | PostgreSQL avec Prisma ORM |
| **Auth** | JWT, Cookies, Lucia |
| **Upload** | Multer, Cloudinary |
| **Password** | Argon2, Bcrypt |
| **Validation** | Zod |
| **CORS** | cors middleware |
| **Logger** | Chalk |
| **Dev Tools** | Nodemon, ts-node |

### Infrastructure
- **Database**: PostgreSQL (Vercel Postgres)
- **Storage**: Cloudinary (images/vidéos)
- **Deployment**: Vercel (Frontend)
- **ORM**: Prisma 5+

---

## 📦 Installation

### Prérequis

- **Node.js** v18+ et **npm**/**yarn**
- **PostgreSQL** 12+ (local ou cloud)
- Comptes API:
  - Cloudinary (upload)
  - OAuth providers (Google, GitHub, Facebook)

### 1. Cloner le repository

```bash
git clone https://github.com/username/ocho-app.git
cd ocho-app
```

### 2. Installer les dépendances

#### Frontend
```bash
cd ochoapp-client
npm install
```

#### Backend
```bash
cd ../ochoapp-server
npm install
```

### 3. Configuration des variables d'environnement

#### Frontend (`ochoapp-client/.env.local`)

```env
# Database
POSTGRES_PRISMA_URL=postgresql://user:password@localhost:5432/ochoapp
POSTGRES_URL_NON_POOLING=postgresql://user:password@localhost:5432/ochoapp

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxx
CLOUDINARY_API_SECRET=xxxxx

# OAuth
GITHUB_ID=xxxxx
GITHUB_SECRET=xxxxx

GOOGLE_ID=xxxxx
GOOGLE_SECRET=xxxxx

FACEBOOK_ID=xxxxx
FACEBOOK_SECRET=xxxxx

# UploadThing
UPLOADTHING_SECRET=xxxxx
NEXT_PUBLIC_UPLOADTHING_APP_ID=xxxxx

# Server
NEXT_PUBLIC_SERVER_URL=http://localhost:5000

# i18n
NEXT_PUBLIC_DEFAULT_LANGUAGE=en
```

#### Backend (`ochoapp-server/.env`)

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Database
POSTGRES_PRISMA_URL=postgresql://user:password@localhost:5432/ochoapp
POSTGRES_URL_NON_POOLING=postgresql://user:password@localhost:5432/ochoapp

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxx
CLOUDINARY_API_SECRET=xxxxx

# JWT/Auth (optionnel si Lucia utilisé)
JWT_SECRET=your-super-secret-key
```

### 4. Configuration de la base de données

#### Créer la base de données

```bash
createdb ochoapp
```

#### Exécuter les migrations

```bash
# Frontend (qui a prisma)
cd ochoapp-client
npx prisma migrate deploy

# ou créer la base depuis le schéma
npx prisma db push
```

#### (Optionnel) Seeder initial

```bash
cd ochoapp-client
npx prisma db seed
```

---

## 🚀 Démarrage

### Mode Développement

#### Terminal 1 - Backend
```bash
cd ochoapp-server
npm run dev
# Serveur à http://localhost:5000
# WebSocket à ws://localhost:5000
```

#### Terminal 2 - Frontend
```bash
cd ochoapp-client
npm run dev
# Application à http://localhost:3000
```

### Mode Production

#### Build Frontend
```bash
cd ochoapp-client
npm run build
npm start
```

#### Build Backend
```bash
cd ochoapp-server
npm run build
npm start
```

### Prisma Studio (optionnel)
```bash
cd ochoapp-client
npm run prisma
# Interface graphique à http://localhost:5555
```

---

## 🔌 Endpoints API

### Authentication (`/api/auth/`)
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/auth/login` | POST | Login email/password |
| `/api/auth/signup` | POST | Inscription nouvel utilisateur |
| `/api/auth/logout-session` | POST | Logout session actuelle |
| `/api/auth/callback/google` | GET | OAuth Google callback |
| `/api/auth/callback/github` | GET | OAuth GitHub callback |
| `/api/auth/callback/facebook` | GET | OAuth Facebook callback |
| `/api/auth/password` | PUT | Modifier mot de passe |
| `/api/auth/device-id` | POST | Définir device ID |
| `/api/auth/sessions` | GET | Lister toutes les sessions |

### Posts (`/api/posts/`)
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/posts` | POST | Créer un post |
| `/api/posts/[postId]` | GET/PUT/DELETE | Opérations post |
| `/api/posts/[postId]/likes` | GET/POST/DELETE | Gérer les likes |
| `/api/posts/[postId]/comments` | GET/POST | Commentaires |
| `/api/posts/[postId]/bookmark` | POST/DELETE | Bookmarks |
| `/api/posts/[postId]/relevance` | POST | Tracker pertinence |
| `/api/posts/for-you` | GET | Feed personnalisé |
| `/api/posts/following` | GET | Feed suivi |
| `/api/posts/bookmarked` | GET | Posts bookmarkés |

### Messages (`/api/messages/`)
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/messages/rooms` | GET/POST | Lister/créer rooms |
| `/api/messages/rooms/[roomId]` | GET/PUT/DELETE | Opérations room |
| `/api/messages/rooms/[roomId]/messages` | GET/POST | Messages de la room |
| `/api/messages/[messageId]/reactions` | GET/POST/DELETE | Réactions |
| `/api/messages/[messageId]/reads` | GET/POST | Reçus de lecture |
| `/api/messages/[messageId]/deliveries` | GET/POST | Reçus de livraison |
| `/api/messages/unread-count` | GET | Total non lus |

### Users (`/api/users/`)
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/users` | GET/PUT | Profil utilisateur |
| `/api/users/[userId]` | GET | Profil utilisateur autre |
| `/api/users/[userId]/followers` | GET | Followers utilisateur |
| `/api/users/[userId]/posts` | GET | Posts utilisateur |
| `/api/users/following` | GET | Utilisateurs suivis |
| `/api/users/followers` | GET | Followers actuels |
| `/api/users/followers/request` | POST | Demande follow |
| `/api/users/delete` | DELETE | Supprimer compte |
| `/api/users/disable` | PUT | Désactiver compte |
| `/api/users/export` | GET | Exporter données |

### Notifications (`/api/notifications/`)
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/notifications` | GET | Lister notifications |
| `/api/notifications/unread-count` | GET | Décompte non lues |
| `/api/notifications/mark-as-read` | PUT | Marquer comme lues |
| `/api/notifications/identify` | POST | Identifier utilisateur |

### Search (`/api/search/`)
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/search` | GET | Recherche posts/utilisateurs |

### Upload (`/api/upload/`)
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/upload/avatar` | POST | Upload avatar |
| `/api/upload/attachment` | POST | Upload attachment |
| `/api/upload/group-chat-avatar` | POST | Upload avatar groupe |

---

## 🗄️ Base de données

### Schéma Prisma

La base de données utilise PostgreSQL avec Prisma ORM. Voici les modèles principaux :

#### **User** (Utilisateurs)
```prisma
- id, username, displayName, email
- passwordHash, googleId, githubId, facebookId
- avatarUrl, bio, verified (badges)
- relations: sessions, follows, posts, comments, bookmarks
- isOnline, lastSeen, createdAt
```

#### **Post** (Posts/Articles)
```prisma
- id, content, userId
- relations: likes, comments, bookmarks, attachments
- tags, mentions
- createdAt, updatedAt
```

#### **Comment** (Commentaires)
```prisma
- id, content, postId, userId
- relations: replies, likes, mentions
- createdAt
```

#### **Room** (Salons message)
```prisma
- id, name, description, isGroup
- members, messages, groupAvatarUrl
- privilege, maxMembers
- createdAt
```

#### **Message** (Messages)
```prisma
- id, content, senderId, roomId
- type: CONTENT, CREATE, DELETE, NEWMEMBER, LEAVE, BAN
- relations: reads, deliveries, reactions, attachments, mentions
- createdAt
```

#### **Notification** (Notifications)
```prisma
- id, recipientId, issuerId
- type: LIKE, COMMENT, FOLLOW, MENTION, etc.
- targetId (postId, commentId, userId)
- isRead, createdAt
```

#### **Follow** (Relations suivis)
```prisma
- followerId, followingId (relations bidirectionnelles)
```

#### **VerifiedUsers** (Vérification)
```prisma
- userId, type: STANDARD | GOLDEN
- expiresAt (optionnel)
```

---

## ⚙️ Structure des composants

### Organisation des composants

#### **Composants UI** (`src/components/ui/`)
Composants Radix UI réutilisables (buttons, inputs, dialogs, etc.)

```typescript
- Button.tsx         // Bouton standard
- Input.tsx          // Champ input
- Dialog.tsx         // Modal dialog
- Select.tsx         // Selecteur
- Tabs.tsx           // Onglets
- Toaster.tsx        // Toast notifications
- [autres]/          // Autres composants Radix
```

#### **Composants de Domaine**

##### Posts (`src/components/posts/`)
- `Post.tsx` - Composant post affichage
- `PostForm.tsx` - Formulaire création post
- `PostActions.tsx` - Boutons (like, comment, bookmark)
- `PostComments.tsx` - Section commentaires

##### Commentaires (`src/components/comments/`)
- `CommentList.tsx` - Liste commentaires
- `CommentForm.tsx` - Formulaire commentaire
- `Reply.tsx` - Réponse commentaire
- `CommentActions.tsx` - Actions commentaire

##### Messages (`src/components/messages/`)
- `ChatWindow.tsx` - Fenêtre chat
- `MessageList.tsx` - Liste messages
- `MessageInput.tsx` - Input message
- `RoomList.tsx` - Liste rooms
- `RoomHeader.tsx` - En-tête room

##### Utilisateurs (`src/components/users/`)
- `UserCard.tsx` - Carte utilisateur
- `UserProfile.tsx` - Profil utilisateur
- `FollowButton.tsx` - Bouton follow
- `UserAvatar.tsx` - Avatar utilisateur
- `UserTooltip.tsx` - Tooltip au survol

##### Recherche (`src/components/search/`)
- `SearchField.tsx` - Champ recherche
- `SearchResults.tsx` - Résultats recherche

##### Paramètres (`src/components/settings/`)
- `SettingsMenu.tsx` - Menu paramètres
- `ProfileSettings.tsx` - Paramètres profil
- `PrivacySettings.tsx` - Paramètres confidentialité
- `SessionsManager.tsx` - Gestion sessions

#### **Providers** (`src/components/providers/`)
- `ThemeProvider.tsx` - Gestion thème dark/light
- `QueryProvider.tsx` - Configuration React Query

---

## 📚 Guide de développement

### Arborescence des hooks personnalisés

```typescript
// useDeviceId.ts - Identifiant unique appareil
const { deviceId } = useDeviceId();

// useOnline.ts - Détection connectivité
const { isOnline } = useOnline();

// useFollowerInfo.ts - Infos followers
const { followers, following } = useFollowerInfo(userId);

// useSafeFetch.ts - Requêtes HTTP sécurisées
const { data, loading, error } = useSafeFetch(url);

// useMediaUpload.ts - Upload média
const { upload, progress } = useMediaUpload();

// useServerAction.ts - Server actions
const { execute, loading } = useServerAction(action);
```

### Contextes disponibles

```typescript
// ChatContext - État messagerie
const { currentRoom, setCurrentRoom } = useContext(ChatContext);

// LanguageContext - Langue actuelle
const { language, setLanguage } = useContext(LanguageContext);

// NavigationContext - Navigation
const { navigate } = useContext(NavigationContext);

// MenuBarContext - État menu
const { isOpen, setIsOpen } = useContext(MenuBarContext);

// ProgressContext - Barre progression
const { startNavigation } = useContext(ProgressContext);
```

### Socket.io Events (Client)

```typescript
// Messagerie
socket.on('message:send', (message) => {})
socket.on('message:delete', (messageId) => {})
socket.on('message:reaction', (reaction) => {})
socket.on('message:read', (messageId) => {})
socket.on('message:delivered', (messageId) => {})

// Status utilisateur
socket.on('user:online', (userId) => {})
socket.on('user:offline', (userId) => {})
socket.on('user:typing', (roomId, userId) => {})
socket.on('user:uploading', (roomId, userId) => {})

// Notifications
socket.on('notification:new', (notification) => {})

// Chat rooms
socket.on('room:member-added', (roomId, userId) => {})
socket.on('room:member-removed', (roomId, userId) => {})
```

### Patterns de validation

Utilisation de **Zod** pour la validation côté client:

```typescript
import { z } from 'zod';

const PostSchema = z.object({
  content: z.string().min(1).max(280),
  attachments: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
});

type PostData = z.infer<typeof PostSchema>;
```

### Patterns d'async/await

```typescript
// Fetch sécurisé avec ky
const data = await kyInstance.post('/api/posts', { json: postData }).json();

// React Query mutation
const mutation = useMutation({
  mutationFn: (newPost) => kyInstance.post('/api/posts', { json: newPost }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] })
});

// Server actions
'use server'
export async function createPost(formData) {
  const { user } = await validateRequest();
  if (!user) throw new Error('Unauthorized');
  // ... logique serveur
}
```

### Composants avec Radix UI

```typescript
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// Utilisation directe
<Button onClick={handleClick}>Click me</Button>
<Dialog>
  <DialogContent>Content here</DialogContent>
</Dialog>
```

---

## 🔧 Build & Deployment

### Build Optimisé

```bash
# Frontend
cd ochoapp-client
npm run build

# Backend (si nécessaire)
cd ../ochoapp-server
npm run build
```

### Deployment Vercel (Frontend)

```bash
# Installer Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Checklist pré-production

- [ ] Variables d'env configurées
- [ ] Base de données migrée
- [ ] Build sans erreurs
- [ ] Tests passant
- [ ] CORS correctement configuré
- [ ] SSL/HTTPS activé
- [ ] Cloudinary configuré
- [ ] OAuth tokens validés
- [ ] Monitoring mis en place

---

## 📝 Conventions de code

### TypeScript
- Types stricts (`strict: true`)
- Pas d'utilisation de `any`
- Interfaces nommées explicitement

### Composants React
- Utiliser FC ou fonction normale
- Props bien typées
- Hooks en début de composant
- Séparation logique/présentation

### Noms
- Components: PascalCase
- Fonctions/variables: camelCase
- Constantes: UPPER_CASE
- Fichiers composants: PascalCase.tsx
- Fichiers utilitaires: kebab-case.ts

---

## 🚨 Dépannage

### Issue: Migration Prisma échoue
```bash
# Réinitialiser (ATTENTION: Perte de données)
npx prisma db push --skip-generate

# ou migrer manuellement
npx prisma migrate resolve --rolled-back "migration_name"
```

### Issue: Socket.io ne se connecte pas
- Vérifier CLIENT_URL dans backend
- CORS configuré correctement
- Firewall/proxy pas bloqué
- Socket URL correcte en frontend

### Issue: Upload Cloudinary échoue
- Vérifier credentials Cloudinary
- Vérifier permissions cloud
- Taille fichier < limite

### Issue: PostgreSQL connexion refused
- Service PostgreSQL lancé
- URL connexion correcte
- Base créée
- User a les bonnes permissions

---

## 📖 Documentation supplémentaire

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Socket.io Documentation](https://socket.io/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Zod Documentation](https://zod.dev)
- [React Hook Form Documentation](https://react-hook-form.com/)

---

## 📄 License

Ce projet est sous [License MIT](LICENSE).

---

## 🤝 Contribution

Les contributions sont bienvenues! Pour contribuer:

1. Fork le repository
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add some amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

---

## 👨‍💻 Développement

### Monorepo Workspace

Ce projet utilise VS Code Workspaces pour gérer le monorepo:

```bash
# Ouvrir le workspace
code ochoapp.code-workspace

# Cela ouvre les deux dossiers:
# - ochoapp-server/
# - ochoapp-client/
```

### Tasks VS Code

Des tasks sont disponibles pour build/run:

```bash
# Ctrl+Shift+B (ou Cmd+Shift+B) pour builder
```

---

**Fait avec ❤️ pour les power nerds.**

Pour des questions ou support, vous pouvez contacter l'équipe de développement ou ouvrir une issue.

Last Updated: 20 février 2026
