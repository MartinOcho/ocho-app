import CreatePostDialog from "@/components/posts/CreatePostDialog";
import TrendsSidebar from "@/components/TrendsSidebar";
import ForYouFeed from "./ForYouFeed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FollowingFeed from "./FollowingFeed";
import SetNavigation from "@/components/SetNavigation";
import { getTranslation } from "@/lib/language";
import { validateRequest } from "@/auth";
import LandingPage from "./LandingPage";

export default async function Home() {
  const { user } = await validateRequest();

  if (!user) {
    return <LandingPage />;
  }

  const { forYou, followings } = await getTranslation();
  return (
    <>
      <SetNavigation navPage="home" />
      <div className="flex h-full w-full max-w-lg min-w-0 flex-col gap-2 overflow-y-auto sm:gap-4 sm:px-1">
        <CreatePostDialog />
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
