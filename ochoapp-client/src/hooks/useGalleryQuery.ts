import { useInfiniteQuery } from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import { GalleryMediasSection } from "@/lib/types";

interface UseGalleryQueryProps {
  roomId: string | null;
  enabled?: boolean;
}

export function useGalleryQuery({ roomId, enabled = true }: UseGalleryQueryProps) {
  return useInfiniteQuery({
    queryKey: ["gallery", "medias", roomId],
    queryFn: ({ pageParam }) =>
      kyInstance
        .get(
          `/api/rooms/${roomId}/gallery/medias`,
          pageParam ? { searchParams: { cursor: pageParam } } : {},
        )
        .json<GalleryMediasSection>(),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: false,
    throwOnError: false,
    enabled: !!roomId && enabled,
  });
}
