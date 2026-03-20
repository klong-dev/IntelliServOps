# Chat System: Staff ↔ User/Guest (Socket.IO)

A real-time chat system inspired by Facebook Business Chat: shared staff inbox, live conversations with users and guests, online presence, typing indicators.

## User Review Required

> [!IMPORTANT]
> **Guest identity strategy**: Guests connect without a JWT. The system will generate a `sessionId` (UUID) server-side on first connection and store it client-side. The `ChatConversation.userId` will be `null` for guests, and we use `guestSessionId` + optional `guestName`/`guestEmail` to identify them. Does this align with your expectations?

> [!IMPORTANT]
> **Staff scope**: All staff (staff, operator, admin) can see ALL conversations and directly reply. There is no per-staff assignment — any staff member can jump in. Is this the desired behavior, or should conversations be assignable to specific staff?

## Proposed Changes

### Prisma Schema

#### [MODIFY] [schema.prisma](file:///c:/Users/user/Desktop/VSCode/NestJS/IntelliRentOps/prisma/schema.prisma)

Add new enums and models at the end of the schema:

```prisma
// --- Chat Enums ---
enum ConversationStatus {
  active
  closed
  archived
}

enum MessageType {
  text
  image
  file
  system    // "Staff X joined", "Conversation closed", etc.
}

enum SenderType {
  user
  guest
  staff
  operator
  admin
  system
}

// --- Chat Models ---
model ChatConversation {
  id              String             @id @default(uuid())
  title           String?            // Optional: auto-generated or custom
  userId          String?            // null for guest conversations
  guestSessionId  String?            // UUID session for guests
  guestName       String?            // Guest display name
  guestEmail      String?            // Guest email (optional)
  status          ConversationStatus @default(active)
  lastMessageAt   DateTime?
  lastMessageText String?            // Preview snippet
  metadata        Json?              // Extra context (page URL, apartment of interest, etc.)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  // Relations
  user     User?          @relation(fields: [userId], references: [id])
  messages ChatMessage[]

  @@index([userId])
  @@index([guestSessionId])
  @@index([status])
  @@index([lastMessageAt])
  @@map("chat_conversations")
}

model ChatMessage {
  id              String      @id @default(uuid())
  conversationId  String
  senderType      SenderType
  senderId        String?     // actor UUID (staff/user) or null for guest/system
  senderName      String?     // Display name at send time
  messageType     MessageType @default(text)
  content         String
  attachments     Json?       // [{url, filename, mimeType, size}]
  isRead          Boolean     @default(false)
  readAt          DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  // Relations
  conversation ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@index([senderType, senderId])
  @@index([createdAt])
  @@map("chat_messages")
}
```

Also add `chatConversations` relation to the **User** model:
```diff
 model User {
   ...
+  chatConversations ChatConversation[]
   ...
 }
```

---

### Dependencies

#### [MODIFY] [package.json](file:///c:/Users/user/Desktop/VSCode/NestJS/IntelliRentOps/package.json)

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

---

### Chat Module (NestJS)

All new files under `src/modules/chat/`.

#### [NEW] [chat.module.ts](file:///c:/Users/user/Desktop/VSCode/NestJS/IntelliRentOps/src/modules/chat/chat.module.ts)

- Registers `ChatGateway`, `ChatService`, `ChatController`
- Imports `JwtModule` for token verification in the gateway

#### [NEW] [chat.gateway.ts](file:///c:/Users/user/Desktop/VSCode/NestJS/IntelliRentOps/src/modules/chat/chat.gateway.ts)

Socket.IO WebSocket Gateway (`@WebSocketGateway`) with these features:

| Event (Client → Server) | Description |
|---|---|
| `connection` | Auth handshake: JWT token in `auth.token` for staff/user, or `auth.guestSessionId` for guests |
| `chat:send_message` | Send a message to a conversation |
| `chat:create_conversation` | Guest/user starts a new conversation |
| `chat:join_conversation` | Staff joins a conversation room to observe/reply |
| `chat:typing` | Typing indicator (broadcast to conversation room) |
| `chat:stop_typing` | Stop typing indicator |
| `chat:mark_read` | Mark messages as read |

| Event (Server → Client) | Description |
|---|---|
| `chat:new_message` | New message in a conversation |
| `chat:new_conversation` | Broadcast to **all connected staff** when a new conversation starts |
| `chat:user_typing` | Someone is typing |
| `chat:user_stop_typing` | Someone stopped typing |
| `chat:messages_read` | Messages marked as read |
| `chat:online_status` | Online/offline status updates |

**Connection logic:**
1. **Staff/Operator/Admin**: Pass JWT in `auth.token`. Gateway verifies via `AuthService.verifyAccessToken()`. Auto-join room `staff:inbox` to receive all new conversations.
2. **Logged-in User**: Pass JWT in `auth.token`. Gateway verifies. Auto-join their active conversation rooms.
3. **Guest**: Pass `guestSessionId` (or empty to generate one). No JWT required. The gateway emits back the `sessionId` for the client to persist.

#### [NEW] [chat.service.ts](file:///c:/Users/user/Desktop/VSCode/NestJS/IntelliRentOps/src/modules/chat/chat.service.ts)

Business logic:
- `createConversation()` — Creates a `ChatConversation` (with userId or guestSessionId)
- `sendMessage()` — Creates a `ChatMessage`, updates conversation `lastMessageAt/lastMessageText`
- `getConversations()` — Paginated list (for staff: all active; for user: own conversations)
- `getMessages()` — Paginated messages for a conversation
- `markMessagesRead()` — Mark messages as read
- `closeConversation()` / `archiveConversation()`
- `getOnlineStaff()` — Read from Redis

#### [NEW] [chat.controller.ts](file:///c:/Users/user/Desktop/VSCode/NestJS/IntelliRentOps/src/modules/chat/chat.controller.ts)

REST API endpoints for history retrieval (the gateway handles real-time):
- `GET /chat/conversations` — List conversations (staff sees all, user sees own)
- `GET /chat/conversations/:id/messages` — Paginated message history
- `POST /chat/conversations` — Create conversation (optional, can also be done via socket)
- `PATCH /chat/conversations/:id/close` — Close conversation
- `PATCH /chat/conversations/:id/archive` — Archive conversation

#### [NEW] DTOs

- `src/modules/chat/dto/create-conversation.dto.ts`
- `src/modules/chat/dto/send-message.dto.ts`
- `src/modules/chat/dto/query-conversations.dto.ts`
- `src/modules/chat/dto/query-messages.dto.ts`
- `src/modules/chat/dto/index.ts`

#### [NEW] [index.ts](file:///c:/Users/user/Desktop/VSCode/NestJS/IntelliRentOps/src/modules/chat/index.ts)

Module barrel export.

---

### App Integration

#### [MODIFY] [app.module.ts](file:///c:/Users/user/Desktop/VSCode/NestJS/IntelliRentOps/src/app.module.ts)

Add `ChatModule` to imports.

#### [MODIFY] [modules/index.ts](file:///c:/Users/user/Desktop/VSCode/NestJS/IntelliRentOps/src/modules/index.ts)

Add `export * from './chat'`.

---

### Online Presence (Redis)

Staff/user online status tracked in Redis with auto-expiry:
- Key pattern: `chat:online:{actorType}:{actorId}` with TTL 60s
- Heartbeat every 30s from connected clients renews the key
- On disconnect, the key is deleted immediately

---

## Verification Plan

### Automated Tests

```bash
# 1. Build check — ensure no TypeScript compilation errors
npm run build

# 2. Prisma migration — verify schema is valid
npx prisma migrate dev --name add_chat_system
```

### Manual Verification

Since this is a WebSocket-based system, the best way to verify is:

1. **Start the server**: `npm run start:dev`
2. **Test with a Socket.IO client** (e.g., Postman WebSocket, or a simple HTML page with `socket.io-client`):
   - Connect as staff (pass JWT in `auth.token`)
   - Connect as guest (pass `guestSessionId` or empty)
   - Guest creates a conversation → staff receives `chat:new_conversation`
   - Guest sends a message → staff receives `chat:new_message`
   - Staff replies → guest receives `chat:new_message`
   - Typing indicators work bidirectionally
3. **REST API test** via Swagger (`/docs`):
   - `GET /api/v1/chat/conversations` — returns conversations list
   - `GET /api/v1/chat/conversations/:id/messages` — returns messages

> I'll provide a ready-to-use test HTML page for quick Socket.IO manual testing after implementation.
