import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

interface Message {
    id: string;
    username: string;
    text: string;
    timestamp: Date;
}

interface User {
    id: string;
    username: string;
    joinedAt: Date;
}

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../public')));

const messages: Message[] = [];
const users = new Map<string, User>();

io.on('connection', (socket) => {
    socket.on('join', (username: string) => {
        if (!username || username.trim().length === 0) {
            socket.emit('error', 'Nom d\'utilisateur requis');
            return;
        }

        const existingUser = Array.from(users.values()).find(u => u.username === username);
        if (existingUser) {
            socket.emit('error', 'Ce nom d\'utilisateur est déjà pris');
            return;
        }

        const user: User = {
            id: socket.id,
            username: username.trim(),
            joinedAt: new Date()
        };
        users.set(socket.id, user);

        socket.emit('joined', user);

        socket.emit('messageHistory', messages);

        socket.emit('usersList', Array.from(users.values()));

        socket.broadcast.emit('userJoined', user);
        socket.broadcast.emit('usersList', Array.from(users.values()));

        const welcomeMessage: Message = {
            id: generateId(),
            username: 'Système',
            text: `${username} a rejoint le chat`,
            timestamp: new Date()
        };
        messages.push(welcomeMessage);
        io.emit('newMessage', welcomeMessage);
    });

    socket.on('sendMessage', (text: string) => {
        const user = users.get(socket.id);
        if (!user) {
            socket.emit('error', 'Vous devez d\'abord vous connecter');
            return;
        }

        if (!text || text.trim().length === 0) {
            return;
        }

        const message: Message = {
            id: generateId(),
            username: user.username,
            text: text.trim(),
            timestamp: new Date()
        };

        messages.push(message);
        
        if (messages.length > 100) {
            messages.shift();
        }

        io.emit('newMessage', message);
    });

    socket.on('typing', () => {
        const user = users.get(socket.id);
        if (user) {
            socket.broadcast.emit('userTyping', user.username);
        }
    });

    socket.on('stopTyping', () => {
        const user = users.get(socket.id);
        if (user) {
            socket.broadcast.emit('userStoppedTyping', user.username);
        }
    });

    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            
            users.delete(socket.id);
            
            socket.broadcast.emit('userLeft', user);
            socket.broadcast.emit('usersList', Array.from(users.values()));

            const leaveMessage: Message = {
                id: generateId(),
                username: 'Système',
                text: `${user.username} a quitté le chat`,
                timestamp: new Date()
            };
            messages.push(leaveMessage);
            socket.broadcast.emit('newMessage', leaveMessage);
        }
    });
});

function generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur de messagerie démarré sur le port ${PORT}`);
    console.log(`💬 Chat disponible sur: http://localhost:${PORT}`);
});
