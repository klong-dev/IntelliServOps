# Chat WebSocket API — Hướng dẫn tích hợp Frontend

> **Namespace:** `/chat`  
> **Protocol:** Socket.IO v4  
> **Base URL:** `ws://<host>:<port>/chat`  
> **Cập nhật:** 2026-03-27

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

## Message Interface (Frontend)

Server trả về tin nhắn theo format sau cho **tất cả** events và REST APIs:

```ts
interface Message {
  id: number;
  content: string;
  images?: string[];       // Mảng URL ảnh (nếu có)
  apartmentId?: string;    // ID căn hộ liên quan (nếu có)
  sender: 'user' | 'support';  // user/guest → 'user', staff/operator/admin → 'support'
  timestamp: Date;
}
```

---

## Gửi ảnh trong chat

### Bước 1: Upload ảnh qua REST API

```ts
const formData = new FormData();
formData.append('images', file1);
formData.append('images', file2); // Tối đa 5 ảnh

const res = await fetch('/api/v1/chat/upload-images', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
const { images } = await res.json(); // images: string[]
```

**Response:**
```json
{ "images": ["https://storage.example.com/chat-images/user-id/123-0.jpg", "..."] }
```

### Bước 2: Gửi tin nhắn kèm URL ảnh qua Socket

```ts
socket.emit('chat:send_message', {
  conversationId: 'conv-id',
  content: 'Xem ảnh căn hộ',
  images: images,                    // Mảng URL từ bước 1
  apartmentId: 'apt-123',           // Tuỳ chọn
  messageType: 'image',             // Tuỳ chọn, mặc định 'text'
});
```

---

## Events: Client → Server

### `chat:create_conversation`

Tạo hoặc nối tiếp cuộc trò chuyện. Với user đã đăng nhập, hoặc guest có `guestSessionId`, server sẽ ưu tiên trả lại conversation gần nhất chưa bị `archived` thay vì tạo conversation mới.

```ts
socket.emit('chat:create_conversation', {
  title?: string,          // Tuỳ chọn, ví dụ "Hỏi về căn hộ A1"
  guestName?: string,      // Chỉ dùng cho guest
  guestEmail?: string,     // Chỉ dùng cho guest
  metadata?: object,       // Dữ liệu bổ sung: { pageUrl, apartmentId, ... }
});
```

→ Server trả về qua `chat:conversation_created`

Ghi chú:
- Nếu conversation cũ đang ở trạng thái `closed` từ dữ liệu trước đây, server sẽ tự đưa về `active` và tiếp tục dùng lại cùng `conversationId`.
- Chỉ khi thật sự tạo conversation mới thì staff mới nhận `chat:new_conversation`.

---

### `chat:send_message`

Gửi tin nhắn vào một conversation.

```ts
socket.emit('chat:send_message', {
  conversationId: string,                        // Bắt buộc
  content: string,                               // Nội dung tin nhắn
  images?: string[],                             // Mảng URL ảnh (từ upload-images API)
  apartmentId?: string,                          // ID căn hộ liên quan
  messageType?: 'text' | 'image' | 'file',       // Mặc định: 'text'
  attachments?: [{                               // Tuỳ chọn
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
| `chat:new_conversation` | Staff: có conversation mới thật sự | `ChatConversation` object |
| `chat:new_message` | Có tin nhắn mới trong room | `Message` object *(xem interface ở trên)* |
| `chat:conversation_updated` | Conversation được cập nhật hoặc được nối lại | `{ conversationId, status, lastMessageAt, lastMessageText, senderName, senderType }` |
| `chat:conversation_data` | Sau khi join conversation | `{ conversation, messages: { data: Message[], meta } }` |
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
  status: 'active' | 'archived' | 'closed'; // `closed` chỉ còn là dữ liệu cũ/historical
  lastMessageAt: string | null;     // ISO datetime
  lastMessageText: string | null;
  metadata: object | null;
  createdAt: string;
  updatedAt: string;
  user?: { id, fullName, email, profileImageUrl };  // null nếu là guest
}
```

### Message (response format)

```ts
{
  id: number;
  content: string;
  images?: string[];          // Mảng URL ảnh, undefined nếu không có
  apartmentId?: string;       // undefined nếu không có
  sender: 'user' | 'support'; // user/guest = 'user', staff/operator/admin = 'support'
  timestamp: Date;
}
```

---

## REST API

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/v1/chat/upload-images` | **Upload ảnh chat** (multipart, max 5 files) → trả về `{ images: string[] }` |
| `GET` | `/api/v1/chat/conversations` | Danh sách conversations (phân trang) |
| `GET` | `/api/v1/chat/conversations/:id` | Chi tiết conversation |
| `GET` | `/api/v1/chat/conversations/:id/messages` | Lịch sử tin nhắn (phân trang, format `Message`) |
| `POST` | `/api/v1/chat/conversations` | Tạo hoặc nối tiếp conversation hiện có (thay thế cho socket) |
| `PATCH` | `/api/v1/chat/conversations/:id/archive` | Lưu trữ *(staff only)* |

---

## Ví dụ tích hợp React

```tsx
// hooks/useChat.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: number;
  content: string;
  images?: string[];
  apartmentId?: string;
  sender: 'user' | 'support';
  timestamp: Date;
}

export function useChat(token: string) {
  const socketRef = useRef<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
      auth: { token },
    });

    socket.on('chat:new_message', (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('chat:new_conversation', (conv) => {
      setConversations((prev) => [conv, ...prev]);
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [token]);

  const sendMessage = useCallback((conversationId: string, content: string, images?: string[], apartmentId?: string) => {
    socketRef.current?.emit('chat:send_message', {
      conversationId,
      content,
      images,
      apartmentId,
      messageType: images?.length ? 'image' : 'text',
    });
  }, []);

  const uploadImages = useCallback(async (files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach((f) => formData.append('images', f));

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/upload-images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    return data.images;
  }, [token]);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('chat:join_conversation', { conversationId });
  }, []);

  return { messages, conversations, sendMessage, uploadImages, joinConversation };
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
