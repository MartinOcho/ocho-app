import kyInstance from "./ky";

// Créer un canal de discussion
export async function createChatRoom(userId: string, recipientId: string) {
  return kyInstance
    .post("/api/chat-rooms", {
      json: {
        userId,
        recipientId,
        isGroup: false,
      },
    })
    .json();
}

// Créer un canal de discussion de groupe
export async function createGroupChatRoom(
  userId: string,
  name: string,
  members: string[],
) {
  return kyInstance
    .post("/api/chat-rooms", {
      json: {
        userId,
        name,
        isGroup: true,
        members,
      },
    })
    .json();
}

// Envoyer un message
export async function sendMessage(
  content: string,
  roomId: string,
  senderId: string,
) {
  return kyInstance
    .post("/api/messages", {
      json: {
        content,
        roomId,
        senderId,
      },
    })
    .json();
}

// Récupérer les messages d'un canal
export async function getMessages(roomId: string) {
  return kyInstance.get(`/api/messages?roomId=${roomId}`).json();
}
