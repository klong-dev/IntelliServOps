# Chat WebSocket API — Hướng dẫn tích hợp Frontend

> **Namespace:** `/chat`  
> **Protocol:** Socket.IO v4  
> **Base URL:** `ws://<host>:<port>/chat`  
> **Cập nhật:** 2026-03-20

---

## Cài đặt

```bash
npm install socket.io-client
```

---

## Kết nối

Có 2 kiểu kết nối tuỳ theo loại người dùng:

### Staff / User (có JWT)

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3006/chat', {
  auth: { token: accessToken },
});
```

- Staff, Operator, Admin → tự động join room `staff:inbox`, nhận mọi conversation mới.
- User → chỉ thấy conversation của mình.

### Guest (không cần JWT)

```ts
const savedSession = localStorage.getItem('chatSessionId');

const socket = io('http://localhost:3006/chat', {
  auth: {
    guestSessionId: savedSession || undefined,
    guestName: 'Nguyễn Văn A',
  },
});

// Lưu session để reconnect lần sau
socket.on('chat:session', ({ guestSessionId }) => {
  localStorage.setItem('chatSessionId', guestSessionId);
});
```

Nếu `guestSessionId` để trống, server sẽ tạo mới và emit lại qua event `chat:session`.

---

## Events: Client → Server

### `chat:create_conversation`

Tạo cuộc trò chuyện mới. Sau khi tạo, tất cả staff online sẽ nhận được thông báo.

```ts
socket.emit('chat:create_conversation', {
  title?: string,          // Tuỳ chọn, ví dụ "Hỏi về căn hộ A1"
  guestName?: string,      // Chỉ dùng cho guest
  guestEmail?: string,     // Chỉ dùng cho guest
  metadata?: object,       // Dữ liệu bổ sung: { pageUrl, apartmentId, ... }
});
```

→ Server trả về qua `chat:conversation_created`

---

### `chat:send_message`

Gửi tin nhắn vào một conversation.

```ts
socket.emit('chat:send_message', {
  conversationId: string,  // Bắt buộc
  content: string,         // Nội dung tin nhắn
  messageType?: 'text' | 'image' | 'file',  // Mặc định: 'text'
  attachments?: [{         // Tuỳ chọn
    url: string,
    filename: string,
    mimeType?: string,
    size?: number,
  }],
});
```

→ Tất cả thành viên trong conversation nhận được qua `chat:new_message`

---

### `chat:join_conversation`

Staff dùng để tham gia một conversation (xem lịch sử + nhận tin nhắn real-time).

```ts
socket.emit('chat:join_conversation', {
  conversationId: string,
});
```

→ Server trả về lịch sử qua `chat:conversation_data`

---

### `chat:leave_conversation`

Rời khỏi room của conversation (ngừng nhận tin nhắn real-time).

```ts
socket.emit('chat:leave_conversation', {
  conversationId: string,
});
```

---

### `chat:typing` / `chat:stop_typing`

Hiển thị trạng thái đang gõ.

```ts
socket.emit('chat:typing', { conversationId: string });
socket.emit('chat:stop_typing', { conversationId: string });
```

> **Tip:** Dùng debounce 300ms khi user gõ, gửi `stop_typing` sau 2s không nhấn phím.

---

### `chat:mark_read`

Đánh dấu tất cả tin nhắn chưa đọc (từ phía bên kia) là đã đọc.

```ts
socket.emit('chat:mark_read', { conversationId: string });
```

---

### `chat:heartbeat`

Gửi mỗi 30 giây để duy trì trạng thái online trên Redis.

```ts
setInterval(() => socket.emit('chat:heartbeat'), 30_000);
```

---

## Events: Server → Client

| Event | Khi nào | Payload |
|---|---|---|
| `chat:session` | Ngay sau kết nối (guest) | `{ guestSessionId: string }` |
| `chat:conversation_created` | Sau khi tạo conversation | `ChatConversation` object |
| `chat:new_conversation` | Staff: có conversation mới | `ChatConversation` object |
| `chat:new_message` | Có tin nhắn mới trong room | `ChatMessage` object |
| `chat:conversation_updated` | Conversation có tin nhắn mới | `{ conversationId, lastMessageAt, lastMessageText, senderName, senderType }` |
| `chat:conversation_data` | Sau khi join conversation | `{ conversation, messages }` |
| `chat:staff_joined` | Staff vào conversation | `{ conversationId, staffName, actorType }` |
| `chat:user_typing` | Ai đó đang gõ | `{ conversationId, actorType, actorId, fullName }` |
| `chat:user_stop_typing` | Ngừng gõ | `{ conversationId, actorType, actorId }` |
| `chat:messages_read` | Tin nhắn được đọc | `{ conversationId, readerType, readerName, markedCount }` |
| `chat:online_status` | Thay đổi online/offline | `{ actorType, actorId, isOnline }` |
| `chat:error` | Có lỗi xảy ra | `{ message: string }` |

---

## Object Schemas

### ChatConversation

```ts
{
  id: string;
  title: string | null;
  userId: string | null;
  guestSessionId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  status: 'active' | 'closed' | 'archived';
  lastMessageAt: string | null;     // ISO datetime
  lastMessageText: string | null;
  metadata: object | null;
  createdAt: string;
  updatedAt: string;
  user?: { id, fullName, email, profileImageUrl };  // null nếu là guest
}
```

### ChatMessage

```ts
{
  id: string;
  conversationId: string;
  senderType: 'user' | 'guest' | 'staff' | 'operator' | 'admin' | 'system';
  senderId: string | null;
  senderName: string | null;
  messageType: 'text' | 'image' | 'file' | 'system';
  content: string;
  attachments: object[] | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## REST API bổ sung

WebSocket xử lý real-time, còn REST dùng để load lịch sử và quản lý conversation. Tài liệu đầy đủ trên **Swagger** tại `/docs`, dưới tag **Chat**.

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/v1/chat/conversations` | Danh sách conversations (phân trang) |
| `GET` | `/api/v1/chat/conversations/:id` | Chi tiết conversation |
| `GET` | `/api/v1/chat/conversations/:id/messages` | Lịch sử tin nhắn (phân trang) |
| `POST` | `/api/v1/chat/conversations` | Tạo conversation (thay thế cho socket) |
| `PATCH` | `/api/v1/chat/conversations/:id/close` | Đóng conversation *(staff only)* |
| `PATCH` | `/api/v1/chat/conversations/:id/archive` | Lưu trữ *(staff only)* |
| `PATCH` | `/api/v1/chat/conversations/:id/reopen` | Mở lại *(staff only)* |

---

## Ví dụ tích hợp React

```tsx
// hooks/useChat.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export function useChat(token: string) {
  const socketRef = useRef<Socket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
      auth: { token },
    });

    socket.on('chat:new_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('chat:new_conversation', (conv) => {
      setConversations((prev) => [conv, ...prev]);
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [token]);

  const sendMessage = useCallback((conversationId: string, content: string) => {
    socketRef.current?.emit('chat:send_message', { conversationId, content });
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('chat:join_conversation', { conversationId });
  }, []);

  return { messages, conversations, sendMessage, joinConversation };
}
```

---

## Xử lý lỗi & Reconnect

Socket.IO tự động reconnect khi mất kết nối. Bạn có thể listen thêm:

```ts
socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', (reason) => console.log('Disconnected:', reason));
socket.on('connect_error', (err) => console.error('Connection error:', err.message));
socket.on('chat:error', ({ message }) => toast.error(message));
```

Nếu server trả `chat:error` với message `"Authentication failed"` → token hết hạn, cần refresh token và reconnect.
