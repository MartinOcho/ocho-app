# Pattern de Typage Strict pour React Query + Socket

## Vue d'ensemble

Ce document explique le pattern de typage strict implémenté pour éviter les erreurs runtime lors du traitement des données du socket et de la mise à jour du cache React Query.

## Problème original

Sans typage strict:
```tsx
queryClient.setQueryData(
  ["gallery", "medias", roomId],
  (oldData) => {
    // ❌ Risque: accès à oldData.pages sans vérifier que oldData existe
    // ❌ Risque: accès à page.medias sans vérifier que page existe
    return {
      ...oldData,
      pages: oldData.pages?.map((page) => ({
        ...page,
        medias: [...newMedias, ...page.medias] // oldData peut être undefined
      }))
    };
  }
);
```

**Problèmes:**
- `oldData` peut être undefined
- `oldData.pages` peut ne pas être un array
- Chaque `page` peut être undefined ou mal formé
- Les données peuvent être corrompues en cache

## Solution: Typage Generic avec Guards

### 1. Importer les types

```tsx
import { InfiniteData } from "@tanstack/react-query";
import { GalleryMediasSection } from "@/lib/types";
import {
  validateGalleryMedias,
  isValidGalleryMedia,
} from "@/lib/validation-types";
```

### 2. Utiliser setQueryData avec type generic

```tsx
queryClient.setQueryData<InfiniteData<GalleryMediasSection>>(
  ["gallery", "medias", roomId],
  (oldData) => {
    // TypeScript SAIT maintenant que oldData est InfiniteData<GalleryMediasSection> | undefined
    // ...
  }
);
```

### 3. Ajouter des guards progressifs

```tsx
queryClient.setQueryData<InfiniteData<GalleryMediasSection>>(
  ["gallery", "medias", roomId],
  (oldData) => {
    // Guard 1: Existence et structure de base
    if (
      !oldData ||
      !Array.isArray(oldData.pages) ||
      oldData.pages.length === 0
    ) {
      return oldData; // Retour sûr si les données ne sont pas valides
    }

    // Guard 2: Traiter chaque page
    const newPages = oldData.pages.map((page, index) => {
      // Guard 3: Vérifier que la page existe
      if (index !== 0 || !page) return page;

      // Guard 4: Valider les données de la page
      const pageMedias = validateGalleryMedias(page.medias ?? []);

      // Guard 5: Vérifier les données entrantes
      const existingIds = new Set(pageMedias.map((m) => m.id));
      const newMedias = validMedias.filter(
        (m) => !existingIds.has(m.id)
      );

      if (newMedias.length === 0) return page;

      // Update sûr avec données valides
      return {
        ...page,
        medias: [...newMedias, ...pageMedias],
      };
    });

    return {
      ...oldData,
      pages: newPages,
    };
  }
);
```

## Comparaison avant/après

### Avant (risqué)
```tsx
// ❌ Pas de typage
queryClient.setQueryData(queryKey, (oldData) => {
  return {
    ...oldData,
    pages: oldData.pages?.map((page) => ({
      ...page,
      medias: [...newMedias, ...page.medias]
    }))
  };
});
```

### Après (sécurisé)
```tsx
// ✅ Typage strict + guards
queryClient.setQueryData<InfiniteData<GalleryMediasSection>>(
  queryKey,
  (oldData) => {
    if (!oldData?.pages?.length) return oldData;
    
    return {
      ...oldData,
      pages: oldData.pages.map((page, i) => {
        if (i !== 0 || !page) return page;
        const pageMedias = validateGalleryMedias(page.medias ?? []);
        const newMedias = validMedias.filter(
          (m) => !existingIds.has(m.id)
        );
        return newMedias.length 
          ? { ...page, medias: [...newMedias, ...pageMedias] }
          : page;
      }),
    };
  }
);
```

## Type Guards Disponibles

### Gallery Media
```tsx
import { isValidGalleryMedia, validateGalleryMedias } from "@/lib/validation-types";

// Type guard
if (isValidGalleryMedia(media)) {
  // media est maintenant typé comme GalleryMedia
}

// Validation en masse
const validMedias = validateGalleryMedias(event.medias ?? []);
```

### Message Attachments
```tsx
import { isValidMessageAttachment, validateMessageAttachments } from "@/lib/validation-types";

const validAttachments = validateMessageAttachments(message.attachments ?? []);
```

### Messages
```tsx
import { isValidMessageData, validateMessages } from "@/lib/validation-types";

const validMessages = validateMessages(data ?? []);
```

## Patterns React Query + Socket

### Pattern 1: Validation au point d'entrée

```tsx
const handleGalleryUpdated = (event: SocketGalleryUpdatedEvent) => {
  // ✅ Valider immédiatement les données du socket
  const validMedias = validateGalleryMedias(event.medias ?? []);
  
  if (validMedias.length === 0) {
    console.warn("Aucun média valide reçu");
    return;
  }

  // Utiliser validMedias pour les opérations
};
```

### Pattern 2: Validation avant rendu

```tsx
// ✅ Valider avant d'afficher
const safeMedias = validateGalleryMedias(displayedMedias);

return (
  <div>
    {safeMedias.map((media) => {
      // ✅ Guard final au rendu
      if (!isValidGalleryMedia(media)) return null;
      return <MediaThumbnail key={media.id} media={media} />;
    })}
  </div>
);
```

### Pattern 3: Validation au niveau du cache

```tsx
queryClient.setQueryData<InfiniteData<GalleryMediasSection>>(
  queryKey,
  (oldData) => {
    // ✅ Valider la structure du cache
    if (!oldData?.pages?.length) return oldData;

    return {
      ...oldData,
      pages: oldData.pages.map((page, i) => {
        if (i !== 0 || !page) return page;
        
        // ✅ Valider les données de la page
        const pageMedias = validateGalleryMedias(page.medias ?? []);
        
        return {
          ...page,
          medias: [...newMedias, ...pageMedias],
        };
      }),
    };
  }
);
```

## Checklist de sécurité

Avant de mettre à jour le cache avec setQueryData:

- [ ] Importer le type Generic approprié (`InfiniteData<T>`)
- [ ] Typer `setQueryData<InfiniteData<T>>()`
- [ ] Vérifier la structure de base (`!oldData?.pages?.length`)
- [ ] Valider chaque page avant accès
- [ ] Valider les données entrantes avec les fonctions de validation
- [ ] Vérifier les doublons pour les tableaux append
- [ ] Tester avec des données invalides/partielles
- [ ] Ajouter des warnings pour les données invalides en console

## Avantages

✅ **Type-safe**: TypeScript empêche les accès invalides
✅ **Runtime-safe**: Les guards préviennent les crashes
✅ **Maintainable**: Code clair et intention explicite
✅ **Debuggable**: Les warnings en console aident au diagnostic
✅ **Testable**: Chaque validation peut être testée isolément
✅ **Réutilisable**: Les fonctions de validation peuvent être réutilisées

## Références

- [React Query Documentation](https://tanstack.com/query/latest)
- [TypeScript Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
- Pattern inspiré par Chat.tsx (gestion des messages)
