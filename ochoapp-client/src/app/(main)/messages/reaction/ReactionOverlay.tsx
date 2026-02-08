import { MessageData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Plus, Search, X, Reply, Copy, Forward, Trash2, HeartOff, Heart } from "lucide-react";
import { useState, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { SKIN_TONES, QUICK_REACTIONS, EMOJI_CATEGORIES } from "../lists/emoji-lists";
import { MessageBubbleContent } from "../Message";
import UserAvatar from "@/components/UserAvatar";
import { useSession } from "../../SessionProvider";
import Time from "@/components/Time";
import { useTranslation } from "@/context/LanguageContext";
import { useActiveRoom } from "@/context/ChatContext";

export interface ReactionData {
  content: string;
  count: number;
  hasReacted: boolean;
  users: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    username: string;
    reactedAt?: Date; // Ajouté pour le support du timestamp
  }[];
}

const applySkinTone = (
  emojiChar: string,
  supportsSkinTone: boolean,
  toneModifier: string,
) => {
  if (!supportsSkinTone || !toneModifier) return emojiChar;
  return emojiChar + toneModifier;
};

// --- COMPOSANT PRINCIPAL DE L'OVERLAY (Picker) ---
export default function ReactionOverlay({
  message,
  originalRect,
  onClose,
  isOwner,
  unavailableMessage,
  onDeleteRequest,
  onReact,
  currentReactions
}: {
  message: MessageData;
  originalRect: DOMRect;
  onClose: () => void;
  isOwner: boolean;
  unavailableMessage: string;
  onDeleteRequest: () => void;
  onReact: (emoji: string) => void;
  currentReactions: ReactionData[];
}){
  const { t } = useTranslation();
  const [verticalOffset, setVerticalOffset] = useState(0);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [currentSkinTone, setCurrentSkinTone] = useState(SKIN_TONES[0]);
  const [mounted, setMounted] = useState(false);

  const hasReactedWith = (emoji: string) => {
      return currentReactions.some(r => r.content === emoji && r.hasReacted);
  }

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useLayoutEffect(() => {
    const windowHeight = window.innerHeight;
    const spaceBelow = windowHeight - originalRect.bottom;
    const MENU_HEIGHT_ESTIMATE = 400;

    if (spaceBelow < MENU_HEIGHT_ESTIMATE) {
      const neededShift = MENU_HEIGHT_ESTIMATE - spaceBelow + 20;
      setVerticalOffset(-neededShift);
    }
  }, [originalRect]);

  const handleReact = (emoji: string) => {
    onReact(emoji); 
    onClose();
  };

  const overlayContent = (
    <div className="fixed inset-0 isolate z-50 flex flex-col font-sans">
      <div
        className={cn(
          "absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity duration-200",
          mounted ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />

      <div
        className="absolute transition-transform duration-300 ease-out will-change-transform pointer-events-none"
        style={{
          top: originalRect.top,
          left: originalRect.left,
          width: originalRect.width,
          height: originalRect.height,
          transform: `translateY(${verticalOffset}px)`,
        }}
      >
        <div className={cn("pointer-events-none z-20 h-fit w-full scale-100 origin-top-left flex", isOwner ? "justify-end" : "justify-start")}>
          <MessageBubbleContent
            message={message}
            isOwner={isOwner}
            unavailableMessage={unavailableMessage}
            isClone={true}
            createdAt={message.createdAt}
          />
        </div>

        <div
          className={cn(
            "absolute top-full z-10 mt-2 flex flex-col gap-2 transition-all duration-300",
            isOwner ? "right-0 items-end" : "left-0 items-start",
            mounted ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
          )}
        >
          <div
            className={cn(
              "flex w-[320px] flex-col gap-2 transition-all duration-300",
              isOwner ? "items-end" : "items-start",
            )}
          >
            {!showFullPicker ? (
              <div
                className={cn(
                  "pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-popover p-1.5 shadow-2xl animate-in zoom-in-95",
                  isOwner ? "origin-top-right" : "origin-top-left",
                )}
              >
                {QUICK_REACTIONS.map((emoji) => {
                   const isActive = hasReactedWith(emoji);
                   return (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className={cn(
                        "font-emoji flex size-10 max-sm:size-8 max-sm:text-xl cursor-pointer items-center justify-center rounded-full text-2xl transition-transform hover:scale-125 active:scale-95",
                        isActive ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"
                    )}
                  >
                    {emoji}
                  </button>
                )})}
                <div className="mx-1 h-6 w-[1px] bg-border"></div>
                <button
                  onClick={() => setShowFullPicker(true)}
                  className="flex size-10 max-sm:size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                >
                  <Plus size={20} />
                </button>
              </div>
            ) : (
              <div
                className={cn(
                  "pointer-events-auto flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl duration-200 animate-in zoom-in-95",
                  isOwner ? "origin-top-right" : "origin-top-left",
                )}
              >
                {/* Search Bar */}
                <div className="flex items-center gap-2 border-b border-border p-3">
                  <Search size={16} className="text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={(t('search') + "...")}
                    autoFocus
                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => setShowFullPicker(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X size={16} />
                  </button>
                </div>
                {/* Skin Tones */}
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Teint
                  </span>
                  <div className="flex gap-1">
                    {SKIN_TONES.map((tone) => (
                      <button
                        key={tone.id}
                        onClick={() => setCurrentSkinTone(tone)}
                        className={cn(
                          "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                          currentSkinTone.id === tone.id
                            ? "scale-110 border-primary"
                            : "border-transparent",
                        )}
                        style={{ backgroundColor: tone.color }}
                      />
                    ))}
                  </div>
                </div>
                {/* Emoji Grid */}
                <div className="h-64 overflow-y-auto p-2 scrollbar-thin">
                  {EMOJI_CATEGORIES.map((cat) => {
                    const { icon: Icon } = cat;
                    return (
                      <div key={cat.id} className="mb-4">
                        <h3 className="sticky top-0 z-10 mb-2 flex items-center gap-1 bg-popover/95 px-1 py-1 text-xs font-bold text-muted-foreground backdrop-blur">
                          <Icon size={18} /> {cat.name}
                        </h3>
                        <div className={cn("grid grid-cols-7 gap-1 font-emoji")}>
                          {cat.emojis.map((emojiObj, idx) => {
                            const finalEmoji = applySkinTone(
                              emojiObj.char,
                              emojiObj.s,
                              currentSkinTone.modifier,
                            );
                            const isActive = hasReactedWith(finalEmoji);
                            return (
                              <button
                                key={idx}
                                onClick={() => handleReact(finalEmoji)}
                                className={cn(
                                    "flex h-9 w-9 cursor-pointer select-none items-center justify-center rounded-lg text-xl transition-colors font-emoji",
                                    isActive ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"
                                )}
                              >
                                {finalEmoji}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {!showFullPicker && (
            <div
              className={cn(
                "pointer-events-auto w-48 overflow-hidden rounded-xl border border-border bg-popover/90 py-1 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-2",
                isOwner ? "origin-top-right" : "origin-top-left",
              )}
            >
              <button className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted">
                <Reply size={14} /> {t("toReply")}
              </button>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                onClick={() => {
                  navigator.clipboard.writeText(message.content || "");
                  onClose();
                }}
              >
                <Copy size={14} /> {t("copy")}
              </button>
              <button className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted">
                <Forward size={14} /> {t("forward")}
              </button>
              {isOwner && (
                <>
                  <div className="my-1 h-[1px] bg-border" />
                  <button 
                    onClick={() => {
                      onDeleteRequest();
                      onClose();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 size={14} /> {t("delete")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlayContent, document.body);
};


// --- LISTE DES RÉACTIONS SOUS LA BULLE (DESIGN PILLULE) ---
export function ReactionList ({ 
  reactions, 
  onReact,
  onShowDetails
}: { 
  reactions: ReactionData[], 
  onReact: (emoji: string) => void,
  onShowDetails: (event: React.MouseEvent, reactionContent?: string) => void
}){
  const { t } = useTranslation();
  if (!reactions || reactions.length === 0) return null;

  // Calcul pour la pillule unique
  const reactionCounts = reactions.reduce((acc, curr) => {
    acc[curr.content] = (acc[curr.content] || 0) + curr.count;
    return acc;
  }, {} as Record<string, number>);

  const sortedReactions = Object.entries(reactionCounts).sort(([,a], [,b]) => b - a);
  const totalReactions = reactions.reduce((acc, r) => acc + r.count, 0);

  return (
    <div className="relative group/reactions">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onShowDetails(e);
        }}
        className={cn(
          "bg-background/95 backdrop-blur-sm border border-border shadow-md rounded-full px-1.5 py-0.5 flex items-center gap-1 cursor-pointer",
          "hover:scale-110 transition-transform hover:shadow-lg active:scale-95 ring-offset-2 hover:ring-2 ring-primary/20"
        )}
      >
        <div className="flex -space-x-1 px-1">
          {sortedReactions.slice(0, 3).map(([emoji], idx) => (
            <span key={idx} className="text-sm relative z-0 hover:z-10 transition-all font-emoji">
              {emoji}
            </span>
          ))}
        </div>
        <span className="text-[10px] font-bold text-muted-foreground pr-1">
          {totalReactions}
        </span>
      </button>
    </div>
  );
};


// --- MODAL DE DÉTAILS AVEC ONGLETS (GLASS DESIGN) ---
export function ReactionDetailsPopover({
  reactions,
  currentUserId,
  onClose,
  onRemoveReaction,
  anchorRect, // On n'utilise plus anchorRect pour centrer l'overlay globalement comme dans le design demandé
  initialTab
}: {
  reactions: ReactionData[];
  currentUserId: string;
  onClose: () => void;
  onRemoveReaction: () => void;
  anchorRect: DOMRect;
  initialTab?: string | null;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('All');

  // Extraction des emojis uniques pour les onglets
  const uniqueEmojis = [...new Set(reactions.map(r => r.content))];
  
  // Filtrage
  const filteredReactions = activeTab === 'All' 
    ? reactions 
    : reactions.filter(r => r.content === activeTab);

  const displayList = filteredReactions.flatMap(r => 
    r.users.map(u => ({...u, emoji: r.content, reactedAt: u.reactedAt || null}))
  );

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop Flouté */}
      <div 
        className="absolute inset-0 bg-background/40 backdrop-blur-sm transition-opacity animate-in fade-in" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="bg-popover w-full max-w-sm rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[500px] border border-border animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/20">
          <h3 className="text-foreground font-bold text-lg">{t('reactions') || "Reactions"}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted text-muted-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs Scrollables */}
        <div className="px-2 py-3 flex gap-2 overflow-x-auto scrollbar-hide border-b border-border">
          <button
            onClick={() => setActiveTab('All')}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
              activeTab === 'All' 
                ? "bg-primary text-primary-foreground shadow-md" 
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t('all') || "Tout"} <span className="ml-1 opacity-80 text-xs">({displayList.length})</span>
          </button>
          
          {uniqueEmojis.map(emoji => {
            const count = reactions.find(r => r.content === emoji)?.count || 0;
            return (
              <button
                key={emoji}
                onClick={() => setActiveTab(emoji)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-lg font-medium transition-all flex items-center gap-1",
                  activeTab === emoji 
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20" 
                    : "text-muted-foreground hover:bg-muted grayscale hover:grayscale-0"
                )}
              >
                <span className="font-emoji">{emoji}</span>
                <span className="text-xs font-bold opacity-60 font-sans">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Liste des Utilisateurs */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {displayList.length > 0 ? (
            displayList.map((user, idx) => {
              const isMe = user.id === currentUserId;

              return (
                <div key={`${user.id}-${idx}`} className="group flex items-center justify-between p-3 hover:bg-muted/30 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                       <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={40} className="border-2 border-background shadow-sm" />
                       {/* Petit badge d'émoji sur l'avatar */}
                       <div className="absolute -bottom-1 -right-1 bg-popover rounded-full p-[2px] shadow-sm text-sm border border-border">
                         <span className="font-emoji block leading-none">{user.emoji}</span>
                       </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">
                        {isMe ? t("you") : user.displayName}
                      </span>
                      {user.username && <span className="text-[10px] text-muted-foreground">@{user.username}</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                      {/* Timestamp */}
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
                        {user.reactedAt ? <Time time={user.reactedAt} /> : "-"}
                      </span>

                      {/* Bouton supprimer (si c'est moi) */}
                      {isMe && (
                        <button
                          onClick={(e) => {
                              e.stopPropagation();
                              onRemoveReaction();
                              onClose();
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                          title="Retirer ma réaction"
                        >
                            <HeartOff size={14} />
                        </button>
                      )}
                  </div>
                </div>
              );
            })
          ) : (
             <div className="p-8 text-center text-sm text-muted-foreground italic">
               Aucune réaction
             </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};