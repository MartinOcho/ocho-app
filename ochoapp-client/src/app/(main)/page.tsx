import PostEditor from "@/components/posts/editors/PostEditor";
import TrendsSidebar from "@/components/TrendsSidebar";
import ForYouFeed from "./ForYouFeed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FollowingFeed from "./FollowingFeed";
import SetNavigation from "@/components/SetNavigation";
import { VocabularyKey } from "@/lib/vocabulary";
import { getTranslation } from "@/lib/language";

export default async function Home() {

  const { forYou, followings } = await getTranslation();
  return (
    <>
      <SetNavigation navPage="home" />
      <div className="w-full min-w-0 h-full flex flex-col gap-2 sm:gap-4 max-w-lg overflow-y-auto sm:px-1">
        <PostEditor />
        <Tabs defaultValue="for-you">
          {/* Liste des onglets en haut  */}
          <TabsList>
            <TabsTrigger value="for-you">{forYou}</TabsTrigger>
            <TabsTrigger value="following">{followings}</TabsTrigger>
          </TabsList>
          {/* Liste des contenus en bas */}
          <TabsContent value="for-you" className="pb-2">
            <ForYouFeed />
          </TabsContent>
          <TabsContent value="following" className="pb-2">
            <FollowingFeed />
          </TabsContent>
        </Tabs>
      </div>
      <TrendsSidebar />
    </>
  );
}
