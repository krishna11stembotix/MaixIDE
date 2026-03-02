import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocketPlugin from '@fastify/websocket';

const server = Fastify({ logger: true });

// ─── Plugins ─────────────────────────────────────────────────────────────────
server.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
});

server.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'maixide-dev-secret-change-in-prod',
});

server.register(websocketPlugin);

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
server.get('/health', async () => ({ status: 'ok', service: 'MaixIDE Backend' }));

// Auth (stub)
server.post('/auth/register', async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string };
    // TODO: Store user in DB
    const token = server.jwt.sign({ email }, { expiresIn: '7d' });
    return reply.send({ token });
});

server.post('/auth/login', async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string };
    // TODO: Verify against DB
    const token = server.jwt.sign({ email }, { expiresIn: '7d' });
    return reply.send({ token });
});

// Projects (stub – would use a DB in production)
const projects: Record<string, unknown>[] = [];

server.get('/projects', { preHandler: [server.authenticate] }, async (req) => {
    return projects;
});

server.post('/projects', { preHandler: [server.authenticate] }, async (req, reply) => {
    const project = { id: String(Date.now()), ...(req.body as object) };
    projects.push(project);
    return reply.code(201).send(project);
});

// ─── WebSocket relay (for remote device management) ───────────────────────────
server.register(async function (app) {
    app.get('/device/relay', { websocket: true }, (socket, req) => {
        socket.on('message', (message) => {
            // Relay messages to all other connected clients
            server.log.info(`Relay message: ${message.toString()}`);
            // In production, route to the correct device agent by device ID
        });
        socket.on('close', () => {
            server.log.info('Device relay client disconnected');
        });
    });
});

// ─── Fastify auth decorator ───────────────────────────────────────────────────
declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}

server.decorate('authenticate', async (req: Parameters<typeof server.authenticate>[0], reply: Parameters<typeof server.authenticate>[1]) => {
    try {
        await req.jwtVerify();
    } catch (err) {
        reply.send(err);
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);

server.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) { server.log.error(err); process.exit(1); }
    server.log.info(`MaixIDE backend listening on port ${PORT}`);
});
